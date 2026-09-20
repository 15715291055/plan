# 拾序 · 智能学习计划项目交接文档

> 更新日期：2026-09-20（Asia/Shanghai）
> 项目目录：`C:\Users\31454\Documents\ChatGPT\学习计划网页`
> GitHub：<https://github.com/15715291055/plan>
> 稳定生产地址：<https://plan-lovat-sigma.vercel.app/>
> Vercel 项目：`ray-01cd/plan`

## 1. 当前任务

这是一个 React + Vite 的个人学习计划 Web 应用，产品名称是“拾序”。本轮任务是修复“智能导入课表”在用户已经输入 DeepSeek API Key 后仍提示未保存，以及随后出现的：

```text
Unexpected token 'A', "A server e"... is not valid JSON
```

目标是完成：

```text
修复前端 Key 保存和错误处理
→ 配置 Vercel 后端变量
→ 重新部署
→ 实际请求生产 API 验证
```

## 2. 已完成的代码改动

### API Key 与课表导入

修改文件：`src/main.tsx`

- 用户在设置页输入但尚未点击“保存设置”的 DeepSeek Key，会在点击课表解析前自动保存。
- Key 继续通过 `/api/deepseek-key` 加密保存，不写入普通 localStorage、前端代码或日志。
- 解析图片、解析文字、每周内容分析都会经过统一的 Key 检查。

### API 错误处理

修改文件：`src/lib/data.ts`、`src/main.tsx`

- 增加了可同时处理 JSON 和纯文本错误页的 `readApiPayload()`。
- Vercel 返回纯文本 `A server error has occurred` 时，前端不再抛出误导性的 JSON 解析错误，而会显示 HTTP 状态和服务器错误内容。

### Vercel API runtime

修改文件：`api/deepseek-key.ts`、`api/analyze-schedule-text.ts`、`api/analyze-schedule-image.ts`、`api/analyze-material.ts`、`api/analyze-weekly-content.ts`

这些函数已经显式声明：

```ts
export const runtime = 'nodejs'
```

几个分析函数也增加了 `resolveDeepSeekKey()` 的错误边界。

## 3. Git 与发布状态

已提交并推送到 `origin/main`：

```text
27b38fa fix: save pending DeepSeek key before AI import
27347da fix: handle Vercel API runtime failures
```

最新代码提交是 `27347da`，`origin/main` 与本地 `HEAD` 一致。

Vercel 已通过 CLI 关联到：

```text
ray-01cd/plan
```

最新 Production 部署：

```text
Deployment ID: dpl_EELg2sit8m5rknAKjbRWy2QXZv62
Inspect: https://vercel.com/ray-01cd/plan/EELg2sit8m5rknAKjbRWy2QXZv62
Status: Ready
Alias: https://plan-lovat-sigma.vercel.app
```

## 4. Vercel 环境变量状态

已确认 Vercel Production 中存在以下变量：

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
DEEPSEEK_KEY_ENCRYPTION_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
DEEPSEEK_BASE_URL
DEEPSEEK_API_KEY
DEEPSEEK_MODEL
```

其中所有密钥值都已隐藏，没有打印或提交到 Git。

`SUPABASE_URL` 使用了现有的 `VITE_SUPABASE_URL`；`DEEPSEEK_KEY_ENCRYPTION_KEY` 已生成随机 32 字节、64 位十六进制值；`SUPABASE_SERVICE_ROLE_KEY` 由用户在 Vercel 控制台中补齐。

Vercel CLI 当前已经登录，并且当前目录已通过 `.vercel` 关联项目。`.env.local` 是 Vercel CLI 生成的本地文件，已被忽略，禁止打印或提交。

## 5. 当前卡点

即使 Production 环境变量已经补齐并重新部署，以下两个公开请求仍然返回：

```text
HTTP 500
Content-Type: text/plain; charset=utf-8
A server error has occurred
FUNCTION_INVOCATION_FAILED
```

已验证的接口：

```text
GET  /api/deepseek-key
POST /api/analyze-schedule-text
```

因此当前问题已经不是“缺少环境变量”的简单问题。最可能的方向是 Vercel 函数运行时或函数入口兼容性，需要先拿到 Vercel 函数日志中的真实堆栈。不要继续重复添加环境变量，也不要先把用户 Key 改成前端直传。

建议新会话第一步执行：

```powershell
npx --yes vercel whoami
npx --yes vercel inspect dpl_EELg2sit8m5rknAKjbRWy2QXZv62
npx --yes vercel logs dpl_EELg2sit8m5rknAKjbRWy2QXZv62 --since 1h
```

如果 CLI 的 `logs` 参数不接受 deployment id，使用 Vercel Inspect 页面打开该部署的 Functions 日志。重点寻找 `api/deepseek-key` 的启动异常、导入异常、`req/res` 适配异常或 Node runtime 堆栈。

当前不应声称“课表解析已经恢复”。Production 页面能返回 HTML，但 API 仍未通过真实请求验证。

## 6. 已完成验证

代码侧已通过：

```text
npm run lint
npm test       # 26 项通过
npm run build
git diff --check
```

Vercel 部署构建状态为 `Ready`，前端生产 HTML 和静态 bundle 可以正常返回。

## 7. 工作区注意事项

当前工作区状态：

- `.gitignore` 有本轮 Vercel CLI 增加的 `.vercel` 和 `.env*` 忽略规则；保留这些规则，避免本地部署凭据和环境文件进入 Git。
- `output/` 是未跟踪目录，通常是临时脚本或截图产物，不要加入提交。
- `dist/`、`.env`、`.env.local`、`.vercel` 都不能提交。
- 用户原有改动必须保留，不要使用 `git reset --hard` 或 `git checkout --`。

## 8. 安全边界

绝不能在聊天、命令输出、截图、GitHub 或前端 bundle 中展示：

- DeepSeek API Key
- `SUPABASE_SERVICE_ROLE_KEY`
- `DEEPSEEK_KEY_ENCRYPTION_KEY`
- Supabase access token
- `.env` / `.env.local` 内容

现有设计要求：

```text
前端输入 DeepSeek Key
→ 用户 JWT 发送到 Vercel
→ 服务端使用 AES-256-GCM 加密
→ 保存到 Supabase user_api_credentials
→ AI 调用时仅在服务端解密
```

`user_api_credentials` 表没有普通 authenticated RLS 策略，只允许 service role 使用；不要擅自改成把 API Key 放进普通 localStorage 或前端请求体长期保存。

## 9. 绝对不要再踩的坑

1. 不要把 `A server error has occurred` 当成 JSON 解析问题；先查 Vercel Function Logs。
2. 不要因为前端页面 HTTP 200 就认为 API 已恢复；必须实际请求 `/api/deepseek-key` 和 `/api/analyze-schedule-text`。
3. 不要继续重复添加已经存在的 Vercel 环境变量。
4. 不要打印、截图或提交任何环境变量值。
5. 不要把 `SUPABASE_SERVICE_ROLE_KEY` 写入前端代码。
6. 不要把用户 DeepSeek Key 改存到普通 localStorage。
7. 不要把静态 `DEEPSEEK_API_KEY` 作为无条件的多用户回退，除非重新评估账户隔离和产品安全边界。
8. 不要把 Vercel `Ready` 误认为函数可用；本轮部署就是构建成功但函数请求仍 500 的例子。
9. 不要提交 `output/`、`dist/`、`.env.local` 或 `.vercel`。
10. 任何代码修改后继续运行 `npm run lint`、`npm test`、`npm run build` 和 `git diff --check`。

## 10. 后续计划

1. 从 Vercel 日志获取 `FUNCTION_INVOCATION_FAILED` 的具体堆栈。
2. 根据堆栈修复 API 入口或 Node runtime 兼容问题。
3. 本地调用所有 API handler 做最小回归测试。
4. 重新部署 Production。
5. 先验证无认证请求能返回结构化 JSON `401/503`，再用真实已登录账户验证：保存 Key、刷新页面、解析课表文字、确认导入固定课程和不可用时间。
6. 最后再更新本文件的“当前卡点”和部署 SHA，不要提前写成已完成。
