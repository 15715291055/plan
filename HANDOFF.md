# 行（Study Planner）项目交接文档

## 1. 当前任务

这是一个面向学生的 AI 学习计划网页，产品名称为“行”。目标是让用户导入课程表、课本课件、图片和每周学习内容，由 DeepSeek 解析课程、任务、难度、优先级和预计时长，再由内置排程算法生成每日/每周计划。用户也可以随时添加临时任务，系统会避开固定课程和不可用时间。

当前视觉方向：极简现代学习空间 + 抽象流动山海背景，参考 Linear、Notion、Arc、Framer。使用黄昏欧洲雪山湖畔氛围、云雾渐变、湖面暮色、暖光和半透明亚克力面板，但避免宣纸、毛笔、印章、卷轴等明显国风元素。

## 2. 项目位置与远程仓库

- 本地项目：`C:\Users\31454\Documents\Codex\2026-09-14\w\work\plan-check`
- GitHub：`https://github.com/15715291055/plan`
- 默认分支：`main`
- 本地开发：在项目目录运行 `npm run dev`，Vite 通常会启动在 `http://127.0.0.1:5173/` 或相邻端口。

## 3. 已完成的功能

- 今日计划、每周计划、任务管理、课程管理、学习资料、学习复盘、设置页面。
- 任务 CRUD：课程、截止时间、难度、任务类型、预计时长、临时任务。
- 内置排程算法：按截止时间和优先级安排任务，支持缓冲时间、锁定块、保持原计划/少改动/紧急插入。
- 固定课程和重复课程：排程时自动避开。
- 不可用时间模式：设置中的时间段表示不能学习；其余时间自动作为排程窗口，再排除固定课程。
- 课表图片导入、课表文字导入，DeepSeek 解析后先确认，再写入固定课程、课程和不可用时间，并触发重新排程。
- 旧版导入数据回填：固定课程没有对应课程时，加载工作区会自动补建“我的课程”。
- 每周计划同时显示学习任务和固定课程，时间轴延长到 23:00。
- PDF、DOCX、PPTX 文本提取；资料分析后可确认生成任务。
- Supabase Auth 登录/注册/退出，用户数据按账户隔离，RLS 已配置。
- 用户昵称和头像编辑；侧栏个人卡不再显示用户名，只保留头像入口。
- 收起侧栏，收起状态下图标间距、选中动画和点击反馈已统一。
- DeepSeek Key 支持按用户加密保存到云端，刷新和换设备登录同一账户后无需重新填写。
- 当前视觉已保存为“风格 1”，设置中有风格 1/2/3 切换框架，选择保存在浏览器 localStorage。
- `prefers-reduced-motion` 支持。

## 4. 主要代码位置

- `src/main.tsx`：主 React 应用、页面、导入流程、任务操作、排程触发、风格选择。
- `src/styles.css`：全局视觉、深色山海背景、亚克力面板、侧栏、动画和响应式布局。
- `src/lib/data.ts`：Supabase/local 数据访问、Auth、课程/任务/资料/偏好/用户资料、账户 Key API 调用。
- `src/lib/scheduler.ts`：排程核心算法。
- `src/lib/extract.ts`：PDF/DOCX/PPTX 文本提取。
- `src/components/ShanHaiBackground.tsx`：山海背景组件。
- `api/analyze-weekly-content.ts`：每周内容分析接口。
- `api/analyze-material.ts`：学习资料分析接口。
- `api/analyze-schedule-text.ts`：课表文字解析接口。
- `api/analyze-schedule-image.ts`：课表图片解析接口。
- `api/_deepseek.ts`：验证 Supabase JWT、读取并解密用户 Key。
- `api/deepseek-key.ts`：保存、查询、删除用户加密 Key。
- `supabase/schema.sql`：数据库表、RLS、Storage bucket、`user_api_credentials` 表。
- `.env.example`：环境变量名称示例。

## 5. 配置与密钥

禁止把真实密钥写进 Git、README 或本文件。

前端环境变量（可公开的 Supabase URL 和 anon key）：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Vercel 服务端变量：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`（高权限，绝不能暴露给前端）
- `DEEPSEEK_KEY_ENCRYPTION_KEY`（64 位十六进制，AES-256-GCM 用；丢失会无法解密历史 Key）
- `DEEPSEEK_BASE_URL=https://api.deepseek.com`
- `DEEPSEEK_MODEL=deepseek-chat`
- 可选：`DEEPSEEK_VISION_MODEL`

本地 `.env`/`.env.local` 已被 `.gitignore` 忽略。用户的 DeepSeek Key 不存 localStorage、数据库明文或 Vercel 环境变量；服务端加密后写入 Supabase `user_api_credentials`。

生成加密密钥：

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

首次部署/新 Supabase 项目：在 Supabase SQL Editor 执行最新 `supabase/schema.sql`。必须配置 Email Auth，并在 Vercel 同时配置 `SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY`，否则账户 Key API 会返回“服务端尚未配置”。

## 6. 常用验证与发布

```powershell
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
git status --short
git push origin main
```

最近的重要提交：

- `cd6bd77`：风格切换框架
- `bf440ba`：收起侧栏排版
- `c0c7bf5`：时间轴延长到 23:00
- `cf1c7ce`：固定课程时间内也允许添加任务
- `52c8974`：不可用时间排程计算
- `a288a59`：AI 请求刷新 Supabase 会话
- `685bb76`：账户级加密保存 DeepSeek Key

## 7. 已知问题与下一步计划

优先事项：

1. 在真实线上 Vercel 环境验证 `GET/POST/DELETE /api/deepseek-key`，确认服务端三个关键变量已配置。
2. 登录账户后保存 Key，刷新页面并测试课表文字、课表图片、资料分析和每周内容分析。
3. 用真实课表验证：课程是否出现在“我的课程”、固定课是否出现在每周计划、任务是否只排在剩余时间。
4. 设计并实现风格 2、风格 3；当前只是占位选项。
5. 增加图片 OCR/更稳健的课表识别、资料分析队列取消/重试、日历时间块拖拽编辑和通知提醒。
6. 补充课程与固定课程的正式关联字段（当前旧数据回填按课程名称匹配）。
7. 评估 Vite/esbuild 依赖审计警告，升级前验证构建兼容性。

## 8. 踩过的坑（不要重犯）

- 不要把用户 DeepSeek Key 直接放进前端请求头长期传输或写入 localStorage；浏览器请求头遇到中文空格/换行会报 `String contains non ISO-8859-1 code point`。
- AI 接口现在依赖 Supabase JWT + 服务端解密 Key；如果用户看到“请先登录并在设置中保存 API Key”，先检查登录会话和 Vercel 服务端变量，不要让用户重复粘贴 Key。
- 修改 `src/main.tsx` 这种超长单行 JSX 时，PowerShell 替换容易写入字面量 `` `r`n `` 并导致 TS1443；修改后必须立刻跑 `npm run typecheck`。
- 不要把不可用时间继续当作可用时间传给 scheduler；排程前必须通过 `schedulableWindows()` 计算补集。
- 添加任务和排程必须解耦：没有空档时任务仍要保存，不能因 `runReplan` 抛错而回滚添加。
- 课表导入不能只写 `fixed_events`；必须同步建立课程，并让周计划显示固定课。
- `WeekView` 使用 `scheduleItems.length` 分支时要同时合并 `fixedEvents`，否则只有固定课时会回退到空/演示数据。
- 收起侧栏时不要用固定绝对定位让收起按钮压住头像；需要同时调整 brand、profile、nav 的间距。
- GitHub 推送偶尔会因网络连接 `github.com:443` 失败；先确认本地提交，再单独重试 `git push origin main`，不要误报线上已更新。
- 用户截图可能来自旧的 Vercel 部署；先核对提交号和部署状态，再判断线上是否包含最新代码。

## 9. 新会话建议的第一步

1. `cd C:\Users\31454\Documents\Codex\2026-09-14\w\work\plan-check`
2. 阅读本文件、`git status` 和最近提交。
3. 运行 `npm run typecheck`。
4. 如处理线上 API，先核对 Vercel 环境变量和 Supabase SQL 是否已执行，再改代码。
5. 每次修改后运行必要检查并记录提交号；只有 `git push` 成功后才能告诉用户线上已同步。
