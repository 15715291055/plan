import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

export type TaskStatus = 'todo' | 'done'
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
  source: 'supabase' | 'local'
  error?: string
}

export type AvailabilityRule = { id: string; weekday: number; startTime: string; endTime: string }
export type FixedEvent = { id: string; title: string; startTime: string; endTime: string; recurrenceRule?: string }
export type ScheduleItem = { id: string; taskId: string; startTime: string; endTime: string; locked: boolean; status: string }
export type Material = { id: string; fileName: string; fileType: string; fileSize?: number; status: string; course?: string; createdAt: string }
export type StudyLog = { id: string; taskId: string; plannedMinutes?: number; actualMinutes?: number; quality?: number; completedAt?: string }

const taskInputSchema = z.object({
  title: z.string().trim().min(1, '任务名称不能为空'),
  course: z.string().trim().min(1, '请选择课程'),
  minutes: z.number().int().min(5).max(1440),
})

const courseColors = ['#2673e8', '#e47735', '#2a9b83', '#d84d78', '#8d68c3', '#b38a32']

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
    return parsed.map(task => ({ ...task, id: String(task.id), courseId: task.courseId ? String(task.courseId) : undefined }))
  } catch { return demoTasks }
}

function localCourses(): Course[] {
  try {
    const raw = localStorage.getItem('study-courses')
    const parsed = raw ? (JSON.parse(raw) as Course[]) : demoCourses
    return parsed.map(course => ({ ...course, id: String(course.id) }))
  } catch { return demoCourses }
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
  return {
    id: String(row.id), title: String(row.title), course: course.name, courseId: course.id,
    color: course.color, deadline: formatDeadline(row.deadline as string | null), deadlineIso: row.deadline as string | undefined,
    minutes: Number(row.estimated_minutes ?? 30), priority: Number(row.priority ?? 0), difficulty: difficultyLabel(row.difficulty as number | null),
    status: row.status === 'completed' ? 'done' : row.status === 'done' ? 'done' : 'todo', type: String(row.task_type ?? '学习'), slot: scheduleItem?.startTime?.slice(11, 16), source: String(row.source ?? 'manual'), note: String(row.description ?? ''),
  }
}

async function currentUserId(client: SupabaseClient): Promise<string | null> {
  const { data } = await client.auth.getUser()
  return data.user?.id ?? null
}

export async function loadWorkspace(): Promise<WorkspaceData> {
  if (!supabase) return { tasks: localTasks(), courses: localCourses(), availability: [], fixedEvents: [], scheduleItems: [], materials: [], studyLogs: [], source: 'local' }
  const userId = await currentUserId(supabase)
  if (!userId) return { tasks: localTasks(), courses: localCourses(), availability: [], fixedEvents: [], scheduleItems: [], materials: [], studyLogs: [], source: 'local', error: 'Supabase 已配置，但当前没有登录用户，暂时使用本地数据。' }
  const [courseResult, taskResult, availabilityResult, fixedResult, scheduleResult, materialResult, logResult] = await Promise.all([
    supabase.from('courses').select('*').order('created_at'),
    supabase.from('tasks').select('*').order('deadline', { ascending: true, nullsFirst: false }),
    supabase.from('availability_rules').select('*').order('weekday'),
    supabase.from('fixed_events').select('*').order('start_time'),
    supabase.from('schedule_items').select('id,task_id,start_time,end_time,locked,status,schedules!inner(is_active)').eq('schedules.is_active', true),
    supabase.from('materials').select('id,file_name,file_type,file_size,status,created_at,courses(name)').order('created_at', { ascending: false }),
    supabase.from('study_logs').select('id,task_id,planned_minutes,actual_minutes,quality,completed_at').order('completed_at', { ascending: false }),
  ])
  const firstError = [courseResult, taskResult, availabilityResult, fixedResult, scheduleResult, materialResult, logResult].find(result => result.error)?.error
  if (firstError) return { tasks: localTasks(), courses: localCourses(), availability: [], fixedEvents: [], scheduleItems: [], materials: [], studyLogs: [], source: 'local', error: `数据库读取失败：${firstError.message}` }
  const courses: Course[] = (courseResult.data ?? []).map(row => ({ id: row.id, name: row.name, code: row.code ?? undefined, color: row.color ?? courseColors[0], semester: row.semester ?? undefined, description: row.description ?? undefined }))
  const scheduleItems: ScheduleItem[] = (scheduleResult.data ?? []).map(row => ({ id: row.id, taskId: row.task_id, startTime: row.start_time, endTime: row.end_time, locked: Boolean(row.locked), status: row.status ?? 'planned' }))
  return {
    courses, tasks: (taskResult.data ?? []).map(row => mapTask(row, courses, scheduleItems)), source: 'supabase',
    availability: (availabilityResult.data ?? []).map(row => ({ id: row.id, weekday: row.weekday, startTime: row.start_time, endTime: row.end_time })),
    fixedEvents: (fixedResult.data ?? []).map(row => ({ id: row.id, title: row.title, startTime: row.start_time, endTime: row.end_time, recurrenceRule: row.recurrence_rule ?? undefined })),
    scheduleItems, materials: (materialResult.data ?? []).map(row => ({ id: row.id, fileName: row.file_name, fileType: row.file_type, fileSize: row.file_size ?? undefined, status: row.status, course: (row.courses as { name?: string } | null)?.name, createdAt: row.created_at })),
    studyLogs: (logResult.data ?? []).map(row => ({ id: row.id, taskId: row.task_id, plannedMinutes: row.planned_minutes ?? undefined, actualMinutes: row.actual_minutes ?? undefined, quality: row.quality ?? undefined, completedAt: row.completed_at ?? undefined })),
  }
}

export async function createTask(input: { title: string; minutes: number; course: string }): Promise<Task> {
  const parsed = taskInputSchema.parse(input)
  const localTask: Task = { id: `local-${Date.now()}`, title: parsed.title, course: parsed.course, color: '#2673e8', deadline: '今天 22:00', minutes: parsed.minutes, priority: 70, difficulty: '中等', status: 'todo', type: '临时任务', slot: '16:10', source: 'temporary' }
  if (!supabase || !(await currentUserId(supabase))) return localTask
  const courseResult = await supabase.from('courses').select('id,color').eq('name', parsed.course).maybeSingle()
  if (courseResult.error) throw courseResult.error
  const { data, error } = await supabase.from('tasks').insert({ title: parsed.title, estimated_minutes: parsed.minutes, course_id: courseResult.data?.id ?? null, task_type: 'temporary', status: 'todo', source: 'temporary', priority: 70, difficulty: 3 }).select('*').single()
  if (error) throw error
  return mapTask(data, localCourses(), [])
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
  if (!supabase || id.startsWith('local-') || !(await currentUserId(supabase))) return
  const { error } = await supabase.from('tasks').update({ status: status === 'done' ? 'completed' : 'todo', updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function updateTask(id: string, input: { title: string; minutes: number; course: string }): Promise<void> {
  const parsed = taskInputSchema.parse(input)
  if (!supabase || id.startsWith('local-') || !(await currentUserId(supabase))) return
  const courseResult = await supabase.from('courses').select('id').eq('name', parsed.course).maybeSingle()
  if (courseResult.error) throw courseResult.error
  const { error } = await supabase.from('tasks').update({ title: parsed.title, estimated_minutes: parsed.minutes, course_id: courseResult.data?.id ?? null, updated_at: new Date().toISOString() }).eq('id', id)
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

export function persistLocal(tasks: Task[], courses: Course[]) {
  if (supabaseConfigured) return
  localStorage.setItem('study-tasks', JSON.stringify(tasks))
  localStorage.setItem('study-courses', JSON.stringify(courses))
}
