import { z } from 'zod'
import { resolveDeepSeekKey } from './_deepseek.js'

export const runtime = 'nodejs'

const requestSchema = z.object({ content: z.string().trim().min(10).max(20000), courses: z.array(z.string()).max(100).default([]) })
const taskSchema = z.object({ title: z.string().trim().min(1).max(200), course: z.string().trim().min(1).max(100), deadline: z.string().nullable().optional(), difficulty: z.number().int().min(1).max(5), estimated_minutes: z.number().int().min(5).max(1440), task_type: z.string().trim().min(1).max(50), confidence: z.number().min(0).max(1), priority: z.number().int().min(0).max(100).optional() })
const responseSchema = z.object({ tasks: z.array(taskSchema).min(1).max(30) })

function jsonFromText(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text
  return JSON.parse(fenced.trim())
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  let apiKey: string | null
  try { apiKey = await resolveDeepSeekKey(req) } catch (error) { return res.status(503).json({ error: error instanceof Error ? error.message : '服务端配置不可用' }) }
  if (!apiKey) return res.status(401).json({ error: '请先登录并在设置中保存 DeepSeek API Key' })
  const parsed = requestSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: '学习内容不能为空，长度需在 10 到 20000 字之间' })
  const baseUrl = String(process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com').replace(/\/$/, '')
  const model = String(process.env.DEEPSEEK_MODEL ?? 'deepseek-chat')
  const body = { model, temperature: 0.2, response_format: { type: 'json_object' }, messages: [
    { role: 'system', content: '你是学习计划分析器。只输出 JSON，不要 Markdown。JSON 格式必须是 {"tasks":[{"title":string,"course":string,"deadline":string|null,"difficulty":1-5,"estimated_minutes":number,"task_type":string,"confidence":0-1,"priority":0-100}]}。将输入拆成可执行任务，估算合理时长；日期不明确时 deadline 为 null。' },
    { role: 'user', content: `可选课程：${parsed.data.courses.join('、') || '未提供'}\n本周学习内容：\n${parsed.data.content}` },
  ] }
  let lastError = 'DeepSeek 请求失败'
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(45000) })
      if (!response.ok) { lastError = `DeepSeek 返回 HTTP ${response.status}`; continue }
      const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
      const result = responseSchema.parse(jsonFromText(payload.choices?.[0]?.message?.content ?? ''))
      return res.status(200).json(result)
    } catch (error) { lastError = error instanceof Error ? error.message : lastError }
  }
  return res.status(502).json({ error: lastError })
}
