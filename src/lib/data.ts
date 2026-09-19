import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

export type TaskStatus = 'todo' | 'done'
export type TaskCompletionMode = 'smart' | 'single_day' | 'spread_days'
export type Task = {
  id: string
  title: string
  course: string
  courseId?: string
  color: string
  deadline: string
  deadlineIso?: string
  minutes: number
  priority: number
  difficulty: string
  status: TaskStatus
  type: string
  slot?: string
  note?: string
  source?: string
  completionMode?: TaskCompletionMode
  spreadDays?: number
  requireContinuous?: boolean
  completedMinutes?: number
}

export type Course = {
  id: string
  name: string
  code?: string
  color: string
  semester?: string
  description?: string
  progress?: number
}

export type WorkspaceData = {
  tasks: Task[]
  courses: Course[]
  availability: AvailabilityRule[]
  fixedEvents: FixedEvent[]
  scheduleItems: ScheduleItem[]
  materials: Material[]
  studyLogs: StudyLog[]
  preferences: UserPreferences
  profile: UserProfile
  source: 'supabase' | 'local'
  error?: string
}

export type AvailabilityRule = { id: string; weekday: number; startTime: string; endTime: string }
export type FixedEvent = { id: string; title: string; startTime: string; endTime: string; recurrenceRule?: string }
export type ScheduleItem = { id: string; taskId: string; startTime: string; endTime: string; locked: boolean; status: string }
export type MaterialTask = { title: string; estimated_minutes: number; difficulty: number; task_type: string }
export type MaterialAnalysis = { chapters: string[]; knowledge_points: string[]; tasks: MaterialTask[]; summary: string }
export type Material = { id: string; fileName: string; fileType: string; fileSize?: number; status: string; course?: string; createdAt: string; storagePath?: string; analysisResult?: MaterialAnalysis }
export type StudyLog = { id: string; taskId: string; plannedMinutes?: number; actualMinutes?: number; quality?: number; completedAt?: string }
export type UserPreferences = { defaultBlockMinutes: 25 | 50 | 90; bufferRatio: number; autoLog: boolean; breakMinutes: 5 | 10 | 15; minBlockMinutes: 15 | 20 | 25; peakStartHour: number; peakEndHour: number }
export type UserProfile = { displayName: string; avatarUrl?: string }

export type ScheduleInput = {
  reason?: string
  items: Array<{ taskId: string; startTime: string; endTime: string; locked?: boolean; status?: string }>
}

export type TaskDraft = {
  title: string
  course: string
  deadline?: string | null
  difficulty?: number
  estimated_minutes: number
  task_type?: string
  confidence?: number
  priority?: number
}

const taskInputSchema = z.object({
  title: z.string().trim().min(1, '任务名称不能为空'),
  course: z.string().trim().min(1, '请选择课程'),
  minutes: z.number().int().min(5).max(1440),
})

const taskCompletionSchema = z.object({
  completionMode: z.enum(['smart', 'single_day', 'spread_days']).optional(),
  spreadDays: z.number().int().min(2).max(7).optional(),
  requireContinuous: z.boolean().optional(),
  completedMinutes: z.number().int().min(0).optional(),
})

const courseColors = ['#2673e8', '#e47735', '#2a9b83', '#d84d78', '#8d68c3', '#b38a32']
export const defaultPreferences: UserPreferences = { defaultBlockMinutes: 50, bufferRatio: 0.15, autoLog: true, breakMinutes: 10, minBlockMinutes: 20, peakStartHour: 9, peakEndHour: 12 }
export const defaultUserProfile: UserProfile = { displayName: '学习者', avatarUrl: '' }

export const demoCourses: Course[] = [
  { id: 'course-data-structure', name: '数据结构', code: 'CS201', color: '#2673e8', progress: 68 },
  { id: 'course-os', name: '操作系统', code: 'CS301', color: '#e47735', progress: 42 },
  { id: 'course-linear-algebra', name: '线性代数', code: 'MATH102', color: '#2a9b83', progress: 81 },
  { id: 'course-english', name: '大学英语', code: 'ENG101', color: '#d84d78', progress: 55 },
]

export const demoTasks: Task[] = [
  { id: 'task-tree', title: '完成二叉树遍历习题', course: '数据结构', courseId: demoCourses[0].id, color: '#2673e8', deadline: '今天 18:00', minutes: 50, priority: 92, difficulty: '较难', status: 'todo', type: '作业', slot: '09:00', source: 'manual' },
  { id: 'task-process', title: '复习操作系统 · 进程调度', course: '操作系统', courseId: demoCourses[1].id, color: '#e47735', deadline: '明天 12:00', minutes: 60, priority: 84, difficulty: '中等', status: 'todo', type: '复习', slot: '10:10', source: 'manual' },
  { id: 'task-english', title: '英语四级高频词 1-3 组', course: '英语', courseId: demoCourses[3].id, color: '#d84d78', deadline: '今天 22:00', minutes: 30, priority: 61, difficulty: '简单', status: 'todo', type: '背诵', slot: '14:00', source: 'manual' },
  { id: 'task-eigen', title: '线性代数 · 特征值预习', course: '线性代数', courseId: demoCourses[2].id, color: '#2a9b83', deadline: '周三', minutes: 45, priority: 55, difficulty: '中等', status: 'done', type: '预习', slot: '15:00', source: 'manual' },
]

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
export const supabase: SupabaseClient | null = supabaseConfigured ? createClient(supabaseUrl!, supabaseAnonKey!) : null

export async function getCurrentUserEmail(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.email ?? null
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error('请先配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY')
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }> {
  if (!supabase) throw new Error('请先配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY')
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return { needsConfirmation: !data.session }
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

function localTasks(): Task[] {
  try {
    const raw = localStorage.getItem('study-tasks')
    const parsed = raw ? (JSON.parse(raw) as Task[]) : demoTasks
    return parsed.map(task => ({ ...task, id: String(task.id), courseId: task.courseId ? String(task.courseId) : undefined, completionMode: task.completionMode ?? 'smart' }))
  } catch { return demoTasks }
}

function localCourses(): Course[] {
  try {
    const raw = localStorage.getItem('study-courses')
    const parsed = raw ? (JSON.parse(raw) as Course[]) : demoCourses
    return parsed.map(course => ({ ...course, id: String(course.id) }))
  } catch { return demoCourses }
}

function localAvailability(): AvailabilityRule[] {
  try {
    const raw = localStorage.getItem('study-availability')
    return raw ? JSON.parse(raw) as AvailabilityRule[] : []
  } catch { return [] }
}

function localFixedEvents(): FixedEvent[] {
  try {
    const raw = localStorage.getItem('study-fixed-events')
    return raw ? JSON.parse(raw) as FixedEvent[] : []
  } catch { return [] }
}

function localScheduleItems(): ScheduleItem[] {
  try {
    const raw = localStorage.getItem('study-schedule-items')
    return raw ? JSON.parse(raw) as ScheduleItem[] : []
  } catch { return [] }
}

function localMaterials(): Material[] {
  try {
    const raw = localStorage.getItem('study-materials')
    return raw ? JSON.parse(raw) as Material[] : []
  } catch { return [] }
}

function localStudyLogs(): StudyLog[] {
  try {
    const raw = localStorage.getItem('study-logs')
    return raw ? JSON.parse(raw) as StudyLog[] : []
  } catch { return [] }
}

function localPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem('study-preferences')
    if (!raw) return defaultPreferences
    const parsed = JSON.parse(raw) as Partial<UserPreferences>
    const block = Number(parsed.defaultBlockMinutes)
    const buffer = Number(parsed.bufferRatio)
    return {
      defaultBlockMinutes: block === 25 || block === 90 ? block : 50,
      bufferRatio: Number.isFinite(buffer) ? Math.min(Math.max(buffer, 0), 0.3) : defaultPreferences.bufferRatio,
      autoLog: parsed.autoLog !== false,
      breakMinutes: parsed.breakMinutes === 5 || parsed.breakMinutes === 15 ? parsed.breakMinutes : 10,
      minBlockMinutes: parsed.minBlockMinutes === 15 || parsed.minBlockMinutes === 25 ? parsed.minBlockMinutes : 20,
      peakStartHour: Number.isInteger(parsed.peakStartHour) ? Math.min(Math.max(parsed.peakStartHour ?? 9, 0), 23) : 9,
      peakEndHour: Number.isInteger(parsed.peakEndHour) ? Math.min(Math.max(parsed.peakEndHour ?? 12, 1), 24) : 12,
    }
  } catch { return defaultPreferences }
}

async function accessToken(): Promise<string> {
  if (!supabase) throw new Error('请先配置 Supabase')
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) throw new Error('请先登录账户')
  return data.session.access_token
}

export async function apiRequestHeaders(): Promise<HeadersInit> {
  if (!supabase) throw new Error('请先配置 Supabase')
  const refreshed = await supabase.auth.refreshSession()
  const token = refreshed.data.session?.access_token ?? await accessToken()
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

export async function saveDeepSeekKey(value: string): Promise<void> {
  const response = await fetch('/api/deepseek-key', { method: 'POST', headers: await apiRequestHeaders(), body: JSON.stringify({ apiKey: value }) })
  const payload = await response.json() as { error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'API Key 保存失败')
}

export async function deleteDeepSeekKey(): Promise<void> {
  const response = await fetch('/api/deepseek-key', { method: 'DELETE', headers: await apiRequestHeaders() })
  const payload = await response.json() as { error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'API Key 删除失败')
}

function localUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem('study-user-profile')
    if (!raw) return defaultUserProfile
    const parsed = JSON.parse(raw) as Partial<UserProfile>
    const displayName = typeof parsed.displayName === 'string' ? parsed.displayName.trim().slice(0, 32) : ''
    return { displayName: displayName || defaultUserProfile.displayName, avatarUrl: typeof parsed.avatarUrl === 'string' ? parsed.avatarUrl.trim() : '' }
  } catch { return defaultUserProfile }
}

function localWorkspace(): WorkspaceData {
  return {
    tasks: localTasks(),
    courses: localCourses(),
    availability: localAvailability(),
    fixedEvents: localFixedEvents(),
    scheduleItems: localScheduleItems(),
    materials: localMaterials(),
    studyLogs: localStudyLogs(),
    preferences: localPreferences(),
    profile: localUserProfile(),
    source: 'local',
  }
}

function formatDeadline(value: string | null): string {
  if (!value) return '未设置'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const prefix = sameDay ? '今天' : date.toDateString() === tomorrow.toDateString() ? '明天' : `${date.getMonth() + 1}月${date.getDate()}日`
  return `${prefix} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function difficultyLabel(value: number | null): string {
  if (!value) return '未设置'
  return value >= 4 ? '较难' : value >= 3 ? '中等' : '简单'
}

function mapTask(row: Record<string, unknown>, courses: Course[], schedule: ScheduleItem[]): Task {
  const course = courses.find(c => c.id === row.course_id) ?? courses.find(c => c.name === row.course) ?? { id: '', name: '未分类', color: '#8793a1' }
  const scheduleItem = schedule.find(item => item.taskId === row.id)
  const completion = taskCompletionSchema.safeParse(row.evidence)
  const completionMode = completion.success ? completion.data.completionMode ?? 'smart' : 'smart'
  const spreadDays = completion.success && completionMode === 'spread_days' ? completion.data.spreadDays ?? 2 : undefined
  const requireContinuous = completion.success ? completion.data.requireContinuous : undefined
  const completedMinutes = completion.success ? completion.data.completedMinutes ?? 0 : 0
  return {
    id: String(row.id), title: String(row.title), course: course.name, courseId: course.id,
    color: course.color, deadline: formatDeadline(row.deadline as string | null), deadlineIso: row.deadline as string | undefined,
    minutes: Number(row.estimated_minutes ?? 30), priority: Number(row.priority ?? 0), difficulty: difficultyLabel(row.difficulty as number | null),
    status: row.status === 'completed' ? 'done' : row.status === 'done' ? 'done' : 'todo', type: String(row.task_type ?? '学习'), slot: scheduleItem?.startTime?.slice(11, 16), source: String(row.source ?? 'manual'), note: String(row.description ?? ''), completionMode, spreadDays, requireContinuous, completedMinutes,
  }
}

async function currentUserId(client: SupabaseClient): Promise<string | null> {
  const { data } = await client.auth.getUser()
  return data.user?.id ?? null
}

export async function loadWorkspace(): Promise<WorkspaceData> {
  if (!supabase) return localWorkspace()
  const userId = await currentUserId(supabase)
  if (!userId) return { ...localWorkspace(), error: 'Supabase 已配置，但当前没有登录用户，暂时使用本地数据。' }
  const [courseResult, taskResult, availabilityResult, fixedResult, scheduleResult, materialResult, logResult, preferencesResult, profileResult] = await Promise.all([
    supabase.from('courses').select('*').order('created_at'),
    supabase.from('tasks').select('*').order('deadline', { ascending: true, nullsFirst: false }),
    supabase.from('availability_rules').select('*').order('weekday'),
    supabase.from('fixed_events').select('*').order('start_time'),
    supabase.from('schedule_items').select('id,task_id,start_time,end_time,locked,status,schedules!inner(is_active)').eq('schedules.is_active', true),
    supabase.from('materials').select('id,file_name,file_type,file_size,status,storage_path,analysis_result,created_at,courses(name)').order('created_at', { ascending: false }),
    supabase.from('study_logs').select('id,task_id,planned_minutes,actual_minutes,quality,completed_at').order('completed_at', { ascending: false }),
    supabase.from('user_preferences').select('default_block_minutes,buffer_ratio,auto_log').maybeSingle(),
    supabase.from('user_profiles').select('display_name,avatar_url').maybeSingle(),
  ])
  const firstError = [courseResult, taskResult, availabilityResult, fixedResult, scheduleResult, materialResult, logResult].find(result => result.error)?.error
  if (firstError) return { ...localWorkspace(), error: `数据库读取失败：${firstError.message}` }
  const courses: Course[] = (courseResult.data ?? []).map(row => ({ id: row.id, name: row.name, code: row.code ?? undefined, color: row.color ?? courseColors[0], semester: row.semester ?? undefined, description: row.description ?? undefined }))
  const scheduleItems: ScheduleItem[] = (scheduleResult.data ?? []).map(row => ({ id: row.id, taskId: row.task_id, startTime: row.start_time, endTime: row.end_time, locked: Boolean(row.locked), status: row.status ?? 'planned' }))
  return {
    courses, tasks: (taskResult.data ?? []).map(row => mapTask(row, courses, scheduleItems)), source: 'supabase',
    availability: (availabilityResult.data ?? []).map(row => ({ id: row.id, weekday: row.weekday, startTime: row.start_time, endTime: row.end_time })),
    fixedEvents: (fixedResult.data ?? []).map(row => ({ id: row.id, title: row.title, startTime: row.start_time, endTime: row.end_time, recurrenceRule: row.recurrence_rule ?? undefined })),
    scheduleItems, materials: (materialResult.data ?? []).map(row => ({ id: row.id, fileName: row.file_name, fileType: row.file_type, fileSize: row.file_size ?? undefined, status: row.status, course: (row.courses as { name?: string } | null)?.name, storagePath: row.storage_path ?? undefined, analysisResult: row.analysis_result as MaterialAnalysis | undefined, createdAt: row.created_at })),
    studyLogs: (logResult.data ?? []).map(row => ({ id: row.id, taskId: row.task_id, plannedMinutes: row.planned_minutes ?? undefined, actualMinutes: row.actual_minutes ?? undefined, quality: row.quality ?? undefined, completedAt: row.completed_at ?? undefined })),
    preferences: preferencesResult.error ? defaultPreferences : {
      defaultBlockMinutes: Number(preferencesResult.data?.default_block_minutes) === 25 || Number(preferencesResult.data?.default_block_minutes) === 90 ? Number(preferencesResult.data?.default_block_minutes) as 25 | 90 : 50,
      bufferRatio: Math.min(Math.max(Number(preferencesResult.data?.buffer_ratio ?? defaultPreferences.bufferRatio), 0), 0.3),
      autoLog: preferencesResult.data?.auto_log !== false,
      breakMinutes: defaultPreferences.breakMinutes,
      minBlockMinutes: defaultPreferences.minBlockMinutes,
      peakStartHour: defaultPreferences.peakStartHour,
      peakEndHour: defaultPreferences.peakEndHour,
    },
    profile: profileResult.error ? defaultUserProfile : {
      displayName: profileResult.data?.display_name?.trim() || defaultUserProfile.displayName,
      avatarUrl: profileResult.data?.avatar_url ?? '',
    },
  }
}

export async function createTask(input: { title: string; minutes: number; course: string; deadlineIso?: string | null; difficulty?: number; priority?: number; type?: string; source?: 'manual' | 'weekly_input' | 'material' | 'temporary'; completionMode?: TaskCompletionMode; spreadDays?: number; requireContinuous?: boolean }): Promise<Task> {
  const parsed = taskInputSchema.parse(input)
  const completion = taskCompletionSchema.parse(input)
  const completionMode = completion.completionMode ?? 'smart'
  const spreadDays = completionMode === 'spread_days' ? completion.spreadDays ?? 2 : undefined
  const localCourse = localCourses().find(course => course.name === parsed.course)
  const requireContinuous = completion.requireContinuous ?? false
  const localTask: Task = { id: `local-${Date.now()}`, title: parsed.title, course: parsed.course, courseId: localCourse?.id, color: localCourse?.color ?? '#2673e8', deadline: formatDeadline(input.deadlineIso ?? null), deadlineIso: input.deadlineIso ?? undefined, minutes: parsed.minutes, priority: input.priority ?? 70, difficulty: difficultyLabel(input.difficulty ?? 3), status: 'todo', type: input.type ?? '临时任务', slot: input.source === 'weekly_input' ? undefined : '16:10', source: input.source ?? 'temporary', completionMode, spreadDays, requireContinuous, completedMinutes: 0 }
  if (!supabase || !(await currentUserId(supabase))) return localTask
  const courseResult = await supabase.from('courses').select('id,color').eq('name', parsed.course).maybeSingle()
  if (courseResult.error) throw courseResult.error
  const { data, error } = await supabase.from('tasks').insert({ title: parsed.title, estimated_minutes: parsed.minutes, course_id: courseResult.data?.id ?? null, deadline: input.deadlineIso ?? null, task_type: input.type ?? 'temporary', status: 'todo', source: input.source ?? 'temporary', priority: input.priority ?? 70, difficulty: input.difficulty ?? 3, evidence: { completionMode, spreadDays, requireContinuous, completedMinutes: 0 } }).select('*').single()
  if (error) throw error
  const course = courseResult.data ? [{ id: courseResult.data.id, name: parsed.course, color: courseResult.data.color ?? '#2673e8' }] : []
  return mapTask(data, course, [])
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
  if (!supabase || id.startsWith('local-') || !(await currentUserId(supabase))) return
  const { error } = await supabase.from('tasks').update({ status: status === 'done' ? 'completed' : 'todo', updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function updateTask(id: string, input: { title: string; minutes: number; course: string; deadlineIso?: string | null; difficulty?: number; priority?: number; type?: string; completionMode?: TaskCompletionMode; spreadDays?: number; requireContinuous?: boolean; completedMinutes?: number }): Promise<void> {
  const parsed = taskInputSchema.parse(input)
  const completion = taskCompletionSchema.parse(input)
  const completionMode = completion.completionMode ?? 'smart'
  const spreadDays = completionMode === 'spread_days' ? completion.spreadDays ?? 2 : undefined
  if (!supabase || id.startsWith('local-') || !(await currentUserId(supabase))) return
  const courseResult = await supabase.from('courses').select('id').eq('name', parsed.course).maybeSingle()
  if (courseResult.error) throw courseResult.error
  const { error } = await supabase.from('tasks').update({ title: parsed.title, estimated_minutes: parsed.minutes, course_id: courseResult.data?.id ?? null, deadline: input.deadlineIso ?? null, difficulty: input.difficulty ?? null, priority: input.priority ?? 70, task_type: input.type ?? 'study', evidence: { completionMode, spreadDays, requireContinuous: completion.requireContinuous ?? false, completedMinutes: completion.completedMinutes ?? 0 }, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function deleteTask(id: string): Promise<void> {
  if (!supabase || id.startsWith('local-') || !(await currentUserId(supabase))) return
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

export async function saveCourse(input: { name: string; color?: string }): Promise<Course> {
  const parsed = z.object({ name: z.string().trim().min(1), color: z.string().optional() }).parse(input)
  const localCourse: Course = { id: `local-course-${Date.now()}`, name: parsed.name, color: parsed.color ?? '#2673e8', progress: 0 }
  if (!supabase || !(await currentUserId(supabase))) return localCourse
  const { data, error } = await supabase.from('courses').insert({ name: parsed.name, color: parsed.color ?? '#2673e8' }).select('*').single()
  if (error) throw error
  return { id: data.id, name: data.name, code: data.code ?? undefined, color: data.color, semester: data.semester ?? undefined, description: data.description ?? undefined }
}

export async function deleteCourse(id: string): Promise<void> {
  if (!supabase || id.startsWith('local-') || !(await currentUserId(supabase))) return
  const { error } = await supabase.from('courses').delete().eq('id', id)
  if (error) throw error
}

export async function updateCourse(id: string, input: { name: string; color?: string }): Promise<void> {
  const parsed = z.object({ name: z.string().trim().min(1), color: z.string().optional() }).parse(input)
  if (!supabase || id.startsWith('local-') || !(await currentUserId(supabase))) return
  const { error } = await supabase.from('courses').update({ name: parsed.name, color: parsed.color ?? '#2673e8' }).eq('id', id)
  if (error) throw error
}

export async function createAvailabilityRule(input: { weekday: number; startTime: string; endTime: string }): Promise<AvailabilityRule> {
  const parsed = z.object({ weekday: z.number().int().min(0).max(6), startTime: z.string().min(1), endTime: z.string().min(1) }).parse(input)
  if (parsed.startTime >= parsed.endTime) throw new Error('结束时间必须晚于开始时间')
  const local: AvailabilityRule = { id: `local-availability-${Date.now()}`, ...parsed }
  if (!supabase || !(await currentUserId(supabase))) return local
  const { data, error } = await supabase.from('availability_rules').insert({ weekday: parsed.weekday, start_time: parsed.startTime, end_time: parsed.endTime }).select('*').single()
  if (error) throw error
  return { id: data.id, weekday: data.weekday, startTime: data.start_time, endTime: data.end_time }
}

export async function updateAvailabilityRule(id: string, input: { weekday: number; startTime: string; endTime: string }): Promise<void> {
  const parsed = z.object({ weekday: z.number().int().min(0).max(6), startTime: z.string().min(1), endTime: z.string().min(1) }).parse(input)
  if (parsed.startTime >= parsed.endTime) throw new Error('结束时间必须晚于开始时间')
  if (!supabase || id.startsWith('local-') || !(await currentUserId(supabase))) return
  const { error } = await supabase.from('availability_rules').update({ weekday: parsed.weekday, start_time: parsed.startTime, end_time: parsed.endTime }).eq('id', id)
  if (error) throw error
}

export async function deleteAvailabilityRule(id: string): Promise<void> {
  if (!supabase || id.startsWith('local-') || !(await currentUserId(supabase))) return
  const { error } = await supabase.from('availability_rules').delete().eq('id', id)
  if (error) throw error
}

export async function createFixedEvent(input: { title: string; startTime: string; endTime: string; recurrenceRule?: string }): Promise<FixedEvent> {
  const parsed = z.object({ title: z.string().trim().min(1), startTime: z.string().min(1), endTime: z.string().min(1), recurrenceRule: z.string().optional() }).parse(input)
  if (new Date(parsed.startTime) >= new Date(parsed.endTime)) throw new Error('结束时间必须晚于开始时间')
  const local: FixedEvent = { id: `local-fixed-${Date.now()}`, ...parsed }
  if (!supabase || !(await currentUserId(supabase))) return local
  const { data, error } = await supabase.from('fixed_events').insert({ title: parsed.title, start_time: parsed.startTime, end_time: parsed.endTime, recurrence_rule: parsed.recurrenceRule ?? null }).select('*').single()
  if (error) throw error
  return { id: data.id, title: data.title, startTime: data.start_time, endTime: data.end_time, recurrenceRule: data.recurrence_rule ?? undefined }
}

export async function updateFixedEvent(id: string, input: { title: string; startTime: string; endTime: string; recurrenceRule?: string }): Promise<void> {
  const parsed = z.object({ title: z.string().trim().min(1), startTime: z.string().min(1), endTime: z.string().min(1), recurrenceRule: z.string().optional() }).parse(input)
  if (new Date(parsed.startTime) >= new Date(parsed.endTime)) throw new Error('结束时间必须晚于开始时间')
  if (!supabase || id.startsWith('local-') || !(await currentUserId(supabase))) return
  const { error } = await supabase.from('fixed_events').update({ title: parsed.title, start_time: parsed.startTime, end_time: parsed.endTime, recurrence_rule: parsed.recurrenceRule ?? null }).eq('id', id)
  if (error) throw error
}

export async function deleteFixedEvent(id: string): Promise<void> {
  if (!supabase || id.startsWith('local-') || !(await currentUserId(supabase))) return
  const { error } = await supabase.from('fixed_events').delete().eq('id', id)
  if (error) throw error
}

export async function createStudyLog(input: { taskId: string; plannedMinutes?: number; actualMinutes?: number; quality?: number; completedAt?: string }): Promise<StudyLog> {
  const parsed = z.object({ taskId: z.string().min(1), plannedMinutes: z.number().int().positive().optional(), actualMinutes: z.number().int().positive().optional(), quality: z.number().int().min(1).max(5).optional(), completedAt: z.string().optional() }).parse(input)
  const local: StudyLog = { id: `local-log-${Date.now()}`, ...parsed }
  if (!supabase || !(await currentUserId(supabase))) return local
  const { data, error } = await supabase.from('study_logs').insert({ task_id: parsed.taskId, planned_minutes: parsed.plannedMinutes ?? null, actual_minutes: parsed.actualMinutes ?? null, quality: parsed.quality ?? null, completed_at: parsed.completedAt ?? new Date().toISOString() }).select('*').single()
  if (error) throw error
  return { id: data.id, taskId: data.task_id, plannedMinutes: data.planned_minutes ?? undefined, actualMinutes: data.actual_minutes ?? undefined, quality: data.quality ?? undefined, completedAt: data.completed_at ?? undefined }
}

export async function saveSchedule(input: ScheduleInput): Promise<{ id: string; items: ScheduleItem[] }> {
  const parsed = z.object({ reason: z.string().optional(), items: z.array(z.object({ taskId: z.string().min(1), startTime: z.string().min(1), endTime: z.string().min(1), locked: z.boolean().optional(), status: z.string().optional() })) }).parse(input)
  if (!supabase || !(await currentUserId(supabase))) {
    const items = parsed.items.map((item, index) => ({ id: `local-schedule-item-${Date.now()}-${index}`, taskId: item.taskId, startTime: item.startTime, endTime: item.endTime, locked: item.locked ?? false, status: item.status ?? 'planned' }))
    return { id: `local-schedule-${Date.now()}`, items }
  }
  const { data: schedule, error: scheduleError } = await supabase.from('schedules').insert({ reason: parsed.reason ?? null, is_active: false }).select('id').single()
  if (scheduleError) throw scheduleError
  let rows: Array<{ id: string; task_id: string; start_time: string; end_time: string; locked: boolean; status: string }> = []
  if (parsed.items.length > 0) {
    const { data, error: itemError } = await supabase.from('schedule_items').insert(parsed.items.map(item => ({ schedule_id: schedule.id, task_id: item.taskId, start_time: item.startTime, end_time: item.endTime, locked: item.locked ?? false, status: item.status ?? 'planned' }))).select('*')
    if (itemError) throw itemError
    rows = data ?? []
  }
  const { error: previousError } = await supabase.from('schedules').update({ is_active: false }).eq('is_active', true).neq('id', schedule.id)
  if (previousError) throw previousError
  const { error: activateError } = await supabase.from('schedules').update({ is_active: true }).eq('id', schedule.id)
  if (activateError) throw activateError
  return { id: schedule.id, items: rows.map(row => ({ id: row.id, taskId: row.task_id, startTime: row.start_time, endTime: row.end_time, locked: Boolean(row.locked), status: row.status })) }
}

const allowedMaterialTypes = new Set(['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'])

export async function uploadMaterial(file: File, courseId?: string): Promise<Material> {
  if (file.size > 50 * 1024 * 1024) throw new Error('文件不能超过 50MB')
  if (!allowedMaterialTypes.has(file.type)) throw new Error('仅支持 PDF、PPTX、DOCX、JPG、PNG 文件')
  const local: Material = { id: `local-material-${Date.now()}`, fileName: file.name, fileType: file.type, fileSize: file.size, status: 'queued', createdAt: new Date().toISOString() }
  if (!supabase || !(await currentUserId(supabase))) return local
  const userId = await currentUserId(supabase)
  if (!userId) return local
  const storagePath = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const upload = await supabase.storage.from('materials').upload(storagePath, file, { upsert: false, contentType: file.type })
  if (upload.error) throw upload.error
  const { data, error } = await supabase.from('materials').insert({ course_id: courseId ?? null, file_name: file.name, file_type: file.type, file_size: file.size, storage_path: storagePath, status: 'queued' }).select('id,file_name,file_type,file_size,status,created_at,courses(name)').single()
  if (error) { await supabase.storage.from('materials').remove([storagePath]); throw error }
  return { id: data.id, fileName: data.file_name, fileType: data.file_type, fileSize: data.file_size ?? undefined, status: data.status, course: (data.courses as { name?: string } | null)?.name, createdAt: data.created_at }
}

export async function updateMaterialAnalysis(id: string, status: string, analysisResult?: unknown): Promise<void> {
  const parsedStatus = z.enum(['queued', 'processing', 'ready', 'needs_review', 'failed']).parse(status)
  if (!supabase || id.startsWith('local-') || !(await currentUserId(supabase))) return
  const { error } = await supabase.from('materials').update({ status: parsedStatus, analysis_result: analysisResult ?? null }).eq('id', id)
  if (error) throw error
}

export async function deleteMaterial(material: Material): Promise<void> {
  if (!supabase || material.id.startsWith('local-') || !(await currentUserId(supabase))) return
  if (material.storagePath) {
    const { error } = await supabase.storage.from('materials').remove([material.storagePath])
    if (error) throw error
  }
  const { error } = await supabase.from('materials').delete().eq('id', material.id)
  if (error) throw error
}

export async function savePreferences(input: UserPreferences): Promise<UserPreferences> {
  const parsed = z.object({
    defaultBlockMinutes: z.union([z.literal(25), z.literal(50), z.literal(90)]),
    bufferRatio: z.number().min(0).max(0.3),
    autoLog: z.boolean(),
    breakMinutes: z.union([z.literal(5), z.literal(10), z.literal(15)]),
    minBlockMinutes: z.union([z.literal(15), z.literal(20), z.literal(25)]),
    peakStartHour: z.number().int().min(0).max(23),
    peakEndHour: z.number().int().min(1).max(24),
  }).parse(input)
  if (!supabase || !(await currentUserId(supabase))) return parsed
  const { data, error } = await supabase.from('user_preferences').upsert({ default_block_minutes: parsed.defaultBlockMinutes, buffer_ratio: parsed.bufferRatio, auto_log: parsed.autoLog }, { onConflict: 'user_id' }).select('default_block_minutes,buffer_ratio,auto_log').single()
  if (error) throw error
  return { ...parsed, defaultBlockMinutes: data.default_block_minutes, bufferRatio: Number(data.buffer_ratio), autoLog: data.auto_log }
}

export async function saveUserProfile(input: UserProfile): Promise<UserProfile> {
  const parsed = z.object({
    displayName: z.string().trim().min(1, '昵称不能为空').max(32, '昵称不能超过 32 个字符'),
    avatarUrl: z.string().trim().url('请输入有效的头像图片链接').max(2048).or(z.literal('')),
  }).parse({ displayName: input.displayName.trim(), avatarUrl: input.avatarUrl?.trim() ?? '' })
  if (!supabase || !(await currentUserId(supabase))) {
    localStorage.setItem('study-user-profile', JSON.stringify(parsed))
    return parsed
  }
  const { data, error } = await supabase.from('user_profiles')
    .upsert({ display_name: parsed.displayName, avatar_url: parsed.avatarUrl || null, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select('display_name,avatar_url')
    .single()
  if (error) throw error
  return { displayName: data.display_name, avatarUrl: data.avatar_url ?? '' }
}

export async function saveWeeklyInput(input: { weekStart: string; rawText: string; courseId?: string; materialIds?: string[] }): Promise<void> {
  const parsed = z.object({ weekStart: z.string().min(1), rawText: z.string().trim().min(1).max(20000), courseId: z.string().optional(), materialIds: z.array(z.string()).optional() }).parse(input)
  if (!supabase || !(await currentUserId(supabase))) return
  const { error } = await supabase.from('weekly_inputs').insert({ week_start: parsed.weekStart, raw_text: parsed.rawText, course_id: parsed.courseId ?? null, material_ids: parsed.materialIds ?? [] })
  if (error) throw error
}

export function persistLocal(tasks: Task[], courses: Course[], extras?: Pick<WorkspaceData, 'availability' | 'fixedEvents' | 'scheduleItems' | 'materials' | 'studyLogs' | 'preferences'>) {
  localStorage.setItem('study-tasks', JSON.stringify(tasks))
  localStorage.setItem('study-courses', JSON.stringify(courses))
  if (extras) {
    localStorage.setItem('study-availability', JSON.stringify(extras.availability))
    localStorage.setItem('study-fixed-events', JSON.stringify(extras.fixedEvents))
    localStorage.setItem('study-schedule-items', JSON.stringify(extras.scheduleItems))
    localStorage.setItem('study-materials', JSON.stringify(extras.materials))
    localStorage.setItem('study-logs', JSON.stringify(extras.studyLogs))
    localStorage.setItem('study-preferences', JSON.stringify(extras.preferences))
  }
}
