import { z } from 'zod'
import { resolveDeepSeekKey } from './_deepseek.js'

export const runtime = 'nodejs'

const requestSchema = z.object({ content: z.string().trim().min(10).max(20000) })
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const responseSchema = z.object({
  courses: z.array(z.object({ weekday: z.number().int().min(0).max(6), title: z.string().trim().min(1).max(120), start_time: timeSchema, end_time: timeSchema })).max(100),
  availability: z.array(z.object({ weekday: z.number().int().min(0).max(6), start_time: timeSchema, end_time: timeSchema })).max(50),
  notes: z.string().max(1000).default(''),
})

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  let apiKey: string | null
  try { apiKey = await resolveDeepSeekKey(req) } catch (error) { return res.status(503).json({ error: error instanceof Error ? error.message : '服务端配置不可用' }) }
  if (!apiKey) return res.status(401).json({ error: '请先登录并在设置中保存 DeepSeek API Key' })
  const parsed = requestSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: '课表文字太短或超过 20000 字' })
  const baseUrl = String(process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com').replace(/\/$/, '')
  const model = String(process.env.DEEPSEEK_MODEL ?? 'deepseek-chat')
  const body = { model, temperature: 0.1, response_format: { type: 'json_object' }, messages: [
    { role: 'system', content: '你是课表文字解析器。只输出 JSON：{"courses":[{"weekday":0-6,"title":string,"start_time":"HH:mm","end_time":"HH:mm"}],"availability":[{"weekday":0-6,"start_time":"HH:mm","end_time":"HH:mm"}],"notes":string}。weekday 使用 0=周日、1=周一至 6=周六。识别课程名称和上课时间；只有文字明确写出的空闲/可学习时段才填入 availability；无法确认的内容不要猜。' },
    { role: 'user', content: `请解析以下课表文字：\n${parsed.data.content}` },
  ] }
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(45000) })
    if (!response.ok) return res.status(502).json({ error: `DeepSeek 返回 HTTP ${response.status}` })
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = payload.choices?.[0]?.message?.content ?? ''
    const json = JSON.parse(content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? content)
    return res.status(200).json(responseSchema.parse(json))
  } catch (error) { return res.status(502).json({ error: error instanceof Error ? error.message : '课表文字解析失败' }) }
}
