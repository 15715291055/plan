import assert from 'node:assert/strict'
import test from 'node:test'
import { getDailyCapacityBreakdown, resolveDailyTarget } from '../src/lib/daily-capacity'
import { defaultPreferences, type AvailabilityRule, type FixedEvent, type ScheduleItem } from '../src/lib/data'

const date = new Date(2026, 8, 26, 16, 18)
const empty: AvailabilityRule[] = []
const fixed: FixedEvent[] = []
const items: ScheduleItem[] = []

test('uses configured target capacity instead of 1440 minutes when there are no unavailable rules', () => {
  const result = getDailyCapacityBreakdown({ date, now: date, preferences: defaultPreferences, profiles: [], overrides: [], unavailableRules: empty, fixedEvents: fixed, scheduleItems: items })
  assert.equal(result.effectiveCapacityMinutes, 240)
  assert.equal(result.unavailableMinutes, 0)
})

test('applies weekly load and rest days', () => {
  const preferences = { ...defaultPreferences, baseDailyMinutes: 240, weeklyLoad: { ...defaultPreferences.weeklyLoad, 6: 150, 0: 0 } }
  assert.equal(resolveDailyTarget({ date, preferences, profiles: [], overrides: [] }).targetMinutes, 360)
  assert.equal(resolveDailyTarget({ date: new Date(2026, 8, 27), preferences, profiles: [], overrides: [] }).targetMinutes, 0)
})

test('profile and daily override precedence is deterministic', () => {
  const preferences = { ...defaultPreferences }
  const profiles = [
    { id: 'low', name: '普通周', startDate: '2026-09-20', endDate: '2026-09-30', baseDailyMinutes: 300, weeklyLoad: { 6: 100 }, priority: 1, enabled: true },
    { id: 'exam', name: '考试周', startDate: '2026-09-20', endDate: '2026-09-30', baseDailyMinutes: 300, weeklyLoad: { 6: 120 }, priority: 10, enabled: true },
  ]
  const profileResult = resolveDailyTarget({ date, preferences, profiles, overrides: [] })
  assert.equal(profileResult.targetMinutes, 360)
  const overrideResult = resolveDailyTarget({ date, preferences, profiles, overrides: [{ id: 'override', date: '2026-09-26', loadPercent: 30 }] })
  assert.equal(overrideResult.targetMinutes, 90)
  const absoluteResult = resolveDailyTarget({ date, preferences, profiles, overrides: [{ id: 'override', date: '2026-09-26', capacityMinutes: 75 }] })
  assert.equal(absoluteResult.targetMinutes, 75)
})

test('merges overlapping unavailable and fixed intervals before subtracting', () => {
  const unavailable = [{ id: 'u', weekday: 6, startTime: '10:00', endTime: '14:00' }]
  const fixedEvent = { id: 'f', title: '课程', startTime: new Date(2026, 8, 26, 12).toISOString(), endTime: new Date(2026, 8, 26, 16).toISOString() }
  const result = getDailyCapacityBreakdown({ date: new Date(2026, 8, 26, 9), now: new Date(2026, 8, 26, 9), preferences: defaultPreferences, profiles: [], overrides: [], unavailableRules: unavailable, fixedEvents: [fixedEvent], scheduleItems: [] })
  assert.equal(result.blockedMinutes, 360)
})

test('counts scheduled minutes and clips future free minutes at now', () => {
  const scheduled = { id: 's', taskId: 'task', startTime: new Date(2026, 8, 26, 15).toISOString(), endTime: new Date(2026, 8, 26, 15, 50).toISOString(), locked: false, status: 'planned' }
  const result = getDailyCapacityBreakdown({ date, now: date, preferences: defaultPreferences, profiles: [], overrides: [], unavailableRules: empty, fixedEvents: fixed, scheduleItems: [scheduled] })
  assert.equal(result.scheduledMinutes, 50)
  assert.equal(result.allocatableNowMinutes, 190)
})

test('splits fixed events and scheduled items at local midnight', () => {
  const fixedEvent = { id: 'overnight', title: '晚课', startTime: new Date(2026, 8, 25, 23).toISOString(), endTime: new Date(2026, 8, 26, 1).toISOString() }
  const scheduled = { id: 'overnight-item', taskId: 'task', startTime: new Date(2026, 8, 25, 23, 30).toISOString(), endTime: new Date(2026, 8, 26, 0, 30).toISOString(), locked: false, status: 'planned' }
  const result = getDailyCapacityBreakdown({ date: new Date(2026, 8, 26, 9), now: new Date(2026, 8, 26, 9), preferences: defaultPreferences, profiles: [], overrides: [], unavailableRules: [], fixedEvents: [fixedEvent], scheduleItems: [scheduled] })
  assert.equal(result.blockedMinutes, 60)
  assert.equal(result.scheduledMinutes, 30)
})

test('carries a weekly fixed event across midnight into the next local date', () => {
  const fixedEvent = { id: 'weekly-overnight', title: '周课', startTime: '2026-09-19T23:00:00+08:00', endTime: '2026-09-20T01:00:00+08:00', recurrenceRule: 'weekly' }
  const result = getDailyCapacityBreakdown({ date: new Date('2026-09-20T09:00:00+08:00'), now: new Date('2026-09-20T09:00:00+08:00'), preferences: defaultPreferences, profiles: [], overrides: [], unavailableRules: [], fixedEvents: [fixedEvent], scheduleItems: [] })
  assert.equal(result.fixedEventMinutes, 60)
  assert.equal(result.blockedMinutes, 60)
})
