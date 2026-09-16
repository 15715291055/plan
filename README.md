# 知行 · 智能学习计划

项目采用 Vite + React + TypeScript。当前已覆盖“任务/课程 CRUD → 可用时间与固定课程 → 自动排程 → 专注计时与学习记录 → 资料上传与文本分析 → AI 任务确认”的闭环。

## 本地运行

本工作区已将依赖放在 `D:\study-planner-node_modules`，项目内的 `node_modules` 只是目录联接；npm 缓存位于 `D:\study-planner-cache`。

```bash
npm run dev
```

如需重新安装依赖，请将 npm 缓存设为 `D:\study-planner-cache`，并把生成的 `node_modules` 移回 `D:\study-planner-node_modules` 后重新建立目录联接。

构建检查：

```bash
npm run build
```

`npm run typecheck` 执行 TypeScript 检查，`npm run lint` 会先检查类型并扫描源码中的服务端密钥误提交，`npm test` 执行无外部依赖的契约冒烟测试。

## 接入 Supabase

第一阶段的数据适配已经内置在 `src/lib/data.ts`。配置以下 Vite 变量后，应用会读取当前登录用户的 Supabase 数据；未登录或未配置时会明确显示“本地数据”，并继续使用浏览器本地存储：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

在 Supabase SQL Editor 中执行 [`supabase/schema.sql`](supabase/schema.sql)，它会创建课程、任务、可用时间、固定课程、计划、资料、学习记录、每周输入和用户偏好表，并为用户数据启用 RLS；同时创建私有 `materials` Storage bucket。

前端只需要在本地 `.env` 或 `.env.local` 中配置以下变量（这些文件已被 `.gitignore` 忽略，不能提交到 GitHub）：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

DeepSeek API Key 不放在 `.env`、Vercel 环境变量或数据库中。每位用户登录后，在“设置 → DeepSeek API Key”中自行填写；密钥只存在当前页面的 React 内存，调用 `/api/analyze-weekly-content` 或 `/api/analyze-material` 时通过请求头发送，刷新页面后需要重新填写。API 路由不会记录或持久化该密钥。

### 窗口不透明度

在设置页左侧、“学习偏好”下方拖动“窗口不透明度”滑杆，可在 0%–100% 之间连续调节面板背景与毛玻璃效果，文字和按钮保持清晰。选择立即生效并保存在当前浏览器，刷新后保留，无需点击“保存设置”。

### 云端数据验收

1. 在 Supabase SQL Editor 执行 schema，并在 Authentication → Providers 中开启 Email。
2. 将 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` 配置到 Vercel 的 Production、Preview、Development 环境后重新部署。
3. 注册账户（若开启邮箱确认，先点击确认邮件再登录），在“设置”中添加可用时间和固定课程。
4. 新建课程和任务，点击“重新排程”，刷新页面确认数据仍存在；再用第二个账户确认看不到第一个账户的数据。
5. 上传 PDF/DOCX/PPTX，填写自己的 DeepSeek Key，等待“待确认”，确认任务后检查任务库和周计划。

服务端只读取 `DEEPSEEK_BASE_URL` 与 `DEEPSEEK_MODEL` 这类非敏感配置。不要在 `.env`、日志、截图或提交记录中放入 DeepSeek Key、Supabase service-role key 或其他用户密钥。
