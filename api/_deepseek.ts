import { createClient } from '@supabase/supabase-js'
import { createDecipheriv } from 'node:crypto'

function serverSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('服务端尚未配置 Supabase 密钥存储')
  return createClient(url, key, { auth: { persistSession: false } })
}

function encryptionKey() {
  const value = process.env.DEEPSEEK_KEY_ENCRYPTION_KEY ?? ''
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('服务端尚未配置 API Key 加密密钥')
  return Buffer.from(value, 'hex')
}

export async function currentUser(req: any) {
  const token = String(req.headers?.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const client = serverSupabase()
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return null
  return { client, id: data.user.id }
}

export async function savedDeepSeekKey(req: any): Promise<string | null> {
  const user = await currentUser(req)
  if (!user) return null
  const { data, error } = await user.client.from('user_api_credentials').select('ciphertext,iv,auth_tag').eq('user_id', user.id).maybeSingle()
  if (error || !data) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(data.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(data.auth_tag, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(data.ciphertext, 'base64')), decipher.final()]).toString('utf8')
  } catch { return null }
}

export async function resolveDeepSeekKey(req: any): Promise<string | null> {
  const key = await savedDeepSeekKey(req)
  return key && /^[\x21-\x7e]{20,300}$/.test(key) ? key : null
}
