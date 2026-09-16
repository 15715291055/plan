import type { AvailabilityRule, FixedEvent, ScheduleItem, Task } from './data'

export type ReplanStrategy = 'preserve' | 'minimal_change' | 'urgent'
export type ScheduleChange = { type: 'added' | 'moved' | 'unchanged' | 'conflict'; taskId: string; from?: string; to?: string; reason?: string }
export type SchedulerResult = { items: ScheduleItem[]; changes: ScheduleChange[]; conflicts: string[] }

type Interval = { start: Date; end: Date }

function mondayOf(date: Date): Date {
  const value = new Date(date); value.setHours(0, 0, 0, 0)
  const day = (value.getDay() + 6) % 7
  value.setDate(value.getDate() - day)
  return value
}

function dateAt(base: Date, weekday: number, time: string): Date {
  const value = new Date(base); value.setDate(base.getDate() + weekday)
  const [hour, minute] = time.split(':').map(Number)
  value.setHours(hour || 0, minute || 0, 0, 0)
  return value
}

function subtractIntervals(source: Interval[], blocked: Interval[]): Interval[] {
  return source.flatMap(interval => {
    let parts = [interval]
    blocked.forEach(block => {
      parts = parts.flatMap(part => {
        if (block.end <= part.start || block.start >= part.end) return [part]
        const result: Interval[] = []
        if (part.start < block.start) result.push({ start: part.start, end: block.start })
        if (block.end < part.end) result.push({ start: block.end, end: part.end })
        return result
      })
    })
    return parts.filter(part => part.end.getTime() - part.start.getTime() >= 5 * 60_000)
  })
}

function taskDifficulty(value: string): number { return value === '较难' ? 3 : value === '中等' ? 2 : 1 }

export function buildSchedule(tasks: Task[], availability: AvailabilityRule[], fixedEvents: FixedEvent[], existingItems: ScheduleItem[], options?: { now?: Date; blockMinutes?: number; bufferRatio?: number; strategy?: ReplanStrategy; horizonDays?: number; minBlockMinutes?: number; breakMinutes?: number; peakStartHour?: number; peakEndHour?: number }): SchedulerResult {
  const now = options?.now ?? new Date()
  const blockMinutes = options?.blockMinutes ?? 50
  const bufferRatio = Math.min(Math.max(options?.bufferRatio ?? 0.15, 0), 0.3)
  const strategy = options?.strategy ?? 'minimal_change'
  const horizonDays = Math.min(Math.max(options?.horizonDays ?? 28, 7), 56)
  const minBlockMinutes = Math.min(Math.max(options?.minBlockMinutes ?? 20, 5), blockMinutes)
  const breakMinutes = Math.min(Math.max(options?.breakMinutes ?? 0, 0), 30)
  const monday = mondayOf(now)
  const locked = existingItems.filter(item => item.locked || tasks.find(task => task.id === item.taskId)?.status === 'done')
  const retained = strategy === 'preserve' ? existingItems : locked
  const blockedByDay = new Map<string, Interval[]>()
  const addBlocked = (interval: Interval) => { const key = interval.start.toISOString().slice(0, 10); blockedByDay.set(key, [...(blockedByDay.get(key) ?? []), interval]) }
  retained.forEach(item => addBlocked({ start: new Date(item.startTime), end: new Date(item.endTime) }))
  fixedEvents.forEach(event => {
    const start = new Date(event.startTime)
    const end = new Date(event.endTime)
    if (event.recurrenceRule === 'weekly') {
      const day = (start.getDay() + 6) % 7
      const recurringStart = new Date(monday); recurringStart.setDate(monday.getDate() + day); recurringStart.setHours(start.getHours(), start.getMinutes(), 0, 0)
      const recurringEnd = new Date(recurringStart); recurringEnd.setHours(end.getHours(), end.getMinutes(), 0, 0)
      addBlocked({ start: recurringStart, end: recurringEnd })
    } else addBlocked({ start, end })
  })

  const pending = tasks.filter(task => task.status !== 'done' && !retained.some(item => item.taskId === task.id)).sort((a, b) => {
    const da = a.deadlineIso ? new Date(a.deadlineIso).getTime() : Number.MAX_SAFE_INTEGER
    const db = b.deadlineIso ? new Date(b.deadlineIso).getTime() : Number.MAX_SAFE_INTEGER
    return strategy === 'urgent' ? b.priority - a.priority || da - db : da - db || b.priority - a.priority || taskDifficulty(b.difficulty) - taskDifficulty(a.difficulty)
  })
  const generated: ScheduleItem[] = [...retained]
  const changes: ScheduleChange[] = retained.map(item => ({ type: 'unchanged', taskId: item.taskId, to: item.startTime, reason: item.locked ? '锁定时间块' : tasks.find(task => task.id === item.taskId)?.status === 'done' ? '已完成任务' : '保持原计划' }))
  const conflicts: string[] = []
  const windows: Interval[] = []
  for (let day = 0; day < horizonDays; day += 1) {
    availability.filter(rule => rule.weekday === ((day + 1) % 7)).forEach(rule => {
      const start = dateAt(monday, day, rule.startTime)
      const end = dateAt(monday, day, rule.endTime)
      const capacity = end.getTime() - start.getTime()
      const buffer = capacity * bufferRatio
      const effectiveStart = start < now ? now : start
      windows.push({ start: effectiveStart, end: new Date(end.getTime() - buffer) })
    })
  }
  let free = subtractIntervals(windows, Array.from(blockedByDay.values()).reduce<Interval[]>((all, intervals) => all.concat(intervals), [])).sort((a, b) => a.start.getTime() - b.start.getTime())
  for (const task of pending) {
    let remaining = Math.max(0, task.minutes - (task.completedMinutes ?? 0))
    const deadline = task.deadlineIso ? new Date(task.deadlineIso) : new Date(monday.getTime() + 7 * 24 * 60 * 60_000)
    const spreadDays = task.completionMode === 'spread_days' ? Math.min(Math.max(task.spreadDays ?? 2, 2), 7) : 1
    const dailyTarget = Math.ceil(remaining / spreadDays)
    const allocatedByDay = new Map<string, number>()
    let taskAdded = false
    for (let index = 0; index < free.length && remaining > 0; index += 1) {
      const slot = free[index]
      if (slot.end <= now) continue
      const dayKey = slot.start.toISOString().slice(0, 10)
      const allocatedToday = allocatedByDay.get(dayKey) ?? 0
      if (task.completionMode === 'spread_days' && allocatedToday === 0 && allocatedByDay.size >= spreadDays) continue
      if (allocatedToday >= dailyTarget) continue
      const endLimit = deadline < slot.end ? deadline : slot.end
      const availableMinutes = Math.floor((endLimit.getTime() - slot.start.getTime()) / 60_000)
      if (availableMinutes < minBlockMinutes) continue
      if (task.requireContinuous && availableMinutes < remaining) continue
      const duration = task.requireContinuous ? remaining : Math.min(remaining, blockMinutes, availableMinutes, dailyTarget - allocatedToday)
      const start = new Date(slot.start)
      const end = new Date(start.getTime() + duration * 60_000)
      const item: ScheduleItem = { id: `local-schedule-item-${task.id}-${start.getTime()}`, taskId: task.id, startTime: start.toISOString(), endTime: end.toISOString(), locked: false, status: 'planned' }
      generated.push(item); addBlocked({ start, end }); taskAdded = true; remaining -= duration
      allocatedByDay.set(dayKey, allocatedToday + duration)
      const previous = existingItems.find(existing => existing.taskId === task.id)
      const schedulingReason = task.completionMode === 'spread_days' ? `按 ${spreadDays} 天分摊安排` : strategy === 'urgent' ? '紧急任务优先插入' : '按截止时间和优先级安排'
      changes.push(previous ? { type: 'moved', taskId: task.id, from: previous.startTime, to: item.startTime, reason: schedulingReason } : { type: 'added', taskId: task.id, to: item.startTime, reason: schedulingReason })
      const freeAfterBlock = subtractIntervals(free, [{ start, end }])
      const futureFreeMinutes = freeAfterBlock.reduce((sum, interval) => sum + Math.floor((interval.end.getTime() - interval.start.getTime()) / 60_000), 0)
      free = futureFreeMinutes >= remaining + breakMinutes ? subtractIntervals(freeAfterBlock, [{ start: end, end: new Date(end.getTime() + breakMinutes * 60_000) }]) : freeAfterBlock
      index = -1
    }
    if (!taskAdded || remaining > 0) { const reason = task.requireContinuous ? `${task.title} 缺少连续 ${remaining} 分钟的可用时间` : `${task.title} 还缺少 ${remaining} 分钟可用时间`; conflicts.push(reason); changes.push({ type: 'conflict', taskId: task.id, reason }) }
  }
  return { items: generated.sort((a, b) => a.startTime.localeCompare(b.startTime)), changes, conflicts }
}
