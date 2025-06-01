<template>
  <div class="album-detail-view" v-if="albumData">
    <!-- 返回按钮 -->
    <div class="back-button-container">
      <button class="action-button" @click="goBack">
        返回
      </button>
    </div>
    
    <!-- 专辑头部信息 -->
    <div class="album-header">
      <div class="album-cover">
        <img :src="albumData.album.picUrl" alt="专辑封面">
      </div>
      <div class="album-info">
        <h2 class="album-title">{{ albumData.album.name }}</h2>
        <div class="album-creator">
          <div class="creator-info">
            <div class="creator-name">歌手: <router-link :to="{ name: 'search-results', query: { keywords: albumData.album.artist.name } }">{{ albumData.album.artist.name }}</router-link></div>
            <div class="create-time">发行时间: {{ new Date(albumData.album.publishTime).toLocaleDateString() }}</div>
          </div>
        </div>
        <div class="album-stats">
          <div class="stat-item" v-if="albumData.album.size">
            <span class="stat-value">{{ albumData.album.size }}</span>
            <span class="stat-label">首歌曲</span>
          </div>
        </div>
        <p class="album-description" v-if="albumData.album.description">{{ albumData.album.description }}</p>
      </div>
    </div>

    <!-- 专辑操作按钮 -->
    <div class="album-actions">
      <button class="action-button primary" @click="playAllAlbumSongs">
        <span class="icon">▶</span> 播放全部
      </button>
      <button class="action-button" @click="toggleFavorite">
        <span class="icon">{{ isFavoritedAlbum ? '★' : '☆' }}</span> {{ isFavoritedAlbum ? '已收藏' : '加入收藏' }}
      </button>
      <button class="action-button">
        <span class="icon">↗</span> 分享
      </button>
      <button class="action-button">
        <span class="icon">↓</span> 下载
      </button>
    </div>

    <!-- 歌曲列表 -->
    <div class="song-list-header">
      <div class="header-cell song-index-cell">#</div>
      <div class="header-cell song-title-cell">歌曲</div>
      <div class="header-cell song-artist-cell">歌手</div>
      <div class="header-cell song-duration-cell">时长</div>
    </div>

    <div class="song-list">
      <SongItem
        v-for="(song, index) in albumData.songs"
        :key="song.id"
        :song="formatSongData(song, albumData.album)" 
        :index="index"
        :is-playing="playerStore.currentSongIndex === index && playerStore.currentSong?.albumId === albumData.album.id && playerStore.isPlaying"
        :is-current="playerStore.currentSongIndex === index && playerStore.currentSong?.albumId === albumData.album.id"
        @play-song="playSelectedSongFromAlbum"
      />
    </div>
  </div>
  <div v-else-if="isLoading" class="loading-state">
    <p>正在加载专辑数据...</p>
  </div>
  <div v-else-if="error" class="error-state">
    <p>加载专辑失败: {{ error }}</p>
    <button @click="fetchAlbumData(route.params.id)">重试</button>
  </div>
</template>

<script setup>
import { ref, onMounted, onActivated, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { usePlayerStore } from '../stores/player';
import SongItem from '../components/SongItem.vue';
import { addToFavorites, removeFromFavorites, isFavorited } from '../services/favoritesService';
import { ElMessage } from 'element-plus';

defineOptions({ name: 'AlbumDetailView' });

const route = useRoute();
const router = useRouter();
const playerStore = usePlayerStore();

const albumData = ref(null);
const isLoading = ref(false);
const error = ref(null);
const isFavoritedAlbum = ref(false);

// 添加专辑数据缓存对象
const albumCache = ref({});

const fetchAlbumData = async (albumId) => {
  if (!albumId) return;
  
  // 检查缓存
  const cacheKey = `album_${albumId}`;
  const lastUpdateKey = `last_update_album_${albumId}`;
  const lastUpdate = localStorage.getItem(lastUpdateKey);
  const now = Date.now();
  const cacheExpired = !lastUpdate || (now - parseInt(lastUpdate, 10)) > 30 * 60 * 1000; // 30分钟缓存
  
  // 如果有缓存且未过期，使用缓存数据
  if (albumCache.value[cacheKey] && !cacheExpired) {
    console.log(`[AlbumDetailView] 使用缓存的专辑数据: ${albumId}`);
    albumData.value = albumCache.value[cacheKey];
    checkFavoriteStatus();
    return;
  }
  
  isLoading.value = true;
  error.value = null;
  albumData.value = null; // 清空旧数据
  try {
    // 根据您提供的API文档，接口是 /album?id=...
    // 我将使用之前在 playerStore 中定义的第三方API代理地址
    const response = await axios.get(`https://api.931125.xyz/album`, {
      params: {
        id: albumId
      }
    });
    if (response.data && response.data.album && response.data.songs) {
      albumData.value = response.data;
      console.log('[AlbumDetailView] 专辑数据加载成功:', albumData.value);
      
      // 保存到缓存
      albumCache.value[cacheKey] = response.data;
      localStorage.setItem(lastUpdateKey, now.toString());
      console.log(`[AlbumDetailView] 缓存专辑数据: ${albumId}`);
      
      // 检查收藏状态
      checkFavoriteStatus();
    } else {
      throw new Error('专辑数据格式不正确或不完整');
    }
  } catch (err) {
    console.error('[AlbumDetailView] 加载专辑数据失败:', err);
    error.value = err.message || '未知错误';
  } finally {
    isLoading.value = false;
  }
};

// 格式化从专辑接口获取的歌曲数据以匹配 SongItem 和 playerStore 的期望
const formatSongData = (song, albumInfo) => {
  return {
    id: song.id,
    name: song.name,
    artist: song.ar?.map(a => a.name).join('/') || '未知艺术家',
    album: albumInfo.name,
    albumId: albumInfo.id,
    albumArt: albumInfo.picUrl, // 使用专辑的封面
    duration: song.dt,
    // 其他 SongItem 可能需要的字段可以按需添加，例如 preloadedUrl: null
  };
};

const playAllAlbumSongs = () => {
  if (albumData.value && albumData.value.songs.length > 0) {
    // 重置搜索状态
    playerStore.resetSearchState();
    
    const formattedSongs = albumData.value.songs.map(song => formatSongData(song, albumData.value.album));
    playerStore.setPlaylist(formattedSongs, true); // 替换当前播放列表
    playerStore.playSong(playerStore.playlist[0], 0); // 播放第一首
  }
};

const playSelectedSongFromAlbum = (songData) => {
  // songData 已经是格式化后的，包含了index
  // 需要确保播放列表是当前专辑的歌曲列表
  if (playerStore.currentSong?.albumId !== albumData.value.album.id) {
    // 重置搜索状态
    playerStore.resetSearchState();
    
    // 如果当前播放的歌曲不属于这个专辑，或者播放列表不是这个专辑的，则先设置播放列表
    const formattedSongs = albumData.value.songs.map(song => formatSongData(song, albumData.value.album));
    playerStore.setPlaylist(formattedSongs, true);
    // playSong 会使用新的播放列表和正确的索引
    playerStore.playSong(playerStore.playlist[songData.index], songData.index);
  } else {
    // 如果已经是当前专辑的列表，直接播放
    playerStore.playSong(songData.song, songData.index);
  }
};

/**
 * 切换收藏状态
 */
const toggleFavorite = () => {
  if (!albumData.value || !albumData.value.album) return;
  
  const album = albumData.value.album;
  
  if (isFavoritedAlbum.value) {
    // 取消收藏
    const result = removeFromFavorites('ALBUMS', album.id);
    if (result) {
      isFavoritedAlbum.value = false;
      ElMessage.success('已从收藏中移除');
    } else {
      ElMessage.error('移除收藏失败');
    }
  } else {
    // 添加收藏
    const albumToSave = {
      id: album.id,
      name: album.name,
      picUrl: album.picUrl,
      artist: album.artist,
      publishTime: album.publishTime,
      size: album.size
    };
    
    const result = addToFavorites('ALBUMS', albumToSave);
    if (result) {
      isFavoritedAlbum.value = true;
      ElMessage.success('已添加到收藏');
    } else {
      ElMessage.error('添加收藏失败');
    }
  }
};

/**
 * 检查专辑是否已收藏
 */
const checkFavoriteStatus = () => {
  if (albumData.value && albumData.value.album) {
    isFavoritedAlbum.value = isFavorited('ALBUMS', albumData.value.album.id);
    console.log('[AlbumDetailView] 检查收藏状态:', albumData.value.album.id, isFavoritedAlbum.value);
  }
};

/**
 * 返回上一页
 */
const goBack = () => {
  // 获取查询参数
  const isFromSearch = route.query.fromSearch === 'true';
  const isFromFavorites = route.query.fromFavorites === 'true';
  
  // 获取标签和搜索类型参数
  const favoriteTab = route.query.favoriteTab;
  const searchType = route.query.searchType;
  const keyword = route.query.keyword;
  
  console.log('[AlbumDetailView] 返回操作，来源参数:', {
    isFromSearch,
    isFromFavorites,
    favoriteTab,
    searchType,
    keyword
  });
  
  // 根据来源参数决定返回路径
  if (isFromSearch) {
    // 返回到搜索页面，尝试保留搜索关键词和搜索类型
    const queryParams = {};
    
    // 添加搜索关键词 - 注意：搜索页面使用q作为查询参数，不是keyword
    if (keyword) {
      queryParams.q = keyword;
    }
    
    // 添加搜索类型
    if (searchType && ['song', 'album', 'playlist', 'mv'].includes(searchType)) {
      queryParams.type = searchType;
    }
    
    console.log('[AlbumDetailView] 返回搜索页面，参数:', queryParams);
    
    // 导航到搜索页面
    router.push({ path: '/search', query: queryParams });
  } else if (isFromFavorites) {
    // 返回到收藏页面，尝试保留原来的标签页
    const queryParams = {};
    
    // 添加收藏标签页
    if (favoriteTab && ['songs', 'albums', 'playlists', 'mvs', 'rankings'].includes(favoriteTab)) {
      queryParams.tab = favoriteTab;
    }
    
    console.log('[AlbumDetailView] 返回收藏页面，参数:', queryParams);
    
    // 导航到收藏页面
    router.push({ path: '/favorites', query: queryParams });
  } else {
    // 默认尝试使用浏览器历史返回，如果没有历史则返回首页
    console.log('[AlbumDetailView] 使用浏览器历史返回');
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  }
};

onMounted(() => {
  fetchAlbumData(route.params.id);
});

onActivated(() => {
  // 如果keep-alive且路由参数变化（例如从一个专辑页跳转到另一个专辑页），需要重新加载数据
  if (albumData.value && albumData.value.album.id.toString() !== route.params.id) {
    fetchAlbumData(route.params.id);
  } else if (!albumData.value) {
    // 如果没有数据，检查缓存
    const cacheKey = `album_${route.params.id}`;
    const lastUpdateKey = `last_update_album_${route.params.id}`;
    const lastUpdate = localStorage.getItem(lastUpdateKey);
    const now = Date.now();
    const cacheExpired = !lastUpdate || (now - parseInt(lastUpdate, 10)) > 30 * 60 * 1000; // 30分钟缓存
    
    if (albumCache.value[cacheKey] && !cacheExpired) {
      console.log(`[AlbumDetailView][onActivated] 使用缓存的专辑数据: ${route.params.id}`);
      albumData.value = albumCache.value[cacheKey];
      checkFavoriteStatus();
    } else {
      console.log(`[AlbumDetailView][onActivated] 缓存不存在或已过期，加载专辑数据: ${route.params.id}`);
      fetchAlbumData(route.params.id);
    }
  } else {
    // 如果数据已存在但可能收藏状态有变化，重新检查收藏状态
    checkFavoriteStatus();
  }
});

// 监听路由参数变化，以防用户在同一个专辑详情页组件实例中导航到不同专辑（较少见，但可以处理）
watch(() => route.params.id, (newId, oldId) => {
  if (newId && newId !== oldId) {
    fetchAlbumData(newId);
  }
});

</script>

<style scoped>
.album-detail-view {
  padding: 20px;
  color: #fff;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
}

.loading-state, .error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: rgba(255, 255, 255, 0.7);
}

.error-state button {
  margin-top: 10px;
  background-color: #1DB954;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 20px;
  cursor: pointer;
}

.back-button-container {
  margin-bottom: 15px;
}

.album-header {
  display: flex;
  margin-bottom: 15px;
}

.album-cover {
  width: 120px;
  height: 120px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  margin-right: 15px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
}

.album-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.album-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.album-title {
  font-size: 18px;
  margin: 0 0 8px 0;
}

.album-creator {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.creator-info {
  display: flex;
  flex-direction: column;
}

.creator-name {
  font-size: 12px;
  font-weight: 500;
}

.creator-name a {
  color: #bbb;
  text-decoration: none;
}

.creator-name a:hover {
  text-decoration: underline;
  color: #fff;
}

.create-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 2px;
}

.album-stats {
  display: flex;
  margin-bottom: 10px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  margin-right: 15px;
}

.stat-value {
  font-size: 12px;
  font-weight: 500;
}

.stat-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}

.album-description {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  margin: 0 0 10px 0;
  max-height: 40px;
  overflow-y: auto;
  line-height: 1.4;
  white-space: pre-wrap;
}

.album-actions {
  display: flex;
  flex-wrap: nowrap;
  margin-bottom: 15px;
  padding: 0 10px;
  justify-content: center;
}

.action-button {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 20px;
  background-color: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
  font-size: 12px;
  margin-right: 8px;
  cursor: pointer;
  transition: all 0.2s;
  backdrop-filter: blur(5px);
  white-space: nowrap;
}

.action-button.primary {
  background-color: rgba(255, 255, 255, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.4);
}

.action-button .icon {
  margin-right: 4px;
  font-size: 12px;
}

.action-button:hover {
  background-color: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

.action-button.primary:hover {
  background-color: rgba(255, 255, 255, 0.35);
}

.song-list-header {
  display: flex;
  padding: 6px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0 5px;
}

.song-list {
  margin-top: 5px;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  overflow: hidden;
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.header-cell {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-index-cell {
  width: 40px;
  text-align: center;
}

.song-title-cell {
  flex: 4;
  padding-right: 10px;
}

.song-artist-cell {
  flex: 2;
  padding-right: 10px;
}

.song-duration-cell {
  width: 60px;
  text-align: right;
}

.album-detail-view::-webkit-scrollbar {
  width: 6px;
}

.album-detail-view::-webkit-scrollbar-track {
  background: transparent;
}

.album-detail-view::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}
</style> 