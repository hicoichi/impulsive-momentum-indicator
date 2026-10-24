/** 集計数を3桁カンマ区切りにする（例：123456 → 123,456） */
export function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}
