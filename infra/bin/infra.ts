#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core'
import { BackendStack } from '../lib/backend-stack'
import { resolveBudget } from '../lib/budget-context'
import { GithubDeployStack } from '../lib/github-deploy-stack'
import { resolveStage } from '../lib/stage'

const app = new cdk.App()
const stage = resolveStage(app.node.tryGetContext('stage'))

// すべてのリソースに付けるタグ
cdk.Tags.of(app).add('Project', 'impulsive-momentum-indicator')
cdk.Tags.of(app).add('Stage', stage)

// アカウントとリージョンはコードに書かず、cdk コマンド実行時の AWS 設定から受け取る
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
}

new BackendStack(app, `ImpulsiveMomentumBackend-${stage}`, {
  stage,
  // メールアドレスはコミットせず、cdk コマンドの -c budgetEmail=<アドレス> で渡す
  budget: resolveBudget(app.node.tryGetContext('budgetEmail'), app.node.tryGetContext('budgetLimitUsd')),
  env,
})

// ステージに関係なくアカウントに1つ。GitHub Actions からのデプロイに使う
new GithubDeployStack(app, 'ImpulsiveMomentumGithubDeploy', { env })
