import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'
import { usePlayerStore } from './stores/player'
import { registerUserInteractionHandler } from './utils/navigationGuard'
import { initMediaSessionHandler, watchPlayerChanges } from './utils/mediaSessionHandler'

const app = createApp(App)

// 注册所有 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

const pinia = createPinia()
app.use(pinia)
app.use(router)
app.use(ElementPlus)

const playerStore = usePlayerStore()
playerStore.router = router

// 初始化媒体会话处理程序
const mediaControls = initMediaSessionHandler()
watchPlayerChanges(playerStore, mediaControls)

// 注册导航守卫的全局用户交互处理程序
registerUserInteractionHandler()

app.mount('#app')

// 添加全局的音频恢复机制
document.addEventListener('visibilitychange', () => {
  // 当页面从隐藏变为可见时
  if (!document.hidden) {
    try {
      // 直接使用已导入的playerStore实例，而不是尝试从appContext获取
      if (playerStore && playerStore.currentSong && playerStore.isPlaying) {
        // 检查音频元素是否暂停
        const audio = document.querySelector('audio')
        if (audio && audio.paused) {
          // 尝试恢复播放
          console.log('[main.js] 页面可见性变更，尝试恢复播放')

          // 延迟一点再尝试播放，给浏览器一点时间准备
          setTimeout(() => {
            // 先尝试更新媒体会话
            if ('mediaSession' in navigator) {
              navigator.mediaSession.metadata = new MediaMetadata({
                title: playerStore.currentSong.name,
                artist: playerStore.currentSong.artist,
                album: playerStore.currentSong.album,
                artwork: [
                  { src: playerStore.currentSong.albumArt, sizes: '512x512', type: 'image/jpeg' }
                ]
              });
            }

            // 更新Android通知
            if (mediaControls) {
              mediaControls.updateNowPlaying();
            }

            // 然后尝试播放
            audio.play().catch(err => {
              console.warn('[main.js] 自动恢复播放失败:', err)
              window._needManualPlayResume = true

              // 在失败后，再尝试一次
              setTimeout(() => {
                if (playerStore.isPlaying && audio.paused) {
                  console.log('[main.js] 再次尝试恢复播放')
                  audio.play().catch(() => { })
                }
              }, 1000)
            })
          }, 300)
        }
      }
    } catch (error) {
      console.error('[main.js] 恢复播放时出错:', error)
    }
  } else {
    // 页面进入后台，记录当前状态
    if (playerStore && playerStore.currentSong && playerStore.isPlaying) {
      // 标记当前正在后台播放
      window._isBackgroundPlaying = true
      console.log('[main.js] 页面进入后台，标记后台播放状态')

      // 如果在Android环境中，检查原生服务是否运行
      checkAndUpdateAndroidService();
    }
  }
})

/**
 * 检查并更新Android原生服务
 */
function checkAndUpdateAndroidService() {
  // 检查是否在Android环境中
  if (window.AndroidPlayer) {
    try {
      // 检查服务是否运行
      const isRunning = typeof window.AndroidPlayer.isServiceRunning === 'function'
        ? window.AndroidPlayer.isServiceRunning()
        : false;

      console.log(`[main.js] Android音乐服务状态: ${isRunning ? '运行中' : '未运行'}`);

      // 如果服务正在运行，更新当前播放信息
      if (isRunning && playerStore.currentSong) {
        if (typeof window.AndroidPlayer.updateNowPlaying === 'function') {
          window.AndroidPlayer.updateNowPlaying(
            playerStore.currentSong.name || '未知歌曲',
            playerStore.currentSong.artist || '未知艺术家'
          );

          // 更新播放状态
          if (typeof window.AndroidPlayer.setPlayingState === 'function') {
            window.AndroidPlayer.setPlayingState(playerStore.isPlaying);
          }

          console.log('[main.js] 已更新Android通知信息');
        }
      }
    } catch (err) {
      console.warn('[main.js] Android服务通信错误:', err);
    }
  }
}

// 全局Toast显示函数
window.showToast = (message) => {
  // 创建Toast元素
  let toast = document.createElement('div');
  toast.className = 'app-toast';
  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.bottom = '70px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  toast.style.color = 'white';
  toast.style.padding = '10px 20px';
  toast.style.borderRadius = '20px';
  toast.style.zIndex = '10000';
  toast.style.fontSize = '14px';

  // 添加到页面
  document.body.appendChild(toast);

  // 2秒后自动移除
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.5s';
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 500);
  }, 2000);
};

// 关闭当前活动的模态框
window.closeActiveModal = () => {
  // 查找所有可能的模态框元素
  const searchModal = document.querySelector('.search-modal-overlay');
  const backgroundSelector = document.querySelector('.background-selector-overlay');

  // 如果找到模态框，模拟点击关闭按钮
  if (searchModal) {
    const closeButton = searchModal.querySelector('.close-button');
    if (closeButton) closeButton.click();
    return true;
  }

  if (backgroundSelector) {
    const closeButton = backgroundSelector.querySelector('.close-button');
    if (closeButton) closeButton.click();
    return true;
  }

  return false;
};

// 监听Service Worker消息
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'apiCacheCleared') {
      window.showToast('缓存已清除');
    }
  });
}

// 缓存初始数据
if (app.config.globalProperties.$pinia) {
  playerStore.restoreSavedState().then(() => {
    console.log('应用启动时已恢复保存的状态');

    // 初始化媒体会话信息
    if (playerStore.currentSong) {
      mediaControls.updateNowPlaying();
    }
  }).catch(err => {
    console.error('恢复状态时出错:', err);
  });
}

// 注册Service Worker更新检查
if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

// 处理Android返回键
document.addEventListener('backbutton', (e) => {
  e.preventDefault();
  e.stopPropagation();

  // 已经在index.html中实现了返回键处理逻辑

}, false);
