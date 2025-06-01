<template>
  <div class="top-nav-bar">
    <div class="nav-tabs">
      <button 
        v-for="tab in navTabs" 
        :key="tab.name" 
        class="nav-tab" 
        :class="{ active: isTabActive(tab) }" 
        @click="navigateTo(tab.path)"
      >
        <el-icon class="icon"><component :is="tab.iconComponent" /></el-icon> {{ tab.name }}
      </button>
      <button class="nav-tab search-tab" @click="showSearchModal">
        <el-icon class="icon"><Search /></el-icon> 搜索
      </button>
    </div>
    <div class="nav-actions">
      <button class="icon-button action-icon" @click="openExternalLink('https://tv.931125.xyz/')">
        <el-icon><VideoCamera /></el-icon>
      </button>
      <button class="icon-button action-icon" @click="$emit('openBackgroundSelector')">
        <el-icon><Setting /></el-icon>
      </button>
      
      <!-- 倍速控制按钮 -->
      <div class="speed-control-container">
        <button class="icon-button playback-speed" @click="toggleSpeedDropdown">
          {{ currentPlaybackSpeed }}x
        </button>
        <button class="icon-button action-icon speed-toggle" @click="toggleSpeedDropdown">
          <el-icon><ArrowDownBold /></el-icon>
        </button>
        
        <!-- 倍速选择下拉菜单 -->
        <div class="speed-dropdown" v-if="showSpeedDropdown" @click.stop>
          <div 
            v-for="speed in playbackSpeeds" 
            :key="speed" 
            class="speed-option" 
            :class="{ active: speed === currentPlaybackSpeedValue }"
            @click="changePlaybackSpeed(speed)"
          >
            {{ speed }}x
          </div>
        </div>
      </div>
    </div>
    
    <!-- 搜索模态框 -->
    <SearchModal 
      :visible="isSearchModalVisible" 
      @close="hideSearchModal" 
      @search="handleSearch"
    />
  </div>
</template>

<script setup>
import { useRouter, useRoute } from 'vue-router';
import {
  Headset,
  VideoPlay,
  Files,
  Search,
  VideoCamera,
  Setting,
  ArrowDownBold
} from '@element-plus/icons-vue';
import { shallowRef, ref, defineEmits, onBeforeUnmount, onMounted } from 'vue'; // 添加ref和defineEmits
import { usePlayerStore } from '../stores/player';
import { computed } from 'vue';
import SearchModal from './SearchModal.vue'; // 导入搜索模态框组件

const router = useRouter();
const route = useRoute(); // 获取当前路由信息，虽然上面模板直接用了 $route
const playerStore = usePlayerStore();

// 定义emit
const emit = defineEmits(['openBackgroundSelector']);

// 搜索模态框显示状态
const isSearchModalVisible = ref(false);

const navTabs = shallowRef([
  { name: '歌词', path: '/lyrics', iconComponent: Headset },
  { name: '播放', path: '/', iconComponent: VideoPlay },      // "播放"指向根路径
  { name: '歌单', path: '/playlists', iconComponent: Files }, // 更新歌单路径为 /playlists
  // 搜索标签在模板中单独处理，如果它也代表一个主要视图切换，则可加入此数组
  // 例如: { name: '搜索', path: '/search', iconComponent: Search }
]);

const navigateTo = (path) => {
  // 路径安全检查
  if (!path) {
    console.error('导航错误: 无效的路径', path);
    return;
  }
  
  try {
    // 检查路径是否包含undefined
    if (String(path).includes('undefined')) {
      console.error('导航错误: 路径包含undefined', path);
      return;
    }
    
    console.log('导航到路径:', path);
    
    // 特殊处理从歌词页面返回的情况
    if (route.path === '/lyrics' && path !== '/lyrics') {
      const previousRoute = localStorage.getItem('previousRouteBeforeLyrics');
      if (previousRoute) {
        console.log('[TopNavBar] 从歌词页面返回到之前的页面:', previousRoute);
        
        // 清除可能存在的MV相关状态标记，防止影响播放状态
        localStorage.removeItem('musicPausedForMV');
        localStorage.removeItem('musicWasPlaying');
        localStorage.removeItem('isFromMV');
        sessionStorage.removeItem('mv_return_playstate');
        sessionStorage.removeItem('mv_return_timestamp');
        
        // 保证播放状态不受影响
        if (window._fromMVToPlaylist) window._fromMVToPlaylist = false;
        
        // 尝试解析之前的路由
        try {
          // 如果是完整URL，提取路径部分
          let pathToNavigate = previousRoute;
          if (previousRoute.includes('://')) {
            const url = new URL(previousRoute);
            pathToNavigate = url.pathname + url.search;
          }
          
          // 检查是否是歌单详情页面
          if (pathToNavigate.includes('/playlist/')) {
            router.push(pathToNavigate);
            localStorage.removeItem('previousRouteBeforeLyrics');
            return;
          }
        } catch (e) {
          console.error('[TopNavBar] 解析之前的路由出错:', e);
        }
      }
    }
    
    // 特殊处理MV标签页
    if (path === '/playlists' && route.query.tab === 'mv') {
      // 当从MV标签导航到其他页面时，确保清除tab参数
      router.push({ path: path });
      return;
    }
    
    // 安全导航
    router.push(path).catch(err => {
      console.error('导航错误:', err);
      // 尝试使用原生方法导航
      if (typeof path === 'string' && !path.includes('undefined')) {
        window.location.href = path;
      }
    });
  } catch (error) {
    console.error('导航处理错误:', error);
  }
};

// 显示搜索模态框
const showSearchModal = () => {
  isSearchModalVisible.value = true;
};

// 隐藏搜索模态框
const hideSearchModal = () => {
  isSearchModalVisible.value = false;
};

// 处理搜索请求
const handleSearch = (query, type = 'song') => {
  console.log('搜索关键词:', query, '搜索类型:', type);
  // 跳转到搜索结果页面，带上查询参数和类型参数
  router.push({ path: '/search', query: { q: query, type: type } });
  hideSearchModal(); // 搜索后隐藏模态框
};

// 判断标签是否激活
const isTabActive = (tab) => {
  try {
    // 处理常规路径匹配
  if (tab.path === '/lyrics') {
    return route.path === '/lyrics';
  } else if (tab.path === '/') {
    return route.path === '/' || route.path === '/playlist-display';
  } else if (tab.path === '/playlists') {
      // 检查是否在MV详情页
      if (route.path.startsWith('/mv/')) {
        return true; // MV详情页也属于歌单标签
      }
      
    // 歌单路径匹配 /playlists 或 /playlist/xxx
    return route.path === '/playlists' || route.path.startsWith('/playlist/');
  }
    
  return route.path === tab.path;
  } catch (error) {
    console.error('isTabActive错误:', error);
    return false;
  }
};

const isActive = (item) => {
  // 对于歌词，如果浮层显示，则它视觉上是"激活"的
  if (item.name === 'lyrics') {
    return playerStore.showLyricsView;
  }
  // 对于"播放"和"歌单"，它们都指向PlaylistView，但根据路径来区分激活
  // 如果当前路径是 / 且 item 是 'now-playing'，则激活
  // 如果当前路径是 /playlist-display 且 item 是 'playlist-display'，则激活
  if ((route.path === '/' && item.name === 'now-playing') || 
      (route.path === '/playlist-display' && item.name === 'playlist-display')) {
    return true;
  }
  // 如果是其他普通路由，直接比较路径
  return route.path === item.path && item.name !== 'now-playing' && item.name !== 'playlist-display';
};

const handleNavClick = (item) => {
  try {
  if (item.name === 'lyrics') {
    playerStore.toggleLyricsView(); // 切换歌词浮层的显示状态
    // 如果歌词浮层被打开，并且当前不在 /lyrics，则导航过去
    if (playerStore.showLyricsView && route.path !== '/lyrics') {
      router.push('/lyrics');
    } 
  } else if (item.name === '播放' && route.path === '/') {
    // 如果已经在播放页面，不做任何路由跳转，防止重置状态
    console.log('已经在播放页面，不进行导航');
    return;
  } else {
    // 如果点击的不是歌词，并且歌词浮层是打开的，那么先关闭歌词浮层
    if (playerStore.showLyricsView) {
      playerStore.toggleLyricsView();
    }
      
      // 特殊处理歌单标签，保留当前tab参数
      if (item.path === '/playlists' && route.path === '/playlists' && route.query.tab) {
        // 已经在歌单页面，只是切换标签，不需要导航
        return;
      }
      
      // 安全导航
      router.push(item.path).catch(err => {
        console.error('导航错误:', err);
        // 使用原生方法导航
        if (typeof item.path === 'string' && !item.path.includes('undefined')) {
          window.location.href = item.path;
        }
      });
    }
  } catch (error) {
    console.error('处理导航点击错误:', error);
  }
};

// 添加一个方法用于外部链接跳转
const openExternalLink = (url) => {
  window.open(url, '_blank');
};

// 倍速播放相关
const showSpeedDropdown = ref(false);
const playbackSpeeds = [0.5, 0.8, 0.9, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 3.5, 4.0];
const currentPlaybackSpeedValue = ref(1.0); // 默认速度值

// 格式化显示的倍速值
const currentPlaybackSpeed = computed(() => {
  return currentPlaybackSpeedValue.value.toFixed(1).replace(/\.0$/, '');
});

// 切换倍速选择下拉菜单
const toggleSpeedDropdown = () => {
  showSpeedDropdown.value = !showSpeedDropdown.value;
  // 如果显示下拉菜单，添加点击外部关闭事件
  if (showSpeedDropdown.value) {
    setTimeout(() => {
      document.addEventListener('click', closeSpeedDropdown);
    }, 0);
  }
};

// 关闭倍速选择下拉菜单
const closeSpeedDropdown = () => {
  showSpeedDropdown.value = false;
  document.removeEventListener('click', closeSpeedDropdown);
};

// 更改播放速度
const changePlaybackSpeed = (speed) => {
  currentPlaybackSpeedValue.value = speed;
  
  // 获取音频元素
  const audioElement = document.getElementById('audio-player');
  if (audioElement) {
    // 设置播放速度
    audioElement.playbackRate = speed;
    
    // 保存当前速度到localStorage
    localStorage.setItem('playbackSpeed', speed.toString());
  }
  
  // 使用closeSpeedDropdown函数来关闭下拉框，它会同时移除事件监听器
  closeSpeedDropdown();
};

// 组件挂载时初始化倍速设置
onMounted(() => {
  // 从localStorage读取保存的倍速设置
  const savedSpeed = localStorage.getItem('playbackSpeed');
  if (savedSpeed) {
    const speedValue = parseFloat(savedSpeed);
    currentPlaybackSpeedValue.value = speedValue;
    
    // 应用到当前音频元素
    const audioElement = document.getElementById('audio-player');
    if (audioElement) {
      audioElement.playbackRate = speedValue;
    }
  }
});

// 组件卸载前清理事件监听
onBeforeUnmount(() => {
  document.removeEventListener('click', closeSpeedDropdown);
});

// TODO: Add logic for search functionality, and action buttons
</script>

<style scoped>
.top-nav-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 8px;
  height: 55px;
  background-color: transparent;
  color: #fff;
  flex-shrink: 0;
  /* box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); */ /* 暂时移除阴影，看是否与新背景冲突 */
}

.nav-tabs {
  display: flex;
  align-items: center;
  height: 100%;
}

.nav-tab {
  background: none;
  border: none;
  color: #d0d8e8;
  font-size: 0.9rem;
  padding: 0 6px;
  height: calc(100% - 16px);
  margin: 8px 1px;
  display: flex;
  align-items: center;
  cursor: pointer;
  position: relative;
  transition: color 0.2s, background-color 0.2s;
  white-space: nowrap;
  border-radius: 6px;
}

.nav-tab .icon {
  margin-right: 2px;
  font-size: 1rem;
  vertical-align: middle;
}

.nav-tab:hover {
  color: #fff;
  background-color: rgba(255, 255, 255, 0.05);
}

.nav-tab.active {
  color: #fff;
  font-weight: 600;
  background-color: rgba(255, 255, 255, 0.15);
}

.nav-tab.active::after {
  content: '';
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-top: 7px solid rgba(255, 255, 255, 0.15);
}

.search-tab {
  /* padding: 0 10px; */ /* 确保搜索tab也有合适的padding */
  /* border-radius: 6px; */ /* 确保搜索tab也有圆角 */
}

.search-tab .icon {
  margin-right: 3px;
  font-size: 1rem;
  vertical-align: middle;
}

.nav-actions {
  display: flex;
  align-items: center;
}

.nav-actions .icon-button {
  background: none;
  border: none;
  color: #d0d8e8;
  font-size: 1rem;
  padding: 4px;
  margin-left: 2px;
  cursor: pointer;
  transition: color 0.2s, background-color 0.2s;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.nav-actions .icon-button .el-icon {
  font-size: 1rem;
}


.nav-actions .icon-button.action-icon .el-icon {
  font-size: 1.1rem;
}

.nav-actions .icon-button:hover {
  color: #fff;
  background-color: rgba(255, 255, 255, 0.1);
}

.playback-speed {
    font-size: 0.8rem;
    padding: 3px 5px;
    border: 1px solid #ffcc00; /* 黄色边框 */
    border-radius: 15px;
    min-width: 24px;
    text-align: center;
    color: #ffcc00; /* 黄色文字 */
}
.playback-speed:hover {
    border-color: #ffdd00;
    color: #ffdd00;
    background-color: rgba(255, 204, 0, 0.1); /* 添加悬停时的背景 */
}

/* 倍速控制相关样式 */
.speed-control-container {
  position: relative;
  display: flex;
  align-items: center;
  margin-left: 5px;
}

.speed-toggle {
  margin-left: 0;
  padding-left: 2px;
  color: rgba(255, 204, 0, 0.9); /* 黄色图标 */
}

.speed-toggle:hover {
  color: #ffcc00;
}

.speed-dropdown {
  position: absolute;
  top: calc(100% + 5px);
  right: 0;
  width: 90px;
  background-color: rgba(255, 255, 255, 0.03); /* 更透明的背景 */
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  z-index: 1000;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.08); /* 与搜索框一致的边框 */
  animation: fadeIn 0.2s ease-out;
  padding: 5px 0;
}

.speed-option {
  padding: 8px 15px;
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.85rem;
  font-weight: 500;
}

.speed-option:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.speed-option.active {
  background-color: rgba(255, 204, 0, 0.2); /* 使用黄色高亮 */
  color: #ffcc00; /* 黄色文字 */
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
