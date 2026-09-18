# “行”学习计划项目交接文档

> 更新日期：2026-09-18（Asia/Shanghai）
> 面向对象：完全没有此前上下文的新 Codex 会话
> 项目目录：`C:\Users\31454\Documents\ChatGPT\学习计划网页`

## 1. 我们在做什么

这是一个名为“行”的个人学习计划 Web 应用。用户可以管理课程、固定活动、学习资料和任务，设置不可用时间与学习偏好，并由内置的可解释排程算法自动生成计划；也可以使用自己的 DeepSeek API Key 分析课表、资料和每周学习内容。

当前主线有两部分：持续完善并发布 Web 版，保证本地、GitHub 和 Vercel 云端同步；评估将现有 React/Vite 网页封装为 Android APK。APK 尚未开始实现，目前只完成了方案和工作量评估。

用户明确要求：以后每次代码修改都要“一条龙”完成，即 **修改 → 验证 → Git 提交 → 推送 GitHub → 确认 Vercel 生产部署**。不能只改本地，也不能在没有证据时声称云端已更新。

## 2. 仓库与当前状态

- 本地目录：`C:\Users\31454\Documents\ChatGPT\学习计划网页`
- GitHub：<https://github.com/15715291055/plan.git>
- 默认分支：`main`
- 当前提交：`cb77c8d fix: show saved API key status after refresh`
- 当前 `origin/main` 也指向 `cb77c8d`，截至交接时 GitHub 已同步。
- README 记录的生产网址：<https://plan-lovat-sigma.vercel.app/>
- 最近一次已知的 Vercel 部署网址：<https://plan-4qe66uhrf-ray-01cd.vercel.app>
- 工作区当前有未跟踪目录：`output/`。它不是本轮功能代码，不要未经确认直接加入提交。
- `.env` 存在于本地且受 `.gitignore` 忽略，绝不能提交或展示其中的密钥。

## 3. 已完成内容

### 基础产品

- 今日计划、每周计划、任务、课程、资料、复盘、设置等主要页面。
- Supabase 登录、用户数据隔离、跨设备同步和 RLS。
- PDF、DOCX、PPTX 文本提取与资料分析；课表图片/文字分析后可确认导入。
- DeepSeek 分析接口使用用户自己的 Key，由后端代理调用。

### 视觉与交互

- 风格 2 已使用用户提供的图片作为背景，并保留风格切换框架。
- 窗口不透明度控制已移动到“学习偏好”同一列，范围 0–100%，支持无级调整和 localStorage 持久化。
- 已修复滑杆无法拖动、滑动不生效、0% 时残留偏蓝色差的问题。
- 新增任务弹窗改为弹窗内部滚动，不再撑出页面。
- 问候语根据早上/中午/晚上变化；英文名言按自然日切换，31 条循环使用。
- 侧边栏折叠布局、动效和响应式样式已优化。

### 任务与自动排程

- 新任务可以不选择课程，默认“暂不选择课程”；课程选择框配色已优化。
- 支持一次性完成/分摊到多日、指定分摊天数、优先级、必须连续完成和已完成分钟数。
- 排程保留完成/锁定块，避开固定课程、固定活动和不可用时间，并预留缓冲比例。
- 常规排序大致为截止时间更早 → 优先级更高 → 难度更高；紧急插入优先考虑优先级与截止时间。
- 按学习块长度切分，不越过截止时间；必须连续时找不到足够连续空档则产生冲突。
- 多日任务按剩余时长和指定天数尽量均匀分布；支持最短有效学习块、块间休息、最长 28 天排程视野、容量不足提示和剩余分钟排程。
- 排程测试目前共有 12 项。

### API Key 刷新状态

- DeepSeek Key 通过 `/api/deepseek-key` 在服务端 AES-256-GCM 加密后保存到 Supabase。
- 刷新后不会回显明文，这是安全设计；最新提交 `cb77c8d` 会显示“Key 已安全保存”状态。
- 前端通过 Supabase JWT 调用后端，由后端读取并解密 Key。

### 文档与验证

- README 已按标准重写，包含功能、技术栈、本地运行、环境变量、Supabase、Vercel、排程规则、安全说明、目录结构和已知限制。
- 最近一次已知验证：`npm run lint`、`npm test`（12 项）和 `npm run build` 均通过；构建有既有 bundle size warning，但不阻塞发布。

## 4. 关键代码位置

- `src/main.tsx`：主应用、页面、任务弹窗、设置、不透明度、导入流程、API Key 状态。
- `src/styles.css`：视觉主题、背景、亚克力窗口、0% 透明样式、弹窗滚动和响应式样式。
- `src/lib/scheduler.ts`：排程核心算法。
- `src/lib/data.ts`：Supabase/local 数据访问、认证、Key API 调用。
- `src/lib/extract.ts`：资料文本提取。
- `src/components/ShanHaiBackground.tsx`：背景组件与风格切换。
- `api/deepseek-key.ts`、`api/_deepseek.ts`：Key 状态、加密、JWT 和 DeepSeek 共用逻辑。
- `api/analyze-*.ts`：课表、资料和每周内容分析接口。
- `supabase/schema.sql`：数据库表、RLS、Storage 和 `user_api_credentials`。
- `README.md`：完整安装、配置与部署说明。

## 5. 当前卡点 / 尚未完成

目前没有代码层面的硬阻塞，Web 版已经提交并推送。尚未闭环的是：

1. 线上真实账户的端到端验证：需在生产域名登录，验证保存 Key、刷新后的状态，以及四类 AI 分析接口。
2. Vercel 生产别名核对：部署 URL 和 README 稳定域名不同，下一会话必须确认稳定生产域名指向最新提交，而非只看到 preview URL。
3. APK 尚未开始：仓库没有 Capacitor/Android 平台代码，也没有生成 APK。
4. 本机 Android 工具链未知：开始 APK 前需检查 Java、Android SDK、Gradle/Android Studio。

## 6. 下一步计划

### 先闭环 Web 生产验证

1. 阅读本文件和 `README.md`。
2. 执行 `git status --short`、`git log -5 --oneline --decorate`，确认仍在 `main` 且没有覆盖用户改动。
3. 运行 `npm run lint`、`npm test`、`npm run build`。
4. 打开生产域名，用真实账户验证：登录 → Key 保存状态 → 刷新 → 课表文字、课表图片、资料分析、每周内容分析。
5. 核对 Vercel Production 部署的提交 SHA 必须是 `cb77c8d` 或更新提交。
6. 有问题时完成修改、验证、提交、推送、部署确认全流程。

### 如用户决定做 APK

推荐 Capacitor 封装现有 React/Vite，而不是重写原生 Android：

1. 检查 Node、Java、Android SDK、Gradle/Android Studio。
2. 确认交付目标：debug APK，还是签名 release APK/AAB；未指定可先做 debug，但要说明它不是商店发布包。
3. 添加 `@capacitor/core`、`@capacitor/cli`、`@capacitor/android`，配置 `appId`、`appName`、`webDir`。
4. 明确 Android WebView 的生产 API 基址。不能假设相对 `/api/...` 在本地 WebView 一定可用；应明确线上 API 地址或加载线上站点，并评估安全与离线影响。
5. 重点验证手机布局、弹窗、周计划横向滚动、文件选择、返回键、软键盘遮挡和安全区。
6. DeepSeek Key 继续由服务端加密保存，不要迁移到普通 WebView localStorage；设备端保存应使用原生安全存储插件。
7. 运行 Web 测试和 Android 构建，真机安装验证后再交付。APK 通常作为构建产物，不直接提交 Git。

估算已向用户说明：仅封装约 10万–25万 tokens；加移动端适配约 25万–50万；加离线、通知、安全存储、签名发布约 50万–100万；结合当前项目约 30万–60万 tokens。Gradle/APK 编译主要消耗本地 CPU、内存、磁盘和网络。

## 7. 环境变量与安全边界

禁止把真实密钥写入 Git、README、日志截图或本文件。

- 前端：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`。
- 仅 Vercel 服务端：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`DEEPSEEK_KEY_ENCRYPTION_KEY`（64 位十六进制）、`DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL`，以及可选 `DEEPSEEK_VISION_MODEL`。

若线上 Key API 报“服务端尚未配置”，先检查 Vercel 环境变量和 Supabase `user_api_credentials` 表/RLS，不要让用户反复粘贴 Key，也不要改成前端明文存储。

## 8. 绝对不要再踩的坑

1. 不要只改本地；每次修改必须推送并核对 Production 部署 SHA。
2. 不要把 preview URL 当生产完成证据；确认稳定生产域名指向最新提交，并让用户硬刷新验证。
3. 不要明文回显或存储 API Key；刷新后只显示“已安全保存”。
4. 不要提交 `.env`、service role key、加密密钥或用户 DeepSeek Key。
5. 不要把未跟踪的 `output/` 顺手加入提交。
6. 0% 不透明度必须移除背景色、伪元素、边框、阴影和 backdrop-filter；回归 0%、中间值、100%。
7. 不要让透明度滑杆被覆盖层阻断 pointer 事件；必须真实拖动验证。
8. 不可用时间必须先转为可排程窗口补集，再排除固定课程/活动。
9. 不要把“必须连续完成”和“一次性完成”混为一谈；只有明确勾选必须连续时才要求单一连续空档。
10. 容量不足时仍保存任务并提示未排完分钟数，不能因排程失败回滚创建。
11. 多日任务不得超过指定天数或截止日期，要按剩余分钟和每日容量计算。
12. 课表导入不能只写 `fixed_events`，必须同步建立/关联课程。
13. 周计划不能只看任务块；只有固定课程时也必须显示。
14. 修改超长 JSX 不要用脆弱 PowerShell 字符串替换；优先 `apply_patch`，改后立即 typecheck。
15. 不要假设 Playwright/Chromium 一定可用；无法真实 UI 验证时要如实说明。
16. Git push 失败时不要误报成功；用远端 SHA 证明同步。
17. 不要覆盖用户已有改动；先看 diff，禁止 `git reset --hard`。

## 9. 标准修改与发布清单

```powershell
git status --short
npm run lint
npm test
npm run build
git diff --check
git diff --stat
git add <仅本次相关文件>
git commit -m "<准确描述>"
git push origin main
git status --short
git log -3 --oneline --decorate
```

推送后必须检查 Vercel Production 状态与提交 SHA，再打开稳定生产域名验证核心流程。只有这些步骤都完成，才能告诉用户“网站已经更新”。

## 10. 新会话第一步

```powershell
cd C:\Users\31454\Documents\ChatGPT\学习计划网页
```

然后阅读本文件和 `README.md`，检查 Git 状态与最新提交。如果用户继续问 APK，从工具链检查与 debug/release 目标确认开始；如果继续反馈网页问题，先在生产域名复现，再按“一条龙”流程修复并发布。
