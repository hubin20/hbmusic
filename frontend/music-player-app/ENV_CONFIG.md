# HBMusic 环境变量配置说明

本文档说明了 HBMusic 项目中使用的环境变量配置及其用途。

## 环境变量文件

项目使用以下环境变量文件：

- `.env` - 基础环境变量，会被各模式特定的环境变量覆盖
- `.env.development` - 开发环境特定配置（使用 `npm run dev` 时加载）
- `.env.production` - 生产环境特定配置（使用 `npm run build` 时加载）

## 关键环境变量

### API 配置

| 变量名 | 说明 | 默认值 |
|-------|------|-------|
| `VITE_MAIN_API_BASE` | 主 API 基础 URL | `https://api.931125.xyz` |
| `VITE_FALLBACK_API_BASE` | 备用 API 基础 URL | `https://kw-api.cenguigui.cn` |
| `VITE_BACKEND_API_URL` | 后端服务 API URL | 开发: `http://localhost:3000/api`<br>生产: 根据部署环境配置 |

### ID 前缀配置

| 变量名 | 说明 | 默认值 |
|-------|------|-------|
| `VITE_USE_ID_PREFIX` | 是否使用 ID 前缀来区分不同来源的歌曲 | `true` |
| `VITE_MAIN_ID_PREFIX` | 主 API 歌曲 ID 前缀 | `main_` |
| `VITE_KW_ID_PREFIX` | 备用 API (酷我) 歌曲 ID 前缀 | `kw_` |

## 配置说明

### ID 前缀机制

为解决多 API 来源歌曲 ID 冲突问题，系统使用前缀标识歌曲来源：

1. 主 API (网易云) 的歌曲 ID 会添加 `main_` 前缀
2. 备用 API (酷我) 的歌曲 ID 会添加 `kw_` 前缀

在 API 请求时，前缀会自动处理：
- 发送请求前，从 ID 中移除前缀，只发送纯数字 ID
- 处理响应时，为歌曲 ID 添加适当前缀

这样设计确保：
- 多 API 来源的歌曲 ID 不会冲突
- 播放器可以根据 ID 前缀判断歌曲来源，使用对应的 API 获取歌曲 URL
- 缓存机制可以正常工作，不会出现 ID 冲突

## 自定义配置

如需为本地开发环境自定义配置，可以创建 `.env.local` 文件，该文件不会被提交到版本控制系统。

示例：
```
VITE_MAIN_API_BASE=http://your-custom-api.com
VITE_USE_ID_PREFIX=false
```

## 注意事项

- 所有前端可访问的环境变量必须以 `VITE_` 开头
- 后端服务的环境变量可以通过系统环境变量设置，或在运行时从前端的 `.env` 文件加载
- 修改环境变量后需要重启开发服务器才能生效 