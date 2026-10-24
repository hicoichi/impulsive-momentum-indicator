// フェーズ2のバックエンド
//
// GitHub Pages（画面） → CloudFront → API Gateway（HTTP API） → Lambda → DynamoDB
//                          GET /counts だけ数秒キャッシュする

import * as path from 'node:path'
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2'
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as cdk from 'aws-cdk-lib/core'
import type { Construct } from 'constructs'
import {
  allowedOrigins,
  COUNTS_CACHE_SECONDS,
  DEFAULT_THROTTLE,
  ROUTE_THROTTLES,
  signingKeyParameterName,
  type RouteKey,
} from './api-settings'
import { CostBudget, type CostBudgetProps } from './cost-budget'
import type { Stage } from './stage'

export interface BackendStackProps extends cdk.StackProps {
  stage: Stage
  /** 指定したときだけ予算アラートを作る */
  budget?: CostBudgetProps
}

/**
 * バンドルの基準ディレクトリ。esbuild を infra/node_modules から使うため infra/ にする。
 * Lambda が相対パスで import する app/domain は、基準の外でも esbuild がそのまま取り込む
 */
const INFRA_ROOT = path.join(__dirname, '..')

export class BackendStack extends cdk.Stack {
  readonly stage: Stage

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props)
    this.stage = props.stage
    const isProd = props.stage === 'prod'

    // 集計の5分枠とセッションの投票記録。どちらも TTL で自動的に消える
    const table = new dynamodb.TableV2(this, 'VotesTable', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      // 処理量の上限は費用の上限も兼ねる
      billing: dynamodb.Billing.onDemand({ maxReadRequestUnits: 100, maxWriteRequestUnits: 100 }),
      timeToLiveAttribute: 'expiresAt',
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: isProd },
      deletionProtection: isProd,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    })

    const signingKey = ssm.StringParameter.fromSecureStringParameterAttributes(this, 'SigningKey', {
      parameterName: signingKeyParameterName(props.stage),
    })

    const logGroup = new logs.LogGroup(this, 'ApiFunctionLogs', {
      retention: isProd ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    const fn = new nodejs.NodejsFunction(this, 'ApiFunction', {
      entry: path.join(__dirname, '../lambda/api/handler.ts'),
      handler: 'handler',
      projectRoot: INFRA_ROOT,
      depsLockFilePath: path.join(__dirname, '../package-lock.json'),
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(5),
      logGroup,
      environment: {
        TABLE_NAME: table.tableName,
        SIGNING_KEY_PARAMETER: signingKey.parameterName,
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node24',
        // AWS SDK も同梱し、ランタイムに含まれる版の違いに左右されないようにする
        externalModules: [],
      },
    })

    // 必要な操作だけを許可する（TransactWriteItems は Put と Update の権限で動く）
    table.grant(fn, 'dynamodb:Query', 'dynamodb:PutItem', 'dynamodb:UpdateItem')
    signingKey.grantRead(fn)

    const api = new apigwv2.HttpApi(this, 'HttpApi', {
      createDefaultStage: false,
      corsPreflight: {
        allowOrigins: allowedOrigins(props.stage),
        allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST, apigwv2.CorsHttpMethod.OPTIONS],
        allowHeaders: ['content-type', 'x-session-token'],
        maxAge: cdk.Duration.hours(2),
      },
    })

    const integration = new integrations.HttpLambdaIntegration('ApiIntegration', fn)
    const routes = (Object.keys(ROUTE_THROTTLES) as RouteKey[]).flatMap((routeKey) => {
      const [method, routePath] = routeKey.split(' ') as [keyof typeof apigwv2.HttpMethod, string]
      return api.addRoutes({ path: routePath, methods: [apigwv2.HttpMethod[method]], integration })
    })

    const stage = new apigwv2.HttpStage(this, 'DefaultStage', {
      httpApi: api,
      stageName: '$default',
      autoDeploy: true,
      throttle: DEFAULT_THROTTLE,
    })
    // ルートごとの流量上限は L2 で設定できないため L1 で指定する
    const cfnStage = stage.node.defaultChild as apigwv2.CfnStage
    cfnStage.routeSettings = Object.fromEntries(
      Object.entries(ROUTE_THROTTLES).map(([routeKey, limit]) => [
        routeKey,
        { ThrottlingRateLimit: limit.rateLimit, ThrottlingBurstLimit: limit.burstLimit },
      ]),
    )
    // ルートが作られる前にステージを作ると、ルートの設定が見つからずデプロイに失敗する
    routes.forEach(route => stage.node.addDependency(route))

    const apiOrigin = new origins.HttpOrigin(cdk.Fn.select(2, cdk.Fn.split('/', api.apiEndpoint)), {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
    })

    const countsCachePolicy = new cloudfront.CachePolicy(this, 'CountsCachePolicy', {
      comment: '集計数を数秒だけキャッシュする',
      defaultTtl: cdk.Duration.seconds(COUNTS_CACHE_SECONDS),
      minTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.seconds(COUNTS_CACHE_SECONDS),
      // CORS の応答は Origin ヘッダーで変わるため、キャッシュを分ける
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Origin'),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    })

    const distribution = new cloudfront.Distribution(this, 'ApiDistribution', {
      comment: `impulsive-momentum-indicator API (${props.stage})`,
      // 日本を含む地域の拠点を使う
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      // セッションを扱うルートはキャッシュしない（他人の残り枠を返さないため）
      defaultBehavior: {
        origin: apiOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
      additionalBehaviors: {
        '/counts': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: countsCachePolicy,
        },
      },
    })

    if (props.budget) {
      new CostBudget(this, 'CostBudget', props.budget)
    }

    new cdk.CfnOutput(this, 'ApiBaseUrl', {
      description: 'フロントの NUXT_PUBLIC_API_BASE_URL に設定する URL',
      value: `https://${distribution.distributionDomainName}`,
    })
    new cdk.CfnOutput(this, 'SigningKeyParameterName', {
      description: 'デプロイ前に SecureString で作っておく SSM パラメーター',
      value: signingKey.parameterName,
    })
  }
}
