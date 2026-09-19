# 拾序 · 智能学习计划项目交接文档

> 更新日期：2026-09-19（Asia/Shanghai）
> 面向对象：完全没有此前上下文的新 Codex 会话
> 项目目录：`C:\Users\31454\Documents\ChatGPT\学习计划网页`
> GitHub：<https://github.com/15715291055/plan>
> 生产地址：<https://plan-lovat-sigma.vercel.app/>

## 1. 当前任务

这是一个 React + Vite 的个人学习计划 Web 应用，产品名称是“拾序”。当前主要工作是持续完善网页产品，并按用户要求完成：

```text
修改代码
→ 本地验证
→ Git commit
→ push GitHub main
→ 核对 Vercel Production
→ 浏览器实际验证
```

用户明确要求：不能只修改本地，也不能在没有证据时声称网站已经部署。每次后续功能或修复都应走完整闭环。

## 2. 最新仓库状态

- 分支：`main`
- 最新提交：`b253acc feat: update site icon`
- `origin/main` 已确认指向 `b253acc`
- 最近提交历史：

```text
b253acc feat: update site icon
0cb15bf fix: stabilize mobile scrolling background
dba31f9 feat: add balanced smart scheduling
954b514 feat: renumber background styles
5939719 feat: add custom style three and four backgrounds
951d892 feat: rename app to 拾序
080bde3 feat: add learning heatmap and scene transitions
73f22d4 docs: refresh project handoff
```

工作区中有两个需要保留、不要顺手处理的状态：

- `HANDOFF.md` 是本次重新写入的交接文档，应按本次任务提交。
- `output/` 是未跟踪目录，通常是截图或临时产物，不要加入 Git，除非用户明确要求。

本地 `.env` / `.env.local` 可能存在，受 `.gitignore` 保护，绝不能提交、打印或截图展示密钥。

## 3. 已完成的产品能力

### 页面与数据

- 今日计划
- 每周计划
- 任务管理
- 课程管理
- 学习资料
- 学习复盘
- 设置页
- Supabase 登录、RLS 和云端同步
- 未登录或未配置 Supabase 时使用 localStorage 本地模式
- PDF、DOCX、PPTX、图片资料提取与 AI 分析
- 课表图片/文字解析后确认导入固定课程和不可用时间
- DeepSeek Key 由后端加密保存，不在前端明文回显

### 视觉与交互

- 网站名称已改为“拾序”
- 学习热力图已加入复盘页面
- 页面切换有统一过渡效果
- 场景切换会联动主题色、按钮、进度条和热力图配色
- 风格编号已经重新整理为三种：
  - 风格 1：原风格 2，海港背景并带细微动态飘雪
  - 风格 2：用户提供的晴天海港图
  - 风格 3：用户提供的夜景海港图
- 用户提供的背景资源：
  - `public/style-3-background.jpg`
  - `public/style-4-background.jpg`
- 当前网站图标已替换为用户提供的蒲公英图片：
  - `public/site-icon.jpg`
  - `index.html` 中配置了 `icon` 和 `apple-touch-icon`
  - 左侧栏品牌标记也使用 `/site-icon.jpg`
- 窗口不透明度支持 0–100%，并保存到 localStorage
- 0% 不透明度时会移除面板底色、伪元素、阴影和毛玻璃
- 弹窗内部滚动，避免移动端弹窗撑出页面

## 4. 智能排程：已完成内容

最近的核心功能是智能排程，提交为：

```text
dba31f9 feat: add balanced smart scheduling
```

### 完成方式

`TaskCompletionMode` 现在支持：

```ts
type TaskCompletionMode =
  | 'smart'
  | 'single_day'
  | 'spread_days'
```

- `smart`：默认模式。系统根据截止压力、每日负载、优先级、难度、精力时段和跨日间隔自动安排。
- `single_day`：同一个自然日完成，可以拆成多个时间块；不等于必须今天完成。
- `spread_days`：按用户选择的天数分摊，不能超过指定日期数。
- `requireContinuous=true`：只有这个开关开启时，才要求一个完整连续空档。

新建任务弹窗默认选中“智能安排”，按钮文案是“加入计划”。

### 排程器行为

`src/lib/scheduler.ts` 已从“按任务顺序尽量塞满”改为：

```text
建立硬约束
→ 计算未来每日真实容量
→ 计算截止压力
→ 计算理想每日负载
→ 为所有任务生成下一个学习块的候选位置
→ 选择全局评分最高的候选
→ 更新容量、负载和剩余分钟
→ 重复直到完成或产生 conflict
```

已处理：

- 不超过截止时间
- 避开不可用时间
- 避开固定课程和固定活动
- weekly 固定课程在整个 horizon 内展开
- 保留锁定时间块
- 已完成任务不重新安排
- 过去时间不安排
- `single_day` 不跨自然日
- `requireContinuous` 真正要求连续空档
- `spread_days` 不超过指定天数
- 已完成分钟数会从剩余任务中扣除
- 普通任务倾向跨日均衡
- 紧急任务可突破负载均衡，优先保证截止日期
- 背诵、复习、词汇、记忆、默写任务倾向使用较短学习块并跨日间隔
- 避免产生低于最短学习块的无效尾块
- 使用本地日期，而不是 UTC 日期作为自然日 key
- 容量不足时保留已经成功安排的块，并返回明确冲突信息

新增工具：

```text
src/lib/date-utils.ts
```

提供：

- `localDateKey(date)`
- `minutesBetween(start, end)`

### 首页统计修复

`src/main.tsx` 的今日任务现在按 `scheduleItems` 的当天实际时间块聚合：

- 同一个任务当天有多个块，会合并当天分钟数
- 今日总时长使用实际排程块分钟数
- 180 分钟任务如果今天只排 50 分钟，首页今天只显示 50 分钟
- 专注计时记录的 `plannedMinutes` 优先使用今日实际安排分钟数
- “今日可用容量”先把不可用时间转换成可排程窗口，再扣除固定课程

## 5. 移动端白屏闪烁修复

最近提交：

```text
0cb15bf fix: stabilize mobile scrolling background
```

实现位置：

- `src/main.tsx`
- `src/styles.css`

入口会检测真实触屏移动设备，不使用窗口宽度判断：

```ts
document.documentElement.classList.add('mobile-render-fix')
```

检测考虑：

- `navigator.userAgentData.mobile`
- Android / iPhone / iPad / iPod / Mobile / HarmonyOS UA
- iPad 桌面模式：`MacIntel + maxTouchPoints > 1`
- `(pointer: coarse)`

只对带 `.mobile-render-fix` 的真实移动设备增加：

- `body`、`#root`、`.app-shell` 深色兜底 `#111c2a`
- `.app-shell` 的 `100vh` + `100dvh`
- fixed 全屏背景的 `translateZ(0)`
- `backface-visibility: hidden`
- `will-change: transform`

没有关闭或降低毛玻璃，也没有改公共桌面样式。

已验证：

- 桌面浏览器：`mobile-render-fix === false`
- iPhone 15 模拟环境：`mobile-render-fix === true`
- 手机端 body 背景为 `rgb(17, 28, 42)`
- 手机端背景 transform 生效
- 生产环境移动上下文也已验证

不要把这些修复改成单纯的：

```css
@media (max-width: 720px)
```

因为用户要求电脑端即使缩小窗口也不能触发手机性能降级。

## 6. 关键文件

- `index.html`：标题、favicon、Apple touch icon
- `src/main.tsx`：主应用、路由式页面切换、任务弹窗、今日聚合、手机检测
- `src/styles.css`：全局视觉、背景、毛玻璃、响应式样式、移动端专用补丁
- `src/lib/scheduler.ts`：智能排程纯函数核心
- `src/lib/date-utils.ts`：本地日期与分钟工具
- `src/lib/data.ts`：Task 类型、完成方式、Supabase/local 数据适配
- `scripts/scheduler.test.ts`：排程测试
- `src/components/ShanHaiBackground.tsx`：背景图、雪效、场景背景
- `src/components/StudyHeatmap.tsx`：学习热力图
- `public/style-3-background.jpg`：风格 2 背景
- `public/style-4-background.jpg`：风格 3 背景
- `public/style-2-background.png`：风格 1 背景
- `public/site-icon.jpg`：网站图标
- `README.md`：安装、环境变量、Supabase 和部署说明
- `supabase/schema.sql`：数据库、RLS、Storage
- `api/`：DeepSeek、Key 加密与 AI 分析接口

## 7. 当前卡点与未完成事项

当前没有阻塞发布的代码错误，最新版本已经部署到生产。

仍建议后续完成：

1. 在真实手机浏览器上连续快速上下滑动 20–30 次，测试地址栏收起/展开、顶部、底部和横竖屏切换，确认白闪是否彻底消失。
2. 在真实桌面 Chrome、Edge 上回归 1920×1080、2560×1440、1366×768，以及窗口缩小到 720px 以下时的背景、毛玻璃、动画和滚动。
3. 用真实 Supabase 账户做生产端到端验证：登录、保存 API Key、刷新、课表分析、资料分析、每周内容分析。
4. 检查 Vercel Production 是否继续绑定稳定域名，并确认部署 SHA 与 `origin/main` 一致。
5. APK/Android 尚未开始，没有 Capacitor、Android Studio 或签名构建配置。

浏览器控制台目前可能存在少量既有错误/警告，例如 favicon 404（在本次图标修复前）或 Motion 组件相关提示。不要把“控制台绝对零错误”作为当前任务的默认验收条件；应区分本次改动引入的问题和既有问题。

## 8. 测试与发布命令

在项目目录执行：

```powershell
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
```

当前已知结果：

- lint 通过
- build 通过
- 智能排程测试共 17 项，全部通过
- build 仍可能提示 bundle 大于 500kB，这是既有警告，不是构建失败

标准发布流程：

```powershell
git status --short
git log -5 --oneline --decorate

npm run lint
npm test
npm run build
git diff --check

git add <仅本次相关文件>
git commit -m "<准确描述>"
git -c http.version=HTTP/1.1 push origin main
git ls-remote origin refs/heads/main
```

推送后等待 Vercel 部署，再检查：

```powershell
Invoke-WebRequest https://plan-lovat-sigma.vercel.app/?deploy-check=<sha>
```

至少确认：

- HTTP 200
- `<title>` 为 `拾序 · 智能学习计划`
- HTML 引用的是新 JS/CSS hash
- 新增资源返回 200
- 关键页面实际打开可用

Vercel 有时会短暂返回旧 HTML 或旧资源。第一次检查如果仍是旧 hash，不要立即误判失败；等待 20–30 秒后用新的查询参数重试。

## 9. 安全与数据边界

绝不能提交或展示：

- `.env`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DEEPSEEK_KEY_ENCRYPTION_KEY`
- 用户 DeepSeek API Key
- Supabase access token
- 截图中暴露的账户信息

DeepSeek Key 必须继续走：

```text
前端输入
→ 后端 JWT 校验
→ 服务端 AES-256-GCM 加密保存
→ 调用时服务端解密
```

不要为了方便把 Key 放进前端代码、普通 localStorage 或日志。

## 10. 绝对不要再踩的坑

1. 不要使用 `git reset --hard`、`git checkout --` 覆盖用户改动。
2. 不要把 `output/`、截图、构建产物和临时文件加入提交。
3. 不要把 `.env` 或任何密钥加入 Git。
4. 不要只说“已部署”，必须用 push 输出、远端 SHA 和生产 HTTP/资源检查证明。
5. 不要把 Vercel preview URL 当成稳定生产 URL。
6. 不要把桌面端手机修复写成全局 CSS 或单纯 `max-width` 性能降级。
7. 不要先关闭所有手机端毛玻璃；当前方案只做深色兜底、`100dvh` 和背景合成优化。
8. 不要把 `single_day` 理解为“必须今天”，它只要求同一天。
9. 不要把普通任务再次改回“按任务顺序一口气填满”。
10. 不要用完整 `task.minutes` 统计今日学习；必须按当天 `scheduleItems` 的真实块分钟数。
11. 不要使用 `toISOString().slice(0, 10)` 作为用户本地自然日 key，使用 `localDateKey()`。
12. 不要只展开本周的 weekly 固定课程，长期 horizon 内每周都要阻塞。
13. 不要在 `requireContinuous=false` 时强制连续安排。
14. 不要把智能排程容量冲突当成创建任务失败；应保留任务并提示缺少分钟数。
15. 不要用脆弱的 PowerShell 长字符串替换超长 JSX；优先使用 `apply_patch`，然后立即运行 typecheck。
16. Playwright/Chrome 可能不可用；如果无法真实验证，要如实报告，不能伪造验证结果。
17. 修改完成后必须检查 `git diff --check`，并确认只提交本次相关文件。

## 11. 新会话第一步

```powershell
cd C:\Users\31454\Documents\ChatGPT\学习计划网页
Get-Content HANDOFF.md -Raw
Get-Content README.md -Raw
git status --short
git log -5 --oneline --decorate
```

然后根据用户的新请求选择：

- 如果继续改网页：先阅读相关源码，确认现状，再按“修改 → 验证 → 提交 → 推送 → Production 验证”执行。
- 如果反馈移动端问题：优先在真实移动 UA/触屏上下文复现，检查 `mobile-render-fix`，不要直接修改桌面公共样式。
- 如果反馈排程问题：先在 `src/lib/scheduler.ts` 和 `scripts/scheduler.test.ts` 增加可复现测试，再改算法。
- 如果做 APK：先检查 Java、Android SDK、Gradle/Android Studio，并确认 debug APK 还是 release APK/AAB。
