// 他ユーザー分の模擬変動（USM US-D3）。実際の集計ではない。

/** 12時間の秒数。1秒あたりの流入・失効の基準量を求めるのに使う */
const SIMULATION_WINDOW_SECONDS = 12 * 60 * 60

/** 乱数の揺らぎの範囲：0.3 以上 1.7 未満 */
const MIN_FACTOR = 0.3
const FACTOR_SPREAD = 1.4

/** 0 以上 1 未満の乱数を返す関数。テストで差し替える */
export type RandomSource = () => number

/**
 * 1秒分の変動を加えた値を返す。
 * 12時間で全体が入れ替わる前提で、流入と失効をそれぞれ乱数で揺らす。
 */
export function driftCount(current: number, random: RandomSource): number {
  const rate = current / SIMULATION_WINDOW_SECONDS
  const inflow = Math.round(rate * (MIN_FACTOR + random() * FACTOR_SPREAD))
  const expired = Math.round(rate * (MIN_FACTOR + random() * FACTOR_SPREAD))
  return Math.max(0, current + inflow - expired)
}
