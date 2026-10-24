import { castVote, getCounts, getRemaining, VoteConflictError, type VoteServiceDeps } from '../../lambda/api/vote-service'
import { MemoryVoteStore } from './memory-vote-store'

const HOUR = 60 * 60 * 1000
const WINDOW = 12 * HOUR

function setup(start = 1_800_000_000_000) {
  let current = start
  const store = new MemoryVoteStore()
  const deps: VoteServiceDeps = { store, now: () => current, windowMs: WINDOW }
  const advance = (ms: number) => {
    current += ms
  }
  return { store, deps, advance }
}

async function voteTimes(deps: VoteServiceDeps, sid: string, times: number) {
  for (let i = 0; i < times; i++) await castVote(deps, sid, 'ikki', `v${i}`)
}

describe('castVote', () => {
  test('受け付けると集計と残り枠に反映される', async () => {
    const { deps } = setup()
    const result = await castVote(deps, 's1', 'ikki', 'v1')
    expect(result).toEqual({ status: 'accepted', remaining: { ikki: 9, exodus: 10, festival: 10 } })
    expect((await getCounts(deps)).ikki).toBe(1)
  })

  test('US-E1: 10票目は受け付け、11票目は上限', async () => {
    const { deps } = setup()
    await voteTimes(deps, 's1', 10)
    expect((await getRemaining(deps, 's1')).ikki).toBe(0)
    const result = await castVote(deps, 's1', 'ikki', 'v10')
    expect(result.status).toBe('limit')
    expect((await getCounts(deps)).ikki).toBe(10)
  })

  test('US-E1: 上限はセッションごと・衝動ごとに独立', async () => {
    const { deps } = setup()
    await voteTimes(deps, 's1', 10)
    expect((await castVote(deps, 's1', 'exodus', 'e1')).status).toBe('accepted')
    expect((await castVote(deps, 's2', 'ikki', 'x1')).status).toBe('accepted')
  })

  test('US-V3: 同じ票 ID は二重に数えない', async () => {
    const { deps } = setup()
    await castVote(deps, 's1', 'ikki', 'same')
    const result = await castVote(deps, 's1', 'ikki', 'same')
    expect(result.status).toBe('duplicate')
    expect((await getCounts(deps)).ikki).toBe(1)
    expect((await getRemaining(deps, 's1')).ikki).toBe(9)
  })

  test('US-E3: 12時間で枠が回復する', async () => {
    const { deps, advance } = setup()
    await voteTimes(deps, 's1', 10)
    advance(WINDOW)
    expect((await getRemaining(deps, 's1')).ikki).toBe(10)
    expect((await castVote(deps, 's1', 'ikki', 'again')).status).toBe('accepted')
  })

  test('競合したら読み直して保存する', async () => {
    const { deps, store } = setup()
    store.forcedConflicts = 2
    expect((await castVote(deps, 's1', 'ikki', 'v1')).status).toBe('accepted')
    expect((await getCounts(deps)).ikki).toBe(1)
  })

  test('競合が続いたら中断する', async () => {
    const { deps, store } = setup()
    store.forcedConflicts = 3
    await expect(castVote(deps, 's1', 'ikki', 'v1')).rejects.toBeInstanceOf(VoteConflictError)
    expect((await getCounts(deps)).ikki).toBe(0)
  })
})

describe('getCounts（ローリングウィンドウ）', () => {
  test('直近12時間の票を合計し、それより古い枠は含めない', async () => {
    const { deps, advance } = setup()
    await castVote(deps, 'old', 'exodus', 'o1')
    advance(6 * HOUR)
    await castVote(deps, 'new', 'exodus', 'n1')
    expect((await getCounts(deps)).exodus).toBe(2)
    // 最初の票から12時間＋5分（1枠）経てば、最初の票は外れる
    advance(6 * HOUR + 5 * 60 * 1000)
    expect((await getCounts(deps)).exodus).toBe(1)
  })
})
