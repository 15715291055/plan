import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSchedule } from '../src/lib/scheduler'
import { localDateKey } from '../src/lib/date-utils'
import { minutesBetween } from '../src/lib/date-utils'
import type { FixedEvent, ScheduleItem, Task } from '../src/lib/data'

const task = (id: string, minutes: number, deadlineIso?: string): Task => ({
  id, title: id, course: '数据结构', color: '#2673e8', deadline: deadlineIso ?? '未设置', deadlineIso,
  minutes, priority: 80, difficulty: '中等', status: 'todo', type: '学习',
})
const availability = [{ id: 'a', weekday: 1, startTime: '18:00', endTime: '22:00' }]
const now = new Date('2026-09-14T12:00:00+08:00')
function unavailableFor(desired: Array<{ id: string; weekday: number; startTime: string; endTime: string }>) {
  const result: Array<{ id: string; weekday: number; startTime: string; endTime: string }> = []
  for (let weekday = 0; weekday < 7; weekday += 1) {
    const windows = desired.filter(item => item.weekday === weekday).map(item => [item.startTime, item.endTime]).sort((a, b) => a[0].localeCompare(b[0]))
    let cursor = '00:00'
    for (const [start, end] of windows) {
      if (cursor < start) result.push({ id: `blocked-${weekday}-${cursor}`, weekday, startTime: cursor, endTime: start })
      if (end > cursor) cursor = end
    }
    if (cursor < '24:00') result.push({ id: `blocked-${weekday}-${cursor}`, weekday, startTime: cursor, endTime: '24:00' })
  }
  return result
}

test('splits tasks into blocks and respects the buffer', () => {
  const result = buildSchedule([task('task-a', 180)], unavailableFor(availability), [], [], { now, blockMinutes: 50, bufferRatio: 0.15 })
  assert.equal(result.conflicts.length, 0)
  assert.equal(result.items.reduce((sum, item) => sum + (Date.parse(item.endTime) - Date.parse(item.startTime)) / 60000, 0), 180)
  assert.ok(result.items.every(item => item.startTime >= '2026-09-14T10:00:00.000Z' && item.endTime <= '2026-09-14T13:24:00.000Z'))
})

test('excludes fixed events and preserves locked blocks', () => {
  const fixed: FixedEvent = { id: 'fixed', title: '课程', startTime: '2026-09-14T11:00:00.000Z', endTime: '2026-09-14T12:00:00.000Z' }
  const locked: ScheduleItem = { id: 'locked', taskId: 'locked-task', startTime: '2026-09-14T10:00:00.000Z', endTime: '2026-09-14T10:50:00.000Z', locked: true, status: 'planned' }
  const result = buildSchedule([task('locked-task', 50), task('task-b', 60)], unavailableFor(availability), [fixed], [locked], { now })
  assert.equal(result.items.find(item => item.taskId === 'locked-task')?.startTime, locked.startTime)
  assert.ok(result.items.every(item => item.endTime <= fixed.startTime || item.startTime >= fixed.endTime))
})

test('reports insufficient time before a deadline', () => {
  const result = buildSchedule([task('late', 240, '2026-09-14T11:00:00+08:00')], unavailableFor(availability), [], [], { now })
  assert.equal(result.conflicts.length, 1)
  assert.equal(result.changes.at(-1)?.type, 'conflict')
})

test('preserve strategy retains existing unlocked blocks', () => {
  const existing: ScheduleItem = { id: 'existing', taskId: 'existing-task', startTime: '2026-09-14T10:00:00.000Z', endTime: '2026-09-14T10:50:00.000Z', locked: false, status: 'planned' }
  const result = buildSchedule([task('existing-task', 50), task('new-task', 30)], unavailableFor(availability), [], [existing], { now, strategy: 'preserve' })
  assert.equal(result.items.find(item => item.taskId === 'existing-task')?.startTime, existing.startTime)
  assert.equal(result.changes.find(change => change.taskId === 'existing-task')?.reason, '保持原计划')
})

test('replaces stale overnight automatic blocks during a normal replan', () => {
  const oldAutomatic: ScheduleItem = { id: 'old-auto-midnight', taskId: 'existing-task', startTime: '2026-09-14T00:00:00+08:00', endTime: '2026-09-14T00:50:00+08:00', locked: false, status: 'planned', source: 'auto' }
  const result = buildSchedule([task('existing-task', 50)], unavailableFor(availability), [], [oldAutomatic], { now, bufferRatio: 0 })
  assert.ok(!result.items.some(item => item.id === oldAutomatic.id))
  assert.ok(result.items.some(item => item.taskId === 'existing-task'))
  assert.ok(result.items.every(item => new Date(item.startTime).getHours() >= 8))
})

test('keeps past manual and locked blocks while replacing stale automatic blocks', () => {
  const manual: ScheduleItem = { id: 'past-manual', taskId: 'manual-task', startTime: '2026-09-13T00:00:00+08:00', endTime: '2026-09-13T00:50:00+08:00', locked: false, status: 'planned', source: 'manual' }
  const locked: ScheduleItem = { id: 'past-locked', taskId: 'locked-task', startTime: '2026-09-13T00:00:00+08:00', endTime: '2026-09-13T00:50:00+08:00', locked: true, status: 'planned', source: 'auto' }
  const result = buildSchedule([task('manual-task', 0), task('locked-task', 0)], [], [], [manual, locked], { now })
  assert.ok(result.items.some(item => item.id === manual.id))
  assert.ok(result.items.some(item => item.id === locked.id))
})

test('spreads a multi-day task across the selected number of dates', () => {
  const multiDayAvailability = [
    { id: 'mon', weekday: 1, startTime: '18:00', endTime: '20:00' },
    { id: 'tue', weekday: 2, startTime: '18:00', endTime: '20:00' },
  ]
  const multiDayTask = { ...task('spread-task', 120), completionMode: 'spread_days' as const, spreadDays: 2 }
  const result = buildSchedule([multiDayTask], unavailableFor(multiDayAvailability), [], [], { now, blockMinutes: 50, bufferRatio: 0 })
  assert.equal(result.conflicts.length, 0)
  assert.equal(result.items.reduce((sum, item) => sum + (Date.parse(item.endTime) - Date.parse(item.startTime)) / 60000, 0), 120)
  assert.deepEqual(new Set(result.items.map(item => item.startTime.slice(0, 10))), new Set(['2026-09-14', '2026-09-15']))
  assert.ok(result.items.every(item => (Date.parse(item.endTime) - Date.parse(item.startTime)) / 60000 <= 50))
})

test('does not exceed the selected number of days for a multi-day task', () => {
  const threeDayAvailability = [
    { id: 'mon', weekday: 1, startTime: '18:00', endTime: '19:00' },
    { id: 'tue', weekday: 2, startTime: '18:00', endTime: '19:00' },
    { id: 'wed', weekday: 3, startTime: '18:00', endTime: '19:00' },
  ]
  const twoDayTask = { ...task('limited-spread', 150), completionMode: 'spread_days' as const, spreadDays: 2 }
  const result = buildSchedule([twoDayTask], unavailableFor(threeDayAvailability), [], [], { now, blockMinutes: 50, bufferRatio: 0 })
  assert.equal(new Set(result.items.map(item => item.startTime.slice(0, 10))).size, 2)
  assert.equal(result.conflicts.length, 1)
})

test('requires one continuous window when the task asks for it', () => {
  const splitWindows = [
    { id: 'first', weekday: 1, startTime: '18:00', endTime: '18:50' },
    { id: 'second', weekday: 1, startTime: '19:00', endTime: '19:50' },
  ]
  const continuousTask = { ...task('continuous', 80), requireContinuous: true }
  const result = buildSchedule([continuousTask], unavailableFor(splitWindows), [], [], { now, bufferRatio: 0, minBlockMinutes: 20 })
  assert.equal(result.items.length, 0)
  assert.match(result.conflicts[0], /连续 80 分钟/)
})

test('uses only remaining minutes and reserves a break between blocks', () => {
  const partialTask = { ...task('partial', 150), completedMinutes: 50 }
  const result = buildSchedule([partialTask], unavailableFor(availability), [], [], { now, blockMinutes: 50, bufferRatio: 0, breakMinutes: 10, minBlockMinutes: 20 })
  assert.equal(result.items.reduce((sum, item) => sum + (Date.parse(item.endTime) - Date.parse(item.startTime)) / 60000, 0), 100)
  assert.equal((Date.parse(result.items[1].startTime) - Date.parse(result.items[0].endTime)) / 60000, 10)
})

test('plans beyond the current week for tasks with a later deadline', () => {
  const taskNextWeek = task('next-week', 50, '2026-09-24T12:00:00+08:00')
  const result = buildSchedule([taskNextWeek], unavailableFor(availability), [], [], { now, bufferRatio: 0, horizonDays: 28 })
  assert.equal(result.conflicts.length, 0)
  assert.ok(result.items[0].startTime.slice(0, 10) >= '2026-09-14')
})

test('smart mode balances ordinary tasks across dates', () => {
  const current = new Date('2026-09-19T14:00:00+08:00')
  const rules = [
    { id: 'sat', weekday: 6, startTime: '14:00', endTime: '22:00' },
    { id: 'sun', weekday: 0, startTime: '09:00', endTime: '22:00' },
    { id: 'mon', weekday: 1, startTime: '09:00', endTime: '22:00' },
    { id: 'tue', weekday: 2, startTime: '09:00', endTime: '22:00' },
    { id: 'wed', weekday: 3, startTime: '09:00', endTime: '22:00' },
  ]
  const result = buildSchedule([task('a', 50), task('b', 50), task('c', 50), task('d', 30)].map(item => ({ ...item, completionMode: 'smart' as const, deadlineIso: '2026-09-23T22:00:00+08:00' })), unavailableFor(rules), [], [], { now: current, blockMinutes: 50, bufferRatio: 0, minBlockMinutes: 20, breakMinutes: 10 })
  assert.equal(result.conflicts.length, 0)
  assert.ok(new Set(result.items.map(item => localDateKey(new Date(item.startTime)))).size >= 3)
  assert.ok(result.items.some(item => localDateKey(new Date(item.startTime)) === '2026-09-19'))
})

test('smart mode prioritizes an urgent deadline before ordinary work', () => {
  const current = new Date('2026-09-19T14:00:00+08:00')
  const rules = [
    { id: 'sat', weekday: 6, startTime: '14:00', endTime: '22:00' },
    { id: 'sun', weekday: 0, startTime: '09:00', endTime: '22:00' },
  ]
  const urgent = { ...task('urgent', 180, '2026-09-20T12:00:00+08:00'), completionMode: 'smart' as const, priority: 90 }
  const result = buildSchedule([urgent, { ...task('later', 60, '2026-09-23T22:00:00+08:00'), completionMode: 'smart' as const }], unavailableFor(rules), [], [], { now: current, blockMinutes: 50, bufferRatio: 0, minBlockMinutes: 20 })
  const urgentItems = result.items.filter(item => item.taskId === 'urgent')
  assert.equal(urgentItems.reduce((sum, item) => sum + (Date.parse(item.endTime) - Date.parse(item.startTime)) / 60000, 0), 180)
  assert.ok(urgentItems.every(item => Date.parse(item.endTime) <= Date.parse(urgent.deadlineIso!)))
})

test('single_day stays on one local date without requiring one continuous block', () => {
  const current = new Date('2026-09-19T14:00:00+08:00')
  const rules = [{ id: 'sat', weekday: 6, startTime: '14:00', endTime: '18:00' }]
  const result = buildSchedule([{ ...task('single', 120), completionMode: 'single_day' as const }], unavailableFor(rules), [], [], { now: current, blockMinutes: 50, bufferRatio: 0, minBlockMinutes: 20, breakMinutes: 10 })
  assert.equal(result.conflicts.length, 0)
  assert.equal(new Set(result.items.map(item => localDateKey(new Date(item.startTime)))).size, 1)
  assert.equal(result.items.reduce((sum, item) => sum + (Date.parse(item.endTime) - Date.parse(item.startTime)) / 60000, 0), 120)
})

test('spread_days respects the selected number of dates and minimum block size', () => {
  const current = new Date('2026-09-19T14:00:00+08:00')
  const rules = [
    { id: 'sat', weekday: 6, startTime: '14:00', endTime: '18:00' },
    { id: 'sun', weekday: 0, startTime: '09:00', endTime: '13:00' },
  ]
  const result = buildSchedule([{ ...task('spread', 120), completionMode: 'spread_days' as const, spreadDays: 2 }], unavailableFor(rules), [], [], { now: current, blockMinutes: 50, bufferRatio: 0, minBlockMinutes: 20 })
  assert.equal(result.conflicts.length, 0)
  assert.equal(new Set(result.items.map(item => localDateKey(new Date(item.startTime)))).size, 2)
  assert.ok(result.items.every(item => (Date.parse(item.endTime) - Date.parse(item.startTime)) / 60000 >= 20))
})

test('weekly fixed events are expanded across the planning horizon', () => {
  const current = new Date('2026-09-19T14:00:00+08:00')
  const rules = [{ id: 'mon', weekday: 1, startTime: '09:00', endTime: '12:00' }]
  const fixed: FixedEvent = { id: 'weekly', title: '固定课', startTime: '2026-09-14T09:00:00+08:00', endTime: '2026-09-14T10:00:00+08:00', recurrenceRule: 'weekly' }
  const result = buildSchedule([{ ...task('future', 120, '2026-09-29T12:00:00+08:00'), completionMode: 'smart' as const }], unavailableFor(rules), [fixed], [], { now: current, horizonDays: 21, blockMinutes: 50, bufferRatio: 0 })
  assert.equal(result.conflicts.length, 0)
  assert.ok(result.items.every(item => {
    const start = new Date(item.startTime)
    return start.getDay() !== 1 || start.getHours() >= 10
  }))
})

test('respects an independent daily capacity limit across days', () => {
  const current = new Date('2026-09-19T09:00:00+08:00')
  const result = buildSchedule([task('capacity-task', 300, '2026-09-21T23:00:00+08:00')], [], [], [], {
    now: current,
    blockMinutes: 50,
    bufferRatio: 0,
    minBlockMinutes: 20,
    preferences: { defaultBlockMinutes: 50, bufferRatio: 0, autoLog: true, breakMinutes: 10, minBlockMinutes: 20, peakStartHour: 9, peakEndHour: 12, baseDailyMinutes: 120, weeklyLoad: { 0: 100, 1: 100, 2: 100, 3: 100, 4: 100, 5: 100, 6: 100 } },
  })
  const byDay = new Map<string, number>()
  result.items.forEach(item => byDay.set(localDateKey(new Date(item.startTime)), (byDay.get(localDateKey(new Date(item.startTime))) ?? 0) + minutesBetween(item.startTime, item.endTime)))
  assert.equal(result.conflicts.length, 0)
  assert.ok([...byDay.values()].every(minutes => minutes <= 120))
})

test('keeps automatic blocks inside the default daytime window when no availability rules exist', () => {
  const current = new Date('2026-09-19T09:00:00+08:00')
  const result = buildSchedule([task('daytime-task', 50)], [], [], [], {
    now: current,
    bufferRatio: 0,
    preferences: { defaultBlockMinutes: 50, bufferRatio: 0, autoLog: true, breakMinutes: 10, minBlockMinutes: 20, peakStartHour: 9, peakEndHour: 12, baseDailyMinutes: 120, weeklyLoad: { 0: 100, 1: 100, 2: 100, 3: 100, 4: 100, 5: 100, 6: 100 } },
  })
  assert.equal(result.conflicts.length, 0)
  assert.ok(result.items.length > 0)
  assert.ok(result.items.every(item => {
    const start = new Date(item.startTime)
    const end = new Date(item.endTime)
    return start.getHours() >= 8 && (end.getHours() < 23 || (end.getHours() === 23 && end.getMinutes() === 0))
  }))
})

test('applies the default daytime window on weekdays without availability rules', () => {
  const current = new Date('2026-09-19T09:00:00+08:00')
  const result = buildSchedule([task('partial-rules-task', 50)], [{ id: 'monday-block', weekday: 1, startTime: '18:00', endTime: '22:00' }], [], [], {
    now: current,
    bufferRatio: 0,
    horizonDays: 7,
    preferences: { defaultBlockMinutes: 50, bufferRatio: 0, autoLog: true, breakMinutes: 10, minBlockMinutes: 20, peakStartHour: 9, peakEndHour: 12, baseDailyMinutes: 120, weeklyLoad: { 0: 100, 1: 100, 2: 100, 3: 100, 4: 100, 5: 100, 6: 100 } },
  })
  assert.equal(result.conflicts.length, 0)
  assert.ok(result.items.every(item => new Date(item.startTime).getHours() >= 8))
})

test('skips a zero-capacity weekday while scheduling', () => {
  const current = new Date('2026-09-19T09:00:00+08:00')
  const result = buildSchedule([task('rest-day-task', 60, '2026-09-20T23:00:00+08:00')], [], [], [], {
    now: current,
    bufferRatio: 0,
    preferences: { defaultBlockMinutes: 50, bufferRatio: 0, autoLog: true, breakMinutes: 10, minBlockMinutes: 20, peakStartHour: 9, peakEndHour: 12, baseDailyMinutes: 120, weeklyLoad: { 0: 0, 1: 100, 2: 100, 3: 100, 4: 100, 5: 100, 6: 100 } },
  })
  assert.ok(result.items.every(item => new Date(item.startTime).getDay() !== 0))
})
