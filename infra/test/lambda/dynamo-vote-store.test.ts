import { TransactionCanceledException } from '@aws-sdk/client-dynamodb'
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { createDynamoVoteStore } from '../../lambda/api/dynamo-vote-store'
import type { CommitVoteInput } from '../../lambda/api/vote-store'

const INPUT: CommitVoteInput = {
  sid: 'AAAAAAAAAAAAAAAAAAAAAA',
  impulse: 'ikki',
  votes: [{ id: 'v1', at: 1000 }],
  expectedVersion: 0,
  sessionExpiresAt: 2000,
  bucketStart: 900,
  bucketExpiresAt: 3000,
}

function storeWith(send: jest.Mock) {
  return createDynamoVoteStore({ send } as unknown as DynamoDBDocumentClient, 'Votes')
}

function canceled(code: string) {
  return new TransactionCanceledException({ message: 'canceled', $metadata: {}, CancellationReasons: [{ Code: code }] })
}

describe('DynamoDB の VoteStore', () => {
  test('セッションの保存と集計の加算を1つのトランザクションで行う', async () => {
    const send = jest.fn().mockResolvedValue({})
    expect(await storeWith(send).commitVote(INPUT)).toBe('committed')
    const items = send.mock.calls[0][0].input.TransactItems
    expect(items).toHaveLength(2)
    expect(items[0].Put).toMatchObject({
      Item: { pk: 'SESSION#AAAAAAAAAAAAAAAAAAAAAA', sk: 'IMPULSE#ikki', version: 1, expiresAt: 2000 },
      ConditionExpression: 'attribute_not_exists(pk)',
    })
    expect(items[1].Update).toMatchObject({
      Key: { pk: 'COUNT#ikki', sk: 'B#000000000000900' },
      ExpressionAttributeValues: { ':one': 1, ':expiresAt': 3000 },
    })
  })

  test('既存の記録は版が一致するときだけ更新する', async () => {
    const send = jest.fn().mockResolvedValue({})
    await storeWith(send).commitVote({ ...INPUT, expectedVersion: 3 })
    expect(send.mock.calls[0][0].input.TransactItems[0].Put).toMatchObject({
      ConditionExpression: 'version = :version',
      ExpressionAttributeValues: { ':version': 3 },
      Item: { version: 4 },
    })
  })

  test('条件の不一致は競合として返す', async () => {
    const send = jest.fn().mockRejectedValue(canceled('ConditionalCheckFailed'))
    expect(await storeWith(send).commitVote(INPUT)).toBe('conflict')
  })

  test('それ以外の失敗はそのまま投げる', async () => {
    const send = jest.fn().mockRejectedValue(canceled('ThrottlingError'))
    await expect(storeWith(send).commitVote(INPUT)).rejects.toBeInstanceOf(TransactionCanceledException)
  })

  test('集計はページをまたいで合計する', async () => {
    const send = jest.fn()
      .mockResolvedValueOnce({ Items: [{ votes: 2 }, { votes: 3 }], LastEvaluatedKey: { pk: 'x' } })
      .mockResolvedValueOnce({ Items: [{ votes: 5 }] })
    expect(await storeWith(send).sumCounts('exodus', 900)).toBe(10)
    expect(send.mock.calls[0][0].input).toMatchObject({
      KeyConditionExpression: 'pk = :pk AND sk >= :from',
      ExpressionAttributeValues: { ':pk': 'COUNT#exodus', ':from': 'B#000000000000900' },
    })
  })

  test('セッションの記録を衝動ごとに読み、不正な項目は無視する', async () => {
    const send = jest.fn().mockResolvedValue({
      Items: [
        { sk: 'IMPULSE#exodus', votes: [{ id: 'e1', at: 10 }, { broken: true }], version: 2 },
        // 削除した衝動（革命したい）の古い記録は無視する
        { sk: 'IMPULSE#revolution', votes: [{ id: 'r1', at: 10 }], version: 1 },
      ],
    })
    const result = await storeWith(send).getSessionVotes('AAAAAAAAAAAAAAAAAAAAAA')
    expect(result.exodus).toEqual({ votes: [{ id: 'e1', at: 10 }], version: 2 })
    expect(Object.keys(result)).toEqual(['ikki', 'exodus', 'festival'])
    expect(result.ikki).toEqual({ votes: [], version: 0 })
    expect(send.mock.calls[0][0].input).toMatchObject({ ConsistentRead: true })
  })
})
