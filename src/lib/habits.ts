import type { Task, Weekday } from './data'

export type ScheduleAdjustmentEvent = {
  id: string; taskId: string; category: string
  eventType: 'move' | 'resize' | 'split' | 'delete_auto_block' | 'lock' | 'unlock'
  fromStart: string; fromEnd: string; toStart: string; toEnd: string
}
export type LearnedSchedulingPreferences = {
  preferredStartHourByWeekday: Partial<Record<Weekday, number>>
  preferredDurationByCategory: Record<string, number>
  preferredStartHourByCategory: Record<string, number>
  splitPreference: number
  confidence: { weekdayStart: Partial<Record<Weekday, number>>; categoryDuration: Record<string, number>; categoryStart: Record<string, number>; split: number }
}
export const MIN_HABIT_SAMPLE_COUNT = 3
export function confidenceFromCount(count: number): number { return count < MIN_HABIT_SAMPLE_COUNT ? 0 : Math.min(1, count / 8) }
export function circularHourDistance(a: number, b: number): number { const diff = Math.abs(a - b) % 24; return Math.min(diff, 24 - diff) }
export function habitStartHourScore(candidate: number, preferred: number, confidence: number): number { return Math.max(0, 1 - circularHourDistance(candidate, preferred) / 6) * confidence }
export function learnSchedulingPreferences(events: ScheduleAdjustmentEvent[]): LearnedSchedulingPreferences {
  const result: LearnedSchedulingPreferences = { preferredStartHourByWeekday: {}, preferredDurationByCategory: {}, preferredStartHourByCategory: {}, splitPreference: 0, confidence: { weekdayStart: {}, categoryDuration: {}, categoryStart: {}, split: 0 } }
  const weekdays = new Map<Weekday, number[]>(); const starts = new Map<string, number[]>(); const durations = new Map<string, number[]>()
  const add = <K>(map: Map<K, number[]>, key: K, value: number) => map.set(key, [...(map.get(key) ?? []), value])
  for (const event of events) {
    const start = new Date(event.toStart); const end = new Date(event.toEnd)
    if (!Number.isFinite(start.getTime()) || end <= start || !Number.isFinite(end.getTime())) continue
    if (event.eventType === 'move') {
      const hour = start.getHours() + start.getMinutes() / 60
      add(weekdays, start.getDay() as Weekday, hour); add(starts, event.category, hour)
    }
    if (event.eventType === 'resize' || (event.eventType === 'move' && end.getTime() - start.getTime() !== new Date(event.fromEnd).getTime() - new Date(event.fromStart).getTime())) add(durations, event.category, (end.getTime() - start.getTime()) / 60000)
  }
  const meanHour = (values: number[]) => (Math.atan2(values.reduce((sum, x) => sum + Math.sin(x * Math.PI / 12), 0), values.reduce((sum, x) => sum + Math.cos(x * Math.PI / 12), 0)) * 12 / Math.PI + 24) % 24
  weekdays.forEach((values, key) => { result.preferredStartHourByWeekday[key] = meanHour(values); result.confidence.weekdayStart[key] = confidenceFromCount(values.length) })
  starts.forEach((values, key) => { result.preferredStartHourByCategory[key] = meanHour(values); result.confidence.categoryStart[key] = confidenceFromCount(values.length) })
  durations.forEach((values, key) => { result.preferredDurationByCategory[key] = values.reduce((sum, x) => sum + x, 0) / values.length; result.confidence.categoryDuration[key] = confidenceFromCount(values.length) })
  const splits = events.filter(event => event.eventType === 'split').length
  result.splitPreference = splits / Math.max(1, events.length); result.confidence.split = confidenceFromCount(splits)
  return result
}
export function habitCandidateScore(habits: LearnedSchedulingPreferences | undefined, task: Task, start: Date, duration: number): number {
  if (!habits) return 0
  const day = start.getDay() as Weekday; const hour = start.getHours() + start.getMinutes() / 60
  const weekday = habitStartHourScore(hour, habits.preferredStartHourByWeekday[day] ?? hour, habits.confidence.weekdayStart[day] ?? 0)
  const category = habitStartHourScore(hour, habits.preferredStartHourByCategory[task.type] ?? hour, habits.confidence.categoryStart[task.type] ?? 0)
  const preferredDuration = habits.preferredDurationByCategory[task.type] ?? duration
  const durationScore = Math.max(0, 1 - Math.abs(duration - preferredDuration) / Math.max(1, preferredDuration)) * (habits.confidence.categoryDuration[task.type] ?? 0)
  return 20 * (weekday + category) / 2 + 5 * durationScore
}
