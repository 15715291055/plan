# 知行 · 智能学习计划

第一版演示采用 Vite + React + TypeScript，完成“今日计划 → 临时任务 → 专注计时 → 周计划查看”的前端闭环。当前数据使用浏览器 `localStorage`，便于在没有后端服务时体验产品流程。

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

后续接入 DeepSeek 时，可直接在数据层旁新增 API hooks，保留现有页面组件与交互结构。

## 接入 Supabase

第一阶段的数据适配已经内置在 `src/lib/data.ts`。配置以下 Vite 变量后，应用会读取当前登录用户的 Supabase 数据；未登录或未配置时会明确显示“本地数据”，并继续使用浏览器本地存储：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

在 Supabase SQL Editor 中执行 [`supabase/schema.sql`](supabase/schema.sql)，它会创建课程、任务、可用时间、固定课程、计划、资料、学习记录和每周输入表，并为用户数据启用 RLS。当前页面已经接通任务状态更新、任务新增/编辑/删除、课程新增/删除和云端资料读取；登录表单与文件 Storage 上传会在下一阶段接入。
