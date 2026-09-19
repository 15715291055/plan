export function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function minutesBetween(start: Date | string, end: Date | string): number {
  const startMs = typeof start === 'string' ? Date.parse(start) : start.getTime()
  const endMs = typeof end === 'string' ? Date.parse(end) : end.getTime()
  return Math.max(0, Math.round((endMs - startMs) / 60_000))
}
