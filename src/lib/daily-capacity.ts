import type { AvailabilityRule, CapacityProfile, DailyCapacityOverride, FixedEvent, ScheduleItem, UserPreferences, Weekday } from './data'
import { localDateKey, minutesBetween } from './date-utils'

export type DailyCapacitySource = 'default' | 'profile' | 'override'
export type TimeInterval = { start: Date; end: Date }
export type DailyCapacityBreakdown = {
  dateKey: string; weekday: Weekday; source: DailyCapacitySource; sourceName?: string; activeProfileId?: string; overrideId?: string
  baseDailyMinutes: number; loadPercent?: number; targetMinutes: number; dayMinutes: number
  unavailableMinutes: number; fixedEventMinutes: number; overlapDedupedMinutes: number; blockedMinutes: number
  hardAvailableMinutes: number; bufferMinutes: number; windowBudgetMinutes: number; effectiveCapacityMinutes: number
  scheduledMinutes: number; remainingCapacityMinutes: number; futureFreeMinutes: number; allocatableNowMinutes: number
  constrainedByTimeWindow: boolean; overloaded: boolean
}

const DAY = 86_400_000
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max)
const minutes = (start: Date, end: Date) => Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60_000))
function dayStart(date: Date) { const value = new Date(date); value.setHours(0, 0, 0, 0); return value }
function at(date: Date, minute: number) { const value = dayStart(date); value.setMinutes(minute); return value }
function mergeIntervals(intervals: TimeInterval[]) {
  const sorted = intervals.filter(item => item.end > item.start).sort((a, b) => a.start.getTime() - b.start.getTime())
  return sorted.reduce<TimeInterval[]>((merged, item) => { const last = merged[merged.length - 1]; if (last && item.start <= last.end) last.end = new Date(Math.max(last.end.getTime(), item.end.getTime())); else merged.push({ start: new Date(item.start), end: new Date(item.end) }); return merged }, [])
}
function overlapsForDate(date: Date, unavailableRules: AvailabilityRule[], fixedEvents: FixedEvent[]) {
  const key = localDateKey(date); const weekday = date.getDay(); const startOfDate = dayStart(date); const endOfDate = new Date(startOfDate.getTime() + DAY); const blocked: TimeInterval[] = []
  unavailableRules.filter(rule => rule.weekday === weekday).forEach(rule => { const [sh, sm] = rule.startTime.split(':').map(Number); const [eh, em] = rule.endTime.split(':').map(Number); blocked.push({ start: at(date, sh * 60 + sm), end: at(date, eh * 60 + em) }) })
  fixedEvents.forEach(event => {
    const originalStart = new Date(event.startTime); const originalEnd = new Date(event.endTime)
    if (Number.isNaN(originalStart.getTime()) || Number.isNaN(originalEnd.getTime())) return
    const weekly = event.recurrenceRule === 'weekly'
    const duration = originalEnd.getTime() - originalStart.getTime()
    if (duration <= 0) return
    if (weekly) {
      for (const offset of [-1, 0]) {
        const occurrenceDay = new Date(startOfDate); occurrenceDay.setDate(occurrenceDay.getDate() + offset)
        if (occurrenceDay.getDay() !== originalStart.getDay()) continue
        const occurrenceStart = at(occurrenceDay, originalStart.getHours() * 60 + originalStart.getMinutes())
        blocked.push({ start: occurrenceStart, end: new Date(occurrenceStart.getTime() + duration) })
      }
    } else if (originalEnd > startOfDate && originalStart < endOfDate) {
      blocked.push({ start: originalStart, end: originalEnd })
    } else return
  })
  return mergeIntervals(blocked.map(item => ({ start: item.start < startOfDate ? startOfDate : item.start, end: item.end > endOfDate ? endOfDate : item.end })).filter(item => item.end > item.start))
}
function freeForDate(date: Date, unavailableRules: AvailabilityRule[], fixedEvents: FixedEvent[], now: Date) {
  const start = dayStart(date); const end = new Date(start.getTime() + DAY); const blocked = overlapsForDate(date, unavailableRules, fixedEvents)
  const free: TimeInterval[] = []; let cursor = start
  blocked.forEach(item => { if (item.start > cursor) free.push({ start: cursor, end: item.start }); if (item.end > cursor) cursor = item.end })
  if (cursor < end) free.push({ start: cursor, end })
  return free.map(item => ({ start: item.start < now && localDateKey(item.start) === localDateKey(now) ? new Date(now) : item.start, end: item.end })).filter(item => item.end > item.start)
}
function profileFor(dateKey: string, profiles: CapacityProfile[]) {
  return profiles.filter(profile => profile.enabled && profile.startDate <= dateKey && profile.endDate >= dateKey).sort((a, b) => b.priority - a.priority || (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || a.id.localeCompare(b.id))[0]
}
export function resolveDailyTarget({ date, preferences, profiles, overrides }: { date: Date; preferences: UserPreferences; profiles: CapacityProfile[]; overrides: DailyCapacityOverride[] }) {
  const dateKey = localDateKey(date); const weekday = date.getDay() as Weekday; const profile = profileFor(dateKey, profiles); const override = overrides.find(item => item.date === dateKey)
  const baseDailyMinutes = profile?.baseDailyMinutes ?? preferences.baseDailyMinutes; const loadPercent = profile?.weeklyLoad[weekday] ?? preferences.weeklyLoad[weekday] ?? 100
  if (override?.capacityMinutes !== undefined) return { source: 'override' as const, sourceName: override.reason, activeProfileId: profile?.id, overrideId: override.id, baseDailyMinutes, loadPercent: undefined, targetMinutes: clamp(override.capacityMinutes, 0, 1440) }
  const overrideLoad = override?.loadPercent ?? loadPercent
  return { source: override ? 'override' as const : profile ? 'profile' as const : 'default' as const, sourceName: profile?.name ?? override?.reason, activeProfileId: profile?.id, overrideId: override?.id, baseDailyMinutes, loadPercent: overrideLoad, targetMinutes: Math.floor(baseDailyMinutes * clamp(overrideLoad, 0, 200) / 100) }
}
export function getDailyCapacityBreakdown({ date, now = date, preferences, profiles, overrides, unavailableRules, fixedEvents, scheduleItems }: { date: Date; now?: Date; preferences: UserPreferences; profiles: CapacityProfile[]; overrides: DailyCapacityOverride[]; unavailableRules: AvailabilityRule[]; fixedEvents: FixedEvent[]; scheduleItems: ScheduleItem[] }): DailyCapacityBreakdown {
  const dateKey = localDateKey(date); const weekday = date.getDay() as Weekday; const target = resolveDailyTarget({ date, preferences, profiles, overrides }); const blocked = overlapsForDate(date, unavailableRules, fixedEvents)
  const unavailableOnly = overlapsForDate(date, unavailableRules, []).reduce((sum, item) => sum + minutes(item.start, item.end), 0); const fixedOnly = overlapsForDate(date, [], fixedEvents).reduce((sum, item) => sum + minutes(item.start, item.end), 0)
  const blockedMinutes = blocked.reduce((sum, item) => sum + minutes(item.start, item.end), 0); const hardAvailableMinutes = 1440 - blockedMinutes; const bufferMinutes = Math.floor(hardAvailableMinutes * clamp(preferences.bufferRatio, 0, 0.3)); const windowBudgetMinutes = Math.max(0, hardAvailableMinutes - bufferMinutes); const effectiveCapacityMinutes = Math.min(target.targetMinutes, windowBudgetMinutes)
  const dayStartValue = dayStart(date); const dayEndValue = new Date(dayStartValue.getTime() + DAY)
  const scheduledMinutes = scheduleItems.reduce((sum, item) => { const start = new Date(item.startTime); const end = new Date(item.endTime); if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= dayStartValue || start >= dayEndValue) return sum; return sum + minutes(start < dayStartValue ? dayStartValue : start, end > dayEndValue ? dayEndValue : end) }, 0); const remainingCapacityMinutes = Math.max(0, effectiveCapacityMinutes - scheduledMinutes); const futureFreeMinutes = freeForDate(date, unavailableRules, fixedEvents, now).reduce((sum, item) => sum + minutes(item.start, item.end), 0); const allocatableNowMinutes = Math.min(remainingCapacityMinutes, futureFreeMinutes)
  return { dateKey, weekday, ...target, dayMinutes: 1440, unavailableMinutes: unavailableOnly, fixedEventMinutes: fixedOnly, overlapDedupedMinutes: Math.max(0, unavailableOnly + fixedOnly - blockedMinutes), blockedMinutes, hardAvailableMinutes, bufferMinutes, windowBudgetMinutes, effectiveCapacityMinutes, scheduledMinutes, remainingCapacityMinutes, futureFreeMinutes, allocatableNowMinutes, constrainedByTimeWindow: target.targetMinutes > windowBudgetMinutes, overloaded: effectiveCapacityMinutes === 0 ? scheduledMinutes > 0 : scheduledMinutes > effectiveCapacityMinutes }
}
