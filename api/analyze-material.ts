import { z } from 'zod'

const requestSchema = z.object({ fileName: z.string().min(1).max(300), content: z.string().trim().min(20).max(120000) })
const responseSchema = z.object({ chapters: z.array(z.string()).max(100), knowledge_points: z.array(z.string()).max(200), tasks: z.array(z.object({ title: z.string(), estimated_minutes: z.number().int().min(5).max(1440), difficulty: z.number().int().min(1).max(5), task_type: z.string() })).max(30), summary: z.string().max(3000) })

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const apiKey = String(req.headers?.['x-deepseek-api-key'] ?? '')
  if (!apiKey || apiKey.length < 20 || apiKey.length > 300) return res.status(401).json({ error: '请先填写有效的 DeepSeek API Key' })
  const parsed = requestSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: '资料文本不足，暂时无法分析' })
  const baseUrl = String(process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com').replace(/\/$/, '')
  const model = String(process.env.DEEPSEEK_MODEL ?? 'deepseek-chat')
  const body = { model, temperature: 0.2, response_format: { type: 'json_object' }, messages: [
    { role: 'system', content: '你是课程资料分析器。只输出 JSON：{"chapters":string[],"knowledge_points":string[],"tasks":[{"title":string,"estimated_minutes":number,"difficulty":1-5,"task_type":string}],"summary":string}。任务必须可执行。' },
    { role: 'user', content: `文件名：${parsed.data.fileName}\n资料文本：\n${parsed.data.content}` },
  ] }
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) })
    if (!response.ok) return res.status(502).json({ error: `DeepSeek 返回 HTTP ${response.status}` })
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = payload.choices?.[0]?.message?.content ?? ''
    const json = JSON.parse(content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? content)
    return res.status(200).json(responseSchema.parse(json))
  } catch (error) { return res.status(502).json({ error: error instanceof Error ? error.message : '资料分析失败' }) }
}
