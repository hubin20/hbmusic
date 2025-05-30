<template>
  <div class="playlist-view-container">
    <div class="playlist-sub-header">
      <span class="current-playlist-indicator">当前歌单</span>
      <span class="breadcrumb-arrow">▶</span>
      <span class="playlist-title-dynamic">{{ playerStore.currentSong?.name ? `今天从《${playerStore.currentSong.name}》听起` : '私人雷达' }}</span>
      <button class="play-all-button-small" @click="handlePlayAll">
        <span class="icon">▶</span> 播放全部
      </button>
    </div>

    <div class="list-controls-header">
      <!-- 左侧播放全部等按钮 -->
      <div class="play-actions">
        <button class="action-button primary-action">
          <span class="icon">▶</span> 播放全部
        </button>
        <button class="action-button">
          <span class="icon">+</span> 收藏全部
        </button>
      </div>
      <!-- 右侧歌曲数量 -->
      <div class="total-songs" v-if="playerStore.playlist.length > 0">
        共 {{ playerStore.playlist.length }} 首
      </div>
    </div>

    <div class="song-list-table">
      <div class="table-header-row">
        <div class="header-cell song-index-cell"></div> <!-- 序号列的表头 -->
        <div class="header-cell song-title-cell">歌曲</div>
        <div class="header-cell song-artist-cell">歌手</div>
        <div class="header-cell song-album-cell">专辑</div>
        <div class="header-cell song-duration-cell">时长</div>
        <div class="header-cell song-actions-cell">操作</div>
      </div>

      <div v-if="playerStore.playlist.length === 0" class="empty-playlist-message">
        <p>播放列表为空或正在加载...</p>
        <p v-if="!playerStore.isLoading">可以尝试 <button @click="playerStore.fetchInitialSongs()">重新加载默认歌曲</button> 或使用上方搜索。</p>
      </div>
      
      <div v-else class="song-list-body">
        <SongItem 
          v-for="(song, index) in playerStore.playlist" 
          :key="song.id" 
          :song="song" 
          :index="index"
          :is-playing="playerStore.currentSongIndex === index && playerStore.isPlaying"
          :is-current="playerStore.currentSongIndex === index"
          @play-song="playSelectedSong"
        />
      </div>
      
      <!-- 加载更多 -->
      <div v-if="isLoading" class="loading-more">
        <div class="loading-spinner"></div>
        <span>加载更多中...</span>
      </div>
      
      <div v-if="hasMore" ref="loadMoreTrigger" class="load-more-trigger">
        <button v-if="!isLoading" @click="loadMore" class="load-more-button">
          加载更多
        </button>
      </div>
    </div>

  </div>
</template>

<script setup>
// import { RouterLink } from 'vue-router'; // 如果需要导航链接则保留
import { usePlayerStore } from '../stores/player';
import SongItem from '../components/SongItem.vue';
import { ref, onMounted, onActivated, onDeactivated, nextTick, defineComponent, onUnmounted, watch, getCurrentInstance } from 'vue';
import { useRoute, useRouter } from 'vue-router';
// import { registerViewLifecycle } from '../utils/cacheManager'; // 移除自定义缓存管理器
import * as dataCache from '../stores/dataCache';

// 定义组件名称以支持keep-alive
defineComponent({
  name: 'PlaylistView'
});

// 使用name选项直接定义组件名称
const __NAME__ = 'PlaylistView';

const playerStore = usePlayerStore();
const route = useRoute();
const router = useRouter();
const instance = getCurrentInstance();

// 是否已经初始化过数据
const initialized = ref(dataCache.isInitialized());
// 是否第一次加载
const isFirstLoad = ref(true);

// 下拉加载相关状态
const isLoading = ref(false);
const hasMore = ref(true);
const loadMoreTrigger = ref(null);
let observer = null;

// 添加滚动恢复相关状态
const isRestoringScroll = ref(false);

// 注册生命周期钩子 (移除自定义 cacheManager 的使用)
/*
const { onActivated: handleActivated, onDeactivated: handleDeactivated } = registerViewLifecycle({
  viewName: 'playlist',
  instance,
  onActivate: () => {
    // ... 之前的复杂逻辑 ...
  },
  onDeactivate: () => {
    // ... 之前的复杂逻辑 ...
  }
});
*/

// 使用 Vue 内置的 onActivated 和 onDeactivated 钩子
onActivated(() => {
  // console.log('####### [PlaylistView] Component ACTIVATED #######');
  
  nextTick(() => {
    // 检查是否是从搜索页面返回
    const navigationHistory = window._navigationHistory || [];
    const lastNavigation = navigationHistory.length > 0 ? navigationHistory[navigationHistory.length - 1] : null;
    const isFromSearch = lastNavigation && lastNavigation.fromView === 'search' && lastNavigation.toView === 'playlist';
    
    if (isFromSearch) {
      console.log('[PlaylistView] 从搜索页面返回，使用搜索页面的滚动位置');
      
      // 尝试从localStorage获取搜索页面的滚动位置
      const searchScrollPos = localStorage.getItem('lastSearchScrollPosition') || 
                             localStorage.getItem('temp_scroll_search') ||
                             localStorage.getItem('scroll_pos_search');
      
      if (searchScrollPos) {
        const scrollPosition = parseInt(searchScrollPos, 10);
        const scrollElement = document.querySelector('.content-area');
        if (scrollElement) {
          // 使用丝滑滚动恢复搜索页面的位置
          smoothRestoreScroll(scrollElement, scrollPosition);
          
          // 更新本地存储中的播放列表滚动位置
          localStorage.setItem('temp_scroll_playlist', scrollPosition.toString());
          localStorage.setItem('scroll_pos_playlist', scrollPosition.toString());
          
          // 兼容App.vue的格式
          const existingPositions = JSON.parse(localStorage.getItem('scrollPositions') || '{}');
          existingPositions.playlist = scrollPosition;
          localStorage.setItem('scrollPositions', JSON.stringify(existingPositions));
          
          return; // 已经恢复了搜索页面的滚动位置，不需要继续执行后面的代码
        }
      }
    }
    
    // 如果不是从搜索页面返回，或者没有找到搜索页面的滚动位置，则尝试恢复播放列表自身的滚动位置
    const savedScrollPos = localStorage.getItem('temp_scroll_playlist') || 
                          localStorage.getItem('scroll_pos_playlist');
    
    if (savedScrollPos) {
      const scrollPosition = parseInt(savedScrollPos, 10);
      const scrollElement = document.querySelector('.content-area');
      if (scrollElement) {
        // 使用丝滑滚动恢复
        smoothRestoreScroll(scrollElement, scrollPosition);
      }
    }
    
    // 如果有当前歌曲，滚动到当前歌曲位置
    const currentSongIdx = playerStore.currentSongIndex;
    // 确保 currentSongIdx 是一个有效的数字，并且播放列表的长度足够
    if (typeof currentSongIdx === 'number' && currentSongIdx >= 0 && playerStore.playlist && playerStore.playlist.length > currentSongIdx) {
      const songItemElement = document.querySelector(`.song-item-row-new[data-song-index="${currentSongIdx}"]`);
      if (songItemElement) {
        // console.log(`[PlaylistView] Attempting to scroll to song at index: ${currentSongIdx}`);
        // 使用 'auto' 行为确保立即滚动，'nearest' 确保元素可见即可，避免不必要的大幅滚动
        songItemElement.scrollIntoView({ behavior: 'auto', block: 'nearest' }); 
      } else {
        // console.warn(`[PlaylistView] Could not find song item element for index: ${currentSongIdx}. This might happen if the list was re-rendered or the item is not yet in DOM.`);
      }
    } else {
      // console.log(`[PlaylistView] No valid current song index (${currentSongIdx}) to scroll to, or playlist is shorter (${playerStore.playlist?.length || 0}).`);
    }
  });

  // 检查是否因为 MV 播放而暂停了音乐
  const musicPausedForMV = localStorage.getItem('musicPausedForMV') === 'true';
  if (musicPausedForMV && playerStore.currentSong && !playerStore.isPlaying) {
    // console.log('[PlaylistView] 检测到音乐因MV暂停，尝试恢复播放');
    playerStore.togglePlayPause(); // 尝试恢复播放
  }
  localStorage.removeItem('musicPausedForMV'); // 清理标记

  // 数据加载逻辑: 只有在播放列表为空且没有进行初始化时才加载初始歌曲
  // isDataLoaded 标志由 playerStore 维护
  if (playerStore.playlist.length === 0 && !playerStore.isDataLoaded && !initialized.value) {
    // console.log('[PlaylistView] Playlist is empty and not initialized, fetching initial songs.');
    playerStore.fetchInitialSongs().then(() => {
      initialized.value = true; // 标记已尝试初始化
    });
  } else if (playerStore.isDataLoaded) {
    // console.log('[PlaylistView] Data already loaded in store.');
    initialized.value = true; // 如果 store 中有数据，也视为已初始化
  }

  // 如果有最后搜索的关键词，允许加载更多
  if (playerStore.lastSearchKeyword) {
    hasMore.value = true; 
  }

  // 设置 IntersectionObserver 用于无限滚动加载更多
  setupIntersectionObserver();
  
  // 设置滚动事件监听
  nextTick(() => {
    const scrollElement = document.querySelector('.content-area');
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll);
    }
  });
});

onDeactivated(() => {
  // console.log('####### [PlaylistView] Component DEACTIVATED #######');
  
  // 保存当前滚动位置
  const scrollElement = document.querySelector('.content-area');
  if (scrollElement) {
    const scrollTop = scrollElement.scrollTop;
    try {
      localStorage.setItem('temp_scroll_playlist', scrollTop.toString());
      localStorage.setItem('scroll_pos_playlist', scrollTop.toString());
      
      // 兼容App.vue的格式
      const existingPositions = JSON.parse(localStorage.getItem('scrollPositions') || '{}');
      existingPositions.playlist = scrollTop;
      localStorage.setItem('scrollPositions', JSON.stringify(existingPositions));
    } catch (e) {
      console.error('[PlaylistView] 保存滚动位置错误:', e);
    }
    
    // 移除滚动事件监听
    scrollElement.removeEventListener('scroll', handleScroll);
  }
  
  // 断开 IntersectionObserver
  if (observer) {
    observer.disconnect();
    observer = null;
  }
});

/**
 * 处理滚动事件，保存滚动位置
 * @param {Event} event - 滚动事件对象
 */
const handleScroll = (event) => {
  // 如果正在恢复滚动，不记录滚动位置
  if (isRestoringScroll.value || window._isRestoringScroll) return;
  
  const scrollElement = event.target;
  if (!scrollElement) return;
  
  const scrollTop = scrollElement.scrollTop;
  
  try {
    // 保存滚动位置到localStorage
    localStorage.setItem('temp_scroll_playlist', scrollTop.toString());
    localStorage.setItem('scroll_pos_playlist', scrollTop.toString());
    
    // 兼容App.vue的格式
    const existingPositions = JSON.parse(localStorage.getItem('scrollPositions') || '{}');
    existingPositions.playlist = scrollTop;
    localStorage.setItem('scrollPositions', JSON.stringify(existingPositions));
  } catch (e) {
    console.error('[PlaylistView] 保存滚动位置错误:', e);
  }
};

/**
 * 丝滑恢复滚动位置
 * @param {Element} container - 滚动容器
 * @param {number} scrollPos - 目标滚动位置
 */
const smoothRestoreScroll = (container, scrollPos) => {
  if (!container || scrollPos === undefined) return;
  
  // 设置正在恢复滚动标记
  isRestoringScroll.value = true;
  window._isRestoringScroll = true;
  
  // 临时禁用滚动动画
  const originalScrollBehavior = container.style.scrollBehavior;
  container.style.scrollBehavior = 'auto';
  
  // 临时隐藏内容，使用visibility而不是display，避免布局变化
  container.style.visibility = 'hidden';
  
  // 立即设置滚动位置
  container.scrollTop = scrollPos;
  
  // 在下一帧恢复可见性和滚动行为
  requestAnimationFrame(() => {
    // 确保滚动位置已应用
    container.scrollTop = scrollPos;
    
    // 延迟一帧再恢复可见性，确保滚动位置已经生效
    requestAnimationFrame(() => {
      container.style.visibility = 'visible';
      container.style.scrollBehavior = originalScrollBehavior;
      
      // 重置标记
      setTimeout(() => {
        isRestoringScroll.value = false;
        window._isRestoringScroll = false;
      }, 50);
    });
  });
};

// 监听播放器数据加载状态
watch(() => playerStore.isDataLoaded, (isLoaded) => {
  if (isLoaded) {
    // console.log('[PlaylistView] 播放器数据已加载');
    initialized.value = true;
  }
});

// 监听播放器状态，确保播放继续
watch(() => playerStore.isPlaying, (isPlaying) => {
  if (isPlaying && playerStore.currentSong) {
    // 检查audio元素是否存在且暂停状态
    nextTick(() => {
      const audioElement = document.querySelector('audio');
      if (audioElement && audioElement.paused) {
        audioElement.play().catch(() => {});
      }
    });
  }
});

const playSelectedSong = (songData) => {
  console.log(`PlaylistView 接收到播放事件: ${songData.song.name}, 索引: ${songData.index}`);
  
  // 确保索引是数字类型
  const index = Number(songData.index);
  if (isNaN(index)) {
    console.error(`PlaylistView: 无效的索引 ${songData.index}`);
    return;
  }
  
  // 正确传递参数：第一个是歌曲对象，第二个是索引(数字类型)
  playerStore.playSong(songData.song, index);
};

const handlePlayAll = () => {
  playerStore.playAllFromFirst();
};

// 加载更多歌曲
const loadMore = async () => {
  if (isLoading.value || !hasMore.value) return;
  
  isLoading.value = true;
  
  try {
    // 使用playerStore的loadMoreSongs方法加载更多歌曲
    const moreAvailable = await playerStore.loadMoreSongs(playerStore.lastSearchKeyword);
    hasMore.value = moreAvailable;
  } catch (error) {
    hasMore.value = false;
  } finally {
    isLoading.value = false;
    
    // 设置观察器监听滚动加载
    nextTick(() => {
      setupIntersectionObserver();
    });
  }
};

// 组件挂载时初始化
onMounted(() => {
  // console.log('####### [PlaylistView] Component MOUNTED #######');
  // console.log(`[PlaylistView] MOUNTED - initialized: ${initialized.value}, playerStore.isDataLoaded: ${playerStore.isDataLoaded}`);

  // 只在首次挂载 (或未被 keep-alive 缓存而重新挂载时) 且数据未加载时加载初始数据
  if (!playerStore.isDataLoaded && !initialized.value) {
    // console.log('[PlaylistView] MOUNTED - Fetching initial songs because not initialized and no data in store.');
    playerStore.fetchInitialSongs().then(() => {
      initialized.value = true; // 标记已尝试初始化
      // console.log('[PlaylistView] MOUNTED - Initial songs fetched, initialized set to true.');
    });
  } else {
    // console.log('[PlaylistView] MOUNTED - Skipping fetchInitialSongs. isDataLoaded: ', playerStore.isDataLoaded, 'initialized:', initialized.value);
  }
  
  // 恢复滚动位置和设置观察器
  nextTick(() => {
    setTimeout(() => {
      setupIntersectionObserver();
      // restoreScrollPosition(); // 滚动恢复应由路由或App.vue处理
      // console.log('[PlaylistView] MOUNTED - Intersection observer set up.');
    }, 200); 
  });
  
  // if (isFirstLoad.value) { // isFirstLoad 的逻辑似乎与 initialized 重叠
  //   initialized.value = true;
  //   isFirstLoad.value = false;
  // }
  
  // window._playlistViewMounted = true; // 移除全局 window 标志
});

onUnmounted(() => {
  // console.log('####### [PlaylistView] Component UNMOUNTED #######');
  // 清理工作，例如移除事件监听器或定时器（如果 IntersectionObserver 没有在 onDeactivated 中完全清理）
  if (observer) {
    observer.disconnect();
    observer = null;
    // console.log('[PlaylistView] UNMOUNTED - Intersection observer disconnected.');
  }
});

// 设置交叉观察器监听滚动
const setupIntersectionObserver = () => {
  // 如果没有更多内容或者触发元素不存在，则不设置观察器
  if (!hasMore.value || !loadMoreTrigger.value) return;
  
  // 移除旧的观察器
  if (observer) {
    observer.disconnect();
  }
  
  // 获取全局滚动容器
  const scrollContainer = document.querySelector('.content-area');
  if (!scrollContainer) {
    return;
  }
  
  // 创建新的观察器
  observer = new IntersectionObserver((entries) => {
    const entry = entries[0];
    // 当触发元素进入视口时，加载更多内容
    if (entry.isIntersecting && !isLoading.value && hasMore.value) {
      loadMore();
    }
  }, {
    root: scrollContainer, // 使用content-area作为视口
    rootMargin: '200px', // 提前200px触发
    threshold: 0.1 // 当10%的元素可见时触发
  });
  
  // 开始观察触发元素
  observer.observe(loadMoreTrigger.value);
};

// 清空列表功能现在没有按钮，如果需要可以添加回来
// const clearPlaylistAndStop = () => { ... };
</script>

<style scoped>
.playlist-view-container {
  padding: 10px 20px; /* 整体内边距 */
  height: 100%; /* 尝试占满父容器高度 */
  display: flex;
  flex-direction: column;
  /* 移除组件自身的滚动，使用父容器的滚动 */
  /* overflow-y: auto; */ 
  max-height: 100%; /* 确保容器不会超出父容器 */
  padding-bottom: calc(var(--player-height, 80px) + 20px); /* 增加底部内边距，确保最后一首歌曲不会被播放器遮挡 */
}

.playlist-sub-header {
  display: flex;
  align-items: center;
  padding: 10px 0px; /* 调整内边距以匹配截图 */
  font-size: 0.8rem;
  color: #ccc;
  margin-bottom: 10px;
}

.current-playlist-indicator {
  /* background-color: #555; */ /* 根据截图调整颜色 */
  background-color: transparent; /* 设置为透明 */
  color: #fff;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  margin-right: 8px;
}

.breadcrumb-arrow {
  margin-right: 8px;
  /* color: #777; */
  color: #ccc; /* 调整为与 "当前歌单" 文字颜色一致或更亮一些，以在透明背景下可见 */
}

.playlist-title-dynamic {
  color: #fff;
  font-weight: 500;
  flex-grow: 1;
}

.play-all-button-small {
  background: none;
  border: 1px solid #888;
  color: #ccc;
  padding: 5px 12px;
  border-radius: 15px;
  font-size: 0.75rem;
  cursor: pointer;
  margin-left: auto; /* 推到最右边 */
}
.play-all-button-small .icon {
  margin-right: 4px;
}
.play-all-button-small:hover {
    border-color: #fff;
    color: #fff;
}

.list-controls-header {
  /* display: flex; */ /* 根据新设计，这部分可能不再需要flex布局或被简化 */
  /* justify-content: space-between; */
  align-items: center;
  margin-bottom: 5px; /* 减少与表头的间距 */
  /* padding: 10px 0; */
}

.play-actions .action-button {
  /* 这些按钮可能被 play-all-button-small 替代或整合 */
  display: none; /* 暂时隐藏旧的播放全部按钮 */
}

.total-songs {
  /* 歌曲总数显示位置可能调整或移除 */
  display: none; /* 暂时隐藏 */
}

.song-list-table {
  width: 100%;
  flex-grow: 1; /* 占据剩余空间 */
  /* 移除组件自身的滚动，使用父容器的滚动 */
  /* overflow-y: auto; */ 
  /* max-height: calc(100vh - 150px); */ /* 设置最大高度，减去顶部导航和播放控制器的高度 */
  padding-bottom: 80px; /* 增加底部内边距，确保最后一首歌曲不会被播放器遮挡 */
}

.table-header-row {
  display: flex;
  align-items: center;
  padding: 8px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08); /* 分割线淡一些 */
  font-size: 0.75rem;
  color: #888; /* 表头文字颜色 */
  user-select: none;
}

.header-cell { padding: 0 4px; }
.song-index-cell { width: 40px; text-align: center; flex-shrink: 0; }
.song-title-cell { flex: 5; }
.song-artist-cell { flex: 3; }
.song-album-cell { 
  flex: 2; /* 与 SongItem 中的 album-cell flex 值对应 */ 
  /* display: none; */ /* 移除此行以显示专辑列 */
}
.song-duration-cell { display: none; }
.song-actions-cell { width: 50px; }

.song-list-body {
  /* SongItem 之间的间距由 SongItem 自己的下边框处理 */
}

.empty-playlist-message {
  text-align: center;
  padding: 30px 20px;
  font-size: 1rem;
  color: #bbb;
}
.empty-playlist-message button {
    background: #1DB954; color: white; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; margin-left: 5px;
}

/* 加载更多样式 */
.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 0;
  color: rgba(255, 255, 255, 0.7);
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s linear infinite;
  margin-right: 10px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.load-more-trigger {
  display: flex;
  justify-content: center;
  padding: 20px 0;
  min-height: 60px;
  margin-bottom: var(--player-height, 80px); /* 使用CSS变量，确保在不同设备上都有足够的底部空间 */
}

.load-more-button {
  background-color: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 8px 20px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
  backdrop-filter: blur(5px);
}

.load-more-button:hover {
  background-color: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

/* 移除之前的 max-width 和 margin: auto，因为现在是全宽布局 */
</style>
