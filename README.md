# HBMusic 音乐播放器

## 问题修复记录

### HTTP/HTTPS 混合内容问题修复

为了解决HTTPS网站加载HTTP资源导致的混合内容警告，我们实施了以下解决方案：

1. **添加HTTP到HTTPS自动转换函数**：
   - 在以下文件中添加了`convertHttpToHttps`函数：
     - `worker.js`（后端API代理）
     - `PlaylistsView.vue`（歌单列表页面）
     - `PlaylistDetailView.vue`（歌单详情页面）
     - `OptimizedImage.vue`（优化图片组件）
     - `MVView.vue`（MV视频播放页面）

2. **后端API代理处理**：
   - 添加了`convertHttpToHttps`递归处理函数，能够处理响应中的所有数据结构
   - 使用正则表达式处理所有可能的图片URL格式
   - 确保视频URL也被正确转换

3. **前端组件处理**：
   - 在所有加载图片URL的地方应用URL转换
   - 优化专辑图片、用户头像和视频URL的加载逻辑
   - 添加了混合内容检测脚本，用于调试

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

### Worker API 部署

Worker API代理使用Cloudflare Worker部署：

1. **安装Wrangler**：
```bash
npm install -g wrangler
```

2. **配置wrangler.toml**：
确保配置包含API代理路由

3. **部署Worker**：
```bash
wrangler publish
```

## 功能特性

- 🎵 音乐搜索和播放
- 📋 歌单浏览和管理
- 📊 排行榜查看
- 🎬 MV观看
- 🌐 多API源支持
- 🔄 自动将HTTP资源转换为HTTPS
- 🎨 美观的UI设计

## 技术栈

- Vue 3 + Vite
- Pinia 状态管理
- Cloudflare Workers (API代理)
- Element Plus UI组件

## 项目结构

这个项目使用前后端分离的架构：

- `frontend/music-player-app`: 使用Vue 3构建的前端应用
- `backend`: 使用Node.js构建的后端服务器

## 项目说明

原始项目中根目录的`src`文件夹已被合并到`frontend/music-player-app/src`中，以避免代码重复和结构混乱。现在所有前端代码都位于前端项目文件夹中，后端代码位于后端文件夹中。 