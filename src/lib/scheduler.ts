import type { AvailabilityRule, CapacityProfile, DailyCapacityOverride, FixedEvent, ScheduleItem, Task, UserPreferences } from './data'
import { localDateKey, minutesBetween } from './date-utils'
import { getDailyCapacityBreakdown } from './daily-capacity'

export type ReplanStrategy = 'preserve' | 'minimal_change' | 'urgent'
export type ScheduleChange = { type: 'added' | 'moved' | 'unchanged' | 'conflict'; taskId: string; from?: string; to?: string; reason?: string }
export type SchedulerResult = { items: ScheduleItem[]; changes: ScheduleChange[]; conflicts: string[] }
export type SchedulerOptions = { now?: Date; blockMinutes?: number; bufferRatio?: number; strategy?: ReplanStrategy; horizonDays?: number; minBlockMinutes?: number; breakMinutes?: number; peakStartHour?: number; peakEndHour?: number; preferences?: UserPreferences; capacityProfiles?: CapacityProfile[]; dailyCapacityOverrides?: DailyCapacityOverride[] }

type Interval = { start: Date; end: Date }
type TaskState = { task: Task; remaining: number; initialRemaining: number; deadline: Date; explicitDeadline: boolean; selectedDay?: string; allocatedByDay: Map<string, number>; generated: ScheduleItem[] }
type Candidate = { state: TaskState; start: Date; end: Date; duration: number; dayKey: string; score: number }

const DAY_MS = 24 * 60 * 60_000
const EPSILON = 0.0001
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

function mondayOf(date: Date): Date {
  const value = new Date(date); value.setHours(0, 0, 0, 0)
  const day = (value.getDay() + 6) % 7
  value.setDate(value.getDate() - day)
  return value
}

function dateAtDay(day: Date, time: string): Date {
  const value = new Date(day); const [hour, minute] = time.split(':').map(Number)
  value.setHours(hour || 0, minute || 0, 0, 0); return value
}

function intervalMinutes(interval: Interval): number {
  return Math.max(0, Math.floor((interval.end.getTime() - interval.start.getTime()) / 60_000))
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
    return parts.filter(part => intervalMinutes(part) >= 5)
  })
}

function sumByDay(intervals: Interval[]): Map<string, number> {
  const result = new Map<string, number>()
  intervals.forEach(interval => {
    const key = localDateKey(interval.start)
    result.set(key, (result.get(key) ?? 0) + intervalMinutes(interval))
  })
  return result
}

function taskDifficulty(value: string): number { return value === '较难' ? 3 : value === '中等' ? 2 : 1 }
function isSpacingTask(task: Task): boolean { return /背诵|复习|词汇|记忆|默写/.test(`${task.type}${task.title}`) }
function preferredBlockMinutes(task: Task, blockMinutes: number): number {
  if (task.requireContinuous) return Number.MAX_SAFE_INTEGER
  if (isSpacingTask(task)) return Math.min(blockMinutes, 30)
  if (taskDifficulty(task.difficulty) >= 3) return Math.min(blockMinutes, 50)
  return blockMinutes
}

function chooseDuration(remaining: number, preferred: number, available: number, minBlock: number, dailyRemaining?: number): number {
  const limit = Math.max(0, Math.min(remaining, available, dailyRemaining ?? Number.MAX_SAFE_INTEGER))
  if (limit <= 0) return 0
  if (remaining <= limit && remaining <= preferred) return remaining
  let duration = Math.min(preferred, limit)
  if (remaining - duration > 0 && remaining - duration < minBlock) {
    const adjusted = remaining - minBlock
    if (adjusted >= minBlock && adjusted <= limit) duration = adjusted
    else if (remaining <= limit) duration = remaining
  }
  if (dailyRemaining !== undefined && dailyRemaining - duration > 0 && dailyRemaining - duration < minBlock) {
    const adjusted = dailyRemaining - minBlock
    if (adjusted >= minBlock && adjusted <= limit) duration = adjusted
    else if (dailyRemaining <= limit) duration = dailyRemaining
  }
  return Math.max(0, Math.floor(duration))
}

function expandFixedEvents(fixedEvents: FixedEvent[], monday: Date, horizonDays: number): Interval[] {
  const horizonStart = new Date(monday); const horizonEnd = new Date(monday.getTime() + horizonDays * DAY_MS); const intervals: Interval[] = []
  for (const event of fixedEvents) {
    const originalStart = new Date(event.startTime); const originalEnd = new Date(event.endTime)
    if (Number.isNaN(originalStart.getTime()) || Number.isNaN(originalEnd.getTime()) || originalEnd <= originalStart) continue
    if (event.recurrenceRule !== 'weekly') {
      if (originalEnd > horizonStart && originalStart < horizonEnd) intervals.push({ start: originalStart, end: originalEnd })
      continue
    }
    const duration = originalEnd.getTime() - originalStart.getTime()
    for (let day = 0; day < horizonDays; day += 1) {
      const occurrence = new Date(monday); occurrence.setDate(monday.getDate() + day)
      if (occurrence.getDay() !== originalStart.getDay()) continue
      occurrence.setHours(originalStart.getHours(), originalStart.getMinutes(), originalStart.getSeconds(), 0)
      intervals.push({ start: occurrence, end: new Date(occurrence.getTime() + duration) })
    }
  }
  return intervals
}

function buildAvailabilityWindows(availability: AvailabilityRule[], monday: Date, now: Date, horizonDays: number): Interval[] {
  const windows: Interval[] = []
  for (let day = 0; day < horizonDays; day += 1) {
    const calendarDay = new Date(monday); calendarDay.setDate(monday.getDate() + day)
    const dayStart = dateAtDay(calendarDay, '00:00'); const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1)
    const blocked = availability.filter(item => item.weekday === calendarDay.getDay()).map(rule => ({ start: dateAtDay(calendarDay, rule.startTime), end: dateAtDay(calendarDay, rule.endTime) })).sort((a, b) => a.start.getTime() - b.start.getTime())
    let cursor = dayStart
    blocked.forEach(item => { if (item.start > cursor) windows.push({ start: cursor < now && localDateKey(cursor) === localDateKey(now) ? new Date(now) : cursor, end: item.start }); if (item.end > cursor) cursor = item.end })
    if (cursor < dayEnd) windows.push({ start: cursor < now && localDateKey(cursor) === localDateKey(now) ? new Date(now) : cursor, end: dayEnd })
  }
  return windows.filter(item => intervalMinutes(item) >= 5).sort((a, b) => a.start.getTime() - b.start.getTime())
}

function taskDeadline(task: Task, now: Date, horizonEnd: Date): { deadline: Date; explicit: boolean } {
  if (task.deadlineIso) {
    const parsed = new Date(task.deadlineIso)
    if (!Number.isNaN(parsed.getTime())) return { deadline: parsed, explicit: true }
  }
  return { deadline: new Date(Math.min(now.getTime() + 7 * DAY_MS, horizonEnd.getTime())), explicit: false }
}

function minutesBefore(intervals: Interval[], deadline: Date): number {
  return intervals.reduce((sum, interval) => {
    if (interval.start >= deadline) return sum
    const end = interval.end < deadline ? interval.end : deadline
    return sum + Math.max(0, Math.floor((end.getTime() - interval.start.getTime()) / 60_000))
  }, 0)
}

function minutesOnDay(intervals: Interval[], dayKey: string, deadline?: Date): number {
  return intervals.reduce((sum, interval) => {
    if (localDateKey(interval.start) !== dayKey) return sum
    const end = deadline && deadline < interval.end ? deadline : interval.end
    return sum + Math.max(0, Math.floor((end.getTime() - interval.start.getTime()) / 60_000))
  }, 0)
}

function roundUpToQuarterHour(date: Date): Date {
  const value = new Date(date); value.setSeconds(0, 0); value.setMinutes(Math.ceil(value.getMinutes() / 15) * 15); return value
}

function candidateStarts(interval: Interval, duration: number, deadline: Date, peakStartHour: number, existing: ScheduleItem[]): Date[] {
  const endLimit = deadline < interval.end ? deadline : interval.end; const peak = new Date(interval.start); peak.setHours(peakStartHour, 0, 0, 0)
  const starts = [new Date(interval.start), roundUpToQuarterHour(interval.start), peak]
  existing.forEach(item => { const value = new Date(item.startTime); if (localDateKey(value) === localDateKey(interval.start)) starts.push(value) })
  const seen = new Set<number>()
  return starts.filter(start => start >= interval.start && new Date(start.getTime() + duration * 60_000) <= endLimit).sort((a, b) => a.getTime() - b.getTime()).filter(start => !seen.has(start.getTime()) && (seen.add(start.getTime()), true))
}

function buildIdealLoad(states: TaskState[], free: Interval[], retained: Map<string, number>): Map<string, number> {
  const freeByDay = sumByDay(free); const representatives = new Map<string, Date>(); free.forEach(interval => representatives.set(localDateKey(interval.start), interval.start))
  const target = new Map(retained)
  states.forEach(state => {
    const eligible = Array.from(freeByDay.entries()).filter(([key, capacity]) => capacity > 0 && (representatives.get(key)?.getTime() ?? 0) < state.deadline.getTime())
    const weightTotal = eligible.reduce((sum, [, capacity]) => sum + Math.min(1, Math.max(0.1, capacity / 60)), 0)
    eligible.forEach(([key, capacity]) => target.set(key, (target.get(key) ?? 0) + state.remaining * Math.min(1, Math.max(0.1, capacity / 60)) / weightTotal))
  })
  return target
}

function deadlinePressure(state: TaskState, states: TaskState[], free: Interval[]): number {
  const demand = states.reduce((sum, item) => item.deadline <= state.deadline ? sum + item.remaining : sum, 0); const capacity = minutesBefore(free, state.deadline)
  return capacity <= 0 ? (demand > 0 ? 2 : 0) : demand / capacity
}

function stabilityFit(start: Date, existing: ScheduleItem[]): number {
  if (!existing.length) return 0.5
  return existing.reduce((best, item) => {
    const previous = new Date(item.startTime); const diff = Math.abs(start.getTime() - previous.getTime()) / 60_000
    return Math.max(best, diff <= 15 ? 1 : localDateKey(start) === localDateKey(previous) ? 0.75 : diff <= 1440 ? 0.35 : 0)
  }, 0)
}

function energyFit(task: Task, start: Date, peakStart: number, peakEnd: number): number {
  const hour = start.getHours() + start.getMinutes() / 60; const inPeak = hour >= peakStart && hour < peakEnd; const difficulty = taskDifficulty(task.difficulty)
  return difficulty >= 3 ? (inPeak ? 1 : 0.15) : difficulty === 2 ? (inPeak ? 0.8 : 0.5) : (inPeak ? 0.45 : 0.7)
}

function spacingFit(state: TaskState, dayKey: string): number {
  const already = (state.allocatedByDay.get(dayKey) ?? 0) > 0; const mode = state.task.completionMode ?? 'smart'
  if (mode === 'single_day') return already ? 0.8 : 0.2
  if (mode === 'spread_days') {
    const days = Math.min(Math.max(state.task.spreadDays ?? 2, 2), 7)
    return already ? 0.1 : state.allocatedByDay.size < days ? 0.9 : -0.5
  }
  if (isSpacingTask(state.task)) return already ? -1 : 1
  return already ? -0.35 : 0.35
}

function balanceFit(dayKey: string, duration: number, target: Map<string, number>, planned: Map<string, number>, capacity: Map<string, number>): number {
  const desired = Math.max(1, target.get(dayKey) ?? 0); const current = planned.get(dayKey) ?? 0; const deficit = clamp((desired - current) / Math.max(duration, desired * 0.5, 1), -1.5, 1)
  const load = (current + duration) / Math.max(1, capacity.get(dayKey) ?? 1)
  return clamp(deficit - (load > 0.85 ? (load - 0.85) * 2.5 : 0), -2, 1)
}

function scoreCandidate(candidate: Omit<Candidate, 'score'>, states: TaskState[], free: Interval[], target: Map<string, number>, planned: Map<string, number>, capacity: Map<string, number>, existing: ScheduleItem[], options: Required<Pick<SchedulerOptions, 'strategy' | 'peakStartHour' | 'peakEndHour'>>, now: Date): number {
  const { state, start, duration, dayKey } = candidate; const pressure = deadlinePressure(state, states, free)
  const daysLeft = Math.max(0, (state.deadline.getTime() - now.getTime()) / DAY_MS); const urgency = clamp(0.68 * clamp(pressure, 0, 1.5) / 1.5 + 0.32 / (1 + daysLeft), 0, 1.2)
  const priority = clamp(state.task.priority / 100, 0, 1); const balance = balanceFit(dayKey, duration, target, planned, capacity); const energy = energyFit(state.task, start, options.peakStartHour, options.peakEndHour)
  const stability = stabilityFit(start, existing.filter(item => item.taskId === state.task.id)); const spacing = spacingFit(state, dayKey); const horizon = Math.max(DAY_MS, state.deadline.getTime() - now.getTime())
  const earliness = 1 - clamp((start.getTime() - now.getTime()) / horizon, 0, 1); const todayBonus = localDateKey(start) === localDateKey(now) ? 4 : 0
  if (options.strategy === 'urgent') return urgency * 40 + priority * 25 + balance * 15 + energy * 5 + stability * 2 + spacing * 3 + earliness * (4 + urgency * 10) + todayBonus
  return urgency * 35 + priority * 15 + balance * 30 + energy * 8 + stability * 7 + spacing * 5 + earliness * (3 + urgency * 5) + todayBonus
}

function generatedReason(task: Task, strategy: ReplanStrategy): string {
  if (strategy === 'urgent') return '紧急策略：优先截止压力与优先级，同时满足硬约束'
  if (task.completionMode === 'single_day') return '一次性任务：选择可完整容纳任务且负载更合适的日期'
  if (task.completionMode === 'spread_days') return `按 ${Math.min(Math.max(task.spreadDays ?? 2, 2), 7)} 天分摊，并兼顾每日负载`
  return '智能安排：综合截止压力、每日负载、优先级与高效学习时段'
}

function sameSchedule(previous: ScheduleItem[], next: ScheduleItem[]): boolean {
  if (previous.length !== next.length) return false
  const a = [...previous].sort((x, y) => x.startTime.localeCompare(y.startTime)); const b = [...next].sort((x, y) => x.startTime.localeCompare(y.startTime))
  return a.every((item, index) => item.startTime === b[index].startTime && item.endTime === b[index].endTime)
}

export function buildSchedule(tasks: Task[], availability: AvailabilityRule[], fixedEvents: FixedEvent[], existingItems: ScheduleItem[], options?: SchedulerOptions): SchedulerResult {
  const now = options?.now ?? new Date(); const blockMinutes = options?.blockMinutes ?? 50; const bufferRatio = clamp(options?.bufferRatio ?? 0.15, 0, 0.3)
  const strategy = options?.strategy ?? 'minimal_change'; const horizonDays = Math.min(Math.max(options?.horizonDays ?? 28, 7), 56)
  const minBlockMinutes = Math.min(Math.max(options?.minBlockMinutes ?? 20, 5), blockMinutes); const breakMinutes = Math.min(Math.max(options?.breakMinutes ?? 0, 0), 30)
  const peakStartHour = clamp(options?.peakStartHour ?? 9, 0, 23); const peakEndHour = clamp(options?.peakEndHour ?? 12, peakStartHour + 1, 24); const monday = mondayOf(now); const horizonEnd = new Date(monday.getTime() + horizonDays * DAY_MS)
  const taskById = new Map(tasks.map(task => [task.id, task])); const alwaysRetained = existingItems.filter(item => item.locked || taskById.get(item.taskId)?.status === 'done'); const retained = strategy === 'preserve' ? existingItems : alwaysRetained
  const retainedIds = new Set(retained.map(item => item.id)); const windows = buildAvailabilityWindows(availability, monday, now, horizonDays)
  const capacityIntervals = subtractIntervals(windows, expandFixedEvents(fixedEvents, monday, horizonDays))
  const defaultPreferences: UserPreferences = options?.preferences ?? { defaultBlockMinutes: (blockMinutes === 25 || blockMinutes === 90 ? blockMinutes : 50) as 25 | 50 | 90, bufferRatio, autoLog: true, breakMinutes: (breakMinutes === 5 || breakMinutes === 15 ? breakMinutes : 10) as 5 | 10 | 15, minBlockMinutes: (minBlockMinutes === 15 || minBlockMinutes === 25 ? minBlockMinutes : 20) as 15 | 20 | 25, peakStartHour, peakEndHour, baseDailyMinutes: 240, weeklyLoad: { 0: 100, 1: 100, 2: 100, 3: 100, 4: 100, 5: 100, 6: 100 } }
  const capacityByDay = new Map<string, number>()
  for (let day = 0; day < horizonDays; day += 1) {
    const date = new Date(monday); date.setDate(monday.getDate() + day)
    const breakdown = getDailyCapacityBreakdown({ date, now, preferences: { ...defaultPreferences, bufferRatio }, profiles: options?.capacityProfiles ?? [], overrides: options?.dailyCapacityOverrides ?? [], unavailableRules: availability, fixedEvents, scheduleItems: existingItems })
    capacityByDay.set(localDateKey(date), breakdown.effectiveCapacityMinutes)
  }
  const retainedIntervals = retained.map(item => ({ start: new Date(item.startTime), end: new Date(item.endTime) })); let free = subtractIntervals(capacityIntervals, retainedIntervals).sort((a, b) => a.start.getTime() - b.start.getTime())
  const retainedPlannedByDay = new Map<string, number>(); const retainedPlannedByTask = new Map<string, number>()
  retained.forEach(item => {
    if (item.status === 'completed') return
    const minutes = minutesBetween(item.startTime, item.endTime); const dayKey = localDateKey(new Date(item.startTime))
    retainedPlannedByDay.set(dayKey, (retainedPlannedByDay.get(dayKey) ?? 0) + minutes); retainedPlannedByTask.set(item.taskId, (retainedPlannedByTask.get(item.taskId) ?? 0) + minutes)
  })
  const usedCapacityByDay = new Map(retainedPlannedByDay)
  capacityByDay.forEach((limit, key) => { usedCapacityByDay.set(key, Math.min(usedCapacityByDay.get(key) ?? 0, limit)) })
  const states: TaskState[] = tasks.filter(task => task.status !== 'done').map(task => {
    const completed = Math.max(0, task.completedMinutes ?? 0); const alreadyPlanned = retainedPlannedByTask.get(task.id) ?? 0; const remaining = Math.max(0, task.minutes - completed - alreadyPlanned)
    const deadline = taskDeadline(task, now, horizonEnd)
    return { task, remaining, initialRemaining: remaining, deadline: deadline.deadline, explicitDeadline: deadline.explicit, allocatedByDay: new Map<string, number>(), generated: [] }
  }).filter(state => state.remaining > 0)
  const targetByDay = buildIdealLoad(states, free, retainedPlannedByDay); const plannedByDay = new Map(retainedPlannedByDay); const conflicts: string[] = []
  let iterations = 0
  while (states.some(state => state.remaining > 0) && iterations < 10000) {
    iterations += 1; let best: Candidate | null = null
    for (const state of states) {
      if (state.remaining <= 0 || state.deadline <= now) continue
      const mode = state.task.completionMode ?? 'smart'; const spreadDays = mode === 'spread_days' ? Math.min(Math.max(state.task.spreadDays ?? 2, 2), 7) : undefined
      const dailyTarget = spreadDays ? Math.ceil(state.initialRemaining / spreadDays) : undefined; const preferred = preferredBlockMinutes(state.task, blockMinutes)
      for (const interval of free) {
        if (interval.start >= state.deadline || interval.end <= now) continue
        const dayKey = localDateKey(interval.start)
        if (mode === 'single_day') {
          if (state.selectedDay && state.selectedDay !== dayKey) continue
          if (!state.selectedDay && minutesOnDay(free, dayKey, state.deadline) < state.remaining) continue
        }
        const capacityRemainingToday = Math.max(0, (capacityByDay.get(dayKey) ?? 0) - (usedCapacityByDay.get(dayKey) ?? 0))
        if (capacityRemainingToday < minBlockMinutes) continue
        let dailyRemaining: number | undefined
        if (spreadDays) {
          const allocatedToday = state.allocatedByDay.get(dayKey) ?? 0
          if (allocatedToday === 0 && state.allocatedByDay.size >= spreadDays) continue
          if (allocatedToday >= dailyTarget!) continue
          dailyRemaining = dailyTarget! - allocatedToday
        }
        const endLimit = state.deadline < interval.end ? state.deadline : interval.end; const available = Math.floor((endLimit.getTime() - interval.start.getTime()) / 60_000)
        const minimum = Math.min(minBlockMinutes, state.remaining, dailyRemaining ?? Number.MAX_SAFE_INTEGER, capacityRemainingToday); if (available < minimum) continue
        let duration = 0
        if (state.task.requireContinuous) { if (available < state.remaining || capacityRemainingToday < state.remaining || (dailyRemaining !== undefined && dailyRemaining < state.remaining)) continue; duration = state.remaining }
        else { duration = chooseDuration(state.remaining, preferred, Math.min(available, capacityRemainingToday), minBlockMinutes, dailyRemaining); if (duration < minimum) continue }
        for (const start of candidateStarts(interval, duration, state.deadline, peakStartHour, existingItems.filter(item => item.taskId === state.task.id))) {
          const end = new Date(start.getTime() + duration * 60_000); const base = { state, start, end, duration, dayKey }
          const candidate = { ...base, score: scoreCandidate(base, states, free, targetByDay, plannedByDay, capacityByDay, existingItems, { strategy, peakStartHour, peakEndHour }, now) }
          if (!best || candidate.score > best.score + EPSILON || (Math.abs(candidate.score - best.score) <= EPSILON && (candidate.start < best.start || (candidate.start.getTime() === best.start.getTime() && candidate.state.task.id < best.state.task.id)))) best = candidate
        }
      }
    }
    if (!best) break
    const { state, start, end, duration, dayKey } = best
    const item: ScheduleItem = { id: `local-schedule-item-${state.task.id}-${start.getTime()}`, taskId: state.task.id, startTime: start.toISOString(), endTime: end.toISOString(), locked: false, status: 'planned' }
    state.generated.push(item); state.remaining = Math.max(0, state.remaining - duration); state.allocatedByDay.set(dayKey, (state.allocatedByDay.get(dayKey) ?? 0) + duration)
    if ((state.task.completionMode ?? 'smart') === 'single_day' && !state.selectedDay) state.selectedDay = dayKey
    plannedByDay.set(dayKey, (plannedByDay.get(dayKey) ?? 0) + duration)
    usedCapacityByDay.set(dayKey, (usedCapacityByDay.get(dayKey) ?? 0) + duration)
    let nextFree = subtractIntervals(free, [{ start, end }]); const remainingDemand = states.reduce((sum, itemState) => sum + itemState.remaining, 0)
    if (breakMinutes > 0 && remainingDemand > 0 && nextFree.reduce((sum, interval) => sum + intervalMinutes(interval), 0) >= remainingDemand + breakMinutes) nextFree = subtractIntervals(nextFree, [{ start: end, end: new Date(end.getTime() + breakMinutes * 60_000) }])
    free = nextFree.sort((a, b) => a.start.getTime() - b.start.getTime())
  }
  states.forEach(state => { if (state.remaining > 0) { const capacityTotal = Array.from(capacityByDay.values()).reduce((sum, value) => sum + value, 0); const scheduledTotal = Array.from(usedCapacityByDay.values()).reduce((sum, value) => sum + value, 0); const reason = scheduledTotal >= capacityTotal ? '截止日前的每日容量已满' : state.task.requireContinuous ? `缺少连续 ${state.remaining} 分钟的可用时间` : state.explicitDeadline ? `在截止时间前还缺少 ${state.remaining} 分钟可用时间` : `在当前规划周期内还缺少 ${state.remaining} 分钟可用时间`; conflicts.push(`${state.task.title} 还缺 ${state.remaining} 分钟；${reason}`) } })
  const items = [...retained, ...states.flatMap(state => state.generated)].filter((item, index, all) => all.findIndex(other => other.id === item.id) === index).sort((a, b) => a.startTime.localeCompare(b.startTime))
  const conflictIds = new Set(states.filter(state => state.remaining > 0).map(state => state.task.id)); const changes: ScheduleChange[] = []
  tasks.forEach(task => {
    const previous = existingItems.filter(item => item.taskId === task.id); const next = items.filter(item => item.taskId === task.id); const state = states.find(item => item.task.id === task.id)
    if (conflictIds.has(task.id)) changes.push({ type: 'conflict', taskId: task.id, reason: conflicts.find(message => message.startsWith(task.title)) })
    else if (next.length && sameSchedule(previous, next)) changes.push({ type: 'unchanged', taskId: task.id, to: next[0].startTime, reason: next.find(item => retainedIds.has(item.id))?.locked ? '锁定时间块' : task.status === 'done' ? '已完成任务' : '保持原计划' })
    else if (previous.length && next.length) changes.push({ type: 'moved', taskId: task.id, from: previous[0].startTime, to: next[0].startTime, reason: generatedReason(task, strategy) })
    else if (state?.generated.length) changes.push({ type: 'added', taskId: task.id, to: state.generated[0].startTime, reason: generatedReason(task, strategy) })
  })
  return { items, changes, conflicts }
}
