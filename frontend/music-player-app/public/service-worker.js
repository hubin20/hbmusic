/**
 * HBMusic Service Worker
 * 用于离线缓存和请求拦截
 */

const CACHE_NAME = 'hbmusic-v1';
const API_CACHE_NAME = 'hbmusic-api-v1';

// 需要缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// 需要缓存的API请求URL模式
const API_URL_PATTERNS = [
  /.*\/playlist\/detail.*/,
  /.*\/song\/detail.*/,
  /.*\/song\/url.*/,
  /.*\/lyric.*/,
  /.*\/toplist.*/,
  /.*\/top\/playlist.*/,
  /.*\/search.*/,
  /.*\/mv\/url.*/,
  /.*\/mv\/detail.*/,
  /.*\/recommend\/resource.*/
];

// 安装事件 - 预缓存静态资源
self.addEventListener('install', (event) => {
  console.log('[Service Worker] 安装');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] 预缓存静态资源');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] 激活');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((cacheName) => {
          return (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME);
        }).map((cacheName) => {
          console.log('[Service Worker] 删除旧缓存:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 检查URL是否匹配API模式
function isApiUrl(url) {
  return API_URL_PATTERNS.some(pattern => pattern.test(url));
}

// 获取请求的缓存键
function getCacheKey(request) {
  const url = new URL(request.url);

  // 对于API请求，我们使用URL的pathname和search作为缓存键
  if (isApiUrl(request.url)) {
    return `${url.pathname}${url.search}`;
  }

  // 对于其他请求，直接使用URL
  return request.url;
}

// 拦截请求事件
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 跳过不支持的请求方法和非GET请求
  if (request.method !== 'GET') {
    return;
  }

  // API请求的处理策略：网络优先，失败后使用缓存
  if (isApiUrl(request.url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 如果请求成功，复制响应并缓存
          const responseToCache = response.clone();
          caches.open(API_CACHE_NAME)
            .then((cache) => {
              cache.put(getCacheKey(request), responseToCache);
            });
          return response;
        })
        .catch(() => {
          // 网络请求失败，尝试从缓存获取
          return caches.open(API_CACHE_NAME)
            .then((cache) => {
              return cache.match(getCacheKey(request))
                .then((cachedResponse) => {
                  // 如果找到缓存的响应，返回它
                  if (cachedResponse) {
                    console.log('[Service Worker] 使用缓存的API响应:', request.url);
                    return cachedResponse;
                  }
                  // 如果没有缓存，抛出错误
                  throw new Error('No cached response found');
                });
            });
        })
    );
    return;
  }

  // 静态资源的处理策略：缓存优先，失败后网络请求
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        // 缓存中没有找到，从网络获取
        return fetch(request)
          .then((response) => {
            // 如果响应无效，直接返回
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // 对于有效响应，复制并缓存
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });

            return response;
          });
      })
  );
});

// 后台同步事件处理
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-playlist') {
    console.log('[Service Worker] 执行后台同步: 同步播放列表');
    event.waitUntil(syncPlaylist());
  }
});

// 后台同步函数 - 同步播放列表
async function syncPlaylist() {
  try {
    // 这里可以实现将本地数据同步到服务器的逻辑
    // 比如从IndexedDB读取未同步的数据并发送到服务器
    console.log('[Service Worker] 播放列表同步完成');
  } catch (error) {
    console.error('[Service Worker] 播放列表同步失败:', error);
    throw error;
  }
}

// 消息事件处理 - 用于与主线程通信
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }

  // 清除所有API缓存
  if (event.data && event.data.action === 'clearApiCache') {
    event.waitUntil(
      caches.open(API_CACHE_NAME).then((cache) => {
        return cache.keys().then((keys) => {
          return Promise.all(keys.map((key) => cache.delete(key)));
        });
      }).then(() => {
        console.log('[Service Worker] API缓存已清除');
        // 通知所有客户端缓存已清除
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              action: 'apiCacheCleared'
            });
          });
        });
      })
    );
  }
}); 