<template>
  <div class="search-view">
    <div class="search-header">
      <h2>搜索结果: "{{ searchQuery }}"</h2>
      
      <!-- 搜索类型切换 -->
      <div class="search-type-tabs">
        <div 
          v-for="type in searchTypes" 
          :key="type.value" 
          class="search-type-tab" 
          :class="{ active: currentSearchType === type.value }"
          @click="changeSearchType(type.value)"
        >
          {{ type.label }}
        </div>
      </div>
    </div>
    
    <div v-if="isLoading && offset === 0" class="loading-container">
      <el-skeleton :rows="5" animated />
    </div>
    
    <div v-else-if="searchResults.length === 0" class="no-results">
      <el-empty description="暂无搜索结果" />
    </div>
    
    <div v-else class="song-list-container">
      <!-- 单曲搜索结果 -->
      <div v-if="currentSearchType === 'song'" class="song-list-container">
        <div class="table-header-row">
          <div class="header-cell song-index-cell">#</div>
          <div class="header-cell song-title-cell">歌曲</div>
          <div class="header-cell song-artist-cell">歌手</div>
          <div class="header-cell song-album-cell">专辑</div>
          <div class="header-cell song-actions-cell"></div>
        </div>
        <div class="song-list-body">
          <SongItem
            v-for="(song, index) in searchResults"
            :key="song.id"
            :song="song"
            :index="index"
            :is-playing="playerStore.isPlaying"
            :is-current="playerStore.currentSong && playerStore.currentSong.id === song.id"
            @play-song="handleSongPlay"
          />
        </div>
      </div>
      
      <!-- 专辑搜索结果 -->
      <div v-else-if="currentSearchType === 'album'" class="grid-results">
        <div 
          v-for="album in searchResults" 
          :key="album.id"
          class="grid-item"
          @click="navigateToAlbum(album)"
        >
          <div class="grid-item-cover">
            <img :src="album.albumArt" :alt="album.name" class="cover-image" />
            <div class="grid-item-overlay">
              <el-icon><VideoPlay /></el-icon>
            </div>
          </div>
          <div class="grid-item-info">
            <div class="grid-item-name">{{ album.name }}</div>
            <div class="grid-item-artist">{{ album.artist }}</div>
            <div class="grid-item-detail">{{ album.size }}首歌</div>
          </div>
        </div>
      </div>
      
      <!-- 歌单搜索结果 -->
      <div v-else-if="currentSearchType === 'playlist'" class="grid-results">
        <div 
          v-for="playlist in searchResults" 
          :key="playlist.id"
          class="grid-item"
          @click="navigateToPlaylist(playlist)"
        >
          <div class="grid-item-cover">
            <img :src="playlist.albumArt" :alt="playlist.name" class="cover-image" />
            <div class="grid-item-overlay">
              <el-icon><VideoPlay /></el-icon>
            </div>
          </div>
          <div class="grid-item-info">
            <div class="grid-item-name">{{ playlist.name }}</div>
            <div class="grid-item-artist">{{ playlist.artist }}</div>
            <div class="grid-item-detail">{{ playlist.trackCount }}首歌 | {{ formatPlayCount(playlist.playCount) }}次播放</div>
          </div>
        </div>
      </div>
      
      <!-- MV搜索结果 -->
      <div v-else-if="currentSearchType === 'mv'" class="grid-results">
        <div 
          v-for="mv in searchResults" 
          :key="mv.id"
          class="grid-item mv-grid-item"
          @click="handleMVClick(mv)"
        >
          <div class="grid-item-cover mv-cover">
            <img :src="mv.albumArt" :alt="mv.name" class="cover-image" />
            <div class="grid-item-overlay">
              <el-icon><VideoPlay /></el-icon>
            </div>
            <div class="mv-duration">{{ formatDuration(mv.duration) }}</div>
          </div>
          <div class="grid-item-info">
            <div class="grid-item-name">{{ mv.name }}</div>
            <div class="grid-item-artist">{{ mv.artist }}</div>
            <div class="grid-item-detail">{{ formatPlayCount(mv.playCount) }}次播放</div>
          </div>
        </div>
      </div>
      
      <!-- 加载更多 -->
      <div v-if="isLoading && offset > 0" class="loading-more">
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
/**
 * 搜索结果页面组件
 * 显示搜索结果并提供播放功能
 */
import { ref, onMounted, watch, computed, nextTick, onUnmounted, defineComponent, onActivated, onDeactivated } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePlayerStore } from '../stores/player';
import SongItem from '../components/SongItem.vue';
import axios from 'axios';
import { VideoPlay } from '@element-plus/icons-vue';

// 定义组件名称以支持keep-alive
defineComponent({
  name: 'SearchView'
});

// 使用name选项直接定义组件名称
const __NAME__ = 'SearchView';

const route = useRoute();
const router = useRouter();
const playerStore = usePlayerStore();

const searchQuery = ref('');
const isLoading = ref(false);
const offset = ref(0);
const limit = ref(30);
const hasMore = ref(true);
const allSearchResults = ref([]);
const loadMoreTrigger = ref(null);
let observer = null;

// 添加滚动恢复相关状态
const isRestoringScroll = ref(false);

// 搜索类型相关
const currentSearchType = ref('song'); // 默认为单曲搜索
const searchTypes = [
  { label: '单曲', value: 'song' },
  { label: '专辑', value: 'album' },
  { label: '歌单', value: 'playlist' },
  { label: 'MV', value: 'mv' }
];

// API基础URL
const API_BASE_URL = import.meta.env.VITE_MAIN_API_BASE || 'https://api.931125.xyz';

// 添加一个ref来记录上次搜索的关键词
const lastSearchedKeyword = ref('');

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

// 搜索结果
const searchResults = computed(() => allSearchResults.value);

// 设置无限滚动监听
const setupIntersectionObserver = () => {
  // 如果没有更多内容或者触发元素不存在，则不设置观察器
  if (!hasMore.value || !loadMoreTrigger.value) return;
  
  // 移除旧的观察器
  if (observer) {
    observer.disconnect();
  }
  
  // 创建新的观察器，使用content-area作为root
  const scrollContainer = document.querySelector('.content-area');
  if (!scrollContainer) {
    console.warn('无法找到滚动容器.content-area');
    return;
  }
  
  // 创建新的观察器
  observer = new IntersectionObserver((entries) => {
    const entry = entries[0];
    // 当触发元素进入视口时，加载更多内容
    if (entry.isIntersecting && !isLoading.value && hasMore.value) {
      console.log('搜索页面: 无限滚动触发加载更多');
      loadMore();
    }
  }, {
    root: scrollContainer, // 使用content-area作为视口
    rootMargin: '200px', // 提前200px触发
    threshold: 0.1 // 当10%的元素可见时触发
  });
  
  // 开始观察触发元素
  observer.observe(loadMoreTrigger.value);
  console.log('搜索页面: 设置了无限滚动观察器');
};

// 切换搜索类型
const changeSearchType = (type) => {
  if (currentSearchType.value === type) return;
  
  currentSearchType.value = type;
  offset.value = 0;
  allSearchResults.value = [];
  hasMore.value = true;
  
  // 执行新的搜索
  performSearch(searchQuery.value);
};

// 执行搜索
const performSearch = async (query, isLoadMore = false) => {
  if (!query) return;
  
  if (!isLoadMore) {
    offset.value = 0;
    allSearchResults.value = [];
    hasMore.value = true;
  }
  
  isLoading.value = true;
  
  try {
    // 根据搜索类型选择不同的搜索方法
    switch (currentSearchType.value) {
      case 'song':
        // 使用playerStore的searchSongs方法，而不是直接调用API
        // 保存搜索关键词
        playerStore.lastSearchKeyword = query;
        
        if (isLoadMore) {
          // 加载更多使用loadMoreSongs方法
          console.log(`[SearchView] 加载更多搜索结果，关键词: ${query}, 偏移量: ${offset.value}`);
          
          // 记录加载前的搜索结果数量
          const beforeCount = allSearchResults.value.length;
          
          // 尝试加载更多
          let results = await playerStore.loadMoreSongs(query, limit.value, false);
          
          // 如果加载失败或没有新增歌曲，尝试增加偏移量再次加载
          if (results === false) {
            console.log(`[SearchView] 加载更多失败或无新增歌曲，尝试增加偏移量再次加载`);
            
            // 增加主API和备用API的偏移量
            playerStore.mainApiOffset += 30;
            playerStore.fallbackApiOffset += 30;
            
            // 再次尝试加载
            results = await playerStore.loadMoreSongs(query, limit.value, false);
          }
          
          // 更新是否有更多内容
          hasMore.value = results !== false;
          
          // 获取临时搜索结果，而不是播放列表
          allSearchResults.value = playerStore._tempSearchResults || [];
          
          // 检查是否真的加载了新歌曲
          const afterCount = allSearchResults.value.length;
          if (afterCount <= beforeCount) {
            console.log(`[SearchView] 警告: 加载更多后歌曲数量没有增加，可能存在去重问题`);
            
            // 如果主API还有更多结果，强制再次尝试加载
            if (playerStore.mainApiHasMore) {
              console.log(`[SearchView] 主API还有更多结果，强制增加偏移量再次尝试`);
              playerStore.mainApiOffset += 30; // 再次增加偏移量
              
              // 再次尝试加载
              results = await playerStore.loadMoreSongs(query, limit.value, false);
              hasMore.value = results !== false;
              allSearchResults.value = playerStore._tempSearchResults || [];
            } else {
              // 如果主API没有更多结果，设置hasMore为false
              hasMore.value = false;
            }
          }
          
          console.log(`[SearchView] 加载更多后状态 - 主API偏移: ${playerStore.mainApiOffset}, 备用API偏移: ${playerStore.fallbackApiOffset}, 主API还有更多: ${playerStore.mainApiHasMore}, 备用API还有更多: ${playerStore.fallbackApiHasMore}`);
          console.log(`[SearchView] 加载更多后歌曲数量: ${allSearchResults.value.length}, 是否有更多: ${hasMore.value}`);
        } else {
          // 首次搜索使用searchSongs方法，强制不使用缓存
          // 添加标志位表示这是搜索结果，不是用户主动点击播放
          const currentSong = playerStore.currentSong;
          const currentSongIndex = playerStore.currentSongIndex;
          const isPlaying = playerStore.isPlaying;
          
          // 重置playerStore的搜索状态，确保完全刷新
          playerStore.resetSearchState();
          
          // 搜索歌曲但不替换当前播放列表，强制跳过缓存
          console.log(`[SearchView] 执行搜索，关键词: ${query}, 强制跳过缓存`);
          await playerStore.searchSongs(query, true, false, true, false); // resetPagination=true, useCache=false, skipCache=true, replacePlaylist=false
          
          // 获取临时搜索结果，而不是播放列表
          allSearchResults.value = playerStore._tempSearchResults || [];
          
          // 如果之前有正在播放的歌曲，恢复它
          if (currentSong) {
            // 恢复之前的播放状态
            playerStore.currentSong = currentSong;
            playerStore.currentSongIndex = currentSongIndex;
            playerStore.isPlaying = isPlaying;
            
            // 如果当前正在播放，确保音频元素的状态与播放状态一致
            if (isPlaying) {
              const audioElement = playerStore._getAudioElement();
              if (audioElement && audioElement.paused) {
                audioElement.play().catch(err => {
                  console.warn('[SearchView] 恢复播放失败:', err);
                });
              }
            }
          }
          
          // 更新是否有更多内容
          hasMore.value = playerStore.mainApiHasMore || playerStore.fallbackApiHasMore;
        }
        break;
        
      case 'album':
        // 专辑搜索 - 只使用网易云API
        await searchAlbums(query, isLoadMore);
        break;
        
      case 'playlist':
        // 歌单搜索 - 只使用网易云API
        await searchPlaylists(query, isLoadMore);
        break;
        
      case 'mv':
        // MV搜索 - 只使用网易云API
        await searchMVs(query, isLoadMore);
        break;
    }
    
    console.log(`[SearchView] 搜索结果数量: ${allSearchResults.value.length}, 是否有更多: ${hasMore.value}`);
  } catch (error) {
    console.error('搜索失败:', error);
    if (!isLoadMore) {
      allSearchResults.value = [];
    }
    hasMore.value = false;
  } finally {
    isLoading.value = false;
    
    // 设置观察器来监听滚动加载更多
    nextTick(() => {
      setupIntersectionObserver();
    });
    
    // 保存缓存时间戳
    if (offset.value === 0 && allSearchResults.value.length > 0) {
      const lastUpdateKey = `last_update_search_${searchQuery.value}_${currentSearchType.value}`;
      localStorage.setItem(lastUpdateKey, Date.now().toString());
      console.log(`[SearchView] 更新搜索缓存时间戳: ${searchQuery.value}, 类型: ${currentSearchType.value}`);
    }
  }
};

// 专辑搜索方法 - 只使用网易云API
const searchAlbums = async (query, isLoadMore = false) => {
  const currentOffset = isLoadMore ? offset.value : 0;
  const response = await axios.get(`${API_BASE_URL}/cloudsearch`, {
    params: {
      keywords: query,
      type: 10, // 专辑搜索类型
      limit: limit.value,
      offset: currentOffset
    }
  });
  
  const data = response.data;
  if (data && data.result && data.result.albums) {
    const albums = data.result.albums.map(album => ({
      id: album.id,
      name: album.name,
      artist: album.artist?.name || '未知艺术家',
      albumArt: album.picUrl || 'https://p2.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg',
      publishTime: album.publishTime,
      size: album.size, // 专辑中的歌曲数量
      isAlbum: true // 标记为专辑
    }));
    
    if (isLoadMore) {
      allSearchResults.value = [...allSearchResults.value, ...albums];
    } else {
      allSearchResults.value = albums;
    }
    
    // 更新是否有更多内容
    hasMore.value = data.result.albumCount > allSearchResults.value.length;
  } else {
    if (!isLoadMore) {
      allSearchResults.value = [];
    }
    hasMore.value = false;
  }
};

// 歌单搜索方法 - 只使用网易云API
const searchPlaylists = async (query, isLoadMore = false) => {
  const currentOffset = isLoadMore ? offset.value : 0;
  const response = await axios.get(`${API_BASE_URL}/cloudsearch`, {
    params: {
      keywords: query,
      type: 1000, // 歌单搜索类型
      limit: limit.value,
      offset: currentOffset
    }
  });
  
  const data = response.data;
  if (data && data.result && data.result.playlists) {
    const playlists = data.result.playlists.map(playlist => ({
      id: playlist.id,
      name: playlist.name,
      artist: playlist.creator?.nickname || '未知创建者',
      albumArt: playlist.coverImgUrl || 'https://p2.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg',
      trackCount: playlist.trackCount,
      playCount: playlist.playCount,
      isPlaylist: true // 标记为歌单
    }));
    
    if (isLoadMore) {
      allSearchResults.value = [...allSearchResults.value, ...playlists];
    } else {
      allSearchResults.value = playlists;
    }
    
    // 更新是否有更多内容
    hasMore.value = data.result.playlistCount > allSearchResults.value.length;
  } else {
    if (!isLoadMore) {
      allSearchResults.value = [];
    }
    hasMore.value = false;
  }
};

// MV搜索方法 - 只使用网易云API
const searchMVs = async (query, isLoadMore = false) => {
  const currentOffset = isLoadMore ? offset.value : 0;
  const response = await axios.get(`${API_BASE_URL}/cloudsearch`, {
    params: {
      keywords: query,
      type: 1004, // MV搜索类型
      limit: limit.value,
      offset: currentOffset
    }
  });
  
  const data = response.data;
  if (data && data.result && data.result.mvs) {
    const mvs = data.result.mvs.map(mv => ({
      id: mv.id,
      name: mv.name,
      artist: mv.artists?.map(a => a.name).join(', ') || '未知艺术家',
      albumArt: mv.cover || 'https://p2.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg',
      duration: mv.duration,
      playCount: mv.playCount,
      isMV: true, // 标记为MV
      source: mv.source,
      sourceId: mv.sourceId
    }));
    
    if (isLoadMore) {
      allSearchResults.value = [...allSearchResults.value, ...mvs];
    } else {
      allSearchResults.value = mvs;
    }
    
    // 更新是否有更多内容
    hasMore.value = data.result.mvCount > allSearchResults.value.length;
  } else {
    if (!isLoadMore) {
      allSearchResults.value = [];
    }
    hasMore.value = false;
  }
};

// 加载更多搜索结果
const loadMore = () => {
  if (isLoading.value || !hasMore.value) return;
  
  console.log(`[SearchView] 加载更多，当前偏移量: ${offset.value}，关键词: ${searchQuery.value}`);
  console.log(`[SearchView] 加载更多前状态 - 主API偏移: ${playerStore.mainApiOffset}, 备用API偏移: ${playerStore.fallbackApiOffset}, 主API还有更多: ${playerStore.mainApiHasMore}, 备用API还有更多: ${playerStore.fallbackApiHasMore}`);
  
  // 不再清除缓存，这会导致每次加载更多时都重置状态
  // const lastUpdateKey = `last_update_search_${searchQuery.value}_${currentSearchType.value}`;
  // localStorage.removeItem(lastUpdateKey);
  
  offset.value += limit.value;
  performSearch(searchQuery.value, true);
};

// 监听路由变化，更新搜索查询
watch(() => route.query, (newQuery, oldQuery) => {
  if (newQuery && newQuery.q) {
    // 检查是否是相同关键词
    const isSameKeyword = newQuery.q === oldQuery?.q;
    const isSameType = newQuery.type === oldQuery?.type;
    const isNewSearch = !isSameKeyword || !isSameType;
    
    // 记录新的搜索关键词
    searchQuery.value = newQuery.q;
    
    // 设置搜索类型
    if (newQuery.type && ['song', 'album', 'playlist', 'mv'].includes(newQuery.type)) {
      currentSearchType.value = newQuery.type;
    } else {
      currentSearchType.value = 'song'; // 默认为单曲搜索
    }
    
    // 如果是新的搜索（关键词或类型变化），重置分页状态
    if (isNewSearch) {
      console.log(`[SearchView] 新的搜索: 关键词=${newQuery.q}, 类型=${currentSearchType.value}`);
      offset.value = 0;
      hasMore.value = true;
      
      // 执行搜索，强制跳过缓存
      performSearch(newQuery.q);
      
      // 滚动到顶部
      nextTick(() => {
        setTimeout(() => {
          const scrollElement = document.querySelector('.content-area');
          if (scrollElement) {
            // 使用丝滑滚动到顶部
            smoothRestoreScroll(scrollElement, 0);
          }
        }, 100);
      });
    } else {
      // 如果是相同关键词和类型，不重新搜索，只确保搜索状态正确
      console.log(`[SearchView] 相同的搜索: 关键词=${newQuery.q}, 类型=${currentSearchType.value}, 使用现有结果`);
      
      // 确保playerStore的lastSearchKeyword与当前搜索关键词一致
      playerStore.lastSearchKeyword = searchQuery.value;
      
      // 如果playerStore的搜索状态被重置，重新初始化
      if (playerStore.mainApiOffset === 0 && playerStore.fallbackApiOffset === 0 && 
          allSearchResults.value.length > 0) {
        console.log(`[SearchView] 检测到playerStore搜索状态已重置，重新初始化`);
        
        // 将当前搜索结果分类为主API和备用API结果
        const mainApiResults = allSearchResults.value.filter(s => !s.isFromKw);
        const fallbackApiResults = allSearchResults.value.filter(s => s.isFromKw);
        
        // 更新playerStore的搜索状态
        playerStore.mainApiSongs = [...mainApiResults];
        playerStore.fallbackApiSongs = [...fallbackApiResults];
        playerStore.mainApiOffset = mainApiResults.length;
        playerStore.fallbackApiOffset = fallbackApiResults.length;
        playerStore.mainApiHasMore = true; // 假设还有更多结果
        playerStore.fallbackApiHasMore = true;
        playerStore._tempSearchResults = [...allSearchResults.value];
        
        // 更新combinedSongIds用于去重
        playerStore.combinedSongIds = new Set(
          allSearchResults.value.map(s => s.isFromKw ? `kw_${s.id}` : `main_${s.id}`)
        );
      }
    }
  }
}, { immediate: true, deep: true });

// 播放选中的歌曲
const handleSongPlay = (songData) => {
  // 检查是否应该自动播放
  // 如果从搜索页面返回播放页面，则不自动播放
  const preventAutoPlay = localStorage.getItem('preventAutoPlayFromSearch') === 'true';
  
  // 只有在明确由用户点击触发时才自动播放，通过检查songData.autoPlay
  // songData.autoPlay默认为true，表示用户点击了歌曲
  const autoPlay = songData.autoPlay !== false && !preventAutoPlay;
  
  if (preventAutoPlay) {
    console.log('[SearchView] 检测到从搜索页面返回，不自动播放歌曲');
  }
  
  // 创建完整的播放列表（包括当前歌曲和之后的所有歌曲）
  const playlistStartingFromSelected = [...allSearchResults.value];
  
  // 确保设置lastSearchKeyword为当前搜索关键词
  playerStore.lastSearchKeyword = searchQuery.value;
  
  // 仅当用户点击了搜索结果中的歌曲时才替换播放列表
  if (songData.autoPlay !== false) {
    // 更新播放器的播放列表
    console.log('[SearchView] 用户点击了搜索结果中的歌曲，替换播放列表');
    
    // 确保_tempSearchResults与当前搜索结果同步
    playerStore._tempSearchResults = [...allSearchResults.value];
    
    playerStore.setPlaylist(playlistStartingFromSelected, true);
    
    // 播放选中的歌曲，但只有在autoPlay为true时才实际播放
    if (autoPlay) {
      console.log('[SearchView] 播放歌曲:', songData.song.name);
      playerStore.playSong(songData.song, songData.index);
    } else {
      console.log('[SearchView] 设置当前歌曲但不播放:', songData.song.name);
      // 仅设置当前歌曲，但不播放
      playerStore.currentSong = songData.song;
      playerStore.currentSongIndex = songData.index;
    }
  } else {
    // 用户没有点击搜索结果中的歌曲，保持原来的播放列表
    console.log('[SearchView] 用户没有点击搜索结果中的歌曲，保持原来的播放列表');
    // 不替换播放列表，不暂停当前播放的歌曲
  }
};

// 增加滚动处理函数
const handleScroll = (event) => {
  // 如果正在恢复滚动，不记录滚动位置
  if (isRestoringScroll.value || window._isRestoringScroll) return;
  
  const scrollElement = event.target;
  if (!scrollElement) return;
  
  const scrollTop = scrollElement.scrollTop;
  
  try {
    // 保存滚动位置到localStorage
    localStorage.setItem('temp_scroll_search', scrollTop.toString());
    localStorage.setItem('scroll_pos_search', scrollTop.toString());
    localStorage.setItem('lastSearchScrollPosition', scrollTop.toString());
    
    // 兼容App.vue的格式
    const existingPositions = JSON.parse(localStorage.getItem('scrollPositions') || '{}');
    existingPositions.search = scrollTop;
    localStorage.setItem('scrollPositions', JSON.stringify(existingPositions));
  } catch (e) {
    console.error('保存滚动位置错误:', e);
  }
};

// 激活组件时设置滚动监听和恢复滚动位置
onActivated(() => {
  nextTick(() => {
    // 检查是否有数据和缓存是否过期
    const hasData = allSearchResults.value && allSearchResults.value.length > 0;
    const lastUpdateKey = `last_update_search_${searchQuery.value}_${currentSearchType.value}`;
    const lastUpdate = localStorage.getItem(lastUpdateKey);
    const now = Date.now();
    const cacheExpired = !lastUpdate || (now - parseInt(lastUpdate, 10)) > 30 * 60 * 1000; // 30分钟缓存
    
    // 检查是否是同一个搜索关键词
    const isSameSearch = searchQuery.value === lastSearchedKeyword.value;
    
    // 只有在没有数据或缓存过期，且不是同一个搜索关键词时才重新加载
    if ((!hasData || cacheExpired) && !isSameSearch) {
      console.log(`[SearchView][onActivated] 缓存不存在或已过期，重新加载数据`);
      if (searchQuery.value) {
        // 重置分页状态
        offset.value = 0;
        hasMore.value = true;
        
        // 保存当前搜索关键词
        lastSearchedKeyword.value = searchQuery.value;
        
        // 重新执行搜索，强制跳过缓存
        performSearch(searchQuery.value);
      }
    } else {
      console.log(`[SearchView][onActivated] 使用缓存数据，上次更新时间: ${lastUpdate ? new Date(parseInt(lastUpdate, 10)).toLocaleString() : '无'}`);
      
      // 即使使用缓存数据，也需要确保playerStore中的搜索状态与当前搜索结果一致
      // 这是为了解决从歌单详情页返回搜索页面时，playerStore的搜索状态可能已被重置的问题
      if (searchQuery.value && currentSearchType.value === 'song') {
        // 确保playerStore的lastSearchKeyword与当前搜索关键词一致
        playerStore.lastSearchKeyword = searchQuery.value;
        
        // 如果playerStore的搜索状态与当前搜索结果不一致，重新初始化搜索状态
        if (playerStore.mainApiOffset === 0 && playerStore.fallbackApiOffset === 0 && 
            allSearchResults.value.length > 0) {
          console.log(`[SearchView][onActivated] 检测到playerStore搜索状态已重置，重新初始化搜索状态`);
          
          // 将当前搜索结果分类为主API和备用API结果
          const mainApiResults = allSearchResults.value.filter(s => !s.isFromKw);
          const fallbackApiResults = allSearchResults.value.filter(s => s.isFromKw);
          
          // 更新playerStore的搜索状态
          playerStore.mainApiSongs = [...mainApiResults];
          playerStore.fallbackApiSongs = [...fallbackApiResults];
          playerStore.mainApiOffset = mainApiResults.length;
          playerStore.fallbackApiOffset = fallbackApiResults.length;
          playerStore.mainApiHasMore = true; // 假设还有更多结果
          playerStore.fallbackApiHasMore = true;
          playerStore._tempSearchResults = [...allSearchResults.value];
          
          // 更新combinedSongIds用于去重
          playerStore.combinedSongIds = new Set(
            allSearchResults.value.map(s => s.isFromKw ? `kw_${s.id}` : `main_${s.id}`)
          );
        }
      }
      
      // 不重新加载，但确保设置观察器
      setupIntersectionObserver();
    }
    
    // 保存当前搜索关键词
    lastSearchedKeyword.value = searchQuery.value;
    
    // 尝试恢复滚动位置（仅当不是新搜索时）
    if (allSearchResults.value.length > 0) {
      const scrollPos = localStorage.getItem('temp_scroll_search') || 
                       localStorage.getItem('scroll_pos_search') || 
                       localStorage.getItem('lastSearchScrollPosition');
      
      if (scrollPos) {
        const scrollPosition = parseInt(scrollPos, 10);
        const scrollElement = document.querySelector('.content-area');
        if (scrollElement) {
          // 使用丝滑滚动恢复
          smoothRestoreScroll(scrollElement, scrollPosition);
        }
      }
    }
    
    // 设置滚动事件监听
    const scrollElement = document.querySelector('.content-area');
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll);
    }
  });
});

// 停用组件时移除滚动监听
onDeactivated(() => {
  // 断开观察器
  if (observer) {
    observer.disconnect();
  }
  
  // 移除滚动事件监听
  const scrollElement = document.querySelector('.content-area');
  if (scrollElement) {
    scrollElement.removeEventListener('scroll', handleScroll);
  }
});

// 卸载组件时清理
onUnmounted(() => {
  // 断开观察器
  if (observer) {
    observer.disconnect();
  }
  
  // 移除滚动事件监听
  const scrollElement = document.querySelector('.content-area');
  if (scrollElement) {
    scrollElement.removeEventListener('scroll', handleScroll);
  }
});

// 添加挂载时的初始化
onMounted(() => {
  // 设置初始滚动监听
  nextTick(() => {
    // 设置滚动事件监听
    const scrollElement = document.querySelector('.content-area');
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll);
    }
  });
});

// 添加导航函数
/**
 * 导航到专辑详情页
 * @param {Object} album - 专辑对象
 */
const navigateToAlbum = (album) => {
  router.push({
    path: `/album/${album.id}`,
    query: { 
      fromSearch: 'true',
      keyword: searchQuery.value, // 保存搜索关键词以便在返回时恢复
      searchType: currentSearchType.value // 保存当前搜索类型
    }
  });
};

/**
 * 导航到歌单详情页
 * @param {Object} playlist - 歌单对象
 */
const navigateToPlaylist = (playlist) => {
  router.push({
    path: `/playlist/${playlist.id}`,
    query: { 
      fromSearch: 'true',
      keyword: searchQuery.value, // 保存搜索关键词以便在返回时恢复
      searchType: currentSearchType.value // 保存当前搜索类型
    }
  });
};

/**
 * 处理MV项点击
 * @param {Object} mv - MV对象
 */
const handleMVClick = (mv) => {
  console.log('点击MV项:', mv.name, mv.id);
  // 确保正确记录当前搜索状态
  const currentKeyword = searchQuery.value;
  const currentType = currentSearchType.value;
  
  console.log('[SearchView] 导航到MV详情页，参数:', {
    id: mv.id,
    source: mv.source === 'kw' ? 'kw' : undefined,
    fromSearch: true,
    keyword: currentKeyword,
    searchType: currentType
  });
  
  // 跳转到MV详情页面，传递MV ID和搜索关键词
  router.push({
    name: 'mv-detail',
    params: { id: mv.id },
    query: { 
      source: mv.source === 'kw' ? 'kw' : undefined,
      fromSearch: 'true', // 添加来源标记
      keyword: currentKeyword, // 保存搜索关键词以便在返回时恢复
      searchType: currentType // 保存当前搜索类型
    }
  });
};

/**
 * 格式化播放次数
 * @param {number} count - 播放次数
 * @returns {string} - 格式化后的播放次数
 */
const formatPlayCount = (count) => {
  if (!count) return '0';
  if (count < 10000) return count.toString();
  return (count / 10000).toFixed(1) + '万';
};

/**
 * 格式化持续时间
 * @param {number} ms - 毫秒时长
 * @returns {string} - 格式化后的时长
 */
const formatDuration = (ms) => {
  if (!ms) return '0:00';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};
</script>

<style scoped>
.search-view {
  padding: 20px;
  color: #fff;
  height: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
}

.search-header {
  margin-bottom: 20px;
}

.search-header h2 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
  margin-bottom: 15px;
}

/* 搜索类型标签样式 */
.search-type-tabs {
  display: flex;
  margin-bottom: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 5px;
}

.search-type-tab {
  padding: 5px 15px;
  margin-right: 10px;
  cursor: pointer;
  border-radius: 15px;
  background-color: rgba(255, 255, 255, 0.05);
  transition: all 0.2s;
  font-size: 14px;
}

.search-type-tab:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.search-type-tab.active {
  background-color: rgba(255, 200, 0, 0.2);
  color: #ffcc00;
  font-weight: 500;
}

.loading-container {
  padding: 20px;
}

.no-results {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.song-list-container {
  width: 100%;
  flex-grow: 1;
}

.table-header-row {
  display: flex;
  align-items: center;
  padding: 8px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.75rem;
  color: #888;
  user-select: none;
}

.header-cell { padding: 0 4px; }
.song-index-cell { width: 40px; text-align: center; flex-shrink: 0; }
.song-title-cell { flex: 5; }
.song-artist-cell { flex: 3; }
.song-album-cell { flex: 3; }
.song-actions-cell { width: 50px; }

.song-list-body {
  /* 歌曲列表容器 */
}

/* 网格布局样式 */
.grid-results {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 20px;
  padding: 10px 0;
}

.grid-item {
  cursor: pointer;
  transition: transform 0.2s;
  border-radius: 8px;
  overflow: hidden;
  background-color: rgba(255, 255, 255, 0.05);
}

.grid-item:hover {
  transform: translateY(-5px);
}

.grid-item:hover .grid-item-overlay {
  opacity: 1;
}

.grid-item-cover {
  position: relative;
  width: 100%;
  padding-top: 100%; /* 1:1 宽高比 */
  overflow: hidden;
}

.cover-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.grid-item:hover .cover-image {
  transform: scale(1.05);
}

.grid-item-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
}

.grid-item-overlay .el-icon {
  font-size: 40px;
  color: #fff;
}

.grid-item-info {
  padding: 10px;
}

.grid-item-name {
  font-weight: 500;
  margin-bottom: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.grid-item-artist {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.grid-item-detail {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
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

/* 响应式布局 */
@media (max-width: 768px) {
  .grid-results {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 15px;
  }
  
  .grid-item-info {
    padding: 8px;
  }
  
  .grid-item-name {
    font-size: 14px;
  }
}

/* MV搜索结果的特殊样式 */
.mv-grid-item {
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.3s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.mv-grid-item:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}

.mv-cover {
  position: relative;
  aspect-ratio: 16/9;
}

.mv-duration {
  position: absolute;
  bottom: 5px;
  right: 5px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

.grid-item-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
}

.grid-item:hover .grid-item-overlay {
  opacity: 1;
}

.grid-item-overlay .el-icon {
  font-size: 40px;
  color: white;
  filter: drop-shadow(0 0 5px rgba(0, 0, 0, 0.5));
}
</style> 