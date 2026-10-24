// 衝動の種類・順序・表示テーマの定義。種類と順序はここだけで決める。

export const IMPULSE_KEYS = ['ikki', 'revolution', 'exodus', 'festival'] as const

export type ImpulseKey = (typeof IMPULSE_KEYS)[number]

export interface ImpulseTheme {
  /** 画面全体の背景色 */
  background: string
  /** 画面全体の文字色 */
  foreground: string
  /** ライブ点・「+1」の色 */
  accent: string
}

export interface ImpulseDefinition {
  key: ImpulseKey
  label: string
  theme: ImpulseTheme
}

// 色はモックの値（USM §2.3）
export const IMPULSES: Record<ImpulseKey, ImpulseDefinition> = {
  ikki: {
    key: 'ikki',
    label: '一揆したい',
    theme: { background: '#C42A1C', foreground: '#FFF4EA', accent: '#FFD9A0' },
  },
  revolution: {
    key: 'revolution',
    label: '革命したい',
    theme: { background: '#141212', foreground: '#F4F0E8', accent: '#E8432A' },
  },
  exodus: {
    key: 'exodus',
    label: '国外脱出したい',
    theme: { background: '#18256B', foreground: '#EEF0FA', accent: '#FFB23A' },
  },
  festival: {
    key: 'festival',
    label: '祭りたい',
    theme: { background: '#F0B21A', foreground: '#1A120A', accent: '#C42A1C' },
  },
}

export const IMPULSE_COUNT = IMPULSE_KEYS.length

/** 各衝動に同じ初期値を持つ記録を作る */
export function createImpulseRecord<T>(initial: (key: ImpulseKey) => T): Record<ImpulseKey, T> {
  return {
    ikki: initial('ikki'),
    revolution: initial('revolution'),
    exodus: initial('exodus'),
    festival: initial('festival'),
  }
}
