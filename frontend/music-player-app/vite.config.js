import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { resolve } from 'path'
import { VitePWA } from 'vite-plugin-pwa'
import removeConsole from 'vite-plugin-remove-console'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // 根据当前工作目录中的 `mode` 加载 .env 文件
  // 设置第三个参数为 '' 来加载所有环境变量，而不管是否有 `VITE_` 前缀。
  const env = loadEnv(mode, process.cwd(), '')

  console.log(`构建模式: ${mode}, API基础URL: ${env.VITE_MAIN_API_BASE}`);

  return {
    plugins: [
      vue(),
      vueDevTools(),
      // 在生产环境中移除所有console.log
      mode === 'production' && removeConsole(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'icons/*.png'],
        manifest: {
          name: 'YMMusic',
          short_name: 'YMMusic',
          description: '一个优雅的音乐播放器',
          theme_color: '#1d1f23',
          background_color: '#1d1f23',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            {
              src: './icons/icon-72x72.png',
              sizes: '72x72',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: './icons/icon-96x96.png',
              sizes: '96x96',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: './icons/icon-128x128.png',
              sizes: '128x128',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: './icons/icon-144x144.png',
              sizes: '144x144',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: './icons/icon-152x152.png',
              sizes: '152x152',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: './icons/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: './icons/icon-384x384.png',
              sizes: '384x384',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: './icons/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          // Workbox选项
          runtimeCaching: [
            {
              // 缓存API请求
              urlPattern: /^https:\/\/api\.931125\.xyz\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 24 * 60 * 60 // 24小时
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              // 缓存歌曲资源
              urlPattern: /.*\.(mp3|flac|wav|aac|m4a)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'audio-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 7 * 24 * 60 * 60 // 7天
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              // 缓存图片
              urlPattern: /.*\.(png|jpg|jpeg|svg|gif|webp)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'image-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 30 * 24 * 60 * 60 // 30天
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
        },
      },
      base: './',
    },
    // 设置一个全局变量，以便在应用中访问当前环境
    define: {
      __APP_MODE__: JSON.stringify(mode),
      __APP_ENV__: JSON.stringify(env),
    },
    // 开发服务器配置
    server: {
      port: 5173,
      open: true,
      proxy: {
        // 开发环境下的API代理
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        }
      }
    }
  }
})
