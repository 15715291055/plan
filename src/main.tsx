import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AnimatePresence, motion } from 'motion/react'
import {
  AlarmClock, ArrowRight, BarChart3, BookOpen, CalendarDays, Check,
  ChevronLeft, ChevronRight, CircleHelp, Clock3, FileText, Filter,
  Flame, LayoutDashboard, ListTodo, Menu, MoreHorizontal, Pause, Play,
  Plus, RefreshCw, Search, Settings, Sparkles, Timer, Upload, X, Zap, Pencil,
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
  type Material,
  type ScheduleItem,
  type StudyLog,
  type Task,
  getCurrentUserEmail,
  signIn,
  signUp,
  signOut,
} from './lib/data'
import { ShanHaiBackground, type ShanHaiState } from './components/ShanHaiBackground'
import './styles.css'

const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const navItems = [
  { id: 'today', label: '今日计划', icon: LayoutDashboard },
  { id: 'week', label: '每周计划', icon: CalendarDays },
  { id: 'tasks', label: '任务管理', icon: ListTodo },
  { id: 'courses', label: '我的课程', icon: BookOpen },
  { id: 'materials', label: '学习资料', icon: FileText },
]

function App() {
  const [active, setActive] = useState('today')
  const [tasks, setTasks] = useState<Task[]>(demoTasks)
  const [courses, setCourses] = useState<Course[]>(demoCourses)
  const [materials, setMaterials] = useState<Material[]>([])
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([])
  const [studyLogs, setStudyLogs] = useState<StudyLog[]>([])
  const [dataSource, setDataSource] = useState<'supabase' | 'local'>('local')
  const [loading, setLoading] = useState(true)
  const [dataError, setDataError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showCourseModal, setShowCourseModal] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [toast, setToast] = useState('')
  const [timerTask, setTimerTask] = useState<string | null>(null)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [replanning, setReplanning] = useState(false)

  async function refreshWorkspace() {
    setLoading(true)
    try {
      const workspace = await loadWorkspace()
      setTasks(workspace.tasks)
      setCourses(workspace.courses)
      setMaterials(workspace.materials)
      setScheduleItems(workspace.scheduleItems)
      setStudyLogs(workspace.studyLogs)
      setDataSource(workspace.source)
      setDataError(workspace.error ?? '')
    } catch (error) { setDataError(error instanceof Error ? error.message : '数据加载失败') }
    finally { setLoading(false) }
  }
  useEffect(() => { void refreshWorkspace() }, [])
  useEffect(() => { if (!loading && dataSource === 'local') persistLocal(tasks, courses) }, [tasks, courses, loading, dataSource])
  useEffect(() => {
    if (timerTask === null) return
    const interval = window.setInterval(() => setTimerSeconds(s => s + 1), 1000)
    return () => window.clearInterval(interval)
  }, [timerTask])
  useEffect(() => { if (toast) { const t = window.setTimeout(() => setToast(''), 2800); return () => window.clearTimeout(t) } }, [toast])

  const todayTasks = tasks.filter(t => t.slot)
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
  async function addTask(title: string, minutes: number, course: string) {
    try {
      const created = await createTaskRecord({ title, minutes, course })
      setTasks(current => [...current, { ...created, slot: created.slot ?? '16:10' }])
      setShowAdd(false); setToast(dataSource === 'supabase' ? '任务已保存到云端' : '临时任务已加入，计划已自动重排')
    } catch (error) { setToast(error instanceof Error ? `保存失败：${error.message}` : '保存失败，请重试') }
  }
  async function editTask(id: string, title: string, minutes: number, course: string) {
    const previous = tasks
    setTasks(current => current.map(task => task.id === id ? { ...task, title, minutes, course } : task))
    try { await updateTaskRecord(id, { title, minutes, course }); setEditingTask(null); setToast(dataSource === 'supabase' ? '任务已更新到云端' : '任务已更新') } catch (error) { setTasks(previous); setToast(error instanceof Error ? `保存失败：${error.message}` : '保存失败，请重试') }
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
  function startTimer(id: string) { setTimerTask(id); setTimerSeconds(0); setToast('专注计时已开始，保持节奏') }
  function stopTimer() { setTimerTask(null); setToast('本次学习已记录'); }
  async function runReplan(message: string) { setReplanning(true); await new Promise(resolve => window.setTimeout(resolve, 780)); setReplanning(false); setToast(message) }
  const timerLabel = `${String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:${String(timerSeconds % 60).padStart(2, '0')}`
  const backgroundState: ShanHaiState = active === 'review' || active === 'settings' || active === 'today' || active === 'week' || active === 'tasks' || active === 'courses' || active === 'materials' ? active : 'today'

  return <div className="app-shell">
    <ShanHaiBackground state={backgroundState} emphasis={toast.includes('临时任务') ? 'warm' : 'none'} />
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="brand"><span className="brand-mark"><Sparkles size={16} /></span><span>知行</span><span className="brand-sub">STUDY OS</span></div>
      <div className="profile"><div className="avatar">林</div><div><strong>林同学</strong><span>本科 · 计算机科学</span></div><MoreHorizontal size={17} className="muted-icon" /></div>
      <div className="nav-label">工作台</div>
      <nav>{navItems.map(item => { const Icon = item.icon; return <button key={item.id} className={`nav-item ${active === item.id ? 'active' : ''}`} onClick={() => { setActive(item.id); setMobileOpen(false) }}><Icon size={18} /><span>{item.label}</span>{item.id === 'today' && <span className="nav-badge">4</span>}</button> })}</nav>
      <div className="nav-label spaced">洞察</div>
      <button className={`nav-item ${active === 'review' ? 'active' : ''}`} onClick={() => { setActive('review'); setMobileOpen(false) }}><BarChart3 size={18} /><span>学习复盘</span></button>
      <div className="sidebar-bottom"><div className="streak"><div className="streak-icon"><Flame size={17} /></div><div><strong>连续学习 7 天</strong><span>本周比上周多 2 小时</span></div></div><button className="nav-item" onClick={() => { setActive('settings'); setMobileOpen(false) }}><Settings size={18} /><span>设置</span></button><div className="help"><CircleHelp size={16} />帮助与反馈 <span>⌘K</span></div></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><button className="mobile-menu" onClick={() => setMobileOpen(open => !open)}><Menu size={20} /></button><div className="breadcrumbs"><span>工作台</span><ChevronRight size={14} /><strong>{navItems.find(n => n.id === active)?.label || (active === 'review' ? '学习复盘' : '设置')}</strong></div><div className="top-actions"><span className={`data-mode ${dataSource}`} title={dataError || undefined}>{dataSource === 'supabase' ? '云端数据' : '本地数据'}{loading ? ' · 加载中' : ''}</span><div className="search"><Search size={16} /><input placeholder="搜索任务、课程..." /><kbd>⌘ K</kbd></div><button className="icon-btn"><AlarmClock size={18} /></button><div className="top-avatar">林</div></div></header>
      {dataError && <div className="data-banner"><CircleHelp size={15} />{dataError}<button onClick={() => setDataError('')}><X size={14} /></button></div>}
      <AnimatePresence mode="wait" initial={false}>
      {active === 'today' && <motion.div key="today" className="view-transition" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .22 }}><TodayView tasks={todayTasks} progress={progress} totalMinutes={totalMinutes} toggleTask={toggleTask} startTimer={startTimer} timerTask={timerTask} timerLabel={timerLabel} stopTimer={stopTimer} onAdd={() => setShowAdd(true)} replanning={replanning} onReplan={() => void runReplan('已根据你的空闲时间重新安排今日任务')} /></motion.div>}
      {active === 'week' && <motion.div key="week" className="view-transition" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .22 }}><WeekView tasks={tasks} scheduleItems={scheduleItems} onBack={() => setActive('today')} replanning={replanning} onReplan={() => void runReplan('本周计划已更新')} /></motion.div>}
      </AnimatePresence>
      {active === 'tasks' && <TasksView tasks={tasks} toggleTask={toggleTask} onAdd={() => setShowAdd(true)} onDelete={removeTask} onEdit={setEditingTask} />}
      {active === 'courses' && <CoursesView courses={courses} onAdd={() => setShowCourseModal(true)} onEdit={setEditingCourse} onDelete={removeCourse} />}
      {active === 'materials' && <MaterialsView materials={materials} onToast={setToast} />}
      {active === 'review' && <ReviewView tasks={tasks} />}
      {active === 'settings' && <SettingsView onAuthChange={refreshWorkspace} />}
    </main>
    {showAdd && <AddTaskModal onClose={() => setShowAdd(false)} onAdd={addTask} />}
    {editingTask && <AddTaskModal initial={editingTask} onClose={() => setEditingTask(null)} onUpdate={editTask} />}
    {showCourseModal && <CourseModal onClose={() => setShowCourseModal(false)} onAdd={addCourse} />}
    {editingCourse && <CourseModal initial={editingCourse} onClose={() => setEditingCourse(null)} onUpdate={editCourse} />}
    {toast && <div className="toast"><Check size={16} />{toast}</div>}
    {timerTask !== null && <div className="timer-dock"><div className="timer-pulse"><Timer size={17} /></div><div><span>正在专注</span><strong>{tasks.find(t => t.id === timerTask)?.title}</strong></div><b>{timerLabel}</b><button onClick={stopTimer}><Pause size={15} />结束</button></div>}
  </div>
}

function TodayView({ tasks, progress, totalMinutes, toggleTask, startTimer, timerTask, timerLabel, stopTimer, onAdd, replanning, onReplan }: { tasks: Task[]; progress: number; totalMinutes: number; toggleTask: (id:string)=>void; startTimer:(id:string)=>void; timerTask:string|null; timerLabel:string; stopTimer:()=>void; onAdd:()=>void; replanning:boolean; onReplan:()=>void }) {
  const done = tasks.filter(t => t.status === 'done').length
  return <div className="page"><div className="page-head"><div><div className="eyebrow">星期一 · 9 月 14 日</div><h1>早上好，林同学 <span className="wave">✦</span></h1><p className="subhead">今天也为重要的事留出专注时间。</p></div><div className="head-actions"><button className="button secondary" onClick={onReplan} disabled={replanning}><RefreshCw size={16} className={replanning ? 'spin' : ''} />{replanning ? '正在排程...' : '重新排程'}</button><button className="button primary" onClick={onAdd}><Plus size={17} />添加任务</button></div></div>
    <div className="stat-grid"><div className="stat-card accent"><div className="stat-top"><span>今日学习</span><Clock3 size={17} /></div><strong>{Math.floor(totalMinutes / 60)}<small>h</small> {totalMinutes % 60}<small>m</small></strong><div className="stat-meta"><span>计划总时长</span><span className="trend">+18%</span></div></div><div className="stat-card"><div className="stat-top"><span>完成进度</span><span className="mini-ring">{progress}%</span></div><strong>{done}<small> / </small>{tasks.length}<small> 项</small></strong><div className="progress-line"><i style={{ width: `${progress}%` }} /></div></div><div className="stat-card"><div className="stat-top"><span>今日可用时间</span><Zap size={17} /></div><strong>4<small>h</small> 20<small>m</small></strong><div className="stat-meta"><span>已安排 {Math.round(totalMinutes / 60 * 10) / 10}h</span><span className="neutral">余 2h 10m</span></div></div><div className="stat-card"><div className="stat-top"><span>计划负荷</span><span className="load-dot" /></div><strong className="load-value">适中</strong><div className="load-bar"><i style={{ width: '61%' }} /></div><div className="stat-meta"><span>比平均值低 12%</span></div></div></div>
    <div className="content-grid"><section className="panel task-panel"><div className="panel-head"><div><h2>今日任务</h2><span className="panel-caption">按优先级自动排序 · {tasks.length} 项</span></div><button className="text-btn">查看全部 <ArrowRight size={15} /></button></div><div className="task-list">{tasks.map(task => <TaskRow key={task.id} task={task} toggleTask={toggleTask} startTimer={startTimer} timerTask={timerTask} timerLabel={timerLabel} />)}</div><button className="add-row" onClick={onAdd}><Plus size={16} />添加临时任务</button></section><aside className="right-column"><section className="panel focus-panel"><div className="panel-head"><div><h2>现在最适合做什么</h2><span className="panel-caption">基于截止时间、难度和你的状态</span></div><Sparkles size={18} className="spark-icon" /></div><div className="recommend"><div className="recommend-tag">建议现在开始</div><h3>{tasks.find(t => t.status === 'todo')?.title || '今日任务已完成'}</h3><p>保持 50 分钟专注，完成后距离今日目标更近一步。</p><div className="recommend-footer"><span><Clock3 size={14} />50 分钟</span><button className="button primary small" onClick={() => { const t = tasks.find(t => t.status === 'todo'); if (t) startTimer(t.id) }}><Play size={14} fill="currentColor" />开始专注</button></div></div></section><section className="panel deadline-panel"><div className="panel-head"><div><h2>即将截止</h2><span className="panel-caption">未来 7 天</span></div><button className="icon-btn small-icon"><MoreHorizontal size={17} /></button></div><div className="deadline-list"><div><span className="date-pill today-pill">今天</span><div><strong>数据结构作业</strong><span>二叉树遍历 · 18:00 截止</span></div><b className="urgent">紧急</b></div><div><span className="date-pill">明天</span><div><strong>操作系统小测</strong><span>进程调度 · 12:00 截止</span></div><b>2 天</b></div><div><span className="date-pill">周五</span><div><strong>英语四级模拟</strong><span>提交阅读与听力部分</span></div><b>5 天</b></div></div></section></aside></div>
  </div>
}

function TaskRow({ task, toggleTask, startTimer, timerTask, timerLabel }: { task: Task; toggleTask:(id:string)=>void; startTimer:(id:string)=>void; timerTask:string|null; timerLabel:string }) { return <motion.div layout className={`task-row ${task.status === 'done' ? 'completed' : ''}`} initial={{ opacity: 0, y: 5 }} animate={{ opacity: task.status === 'done' ? .52 : 1, y: 0 }} transition={{ duration: .22 }} whileHover={{ x: 2 }}><button className={`check-box ${task.status === 'done' ? 'checked' : ''}`} onClick={() => toggleTask(task.id)}>{task.status === 'done' && <Check size={14} />}</button><span className="task-time">{task.slot}</span><span className="course-dot" style={{ background: task.color }} /><div className="task-main"><strong>{task.title}</strong><span>{task.course} <em>·</em> {task.type}</span></div><div className="task-details"><span className={`priority p${task.priority > 80 ? 'high' : task.priority > 65 ? 'mid' : 'low'}`}>{task.priority}</span><span className="duration"><Clock3 size={13} />{task.minutes}m</span></div>{task.status === 'todo' && <button className="row-play" onClick={() => startTimer(task.id)}>{timerTask === task.id ? timerLabel : <Play size={14} fill="currentColor" />}</button>}</motion.div> }

function WeekView({ tasks, scheduleItems, onBack, replanning, onReplan }: { tasks:Task[]; scheduleItems: ScheduleItem[]; onBack:()=>void; replanning:boolean; onReplan:()=>void }) { const [weekOffset, setWeekOffset] = useState(0); const blocks = useMemo(() => {
  if (scheduleItems.length) return scheduleItems.map(item => { const task = tasks.find(t => t.id === item.taskId); const date = new Date(item.startTime); return { day: (date.getDay() + 6) % 7, start: date.getHours() + date.getMinutes() / 60, duration: Math.max((new Date(item.endTime).getTime() - date.getTime()) / 3600000, .4), title: task?.title ?? '学习任务', course: task?.course ?? '未分类', color: task?.color ?? '#8793a1' } })
  return [{ day: 0, start: 9, duration: 1.1, title: '二叉树遍历习题', course: '数据结构', color: '#2673e8' }, { day: 0, start: 14, duration: 1, title: '英语四级高频词', course: '英语', color: '#d84d78' }, { day: 1, start: 10, duration: 1.2, title: '进程调度复习', course: '操作系统', color: '#e47735' }, { day: 2, start: 15, duration: 1.5, title: '特征值与特征向量', course: '线性代数', color: '#2a9b83' }, { day: 3, start: 9.5, duration: 1.3, title: '数据结构章节测验', course: '数据结构', color: '#2673e8' }, { day: 4, start: 14, duration: 1, title: '英语模拟练习', course: '英语', color: '#d84d78' }]
}, [scheduleItems, tasks]); return <div className="page"><div className="page-head compact"><div><div className="eyebrow">计划视图</div><h1>每周计划</h1><p className="subhead">9 月 14 日 — 9 月 20 日 · 共 12 小时 40 分</p></div><div className="head-actions"><button className="button secondary" onClick={onReplan} disabled={replanning}><RefreshCw size={16} className={replanning ? 'spin' : ''} />{replanning ? '正在生成...' : '重新生成'}</button><button className="button primary" onClick={() => alert('拖动任务块即可调整时间')}><Plus size={17} />添加时间块</button></div></div><div className="calendar-toolbar"><button className="icon-btn" onClick={() => setWeekOffset(w => w - 1)}><ChevronLeft size={17} /></button><button className="button secondary date-button">{weekOffset === 0 ? '本周 · 9月14日' : `第 ${Math.abs(weekOffset)} 周前`}</button><button className="icon-btn" onClick={() => setWeekOffset(w => w + 1)}><ChevronRight size={17} /></button><div className="toolbar-spacer" /><span className="legend"><i className="legend-dot blue" />学习任务 <i className="legend-dot gray" />固定课程</span><button className="text-btn" onClick={onBack}>返回今日</button></div><div className="week-calendar"><div className="time-axis"><span />{[8,9,10,11,12,13,14,15,16,17,18,19].map(h => <span key={h}>{h}:00</span>)}</div><div className="day-columns">{weekDays.map((day, di) => <div className={`day-column ${di === 0 ? 'is-today' : ''}`} key={day}><div className="day-head"><span>{day}</span><b>{14 + di}</b></div><div className="day-body">{[8,9,10,11,12,13,14,15,16,17,18,19].map(h => <div className="hour-line" key={h} />)}{blocks.filter(b => b.day === di).map((b, i) => <motion.div layout key={i} className="calendar-block" style={{ top: `${(b.start - 8) * 50}px`, height: `${b.duration * 50}px`, borderLeftColor: b.color }}><strong>{b.title}</strong><span>{b.course}</span></motion.div>)}{di === 0 && <div className="fixed-block" style={{ top: '200px', height: '50px' }}>午休时间</div>}</div></div>)}</div></div></div> }

function TasksView({ tasks, toggleTask, onAdd, onDelete, onEdit }: { tasks:Task[]; toggleTask:(id:string)=>void; onAdd:()=>void; onDelete:(id:string)=>void; onEdit:(task: Task)=>void }) { const [query, setQuery] = useState(''); const filtered = tasks.filter(t => t.title.includes(query) || t.course.includes(query)); return <div className="page"><div className="page-head compact"><div><div className="eyebrow">工作台</div><h1>任务管理</h1><p className="subhead">集中管理所有课程任务与截止日期</p></div><button className="button primary" onClick={onAdd}><Plus size={17} />新建任务</button></div><div className="filter-bar"><div className="search in-page"><Search size={16} /><input placeholder="搜索任务..." value={query} onChange={e => setQuery(e.target.value)} /></div><button className="filter-btn"><Filter size={15} />课程 <ChevronRight size={14} /></button><button className="filter-btn">截止日期 <ChevronRight size={14} /></button><button className="filter-btn">状态 <ChevronRight size={14} /></button></div><section className="panel table-panel"><div className="table-head"><span>任务名称</span><span>课程</span><span>截止日期</span><span>优先级</span><span>预计时长</span><span>状态</span><span /></div>{filtered.map(t => <div className="table-row" key={t.id}><div className="table-title"><button className={`check-box ${t.status === 'done' ? 'checked' : ''}`} onClick={() => toggleTask(t.id)}>{t.status === 'done' && <Check size={14} />}</button><strong>{t.title}</strong></div><span><i className="course-dot" style={{ background:t.color }} />{t.course}</span><span>{t.deadline}</span><span className={`priority p${t.priority > 80 ? 'high' : t.priority > 65 ? 'mid' : 'low'}`}>{t.priority} <small>/ 100</small></span><span>{t.minutes} 分钟</span><span className={`status-tag ${t.status}`}>{t.status === 'done' ? '已完成' : '待完成'}</span><span className="row-actions"><button className="row-menu" title="编辑任务" onClick={() => onEdit(t)}><Pencil size={14} className="muted-icon" /></button><button className="row-menu" title="删除任务" onClick={() => { if (window.confirm(`确定删除“${t.title}”吗？`)) onDelete(t.id) }}><MoreHorizontal size={16} className="muted-icon" /></button></span></div>)}</section></div> }

function CoursesView({ courses, onAdd, onEdit, onDelete }: { courses: Course[]; onAdd:()=>void; onEdit:(course: Course)=>void; onDelete:(id:string)=>void }) { return <div className="page"><div className="page-head compact"><div><div className="eyebrow">学期空间</div><h1>我的课程</h1><p className="subhead">2026 秋季学期 · {courses.length} 门课程</p></div><button className="button primary" onClick={onAdd}><Plus size={17} />添加课程</button></div>{courses.length === 0 ? <EmptyState title="还没有课程" detail="先添加一门课程，再开始安排学习任务。" action="添加课程" /> : <div className="course-grid">{courses.map(c => <div className="course-card" key={c.id}><div className="course-card-top"><span className="course-large-dot" style={{background:c.color}} /><span className="course-card-actions"><button className="icon-btn" title="编辑课程" onClick={() => onEdit(c)}><Pencil size={15} /></button><button className="icon-btn" title="删除课程" onClick={() => { if (window.confirm(`确定删除“${c.name}”吗？`)) onDelete(c.id) }}><MoreHorizontal size={17} /></button></span></div><span className="course-code">{c.code ?? '未设置代码'}</span><h3>{c.name}</h3><div className="course-progress"><div><span>学习进度</span><strong>{c.progress ?? 0}%</strong></div><div className="progress-line"><i style={{width:`${c.progress ?? 0}%`, background:c.color}} /></div></div><div className="course-card-foot"><span>课程数据来自 {supabaseConfigured ? 'Supabase' : '本地存储'}</span><span>{c.semester ?? '2026 秋季学期'}</span></div></div>)}</div>}</div> }

function MaterialsView({ materials, onToast }: { materials: Material[]; onToast:(s:string)=>void }) { const [drag, setDrag] = useState(false); const statusLabel: Record<string, string> = { ready: '已完成', processing: '分析中', needs_review: '待确认', queued: '排队中', failed: '失败' }; return <div className="page"><div className="page-head compact"><div><div className="eyebrow">知识库</div><h1>学习资料</h1><p className="subhead">上传课件，让 AI 帮你提炼重点并生成任务</p></div><button className="button primary" onClick={() => onToast('文件上传接口将在下一步接入')}><Upload size={17} />上传资料</button></div><div className={`upload-zone ${drag ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); onToast('文件上传接口将在下一步接入') }}><div className="upload-icon"><Upload size={22} /></div><h3>拖放文件到这里，或点击上传</h3><p>支持 PDF、PPTX、DOCX、JPG、PNG · 单个文件不超过 50MB</p><button className="text-btn" onClick={() => onToast('文件上传接口将在下一步接入')}>浏览文件 <ArrowRight size={15} /></button></div>{materials.length === 0 ? <EmptyState title="还没有学习资料" detail="上传课件后，资料会出现在这里并进入分析队列。" action="上传资料" /> : <section className="panel material-panel"><div className="panel-head"><div><h2>最近资料</h2><span className="panel-caption">AI 分析状态</span></div><button className="text-btn">查看全部 <ArrowRight size={15} /></button></div><div className="material-list">{materials.map(material => { const ext = material.fileType.split('/').pop()?.toUpperCase() ?? 'FILE'; const statusClass = material.status === 'ready' ? 'ready' : material.status === 'failed' ? 'review' : material.status === 'needs_review' ? 'review' : 'processing'; return <div key={material.id}><div className={`file-icon ${statusClass}`}>{ext.slice(0, 4)}</div><div><strong>{material.fileName}</strong><span>{material.course ?? '未分类'} · {material.fileSize ? `${(material.fileSize / 1024 / 1024).toFixed(1)} MB` : '大小未知'}</span></div><span className={`analysis ${statusClass}`}>{material.status === 'ready' ? <Check size={14} /> : <RefreshCw size={14} />}{statusLabel[material.status] ?? material.status}</span></div> })}</div></section>}</div> }

function EmptyState({ title, detail, action }: { title: string; detail: string; action?: string }) { return <div className="empty-state"><div className="empty-icon"><FileText size={18} /></div><h3>{title}</h3><p>{detail}</p>{action && <button className="button secondary" onClick={() => alert(`${action}功能将在下一步接入`)}><Plus size={15} />{action}</button>}</div> }

function ReviewView({ tasks }: {tasks:Task[]}) { const done = tasks.filter(t=>t.status==='done').length; return <div className="page"><div className="page-head compact"><div><div className="eyebrow">数据洞察</div><h1>学习复盘</h1><p className="subhead">看见投入，也看见自己的进步</p></div><button className="button secondary"><CalendarDays size={16} />本周</button></div><div className="review-grid"><div className="review-main panel"><div className="panel-head"><div><h2>学习时长</h2><span className="panel-caption">过去 7 天 · 共 12 小时 40 分</span></div><span className="trend-chip">+24% 较上周</span></div><div className="bars">{['一','二','三','四','五','六','日'].map((d,i)=><div className="bar-col" key={d}><div className="bar" style={{height:`${[45,72,58,90,64,35,54][i]}%`}} /><span>{d}</span></div>)}</div></div><div className="review-side panel"><div className="panel-head"><div><h2>任务完成</h2><span className="panel-caption">本周概览</span></div><BarChart3 size={17} /></div><div className="big-number">{done + 12}<small> / 20 项</small></div><div className="progress-line"><i style={{width:'72%'}} /></div><p>完成率高于过去 4 周平均值</p><div className="efficiency"><span>个人效率系数</span><strong>0.92 <small>×</small></strong></div></div></div></div> }

function SettingsView({ onAuthChange }: { onAuthChange:()=>Promise<void> }) { return <div className="page"><div className="page-head compact"><div><div className="eyebrow">偏好设置</div><h1>设置</h1><p className="subhead">让知行更贴合你的学习节奏</p></div><button className="button primary"><Check size={16} />保存设置</button></div><div className="settings-layout"><div className="settings-nav"><button className="selected">学习偏好</button><button>固定课程</button><button>通知提醒</button><button>AI 与隐私</button></div><div className="settings-stack"><section className="panel settings-panel"><h2>学习偏好</h2><p className="panel-caption">排程算法会根据这些设置安排每日计划</p><label>每天可学习时间 <span>工作日</span><div className="setting-row"><input value="4" readOnly /><span>小时</span><input value="30" readOnly /><span>分钟</span></div></label><label>默认学习块长度 <span>建议 25 - 90 分钟</span><div className="segmented"><button>25 分钟</button><button className="selected">50 分钟</button><button>90 分钟</button></div></label><label>每日缓冲比例 <span>为意外情况预留时间</span><div className="range-row"><input type="range" min="0" max="30" value="15" readOnly /><strong>15%</strong></div></label><label className="switch-label">完成任务后自动记录学习时长 <button className="switch on"><i /></button></label></section><AuthPanel onAuthChange={onAuthChange} /></div></div></div> }

function AuthPanel({ onAuthChange }: { onAuthChange:()=>Promise<void> }) { const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [currentEmail, setCurrentEmail] = useState<string | null>(null); const [mode, setMode] = useState<'sign-in'|'sign-up'>('sign-in'); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); useEffect(() => { getCurrentUserEmail().then(setCurrentEmail).catch(() => setCurrentEmail(null)) }, []); async function submit() { setBusy(true); setMessage(''); try { const result = mode === 'sign-in' ? null : await signUp(email, password); if (mode === 'sign-in') await signIn(email, password); setCurrentEmail(email); setMessage(result?.needsConfirmation ? '注册成功，请先完成邮箱确认。' : mode === 'sign-up' ? '注册成功，数据空间已准备好。' : '登录成功'); await onAuthChange() } catch (error) { setMessage(error instanceof Error ? error.message : '认证失败，请重试') } finally { setBusy(false) } } async function logout() { setBusy(true); try { await signOut(); setCurrentEmail(null); setMessage('已退出云端账户'); await onAuthChange() } catch (error) { setMessage(error instanceof Error ? error.message : '退出失败') } finally { setBusy(false) } } return <section className="panel auth-panel"><div className="panel-head"><div><h2>云端数据账户</h2><span className="panel-caption">{supabaseConfigured ? '使用 Supabase Auth 保护你的学习数据' : '配置 Supabase 后可开启跨设备同步'}</span></div><span className={`auth-state ${currentEmail ? 'signed' : ''}`}>{currentEmail ? '已登录' : '未登录'}</span></div>{currentEmail ? <div className="auth-logged"><strong>{currentEmail}</strong><button className="button secondary" disabled={busy} onClick={logout}>退出登录</button></div> : <><div className="auth-tabs"><button className={mode === 'sign-in' ? 'selected' : ''} onClick={() => setMode('sign-in')}>登录</button><button className={mode === 'sign-up' ? 'selected' : ''} onClick={() => setMode('sign-up')}>注册</button></div><div className="auth-form"><input type="email" placeholder="邮箱地址" value={email} onChange={e=>setEmail(e.target.value)} /><input type="password" placeholder="密码（至少 6 位）" value={password} onChange={e=>setPassword(e.target.value)} /><button className="button primary" disabled={busy || !email || password.length < 6 || !supabaseConfigured} onClick={submit}>{busy ? '处理中...' : mode === 'sign-in' ? '登录并同步数据' : '注册账户'}</button></div></>}{message && <p className="auth-message">{message}</p>}</section> }

function AddTaskModal({ initial, onClose, onAdd, onUpdate }: { initial?: Task; onClose:()=>void; onAdd?: (title:string, minutes:number, course:string)=>void; onUpdate?: (id:string, title:string, minutes:number, course:string)=>void }) { const [title, setTitle] = useState(initial?.title ?? ''); const [minutes, setMinutes] = useState(initial?.minutes ?? 30); const [course, setCourse] = useState(initial?.course ?? '数据结构'); const editing = Boolean(initial); return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="modal"><div className="modal-head"><div><span className="eyebrow">{editing ? '编辑任务' : '快速添加'}</span><h2>{editing ? '修改任务' : '新建临时任务'}</h2></div><button className="icon-btn" onClick={onClose}><X size={18} /></button></div><label>任务名称<input autoFocus placeholder="例如：整理课堂笔记" value={title} onChange={e=>setTitle(e.target.value)} /></label><div className="form-grid"><label>课程<select value={course} onChange={e=>setCourse(e.target.value)}><option>数据结构</option><option>操作系统</option><option>线性代数</option><option>英语</option></select></label><label>预计时长<select value={minutes} onChange={e=>setMinutes(Number(e.target.value))}><option value="25">25 分钟</option><option value="30">30 分钟</option><option value="50">50 分钟</option><option value="90">90 分钟</option></select></label></div><div className="modal-footer"><button className="button secondary" onClick={onClose}>取消</button><button className="button primary" disabled={!title.trim()} onClick={()=>editing ? onUpdate?.(initial!.id, title, minutes, course) : onAdd?.(title, minutes, course)}>{editing ? <Check size={16} /> : <Plus size={16} />}{editing ? '保存修改' : '加入今日计划'}</button></div></div></div> }

function CourseModal({ initial, onClose, onAdd, onUpdate }: { initial?: Course; onClose:()=>void; onAdd?: (name:string, color:string)=>void; onUpdate?: (id:string, name:string, color:string)=>void }) { const [name, setName] = useState(initial?.name ?? ''); const [color, setColor] = useState(initial?.color ?? '#2673e8'); const editing = Boolean(initial); return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="modal"><div className="modal-head"><div><span className="eyebrow">学期空间</span><h2>{editing ? '修改课程' : '添加课程'}</h2></div><button className="icon-btn" onClick={onClose}><X size={18} /></button></div><label>课程名称<input autoFocus placeholder="例如：概率论" value={name} onChange={e=>setName(e.target.value)} /></label><label>课程颜色<div className="color-picker"><input type="color" value={color} onChange={e=>setColor(e.target.value)} /><span>{color}</span></div></label><div className="modal-footer"><button className="button secondary" onClick={onClose}>取消</button><button className="button primary" disabled={!name.trim()} onClick={()=>editing ? onUpdate?.(initial!.id, name, color) : onAdd?.(name, color)}>{editing ? <Check size={16} /> : <Plus size={16} />}{editing ? '保存修改' : '保存课程'}</button></div></div></div> }

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
