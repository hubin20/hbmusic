# YMMusic 音乐播放器

一个功能丰富的音乐播放器应用，支持多API源、歌单管理、MV播放、本地收藏等功能，并提供Android移动应用打包能力。

## 项目特色

- 🎵 **双API源支持**：主API和备用API互相补充，提高歌曲可用性
- 📱 **移动应用支持**：使用Capacitor打包为Android应用
- 🎬 **高清MV播放**：支持4K高清MV播放
- 📃 **智能歌词显示**：支持翻译歌词和自动滚动
- 💾 **本地收藏功能**：完全基于localStorage的收藏系统，无需登录
- 🔄 **页面缓存机制**：优化页面间导航体验，减少重复加载
- 🌐 **HTTPS安全**：自动将HTTP资源转换为HTTPS
- 🎨 **美观的UI设计**：现代化界面，支持自定义背景

## 功能列表

- **音乐播放**：播放、暂停、上一首、下一首、音量控制
- **播放模式**：顺序播放、单曲循环、随机播放
- **搜索功能**：支持歌曲、歌单、专辑、MV搜索
- **歌单管理**：浏览、收藏、播放歌单
- **排行榜**：查看各类音乐排行榜
- **MV播放**：支持高清MV播放
- **本地收藏**：收藏歌曲、歌单、MV、专辑到本地
- **专辑详情**：查看专辑信息和曲目列表
- **歌词显示**：支持翻译歌词和自动滚动
- **页面缓存**：优化页面间导航体验

## 技术栈

### 前端
- **Vue 3 + Vite**：现代化的前端框架和构建工具
- **Pinia**：状态管理库
- **Vue Router**：路由管理
- **Element Plus**：UI组件库
- **Capacitor**：Web应用转原生应用框架

### 后端
- **Node.js + Express**：后端服务器
- **Cloudflare Workers**：API代理服务
- **Axios**：HTTP客户端

## 项目结构

```
hbmusic/
├── frontend/
│   └── music-player-app/      # Vue 3前端应用
│       ├── src/               # 源代码
│       ├── public/            # 静态资源
│       ├── android/           # Android打包配置
│       └── dist/              # 构建输出
├── backend/                   # 后端服务
│   ├── server.js              # Express服务器
│   └── worker.js              # Cloudflare Worker
└── images/                    # 项目相关图片
```

## 最近改进

### 缓存机制优化
- 添加页面间导航缓存，避免重复加载数据
- 实现滚动位置记忆功能，提升用户体验

### 音质提升
- 酷我API音质从exhigh/hires升级到lossless
- 支持HR高解析音质标识显示

### UI优化
- MV详情页样式优化，移除黑色背景框
- 返回按钮改为透明风格
- 添加带绿色背景的"HR"高解析度音质标签

### 导航逻辑优化
- 优化歌单详情页返回逻辑，确保返回到歌单列表页

### HTTP/HTTPS 混合内容问题修复
- 添加HTTP到HTTPS自动转换函数
- 递归处理API响应中的所有数据结构
- 确保图片和视频URL安全加载

## 使用指南

### 开发环境设置

1. **安装依赖**：
```bash
npm install
```

2. **启动开发服务器**：
```bash
npm run dev
```

3. **构建生产版本**：
```bash
npm run build
```

### Android应用打包

1. **构建Web应用**：
```bash
cd frontend/music-player-app
npm run build
```

2. **同步到Android项目**：
```bash
npx cap sync android
```

3. **打开Android Studio**：
```bash
npx cap open android
```

4. **在Android Studio中构建APK**：
   - 点击"Build" > "Build Bundle(s) / APK(s)" > "Build APK(s)"
   - 或者使用Gradle命令: `./gradlew assembleDebug`

### Worker API 部署

Worker API代理使用Cloudflare Worker部署：

1. **安装Wrangler**：
```bash
npm install -g wrangler
```

2. **部署Worker**：
```bash
cd backend
npm run worker:deploy
```

## 数据来源

- **主API**: https://api.931125.xyz
  - 接口文档: https://binaryify.github.io/NeteaseCloudMusicApi/#/?id=neteasecloudmusicapi
  - 包含解灰服务，可能请求较慢

- **备用API**: https://kw-api.cenguigui.cn
  - 接口文档: https://kw-api.cenguigui.cn/
  - 用于补充主API的不可用资源

## 贡献指南

欢迎贡献代码、报告问题或提供改进建议。请确保遵循以下步骤：

1. Fork项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request 
