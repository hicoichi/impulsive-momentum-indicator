// GitHub Actions から CDK をデプロイするための OIDC プロバイダーと IAM ロール。
// アカウントに1つだけ作る（ステージごとには作らない）。初回だけ手元からデプロイする

import * as iam from 'aws-cdk-lib/aws-iam'
import * as cdk from 'aws-cdk-lib/core'
import type { Construct } from 'constructs'

/** デプロイを許可するリポジトリとブランチ */
export const GITHUB_REPOSITORY = 'hicoichi/impulsive-momentum-indicator'
export const DEPLOY_BRANCH = 'main'

const GITHUB_OIDC_URL = 'https://token.actions.githubusercontent.com'

export class GithubDeployStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const provider = new iam.OidcProviderNative(this, 'GithubOidcProvider', {
      url: GITHUB_OIDC_URL,
      clientIds: ['sts.amazonaws.com'],
    })

    const role = new iam.Role(this, 'DeployRole', {
      // IAM の説明文は ASCII などに限られるため英語で書く
      description: `Deploy CDK stacks from ${GITHUB_REPOSITORY} (${DEPLOY_BRANCH} branch) via GitHub Actions`,
      maxSessionDuration: cdk.Duration.hours(1),
      // main ブランチで動いたワークフローだけが引き受けられる
      assumedBy: new iam.WebIdentityPrincipal(provider.oidcProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          'token.actions.githubusercontent.com:sub': `repo:${GITHUB_REPOSITORY}:ref:refs/heads/${DEPLOY_BRANCH}`,
        },
      }),
    })

    // CDK の初期設定（bootstrap）で作られたロールだけを引き受けられるようにする。
    // 実際のリソースの変更は、それらのロールを通じて CloudFormation が行う
    role.addToPolicy(new iam.PolicyStatement({
      actions: ['sts:AssumeRole'],
      resources: [`arn:${cdk.Aws.PARTITION}:iam::${cdk.Aws.ACCOUNT_ID}:role/cdk-hnb659fds-*-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`],
    }))

    new cdk.CfnOutput(this, 'DeployRoleArn', {
      description: 'GitHub の変数 AWS_DEPLOY_ROLE_ARN に設定する',
      value: role.roleArn,
    })
  }
}
