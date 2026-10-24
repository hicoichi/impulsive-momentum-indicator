// DynamoDB による VoteStore の実装。1つのテーブルに集計とセッションの記録を持つ
//
// | 種類         | pk                 | sk                  | 属性                         |
// |--------------|--------------------|---------------------|------------------------------|
// | 集計の枠     | COUNT#<衝動>       | B#<枠の開始時刻>    | votes（票数）、expiresAt     |
// | セッション   | SESSION#<ID>       | IMPULSE#<衝動>      | votes（投票記録）、version、expiresAt |

import { TransactionCanceledException } from '@aws-sdk/client-dynamodb'
import { QueryCommand, TransactWriteCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { createImpulseRecord, IMPULSE_KEYS, type ImpulseKey } from '../../../app/domain/impulse'
import type { CastVote } from '../../../app/domain/vote'
import type { CommitVoteInput, CommitVoteResult, SessionVotes, VoteStore } from './vote-store'

/** 枠の開始時刻を文字列で並べ替えられるよう、桁をそろえる */
const BUCKET_KEY_DIGITS = 15

export function countKey(impulse: ImpulseKey): string {
  return `COUNT#${impulse}`
}

export function bucketKey(start: number): string {
  return `B#${String(start).padStart(BUCKET_KEY_DIGITS, '0')}`
}

export function sessionKey(sid: string): string {
  return `SESSION#${sid}`
}

export function impulseKey(impulse: ImpulseKey): string {
  return `IMPULSE#${impulse}`
}

function isImpulseKey(value: string): value is ImpulseKey {
  return (IMPULSE_KEYS as readonly string[]).includes(value)
}

function toCastVotes(value: unknown): CastVote[] {
  if (!Array.isArray(value)) return []
  return value.filter((vote): vote is CastVote =>
    typeof vote === 'object' && vote !== null
    && typeof (vote as CastVote).id === 'string' && typeof (vote as CastVote).at === 'number')
}

export function createDynamoVoteStore(client: DynamoDBDocumentClient, tableName: string): VoteStore {
  return {
    async getSessionVotes(sid) {
      const result = createImpulseRecord<SessionVotes>(() => ({ votes: [], version: 0 }))
      const response = await client.send(new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': sessionKey(sid) },
        ConsistentRead: true,
      }))
      for (const item of response.Items ?? []) {
        const impulse = String(item.sk).replace(/^IMPULSE#/, '')
        if (!isImpulseKey(impulse)) continue
        result[impulse] = {
          votes: toCastVotes(item.votes),
          version: typeof item.version === 'number' ? item.version : 0,
        }
      }
      return result
    },

    async commitVote(input: CommitVoteInput): Promise<CommitVoteResult> {
      const isNew = input.expectedVersion === 0
      try {
        await client.send(new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: tableName,
                Item: {
                  pk: sessionKey(input.sid),
                  sk: impulseKey(input.impulse),
                  votes: input.votes,
                  version: input.expectedVersion + 1,
                  expiresAt: input.sessionExpiresAt,
                },
                // 読み取ってから保存するまでに別の投票が入っていたら競合として読み直す
                ConditionExpression: isNew ? 'attribute_not_exists(pk)' : 'version = :version',
                ExpressionAttributeValues: isNew ? undefined : { ':version': input.expectedVersion },
              },
            },
            {
              Update: {
                TableName: tableName,
                Key: { pk: countKey(input.impulse), sk: bucketKey(input.bucketStart) },
                UpdateExpression: 'ADD votes :one SET expiresAt = if_not_exists(expiresAt, :expiresAt)',
                ExpressionAttributeValues: { ':one': 1, ':expiresAt': input.bucketExpiresAt },
              },
            },
          ],
        }))
        return 'committed'
      }
      catch (error) {
        const conflicted = error instanceof TransactionCanceledException
          && (error.CancellationReasons ?? []).some(reason => reason.Code === 'ConditionalCheckFailed')
        if (conflicted) return 'conflict'
        throw error
      }
    },

    async sumCounts(impulse, fromBucket) {
      let total = 0
      let startKey: Record<string, unknown> | undefined
      do {
        const response = await client.send(new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'pk = :pk AND sk >= :from',
          ExpressionAttributeValues: { ':pk': countKey(impulse), ':from': bucketKey(fromBucket) },
          ProjectionExpression: 'votes',
          ExclusiveStartKey: startKey,
        }))
        for (const item of response.Items ?? []) {
          if (typeof item.votes === 'number') total += item.votes
        }
        startKey = response.LastEvaluatedKey
      } while (startKey)
      return total
    },
  }
}
