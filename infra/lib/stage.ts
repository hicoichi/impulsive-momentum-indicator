// デプロイ先の環境（ステージ）。cdk コマンドの `-c stage=<値>` で指定する

export const STAGES = ['dev', 'prod'] as const

export type Stage = (typeof STAGES)[number]

export const DEFAULT_STAGE: Stage = 'dev'

function isStage(value: unknown): value is Stage {
  return typeof value === 'string' && (STAGES as readonly string[]).includes(value)
}

/**
 * context の値からステージを決める。未指定なら dev。
 * 不正な値は誤ったデプロイにつながるため、既定値に倒さずエラーにする。
 */
export function resolveStage(value: unknown): Stage {
  if (value === undefined) return DEFAULT_STAGE
  if (isStage(value)) return value
  throw new Error(`stage は ${STAGES.join(' / ')} のいずれかを指定してください（指定値：${String(value)}）`)
}
