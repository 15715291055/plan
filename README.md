# 知行 · 智能学习计划

一个面向个人学习安排的 Web 应用。它将课程、任务、空闲时间、固定课程和学习记录整合在一起，使用可解释的规则自动生成学习计划；可选接入 Supabase 实现登录、跨设备同步，以及使用用户自己的 DeepSeek Key 辅助分析学习内容。

## 功能

- 课程与任务管理：新增、编辑、删除课程和任务；任务可暂不归属课程。
- 自动排程：避开固定课程和不可用时间，保留缓冲时间，按截止时间、优先级和难度安排任务。
- 完成方式：支持一次性完成、必须连续完成，以及指定天数的多日分摊。
- 进度追踪：专注计时和学习记录会累计已完成分钟数；再次排程只安排剩余时长。
- 多周视野：排程最多覆盖未来 28 天；锁定或已完成的时间块不会在重排中被移动。
- 计划视图：查看每周时间块，以及新增、移动、保留和冲突等排程结果。
- 资料与 AI：上传 PDF、DOCX、PPTX 或图片，提取可用文本后生成待确认的任务草稿；也可输入本周学习内容生成草稿。
- 云端同步：使用 Supabase Auth、PostgreSQL 和 RLS 隔离各用户的课程、任务、日程、资料和学习记录。
- 个性化界面：支持风格切换、面板不透明度、按时段问候和每日英语名言。

## 技术栈

- React 18、TypeScript、Vite
- Motion、Lucide React
- Supabase Auth / PostgreSQL / Storage
- Vercel Serverless Functions
- DeepSeek API（可选）

## 快速开始

前置要求：Node.js 18 或更新版本、npm。

```bash
git clone https://github.com/15715291055/plan.git
cd plan
npm install
npm run dev
```

开发服务器默认运行在 `http://localhost:5173`。

### 常用命令

```bash
npm run typecheck  # TypeScript 类型检查
npm run lint       # 类型检查与源码安全扫描
npm test           # 排程器和每日问候的自动化测试
npm run build      # 生成生产构建
npm run preview    # 本地预览生产构建
```

## 环境变量

复制 `.env.example` 为 `.env.local`，仅在本地填写变量。不要提交 `.env` 或任何密钥。

```env
# 前端公开配置：匿名 key 由 Supabase RLS 保护
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# 服务端模型配置
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
# 可选：用于课表图片识别的视觉模型
DEEPSEEK_VISION_MODEL=

# 仅部署在 Vercel 服务端，绝不能以 VITE_ 前缀暴露
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
DEEPSEEK_KEY_ENCRYPTION_KEY=
```

`DEEPSEEK_KEY_ENCRYPTION_KEY` 必须是 64 位随机十六进制字符串，例如：

```bash
openssl rand -hex 32
```

## Supabase 配置

1. 创建 Supabase 项目，并在 Authentication 中启用 Email 登录方式。
2. 在 SQL Editor 中执行 [`supabase/schema.sql`](supabase/schema.sql)。该脚本会创建表、索引、RLS 策略和私有 `materials` Storage bucket。
3. 配置 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`，启动应用后注册或登录账户。
4. 对生产部署，另外配置服务端专用的 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` 与 `DEEPSEEK_KEY_ENCRYPTION_KEY`。

未配置 Supabase 或未登录时，应用会使用浏览器本地存储作为本地模式；数据不会自动同步到其他设备。

## 排程规则

排程器是纯函数，实现在 [`src/lib/scheduler.ts`](src/lib/scheduler.ts)，并由 [`scripts/scheduler.test.ts`](scripts/scheduler.test.ts) 覆盖关键规则。

1. 保留已完成与锁定的时间块；“保持原计划”策略还会保留其他已安排块。
2. 从可学习时段中扣除固定课程、不可用时间和每日缓冲比例。
3. 常规策略按截止时间、优先级、难度排序；紧急策略优先处理优先级更高的任务。
4. 任务按默认学习块分割，跳过过短的碎片时间；可在块之间预留休息，空间紧张时以按期完成为先。
5. 多日任务按指定天数分配，且不会超出该天数；一次性任务可要求必须存在足够长的连续空档。
6. 排程最长查看未来 28 天。有截止时间的任务不会排到截止时间之后。
7. 容量不足时，保留已成功安排的部分，并返回缺少时间或连续空档的冲突说明。

## AI 与隐私

- DeepSeek Key 由用户在应用设置中输入；服务端使用 `DEEPSEEK_KEY_ENCRYPTION_KEY` 加密后保存到当前用户的受保护记录中。
- 调用 AI 路由时，密钥只在服务端解密使用，不会写入前端代码、日志或公开环境变量。
- AI 产出始终以可编辑草稿呈现；用户确认前不会写入任务库。
- 不要在 GitHub、截图、浏览器控制台或客户端存储中暴露 `SUPABASE_SERVICE_ROLE_KEY`、DeepSeek Key 或加密密钥。

## 部署到 Vercel

1. 将仓库导入 Vercel，构建命令使用 `npm run build`。
2. 在 Vercel 的 Production、Preview、Development 环境中配置本 README 所列变量。
3. 前端变量只使用 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`；其他变量必须保持服务端私有。
4. 每次推送 `main` 分支会触发生产部署。

部署后请验证：注册/登录、任务和课程同步、重新排程、资料上传、学习记录，以及第二个账户无法读取第一个账户的数据。

## 项目结构

```text
api/                 Vercel API 路由与 DeepSeek 服务端代理
src/
  components/        界面组件与背景效果
  lib/data.ts        本地/Supabase 数据适配层
  lib/scheduler.ts   可测试的确定性排程器
  main.tsx           应用页面与交互流程
supabase/schema.sql  数据库、RLS 与 Storage 配置
scripts/             自动化测试和静态检查脚本
```

## 已知限制

- 周计划目前不支持通过拖拽直接移动时间块；可先在任务编辑中调整任务，再重新排程。
- AI 分析取决于用户自行配置的模型权限与额度；图片课表分析需要兼容的视觉模型。
- 生产环境应完成 RLS、邮件确认和多账户隔离验证后再用于真实数据。

## 许可证

本仓库当前未声明开源许可证。除非获得权利人的明确授权，请勿复制、分发或用于商业用途。
