// Lambda の入口。設定の読み取りと AWS クライアントの生成だけを行い、処理は app.ts に任せる

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { VOTE_WINDOWS_MS } from '../../../app/domain/vote'
import { createApiHandler } from './app'
import { createDynamoVoteStore } from './dynamo-vote-store'

/** HMAC-SHA256 の鍵として十分な長さ */
const MIN_SIGNING_KEY_LENGTH = 32

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`環境変数 ${name} が設定されていない`)
  return value
}

const tableName = requireEnv('TABLE_NAME')
const signingKeyParameter = requireEnv('SIGNING_KEY_PARAMETER')

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const ssmClient = new SSMClient({})

let signingKeyPromise: Promise<string> | undefined

/** 署名用の鍵を SSM パラメータストアから読み、実行環境が生きている間は使い回す */
function loadSigningKey(): Promise<string> {
  signingKeyPromise ??= ssmClient
    .send(new GetParameterCommand({ Name: signingKeyParameter, WithDecryption: true }))
    .then((response) => {
      const value = response.Parameter?.Value
      if (!value || value.length < MIN_SIGNING_KEY_LENGTH) {
        throw new Error(`署名用の鍵が ${MIN_SIGNING_KEY_LENGTH} 文字未満`)
      }
      return value
    })
    .catch((cause: unknown) => {
      // 失敗した結果を使い回さず、次の呼び出しで取り直す
      signingKeyPromise = undefined
      throw cause
    })
  return signingKeyPromise
}

export const handler = createApiHandler({
  store: createDynamoVoteStore(documentClient, tableName),
  now: Date.now,
  // サーバーは常に12時間で集計する。60秒のウィンドウはフロントのモック専用（US-V1）
  windowMs: VOTE_WINDOWS_MS['12h'],
  signingKey: loadSigningKey,
})
