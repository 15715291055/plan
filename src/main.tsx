import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AnimatePresence, motion } from 'motion/react'
import {
  AlarmClock, ArrowRight, BarChart3, BookOpen, CalendarDays, Check,
  ChevronLeft, ChevronRight, CircleHelp, Clock3, FileText, Filter,
  Flame, LayoutDashboard, ListTodo, Menu, MoreHorizontal, Pause, Play,
  Plus, RefreshCw, Search, Settings, Sparkles, Timer, Upload, X, Zap, Pencil, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import {
  createTask as createTaskRecord,
  demoCourses,
  demoTasks,
  deleteTask as deleteTaskRecord,
  loadWorkspace,
  persistLocal,
  saveCourse,
  supabaseConfigured,
  updateTaskStatus,
  updateTask as updateTaskRecord,
  deleteCourse as deleteCourseRecord,
  updateCourse as updateCourseRecord,
  type Course,
  type AvailabilityRule,
  type FixedEvent,
  type Material,
  type ScheduleItem,
  type StudyLog,
  type UserPreferences,
  defaultPreferences,
  type Task,
  type TaskCompletionMode,
  createAvailabilityRule,
  updateAvailabilityRule,
  deleteAvailabilityRule,
  createFixedEvent,
  updateFixedEvent,
  deleteFixedEvent,
  createStudyLog,
  updateMaterialAnalysis,
  deleteMaterial,
  savePreferences,
  saveWeeklyInput,
  saveSchedule,
  type TaskDraft,
  uploadMaterial,
  getCurrentUserEmail,
  signIn,
  signUp,
  signOut,
  saveUserProfile,
  saveDeepSeekKey,
  deleteDeepSeekKey,
  apiRequestHeaders,
  defaultUserProfile,
  type UserProfile,
} from './lib/data'
import { ShanHaiBackground, type ShanHaiState } from './components/ShanHaiBackground'
import { StudyHeatmap } from './components/StudyHeatmap'
import { buildSchedule, type ReplanStrategy } from './lib/scheduler'
import { extractMaterialText } from './lib/extract'
import { greetingFor, quoteFor } from './lib/daily-inspiration'
import './styles.css'

const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
function parseTimeMinutes(value: string): number { const [hours, minutes] = value.split(':').map(Number); return (hours || 0) * 60 + (minutes || 0) }
function schedulableWindows(unavailable: AvailabilityRule[]): AvailabilityRule[] {
  return Array.from({ length: 7 }, (_, weekday) => {
    const blocked = unavailable.filter(rule => rule.weekday === weekday).map(rule => [parseTimeMinutes(rule.startTime), parseTimeMinutes(rule.endTime)] as [number, number]).sort((a, b) => a[0] - b[0])
    const windows: AvailabilityRule[] = []; let cursor = 0
    for (const [start, end] of blocked) { if (start > cursor) windows.push({ id: `computed-${weekday}-${cursor}`, weekday, startTime: `${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`, endTime: `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}` }); cursor = Math.max(cursor, end) }
    if (cursor < 1440) windows.push({ id: `computed-${weekday}-${cursor}`, weekday, startTime: `${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`, endTime: '24:00' })
    return windows
  }).flat()
}
function mondayOf(date: Date, offset = 0) {
  const value = new Date(date); value.setHours(0, 0, 0, 0)
  const day = (value.getDay() + 6) % 7
  value.setDate(value.getDate() - day + offset * 7)
  return value
}
const navItems = [
  { id: 'today', label: '今日计划', icon: LayoutDashboard },
  { id: 'week', label: '每周计划', icon: CalendarDays },
  { id: 'tasks', label: '任务管理', icon: ListTodo },
  { id: 'courses', label: '我的课程', icon: BookOpen },
  { id: 'materials', label: '学习资料', icon: FileText },
]

type ScheduleCourseDraft = { weekday: number; title: string; start_time: string; end_time: string }
type ScheduleAvailabilityDraft = { weekday: number; start_time: string; end_time: string }
type ScheduleImportResult = { courses: ScheduleCourseDraft[]; availability: ScheduleAvailabilityDraft[]; notes: string }

async function compressImageForVision(file: File): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => { const url = URL.createObjectURL(file); const element = new Image(); element.onload = () => { URL.revokeObjectURL(url); resolve(element) }; element.onerror = () => { URL.revokeObjectURL(url); reject(new Error('无法读取课表图片')) }; element.src = url })
  const scale = Math.min(1, 1800 / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext('2d'); if (!context) throw new Error('无法处理课表图片')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', .86)
}

function normalizedDeepSeekKey(value: string): string {
  return value.trim().replace(/[\u0000-\u001f\u007f-\u00ff\u3000\s]/g, '')
}

function Avatar({ profile, className }: { profile: UserProfile; className: string }) {
  const [imageFailed, setImageFailed] = useState(false)
  useEffect(() => setImageFailed(false), [profile.avatarUrl])
  const initial = profile.displayName.trim().slice(0, 1).toUpperCase() || '学'
  return <span className={className}>{profile.avatarUrl && !imageFailed ? <img src={profile.avatarUrl} alt={`${profile.displayName}的头像`} onError={() => setImageFailed(true)} /> : initial}</span>
}

function ViewTransition({ children }: { children: React.ReactNode }) {
  return <motion.div className="view-transition" initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -6, filter: 'blur(3px)' }} transition={{ duration: .26, ease: 'easeOut' }}>{children}</motion.div>
}

type VisualStyle = 'style-1' | 'style-2' | 'style-3' | 'style-4'

function BackgroundStyleChooser({ visualStyle, onChange }: { visualStyle: VisualStyle; onChange: (value: VisualStyle) => void }) {
  return <section className="panel background-style-panel"><div className="panel-head"><div><h2>背景风格</h2><span className="panel-caption">风格 3、4 使用你提供的图片作为背景</span></div></div><div className="background-style-options">{[
    ['style-1', '风格 1', '默认山海'],
    ['style-2', '风格 2', '既有背景'],
    ['style-3', '风格 3', '海港晴空'],
    ['style-4', '风格 4', '海港夜景'],
  ].map(([value, label, detail]) => <button type="button" key={value} className={`background-style-option ${visualStyle === value ? 'selected' : ''} ${value}`} onClick={() => onChange(value as VisualStyle)}><span className="background-style-thumb" /><strong>{label}</strong><small>{detail}</small></button>)}</div></section>
}

function App() {
  const [active, setActive] = useState('today')
  const [tasks, setTasks] = useState<Task[]>(demoTasks)
  const [courses, setCourses] = useState<Course[]>(demoCourses)
  const [availability, setAvailability] = useState<AvailabilityRule[]>([])
  const [fixedEvents, setFixedEvents] = useState<FixedEvent[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([])
  const [studyLogs, setStudyLogs] = useState<StudyLog[]>([])
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences)
  const [profile, setProfile] = useState<UserProfile>(defaultUserProfile)
  const [dataSource, setDataSource] = useState<'supabase' | 'local'>('local')
  const [loading, setLoading] = useState(true)
  const [dataError, setDataError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showCourseModal, setShowCourseModal] = useState(false)
  const [showScheduleImport, setShowScheduleImport] = useState(false)
  const [scheduleImport, setScheduleImport] = useState<ScheduleImportResult | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [toast, setToast] = useState('')
  const [timerTask, setTimerTask] = useState<string | null>(null)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => { try { return localStorage.getItem('study-sidebar-collapsed') === 'true' } catch { return false } })
  const [visualStyle, setVisualStyle] = useState<'style-1' | 'style-2' | 'style-3' | 'style-4'>(() => { try { const value = localStorage.getItem('study-visual-style'); return value === 'style-2' || value === 'style-3' || value === 'style-4' ? value : 'style-1' } catch { return 'style-1' } })
  const [windowOpacity, setWindowOpacity] = useState(() => {
    try {
      const saved = localStorage.getItem('study-window-opacity')
      const value = saved === null ? 84 : Number(saved)
      return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 84
    } catch { return 84 }
  })
  function updateWindowOpacity(value: number) {
    setWindowOpacity(value)
    try { localStorage.setItem('study-window-opacity', String(value)) } catch { /* Keep the control usable when storage is unavailable. */ }
  }
  const [replanning, setReplanning] = useState(false)
  const [deepSeekKey, setDeepSeekKey] = useState('')
  const [hasSavedDeepSeekKey, setHasSavedDeepSeekKey] = useState(false)
  const [aiDrafts, setAiDrafts] = useState<TaskDraft[]>([])
  const [materialDrafts, setMaterialDrafts] = useState<{ materialId: string; fileName: string; drafts: TaskDraft[]; analysis?: Material['analysisResult'] } | null>(null)
  const [scheduleChanges, setScheduleChanges] = useState<Array<{ type: string; taskId: string; from?: string; to?: string; reason?: string }>>([])
  const [aiBusy, setAiBusy] = useState(false)

  async function refreshWorkspace() {
    setLoading(true)
    try {
      const workspace = await loadWorkspace()
      setTasks(workspace.tasks)
      setAvailability(workspace.availability)
      setFixedEvents(workspace.fixedEvents)
      // Backfill courses for fixed classes imported by older versions.
      if (workspace.source === 'supabase' && workspace.fixedEvents.length) {
        const existingNames = new Set(workspace.courses.map(course => course.name.trim()))
        const missingNames = [...new Set(workspace.fixedEvents.map(event => event.title.trim()).filter(name => name && !existingNames.has(name)))]
        if (missingNames.length) {
          const createdCourses = await Promise.all(missingNames.map(name => saveCourse({ name })))
          workspace.courses = [...workspace.courses, ...createdCourses]
        }
      }
      setCourses(workspace.courses)
      setMaterials(workspace.materials)
      setScheduleItems(workspace.scheduleItems)
      setStudyLogs(workspace.studyLogs)
      setPreferences(workspace.preferences)
      setProfile(workspace.profile)
      try {
        const response = await fetch('/api/deepseek-key', { headers: await apiRequestHeaders() })
        const result = await response.json() as { configured?: boolean }
        setHasSavedDeepSeekKey(Boolean(response.ok && result.configured))
      } catch { setHasSavedDeepSeekKey(false) }
      setDataSource(workspace.source)
      setDataError(workspace.error ?? '')
    } catch (error) { setDataError(error instanceof Error ? error.message : '数据加载失败') }
    finally { setLoading(false) }
  }
  useEffect(() => { void refreshWorkspace() }, [])
  useEffect(() => { if (!loading && dataSource === 'local') persistLocal(tasks, courses, { availability, fixedEvents, scheduleItems, materials, studyLogs, preferences }) }, [tasks, courses, availability, fixedEvents, scheduleItems, materials, studyLogs, preferences, loading, dataSource])
  useEffect(() => {
    if (timerTask === null) return
    const interval = window.setInterval(() => setTimerSeconds(s => s + 1), 1000)
    return () => window.clearInterval(interval)
  }, [timerTask])
  useEffect(() => { if (toast) { const t = window.setTimeout(() => setToast(''), 2800); return () => window.clearTimeout(t) } }, [toast])
  useEffect(() => { try { localStorage.setItem('study-sidebar-collapsed', String(sidebarCollapsed)) } catch { /* storage may be unavailable */ } }, [sidebarCollapsed])
  useEffect(() => { try { localStorage.setItem('study-visual-style', visualStyle) } catch { /* storage may be unavailable */ } }, [visualStyle])

  const scheduledTasks = tasks.map(task => {
    const item = scheduleItems.find(scheduleItem => scheduleItem.taskId === task.id)
    return item ? { ...task, slot: new Date(item.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), scheduledDate: new Date(item.startTime).toDateString() } : task
  })
  const todayTasks = scheduledTasks.filter(t => t.slot && (t as Task & { scheduledDate?: string }).scheduledDate === new Date().toDateString())
  const completed = tasks.filter(t => t.status === 'done').length
  const totalMinutes = todayTasks.reduce((sum, t) => sum + t.minutes, 0)
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0

  async function toggleTask(id: string) {
    const existing = tasks.find(task => task.id === id)
    if (!existing) return
    const nextStatus: Task['status'] = existing.status === 'done' ? 'todo' : 'done'
    setTasks(current => current.map(t => t.id === id ? { ...t, status: nextStatus } : t))
    try { await updateTaskStatus(id, nextStatus) } catch (error) {
      setTasks(current => current.map(t => t.id === id ? { ...t, status: existing.status } : t))
      setToast(error instanceof Error ? `保存失败：${error.message}` : '保存失败，请重试')
    }
  }
  async function addTask(title: string, minutes: number, course: string, strategy: ReplanStrategy = 'minimal_change', deadlineIso?: string | null, difficulty?: number, type?: string, completionMode: TaskCompletionMode = 'single_day', spreadDays?: number, priority = 70, requireContinuous = false) {
    try {
      const created = await createTaskRecord({ title, minutes, course: course || '未分类', deadlineIso, difficulty, type, source: 'temporary', completionMode, spreadDays, priority, requireContinuous })
      const nextTasks = [...tasks, created]
      setTasks(nextTasks)
      setShowAdd(false)
      try {
        await runReplan(strategy, nextTasks)
        setToast(dataSource === 'supabase' ? '任务已保存到云端并完成排程' : '临时任务已加入，计划已自动重排')
      } catch (error) {
        setToast(error instanceof Error && error.message.includes('不可用时间') ? '任务已添加；当前时段已被课程占用，待有空档后再安排' : '任务已添加，但排程稍后可重试')
      }
    } catch (error) { setToast(error instanceof Error ? `保存失败：${error.message}` : '保存失败，请重试') }
  }
  async function editTask(id: string, title: string, minutes: number, course: string, deadlineIso?: string | null, difficulty?: number, type?: string, completionMode: TaskCompletionMode = 'single_day', spreadDays?: number, priority = 70, requireContinuous = false) {
    const previous = tasks
    setTasks(current => current.map(task => task.id === id ? { ...task, title, minutes, course: course || '未分类', deadlineIso: deadlineIso ?? undefined, deadline: deadlineIso ? new Date(deadlineIso).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '未设置', difficulty: difficulty ? difficulty >= 4 ? '较难' : difficulty >= 3 ? '中等' : '简单' : task.difficulty, type: type ?? task.type, completionMode, spreadDays: completionMode === 'spread_days' ? spreadDays : undefined, priority, requireContinuous } : task))
    try { await updateTaskRecord(id, { title, minutes, course: course || '未分类', deadlineIso, difficulty, type, completionMode, spreadDays, priority, requireContinuous, completedMinutes: previous.find(task => task.id === id)?.completedMinutes ?? 0 }); setEditingTask(null); setToast(dataSource === 'supabase' ? '任务已更新到云端' : '任务已更新') } catch (error) { setTasks(previous); setToast(error instanceof Error ? `保存失败：${error.message}` : '保存失败，请重试') }
  }
  async function addCourse(name: string, color: string) {
    try { const created = await saveCourse({ name, color }); setCourses(current => [...current, created]); setShowCourseModal(false); setToast(dataSource === 'supabase' ? '课程已保存到云端' : '课程已保存') } catch (error) { setToast(error instanceof Error ? `保存失败：${error.message}` : '保存失败，请重试') }
  }
  async function editCourse(id: string, name: string, color: string) {
    const previous = courses
    setCourses(current => current.map(course => course.id === id ? { ...course, name, color } : course))
    try { await updateCourseRecord(id, { name, color }); setEditingCourse(null); setToast(dataSource === 'supabase' ? '课程已更新到云端' : '课程已更新') } catch (error) { setCourses(previous); setToast(error instanceof Error ? `保存失败：${error.message}` : '保存失败，请重试') }
  }
  async function removeCourse(id: string) {
    const previous = courses
    setCourses(current => current.filter(course => course.id !== id))
    try { await deleteCourseRecord(id); setToast('课程已删除') } catch (error) { setCourses(previous); setToast(error instanceof Error ? `删除失败：${error.message}` : '删除失败，请重试') }
  }
  async function removeTask(id: string) {
    const previous = tasks
    setTasks(current => current.filter(task => task.id !== id))
    try { await deleteTaskRecord(id); setToast('任务已删除') } catch (error) { setTasks(previous); setToast(error instanceof Error ? `删除失败：${error.message}` : '删除失败，请重试') }
  }
  async function addAvailability(input: { weekday: number; startTime: string; endTime: string }) {
    try { const created = await createAvailabilityRule(input); setAvailability(current => [...current, created].sort((a, b) => a.weekday - b.weekday)); setToast(dataSource === 'supabase' ? '不可用时间已保存到云端' : '不可用时间已保存') }
    catch (error) { setToast(error instanceof Error ? `保存失败：${error.message}` : '保存失败，请重试') }
  }
  async function removeAvailability(id: string) {
    const previous = availability; setAvailability(current => current.filter(item => item.id !== id))
    try { await deleteAvailabilityRule(id); setToast('不可用时间已删除') } catch (error) { setAvailability(previous); setToast(error instanceof Error ? `删除失败：${error.message}` : '删除失败，请重试') }
  }
  async function editAvailability(id: string, input: { weekday: number; startTime: string; endTime: string }) {
    const previous = availability
    setAvailability(current => current.map(item => item.id === id ? { ...item, ...input } : item).sort((a, b) => a.weekday - b.weekday))
    try { await updateAvailabilityRule(id, input); setToast('不可用时间已更新') }
    catch (error) { setAvailability(previous); setToast(error instanceof Error ? `保存失败：${error.message}` : '保存失败，请重试') }
  }
  async function addFixedEvent(input: { title: string; startTime: string; endTime: string; recurrenceRule?: string }) {
    try { const created = await createFixedEvent(input); setFixedEvents(current => [...current, created].sort((a, b) => a.startTime.localeCompare(b.startTime))); setToast(dataSource === 'supabase' ? '固定课程已保存到云端' : '固定课程已保存') }
    catch (error) { setToast(error instanceof Error ? `保存失败：${error.message}` : '保存失败，请重试') }
  }
  async function removeFixedEvent(id: string) {
    const previous = fixedEvents; setFixedEvents(current => current.filter(item => item.id !== id))
    try { await deleteFixedEvent(id); setToast('固定课程已删除') } catch (error) { setFixedEvents(previous); setToast(error instanceof Error ? `删除失败：${error.message}` : '删除失败，请重试') }
  }
  async function editFixedEvent(id: string, input: { title: string; startTime: string; endTime: string; recurrenceRule?: string }) {
    const previous = fixedEvents
    setFixedEvents(current => current.map(item => item.id === id ? { ...item, ...input } : item).sort((a, b) => a.startTime.localeCompare(b.startTime)))
    try { await updateFixedEvent(id, input); setToast('固定课程已更新') }
    catch (error) { setFixedEvents(previous); setToast(error instanceof Error ? `保存失败：${error.message}` : '保存失败，请重试') }
  }
  async function updatePreferences(input: UserPreferences) {
    const previous = preferences
    setPreferences(input)
    try {
      const saved = await savePreferences(input)
      setPreferences(saved)
      setToast(dataSource === 'supabase' ? '学习偏好已保存到云端' : '学习偏好已保存')
    } catch (error) {
      setPreferences(previous)
      setToast(error instanceof Error ? `保存失败：${error.message}` : '保存失败，请重试')
    }
  }
  async function updateProfile(input: UserProfile) {
    const previous = profile
    setProfile(input)
    try {
      const saved = await saveUserProfile(input)
      setProfile(saved)
      setToast(dataSource === 'supabase' ? '个人资料已保存到云端' : '个人资料已保存在当前设备')
    } catch (error) {
      setProfile(previous)
      setToast(error instanceof Error ? `保存失败：${error.message}` : '保存失败，请重试')
      throw error
    }
  }
  async function analyzeScheduleImage(file: File) {
    if (!hasSavedDeepSeekKey) { setToast('请先登录并在设置中保存 DeepSeek API Key'); return }
    if (!file.type.startsWith('image/')) { setToast('请上传 JPG、PNG 或 WebP 格式的课表图片'); return }
    try {
      const image = await compressImageForVision(file)
      const response = await fetch('/api/analyze-schedule-image', { method: 'POST', headers: await apiRequestHeaders(), body: JSON.stringify({ image }) })
      const payload = await response.json() as ScheduleImportResult & { error?: string }
      if (!response.ok) { if (response.status === 401) setHasSavedDeepSeekKey(false); throw new Error(payload.error ?? '登录状态已失效，请重新登录后再试') }
      setScheduleImport({ courses: payload.courses ?? [], availability: payload.availability ?? [], notes: payload.notes ?? '' })
      setToast('课表已识别，请确认后写入计划')
    } catch (error) { setToast(error instanceof Error ? error.message : '课表识别失败') }
  }
  async function analyzeScheduleText(content: string) {
    if (!hasSavedDeepSeekKey) { setToast('请先登录并在设置中保存 DeepSeek API Key'); return }
    try {
      const response = await fetch('/api/analyze-schedule-text', { method: 'POST', headers: await apiRequestHeaders(), body: JSON.stringify({ content }) })
      const payload = await response.json() as ScheduleImportResult & { error?: string }
      if (!response.ok) { if (response.status === 401) setHasSavedDeepSeekKey(false); throw new Error(payload.error ?? '登录状态已失效，请重新登录后再试') }
      setScheduleImport({ courses: payload.courses ?? [], availability: payload.availability ?? [], notes: payload.notes ?? '' }); setToast('课表文字已解析，请确认后写入计划')
    } catch (error) { setToast(error instanceof Error ? error.message : '课表文字解析失败') }
  }
  async function confirmScheduleImport(input: ScheduleImportResult) {
    try {
      const weekStart = mondayOf(new Date())
      const uniqueCourseNames = [...new Set(input.courses.map(course => course.title.trim()).filter(Boolean))]
      const existingNames = new Set(courses.map(course => course.name.trim()))
      const importedCourses = await Promise.all(uniqueCourseNames.filter(name => !existingNames.has(name)).map(name => saveCourse({ name })))
      if (importedCourses.length) setCourses(current => [...current, ...importedCourses])
      const importedEvents = await Promise.all(input.courses.map(course => {
        const start = new Date(weekStart); start.setDate(weekStart.getDate() + ((course.weekday + 6) % 7)); const [startHour, startMinute] = course.start_time.split(':').map(Number); start.setHours(startHour, startMinute, 0, 0)
        const end = new Date(start); const [endHour, endMinute] = course.end_time.split(':').map(Number); end.setHours(endHour, endMinute, 0, 0)
        return createFixedEvent({ title: course.title, startTime: start.toISOString(), endTime: end.toISOString(), recurrenceRule: 'weekly' })
      }))
      const importedAvailability = await Promise.all(input.availability.map(rule => createAvailabilityRule({ weekday: rule.weekday, startTime: rule.start_time, endTime: rule.end_time })))
      setFixedEvents(current => [...current, ...importedEvents].sort((a, b) => a.startTime.localeCompare(b.startTime)))
      setAvailability(current => [...current, ...importedAvailability].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime)))
      setScheduleImport(null); setShowScheduleImport(false)
      await runReplan('minimal_change', tasks, [...availability, ...importedAvailability], [...fixedEvents, ...importedEvents])
      setToast(`已关联 ${importedCourses.length} 门课程，加入 ${importedEvents.length} 节固定课和 ${importedAvailability.length} 个空闲时段，并重新排程`)
    } catch (error) { setToast(error instanceof Error ? error.message : '写入课表失败，请重试') }
  }
  async function handleUpload(file: File) {
    let created: Material | null = null
    try {
      const uploaded = await uploadMaterial(file)
      created = uploaded
      setMaterials(current => [uploaded, ...current])
      if (hasSavedDeepSeekKey) {
        const text = await extractMaterialText(file)
        if (text.length >= 20) {
          const response = await fetch('/api/analyze-material', { method: 'POST', headers: await apiRequestHeaders(), body: JSON.stringify({ fileName: file.name, content: text }) })
          const payload = await response.json() as { error?: string; tasks?: Array<{ title: string; estimated_minutes: number; difficulty: number; task_type: string }>; chapters?: string[]; knowledge_points?: string[]; summary?: string }
          if (!response.ok) { if (response.status === 401) setHasSavedDeepSeekKey(false); throw new Error(payload.error ?? '登录状态已失效，请重新登录后再试') }
          const analysis = { chapters: payload.chapters ?? [], knowledge_points: payload.knowledge_points ?? [], tasks: payload.tasks ?? [], summary: payload.summary ?? '' }
          await updateMaterialAnalysis(created.id, 'needs_review', analysis)
          setMaterials(current => current.map(material => material.id === created?.id ? { ...material, status: 'needs_review', analysisResult: analysis } : material))
          setMaterialDrafts({ materialId: created.id, fileName: file.name, analysis, drafts: (payload.tasks ?? []).map(task => ({ title: task.title, course: created?.course ?? courses[0]?.name ?? '未分类', estimated_minutes: task.estimated_minutes, difficulty: task.difficulty, task_type: task.task_type, confidence: 0.8 })) })
          setToast('资料已完成分析，请确认生成任务')
        } else {
          await updateMaterialAnalysis(created.id, 'needs_review')
          setMaterials(current => current.map(material => material.id === created?.id ? { ...material, status: 'needs_review' } : material))
          setToast('资料已上传；当前格式未提取到文本，请补充文字后人工确认')
        }
      } else setToast(dataSource === 'supabase' ? '资料已上传，等待分析' : '资料已加入本地资料库')
    }
    catch (error) {
      if (created) {
        try { await updateMaterialAnalysis(created.id, 'failed') } catch { /* keep the original upload error visible */ }
        setMaterials(current => current.map(material => material.id === created?.id ? { ...material, status: 'failed' } : material))
      }
      setToast(error instanceof Error ? `上传失败：${error.message}` : '上传失败，请重试')
    }
  }
  async function removeMaterial(material: Material) {
    const previous = materials
    setMaterials(current => current.filter(item => item.id !== material.id))
    try { await deleteMaterial(material); setToast('资料已删除') } catch (error) { setMaterials(previous); setToast(error instanceof Error ? `删除失败：${error.message}` : '删除失败，请重试') }
  }
  function reviewMaterial(material: Material) {
    const analysis = material.analysisResult
    if (!analysis?.tasks?.length) { setToast('这份资料没有可确认的任务'); return }
    setMaterialDrafts({ materialId: material.id, fileName: material.fileName, analysis, drafts: analysis.tasks.map(task => ({ title: task.title, course: material.course ?? courses[0]?.name ?? '未分类', estimated_minutes: task.estimated_minutes, difficulty: task.difficulty, task_type: task.task_type, confidence: 0.8 })) })
  }
  async function recordStudyLog(taskId: string, plannedMinutes: number, actualMinutes: number) {
    const task = tasks.find(item => item.id === taskId)
    const completedMinutes = Math.min(task?.minutes ?? actualMinutes, (task?.completedMinutes ?? 0) + actualMinutes)
    try { const created = await createStudyLog({ taskId, plannedMinutes, actualMinutes, completedAt: new Date().toISOString() }); setStudyLogs(current => [created, ...current]); if (task) { const status: Task['status'] = completedMinutes >= task.minutes ? 'done' : 'todo'; setTasks(current => current.map(item => item.id === taskId ? { ...item, completedMinutes, status } : item)); await updateTaskRecord(task.id, { title: task.title, minutes: task.minutes, course: task.course, deadlineIso: task.deadlineIso ?? null, type: task.type, priority: task.priority, completionMode: task.completionMode, spreadDays: task.spreadDays, requireContinuous: task.requireContinuous, completedMinutes }); await updateTaskStatus(task.id, status) } setToast(completedMinutes >= (task?.minutes ?? 0) ? '任务已完成，学习记录已保存' : `已记录 ${completedMinutes}/${task?.minutes ?? actualMinutes} 分钟`) }
    catch (error) { setToast(error instanceof Error ? `记录失败：${error.message}` : '记录失败，请重试') }
  }
  function startTimer(id: string) { setTimerTask(id); setTimerSeconds(0); setToast('专注计时已开始，保持节奏') }
  function stopTimer() {
    const taskId = timerTask
    const actualMinutes = Math.max(1, Math.ceil(timerSeconds / 60))
    setTimerTask(null)
    if (taskId) {
      const task = tasks.find(item => item.id === taskId)
      void recordStudyLog(taskId, task?.minutes ?? actualMinutes, actualMinutes)
    }
  }
  async function runReplan(strategy: ReplanStrategy = 'minimal_change', taskList = tasks, availabilityOverride = availability, fixedEventsOverride = fixedEvents) {
    setReplanning(true)
    try {
      const planningAvailability = schedulableWindows(availabilityOverride)
      const result = buildSchedule(taskList, planningAvailability, fixedEventsOverride, scheduleItems, { strategy, blockMinutes: preferences.defaultBlockMinutes, bufferRatio: preferences.bufferRatio, minBlockMinutes: preferences.minBlockMinutes, breakMinutes: preferences.breakMinutes, peakStartHour: preferences.peakStartHour, peakEndHour: preferences.peakEndHour })
      if (result.items.length === 0 && taskList.some(task => task.status !== 'done')) throw new Error('当前时间都不可用或已被课程占用')
      const saved = await saveSchedule({ reason: strategy === 'urgent' ? '临时任务紧急插入' : '根据任务和不可用时间重新排程', items: result.items })
      setScheduleItems(saved.items)
      setScheduleChanges(result.changes)
      setToast(result.conflicts.length ? `排程完成，但有 ${result.conflicts.length} 个任务未安排` : '计划已更新')
      return result
    } catch (error) { setToast(error instanceof Error ? error.message : '排程失败，请重试'); throw error }
    finally { setReplanning(false) }
  }
  async function analyzeWeeklyContent(content: string) {
    if (!hasSavedDeepSeekKey) { setToast('请先登录并在设置中保存 DeepSeek API Key'); return }
    setAiBusy(true)
    try {
      const response = await fetch('/api/analyze-weekly-content', { method: 'POST', headers: await apiRequestHeaders(), body: JSON.stringify({ content, courses: courses.map(course => course.name) }) })
      const payload = await response.json() as { error?: string; tasks?: TaskDraft[] }
      if (!response.ok || !payload.tasks) { if (response.status === 401) setHasSavedDeepSeekKey(false); throw new Error(payload.error ?? '登录状态已失效，请重新登录后再试') }
      await saveWeeklyInput({ weekStart: new Date().toISOString().slice(0, 10), rawText: content })
      setAiDrafts(payload.tasks); setToast(`AI 已生成 ${payload.tasks.length} 个任务草稿，请确认`)
    } catch (error) { setToast(error instanceof Error ? error.message : 'AI 分析失败，请重试') }
    finally { setAiBusy(false) }
  }
  async function confirmAiDrafts(drafts: TaskDraft[]) {
    try { const created = await Promise.all(drafts.map(draft => createTaskRecord({ title: draft.title, course: draft.course, minutes: draft.estimated_minutes, deadlineIso: draft.deadline ?? null, difficulty: draft.difficulty, priority: draft.priority ?? Math.round((draft.confidence ?? .5) * 100), type: draft.task_type, source: 'weekly_input' }))); setTasks(current => [...current, ...created]); setAiDrafts([]); await runReplan('minimal_change', [...tasks, ...created]); setToast('已确认并保存 AI 任务') }
    catch (error) { setToast(error instanceof Error ? error.message : '保存 AI 任务失败') }
  }
  async function confirmMaterialDrafts(drafts: TaskDraft[]) {
    if (!materialDrafts) return
    try {
      const created = await Promise.all(drafts.map(draft => createTaskRecord({ title: draft.title, course: draft.course, minutes: draft.estimated_minutes, difficulty: draft.difficulty, priority: draft.priority ?? Math.round((draft.confidence ?? 0.8) * 100), type: draft.task_type, source: 'material' })))
      const nextTasks = [...tasks, ...created]
      setTasks(nextTasks)
      await updateMaterialAnalysis(materialDrafts.materialId, 'ready', materialDrafts.analysis)
      setMaterials(current => current.map(material => material.id === materialDrafts.materialId ? { ...material, status: 'ready' } : material))
      setMaterialDrafts(null)
      await runReplan('minimal_change', nextTasks)
      setToast('资料任务已确认并加入排程')
    } catch (error) { setToast(error instanceof Error ? error.message : '保存资料任务失败') }
  }
  const timerLabel = `${String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:${String(timerSeconds % 60).padStart(2, '0')}`
  const backgroundState: ShanHaiState = active === 'review' || active === 'settings' || active === 'today' || active === 'week' || active === 'tasks' || active === 'courses' || active === 'materials' ? active : 'today'

  return <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${visualStyle}`} data-transparent-panels={windowOpacity === 0} data-api-key-saved={hasSavedDeepSeekKey} style={{ '--window-opacity': windowOpacity / 100 } as React.CSSProperties}>
    <ShanHaiBackground state={backgroundState} visualStyle={visualStyle} emphasis={toast.includes('临时任务') ? 'warm' : 'none'} />
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="brand"><span className="brand-mark"><Sparkles size={16} /></span><span className="sidebar-label">拾序</span><span className="brand-sub sidebar-label">STUDY OS</span><button className="sidebar-toggle icon-btn" onClick={() => setSidebarCollapsed(value => !value)} aria-label={sidebarCollapsed ? '展开任务栏' : '收起任务栏'}>{sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button></div>
      <button className="profile profile-button" onClick={() => setShowProfileModal(true)} title="编辑昵称和头像"><Avatar profile={profile} className="avatar" /><MoreHorizontal size={17} className="muted-icon sidebar-label" /></button>
      <div className="nav-label sidebar-label">工作台</div>
      <nav>{navItems.map(item => { const Icon = item.icon; return <button key={item.id} className={`nav-item ${active === item.id ? 'active' : ''}`} onClick={() => { setActive(item.id); setMobileOpen(false) }}><Icon size={18} /><span className="sidebar-label">{item.label}</span>{item.id === 'today' && <span className="nav-badge">{tasks.filter(task => task.status !== 'done').length}</span>}</button> })}</nav>
      <div className="nav-label spaced sidebar-label">洞察</div>
      <button className={`nav-item ${active === 'review' ? 'active' : ''}`} onClick={() => { setActive('review'); setMobileOpen(false) }}><BarChart3 size={18} /><span className="sidebar-label">学习复盘</span></button>
      <div className="sidebar-bottom"><div className="streak"><div className="streak-icon"><Flame size={17} /></div><div className="sidebar-label"><strong>连续学习 7 天</strong><span>本周比上周多 2 小时</span></div></div><button className={`nav-item ${active === 'settings' ? 'active' : ''}`} onClick={() => { setActive('settings'); setMobileOpen(false) }}><Settings size={18} /><span className="sidebar-label">设置</span></button><button className="help sidebar-label" onClick={() => setToast('帮助与反馈功能即将开放')}><CircleHelp size={16} />帮助与反馈 <span>⌘K</span></button></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><button className="mobile-menu" onClick={() => setMobileOpen(open => !open)}><Menu size={20} /></button><div className="breadcrumbs"><span>工作台</span><ChevronRight size={14} /><strong>{navItems.find(n => n.id === active)?.label || (active === 'review' ? '学习复盘' : '设置')}</strong></div><div className="top-actions"><span className={`data-mode ${dataSource}`} title={dataError || undefined}>{dataSource === 'supabase' ? '云端数据' : '本地数据'}{loading ? ' · 加载中' : ''}</span><div className="search"><Search size={16} /><input placeholder="搜索任务、课程..." /><kbd>⌘ K</kbd></div><button className="icon-btn"><AlarmClock size={18} /></button><Avatar profile={profile} className="top-avatar" /></div></header>
      {dataError && <div className="data-banner"><CircleHelp size={15} />{dataError}<button onClick={() => setDataError('')}><X size={14} /></button></div>}
      <AnimatePresence mode="wait" initial={false}>
      {active === 'today' && <motion.div key="today" className="view-transition" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .22 }}><TodayView profile={profile} tasks={todayTasks} allTasks={tasks} availability={availability} fixedEvents={fixedEvents} progress={progress} totalMinutes={totalMinutes} toggleTask={toggleTask} startTimer={startTimer} timerTask={timerTask} timerLabel={timerLabel} stopTimer={stopTimer} onAdd={() => setShowAdd(true)} replanning={replanning} onReplan={() => void runReplan()} /></motion.div>}
      {active === 'week' && <motion.div key="week" className="view-transition" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .22 }}><WeekView tasks={tasks} scheduleItems={scheduleItems} fixedEvents={fixedEvents} scheduleChanges={scheduleChanges} dataSource={dataSource} onBack={() => setActive('today')} replanning={replanning} onReplan={() => void runReplan()} /></motion.div>}
      {active === 'tasks' && <ViewTransition key="tasks"><TasksView tasks={tasks} courses={courses} toggleTask={toggleTask} onAdd={() => setShowAdd(true)} onDelete={removeTask} onEdit={setEditingTask} onAnalyze={analyzeWeeklyContent} aiBusy={aiBusy} /></ViewTransition>}
      {active === 'courses' && <ViewTransition key="courses"><CoursesView courses={courses} onAdd={() => setShowCourseModal(true)} onEdit={setEditingCourse} onDelete={removeCourse} /></ViewTransition>}
      {active === 'materials' && <ViewTransition key="materials"><MaterialsView materials={materials} onToast={setToast} onUpload={handleUpload} onDelete={removeMaterial} onReview={reviewMaterial} /></ViewTransition>}
      {active === 'review' && <ViewTransition key="review"><ReviewView tasks={tasks} studyLogs={studyLogs} /></ViewTransition>}
      {active === 'settings' && <ViewTransition key="settings"><><SettingsView windowOpacity={windowOpacity} onWindowOpacityChange={updateWindowOpacity} visualStyle={visualStyle} onVisualStyleChange={setVisualStyle} profile={profile} availability={availability} fixedEvents={fixedEvents} preferences={preferences} deepSeekKey={deepSeekKey} hasSavedDeepSeekKey={hasSavedDeepSeekKey} onDeepSeekKeyChange={setDeepSeekKey} onSaveDeepSeekKey={async () => { const key = normalizedDeepSeekKey(deepSeekKey); if (!/^[\x21-\x7e]{20,300}$/.test(key)) throw new Error('DeepSeek API Key 含有无效字符，请重新粘贴'); await saveDeepSeekKey(key); setDeepSeekKey(''); setHasSavedDeepSeekKey(true); setToast('DeepSeek API Key 已加密保存到当前账户') }} onDeleteDeepSeekKey={async () => { await deleteDeepSeekKey(); setDeepSeekKey(''); setHasSavedDeepSeekKey(false); setToast('已删除账户保存的 DeepSeek API Key') }} onSavePreferences={updatePreferences} onSaveProfile={updateProfile} onImportSchedule={() => setShowScheduleImport(true)} onAddAvailability={addAvailability} onUpdateAvailability={editAvailability} onDeleteAvailability={removeAvailability} onAddFixedEvent={addFixedEvent} onUpdateFixedEvent={editFixedEvent} onDeleteFixedEvent={removeFixedEvent} onAuthChange={refreshWorkspace} /><input id="schedule-image-import" hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { const file = event.target.files?.[0]; event.currentTarget.value = ''; if (file) void analyzeScheduleImage(file) }} /></></ViewTransition>}
      {active === 'settings' && <ViewTransition key="background-style"><BackgroundStyleChooser visualStyle={visualStyle} onChange={setVisualStyle} /></ViewTransition>}
      </AnimatePresence>
    </main>
    {showAdd && <AddTaskModal courses={courses} onClose={() => setShowAdd(false)} onAdd={addTask} />}
    {editingTask && <AddTaskModal initial={editingTask} courses={courses} onClose={() => setEditingTask(null)} onUpdate={editTask} />}
    {showCourseModal && <CourseModal onClose={() => setShowCourseModal(false)} onAdd={addCourse} />}
    {editingCourse && <CourseModal initial={editingCourse} onClose={() => setEditingCourse(null)} onUpdate={editCourse} />}
    {showProfileModal && <ProfileModal profile={profile} onClose={() => setShowProfileModal(false)} onSave={async input => { await updateProfile(input); setShowProfileModal(false) }} />}
    {showScheduleImport && <ScheduleImportModal result={scheduleImport} onClose={() => { setShowScheduleImport(false); setScheduleImport(null) }} onAnalyze={analyzeScheduleImage} onAnalyzeText={analyzeScheduleText} onConfirm={confirmScheduleImport} />}
    {aiDrafts.length > 0 && <AiDraftModal drafts={aiDrafts} onClose={() => setAiDrafts([])} onConfirm={confirmAiDrafts} />}
    {materialDrafts && <AiDraftModal drafts={materialDrafts.drafts} title={`确认 ${materialDrafts.fileName} 的任务`} onClose={() => setMaterialDrafts(null)} onConfirm={confirmMaterialDrafts} />}
    {toast && <div className="toast"><Check size={16} />{toast}</div>}
    {timerTask !== null && <div className="timer-dock"><div className="timer-pulse"><Timer size={17} /></div><div><span>正在专注</span><strong>{tasks.find(t => t.id === timerTask)?.title}</strong></div><b>{timerLabel}</b><button onClick={stopTimer}><Pause size={15} />结束</button></div>}
  </div>
}

function TodayView({ profile, tasks, allTasks, availability, fixedEvents, progress, totalMinutes, toggleTask, startTimer, timerTask, timerLabel, stopTimer, onAdd, replanning, onReplan }: { profile: UserProfile; tasks: Task[]; allTasks: Task[]; availability: AvailabilityRule[]; fixedEvents: FixedEvent[]; progress: number; totalMinutes: number; toggleTask: (id:string)=>void; startTimer:(id:string)=>void; timerTask:string|null; timerLabel:string; stopTimer:()=>void; onAdd:()=>void; replanning:boolean; onReplan:()=>void }) {
  const done = allTasks.filter(t => t.status === 'done').length
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timeout: number
    const update = () => {
      window.clearTimeout(timeout)
      setNow(new Date())
      timeout = window.setTimeout(update, 60_000 - Date.now() % 60_000)
    }
    update()
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])
  const quote = quoteFor(now)
  const todayWeekday = now.getDay()
  const parseMinutes = (value: string) => { const [hour, minute] = value.split(':').map(Number); return (hour || 0) * 60 + (minute || 0) }
  const availableMinutes = availability.filter(rule => rule.weekday === todayWeekday).reduce((sum, rule) => sum + Math.max(0, parseMinutes(rule.endTime) - parseMinutes(rule.startTime)), 0)
  const fixedMinutes = fixedEvents.filter(event => new Date(event.startTime).toDateString() === now.toDateString()).reduce((sum, event) => sum + Math.max(0, (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / 60000), 0)
  const dailyCapacity = Math.max(0, availableMinutes - fixedMinutes)
  const scheduledMinutes = tasks.reduce((sum, task) => sum + task.minutes, 0)
  const dueTasks = allTasks.filter(task => task.status !== 'done' && task.deadlineIso).sort((a, b) => new Date(a.deadlineIso!).getTime() - new Date(b.deadlineIso!).getTime()).slice(0, 3)
  return <div className="page"><div className="page-head"><div className="daily-welcome"><div className="eyebrow">{now.toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' })}</div><h1>{greetingFor(now)}，{profile.displayName} <span className="wave">✦</span></h1><p className="subhead daily-quote" lang="en"><q>{quote.text}</q> <span className="quote-author">— {quote.author}</span></p></div><div className="head-actions"><button className="button secondary" onClick={onReplan} disabled={replanning}><RefreshCw size={16} className={replanning ? 'spin' : ''} />{replanning ? '正在排程...' : '重新排程'}</button><button className="button primary" onClick={onAdd}><Plus size={17} />添加任务</button></div></div>
    <div className="stat-grid"><div className="stat-card accent"><div className="stat-top"><span>今日学习</span><Clock3 size={17} /></div><strong>{Math.floor(totalMinutes / 60)}<small>h</small> {totalMinutes % 60}<small>m</small></strong><div className="stat-meta"><span>计划总时长</span><span className="trend">{tasks.length ? `${tasks.length} 项` : '暂无任务'}</span></div></div><div className="stat-card"><div className="stat-top"><span>完成进度</span><span className="mini-ring">{progress}%</span></div><strong>{done}<small> / </small>{allTasks.length}<small> 项</small></strong><div className="progress-line"><i style={{ width: `${progress}%` }} /></div></div><div className="stat-card"><div className="stat-top"><span>今日不可用时间</span><Zap size={17} /></div><strong>{Math.floor(dailyCapacity / 60)}<small>h</small> {dailyCapacity % 60}<small>m</small></strong><div className="stat-meta"><span>已安排 {Math.round(scheduledMinutes / 60 * 10) / 10}h</span><span className="neutral">余 {Math.floor(Math.max(0, dailyCapacity - scheduledMinutes) / 60)}h {Math.max(0, dailyCapacity - scheduledMinutes) % 60}m</span></div></div><div className="stat-card"><div className="stat-top"><span>计划负荷</span><span className="load-dot" /></div><strong className="load-value">{dailyCapacity === 0 ? '未设置' : scheduledMinutes / dailyCapacity > .9 ? '偏高' : scheduledMinutes / dailyCapacity > .65 ? '适中' : '轻松'}</strong><div className="load-bar"><i style={{ width: `${Math.min(100, dailyCapacity ? scheduledMinutes / dailyCapacity * 100 : 0)}%` }} /></div><div className="stat-meta"><span>{dailyCapacity ? `${Math.round(scheduledMinutes / dailyCapacity * 100)}% 已安排` : '添加不可用时间后计算'}</span></div></div></div>
    <div className="content-grid"><section className="panel task-panel"><div className="panel-head"><div><h2>今日任务</h2><span className="panel-caption">按优先级自动排序 · {tasks.length} 项</span></div><button className="text-btn">查看全部 <ArrowRight size={15} /></button></div><div className="task-list">{tasks.length ? tasks.map(task => <TaskRow key={task.id} task={task} toggleTask={toggleTask} startTimer={startTimer} timerTask={timerTask} timerLabel={timerLabel} />) : <div className="table-empty">今天还没有排程任务</div>}</div><button className="add-row" onClick={onAdd}><Plus size={16} />添加临时任务</button></section><aside className="right-column"><section className="panel focus-panel"><div className="panel-head"><div><h2>现在最适合做什么</h2><span className="panel-caption">基于截止时间、难度和你的状态</span></div><Sparkles size={18} className="spark-icon" /></div><div className="recommend"><div className="recommend-tag">建议现在开始</div><h3>{tasks.find(t => t.status === 'todo')?.title || '今日任务已完成'}</h3><p>{tasks.find(t => t.status === 'todo') ? '保持专注，完成后距离今日目标更近一步。' : '今天的任务已经全部完成。'}</p><div className="recommend-footer"><span><Clock3 size={14} />{tasks.find(t => t.status === 'todo')?.minutes ?? 0} 分钟</span><button className="button primary small" onClick={() => { const t = tasks.find(t => t.status === 'todo'); if (t) startTimer(t.id) }} disabled={!tasks.some(t => t.status === 'todo')}><Play size={14} fill="currentColor" />开始专注</button></div></div></section><section className="panel deadline-panel"><div className="panel-head"><div><h2>即将截止</h2><span className="panel-caption">未来 7 天</span></div><button className="icon-btn small-icon"><MoreHorizontal size={17} /></button></div><div className="deadline-list">{dueTasks.length ? dueTasks.map((task, index) => <div key={task.id}><span className={`date-pill ${index === 0 ? 'today-pill' : ''}`}>{task.deadline?.split(' ')[0] ?? '待定'}</span><div><strong>{task.title}</strong><span>{task.course} · {task.deadline}</span></div><b className={index === 0 ? 'urgent' : ''}>{index === 0 ? '紧急' : `${index + 1} 天`}</b></div>) : <div className="table-empty">暂无即将截止任务</div>}</div></section></aside></div>
  </div>
}

function TaskRow({ task, toggleTask, startTimer, timerTask, timerLabel }: { task: Task; toggleTask:(id:string)=>void; startTimer:(id:string)=>void; timerTask:string|null; timerLabel:string }) {
  const completedMinutes = task.status === 'done' ? task.minutes : task.completedMinutes ?? 0
  const progress = Math.min(100, Math.round(completedMinutes / task.minutes * 100))
  return <motion.div layout className={`task-row ${task.status === 'done' ? 'completed' : ''}`} initial={{ opacity: 0, y: 5 }} animate={{ opacity: task.status === 'done' ? .52 : 1, y: 0 }} transition={{ duration: .22 }} whileHover={{ x: 2 }}><button className={`check-box ${task.status === 'done' ? 'checked' : ''}`} onClick={() => toggleTask(task.id)}>{task.status === 'done' && <Check size={14} />}</button><span className="task-time">{task.slot}</span><span className="course-dot" style={{ background: task.color }} /><div className="task-main"><strong>{task.title}</strong><span>{task.course} <em>·</em> {task.type}{task.completionMode === 'spread_days' ? ` · 已完成 ${progress}%` : ''}</span></div><div className="task-details"><span className={`priority p${task.priority > 80 ? 'high' : task.priority > 65 ? 'mid' : 'low'}`}>{task.priority}</span><span className="duration"><Clock3 size={13} />{Math.max(0, task.minutes - completedMinutes)}m 剩余</span></div>{task.status === 'todo' && <button className="row-play" onClick={() => startTimer(task.id)}>{timerTask === task.id ? timerLabel : <Play size={14} fill="currentColor" />}</button>}</motion.div>
}

function WeekView({ tasks, scheduleItems, fixedEvents, scheduleChanges, dataSource, onBack, replanning, onReplan }: { tasks:Task[]; scheduleItems: ScheduleItem[]; fixedEvents: FixedEvent[]; scheduleChanges: Array<{ type: string; taskId: string; from?: string; to?: string; reason?: string }>; dataSource: 'supabase' | 'local'; onBack:()=>void; replanning:boolean; onReplan:()=>void }) { const [weekOffset, setWeekOffset] = useState(0); const weekStart = mondayOf(new Date(), weekOffset); const blocks = useMemo(() => {
  const fixedBlocks = fixedEvents.map(event => { const date = new Date(event.startTime); const day = Math.floor((date.getTime() - weekStart.getTime()) / 86400000); return { day, start: date.getHours() + date.getMinutes() / 60, duration: Math.max((new Date(event.endTime).getTime() - date.getTime()) / 3600000, .4), title: event.title, course: '固定课程', color: '#aeb9c7' } }).filter(block => block.day >= 0 && block.day < 7)
  if (scheduleItems.length) return [...scheduleItems.map(item => { const task = tasks.find(t => t.id === item.taskId); const date = new Date(item.startTime); const day = Math.floor((date.getTime() - weekStart.getTime()) / 86400000); return { day, start: date.getHours() + date.getMinutes() / 60, duration: Math.max((new Date(item.endTime).getTime() - date.getTime()) / 3600000, .4), title: task?.title ?? '学习任务', course: task?.course ?? '未分类', color: task?.color ?? '#8793a1' } }).filter(block => block.day >= 0 && block.day < 7), ...fixedBlocks]
  if (fixedBlocks.length) return fixedBlocks
  if (dataSource === 'supabase') return []
  return [{ day: 0, start: 9, duration: 1.1, title: '二叉树遍历习题', course: '数据结构', color: '#2673e8' }, { day: 0, start: 14, duration: 1, title: '英语四级高频词', course: '英语', color: '#d84d78' }, { day: 1, start: 10, duration: 1.2, title: '进程调度复习', course: '操作系统', color: '#e47735' }, { day: 2, start: 15, duration: 1.5, title: '特征值与特征向量', course: '线性代数', color: '#2a9b83' }, { day: 3, start: 9.5, duration: 1.3, title: '数据结构章节测验', course: '数据结构', color: '#2673e8' }, { day: 4, start: 14, duration: 1, title: '英语模拟练习', course: '英语', color: '#d84d78' }]
 }, [scheduleItems, tasks, fixedEvents, dataSource, weekStart]); return <div className="page"><div className="page-head compact"><div><div className="eyebrow">计划视图</div><h1>每周计划</h1><p className="subhead">{weekStart.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })} — {new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })} · 共 {Math.round(scheduleItems.reduce((sum, item) => sum + (new Date(item.endTime).getTime() - new Date(item.startTime).getTime()) / 60000, 0) / 60 * 10) / 10} 小时</p></div><div className="head-actions"><button className="button secondary" onClick={onReplan} disabled={replanning}><RefreshCw size={16} className={replanning ? 'spin' : ''} />{replanning ? '正在生成...' : '重新生成'}</button><button className="button primary" onClick={() => alert('请从任务管理添加任务后重新排程')}><Plus size={17} />添加时间块</button></div></div>{scheduleChanges.length > 0 && <section className="panel schedule-change-panel"><div className="panel-head"><div><h2>本次排程变更</h2><span className="panel-caption">系统会保留已完成和锁定的时间块</span></div></div><div className="change-list">{scheduleChanges.slice(0, 12).map((change, index) => <div key={`${change.taskId}-${index}`}><span className={`change-type ${change.type}`}>{change.type === 'added' ? '新增' : change.type === 'moved' ? '移动' : change.type === 'conflict' ? '冲突' : '未改变'}</span><strong>{tasks.find(task => task.id === change.taskId)?.title ?? '任务'}</strong><span>{change.from && change.to ? `${new Date(change.from).toLocaleString('zh-CN', { weekday: 'short', hour: '2-digit', minute: '2-digit' })} → ${new Date(change.to).toLocaleString('zh-CN', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}` : change.reason ?? ''}</span></div>)}</div></section>}<div className="calendar-toolbar"><button className="icon-btn" onClick={() => setWeekOffset(w => w - 1)}><ChevronLeft size={17} /></button><button className="button secondary date-button">{weekOffset === 0 ? '本周' : `${weekOffset > 0 ? '第 ' + weekOffset + ' 周后' : '第 ' + Math.abs(weekOffset) + ' 周前'}`}</button><button className="icon-btn" onClick={() => setWeekOffset(w => w + 1)}><ChevronRight size={17} /></button><div className="toolbar-spacer" /><span className="legend"><i className="legend-dot blue" />学习任务 <i className="legend-dot gray" />固定课程</span><button className="text-btn" onClick={onBack}>返回今日</button></div><div className="week-calendar"><div className="time-axis"><span />{[8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23].map(h => <span key={h}>{h}:00</span>)}</div><div className="day-columns">{weekDays.map((day, di) => <div className={`day-column ${weekStart.toDateString() === new Date().toDateString() && di === 0 ? 'is-today' : ''}`} key={day}><div className="day-head"><span>{day}</span><b>{new Date(weekStart.getTime() + di * 86400000).getDate()}</b></div><div className="day-body">{[8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23].map(h => <div className="hour-line" key={h} />)}{blocks.filter(b => b.day === di).map((b, i) => <motion.div layout key={i} className="calendar-block" style={{ top: `${(b.start - 8) * 50}px`, height: `${b.duration * 50}px`, borderLeftColor: b.color }}><strong>{b.title}</strong><span>{b.course}</span></motion.div>)}{di === 0 && dataSource === 'local' && weekOffset === 0 && <div className="fixed-block" style={{ top: '200px', height: '50px' }}>午休时间</div>}</div></div>)}</div></div></div> }

function TasksView({ tasks, courses, toggleTask, onAdd, onDelete, onEdit, onAnalyze, aiBusy }: { tasks:Task[]; courses: Course[]; toggleTask:(id:string)=>void; onAdd:()=>void; onDelete:(id:string)=>void; onEdit:(task: Task)=>void; onAnalyze:(content:string)=>Promise<void>; aiBusy:boolean }) {
  const [query, setQuery] = useState('')
  const [weeklyText, setWeeklyText] = useState('')
  const filtered = tasks.filter(t => t.title.includes(query) || t.course.includes(query))
  return <div className="page"><div className="page-head compact"><div><div className="eyebrow">工作台</div><h1>任务管理</h1><p className="subhead">集中管理所有课程任务与截止日期</p></div><button className="button primary" onClick={onAdd}><Plus size={17} />新建任务</button></div><section className="panel ai-input-panel"><div className="panel-head"><div><h2>本周学习内容</h2><span className="panel-caption">让 AI 拆分任务，结果确认后才会保存</span></div><Sparkles size={18} className="spark-icon" /></div><textarea value={weeklyText} onChange={e => setWeeklyText(e.target.value)} placeholder={`例如：${courses[0]?.name ?? '数据结构'}要完成第三章习题，周五前复习课堂重点`} /><div className="ai-input-footer"><span>{weeklyText.length}/20000</span><button className="button primary" disabled={aiBusy || weeklyText.trim().length < 10} onClick={() => void onAnalyze(weeklyText)}><Sparkles size={15} />{aiBusy ? '分析中...' : '生成任务草稿'}</button></div></section><div className="filter-bar"><div className="search in-page"><Search size={16} /><input placeholder="搜索任务..." value={query} onChange={e => setQuery(e.target.value)} /></div><button className="filter-btn"><Filter size={15} />课程 <ChevronRight size={14} /></button><button className="filter-btn">截止日期 <ChevronRight size={14} /></button><button className="filter-btn">状态 <ChevronRight size={14} /></button></div><section className="panel table-panel"><div className="table-head"><span>任务名称</span><span>课程</span><span>截止日期</span><span>优先级</span><span>预计时长</span><span>状态</span><span /></div>{filtered.length === 0 ? <div className="table-empty">没有匹配的任务</div> : filtered.map(t => <div className="table-row" key={t.id}><div className="table-title"><button className={`check-box ${t.status === 'done' ? 'checked' : ''}`} onClick={() => toggleTask(t.id)}>{t.status === 'done' && <Check size={14} />}</button><strong>{t.title}</strong></div><span><i className="course-dot" style={{ background:t.color }} />{t.course}</span><span>{t.deadline}</span><span className={`priority p${t.priority > 80 ? 'high' : t.priority > 65 ? 'mid' : 'low'}`}>{t.priority} <small>/ 100</small></span><span>{t.minutes} 分钟</span><span className={`status-tag ${t.status}`}>{t.status === 'done' ? '已完成' : '待完成'}</span><span className="row-actions"><button className="row-menu" title="编辑任务" onClick={() => onEdit(t)}><Pencil size={14} className="muted-icon" /></button><button className="row-menu" title="删除任务" onClick={() => { if (window.confirm(`确定删除“${t.title}”吗？`)) onDelete(t.id) }}><MoreHorizontal size={16} className="muted-icon" /></button></span></div>)}</section></div>
}

function CoursesView({ courses, onAdd, onEdit, onDelete }: { courses: Course[]; onAdd:()=>void; onEdit:(course: Course)=>void; onDelete:(id:string)=>void }) { return <div className="page"><div className="page-head compact"><div><div className="eyebrow">学期空间</div><h1>我的课程</h1><p className="subhead">2026 秋季学期 · {courses.length} 门课程</p></div><button className="button primary" onClick={onAdd}><Plus size={17} />添加课程</button></div>{courses.length === 0 ? <EmptyState title="还没有课程" detail="先添加一门课程，再开始安排学习任务。" action="添加课程" /> : <div className="course-grid">{courses.map(c => <div className="course-card" key={c.id}><div className="course-card-top"><span className="course-large-dot" style={{background:c.color}} /><span className="course-card-actions"><button className="icon-btn" title="编辑课程" onClick={() => onEdit(c)}><Pencil size={15} /></button><button className="icon-btn" title="删除课程" onClick={() => { if (window.confirm(`确定删除“${c.name}”吗？`)) onDelete(c.id) }}><MoreHorizontal size={17} /></button></span></div><span className="course-code">{c.code ?? '未设置代码'}</span><h3>{c.name}</h3><div className="course-progress"><div><span>学习进度</span><strong>{c.progress ?? 0}%</strong></div><div className="progress-line"><i style={{width:`${c.progress ?? 0}%`, background:c.color}} /></div></div><div className="course-card-foot"><span>课程数据来自 {supabaseConfigured ? 'Supabase' : '本地存储'}</span><span>{c.semester ?? '2026 秋季学期'}</span></div></div>)}</div>}</div> }

function MaterialsView({ materials, onToast, onUpload, onDelete, onReview }: { materials: Material[]; onToast:(s:string)=>void; onUpload:(file: File)=>Promise<void>; onDelete:(material: Material)=>Promise<void>; onReview:(material: Material)=>void }) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const statusLabel: Record<string, string> = { ready: '已完成', processing: '分析中', needs_review: '待确认', queued: '排队中', failed: '失败' }
  function chooseFile(file?: File) { if (file) void onUpload(file) }
  return <div className="page"><div className="page-head compact"><div><div className="eyebrow">知识库</div><h1>学习资料</h1><p className="subhead">上传课件，让 AI 帮你提炼重点并生成任务</p></div><button className="button primary" onClick={() => inputRef.current?.click()}><Upload size={17} />上传资料</button></div><input ref={inputRef} hidden type="file" accept=".pdf,.pptx,.docx,.jpg,.jpeg,.png" onChange={e => { chooseFile(e.target.files?.[0]); e.currentTarget.value = '' }} /><div className={`upload-zone ${drag ? 'dragging' : ''}`} onClick={() => inputRef.current?.click()} onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); chooseFile(e.dataTransfer.files?.[0]) }}><div className="upload-icon"><Upload size={22} /></div><h3>拖放文件到这里，或点击上传</h3><p>支持 PDF、PPTX、DOCX、JPG、PNG · 单个文件不超过 50MB</p><button className="text-btn" onClick={e => { e.stopPropagation(); inputRef.current?.click() }}>浏览文件 <ArrowRight size={15} /></button></div>{materials.length === 0 ? <EmptyState title="还没有学习资料" detail="上传课件后，资料会出现在这里并进入分析队列。" action="上传资料" onAction={() => inputRef.current?.click()} /> : <section className="panel material-panel"><div className="panel-head"><div><h2>最近资料</h2><span className="panel-caption">AI 分析状态</span></div><button className="text-btn">查看全部 <ArrowRight size={15} /></button></div><div className="material-list">{materials.map(material => { const ext = material.fileType.split('/').pop()?.toUpperCase() ?? 'FILE'; const statusClass = material.status === 'ready' ? 'ready' : material.status === 'failed' || material.status === 'needs_review' ? 'review' : 'processing'; return <div key={material.id}><div className={`file-icon ${statusClass}`}>{ext.slice(0, 4)}</div><div><strong>{material.fileName}</strong><span>{material.course ?? '未分类'} · {material.fileSize ? `${(material.fileSize / 1024 / 1024).toFixed(1)} MB` : '大小未知'}</span></div><span className={`analysis ${statusClass}`}>{material.status === 'ready' ? <Check size={14} /> : <RefreshCw size={14} />}{statusLabel[material.status] ?? material.status}</span><span className="row-actions">{material.status === 'needs_review' && material.analysisResult && <button className="text-btn" onClick={() => onReview(material)}>确认任务</button>}<button className="row-menu" title="删除资料" onClick={() => { if (window.confirm(`确定删除“${material.fileName}”吗？`)) void onDelete(material) }}><MoreHorizontal size={16} className="muted-icon" /></button></span></div> })}</div></section>}</div>
}

function EmptyState({ title, detail, action, onAction }: { title: string; detail: string; action?: string; onAction?: () => void }) { return <div className="empty-state"><div className="empty-icon"><FileText size={18} /></div><h3>{title}</h3><p>{detail}</p>{action && <button className="button secondary" onClick={onAction ?? (() => alert(`${action}功能将在下一步接入`))}><Plus size={15} />{action}</button>}</div> }

function AiDraftModal({ drafts, title = '确认任务草稿', onClose, onConfirm }: { drafts: TaskDraft[]; title?: string; onClose:()=>void; onConfirm:(drafts: TaskDraft[])=>Promise<void> }) {
  const [items, setItems] = useState(drafts)
  const [busy, setBusy] = useState(false)
  async function confirm() { setBusy(true); try { await onConfirm(items) } finally { setBusy(false) } }
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="modal ai-draft-modal"><div className="modal-head"><div><span className="eyebrow">AI 分析结果</span><h2>{title}</h2></div><button className="icon-btn" onClick={onClose}><X size={18} /></button></div><p className="panel-caption">可先修改标题、课程、时长和截止时间，再保存到任务库。</p><div className="draft-list">{items.map((item, index) => <div className="draft-row" key={`${item.title}-${index}`}><input value={item.title} onChange={e => setItems(current => current.map((draft, i) => i === index ? { ...draft, title: e.target.value } : draft))} /><input value={item.course} onChange={e => setItems(current => current.map((draft, i) => i === index ? { ...draft, course: e.target.value } : draft))} /><input type="number" min="5" max="1440" value={item.estimated_minutes} onChange={e => setItems(current => current.map((draft, i) => i === index ? { ...draft, estimated_minutes: Number(e.target.value) } : draft))} /><input type="datetime-local" value={item.deadline ? item.deadline.slice(0, 16) : ''} onChange={e => setItems(current => current.map((draft, i) => i === index ? { ...draft, deadline: e.target.value ? new Date(e.target.value).toISOString() : null } : draft))} /><button className="icon-btn" title="移除草稿" onClick={() => setItems(current => current.filter((_, i) => i !== index))}><X size={15} /></button></div>)}</div><div className="modal-footer"><button className="button secondary" onClick={onClose}>取消</button><button className="button primary" disabled={busy || items.length === 0} onClick={() => void confirm()}><Check size={16} />{busy ? '保存中...' : `确认 ${items.length} 个任务`}</button></div></div></div>
}

function ReviewView({ tasks, studyLogs }: {tasks:Task[]; studyLogs: StudyLog[]}) {
  const done = tasks.filter(t=>t.status==='done').length
  const weekAgo = Date.now() - 7 * 86400000
  const recentLogs = studyLogs.filter(log => log.completedAt && new Date(log.completedAt).getTime() >= weekAgo)
  const totalMinutes = recentLogs.reduce((sum, log) => sum + (log.actualMinutes ?? 0), 0)
  const maxDaily = Math.max(1, ...Array.from({ length: 7 }, (_, index) => recentLogs.filter(log => log.completedAt && new Date(log.completedAt).toDateString() === new Date(Date.now() - (6 - index) * 86400000).toDateString()).reduce((sum, log) => sum + (log.actualMinutes ?? 0), 0)))
  const completionRate = tasks.length ? Math.round((done / tasks.length) * 100) : 0
  return <div className="page"><div className="page-head compact"><div><div className="eyebrow">数据洞察</div><h1>学习复盘</h1><p className="subhead">看见投入，也看见自己的进步</p></div><button className="button secondary"><CalendarDays size={16} />本周</button></div><div className="review-grid"><div className="review-main panel"><div className="panel-head"><div><h2>学习时长</h2><span className="panel-caption">过去 7 天 · 共 {Math.floor(totalMinutes / 60)} 小时 {totalMinutes % 60} 分</span></div><span className="trend-chip">{recentLogs.length} 次记录</span></div><div className="bars">{['一','二','三','四','五','六','日'].map((d,i)=>{ const target = new Date(Date.now() - (6 - i) * 86400000).toDateString(); const minutes = recentLogs.filter(log => log.completedAt && new Date(log.completedAt).toDateString() === target).reduce((sum, log) => sum + (log.actualMinutes ?? 0), 0); return <div className="bar-col" key={d}><div className="bar" style={{height:`${Math.max(minutes ? 8 : 2, Math.round(minutes / maxDaily * 100))}%`}} /><span>{d}</span></div>})}</div></div><div className="review-side panel"><div className="panel-head"><div><h2>任务完成</h2><span className="panel-caption">当前任务库</span></div><BarChart3 size={17} /></div><div className="big-number">{done}<small> / {tasks.length} 项</small></div><div className="progress-line"><i style={{width:`${completionRate}%`}} /></div><p>{completionRate >= 70 ? '完成率保持良好' : '完成更多任务后，这里会显示趋势'}</p><div className="efficiency"><span>平均单次专注</span><strong>{recentLogs.length ? Math.round(totalMinutes / recentLogs.length) : 0} <small>分钟</small></strong></div></div></div><div className="panel heatmap-panel"><StudyHeatmap logs={studyLogs} /></div></div>
}

function SettingsView({ windowOpacity, onWindowOpacityChange, visualStyle, onVisualStyleChange, profile, availability, fixedEvents, preferences, deepSeekKey, hasSavedDeepSeekKey, onDeepSeekKeyChange, onSaveDeepSeekKey, onDeleteDeepSeekKey, onSavePreferences, onSaveProfile, onImportSchedule, onAddAvailability, onUpdateAvailability, onDeleteAvailability, onAddFixedEvent, onUpdateFixedEvent, onDeleteFixedEvent, onAuthChange }: { windowOpacity: number; onWindowOpacityChange: (value: number) => void; visualStyle: 'style-1' | 'style-2' | 'style-3' | 'style-4'; onVisualStyleChange:(value: 'style-1' | 'style-2' | 'style-3' | 'style-4')=>void; profile: UserProfile; availability: AvailabilityRule[]; fixedEvents: FixedEvent[]; preferences: UserPreferences; deepSeekKey: string; hasSavedDeepSeekKey: boolean; onDeepSeekKeyChange:(value:string)=>void; onSaveDeepSeekKey:()=>Promise<void>; onDeleteDeepSeekKey:()=>Promise<void>; onSavePreferences:(input: UserPreferences)=>Promise<void>; onSaveProfile:(input: UserProfile)=>Promise<void>; onImportSchedule:()=>void; onAddAvailability:(input:{weekday:number;startTime:string;endTime:string})=>Promise<void>; onUpdateAvailability:(id:string,input:{weekday:number;startTime:string;endTime:string})=>Promise<void>; onDeleteAvailability:(id:string)=>Promise<void>; onAddFixedEvent:(input:{title:string;startTime:string;endTime:string;recurrenceRule?:string})=>Promise<void>; onUpdateFixedEvent:(id:string,input:{title:string;startTime:string;endTime:string;recurrenceRule?:string})=>Promise<void>; onDeleteFixedEvent:(id:string)=>Promise<void>; onAuthChange:()=>Promise<void> }) {
  const [tab, setTab] = useState<'preferences'|'fixed'>('preferences')
  const [weekday, setWeekday] = useState(0)
  const [startTime, setStartTime] = useState('18:00')
  const [endTime, setEndTime] = useState('22:00')
  const [editingAvailability, setEditingAvailability] = useState<string | null>(null)
  const [eventTitle, setEventTitle] = useState('')
  const [eventStart, setEventStart] = useState('')
  const [eventEnd, setEventEnd] = useState('')
  const [editingEvent, setEditingEvent] = useState<string | null>(null)
  const [blockMinutes, setBlockMinutes] = useState<UserPreferences['defaultBlockMinutes']>(preferences.defaultBlockMinutes)
  const [bufferPercent, setBufferPercent] = useState(Math.round(preferences.bufferRatio * 100))
  const [autoLog, setAutoLog] = useState(preferences.autoLog)
  const [breakMinutes, setBreakMinutes] = useState<UserPreferences['breakMinutes']>(preferences.breakMinutes)
  const [minBlockMinutes, setMinBlockMinutes] = useState<UserPreferences['minBlockMinutes']>(preferences.minBlockMinutes)
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? '')
  useEffect(() => { setBlockMinutes(preferences.defaultBlockMinutes); setBufferPercent(Math.round(preferences.bufferRatio * 100)); setAutoLog(preferences.autoLog); setBreakMinutes(preferences.breakMinutes); setMinBlockMinutes(preferences.minBlockMinutes) }, [preferences])
  useEffect(() => { setDisplayName(profile.displayName); setAvatarUrl(profile.avatarUrl ?? '') }, [profile])
  const dayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  function resetAvailability() { setEditingAvailability(null); setWeekday(0); setStartTime('18:00'); setEndTime('22:00') }
  function resetEvent() { setEditingEvent(null); setEventTitle(''); setEventStart(''); setEventEnd('') }
  async function saveAvailability() { if (editingAvailability) await onUpdateAvailability(editingAvailability, { weekday, startTime, endTime }); else await onAddAvailability({ weekday, startTime, endTime }); resetAvailability() }
  async function saveEvent() { if (!eventTitle || !eventStart || !eventEnd) return; const input = { title: eventTitle, startTime: new Date(eventStart).toISOString(), endTime: new Date(eventEnd).toISOString() }; if (editingEvent) await onUpdateFixedEvent(editingEvent, input); else await onAddFixedEvent(input); resetEvent() }
  async function saveSettings() { await Promise.all([onSavePreferences({ ...preferences, defaultBlockMinutes: blockMinutes, bufferRatio: bufferPercent / 100, autoLog, breakMinutes, minBlockMinutes }), onSaveProfile({ displayName, avatarUrl }), deepSeekKey.trim() ? onSaveDeepSeekKey() : Promise.resolve()]) }
  return <div className="page"><div className="page-head compact"><div><div className="eyebrow">偏好设置</div><h1>设置</h1><p className="subhead">让行更贴合你的学习节奏</p></div><button className="button primary" onClick={() => void saveSettings()}><Check size={16} />保存设置</button></div><div className="settings-layout"><div className="settings-nav"><button className={tab === 'preferences' ? 'selected' : ''} onClick={() => setTab('preferences')}>学习偏好</button>
          <div className="opacity-control">
            <label htmlFor="window-opacity">窗口不透明度</label>
            <output htmlFor="window-opacity">{Math.round(windowOpacity)}%</output>
            <input id="window-opacity" type="range" min="0" max="100" step="any" value={windowOpacity} aria-valuetext={`${Math.round(windowOpacity)}%`} onChange={event => onWindowOpacityChange(Number(event.target.value))} />
            <div className="opacity-scale"><span>0%</span><span>100%</span></div>
          </div>
          <button className={tab === 'fixed' ? 'selected' : ''} onClick={() => setTab('fixed')}>固定课程</button><button onClick={onImportSchedule}>智能导入课表</button><button disabled>通知提醒</button><button disabled>AI 与隐私</button></div><div className="settings-stack">{tab === 'preferences' ? <><section className="panel settings-panel"><h2>视觉风格</h2><p className="panel-caption">当前风格已保存为风格 1，可随时切换。</p><div className="segmented"><button className={visualStyle === 'style-1' ? 'selected' : ''} onClick={() => onVisualStyleChange('style-1')}>风格 1</button><button className={visualStyle === 'style-2' ? 'selected' : ''} onClick={() => onVisualStyleChange('style-2')}>风格 2（待设计）</button><button className={visualStyle === 'style-3' ? 'selected' : ''} onClick={() => onVisualStyleChange('style-3')}>风格 3（待设计）</button></div></section><section className="panel settings-panel"><h2>学习偏好</h2><p className="panel-caption">排程算法会根据这些设置安排每日计划</p><label>每天可学习时间 <span>工作日</span><div className="setting-row"><input value={`${Math.floor(availability.filter(rule => rule.weekday > 0 && rule.weekday < 6).reduce((sum, rule) => sum + (Number(rule.endTime.slice(0, 2)) * 60 + Number(rule.endTime.slice(3, 5)) - Number(rule.startTime.slice(0, 2)) * 60 - Number(rule.startTime.slice(3, 5))), 0) / 60)} 小时`} readOnly /><span>已设置的不可用时间</span></div></label><label>默认学习块长度 <span>建议 25 - 90 分钟</span><div className="segmented">{([25, 50, 90] as const).map(value => <button key={value} className={blockMinutes === value ? 'selected' : ''} onClick={() => setBlockMinutes(value)}>{value} 分钟</button>)}</div></label><label>每日缓冲比例 <span>为意外情况预留时间</span><div className="range-row"><input type="range" min="0" max="30" value={bufferPercent} onChange={e => setBufferPercent(Number(e.target.value))} /><strong>{bufferPercent}%</strong></div></label><label className="switch-label">完成任务后自动记录学习时长 <button className={`switch ${autoLog ? 'on' : ''}`} onClick={() => setAutoLog(value => !value)}><i /></button></label></section><section className="panel settings-panel"><div className="panel-head"><div><h2>不可用时间</h2><span className="panel-caption">为排程器提供可学习的时间窗口</span></div></div><div className="inline-form"><select value={weekday} onChange={e => setWeekday(Number(e.target.value))}>{dayLabels.map((label, index) => <option value={index} key={label}>{label}</option>)}</select><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} /><span>至</span><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} /><button className="button primary" onClick={() => void saveAvailability()}>{editingAvailability ? '保存修改' : '添加'}</button>{editingAvailability && <button className="button secondary" onClick={resetAvailability}>取消</button>}</div><div className="settings-list">{availability.length === 0 ? <p className="panel-caption">还没有不可用时间，请先添加一个时间窗口。</p> : availability.map(item => <div className="settings-list-row" key={item.id}><span>{dayLabels[item.weekday]} · {item.startTime} - {item.endTime}</span><span><button className="text-btn" onClick={() => { setEditingAvailability(item.id); setWeekday(item.weekday); setStartTime(item.startTime); setEndTime(item.endTime) }}>编辑</button><button className="text-btn danger" onClick={() => void onDeleteAvailability(item.id)}>删除</button></span></div>)}</div></section><section className="panel settings-panel ai-key-panel"><div className="panel-head"><div><h2>DeepSeek API Key</h2><span className="panel-caption">加密保存到当前账户云端，发送时由 Vercel 服务端代理，不会回显原文</span></div><Sparkles size={17} /></div><input type="password" autoComplete="off" placeholder="sk-..." value={deepSeekKey} onChange={e => onDeepSeekKeyChange(e.target.value)} /><p className="panel-caption">保存后刷新页面无需重新填写；每个用户仅能使用自己的 Key。</p></section><AuthPanel onAuthChange={onAuthChange} /></> : <section className="panel settings-panel"><div className="panel-head"><div><h2>固定课程</h2><span className="panel-caption">排程时会避开这些时间段</span></div></div><div className="fixed-form"><input placeholder="课程或活动名称" value={eventTitle} onChange={e => setEventTitle(e.target.value)} /><input type="datetime-local" value={eventStart} onChange={e => setEventStart(e.target.value)} /><span>至</span><input type="datetime-local" value={eventEnd} onChange={e => setEventEnd(e.target.value)} /><button className="button primary" disabled={!eventTitle || !eventStart || !eventEnd} onClick={() => void saveEvent()}>{editingEvent ? '保存修改' : '添加课程'}</button>{editingEvent && <button className="button secondary" onClick={resetEvent}>取消</button>}</div><div className="settings-list">{fixedEvents.length === 0 ? <p className="panel-caption">还没有固定课程。</p> : fixedEvents.map(item => <div className="settings-list-row" key={item.id}><span>{item.title} · {new Date(item.startTime).toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' })} - {new Date(item.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span><span><button className="text-btn" onClick={() => { setEditingEvent(item.id); setEventTitle(item.title); setEventStart(item.startTime.slice(0, 16)); setEventEnd(item.endTime.slice(0, 16)) }}>编辑</button><button className="text-btn danger" onClick={() => void onDeleteFixedEvent(item.id)}>删除</button></span></div>)}</div></section>}</div></div></div>
}

function AuthPanel({ onAuthChange }: { onAuthChange:()=>Promise<void> }) { const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [currentEmail, setCurrentEmail] = useState<string | null>(null); const [mode, setMode] = useState<'sign-in'|'sign-up'>('sign-in'); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); useEffect(() => { getCurrentUserEmail().then(setCurrentEmail).catch(() => setCurrentEmail(null)) }, []); async function submit() { setBusy(true); setMessage(''); try { const result = mode === 'sign-in' ? null : await signUp(email, password); if (mode === 'sign-in') await signIn(email, password); const signedInEmail = await getCurrentUserEmail(); setCurrentEmail(signedInEmail); setMessage(result?.needsConfirmation ? '注册成功，请先完成邮箱确认，再回来登录。' : mode === 'sign-up' ? '注册成功，数据空间已准备好。' : '登录成功'); await onAuthChange() } catch (error) { setMessage(error instanceof Error ? error.message : '认证失败，请重试') } finally { setBusy(false) } } async function logout() { setBusy(true); try { await signOut(); setCurrentEmail(null); setMessage('已退出云端账户'); await onAuthChange() } catch (error) { setMessage(error instanceof Error ? error.message : '退出失败') } finally { setBusy(false) } } return <section className="panel auth-panel"><div className="panel-head"><div><h2>云端数据账户</h2><span className="panel-caption">{supabaseConfigured ? '使用 Supabase Auth 保护你的学习数据' : '配置 Supabase 后可开启跨设备同步'}</span></div><span className={`auth-state ${currentEmail ? 'signed' : ''}`}>{currentEmail ? '已登录' : '未登录'}</span></div>{currentEmail ? <div className="auth-logged"><strong>{currentEmail}</strong><button className="button secondary" disabled={busy} onClick={logout}>退出登录</button></div> : <><div className="auth-tabs"><button className={mode === 'sign-in' ? 'selected' : ''} onClick={() => setMode('sign-in')}>登录</button><button className={mode === 'sign-up' ? 'selected' : ''} onClick={() => setMode('sign-up')}>注册</button></div><div className="auth-form"><input type="email" placeholder="邮箱地址" value={email} onChange={e=>setEmail(e.target.value)} /><input type="password" placeholder="密码（至少 6 位）" value={password} onChange={e=>setPassword(e.target.value)} /><button className="button primary" disabled={busy || !email || password.length < 6 || !supabaseConfigured} onClick={submit}>{busy ? '处理中...' : mode === 'sign-in' ? '登录并同步数据' : '注册账户'}</button></div></>}{message && <p className="auth-message">{message}</p>}</section> }

function AddTaskModal({ initial, courses, onClose, onAdd, onUpdate }: { initial?: Task; courses: Course[]; onClose:()=>void; onAdd?: (title:string, minutes:number, course:string, strategy: ReplanStrategy, deadlineIso?: string | null, difficulty?: number, type?: string, completionMode?: TaskCompletionMode, spreadDays?: number, priority?: number, requireContinuous?: boolean)=>void; onUpdate?: (id:string, title:string, minutes:number, course:string, deadlineIso?: string | null, difficulty?: number, type?: string, completionMode?: TaskCompletionMode, spreadDays?: number, priority?: number, requireContinuous?: boolean)=>void }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [minutes, setMinutes] = useState(initial?.minutes ?? 30)
  const [course, setCourse] = useState(initial?.course === '未分类' ? '' : initial?.course ?? '')
  const [deadline, setDeadline] = useState(initial?.deadlineIso?.slice(0, 16) ?? '')
  const [difficulty, setDifficulty] = useState(initial?.difficulty === '较难' ? 4 : initial?.difficulty === '简单' ? 2 : 3)
  const [type, setType] = useState(initial?.type ?? '学习')
  const [strategy, setStrategy] = useState<ReplanStrategy>('minimal_change')
  const [completionMode, setCompletionMode] = useState<TaskCompletionMode>(initial?.completionMode ?? 'single_day')
  const [spreadDays, setSpreadDays] = useState(initial?.spreadDays ?? 2)
  const [priority, setPriority] = useState(initial?.priority ?? 70)
  const [requireContinuous, setRequireContinuous] = useState(initial?.requireContinuous ?? false)
  const editing = Boolean(initial)
  const savedCourse = course || '未分类'
  const save = () => editing
    ? onUpdate?.(initial!.id, title, minutes, savedCourse, deadline ? new Date(deadline).toISOString() : null, difficulty, type, completionMode, completionMode === 'spread_days' ? spreadDays : undefined, priority, requireContinuous)
    : onAdd?.(title, minutes, savedCourse, strategy, deadline ? new Date(deadline).toISOString() : null, difficulty, type, completionMode, completionMode === 'spread_days' ? spreadDays : undefined, priority, requireContinuous)
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><div className="modal"><div className="modal-head"><div><span className="eyebrow">{editing ? '编辑任务' : '快速添加'}</span><h2>{editing ? '修改任务' : '新建临时任务'}</h2></div><button className="icon-btn" onClick={onClose}><X size={18} /></button></div><label>任务名称<input autoFocus placeholder="例如：整理课堂笔记" value={title} onChange={event => setTitle(event.target.value)} /></label><div className="form-grid"><label>课程<span className="field-optional">可选</span><select className={!course ? 'is-placeholder' : ''} value={course} onChange={event => setCourse(event.target.value)}><option value="">暂不选择课程</option>{courses.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label><label>预计时长<select value={minutes} onChange={event => setMinutes(Number(event.target.value))}><option value="25">25 分钟</option><option value="30">30 分钟</option><option value="50">50 分钟</option><option value="90">90 分钟</option></select></label><label>截止时间<input type="datetime-local" value={deadline} onChange={event => setDeadline(event.target.value)} /></label><label>难度<select value={difficulty} onChange={event => setDifficulty(Number(event.target.value))}><option value="1">简单</option><option value="3">中等</option><option value="4">较难</option></select></label></div><label>任务类型<input value={type} onChange={event => setType(event.target.value)} placeholder="例如：作业、复习、背诵" /></label><label>优先级 <span>{priority}</span><input type="range" min="1" max="100" value={priority} onChange={event => setPriority(Number(event.target.value))} /></label><fieldset className="completion-mode"><legend>完成方式</legend><div className="segmented"><button type="button" className={completionMode === 'single_day' ? 'selected' : ''} onClick={() => setCompletionMode('single_day')}>一次性完成</button><button type="button" className={completionMode === 'spread_days' ? 'selected' : ''} onClick={() => setCompletionMode('spread_days')}>分摊到多日</button></div>{completionMode === 'single_day' && <label className="switch-label">必须连续完成 <button type="button" className={`switch ${requireContinuous ? 'on' : ''}`} onClick={() => setRequireContinuous(value => !value)}><i /></button><span>若没有足够连续空档，系统会提示冲突。</span></label>}{completionMode === 'spread_days' && <label className="spread-days">分几天完成<select value={spreadDays} onChange={event => setSpreadDays(Number(event.target.value))}>{[2, 3, 4, 5, 6, 7].map(days => <option value={days} key={days}>{days} 天</option>)}</select><span>自动排程会按每天的实际空闲容量分配到不同日期。</span></label>}</fieldset>{!editing && <label>加入计划方式<select value={strategy} onChange={event => setStrategy(event.target.value as ReplanStrategy)}><option value="preserve">保持原计划</option><option value="minimal_change">尽量少改动</option><option value="urgent">紧急插入</option></select></label>}<div className="modal-footer"><button className="button secondary" onClick={onClose}>取消</button><button className="button primary" disabled={!title.trim()} onClick={save}>{editing ? <Check size={16} /> : <Plus size={16} />}{editing ? '保存修改' : '加入今日计划'}</button></div></div></div>
}

function ProfileModal({ profile, onClose, onSave }: { profile: UserProfile; onClose: () => void; onSave: (input: UserProfile) => Promise<void> }) {
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function save() { setSaving(true); setError(''); try { await onSave({ displayName, avatarUrl }) } catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败，请重试') } finally { setSaving(false) } }
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="modal profile-modal"><div className="modal-head"><div><span className="eyebrow">个人资料</span><h2>昵称与头像</h2></div><button className="icon-btn" onClick={onClose}><X size={18} /></button></div><div className="profile-preview"><Avatar profile={{ displayName, avatarUrl }} className="profile-preview-avatar" /><p>头像将显示在侧栏与顶部导航中</p></div><label>昵称<input autoFocus maxLength={32} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="例如：小林" /></label><label>头像图片链接<input type="url" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://example.com/avatar.jpg" /></label>{error && <p className="auth-message">{error}</p>}<div className="modal-footer"><button className="button secondary" onClick={onClose}>取消</button><button className="button primary" disabled={saving || !displayName.trim()} onClick={() => void save()}><Check size={16} />{saving ? '保存中...' : '保存资料'}</button></div></div></div>
}

function ScheduleImportModal({ result, onClose, onAnalyze, onAnalyzeText, onConfirm }: { result: ScheduleImportResult | null; onClose: () => void; onAnalyze: (file: File) => Promise<void>; onAnalyzeText: (content: string) => Promise<void>; onConfirm: (result: ScheduleImportResult) => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const dayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><div className="modal schedule-import-modal"><div className="modal-head"><div><span className="eyebrow">智能导入</span><h2>{result ? '确认课表结果' : '导入课程表'}</h2></div><button className="icon-btn" onClick={onClose}><X size={18} /></button></div>{!result ? <><p className="panel-caption">可以上传课表图片，也可以直接粘贴课表文字；解析结果确认后才会写入计划。</p><div className="schedule-import-actions"><button className="upload-zone schedule-upload" onClick={() => inputRef.current?.click()}><Upload size={22} /><strong>选择课表图片</strong><span>支持 JPG、PNG、WebP</span></button><div className="schedule-text-input"><textarea value={text} onChange={event => setText(event.target.value)} placeholder={'也可以粘贴文字，例如：\n周一 08:00-10:00 高等数学\n周三 14:00-16:00 信号与系统'} /><button className="button primary" disabled={text.trim().length < 10} onClick={() => void onAnalyzeText(text)}>解析课表文字</button></div></div><input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { const file = event.target.files?.[0]; event.currentTarget.value = ''; if (file) void onAnalyze(file) }} /></> : <><p className="panel-caption">请检查识别结果。确认后将写入固定课程和不可用时间。</p><div className="schedule-result-list"><strong>课程 {result.courses.length} 节</strong>{result.courses.map((course, index) => <div key={`${course.title}-${index}`}><span>{dayLabels[course.weekday]}</span><input value={course.title} onChange={() => undefined} readOnly /><span>{course.start_time} - {course.end_time}</span></div>)}<strong>不可用时间 {result.availability.length} 段</strong>{result.availability.map((rule, index) => <div key={`${rule.weekday}-${index}`}><span>{dayLabels[rule.weekday]}</span><span>{rule.start_time} - {rule.end_time}</span></div>)}</div>{result.notes && <p className="panel-caption">备注：{result.notes}</p>}<div className="modal-footer"><button className="button secondary" onClick={onClose}>取消</button><button className="button primary" onClick={() => void onConfirm(result)}><Check size={16} />确认并排程</button></div></>}</div></div>
}

function CourseModal({ initial, onClose, onAdd, onUpdate }: { initial?: Course; onClose:()=>void; onAdd?: (name:string, color:string)=>void; onUpdate?: (id:string, name:string, color:string)=>void }) { const [name, setName] = useState(initial?.name ?? ''); const [color, setColor] = useState(initial?.color ?? '#2673e8'); const editing = Boolean(initial); return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="modal"><div className="modal-head"><div><span className="eyebrow">学期空间</span><h2>{editing ? '修改课程' : '添加课程'}</h2></div><button className="icon-btn" onClick={onClose}><X size={18} /></button></div><label>课程名称<input autoFocus placeholder="例如：概率论" value={name} onChange={e=>setName(e.target.value)} /></label><label>课程颜色<div className="color-picker"><input type="color" value={color} onChange={e=>setColor(e.target.value)} /><span>{color}</span></div></label><div className="modal-footer"><button className="button secondary" onClick={onClose}>取消</button><button className="button primary" disabled={!name.trim()} onClick={()=>editing ? onUpdate?.(initial!.id, name, color) : onAdd?.(name, color)}>{editing ? <Check size={16} /> : <Plus size={16} />}{editing ? '保存修改' : '保存课程'}</button></div></div></div> }

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
