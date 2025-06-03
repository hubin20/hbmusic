<template>
  <div class="playlist-detail-view" :data-source="playlistDetail?.isKwPlaylist || route.query.source === 'kw' ? 'kw' : 'main'">
    <div v-if="loading" class="loading-state">
      <p>加载中...</p>
    </div>
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button @click="fetchPlaylistDetail">重试</button>
    </div>
    <div v-else-if="playlistDetail" class="playlist-content">
      <!-- 返回按钮 -->
      <div class="back-button-container">
        <button class="action-button" @click="goBack">
          返回
        </button>
      </div>
      
      <!-- 歌单头部信息 -->
      <div class="playlist-header">
        <div class="playlist-cover">
          <img :src="playlistDetail.coverImgUrl || defaultCoverUrl" alt="歌单封面">
        </div>
        <div class="playlist-info">
          <h2 class="playlist-title">{{ playlistDetail.name }}</h2>
          <div class="playlist-creator">
            <img :src="playlistDetail.creator?.avatarUrl || defaultCoverUrl" alt="创建者头像" class="creator-avatar">
            <div class="creator-info">
              <div class="creator-name">{{ playlistDetail.creator?.nickname || '未知创建者' }}</div>
              <div class="create-time">{{ formatDate(playlistDetail.createTime) }}创建</div>
            </div>
          </div>
          <div class="playlist-stats">
            <div class="stat-item">
              <span class="stat-value">{{ formatPlayCount(playlistDetail.playCount) }}</span>
              <span class="stat-label">播放</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ formatPlayCount(playlistDetail.subscribedCount) }}</span>
              <span class="stat-label">收藏</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ playlistDetail.shareCount || 0 }}</span>
              <span class="stat-label">分享</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ playlistDetail.commentCount || 0 }}</span>
              <span class="stat-label">评论</span>
            </div>
          </div>
          <div class="playlist-tags" v-if="playlistDetail.tags && playlistDetail.tags.length">
            <span class="tag" v-for="tag in playlistDetail.tags" :key="tag">{{ tag }}</span>
          </div>
          <p class="playlist-description" v-if="playlistDetail.description">{{ truncateDescription(playlistDetail.description) }}</p>
        </div>
      </div>

      <!-- 歌单操作按钮 -->
      <div class="playlist-actions">
        <button class="action-button primary" @click="playAllSongs">
          <span class="icon">▶</span> 播放全部
        </button>
        <button class="action-button" @click="toggleFavorite">
          <span class="icon">{{ isFavoritedPlaylist ? '♥' : '+' }}</span> {{ isFavoritedPlaylist ? '已收藏' : '收藏' }}({{ formatPlayCount(playlistDetail.subscribedCount) }})
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
        <div class="header-cell song-album-cell">专辑</div>
        <div class="header-cell song-duration-cell">时长</div>
      </div>

      <div class="song-list">
        <div 
          v-for="(song, index) in playlistSongs" 
          :key="song.id" 
          class="song-item"
          :class="{ 'playing': isCurrentPlaying(song.id) }"
          @click="playSong(song, index)"
        >
          <div class="song-cell song-index-cell">
            <span v-if="!isCurrentPlaying(song.id)" class="song-index">{{ index + 1 }}</span>
            <span v-else class="playing-icon">▶</span>
          </div>
          <div class="song-cell song-title-cell">
            <div class="song-title-wrapper">
              <span class="song-title">{{ song.name }}</span>
              <span class="song-quality" v-if="song.sq || song.hr">{{ song.hr ? 'Hi-Res' : (song.sq ? 'SQ' : '') }}</span>
            </div>
          </div>
          <div class="song-cell song-artist-cell">{{ song.ar?.map(a => a.name).join(', ') || song.artists?.map(a => a.name).join(', ') || '未知歌手' }}</div>
          <div class="song-cell song-album-cell">{{ song.al?.name || song.album?.name || '未知专辑' }}</div>
          <div class="song-cell song-duration-cell">
            <div class="duration-wrapper">
              <span class="duration">{{ formatDuration(song.dt) }}</span>
              <div class="song-actions">
                <button class="song-action-btn">
                  <span class="action-icon">♡</span>
                </button>
                <button class="song-action-btn">
                  <span class="action-icon">↓</span>
                </button>
                <button class="song-action-btn">
                  <span class="action-icon">⋯</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, onActivated, onDeactivated, nextTick, defineComponent, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePlayerStore } from '../stores/player';
import { getPlaylistDetail, getPlaylistTracks, getKwPlaylistDetail } from '../services/api';
import { addToFavorites, removeFromFavorites, isFavorited, getFavorites } from '../services/favoritesService';
import { ElMessage } from 'element-plus';
import axios from 'axios';

// 定义API基础URL常量
const KW_API_URL = 'https://kw-api.cenguigui.cn';

// 定义组件名称以支持keep-alive
defineComponent({
  name: 'PlaylistDetailView'
});

// 使用name选项直接定义组件名称
const __NAME__ = 'PlaylistDetailView';

/**
 * 将HTTP URL转换为HTTPS
 * @param {string} url - 图片URL
 * @returns {string} - 转换后的URL
 */
const convertHttpToHttps = (url) => {
  if (!url) return url;
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  return url;
};

const route = useRoute();
const router = useRouter();
const playerStore = usePlayerStore();

const loading = ref(true);
const error = ref(null);
const playlistDetail = ref(null);
const playlistSongs = ref([]);
const cachedPlaylistData = {}; // 新增：用于缓存歌单数据
const defaultCoverUrl = 'https://p2.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg';

// 添加滚动恢复相关状态
const isRestoringScroll = ref(false);

// 添加是否已收藏的状态
const isFavoritedPlaylist = ref(false);

/**
 * 获取歌单详情
 */
const fetchPlaylistDetail = async (forceRefresh = false) => {
  const playlistId = route.params.id;
  if (!playlistId) {
    error.value = '未指定歌单ID';
    loading.value = false;
    return;
  }
  
  loading.value = true;
  error.value = null;
  
  // 检查缓存
  if (!forceRefresh && cachedPlaylistData[playlistId]) {
    playlistDetail.value = cachedPlaylistData[playlistId].detail;
    playlistSongs.value = cachedPlaylistData[playlistId].songs;
    loading.value = false;
    console.log(`[PlaylistDetailView] 使用缓存的歌单数据, ID: ${playlistId}`);
    return;
  }
  
  const source = route.query.source || 'main';
  const isRanking = route.query.isRanking === 'true'; // 检查是否是排行榜

  try {
    // 检查是否是本地收藏的歌单
    const favoritePlaylists = getFavorites('PLAYLISTS');
    const favoritePlaylist = favoritePlaylists.find(p => p.id === playlistId);
    
    // 检查是否是本地收藏的榜单
    const favoriteRankings = getFavorites('RANKINGS');
    const favoriteRanking = favoriteRankings.find(r => r.id === playlistId);
    
    if (favoritePlaylist) {
      console.log(`[PlaylistDetailView] 检测到本地收藏歌单, ID: ${playlistId}`);
      // 如果是本地收藏的歌单，使用收藏时保存的source
      const actualSource = favoritePlaylist.source || source;
      
      // 如果本地收藏的歌单有source信息，使用该source重新获取详情
      if (actualSource === 'kw') {
        // 对于酷我歌单，使用酷我API
        const kwResponse = await getKwPlaylistDetail(playlistId);
        if (kwResponse && kwResponse.data) {
          handleKwPlaylistResponse(kwResponse, playlistId);
        } else {
          throw new Error(kwResponse?.msg || '无法加载酷我歌单详情');
        }
      } else {
        // 对于主API歌单，使用主API
        const response = await getPlaylistDetail(playlistId);
        if (response.code === 200 && response.playlist) {
          handleMainPlaylistResponse(response, playlistId, isRanking);
        } else {
          throw new Error(response.message || '无法加载主API歌单详情');
        }
      }
      return;
    } else if (favoriteRanking) {
      console.log(`[PlaylistDetailView] 检测到本地收藏榜单, ID: ${playlistId}`);
      // 如果是本地收藏的榜单，使用收藏时保存的source
      const actualSource = favoriteRanking.source || source;
      
      // 处理酷我榜单
      if (actualSource === 'kw') {
        // 从ID中提取榜单名称
        const rankNameMatch = playlistId.match(/kw_rank_(.+?)_/);
        const rankName = rankNameMatch ? decodeURIComponent(rankNameMatch[1]) : '热歌榜'; // 默认使用热歌榜，并解码URL编码的名称
        
        console.log(`[PlaylistDetailView] 获取酷我榜单详情, 榜单名称: ${rankName}`);
        const kwResponse = await axios.get(`${KW_API_URL}`, { params: { name: rankName, type: 'rank' } });
        
        if (kwResponse?.data?.code === 200) {
          handleKwRankingResponse(kwResponse, playlistId, rankName);
        } else {
          throw new Error(kwResponse?.msg || '无法加载酷我榜单详情');
        }
      } else {
        // 对于主API榜单，使用主API
        const response = await getPlaylistDetail(playlistId.replace('main_rank_', ''));
        if (response.code === 200 && response.playlist) {
          handleMainPlaylistResponse(response, playlistId, true);
        } else {
          throw new Error(response.message || '无法加载主API榜单详情');
        }
      }
      return;
    }
    
    // 处理酷我榜单ID格式
    if (playlistId.includes('kw_rank_')) {
      const rankNameMatch = playlistId.match(/kw_rank_(.+?)_/);
      const rankName = rankNameMatch ? decodeURIComponent(rankNameMatch[1]) : '热歌榜'; // 默认使用热歌榜，并解码URL编码的名称
      
      console.log(`[PlaylistDetailView] 获取酷我榜单详情, 榜单名称: ${rankName}, ID: ${playlistId}`);
      const kwResponse = await axios.get(`${KW_API_URL}`, { params: { name: rankName, type: 'rank' } });
      
      if (kwResponse?.data?.code === 200) {
        handleKwRankingResponse(kwResponse, playlistId, rankName);
      } else {
        throw new Error(kwResponse?.msg || '无法加载酷我榜单详情');
      }
      return;
    } else if (playlistId.includes('rank_')) {
      // 尝试处理其他可能的酷我榜单ID格式
      const rankIdMatch = playlistId.match(/rank_(.+)/);
      if (rankIdMatch) {
        const rankId = rankIdMatch[1];
        console.log(`[PlaylistDetailView] 尝试通过ID获取酷我榜单详情, ID: ${rankId}`);
        
        // 尝试几个常见的榜单名称
        const commonRankings = ['飙升榜', '新歌榜', '热歌榜', '歌曲榜', 'DJ榜', '畅听榜'];
        let foundRanking = false;
        
        for (const rankName of commonRankings) {
          try {
            const kwResponse = await axios.get(`${KW_API_URL}`, { params: { name: rankName, type: 'rank' } });
            if (kwResponse?.data?.code === 200) {
              console.log(`[PlaylistDetailView] 找到匹配的榜单: ${rankName}`);
              handleKwRankingResponse(kwResponse, playlistId, rankName);
              foundRanking = true;
              break;
            }
          } catch (e) {
            console.error(`[PlaylistDetailView] 尝试获取榜单 ${rankName} 失败:`, e);
          }
        }
        
        if (foundRanking) return;
      }
    }
    
    if (source === 'main' || isRanking) { // 排行榜也使用主API
      console.log(`[PlaylistDetailView] 获取${isRanking ? '排行榜' : '歌单'}详情, ID: ${playlistId}`);
      const response = await getPlaylistDetail(playlistId);
      if (response.code === 200 && response.playlist) {
        handleMainPlaylistResponse(response, playlistId, isRanking);
      } else {
        throw new Error(response.message || `无法加载${isRanking ? '排行榜' : '主API歌单'}详情`);
      }
    } else if (source === 'kw') {
      const kwResponse = await getKwPlaylistDetail(playlistId);
      if (kwResponse && kwResponse.data) {
        handleKwPlaylistResponse(kwResponse, playlistId);
      } else {
        throw new Error(kwResponse?.msg || '无法加载酷我歌单详情');
      }
    }
  } catch (e) {
    console.error('[PlaylistDetailView] 获取歌单详情失败:', e);
    error.value = e.message || '加载歌单详情失败';
  } finally {
    loading.value = false;
  }
};

// 处理主API歌单响应的辅助函数
const handleMainPlaylistResponse = (response, playlistId, isRanking = false) => {
  playlistDetail.value = {
    id: response.playlist.id,
    name: response.playlist.name,
    coverImgUrl: convertHttpToHttps(response.playlist.coverImgUrl || defaultCoverUrl),
    trackCount: response.playlist.trackCount,
    playCount: response.playlist.playCount,
    description: response.playlist.description,
    creator: response.playlist.creator ? {
      nickname: response.playlist.creator.nickname,
      avatarUrl: convertHttpToHttps(response.playlist.creator.avatarUrl),
    } : { nickname: '未知创建者', avatarUrl: '' },
    createTime: response.playlist.createTime,
    subscribedCount: response.playlist.subscribedCount,
    shareCount: response.playlist.shareCount,
    commentCount: response.playlist.commentCount,
    tags: response.playlist.tags,
    isRanking: isRanking,
    updateFrequency: response.playlist.updateFrequency || (isRanking ? '每日更新' : undefined)
  };
  if (Array.isArray(response.playlist.tracks)) {
    playlistSongs.value = response.playlist.tracks.map(track => ({
      ...track,
      dt: track.dt || track.duration || 0, 
      al: track.al ? {
        ...track.al,
        picUrl: convertHttpToHttps(track.al.picUrl)
      } : track.al,
      source: 'main'
    }));
  }
  // 缓存获取到的数据
  cachedPlaylistData[playlistId] = { detail: playlistDetail.value, songs: playlistSongs.value };
  console.log(`[PlaylistDetailView] 缓存${isRanking ? '排行榜' : '主API歌单'}数据, ID: ${playlistId}`);
};

// 处理酷我歌单响应的辅助函数
const handleKwPlaylistResponse = async (kwResponse, playlistId) => {
  const kwData = kwResponse.data;
  
  // 处理可能带有"kw-"前缀的ID
  const playlistIdStr = String(playlistId); // 确保转换为字符串
  const realId = playlistIdStr.startsWith('kw-') ? playlistIdStr : `kw-${kwData.id}`;
  
  playlistDetail.value = {
    id: realId, // 使用一致的ID格式
    name: kwData.name,
    coverImgUrl: convertHttpToHttps(kwData.img || defaultCoverUrl),
    trackCount: kwData.total,
    playCount: kwData.playCount || 0,
    description: kwData.info,
    creator: {
      nickname: kwData.userName || '未知创建者',
      avatarUrl: convertHttpToHttps(kwData.userPic || ''),
    },
    isKwPlaylist: true,
    createTime: kwData.pub || Date.now(), // 酷我API可能没有创建时间，使用当前时间
    subscribedCount: 0, // 酷我API可能没有收藏数
    shareCount: 0, // 酷我API可能没有分享数
    commentCount: 0, // 酷我API可能没有评论数
    tags: [], // 酷我API可能没有标签
  };

  if (Array.isArray(kwData.musicList)) {
    const songPromises = kwData.musicList.map(async (songStub, index) => {
      // 确保歌曲ID格式一致，使用kw_前缀而不是kw-
      const kwRid = songStub.rid || songStub.id;
      const songId = `kw_${kwRid || index}`;
      let songDurationMs = 0;
      let picUrl = convertHttpToHttps(songStub.pic || defaultCoverUrl);
      let artistName = songStub.artist || '未知歌手';
      let albumName = songStub.album || '未知专辑';

      try {
        const songObjectForApi = {
          id: `kw_${kwRid}`,
          name: songStub.name || '未知歌曲',
          artist: artistName,
          albumArt: picUrl,
          duration: 0, 
          isFromKw: true
        };

        const songDetails = await playerStore._fetchSongUrlFromFallbackApi(songObjectForApi);
        if (songDetails && typeof songDetails.duration === 'number' && songDetails.duration > 0) {
          songDurationMs = songDetails.duration;
          picUrl = songDetails.albumArt || picUrl;
          artistName = songDetails.artist || artistName; 
          albumName = songDetails.album || albumName;   
        }
      } catch (err) {
        console.error(`[PlaylistDetailView] 获取酷我歌曲详情(RID: ${kwRid})时出错:`, err);
      }

      return {
        id: songId,
        name: songStub.name || '未知歌曲',
        ar: [{ name: artistName }], 
        al: { name: albumName, picUrl: picUrl }, 
        dt: songDurationMs, 
        source: 'kw',
        rid: kwRid,
        isFromKw: true, 
        kwRid: kwRid,   
      };
    });
    playlistSongs.value = await Promise.all(songPromises);
  }
  // 缓存获取到的数据
  cachedPlaylistData[playlistId] = { detail: playlistDetail.value, songs: playlistSongs.value };
  console.log(`[PlaylistDetailView] 缓存酷我API歌单数据, ID: ${playlistId}`);
};

// 处理酷我榜单响应的辅助函数
const handleKwRankingResponse = async (kwResponse, playlistId, rankName) => {
  const kwData = kwResponse.data;
  
  console.log(`[PlaylistDetailView] 处理酷我榜单响应, 榜单名称: ${rankName}, 数据:`, kwData);
  
  // 构建榜单详情
  playlistDetail.value = {
    id: playlistId,
    name: rankName || '酷我榜单',
    coverImgUrl: convertHttpToHttps(kwData.pic || kwData.data?.pic || kwData.img || defaultCoverUrl),
    trackCount: kwData.data?.musicList?.length || 0,
    playCount: kwData.data?.playCount || kwData.playCount || 0,
    description: `酷我音乐${rankName}，每日更新`,
    creator: {
      nickname: '酷我音乐',
      avatarUrl: convertHttpToHttps(defaultCoverUrl),
    },
    isKwPlaylist: true,
    isRanking: true,
    createTime: Date.now(),
    subscribedCount: 0,
    shareCount: 0,
    commentCount: 0,
    tags: ['榜单', '热门'],
    updateFrequency: '每日更新'
  };

  // 处理歌曲列表 - 注意检查不同的数据结构路径
  const musicList = kwData.data?.musicList || kwData.musicList || [];
  
  if (Array.isArray(musicList) && musicList.length > 0) {
    console.log(`[PlaylistDetailView] 处理酷我榜单歌曲列表, 数量: ${musicList.length}`);
    
    // 打印第一首歌曲的结构，帮助调试
    if (musicList[0]) {
      console.log(`[PlaylistDetailView] 第一首歌曲结构:`, musicList[0]);
    }
    
    const songPromises = musicList.map(async (songStub, index) => {
      // 确保歌曲ID格式一致
      const kwRid = songStub.rid || songStub.id;
      const songId = `kw_${kwRid || index}`;
      
      // 提取歌曲信息
      let songDurationMs = 0;
      if (songStub.interval) {
        // 尝试从interval字段解析时长，格式可能是"02:53"
        const timeParts = songStub.interval.split(':');
        if (timeParts.length === 2) {
          const minutes = parseInt(timeParts[0], 10);
          const seconds = parseInt(timeParts[1], 10);
          songDurationMs = (minutes * 60 + seconds) * 1000;
        }
      }
      
      let picUrl = convertHttpToHttps(songStub.pic || defaultCoverUrl);
      let artistName = songStub.artist || '未知歌手';
      let albumName = songStub.album || '未知专辑';

      try {
        const songObjectForApi = {
          id: `kw_${kwRid}`,
          name: songStub.name || '未知歌曲',
          artist: artistName,
          albumArt: picUrl,
          duration: songDurationMs || 0, 
          isFromKw: true
        };

        // 只有在没有足够信息时才请求详细数据
        if (!songDurationMs || !picUrl) {
          console.log(`[PlaylistDetailView] 获取酷我歌曲详情, RID: ${kwRid}`);
          const songDetails = await playerStore._fetchSongUrlFromFallbackApi(songObjectForApi);
          if (songDetails && typeof songDetails.duration === 'number' && songDetails.duration > 0) {
            songDurationMs = songDetails.duration;
            picUrl = songDetails.albumArt || picUrl;
            artistName = songDetails.artist || artistName; 
            albumName = songDetails.album || albumName;   
          }
        }
      } catch (err) {
        console.error(`[PlaylistDetailView] 获取酷我歌曲详情(RID: ${kwRid})时出错:`, err);
      }

      return {
        id: songId,
        name: songStub.name || '未知歌曲',
        ar: [{ name: artistName }], 
        al: { name: albumName, picUrl: picUrl }, 
        dt: songDurationMs, 
        source: 'kw',
        rid: kwRid,
        isFromKw: true, 
        kwRid: kwRid,   
      };
    });
    
    playlistSongs.value = await Promise.all(songPromises);
    console.log(`[PlaylistDetailView] 酷我榜单歌曲处理完成, 数量: ${playlistSongs.value.length}`);
  } else {
    console.warn(`[PlaylistDetailView] 酷我榜单没有歌曲列表或格式不正确, 尝试直接请求榜单数据`);
    
    // 如果没有找到歌曲列表，尝试直接请求榜单数据
    try {
      const directResponse = await axios.get(`${KW_API_URL}`, { 
        params: { name: rankName, type: 'rank' } 
      });
      
      console.log(`[PlaylistDetailView] 直接请求榜单数据响应:`, directResponse.data);
      
      if (directResponse?.data?.code === 200) {
        const directMusicList = directResponse.data.data?.musicList || [];
        
        if (Array.isArray(directMusicList) && directMusicList.length > 0) {
          console.log(`[PlaylistDetailView] 直接请求获取到 ${directMusicList.length} 首歌曲`);
          
          const songPromises = directMusicList.map(async (songStub, index) => {
            const kwRid = songStub.rid || songStub.id;
            const songId = `kw_${kwRid || index}`;
            
            let songDurationMs = 0;
            if (songStub.interval) {
              const timeParts = songStub.interval.split(':');
              if (timeParts.length === 2) {
                const minutes = parseInt(timeParts[0], 10);
                const seconds = parseInt(timeParts[1], 10);
                songDurationMs = (minutes * 60 + seconds) * 1000;
              }
            }
            
            return {
              id: songId,
              name: songStub.name || '未知歌曲',
              ar: [{ name: songStub.artist || '未知歌手' }],
              al: { 
                name: songStub.album || '未知专辑', 
                picUrl: convertHttpToHttps(songStub.pic || defaultCoverUrl) 
              },
              dt: songDurationMs,
              source: 'kw',
              rid: kwRid,
              isFromKw: true,
              kwRid: kwRid,
            };
          });
          
          playlistSongs.value = await Promise.all(songPromises);
          console.log(`[PlaylistDetailView] 直接请求榜单歌曲处理完成, 数量: ${playlistSongs.value.length}`);
        } else {
          console.error(`[PlaylistDetailView] 直接请求榜单数据中没有找到歌曲列表`);
          playlistSongs.value = [];
        }
      } else {
        console.error(`[PlaylistDetailView] 直接请求榜单数据失败`);
        playlistSongs.value = [];
      }
    } catch (err) {
      console.error(`[PlaylistDetailView] 直接请求榜单数据出错:`, err);
      playlistSongs.value = [];
    }
  }
  
  // 缓存获取到的数据
  cachedPlaylistData[playlistId] = { detail: playlistDetail.value, songs: playlistSongs.value };
  console.log(`[PlaylistDetailView] 缓存酷我榜单数据, ID: ${playlistId}`);
};

// 页面被激活时的处理
onActivated(() => {
  // 当组件被激活时 (从缓存中恢复)，也尝试获取数据，但如果已有缓存则使用缓存
  // 注意：如果希望每次激活都强制刷新，可以传递 true
  fetchPlaylistDetail(false); 
  
  // 设置滚动事件监听
  nextTick(() => {
    const scrollElement = document.querySelector('.content-area');
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll);
      
      // 尝试恢复滚动位置
      const scrollPos = localStorage.getItem('temp_scroll_playlist_detail') || 
                       localStorage.getItem('scroll_pos_playlist_detail');
      
      if (scrollPos) {
        const scrollPosition = parseInt(scrollPos, 10);
        // 使用丝滑滚动恢复
        smoothRestoreScroll(scrollElement, scrollPosition);
      }
    }
  });
});

// 页面被停用时的处理
onDeactivated(() => {
  // 移除滚动事件监听
  const scrollElement = document.querySelector('.content-area');
  if (scrollElement) {
    scrollElement.removeEventListener('scroll', handleScroll);
  }
});

/**
 * 格式化播放次数
 * @param {number} count - 播放次数
 * @returns {string} 格式化后的播放次数
 */
const formatPlayCount = (count) => {
  if (!count) return '0';
  if (count < 10000) return count.toString();
  return (count / 10000).toFixed(1) + '万';
};

/**
 * 格式化日期
 * @param {number} timestamp - 时间戳
 * @returns {string} 格式化后的日期
 */
const formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} `;
};

/**
 * 格式化歌曲时长
 * @param {number} ms - 毫秒时长
 * @returns {string} 格式化后的时长
 */
const formatDuration = (ms) => {
  if (!ms) return '0:00';
  
  // 确保时长是毫秒为单位
  let totalSeconds;
  if (ms < 1000) {
    // 如果小于1000，可能是以秒为单位，转换为秒
    totalSeconds = ms;
  } else {
    // 否则视为毫秒，转换为秒
    totalSeconds = Math.floor(ms / 1000);
  }
  
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

/**
 * 播放歌单中的所有歌曲
 */
const playAllSongs = () => {
  if (playlistSongs.value.length > 0) {
    const queue = playlistSongs.value.map(song => {
      // 检查是否是酷我歌曲
      const isFromKw = song.isFromKw || song.source === 'kw' || 
                      (song.id && String(song.id).startsWith('kw')) ||
                      song.rid || song.kwRid;
      
      // 提取酷我RID
      let kwRid = null;
      if (isFromKw) {
        kwRid = song.rid || song.kwRid;
        
        // 如果没有直接的RID但有ID，尝试从ID中提取
        if (!kwRid && song.id) {
          const idStr = String(song.id);
          if (idStr.startsWith('kw_')) {
            kwRid = idStr.substring(3);
          } else if (idStr.startsWith('kw-')) {
            kwRid = idStr.substring(3);
          }
        }
      }
      
      return {
      id: song.id,
      name: song.name,
      artist: song.ar?.map(a => a.name).join(', ') || '未知歌手',
      albumArt: song.al?.picUrl || defaultCoverUrl,
      duration: song.dt || 0, // 确保使用dt
      album: song.al?.name || '未知专辑',
        isFromKw: isFromKw,
        kwRid: kwRid,
        rid: kwRid,
        source: song.source || (isFromKw ? 'kw' : 'main'),
        forceRefreshUrl: isFromKw // 酷我歌曲强制刷新URL
      };
    });
    
    // 清除可能的搜索结果缓存
    playerStore.resetSearchState();
    
    console.log(`[PlaylistDetailView] 播放全部歌曲，完全替换播放列表，共${queue.length}首`);
    
    // 先设置播放列表，完全替换当前列表
    playerStore.setPlaylist(queue, true);
    
    // 然后播放第一首歌曲
    if (queue.length > 0) {
      playerStore.playSong(queue[0], 0, playlistDetail.value.id);
    }
  } else {
    console.warn('[PlaylistDetailView] 歌单中没有歌曲可以播放。');
  }
};

/**
 * 播放指定歌曲
 * @param {Object} song - 歌曲对象
 * @param {number} index - 歌曲索引
 */
const playSong = (song, index) => {
  try {
    if (!song || !song.id) {
      console.error('[PlaylistDetailView] 无效的歌曲对象');
      return;
    }
    
    // 检查是否是酷我歌曲
    const isFromKw = song.isFromKw || song.source === 'kw' || 
                    (song.id && String(song.id).startsWith('kw')) ||
                    song.rid || song.kwRid;
    
    // 提取酷我RID
    let kwRid = null;
    if (isFromKw) {
      kwRid = song.rid || song.kwRid;
      
      // 如果没有直接的RID但有ID，尝试从ID中提取
      if (!kwRid && song.id) {
        const idStr = String(song.id);
        if (idStr.startsWith('kw_')) {
          kwRid = idStr.substring(3);
        } else if (idStr.startsWith('kw-')) {
          kwRid = idStr.substring(3);
        }
      }
    }
    
    // 确保歌曲ID是字符串类型
    const songToPlay = {
      ...song,
      id: String(song.id),
      isFromKw: isFromKw,
      kwRid: kwRid,
      rid: kwRid,
      source: song.source || (isFromKw ? 'kw' : 'main'),
      forceRefreshUrl: isFromKw // 酷我歌曲强制刷新URL
    };
    
    // 构建完整的歌曲队列，同样处理每首歌曲
    const fullQueue = playlistSongs.value.map(s => {
      const sIsFromKw = s.isFromKw || s.source === 'kw' || 
                       (s.id && String(s.id).startsWith('kw')) ||
                       s.rid || s.kwRid;
      
      let sKwRid = null;
      if (sIsFromKw) {
        sKwRid = s.rid || s.kwRid;
        
        if (!sKwRid && s.id) {
          const idStr = String(s.id);
          if (idStr.startsWith('kw_')) {
            sKwRid = idStr.substring(3);
          } else if (idStr.startsWith('kw-')) {
            sKwRid = idStr.substring(3);
          }
        }
      }
      
      return {
      ...s,
        id: String(s.id),
        isFromKw: sIsFromKw,
        kwRid: sKwRid,
        rid: sKwRid,
        source: s.source || (sIsFromKw ? 'kw' : 'main'),
        forceRefreshUrl: sIsFromKw
      };
    });
    
    if (!fullQueue || fullQueue.length === 0) {
      console.error('[PlaylistDetailView] 无法构建播放队列');
      return;
    }

    // 使用索引对象格式，确保与SongItem组件一致
    const playContext = { 
      song: songToPlay, 
      index: index,
      fullQueue: fullQueue // 传递完整队列以便播放器可以更新
    };
    
    // 直接调用播放器存储的播放方法
    console.log(`[PlaylistDetailView] 调用播放器播放歌曲: ${songToPlay.name}, 完全替换播放列表`);
    
    // 清除可能的搜索结果缓存
    playerStore.resetSearchState();
    
    // 使用nextTick确保DOM更新后再播放
    nextTick(() => {
      // 先设置播放列表，完全替换当前列表
      playerStore.setPlaylist(fullQueue, true);
      
      // 然后播放选中的歌曲
      playerStore.playSong(songToPlay, index, playlistDetail.value?.id);
    });
  } catch (error) {
    console.error('[PlaylistDetailView] 播放歌曲时出错:', error);
  }
};

/**
 * 截断描述文字
 * @param {string} text - 描述文字
 * @returns {string} 截断后的文字
 */
const truncateDescription = (text) => {
  if (!text) return '';
  return text.length > 100 ? text.substring(0, 100) + '...' : text;
};

/**
 * 检查歌曲是否正在播放
 * @param {number|string} songId - 歌曲ID
 * @returns {boolean} 是否正在播放
 */
const isCurrentPlaying = (songId) => {
  return playerStore.currentSong && playerStore.currentSong.id === songId;
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

/**
 * 处理滚动事件，将滚动位置保存到localStorage
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
    localStorage.setItem('temp_scroll_playlist_detail', scrollTop.toString());
    localStorage.setItem('scroll_pos_playlist_detail', scrollTop.toString());
    
    // 兼容App.vue的格式
    const existingPositions = JSON.parse(localStorage.getItem('scrollPositions') || '{}');
    existingPositions.playlistDetail = scrollTop;
    localStorage.setItem('scrollPositions', JSON.stringify(existingPositions));
  } catch (e) {
    console.error('保存滚动位置错误:', e);
  }
};

/**
 * 检查歌单是否已收藏
 */
const checkFavoriteStatus = () => {
  try {
    if (!playlistDetail.value || !playlistDetail.value.id) {
      console.log('[PlaylistDetailView] 没有歌单ID，无法检查收藏状态');
      isFavoritedPlaylist.value = false;
      return;
    }
    
    // 获取当前歌单ID并确保是字符串类型
    const currentId = String(playlistDetail.value.id);
    
    // 判断是否是榜单
    const isRanking = route.query.isRanking === 'true' || playlistDetail.value.isRanking;
    const favoriteType = isRanking ? 'RANKINGS' : 'PLAYLISTS';
    
    console.log(`[PlaylistDetailView] 检查${isRanking ? '榜单' : '歌单'}收藏状态，ID: ${currentId}`);
    
    // 检查原始ID是否已收藏
    let favorited = isFavorited(favoriteType, currentId);
    
    // 如果未找到，检查带有kw-前缀的ID (酷我歌单)
    if (!favorited && !currentId.includes('kw-') && (playlistDetail.value.isKwPlaylist || route.query.source === 'kw')) {
      const idWithPrefix = `kw-${currentId}`;
      favorited = isFavorited(favoriteType, idWithPrefix);
      console.log(`[PlaylistDetailView] 检查带前缀ID: ${idWithPrefix}, 收藏状态: ${favorited}`);
    }
    
    // 如果仍未找到，检查不带前缀的ID (酷我歌单)
    if (!favorited && currentId.includes('kw-')) {
      const idWithoutPrefix = currentId.split('kw-')[1];
      favorited = isFavorited(favoriteType, idWithoutPrefix);
      console.log(`[PlaylistDetailView] 检查无前缀ID: ${idWithoutPrefix}, 收藏状态: ${favorited}`);
    }
    
    // 如果是榜单，检查带有main_rank_前缀的ID
    if (!favorited && isRanking && !currentId.startsWith('main_rank_')) {
      const rankingId = `main_rank_${currentId}`;
      favorited = isFavorited(favoriteType, rankingId);
      console.log(`[PlaylistDetailView] 检查榜单ID: ${rankingId}, 收藏状态: ${favorited}`);
    }
    
    // 如果是榜单，检查不带前缀的ID
    if (!favorited && isRanking && currentId.startsWith('main_rank_')) {
      const rankingIdWithoutPrefix = currentId.substring(10);
      favorited = isFavorited(favoriteType, rankingIdWithoutPrefix);
      console.log(`[PlaylistDetailView] 检查无前缀榜单ID: ${rankingIdWithoutPrefix}, 收藏状态: ${favorited}`);
    }
    
    isFavoritedPlaylist.value = favorited;
    console.log(`[PlaylistDetailView] 最终收藏状态: ${favorited}`);
  } catch (error) {
    console.error('[PlaylistDetailView] 检查收藏状态出错:', error);
    isFavoritedPlaylist.value = false;
  }
};

/**
 * 切换收藏状态
 */
const toggleFavorite = () => {
  if (!playlistDetail.value) return;
  
  // 判断是否是榜单
  const isRanking = route.query.isRanking === 'true' || playlistDetail.value.isRanking;
  const favoriteType = isRanking ? 'RANKINGS' : 'PLAYLISTS';
  
  if (isFavoritedPlaylist.value) {
    // 如果已收藏，则取消收藏
    // 处理ID格式，确保与收藏时使用的ID格式一致
    let itemId = playlistDetail.value.id;
    
    // 如果是酷我歌单，可能使用了kw-前缀
    const isKwPlaylist = playlistDetail.value.isKwPlaylist || route.query.source === 'kw';
    if (isKwPlaylist && !String(itemId).startsWith('kw-')) {
      itemId = `kw-${itemId}`;
    }
    
    // 如果是榜单，可能使用了main_rank_前缀
    if (isRanking && !String(itemId).startsWith('main_rank_')) {
      itemId = `main_rank_${itemId}`;
    }
    
    console.log(`[PlaylistDetailView] 尝试取消收藏${isRanking ? '榜单' : '歌单'}, 原始ID: ${playlistDetail.value.id}, 处理后ID: ${itemId}`);
    
    // 尝试使用不同格式的ID取消收藏
    let result = removeFromFavorites(favoriteType, itemId);
    
    // 如果失败，尝试使用原始ID
    if (!result) {
      console.log(`[PlaylistDetailView] 使用处理后ID取消收藏失败，尝试使用原始ID: ${playlistDetail.value.id}`);
      result = removeFromFavorites(favoriteType, playlistDetail.value.id);
    }
    
    // 如果仍然失败，尝试其他可能的ID格式
    if (!result && isRanking) {
      const idWithoutPrefix = String(itemId).startsWith('main_rank_') ? 
                             String(itemId).substring(10) : itemId;
      console.log(`[PlaylistDetailView] 尝试使用无前缀ID取消收藏榜单: ${idWithoutPrefix}`);
      result = removeFromFavorites(favoriteType, idWithoutPrefix);
    }
    
    if (result) {
      isFavoritedPlaylist.value = false;
      ElMessage.success('已取消收藏');
    } else {
      ElMessage.error('取消收藏失败');
    }
  } else {
    // 确保ID格式一致
    const isKwPlaylist = playlistDetail.value.isKwPlaylist || route.query.source === 'kw';
    let playlistId = playlistDetail.value.id;
    
    // 如果是酷我歌单，确保ID格式为kw-前缀
    if (isKwPlaylist && !String(playlistId).startsWith('kw-')) {
      playlistId = `kw-${playlistId}`;
    }
    
    // 如果是榜单，确保ID格式为main_rank_前缀
    if (isRanking && !String(playlistId).startsWith('main_rank_')) {
      playlistId = `main_rank_${playlistId}`;
    }
    
    // 准备歌单/榜单数据
    const playlistData = {
      id: playlistId, // 使用处理后的ID
      name: playlistDetail.value.name,
      coverImgUrl: playlistDetail.value.coverImgUrl,
      trackCount: playlistDetail.value.trackCount || 0,
      playCount: playlistDetail.value.playCount || 0,
      creator: playlistDetail.value.creator?.nickname || '未知创建者',
      description: playlistDetail.value.description || '',
      source: route.query.source || 'main',
      isRanking: isRanking,
      updateFrequency: playlistDetail.value.updateFrequency || '未知更新频率'
    };
    
    // 添加到收藏
    const result = addToFavorites(favoriteType, playlistData);
    if (result) {
      isFavoritedPlaylist.value = true;
      ElMessage.success(isRanking ? '榜单已添加到本地收藏' : '歌单已添加到本地收藏');
    } else {
      ElMessage.error('收藏失败');
    }
  }
};

onMounted(() => {
  fetchPlaylistDetail();
  
  // 设置滚动事件监听
  nextTick(() => {
    const scrollElement = document.querySelector('.content-area');
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll);
    }
    
    // 检查收藏状态
    checkFavoriteStatus();
  });
});

// 监听歌单详情变化，更新收藏状态
watch(() => playlistDetail.value?.id, (newId) => {
  if (newId) {
    checkFavoriteStatus();
  }
}, { immediate: true });

// 组件卸载时清理
onUnmounted(() => {
  // 移除滚动事件监听
  const scrollElement = document.querySelector('.content-area');
  if (scrollElement) {
    scrollElement.removeEventListener('scroll', handleScroll);
  }
});

/**
 * 返回歌单列表页面
 */
const goBack = () => {
  // 获取查询参数
  const isRanking = route.query.isRanking === 'true';
  const isFromSearch = route.query.fromSearch === 'true';
  const isFromFavorites = route.query.fromFavorites === 'true';
  const isFromRanking = route.query.fromRanking === 'true';
  const isFromMV = route.query.fromMV === 'true';
  const isFromPlaylists = route.query.fromPlaylists === 'true';
  const isFromMine = route.query.fromMine === 'true';
  
  // 获取标签和搜索类型参数
  const favoriteTab = route.query.favoriteTab;
  const searchType = route.query.searchType;
  const keyword = route.query.keyword;
  
  console.log('[PlaylistDetailView] 返回操作，来源参数:', {
    isRanking,
    isFromSearch,
    isFromFavorites,
    isFromRanking,
    isFromMV,
    isFromPlaylists,
    isFromMine,
    favoriteTab,
    searchType,
    keyword
  });
  
  // 根据来源参数决定返回路径
  if (isFromSearch) {
    // 返回到搜索页面，尝试保留搜索关键词和搜索类型
    const queryParams = {};
    
    // 添加搜索关键词
    if (keyword) {
      queryParams.q = keyword;
    }
    
    // 添加搜索类型
    if (searchType && ['song', 'album', 'playlist', 'mv'].includes(searchType)) {
      queryParams.type = searchType;
    }
    
    // 导航到搜索页面
    router.push({ path: '/search', query: queryParams });
  } else if (isFromFavorites) {
    // 返回到收藏页面，尝试保留原来的标签页
    const queryParams = {};
    
    // 添加收藏标签页
    if (favoriteTab && ['songs', 'albums', 'playlists', 'mvs', 'rankings'].includes(favoriteTab)) {
      queryParams.tab = favoriteTab;
    }
    
    // 导航到收藏页面
    router.push({ path: '/favorites', query: queryParams });
  } else if (isFromRanking || isRanking) {
    // 返回到排行榜页面
    router.push({ path: '/playlists', query: { tab: 'ranking' } });
  } else if (isFromMV) {
    // 返回到MV页面
    router.push({ path: '/playlists', query: { tab: 'mv' } });
  } else if (isFromMine) {
    // 返回到"您的歌单"标签页
    console.log('[PlaylistDetailView] 返回到"您的歌单"标签页');
    router.push({ path: '/playlists', query: { tab: 'mine' } });
  } else if (isFromPlaylists) {
    // 检查是否从"您的歌单"标签页进入
    const creatorId = playlistDetail.value?.creator?.userId;
    const userInfo = localStorage.getItem('netease_user_info');
    const userInfoObj = userInfo ? JSON.parse(userInfo) : null;
    const userId = userInfoObj?.userId;
    
    // 如果是用户自己的歌单，返回到"您的歌单"标签页
    if (creatorId && userId && String(creatorId) === String(userId)) {
      console.log('[PlaylistDetailView] 识别为用户歌单，返回到"您的歌单"标签页');
      router.push({ path: '/playlists', query: { tab: 'mine' } });
    } else {
      // 否则返回到歌单列表页面
      router.push({ path: '/playlists', query: { tab: 'all' } });
    }
  } else {
    // 尝试根据歌单类型智能判断返回位置
    const creatorId = playlistDetail.value?.creator?.userId;
    const userInfo = localStorage.getItem('netease_user_info');
    const userInfoObj = userInfo ? JSON.parse(userInfo) : null;
    const userId = userInfoObj?.userId;
    
    // 如果是用户自己的歌单，返回到"您的歌单"标签页
    if (creatorId && userId && String(creatorId) === String(userId)) {
      console.log('[PlaylistDetailView] 默认返回，识别为用户歌单，返回到"您的歌单"标签页');
      router.push({ path: '/playlists', query: { tab: 'mine' } });
    } else {
      // 否则默认返回到歌单列表页
      router.push('/playlists');
    }
  }
};

// 监听路由变化，处理从MV返回的情况
watch(() => route.fullPath, (newPath, oldPath) => {
  // 检查是否从MV页面返回
  if (oldPath && oldPath.includes('/mv/') && newPath.includes('/playlist')) {
    console.log('[PlaylistDetailView] 检测到从MV页面返回');
    
    // 检查之前的播放状态
    const musicWasPlaying = localStorage.getItem('musicWasPlaying') === 'true';
    console.log('[PlaylistDetailView] 从MV页面返回，检测到原始播放状态:', musicWasPlaying ? '播放中' : '暂停');
    
    // 检查当前实际播放状态
    const isCurrentlyPlaying = playerStore.isPlaying;
    console.log('[PlaylistDetailView] 从MV页面返回，当前实际播放状态:', isCurrentlyPlaying ? '播放中' : '暂停');
    
    // 只有在之前音乐正在播放的情况下才恢复播放
    if (playerStore.currentSong) {
      setTimeout(() => {
        // 如果之前是播放状态或当前已经在播放，确保继续播放
        if (musicWasPlaying || isCurrentlyPlaying) {
          console.log('[PlaylistDetailView] 从MV返回，恢复之前的播放状态');
        // 设置播放状态
        playerStore.isPlaying = true;
        
        // 确保音频元素也在播放
        const audioElement = document.getElementById('audio-player');
        if (audioElement && audioElement.paused) {
          audioElement.play().catch(err => {
            console.warn('[PlaylistDetailView] 返回时恢复播放失败:', err);
            // 标记需要用户交互来恢复播放
            window._needManualPlayResume = true;
            
            // 再次尝试播放
            setTimeout(() => {
              console.log('[PlaylistDetailView] 再次尝试恢复播放');
              audioElement.play().catch(() => {
                console.warn('[PlaylistDetailView] 二次尝试播放失败，需要用户交互');
              });
            }, 1000);
          });
          }
        } else {
          console.log('[PlaylistDetailView] 从MV返回，保持暂停状态');
          // 确保播放器状态为暂停
          if (playerStore.isPlaying) {
            playerStore.isPlaying = false;
          }
          // 确保音频也是暂停的
          const audioElement = document.getElementById('audio-player');
          if (audioElement && !audioElement.paused) {
            audioElement.pause();
          }
        }
      }, 300);
    }
    
    // 清除MV相关状态标记
    localStorage.removeItem('musicPausedForMV');
    localStorage.removeItem('musicWasPlaying');
  }
});
</script>

<style scoped>
.playlist-detail-view {
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

.playlist-header {
  display: flex;
  margin-bottom: 15px;
}

.playlist-cover {
  width: 120px;
  height: 120px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  margin-right: 15px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
}

.playlist-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.playlist-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.playlist-title {
  font-size: 18px;
  margin: 0 0 8px 0;
}

.playlist-creator {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.creator-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  margin-right: 8px;
}

.creator-info {
  display: flex;
  flex-direction: column;
}

.creator-name {
  font-size: 12px;
  font-weight: 500;
}

.create-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 2px;
}

.playlist-stats {
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

.playlist-tags {
  display: flex;
  margin-bottom: 8px;
}

.tag {
  padding: 1px 6px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 11px;
  margin-right: 6px;
}

.playlist-description {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  margin: 0 0 10px 0;
  max-height: 40px;
  overflow-y: auto;
  line-height: 1.4;
}

.playlist-actions {
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

.song-item {
  display: flex;
  padding: 6px 8px;
  transition: all 0.2s;
  cursor: pointer;
  font-size: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.song-item:last-child {
  border-bottom: none;
}

.song-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
  transform: translateX(3px);
}

.song-item.playing {
  background-color: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.song-title-wrapper {
  display: flex;
  align-items: center;
}

.song-title {
  margin-right: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-quality {
  padding: 1px 4px;
  background-color: rgba(29, 185, 84, 0.2);
  color: #1DB954;
  border-radius: 3px;
  font-size: 9px;
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

.song-album-cell {
  flex: 2;
  padding-right: 10px;
}

.song-duration-cell {
  width: 60px;
  text-align: right;
}

.header-cell, .song-cell {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playlist-detail-view::-webkit-scrollbar {
  width: 6px;
}

.playlist-detail-view::-webkit-scrollbar-track {
  background: transparent;
}

.playlist-detail-view::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.song-item .song-cell {
  position: relative;
}

.playing-icon {
  color: #1DB954;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 0.7; }
  50% { opacity: 1; }
  100% { opacity: 0.7; }
}

.song-index {
  opacity: 0.8;
  transition: opacity 0.2s;
}

.song-item:hover .song-index {
  opacity: 0;
}

.song-item:hover .song-actions {
  opacity: 1;
}

.duration-wrapper {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.duration {
  transition: opacity 0.2s;
}

.song-item:hover .duration {
  opacity: 0;
}

.song-actions {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.song-action-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  padding: 3px;
  margin-left: 5px;
  font-size: 14px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.song-action-btn:hover {
  color: #fff;
  transform: scale(1.2);
}

.action-icon {
  font-size: 12px;
}

.back-button-container {
  margin-bottom: 15px;
  padding: 0 10px;
  display: flex;
  justify-content: flex-start;
}

/* 酷我榜单详情页特殊样式 */
.playlist-detail-view .playlist-header {
  display: flex;
  margin-bottom: 15px;
}

.playlist-detail-view .playlist-cover {
  width: 120px;
  height: 120px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  margin-right: 15px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
}

/* 酷我榜单详情页图片样式 */
.playlist-detail-view .playlist-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 酷我榜单特殊样式 */
.playlist-detail-view[data-source="kw"] .playlist-cover {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 8px;
  overflow: hidden;
}

/* 酷我榜单详情页特殊图片样式 */
.playlist-detail-view[data-source="kw"] .playlist-cover img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background-color: rgba(0, 0, 0, 0.2);
}

.playlist-detail-view[data-source="kw"] .playlist-cover::after {
  content: '酷我';
  position: absolute;
  top: 0;
  left: 0;
  background-color: rgba(255, 0, 0, 0.8);
  color: white;
  padding: 2px 6px;
  font-size: 10px;
  border-radius: 0 0 4px 0;
}

.playlist-detail-view[data-source="kw"] .playlist-title {
  font-size: 20px;
  font-weight: bold;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
  line-height: 1.3;
  margin-bottom: 10px;
}

.playlist-detail-view[data-source="kw"] .playlist-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.playlist-detail-view[data-source="kw"] .playlist-description {
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
  line-height: 1.4;
}
</style> 