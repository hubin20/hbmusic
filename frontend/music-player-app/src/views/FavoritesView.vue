<template>
  <div class="favorites-view-container">
    <h2 class="page-title">本地收藏</h2>
    
    <!-- 导航按钮 -->
    <div class="favorites-nav">
      <div class="nav-tabs">
        <div 
          class="nav-tab" 
          :class="{ active: activeTab === 'songs' }"
          @click="changeTab('songs')"
        >
          单曲
        </div>
        
        <div 
          class="nav-tab" 
          :class="{ active: activeTab === 'playlists' }"
          @click="changeTab('playlists')"
        >
          歌单
        </div>
        
        <div 
          class="nav-tab" 
          :class="{ active: activeTab === 'rankings' }"
          @click="changeTab('rankings')"
        >
          榜单
        </div>
        
        <div 
          class="nav-tab" 
          :class="{ active: activeTab === 'albums' }"
          @click="changeTab('albums')"
        >
          专辑
        </div>
        
        <div 
          class="nav-tab" 
          :class="{ active: activeTab === 'mvs' }"
          @click="changeTab('mvs')"
        >
          MV
        </div>
      </div>
    </div>
    
    <!-- 内容区域 -->
    <div class="favorites-content">
      <!-- 本地单曲 -->
      <div v-if="activeTab === 'songs'" class="tab-content">
        <div v-if="loading" class="loading-state">
          <div class="loading-spinner"></div>
          <p>加载中...</p>
        </div>
        <div v-else-if="error" class="error-state">
          <p>{{ error }}</p>
          <button @click="loadFavorites('songs')">重试</button>
        </div>
        <div v-else-if="favoriteSongs.length === 0" class="empty-state">
          <p>暂无收藏的单曲</p>
          <button @click="goToDiscover" class="discover-button">去发现音乐</button>
        </div>
        <div v-else class="songs-list">
          <div class="songs-list-header">
            <button class="play-all-button-small" @click="playAllFavorites">
              <span class="icon">▶</span> 播放全部
            </button>
          </div>
          <div class="song-item-header">
            <div class="cell index-cell">#</div>
            <div class="cell title-cell">歌曲</div>
            <div class="cell artist-cell">歌手</div>
            <div class="cell album-cell">专辑</div>
            <div class="cell actions-cell"></div>
          </div>
          <div 
            v-for="(song, index) in favoriteSongs" 
            :key="song.id" 
            class="song-item-row-new"
            @click="playSong(song, index)"
            :class="{ 
              'playing': isCurrentSong(song.id),
              'actually-playing': isSongPlaying(song.id)
            }"
          >
            <div class="cell index-cell">
              <div v-if="isCurrentSong(song.id) && isPlaying" class="playing-indicator-bar">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span v-else class="song-number">{{ index + 1 }}</span>
            </div>
            <div class="cell title-cell">
              <span v-if="song.isFromKw" class="kw-hr-badge">HR</span>
              <span class="song-name-text">{{ song.name }}</span>
            </div>
            <div class="cell artist-cell">
              <span class="artist-name-text">{{ song.artist || '未知歌手' }}</span>
            </div>
            <div class="cell album-cell">
              <span>{{ song.album || '未知专辑' }}</span>
            </div>
            <div class="cell actions-cell">
              <div class="song-actions">
                <button class="action-icon" @click.stop="removeFavorite('songs', song.id)">
                  <el-icon><Close /></el-icon>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 本地榜单 -->
      <div v-if="activeTab === 'rankings'" class="tab-content">
        <div v-if="loading" class="loading-state">
          <div class="loading-spinner"></div>
          <p>加载中...</p>
        </div>
        <div v-else-if="error" class="error-state">
          <p>{{ error }}</p>
          <button @click="loadFavorites('rankings')">重试</button>
        </div>
        <div v-else-if="favoriteRankings.length === 0" class="empty-state">
          <p>暂无收藏的榜单</p>
          <button @click="goToDiscover" class="discover-button">去发现音乐</button>
        </div>
        <div v-else class="rankings-grid">
          <div 
            v-for="ranking in favoriteRankings" 
            :key="ranking.id" 
            class="ranking-card"
            :data-source="ranking.source"
            @click="goToRanking(ranking)"
          >
            <div class="ranking-cover">
              <img :src="ranking.coverImgUrl || defaultCoverUrl" alt="榜单封面">
              <div class="ranking-badge">榜单</div>
              <div class="ranking-play-count">
                <span class="icon">▶</span>
                {{ formatPlayCount(ranking.playCount) }}
              </div>
            </div>
            <div class="ranking-info">
              <h3 class="ranking-name">{{ ranking.name }}</h3>
              <p class="ranking-update">{{ ranking.updateFrequency || '未知更新频率' }}</p>
            </div>
            <div class="ranking-actions">
              <button class="action-button" @click.stop="removeFavorite('rankings', ranking.id)">
                <el-icon><Close /></el-icon>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 本地歌单 -->
      <div v-if="activeTab === 'playlists'" class="tab-content">
        <div v-if="loading" class="loading-state">
          <div class="loading-spinner"></div>
          <p>加载中...</p>
        </div>
        <div v-else-if="error" class="error-state">
          <p>{{ error }}</p>
          <button @click="loadFavorites('playlists')">重试</button>
        </div>
        <div v-else-if="favoritePlaylists.length === 0" class="empty-state">
          <p>暂无收藏的歌单</p>
          <button @click="goToDiscover" class="discover-button">去发现音乐</button>
        </div>
        <div v-else class="playlists-grid">
          <div 
            v-for="playlist in favoritePlaylists" 
            :key="playlist.id" 
            class="playlist-card"
            @click="goToPlaylist(playlist)"
          >
            <div class="playlist-cover">
              <img :src="playlist.coverImgUrl || defaultCoverUrl" alt="歌单封面">
              <div class="playlist-play-count">
                <span class="icon">▶</span>
                {{ formatPlayCount(playlist.playCount) }}
              </div>
            </div>
            <div class="playlist-info">
              <h3 class="playlist-name">{{ playlist.name }}</h3>
              <p class="playlist-creator">{{ playlist.creator?.nickname || '未知创建者' }}</p>
            </div>
            <div class="playlist-actions">
              <button class="action-button" @click.stop="removeFavorite('playlists', playlist.id)">
                <el-icon><Close /></el-icon>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 本地MV -->
      <div v-if="activeTab === 'mvs'" class="tab-content">
        <div v-if="loading" class="loading-state">
          <div class="loading-spinner"></div>
          <p>加载中...</p>
        </div>
        <div v-else-if="error" class="error-state">
          <p>{{ error }}</p>
          <button @click="loadFavorites('mvs')">重试</button>
        </div>
        <div v-else-if="favoriteMvs.length === 0" class="empty-state">
          <p>暂无收藏的MV</p>
          <button @click="goToDiscover" class="discover-button">去发现音乐</button>
        </div>
        <div v-else class="mvs-grid">
          <div 
            v-for="mv in favoriteMvs" 
            :key="mv.id" 
            class="mv-card"
            @click="goToMv(mv)"
          >
            <div class="mv-cover">
              <img :src="mv.coverImgUrl || defaultCoverUrl" alt="MV封面">
              <div class="mv-play-icon">▶</div>
            </div>
            <div class="mv-info">
              <h3 class="mv-name">{{ mv.name }}</h3>
              <p class="mv-artist">{{ mv.artist || mv.artistName || '未知艺术家' }}</p>
            </div>
            <div class="mv-actions">
              <button class="action-button" @click.stop="removeFavorite('mvs', mv.id)">
                <el-icon><Close /></el-icon>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 本地专辑 -->
      <div v-if="activeTab === 'albums'" class="tab-content">
        <div v-if="loading" class="loading-state">
          <div class="loading-spinner"></div>
          <p>加载中...</p>
        </div>
        <div v-else-if="error" class="error-state">
          <p>{{ error }}</p>
          <button @click="loadFavorites('albums')">重试</button>
        </div>
        <div v-else-if="favoriteAlbums.length === 0" class="empty-state">
          <p>暂无收藏的专辑</p>
          <button @click="goToDiscover" class="discover-button">去发现音乐</button>
        </div>
        <div v-else class="albums-grid">
          <div 
            v-for="album in favoriteAlbums" 
            :key="album.id" 
            class="album-card"
            @click="goToAlbum(album)"
          >
            <div class="album-cover">
              <img :src="album.picUrl || defaultCoverUrl" alt="专辑封面">
            </div>
            <div class="album-info">
              <h3 class="album-name">{{ album.name }}</h3>
              <p class="album-artist">{{ album.artist?.name || '未知艺术家' }}</p>
            </div>
            <div class="album-actions">
              <button class="action-button" @click.stop="removeFavorite('albums', album.id)">
                <el-icon><Close /></el-icon>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, defineComponent, computed, onActivated, onDeactivated, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { getFavorites, removeFromFavorites } from '../services/favoritesService';
import { usePlayerStore } from '../stores/player';
import { Close } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

// 定义组件名称以支持keep-alive
defineComponent({
  name: 'FavoritesView'
});

const router = useRouter();
const route = useRoute();
const playerStore = usePlayerStore();

// 基础数据
const activeTab = ref(route.query.tab || 'songs');
const loading = ref(false);
const error = ref(null);
const defaultCoverUrl = 'https://p2.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg';

// 收藏数据
const favoriteSongs = ref([]);
const favoritePlaylists = ref([]);
const favoriteMvs = ref([]);
const favoriteRankings = ref([]);
const favoriteAlbums = ref([]);

// 计算属性：判断是否是当前播放的歌曲
const isCurrentSong = (songId) => {
  if (!playerStore.currentSong || !songId) return false;
  
  // 转换为字符串进行比较，避免类型不匹配
  const currentId = String(playerStore.currentSong.id);
  const compareId = String(songId);
  
  // 直接ID匹配
  if (currentId === compareId) return true;
  
  // 处理可能的ID前缀情况
  if (currentId.startsWith('kw_') && compareId.endsWith(currentId.substring(3))) return true;
  if (compareId.startsWith('kw_') && currentId.endsWith(compareId.substring(3))) return true;
  
  if (currentId.startsWith('main_') && compareId.endsWith(currentId.substring(5))) return true;
  if (compareId.startsWith('main_') && currentId.endsWith(compareId.substring(5))) return true;
  
  // 检查酷我歌曲的rid匹配
  if (playerStore.currentSong.rid && playerStore.currentSong.rid === songId) return true;
  
  return false;
};

// 计算属性：是否正在播放
const isPlaying = computed(() => {
  return playerStore.isPlaying;
});

// 判断歌曲是否正在播放（不仅是选中，而且是真正在播放）
const isSongPlaying = (songId) => {
  return isCurrentSong(songId) && isPlaying.value;
};

// 监听路由变化
watch(() => route.query.tab, (newTab) => {
  activeTab.value = newTab || 'songs';
  loadFavorites(activeTab.value);
});

// 加载收藏内容
const loadFavorites = (type) => {
  loading.value = true;
  error.value = null;
  
  try {
    // 使用收藏服务加载数据
    if (type === 'songs') {
      favoriteSongs.value = getFavorites('SONGS');
    } else if (type === 'playlists') {
      favoritePlaylists.value = getFavorites('PLAYLISTS');
    } else if (type === 'mvs') {
      favoriteMvs.value = getFavorites('MVS');
    } else if (type === 'rankings') {
      favoriteRankings.value = getFavorites('RANKINGS');
    } else if (type === 'albums') {
      favoriteAlbums.value = getFavorites('ALBUMS');
    }
    
    // 保存缓存时间戳
    const lastUpdateKey = `last_update_favorites_${type}`;
    localStorage.setItem(lastUpdateKey, Date.now().toString());
    console.log(`[FavoritesView] 更新收藏缓存时间戳: ${type}`);
  } catch (err) {
    console.error('加载收藏数据失败:', err);
    error.value = '加载收藏数据失败';
  } finally {
    loading.value = false;
  }
};

// 切换标签
const changeTab = (tab) => {
  router.push({ path: '/favorites', query: { tab } });
};

// 播放歌曲
const playSong = (song, index) => {
  if (!song) return;
  
  try {
    console.log(`[FavoritesView] 尝试播放收藏歌曲: ${song.name}, ID: ${song.id}, 索引: ${index}`);
    
    // 获取当前完整的收藏歌曲列表
    const allFavoriteSongs = getFavorites('SONGS');
    
    // 确保歌曲对象中的关键属性正确
    const enhancedSongs = allFavoriteSongs.map((favSong, idx) => {
      const isCurrentSong = favSong.id === song.id;
      
      // 创建歌曲副本，避免修改原对象
      const enhancedSong = { ...favSong };
      
      // 确保ID是字符串类型
      enhancedSong.id = String(enhancedSong.id);
      
      // 检查是否是酷我歌曲
      const isKwSong = enhancedSong.isFromKw || 
          enhancedSong.rid || 
          (typeof enhancedSong.id === 'string' && 
           (enhancedSong.id.startsWith('kw_') || enhancedSong.id.startsWith('kw-')));
      
      // 对于所有收藏歌曲，始终强制刷新URL
      if (isKwSong) {
        // 确保isFromKw标记正确设置
        enhancedSong.isFromKw = true;
        // 强制刷新URL并清除旧URL
        enhancedSong.forceRefreshUrl = true;
        enhancedSong.url = null;
        enhancedSong.timestamp = null;
        console.log(`[FavoritesView] 酷我歌曲，强制刷新URL: ${enhancedSong.name}`);
      } else {
        // 网易云歌曲
        enhancedSong.isFromKw = false;
        // 对于网易云收藏歌曲，也强制刷新URL
        enhancedSong.forceRefreshUrl = true;
        enhancedSong.url = null;
        enhancedSong.timestamp = null;
        console.log(`[FavoritesView] 网易云收藏歌曲，强制刷新URL: ${enhancedSong.name}`);
      }
      
      return enhancedSong;
    });
    
    // 找到要播放歌曲在增强列表中的索引
    const correctIndex = enhancedSongs.findIndex(s => s.id === String(song.id));
    
    if (correctIndex === -1) {
      console.error(`[FavoritesView] 无法在收藏列表中找到歌曲: ${song.name}, ID: ${song.id}`);
      return;
    }
    
    console.log(`[FavoritesView] 播放收藏歌曲，使用完整收藏列表，歌曲: ${song.name}, 正确索引: ${correctIndex}`);
    
    // 使用playerStore直接播放，传递完整的增强歌曲列表和正确的索引
    // 这样可以确保播放列表中的所有歌曲都有正确的属性
    playerStore.resetSearchState();
    
    // 直接播放歌曲，不进行额外的检查和重试
    playerStore.playSong(enhancedSongs[correctIndex], correctIndex);
    
    // 移除额外的播放检查和重试逻辑，避免多次调用播放API
    // 让playerStore内部处理播放逻辑和错误重试
  } catch (error) {
    console.error(`[FavoritesView] 播放歌曲出错: ${error.message}`);
    ElMessage.error(`播放失败: ${error.message || '未知错误'}`);
  }
};

// 跳转到歌单详情
const goToPlaylist = (playlist) => {
  if (!playlist || !playlist.id) {
    console.error('无效的歌单数据:', playlist);
    return;
  }
  
  // 处理歌单ID
  let playlistId = playlist.id;
  
  // 检查是否是酷我歌单
  const isKwPlaylist = playlist.isFromKw || String(playlistId).startsWith('kw-');
  
  console.log(`[FavoritesView] 跳转到歌单，ID: ${playlistId}, 是否酷我: ${isKwPlaylist}`);
  
  const navigationParams = {
    name: 'playlist-detail',
    params: { id: playlistId },
    query: { 
      fromFavorites: 'true', // 添加来源标记，表示来自收藏页面
      favoriteTab: activeTab.value, // 添加当前标签信息
      ...(isKwPlaylist ? { source: 'kw' } : {})
    }
  };
  
  router.push(navigationParams);
};

// 跳转到MV详情
const goToMv = (mv) => {
  if (!mv || !mv.id) {
    console.error('无效的MV数据:', mv);
    return;
  }
  
  // 处理MV ID
  let mvId = mv.id;
  
  // 检查是否是酷我MV
  const isKwMv = mv.isFromKw || String(mvId).startsWith('kw_mv_');
  
  // 如果ID以kw_mv_开头，提取真实ID
  if (String(mvId).startsWith('kw_mv_')) {
    mvId = String(mvId).substring(6); // 去掉kw_mv_前缀
  }
  
  // 如果ID以main_mv_开头，提取真实ID
  if (String(mvId).startsWith('main_mv_')) {
    mvId = String(mvId).substring(8); // 去掉main_mv_前缀
  }
  
  console.log(`[FavoritesView] 跳转到MV，原始ID: ${mv.id}, 处理后ID: ${mvId}, 是否酷我: ${isKwMv}, 当前标签: ${activeTab.value}`);
  
  const navigationParams = {
    name: 'mv-detail',
    params: { id: mvId },
    query: { 
      fromFavorites: 'true', // 添加来源标记，表示来自收藏页面
      favoriteTab: activeTab.value, // 添加当前标签信息
      ...(isKwMv ? { source: 'kw' } : {})
    }
  };
  
  console.log('[FavoritesView] MV导航参数:', navigationParams);
  
  router.push(navigationParams);
};

// 跳转到榜单详情
const goToRanking = (ranking) => {
  if (!ranking || !ranking.id) {
    console.error('无效的榜单数据:', ranking);
    return;
  }
  
  // 处理榜单ID
  let rankingId = ranking.id;
  
  // 如果ID以main_rank_开头，提取真实ID
  if (String(rankingId).startsWith('main_rank_')) {
    rankingId = String(rankingId).substring(10); // 去掉main_rank_前缀
  }
  
  console.log(`[FavoritesView] 跳转到榜单，原始ID: ${ranking.id}, 处理后ID: ${rankingId}`);
  
  router.push({
    name: 'playlist-detail',
    params: { id: rankingId },
    query: { 
      isRanking: 'true',
      fromFavorites: 'true', // 添加来源标记，表示来自收藏页面
      favoriteTab: activeTab.value // 添加当前标签信息
    }
  });
};

// 跳转到发现音乐页面
const goToDiscover = () => {
  router.push('/playlists');
};

// 跳转到专辑详情页
const goToAlbum = (album) => {
  router.push({ 
    name: 'AlbumDetail', 
    params: { id: album.id },
    query: { 
      fromFavorites: 'true', // 添加来源标记，表示来自收藏页面
      favoriteTab: activeTab.value // 添加当前标签信息
    } 
  });
};

// 移除收藏
const removeFavorite = (type, id) => {
  try {
    let result = false;
    
    if (type === 'songs') {
      result = removeFromFavorites('SONGS', id);
      if (result) {
        favoriteSongs.value = favoriteSongs.value.filter(item => item.id !== id);
        
        // 检查是否是当前正在播放的歌曲
        if (playerStore.currentSong && playerStore.currentSong.id === id) {
          // 触发一个自定义事件，通知其他组件更新喜欢状态
          document.dispatchEvent(new CustomEvent('favorite-status-changed', {
            detail: { id, type: 'SONGS', isFavorited: false }
          }));
          
          // 如果需要，可以直接更新播放器中的状态
          // 这里我们不需要直接修改播放器状态，因为SongItem组件会自己检查收藏状态
          console.log('已从收藏中移除当前播放的歌曲');
        }
      }
    } else if (type === 'playlists') {
      result = removeFromFavorites('PLAYLISTS', id);
      if (result) {
        favoritePlaylists.value = favoritePlaylists.value.filter(item => item.id !== id);
      }
    } else if (type === 'mvs') {
      result = removeFromFavorites('MVS', id);
      if (result) {
        favoriteMvs.value = favoriteMvs.value.filter(item => item.id !== id);
      }
    } else if (type === 'rankings') {
      result = removeFromFavorites('RANKINGS', id);
      if (result) {
        favoriteRankings.value = favoriteRankings.value.filter(item => item.id !== id);
      }
    } else if (type === 'albums') {
      result = removeFromFavorites('ALBUMS', id);
      if (result) {
        favoriteAlbums.value = favoriteAlbums.value.filter(item => item.id !== id);
      }
    }
    
    if (!result) {
      console.warn(`移除收藏失败: 未找到ID为${id}的${type}项目`);
    }
  } catch (err) {
    console.error('移除收藏失败:', err);
    error.value = '移除收藏失败';
  }
};

// 格式化播放次数
const formatPlayCount = (count) => {
  if (!count) return '0';
  if (count < 10000) return count.toString();
  return (count / 10000).toFixed(1) + '万';
};

// 播放全部歌曲
const playAllFavorites = () => {
  if (favoriteSongs.value.length > 0) {
    playerStore.playSong(favoriteSongs.value[0], {
      index: 0,
      fullQueue: favoriteSongs.value
    });
  }
};

// 组件挂载时加载数据
onMounted(() => {
  // 初始化activeTab
  activeTab.value = route.query.tab || 'songs';
  loadFavorites(activeTab.value);
});

// 组件激活时
onActivated(async () => {
  // 获取收藏夹类型
  const favoritesType = route.params.type || 'SONGS';

  // 设置标题
  document.title = `${favoritesType === 'SONGS' ? '歌曲收藏' : '歌单收藏'} - 音乐播放器`;

  // 加载收藏数据
  loadFavorites();

  // 修复收藏的歌曲URL
  try {
    const { fixNeteaseFavoriteSongs, fixFavoriteSongsKwFlag } = await import('../services/favoritesService');
    
    // 修复酷我歌曲标记
    await fixFavoriteSongsKwFlag();
    
    // 修复网易云歌曲URL
    await fixNeteaseFavoriteSongs();
    
    // 重新加载收藏数据以获取最新状态
    loadFavorites();
    
    console.log('[FavoritesView] 收藏歌曲修复完成');
  } catch (error) {
    console.error('[FavoritesView] 修复收藏歌曲出错:', error);
  }
});

// 组件停用时（进入缓存）
onDeactivated(() => {
  // 保存滚动位置
  const scrollElement = document.querySelector('.content-area');
  if (scrollElement) {
    localStorage.setItem(`favorites_scroll_${activeTab.value}`, scrollElement.scrollTop.toString());
  }
});
</script>

<style scoped>
.favorites-view-container {
  padding: 10px 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  position: relative;
}

.page-title {
  font-size: 20px;
  margin: 10px 20px;
  color: white;
}

.favorites-nav {
  display: flex;
  margin-bottom: 15px;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: transparent;
  padding: 0 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.nav-tabs {
  display: flex;
  flex: 1;
  flex-wrap: nowrap;
}

.nav-tab {
  padding: 8px 15px;
  cursor: pointer;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  position: relative;
  text-align: center;
  white-space: nowrap;
  transition: all 0.2s;
  background: transparent;
}

.nav-tab:hover {
  color: rgba(255, 255, 255, 0.9);
}

.nav-tab.active {
  color: #fff;
  font-weight: 500;
}

.nav-tab.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 50%;
  transform: translateX(-50%);
  width: 30px;
  height: 2px;
  background-color: #fff;
}

.favorites-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px 100px 20px;
  -webkit-overflow-scrolling: touch;
  height: calc(100% - 50px);
  position: relative;
}

.tab-content {
  padding: 10px 0;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: rgba(255, 255, 255, 0.7);
}

.loading-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 错误状态 */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: rgba(255, 255, 255, 0.7);
}

.error-state button {
  margin-top: 10px;
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 20px;
  cursor: pointer;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: rgba(255, 255, 255, 0.7);
}

.discover-button {
  margin-top: 15px;
  background-color: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 8px 20px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.discover-button:hover {
  background-color: rgba(255, 255, 255, 0.3);
}

/* 歌曲列表样式 - 新版与播放页面一致 */
.songs-list {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.songs-list-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 10px 0;
  margin-bottom: 10px;
}

.song-item-header {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
}

.play-all-button-small {
  background: none;
  border: 1px solid #888;
  color: #ccc;
  padding: 5px 12px;
  border-radius: 15px;
  font-size: 0.75rem;
  cursor: pointer;
}

.play-all-button-small .icon {
  margin-right: 4px;
}

.play-all-button-small:hover {
  border-color: #fff;
  color: #fff;
}

.song-item-row-new {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: background-color 0.2s;
}

.song-item-row-new:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.playing {
  background-color: rgba(255, 255, 255, 0.05);
}

.cell {
  padding: 0 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.index-cell {
  width: 50px;
  text-align: center;
  flex: 0 0 50px;
}

.title-cell {
  flex: 3;
  text-align: left;
}

.artist-cell {
  flex: 2;
  text-align: left;
}

.album-cell {
  flex: 2;
  text-align: left;
  color: rgba(255, 255, 255, 0.6);
  font-weight: normal;
}

.actions-cell {
  width: 50px;
  flex: 0 0 50px;
  text-align: center;
}

.song-number {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.song-name-text {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #fff; /* 默认白色 */
}

.artist-name-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6); /* 默认浅灰色 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-actions {
  display: flex;
  justify-content: center;
}

.action-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: all 0.2s;
}

.action-icon:hover {
  background-color: rgba(0, 0, 0, 0.4);
  color: rgba(255, 255, 255, 0.9);
  transform: scale(1.1);
}

.action-icon .el-icon {
  font-size: 14px;
}

/* 播放指示器动画 */
.playing-indicator-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 16px;
}

.playing-indicator-bar span {
  display: inline-block;
  width: 3px;
  height: 100%;
  margin: 0 1px;
  animation: playing-bar-animation 1.2s ease-in-out infinite;
}

.playing-indicator-bar span:nth-child(1) {
  animation-delay: 0s;
  height: 40%;
  background-color: #FF4D4F; /* 红色 */
}

.playing-indicator-bar span:nth-child(2) {
  animation-delay: 0.2s;
  height: 100%;
  background-color: #FFD700; /* 黄色 */
}

.playing-indicator-bar span:nth-child(3) {
  animation-delay: 0.4s;
  height: 80%;
  background-color: #00FF00; /* 绿色 */
}

.playing-indicator-bar span:nth-child(4) {
  animation-delay: 0.6s;
  height: 40%;
  background-color: #8A2BE2; /* 紫色 */
}

@keyframes playing-bar-animation {
  0% {
    transform: scaleY(0.3);
  }
  100% {
    transform: scaleY(1);
  }
}

/* 播放状态下的样式 - 重写 */
.song-item-row-new.playing {
  background-color: rgba(255, 255, 255, 0.05);
}

/* 明确指定播放状态下歌名的样式 - 默认不变色 */
.song-item-row-new.playing .title-cell .song-name-text {
  color: inherit; /* 默认不变色 */
}

/* 明确指定播放状态下歌手名的样式 - 默认不变色 */
.song-item-row-new.playing .artist-cell .artist-name-text {
  color: inherit; /* 默认不变色 */
}

/* 只有在真正播放时才变色 - 使用actually-playing类 */
.song-item-row-new.actually-playing .title-cell .song-name-text {
  color: #D946EF !important; /* 紫色 */
  font-weight: bold;
}

.song-item-row-new.actually-playing .artist-cell .artist-name-text {
  color: #FFD700 !important; /* 黄色 */
  font-weight: bold;
}

/* 选中状态不改变颜色 */
.song-item-row-new:hover .title-cell .song-name-text,
.song-item-row-new:hover .artist-cell .artist-name-text {
  color: inherit; /* 保持原来的颜色 */
}

/* 歌单网格样式 */
.playlists-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 15px;
  padding-bottom: 20px;
}

.playlist-card {
  cursor: pointer;
  transition: transform 0.2s;
  position: relative;
}

.playlist-card:hover {
  transform: translateY(-3px);
}

.playlist-cover {
  position: relative;
  width: 100%;
  padding-top: 100%;
  border-radius: 6px;
  overflow: hidden;
}

.playlist-cover img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.playlist-play-count {
  position: absolute;
  top: 3px;
  right: 3px;
  background-color: rgba(0, 0, 0, 0.5);
  color: #fff;
  padding: 1px 4px;
  border-radius: 8px;
  font-size: 10px;
  display: flex;
  align-items: center;
}

.playlist-play-count .icon {
  font-size: 8px;
  margin-right: 2px;
}

.playlist-info {
  padding: 5px 1px;
}

.playlist-name {
  font-size: 12px;
  margin: 0 0 3px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.playlist-creator {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.playlist-actions {
  position: absolute;
  top: 5px;
  right: 5px;
  opacity: 0;
  transition: opacity 0.2s;
}

.playlist-card:hover .playlist-actions {
  opacity: 1;
}

/* MV网格样式 */
.mvs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 15px;
  padding-bottom: 20px;
}

.mv-card {
  cursor: pointer;
  transition: transform 0.2s;
  position: relative;
}

.mv-card:hover {
  transform: translateY(-3px);
}

.mv-cover {
  position: relative;
  width: 100%;
  padding-top: 56.25%; /* 16:9比例 */
  border-radius: 6px;
  overflow: hidden;
}

.mv-cover img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mv-play-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.mv-card:hover .mv-play-icon {
  opacity: 1;
}

.mv-info {
  padding: 5px 1px;
}

.mv-name {
  font-size: 12px;
  margin: 0 0 3px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mv-artist {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mv-actions {
  position: absolute;
  top: 5px;
  right: 5px;
  opacity: 0;
  transition: opacity 0.2s;
}

.mv-card:hover .mv-actions {
  opacity: 1;
}

/* 通用操作按钮样式 */
.action-button {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: all 0.2s;
}

.action-button:hover {
  background-color: rgba(0, 0, 0, 0.4);
  color: rgba(255, 255, 255, 0.9);
  transform: scale(1.1);
}

.action-button .el-icon {
  font-size: 14px;
}

/* 榜单网格样式 */
.rankings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 15px;
  padding-bottom: 20px;
}

.ranking-card {
  cursor: pointer;
  transition: transform 0.2s;
  position: relative;
}

.ranking-card:hover {
  transform: translateY(-3px);
}

.ranking-cover {
  position: relative;
  width: 100%;
  padding-top: 100%;
  border-radius: 6px;
  overflow: hidden;
}

.ranking-cover img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 酷我榜单特殊样式 */
.ranking-card[data-source="kw"] .ranking-cover img {
  object-fit: contain;
  background-color: rgba(0, 0, 0, 0.2);
  width: 100%;
  height: 100%;
}

.ranking-badge {
  position: absolute;
  top: 3px;
  right: 3px;
  background-color: rgba(0, 0, 0, 0.5);
  color: #fff;
  padding: 1px 4px;
  border-radius: 8px;
  font-size: 10px;
  display: flex;
  align-items: center;
}

.ranking-badge .icon {
  font-size: 8px;
  margin-right: 2px;
}

.ranking-info {
  padding: 5px 1px;
}

.ranking-name {
  font-size: 12px;
  margin: 0 0 3px 0;
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
  line-height: 1.3;
  height: auto;
  max-height: 2.4em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* 酷我榜单名称特殊样式 */
.ranking-card[data-source="kw"] .ranking-name {
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
  line-height: 1.3;
  font-weight: bold;
  font-size: 14px;
  height: auto;
  max-height: 2.8em;
}

.ranking-update {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ranking-actions {
  position: absolute;
  top: 5px;
  right: 5px;
  opacity: 0;
  transition: opacity 0.2s;
}

.ranking-card:hover .ranking-actions {
  opacity: 1;
}

/* 酷我榜单特殊标识 */
.ranking-card[data-source="kw"] .ranking-cover::after {
  content: '酷我';
  position: absolute;
  top: 0;
  left: 0;
  background-color: rgba(255, 0, 0, 0.8);
  color: white;
  padding: 2px 6px;
  font-size: 10px;
  border-radius: 0 0 4px 0;
  z-index: 1;
}

/* 专辑网格样式 */
.albums-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 15px;
  padding-bottom: 20px;
}

.album-card {
  cursor: pointer;
  transition: transform 0.2s;
  position: relative;
}

.album-card:hover {
  transform: translateY(-3px);
}

.album-cover {
  position: relative;
  width: 100%;
  padding-top: 100%;
  border-radius: 6px;
  overflow: hidden;
}

.album-cover img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.album-info {
  padding: 5px 1px;
}

.album-name {
  font-size: 12px;
  margin: 0 0 3px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.album-artist {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.album-actions {
  position: absolute;
  top: 5px;
  right: 5px;
  opacity: 0;
  transition: opacity 0.2s;
}

.album-card:hover .album-actions {
  opacity: 1;
}

.kw-hr-badge {
  background-color: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  font-size: 6px;
  font-weight: bold;
  padding: 1px 4px;
  border-radius: 3px;
  margin-right: 5px;
  display: inline-block;
}
</style> 