# HBMusic 音乐播放器

## 项目结构

这个项目使用前后端分离的架构：

- `frontend/music-player-app`: 使用Vue 3构建的前端应用
- `backend`: 使用Node.js构建的后端服务器

## 开发指南

### 安装依赖

```bash
# 安装根项目、前端和后端的所有依赖
npm install
```

### 运行开发环境

```bash
# 同时启动前端和后端
npm run dev

# 或者分别启动
npm run frontend:dev
npm run backend:start
```

### 构建生产版本

```bash
npm run build
```

## 项目说明

原始项目中根目录的`src`文件夹已被合并到`frontend/music-player-app/src`中，以避免代码重复和结构混乱。现在所有前端代码都位于前端项目文件夹中，后端代码位于后端文件夹中。 