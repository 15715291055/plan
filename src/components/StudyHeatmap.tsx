import { useMemo, useState } from 'react'
import type { StudyLog } from '../lib/data'

type StudyHeatmapProps = { logs: StudyLog[]; days?: number }
type DayCell = { key: string; date: Date; minutes: number; isFuture: boolean }

const DAY = 24 * 60 * 60 * 1000

function startOfDay(value: Date) { const date = new Date(value); date.setHours(0, 0, 0, 0); return date }
function dateKey(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}` }
function formatDate(value: Date) { return value.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }) }
function intensity(minutes: number) { return minutes <= 0 ? 0 : minutes < 30 ? 1 : minutes < 60 ? 2 : minutes < 120 ? 3 : 4 }

export function StudyHeatmap({ logs, days = 365 }: StudyHeatmapProps) {
  const today = useMemo(() => startOfDay(new Date()), [])
  const minutesByDay = useMemo(() => {
    const result = new Map<string, number>()
    for (const log of logs) {
      if (!log.completedAt) continue
      const date = new Date(log.completedAt)
      if (!Number.isNaN(date.getTime())) result.set(dateKey(date), (result.get(dateKey(date)) ?? 0) + (log.actualMinutes ?? 0))
    }
    return result
  }, [logs])
  const { weeks, months, activeDays, totalMinutes } = useMemo(() => {
    const rangeStart = new Date(today.getTime() - (days - 1) * DAY)
    const firstDay = new Date(rangeStart); firstDay.setDate(firstDay.getDate() - firstDay.getDay())
    const lastDay = new Date(today); lastDay.setDate(lastDay.getDate() + 6 - lastDay.getDay())
    const cells: DayCell[] = []; const monthLabels: Array<{ label: string; column: number }> = []
    let previousMonth = -1; let active = 0; let total = 0
    for (let timestamp = firstDay.getTime(); timestamp <= lastDay.getTime(); timestamp += DAY) {
      const date = new Date(timestamp); const minutes = minutesByDay.get(dateKey(date)) ?? 0; const inRange = date >= rangeStart && date <= today
      if (inRange) { total += minutes; if (minutes > 0) active += 1 }
      cells.push({ key: dateKey(date), date, minutes, isFuture: date > today })
      if (date.getDay() === 0 && date.getMonth() !== previousMonth) { monthLabels.push({ label: date.toLocaleDateString('zh-CN', { month: 'short' }), column: Math.floor((cells.length - 1) / 7) }); previousMonth = date.getMonth() }
    }
    const columns: DayCell[][] = []; for (let index = 0; index < cells.length; index += 7) columns.push(cells.slice(index, index + 7))
    return { weeks: columns, months: monthLabels, activeDays: active, totalMinutes: total }
  }, [days, minutesByDay, today])
  const [selectedKey, setSelectedKey] = useState(dateKey(today))
  const selected = weeks.flat().find(day => day.key === selectedKey) ?? weeks.flat().find(day => day.key === dateKey(today))
  return <section className="study-heatmap" aria-label="年度学习热力图">
    <div className="heatmap-summary"><div><h2>学习足迹</h2><span className="panel-caption">过去 {days} 天 · {activeDays} 天有学习记录</span></div><strong>{Math.floor(totalMinutes / 60)}<small>h</small> {totalMinutes % 60}<small>m</small></strong></div>
    <div className="heatmap-scroll"><div className="heatmap-months" style={{ gridTemplateColumns: `repeat(${weeks.length}, var(--heatmap-cell))` }}>{months.map(month => <span key={`${month.label}-${month.column}`} style={{ gridColumnStart: month.column + 1 }}>{month.label}</span>)}</div><div className="heatmap-body"><div className="heatmap-weekdays" aria-hidden="true"><span>日</span><span /><span>二</span><span /><span>四</span><span /></div><div className="heatmap-weeks" style={{ gridTemplateColumns: `repeat(${weeks.length}, var(--heatmap-cell))` }}>{weeks.map((week, weekIndex) => <div className="heatmap-week" key={weekIndex}>{week.map(day => <button key={day.key} type="button" className={`heatmap-cell level-${day.isFuture ? 0 : intensity(day.minutes)}${selectedKey === day.key ? ' selected' : ''}${day.isFuture ? ' future' : ''}`} onClick={() => setSelectedKey(day.key)} aria-label={`${formatDate(day.date)}，${day.isFuture ? '未来日期' : day.minutes ? `学习 ${day.minutes} 分钟` : '未记录学习'}`} title={`${formatDate(day.date)} · ${day.isFuture ? '未来日期' : day.minutes ? `${day.minutes} 分钟` : '未记录'}`} />)}</div>)}</div></div></div>
    <div className="heatmap-footer"><span>{selected ? `${formatDate(selected.date)}：${selected.isFuture ? '未来日期' : selected.minutes ? `学习 ${selected.minutes} 分钟` : '未记录学习'}` : ''}</span><div className="heatmap-legend" aria-label="颜色深浅代表学习时长"><small>少</small>{[0, 1, 2, 3, 4].map(level => <i className={`level-${level}`} key={level} />)}<small>多</small></div></div>
  </section>
}
