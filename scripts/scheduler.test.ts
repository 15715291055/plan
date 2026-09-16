import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSchedule } from '../src/lib/scheduler'
import type { FixedEvent, ScheduleItem, Task } from '../src/lib/data'

const task = (id: string, minutes: number, deadlineIso?: string): Task => ({
  id, title: id, course: '数据结构', color: '#2673e8', deadline: deadlineIso ?? '未设置', deadlineIso,
  minutes, priority: 80, difficulty: '中等', status: 'todo', type: '学习',
})
const availability = [{ id: 'a', weekday: 1, startTime: '18:00', endTime: '22:00' }]
const now = new Date('2026-09-14T12:00:00+08:00')

test('splits tasks into blocks and respects the buffer', () => {
  const result = buildSchedule([task('task-a', 180)], availability, [], [], { now, blockMinutes: 50, bufferRatio: 0.15 })
  assert.equal(result.conflicts.length, 0)
  assert.equal(result.items.reduce((sum, item) => sum + (Date.parse(item.endTime) - Date.parse(item.startTime)) / 60000, 0), 180)
  assert.ok(result.items.every(item => item.startTime >= '2026-09-14T10:00:00.000Z' && item.endTime <= '2026-09-14T13:24:00.000Z'))
})

test('excludes fixed events and preserves locked blocks', () => {
  const fixed: FixedEvent = { id: 'fixed', title: '课程', startTime: '2026-09-14T11:00:00.000Z', endTime: '2026-09-14T12:00:00.000Z' }
  const locked: ScheduleItem = { id: 'locked', taskId: 'locked-task', startTime: '2026-09-14T10:00:00.000Z', endTime: '2026-09-14T10:50:00.000Z', locked: true, status: 'planned' }
  const result = buildSchedule([task('locked-task', 50), task('task-b', 60)], availability, [fixed], [locked], { now })
  assert.equal(result.items.find(item => item.taskId === 'locked-task')?.startTime, locked.startTime)
  assert.ok(result.items.every(item => item.endTime <= fixed.startTime || item.startTime >= fixed.endTime))
})

test('reports insufficient time before a deadline', () => {
  const result = buildSchedule([task('late', 240, '2026-09-14T11:00:00+08:00')], availability, [], [], { now })
  assert.equal(result.conflicts.length, 1)
  assert.equal(result.changes.at(-1)?.type, 'conflict')
})

test('preserve strategy retains existing unlocked blocks', () => {
  const existing: ScheduleItem = { id: 'existing', taskId: 'existing-task', startTime: '2026-09-14T10:00:00.000Z', endTime: '2026-09-14T10:50:00.000Z', locked: false, status: 'planned' }
  const result = buildSchedule([task('existing-task', 50), task('new-task', 30)], availability, [], [existing], { now, strategy: 'preserve' })
  assert.equal(result.items.find(item => item.taskId === 'existing-task')?.startTime, existing.startTime)
  assert.equal(result.changes.find(change => change.taskId === 'existing-task')?.reason, '保持原计划')
})

test('spreads a multi-day task across the selected number of dates', () => {
  const multiDayAvailability = [
    { id: 'mon', weekday: 1, startTime: '18:00', endTime: '20:00' },
    { id: 'tue', weekday: 2, startTime: '18:00', endTime: '20:00' },
  ]
  const multiDayTask = { ...task('spread-task', 120), completionMode: 'spread_days' as const, spreadDays: 2 }
  const result = buildSchedule([multiDayTask], multiDayAvailability, [], [], { now, blockMinutes: 50, bufferRatio: 0 })
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
  const result = buildSchedule([twoDayTask], threeDayAvailability, [], [], { now, blockMinutes: 50, bufferRatio: 0 })
  assert.equal(new Set(result.items.map(item => item.startTime.slice(0, 10))).size, 2)
  assert.equal(result.conflicts.length, 1)
})

test('requires one continuous window when the task asks for it', () => {
  const splitWindows = [
    { id: 'first', weekday: 1, startTime: '18:00', endTime: '18:50' },
    { id: 'second', weekday: 1, startTime: '19:00', endTime: '19:50' },
  ]
  const continuousTask = { ...task('continuous', 80), requireContinuous: true }
  const result = buildSchedule([continuousTask], splitWindows, [], [], { now, bufferRatio: 0, minBlockMinutes: 20 })
  assert.equal(result.items.length, 0)
  assert.match(result.conflicts[0], /连续 80 分钟/)
})

test('uses only remaining minutes and reserves a break between blocks', () => {
  const partialTask = { ...task('partial', 150), completedMinutes: 50 }
  const result = buildSchedule([partialTask], availability, [], [], { now, blockMinutes: 50, bufferRatio: 0, breakMinutes: 10, minBlockMinutes: 20 })
  assert.equal(result.items.reduce((sum, item) => sum + (Date.parse(item.endTime) - Date.parse(item.startTime)) / 60000, 0), 100)
  assert.equal((Date.parse(result.items[1].startTime) - Date.parse(result.items[0].endTime)) / 60000, 10)
})

test('plans beyond the current week for tasks with a later deadline', () => {
  const taskNextWeek = task('next-week', 50, '2026-09-24T12:00:00+08:00')
  const result = buildSchedule([taskNextWeek], availability, [], [], { now, bufferRatio: 0, horizonDays: 28 })
  assert.equal(result.conflicts.length, 0)
  assert.ok(result.items[0].startTime.slice(0, 10) >= '2026-09-14')
})
