<template>
  <div class="mv-view-container">
    <!-- 非错误状态下的返回按钮 -->
    <div class="custom-back-button" @click="goBack" v-if="!error">
      <el-icon><ArrowLeft /></el-icon> 返回
    </div>
    
    <div class="mv-header" v-if="!error">
      <h1 class="mv-title">{{ mvInfo?.name || '加载中...' }}</h1>
    </div>
    
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <div class="loading-text">正在加载MV...</div>
    </div>
    
    <!-- 错误状态的完全重新设计 -->
    <div v-else-if="error" class="error-container">
      <!-- 错误状态下的返回按钮 -->
      <div class="top-navigation-area">
        <button class="nav-back-button" @click="goBack">
          <el-icon><ArrowLeft /></el-icon> 返回
        </button>
      </div>
      
      <div class="error-content">
        <div class="error-message">{{ error }}</div>
        <div class="error-actions">
          <button class="error-button retry-button" @click="fetchMVDetail">重试</button>
        </div>
      </div>
    </div>
    
    <div v-else class="mv-content">
      <!-- 视频播放器 -->
      <div class="video-container">
        <video 
          ref="videoPlayer"
          controls
          autoplay
          class="video-player"
          :src="mvUrl"
          @error="handleVideoError"
          @loadeddata="handleVideoLoaded"
          :poster="mvInfo?.cover || defaultCoverUrl"
        ></video>
      </div>
      
      <!-- MV操作按钮 -->
      <div class="mv-actions">
        <button class="action-button" @click="toggleFavorite">
          <span class="icon">{{ isFavoritedMV ? '♥' : '❤' }}</span> {{ isFavoritedMV ? '已收藏' : '收藏' }}
        </button>
        <button class="action-button">
          <span class="icon">↗</span> 分享
        </button>
        <button class="action-button">
          <span class="icon">↓</span> 下载
        </button>
      </div>
      
      <!-- MV信息 -->
      <div class="mv-info">
        <div class="mv-artist">
          <span class="label">歌手:</span> {{ mvInfo?.artistName || '未知歌手' }}
        </div>
        <div class="mv-play-count">
          <span class="label">播放次数:</span> {{ formatPlayCount(mvInfo?.playCount) }}
        </div>
        <div class="mv-publish-time">
          <span class="label">发布时间:</span> {{ formatDate(mvInfo?.publishTime) }}
        </div>
        <div class="mv-description" v-if="mvInfo?.desc">
          <span class="label">简介:</span> {{ mvInfo.desc }}
        </div>
      </div>
      
      <!-- 相关MV推荐 -->
      <div class="related-mvs" v-if="relatedMVs.length > 0">
        <h2 class="section-title">相关推荐</h2>
        <div class="related-mvs-grid">
          <div 
            v-for="(mv, index) in relatedMVs" 
            :key="`related-mv-${mv.id}-${index}`" 
            class="related-mv-card"
            @click="playRelatedMV(mv.id)"
          >
            <div class="related-mv-cover">
              <img :src="mv.cover || mv.imgurl16v9 || defaultCoverUrl" alt="MV封面">
              <div class="play-icon">▶</div>
            </div>
            <div class="related-mv-info">
              <div class="related-mv-name">{{ mv.name }}</div>
              <div class="related-mv-artist">{{ mv.artistName }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, defineComponent, watch, nextTick, onActivated } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { usePlayerStore } from '../stores/player';
import { ArrowLeft } from '@element-plus/icons-vue';
import { addToFavorites, removeFromFavorites, isFavorited } from '../services/favoritesService';
import { ElMessage } from 'element-plus';

// 定义组件名称以支持keep-alive
defineComponent({
  name: 'MVView'
});

// 使用name选项直接定义组件名称
const __NAME__ = 'MVView';

const route = useRoute();
const router = useRouter();
const playerStore = usePlayerStore();
const videoPlayer = ref(null);

const loading = ref(true);
const error = ref(null);
const mvInfo = ref(null);
const mvUrl = ref(null);
const relatedMVs = ref([]);
const defaultCoverUrl = 'https://p2.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg';

// API基础URL
const BASE_URL = 'https://api.931125.xyz';
const KW_API_URL = 'https://kw-api.cenguigui.cn';

// 是否是酷我MV
const isKwMV = ref(false);

// 缓存MV数据的对象
const mvCache = ref({});

// 添加收藏状态
const isFavoritedMV = ref(false);

/**
 * 将HTTP URL转换为HTTPS
 * @param {string} url - 视频URL
 * @returns {string} - 转换后的URL
 */
const convertHttpToHttps = (url) => {
  if (!url) return url;
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  return url;
};

/**
 * 获取MV详情和播放URL
 */
const fetchMVDetail = async () => {
  const mvId = route.params.id;
  
  if (!mvId) {
    error.value = '未指定MV ID';
    loading.value = false;
    return;
  }
  
  // 检查是否是酷我MV
  isKwMV.value = route.query.source === 'kw';
  
  // 检查是否有缓存数据
  const cacheKey = isKwMV.value ? `kw_${mvId}` : mvId;
  if (mvCache.value[cacheKey]) {
    console.log(`使用缓存的MV数据: ${cacheKey}`);
    mvInfo.value = mvCache.value[cacheKey].info;
    mvUrl.value = convertHttpToHttps(mvCache.value[cacheKey].url); // 确保缓存的URL也转换为HTTPS
    relatedMVs.value = mvCache.value[cacheKey].related;
    loading.value = false;
    
    // 延迟恢复滚动位置
    setTimeout(() => {
      const savedScrollPosition = localStorage.getItem('mv_scroll_position');
      if (savedScrollPosition) {
        window.scrollTo(0, parseInt(savedScrollPosition));
      }
    }, 100);
    
    // 检查收藏状态
    checkFavoriteStatus();
    
    return;
  }
  
  loading.value = true;
  error.value = null;
  
  try {
    if (isKwMV.value) {
      // 使用酷我API获取MV数据
      await fetchKwMVDetail(mvId);
    } else {
      // 使用网易云API获取MV数据
      await fetchNeteaseMVDetail(mvId);
    }
    
    // 检查收藏状态
    checkFavoriteStatus();
    
  } catch (err) {
    console.error('获取MV数据错误:', err);
    error.value = '获取MV数据失败，请稍后重试';
  } finally {
    loading.value = false;
  }
};

/**
 * 使用网易云API获取MV详情
 * @param {string} mvId - MV ID
 */
const fetchNeteaseMVDetail = async (mvId) => {
  if (!mvId) return;
  
  try {
    // 获取MV详情
    const mvDetailResponse = await axios.get(`${BASE_URL}/mv/detail`, {
      params: { mvid: mvId }
    });
    
    if (mvDetailResponse.data && mvDetailResponse.data.code === 200 && mvDetailResponse.data.data) {
      const mvData = mvDetailResponse.data.data;
      
      // 设置MV信息
      mvInfo.value = {
        id: mvId,
        name: mvData.name || '未知MV',
        artistName: mvData.artistName || '未知歌手',
        cover: convertHttpToHttps(mvData.cover || defaultCoverUrl),
        playCount: mvData.playCount || 0,
        publishTime: mvData.publishTime || new Date().toISOString(),
        desc: mvData.desc || '',
        isFromKw: false
      };
      
      // 获取MV播放地址
      const urlResponse = await axios.get(`${BASE_URL}/mv/url`, {
        params: { id: mvId }
      });
      
      if (urlResponse.data && urlResponse.data.code === 200 && urlResponse.data.data && urlResponse.data.data.url) {
        mvUrl.value = convertHttpToHttps(urlResponse.data.data.url);
      } else {
        throw new Error('获取MV播放地址失败');
      }
      
      // 设置相关MV与主MV相同
      relatedMVs.value = [{
        id: mvData.id,
        name: mvData.name || '未知MV',
        artistName: mvData.artistName || '未知歌手',
        cover: convertHttpToHttps(mvData.cover || defaultCoverUrl),
          isFromKw: false
      }];
      
      // 缓存MV数据
      mvCache.value[`main_mv_${mvId}`] = {
        info: mvInfo.value,
        url: mvUrl.value,
        related: relatedMVs.value
      };
      
      // 保存缓存时间戳
      const lastUpdateKey = `last_update_mv_main_mv_${mvId}`;
      localStorage.setItem(lastUpdateKey, Date.now().toString());
      console.log(`[MVView] 更新MV缓存时间戳: main_mv_${mvId}`);
      
    } else {
      throw new Error('获取MV详情失败');
    }
  } catch (err) {
    console.error('获取MV数据错误:', err);
    error.value = '获取MV数据失败，请稍后重试';
  }
};

/**
 * 通过关键词尝试在酷我API中查找MV
 * @param {string} keyword - 搜索关键词
 */
const tryFetchKwMVByKeyword = async (keyword) => {
  try {
    console.log(`使用关键词 "${keyword}" 在酷我搜索MV`);
    
    // 使用酷我API搜索MV
    const searchResponse = await axios.get(`${KW_API_URL}`, {
      params: {
        key: keyword,
        type: 'mvSearch',
        limit: 5
      }
    });
    
    if (searchResponse.data && searchResponse.data.code === 200 && 
        Array.isArray(searchResponse.data.data) && searchResponse.data.data.length > 0) {
      // 找到匹配的MV
      const kwMv = searchResponse.data.data[0];
      console.log('从酷我找到匹配的MV:', kwMv.name, kwMv.artist);
      
      // 设置MV信息
      mvInfo.value = {
        id: kwMv.id || kwMv.rid,
        name: kwMv.name || keyword,
        artistName: kwMv.artist || '未知歌手',
        cover: convertHttpToHttps(kwMv.pic || defaultCoverUrl),
        playCount: kwMv.mvPlayCnt || 0,
        publishTime: kwMv.time || new Date().toISOString(),
        desc: kwMv.info || `搜索关键词: ${keyword}`,
        isFromKw: true
      };
      
      // 设置MV播放地址
      mvUrl.value = `${KW_API_URL}?id=${kwMv.id || kwMv.rid}&level=2k&type=mv&format=mp4`;
      console.log('使用酷我MV地址:', mvUrl.value);
      
      // 获取相关MV
      try {
        const relatedResponse = await axios.get(`${KW_API_URL}`, { 
          params: { 
            id: kwMv.artistid || '236742508', // 使用歌手ID获取相关MV，如果没有则使用默认ID
            page: 1,
            limit: 6,
            type: 'mvList'
          } 
        });
        
        if (relatedResponse.data && relatedResponse.data.code === 200 && Array.isArray(relatedResponse.data.data)) {
          relatedMVs.value = relatedResponse.data.data.map(item => ({
            id: item.rid || item.vid,
            name: item.name || '未知MV',
            artistName: item.artist || '未知歌手',
            cover: convertHttpToHttps(item.pic || defaultCoverUrl),
            isFromKw: true
          }));
        }
      } catch (relatedErr) {
        console.error('获取酷我相关MV失败:', relatedErr);
        relatedMVs.value = [];
      }
      
      // 标记为酷我MV
      isKwMV.value = true;
      
      // 缓存MV数据
      mvCache.value[`kw_${kwMv.id || kwMv.rid}`] = {
        info: mvInfo.value,
        url: mvUrl.value,
        related: relatedMVs.value
      };
      
      error.value = null;
    } else {
      throw new Error('未找到匹配的酷我MV');
    }
  } catch (err) {
    console.error('酷我API搜索失败:', err.message);
    error.value = '无法找到匹配的MV，请尝试其他搜索词';
  }
};

/**
 * 使用酷我API获取MV详情
 * @param {string} mvId - MV ID
 */
const fetchKwMVDetail = async (mvId) => {
  if (!mvId) return;
  
  try {
    // 使用酷我API获取MV详情
    const kwResponse = await axios.get(`${KW_API_URL}`, { 
      params: { 
        id: mvId,
        type: 'mv'
      } 
    });
    
    if (kwResponse.data && kwResponse.data.code === 200 && kwResponse.data.data && kwResponse.data.data.length > 0) {
      const mvData = kwResponse.data.data[0];
      
      // 设置MV信息
      mvInfo.value = {
        id: mvId,
        name: mvData.name || '未知MV',
        artistName: mvData.artist || '未知歌手',
        cover: convertHttpToHttps(mvData.pic || defaultCoverUrl),
        playCount: mvData.mvPlayCnt || 0,
        publishTime: mvData.time || new Date().toISOString(),
        desc: mvData.info || '',
        isFromKw: true
      };
      
      // 设置MV播放地址
      // 如果需要直接获取播放地址，可以添加format=mp4参数
      mvUrl.value = `${KW_API_URL}?id=${mvId}&level=2k&type=mv&format=mp4`;
      
      // 获取相关MV
      const relatedResponse = await axios.get(`${KW_API_URL}/mv/url`, {
        params: { id: mvId }
        });
        
        if (relatedResponse.data && relatedResponse.data.code === 200 && Array.isArray(relatedResponse.data.data)) {
          relatedMVs.value = relatedResponse.data.data.map(item => ({
          id: item.id,
            name: item.name || '未知MV',
          artistName: item.artistName || '未知歌手',
          cover: convertHttpToHttps(item.cover || defaultCoverUrl),
            isFromKw: true
          }));
      }
      
      // 缓存MV数据
      mvCache.value[`kw_${mvId}`] = {
        info: mvInfo.value,
        url: mvUrl.value,
        related: relatedMVs.value
      };
      
      // 保存缓存时间戳
      const lastUpdateKey = `last_update_mv_kw_${mvId}`;
      localStorage.setItem(lastUpdateKey, Date.now().toString());
      console.log(`[MVView] 更新MV缓存时间戳: kw_${mvId}`);
      
    } else {
      throw new Error('获取酷我MV详情失败');
    }
  } catch (err) {
    console.error('获取酷我MV数据错误:', err);
    error.value = '获取酷我MV数据失败，请稍后重试';
  }
};

/**
 * 播放相关MV
 * @param {string|number} id - MV ID
 */
const playRelatedMV = (id) => {
  if (!id) return;
  
  // 保存当前滚动位置
  const scrollPosition = document.documentElement.scrollTop || document.body.scrollTop;
  localStorage.setItem('mv_scroll_position', scrollPosition.toString());
  
  // 构建导航参数
  const navigationParams = {
    name: 'mv-detail',
    params: { id: id }
  };
  
  // 如果是酷我MV，添加source参数
  if (isKwMV.value || (relatedMVs.value.find(mv => mv.id === id)?.isFromKw)) {
    navigationParams.query = { source: 'kw' };
  }
  
  // 使用路由替换而不是push，这样不会创建新的历史记录
  router.replace(navigationParams);
  
  // 如果是相同路由但不同参数，手动刷新数据
  if (route.params.id === String(id)) {
    // 避免重新加载数据，这样就不会滚动到顶部
    return;
  }
};

/**
 * 检查MV是否已收藏
 */
const checkFavoriteStatus = () => {
  if (mvInfo.value && route.params.id) {
    // 使用统一的ID格式进行检查
    const mvId = isKwMV.value ? `kw_${route.params.id}` : `main_mv_${route.params.id}`;
    console.log(`[MVView] 检查收藏状态，使用ID: ${mvId}`);
    
    // 尝试多种可能的ID格式
    let favorited = isFavorited('MVS', mvId);
    
    // 如果未找到，尝试不带前缀的ID
    if (!favorited) {
      favorited = isFavorited('MVS', route.params.id);
      console.log(`[MVView] 使用原始ID检查收藏状态: ${route.params.id}, 结果: ${favorited}`);
    }
    
    // 如果仍未找到，尝试其他可能的格式
    if (!favorited && isKwMV.value) {
      favorited = isFavorited('MVS', `kw_mv_${route.params.id}`);
      console.log(`[MVView] 尝试使用kw_mv_前缀检查: kw_mv_${route.params.id}, 结果: ${favorited}`);
    }
    
    isFavoritedMV.value = favorited;
    console.log(`[MVView] 最终收藏状态: ${favorited}`);
  }
};

/**
 * 切换收藏状态
 */
const toggleFavorite = () => {
  if (!mvInfo.value || !route.params.id) return;
  
  // 使用统一的ID格式
  const mvId = isKwMV.value ? `kw_${route.params.id}` : `main_mv_${route.params.id}`;
  console.log(`[MVView] 切换收藏状态，使用ID: ${mvId}`);
  
  if (isFavoritedMV.value) {
    // 如果已收藏，则取消收藏
    // 首先尝试使用标准格式的ID
    let result = removeFromFavorites('MVS', mvId);
    
    // 如果失败，尝试使用原始ID
    if (!result) {
      result = removeFromFavorites('MVS', route.params.id);
      console.log(`[MVView] 尝试使用原始ID取消收藏: ${route.params.id}, 结果: ${result}`);
    }
    
    // 如果仍然失败，尝试其他可能的格式
    if (!result && isKwMV.value) {
      result = removeFromFavorites('MVS', `kw_mv_${route.params.id}`);
      console.log(`[MVView] 尝试使用kw_mv_前缀取消收藏: kw_mv_${route.params.id}, 结果: ${result}`);
    }
    
    if (result) {
      isFavoritedMV.value = false;
      ElMessage.success('已取消收藏');
    } else {
      ElMessage.error('取消收藏失败');
    }
  } else {
    // 准备MV数据
    const mvData = {
      id: mvId, // 使用标准格式的ID
      name: mvInfo.value.name || '未知MV',
      artist: mvInfo.value.artistName || '未知歌手',
      coverImgUrl: mvInfo.value.cover || defaultCoverUrl,
      playCount: mvInfo.value.playCount || 0,
      publishTime: mvInfo.value.publishTime || Date.now(),
      desc: mvInfo.value.desc || '',
      isFromKw: isKwMV.value
    };
    
    // 添加到收藏
    const result = addToFavorites('MVS', mvData);
    if (result) {
      isFavoritedMV.value = true;
      ElMessage.success('MV已添加到本地收藏');
    } else {
      ElMessage.error('收藏失败');
    }
  }
};

/**
 * 处理返回操作
 */
const goBack = () => {
  router.go(-1); // 使用标准的路由返回
};

/**
 * 处理视频加载错误
 * @param {Event} e - 错误事件
 */
const handleVideoError = async (e) => {
  console.error('视频加载错误:', e);
  
  // 如果当前URL不是备用URL，先尝试使用备用URL
  if (!mvUrl.value.includes('r=1080') && !mvUrl.value.includes('format=mp4')) {
    const mvId = route.params.id;
    console.log('尝试使用备用URL加载视频');
    mvUrl.value = `https://api.931125.xyz/mv/url?id=${mvId}&r=1080`;
    return;
  }
  
  // 如果已经尝试过备用URL但仍然失败，尝试使用酷我API
  if (!mvUrl.value.includes('type=mv') && mvInfo.value) {
    console.log('尝试从酷我获取同名MV');
    
    try {
      // 获取MV名称和艺术家
      const mvName = mvInfo.value.name;
      const artistName = mvInfo.value.artistName;
      
      // 尝试使用酷我API搜索同名MV
      const searchResponse = await axios.get(`${KW_API_URL}`, {
        params: {
          key: `${artistName} ${mvName}`,
          type: 'mvSearch',
          limit: 5
        }
      });
      
      if (searchResponse.data && searchResponse.data.code === 200 && 
          Array.isArray(searchResponse.data.data) && searchResponse.data.data.length > 0) {
        // 找到匹配的MV
        const kwMv = searchResponse.data.data[0];
        console.log('从酷我找到匹配的MV:', kwMv.name, kwMv.artist);
        
        // 设置MV播放地址
        mvUrl.value = `${KW_API_URL}?id=${kwMv.id || kwMv.rid}&level=2k&type=mv&format=mp4`;
        console.log('使用酷我MV地址:', mvUrl.value);
        return;
      }
    } catch (searchErr) {
      console.error('搜索酷我MV失败:', searchErr);
    }
  }
  
  // 如果所有尝试都失败
  error.value = '视频加载失败，可能是版权限制或网络问题，请稍后重试';
};

/**
 * 处理视频加载完成
 */
const handleVideoLoaded = () => {
  console.log('视频加载完成');
  error.value = null;
};

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
 * @param {number|string} timestamp - 时间戳或日期字符串
 * @returns {string} 格式化后的日期
 */
const formatDate = (timestamp) => {
  if (!timestamp) return '未知';
  
  try {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN');
  } catch (e) {
    return '未知';
  }
};

// 在组件挂载时获取MV数据
onMounted(() => {
  // 从URL参数获取MV ID
  const mvId = route.params.id;
  // 检查是否是酷我MV
  isKwMV.value = route.query.source === 'kw';
  
  // 检查是否有缓存数据
  const cacheKey = isKwMV.value ? `kw_${mvId}` : mvId;
  if (mvId && mvCache.value[cacheKey]) {
    console.log(`使用缓存的MV数据: ${cacheKey}`);
    mvInfo.value = mvCache.value[cacheKey].info;
    mvUrl.value = mvCache.value[cacheKey].url;
    relatedMVs.value = mvCache.value[cacheKey].related;
    loading.value = false;
    
    // 延迟恢复滚动位置
    setTimeout(() => {
      const savedScrollPosition = localStorage.getItem('mv_scroll_position');
      if (savedScrollPosition) {
        window.scrollTo(0, parseInt(savedScrollPosition));
      }
    }, 100);
    
    // 检查收藏状态
    checkFavoriteStatus();
  } else {
    // 没有缓存数据，获取新数据
    fetchMVDetail();
  }
});

// 监听页面卸载，确保保存状态
onUnmounted(() => {
  // 当组件卸载时（例如导航到其他非MV页面），可以考虑是否清除 musicPausedForMV 标记
  // 但如果用户是返回到播放列表，PlaylistView 会处理这个标记
  // 如果确定要在这里清除，需要判断导航目标
  // const goingToPlaylist = router.currentRoute.value.name === 'now-playing' || router.currentRoute.value.name === 'playlist-display';
  // if (!goingToPlaylist) {
  //   localStorage.removeItem('musicPausedForMV');
  // }
});

// 监听路由参数变化以重新加载MV数据
watch(() => route.params.id, (newId, oldId) => {
  if (newId && newId !== oldId) { // 只有在 newId 存在且与 oldId 不同时才执行
    // 暂停当前可能正在播放的MV
    if (videoPlayer.value) {
      videoPlayer.value.pause();
    }
    // 重置状态并获取新的MV数据
    mvInfo.value = null;
    mvUrl.value = null;
    relatedMVs.value = [];
    loading.value = true;
    error.value = null;
    
    // 暂停背景音乐 (如果新MV加载时背景音乐在播放)
    if (playerStore.isPlaying) {
      playerStore.togglePlayPause();
      localStorage.setItem('musicPausedForMV', 'true');
      console.log('[MVView] 因切换MV，背景音乐已暂停');
    }
    
    fetchMVDetail();
  }
}, { immediate: true }); // immediate: true 确保组件创建时也会基于当前ID获取数据

// 监听路由query变化以检测MV来源
watch(() => route.query.source, (newSource) => {
  isKwMV.value = newSource === 'kw';
}, { immediate: true });

// 监听MV信息变化，更新收藏状态
watch(() => mvInfo.value, (newInfo) => {
  if (newInfo) {
    checkFavoriteStatus();
  }
}, { immediate: true });

// 监听组件激活
onActivated(() => {
  // 检查是否需要重新加载数据
  if (route.params.id && !loading.value && !error.value) {
    const mvId = route.params.id;
    const cacheKey = isKwMV.value ? `kw_${mvId}` : `main_mv_${mvId}`;
    const lastUpdateKey = `last_update_mv_${cacheKey}`;
    const lastUpdate = localStorage.getItem(lastUpdateKey);
    const now = Date.now();
    const cacheExpired = !lastUpdate || (now - parseInt(lastUpdate, 10)) > 30 * 60 * 1000; // 30分钟缓存
    
    // 如果有缓存且未过期，使用缓存数据
    if (mvCache.value[cacheKey] && !cacheExpired) {
      console.log(`[MVView][onActivated] 使用缓存数据: ${cacheKey}`);
      mvInfo.value = mvCache.value[cacheKey].info;
      mvUrl.value = mvCache.value[cacheKey].url;
      relatedMVs.value = mvCache.value[cacheKey].related;
      
      // 检查收藏状态
      checkFavoriteStatus();
    } else {
      console.log(`[MVView][onActivated] 缓存不存在或已过期，重新加载数据: ${cacheKey}`);
      // 没有缓存数据，获取新数据
      fetchMVDetail();
    }
    
    // 恢复滚动位置
    const scrollPos = localStorage.getItem('mv_scroll_position');
    if (scrollPos) {
      nextTick(() => {
        window.scrollTo(0, parseInt(scrollPos, 10));
      });
    }
  }
});
</script>

<style scoped>
.mv-view-container {
  padding: 15px; /* 统一内边距 */
  max-width: 600px; /* 再次减小最大宽度，使其更窄 */
  margin: 0 auto;
  color: #fff;
  min-height: 100vh;
}

.mv-header {
  display: flex;
  align-items: center;
  justify-content: center; /* 标题居中 */
  margin-top: 15px; /* 调整上边距 */
  margin-bottom: 10px;
  width: 100%;
  position: relative; /* 用于精确定位标题 */
}

.custom-back-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 7px 14px; /* 根据截图微调 */
  background-color: rgba(30, 30, 30, 0.7); /* 根据截图调整背景色 */
  color: white;
  border-radius: 20px; /* 根据截图调整圆角 */
  cursor: pointer;
  position: absolute;
  top: 15px; /* 根据截图调整 */
  left: 15px; /* 根据截图调整 */
  z-index: 10;
  font-size: 13px; /* 根据截图调整字体大小 */
  transition: all 0.2s;
}


.top-navigation-area {
  width: 100%;
  position: relative;
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 20px;
}

.nav-back-button {
  position: absolute;
  top: 20px;
  left: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  background-color: rgba(61, 61, 61, 0.6);
  color: white;
  border-radius: 20px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  z-index: 100;
}

.nav-back-button:hover {
  background-color: rgba(80, 80, 80, 0.7);
}

.nav-back-button .el-icon {
  margin-right: 5px;
}

.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 60px;
}

.custom-back-button:hover {
  background-color: rgba(80, 80, 80, 0.7);
}

.custom-back-button .el-icon {
  margin-right: 5px;
}

.mv-title {
  font-size: 17px; /* 保持这个大小，但通过max-width控制 */
  font-weight: 500; /* 调整字重以匹配截图 */
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
  max-width: calc(100% - 150px); /* 调整确保不与按钮重叠，并居中 */
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.3; /* 增加行高，使得单行文字在垂直方向更居中一点 */
}

.loading-container, .error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  position: relative;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text, .error-message {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 20px;
}

.error-actions {
  display: flex;
  flex-direction: row;
  gap: 15px;
  margin-top: 20px;
  justify-content: center;
}

.error-button {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: 8px 20px;
  border-radius: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.2s;
}

.error-button:hover {
  background-color: rgba(255, 255, 255, 0.3);
}

.back-button {
  background-color: rgba(61, 61, 61, 0.6);
}

.back-button:hover {
  background-color: rgba(80, 80, 80, 0.7);
}

.back-button .el-icon {
  margin-right: 5px;
}

.retry-button {
  background: rgba(255, 255, 255, 0.2);
}

.video-container {
  width: 100%;
  max-width: 100%; 
  background: #000;
  position: relative;
  border-radius: 10px; /* 根据截图调整圆角 */
  overflow: hidden;
  margin: 0 auto 15px; /* 调整下边距 */
  aspect-ratio: 16 / 9;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.video-player {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.mv-info {
  padding: 10px 5px; /* 调整内边距使其更紧凑 */
  margin: 0 auto 15px;
  width: 100%; 
  max-width: 100%; 
  text-align: left;
}

.mv-artist, .mv-play-count, .mv-publish-time, .mv-description {
  margin-bottom: 8px; /* 减小信息行间距 */
  font-size: 13px; /* 根据截图调整字体大小 */
  color: rgba(220, 220, 220, 0.85); /* 调整文字颜色 */
}

.mv-description {
  line-height: 1.5; /* 调整简介行高 */
}

.label {
  font-weight: 500; /* 调整标签字重 */
  color: rgba(200, 200, 200, 0.75); /* 调整标签颜色 */
  margin-right: 6px;
}

.section-title {
  font-size: 16px; /* 调整相关推荐标题大小 */
  font-weight: 500;
  margin-bottom: 12px;
  position: relative;
  padding-left: 10px;
  text-align: left;
}

.section-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px; /* 减小指示条宽度 */
  height: 16px; /* 减小指示条高度 */
  background: linear-gradient(to bottom, #1DB954, #1ed760);
  border-radius: 2px;
}

.related-mvs {
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  padding-top: 5px;
}

.related-mvs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); /* 调整相关MV卡片最小宽度 */
  gap: 12px;
}

.related-mv-card {
  cursor: pointer;
  transition: transform 0.2s;
  border-radius: 8px;
  overflow: hidden;
}

.related-mv-card:hover {
  transform: translateY(-5px);
}

.related-mv-cover {
  position: relative;
  width: 100%;
  padding-top: 56.25%; /* 16:9 宽高比 */
  overflow: hidden;
}

.related-mv-cover img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.play-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
  opacity: 0;
  transition: opacity 0.2s;
}

.related-mv-card:hover .play-icon {
  opacity: 1;
}

.related-mv-info {
  padding: 10px;
}

.related-mv-name {
  font-size: 14px;
  margin-bottom: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.related-mv-artist {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

@media (max-width: 768px) {
  .mv-view-container {
    padding: 10px; /* 调整小屏幕下的内边距 */
    max-width: 100%; /* 小屏幕下占满宽度 */
  }
  
  .mv-title {
    font-size: 16px; 
    max-width: calc(100% - 130px); 
  }
  
  .video-container,
  .mv-actions,
  .mv-info,
  .related-mvs {
    width: 100%; 
  }
  
  .action-button {
    padding: 7px 15px;
    font-size: 12px;
  }

  .related-mvs-grid {
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); /* 调整小屏幕下相关MV卡片最小宽度 */
    gap: 8px;
  }
}

/* 添加MV操作按钮样式 */
.mv-actions {
  display: flex;
  flex-wrap: nowrap;
  margin: 15px auto; /* 调整上下边距 */
  padding: 0;
  justify-content: center;
  gap: 12px; /* 根据截图减小按钮间距 */
  background: transparent;
  width: 100%; 
  max-width: 100%; 
}

.action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(45, 45, 45, 0.75); /* 根据截图调整背景 */
  border: none;
  border-radius: 20px; /* 根据截图调整圆角 */
  color: white;
  padding: 8px 18px; /* 根据截图调整内边距 */
  cursor: pointer;
  transition: all 0.3s;
  font-size: 13px; /* 根据截图调整字体 */
  min-width: auto; /* 让按钮宽度自适应内容 */
  font-weight: 500;
}

.action-button:hover {
  background-color: rgba(65, 65, 65, 0.85);
  transform: scale(1.03);
}

.action-button .icon {
  margin-right: 5px;
  font-size: 16px;
}
</style>