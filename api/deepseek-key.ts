import { createCipheriv, randomBytes } from 'node:crypto'
import { currentUser } from './_deepseek'

function encryptionKey() {
  const value = process.env.DEEPSEEK_KEY_ENCRYPTION_KEY ?? ''
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('服务端尚未配置 API Key 加密密钥')
  return Buffer.from(value, 'hex')
}

export default async function handler(req: any, res: any) {
  let user
  try { user = await currentUser(req) } catch (error) { return res.status(503).json({ error: error instanceof Error ? error.message : '服务暂不可用' }) }
  if (!user) return res.status(401).json({ error: '请先登录账户' })
  if (req.method === 'GET') {
    const { data, error } = await user.client.from('user_api_credentials').select('user_id').eq('user_id', user.id).maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ configured: Boolean(data) })
  }
  if (req.method === 'DELETE') {
    const { error } = await user.client.from('user_api_credentials').delete().eq('user_id', user.id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ configured: false })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const apiKey = String(req.body?.apiKey ?? '').trim().replace(/[\u0000-\u001f\u007f-\u00ff\u3000\s]/g, '')
  if (!/^[\x21-\x7e]{20,300}$/.test(apiKey)) return res.status(400).json({ error: '请输入有效的 DeepSeek API Key' })
  try {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
    const ciphertext = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()])
    const { error } = await user.client.from('user_api_credentials').upsert({ user_id: user.id, ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), auth_tag: cipher.getAuthTag().toString('base64'), updated_at: new Date().toISOString() })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ configured: true })
  } catch (error) { return res.status(503).json({ error: error instanceof Error ? error.message : '保存失败' }) }
}
