# 公众号音频播报 📻

纯前端 Web 应用，可部署到 Vercel。配置要跟踪的微信公众号，每天自动扫描更新，用 TTS 朗读文章。

## 功能

- **公众号管理** — 添加/编辑/启用/禁用跟踪的公众号
- **定时扫描** — 通过 Vercel Cron Job 每天定时扫描 RSS 更新
- **文章列表** — 展示所有文章，标记已读/未读
- **音频生成** — 点击生成语音（通过 Google TTS API）
- **顺序播放** — 底部播放器支持播放队列、上一首/下一首、暂停/恢复
- **定时配置** — 配置每日扫描时间、语速、音量

## 技术栈

- React 18 + TypeScript
- Vite 6
- IndexedDB (idb) 本地存储
- Web Speech API 浏览器朗读
- Vercel Serverless Functions 后端 API
- Vercel Cron Jobs 定时任务

## 本地运行

```bash
cd wechat-audio-reader
npm install
npm run dev
```

打开 http://localhost:3000

## 部署到 Vercel

### 方式一：通过 Vercel CLI

```bash
# 安装并登录
npx vercel login

# 部署
npx vercel --prod
```

### 方式二：通过 GitHub 集成（推荐）

1. 将项目推送到 GitHub
2. 在 [vercel.com](https://vercel.com) 导入该仓库
3. Vercel 会自动检测 Vite 配置
4. 部署完成后，Cron Job 需要手动设置

### 配置 Cron Job

部署后，修改 `vercel.json` 中的扫描时间：

```json
{
  "crons": [
    {
      "path": "/api/scan",
      "schedule": "0 8 * * *"   // 每天北京时间 8:00 (UTC 0:00)
    }
  ]
}
```

Cron 表达式格式：(UTC 时间，北京时间需要减 8 小时)
- `"0 0 * * *"` = 每天北京时间 8:00
- `"0 2 * * *"` = 每天北京时间 10:00
- `"30 6 * * *"` = 每天北京时间 14:30

## 项目结构

```
wechat-audio-reader/
├── api/
│   ├── scan.ts              # 扫描 API (RSS 获取文章)
│   └── generate-audio.ts     # TTS 生成 API
├── src/
│   ├── components/
│   │   ├── AccountConfigPanel.tsx  # 公众号管理
│   │   ├── ArticleList.tsx         # 文章列表
│   │   ├── AudioPlayer.tsx         # 音频播放器
│   │   └── SettingsPanel.tsx       # 设置面板
│   ├── App.tsx              # 主应用
│   ├── store.ts             # IndexedDB 存储
│   ├── api.ts               # API 客户端
│   ├── types.ts             # 类型定义
│   └── main.tsx             # 入口
├── vercel.json              # Vercel 配置 (Cron Jobs)
└── package.json
```

## 注意事项

- 公众号文章通过 RSSHub 公共实例获取，可能存在网络延迟
- TTS 通过 Google TTS API 生成，单次请求限 200 字符
- 浏览器朗读使用 Web Speech API，需要 Chrome 或 Edge
- IndexedDB 存储数据在浏览器本地，清除缓存会丢失
