<template>
  <div class="playlists-view-container" ref="viewContainerRef">
    <!-- 歌单导航栏 -->
    <div class="playlists-nav">
      <div class="nav-tabs">
        <!-- 全部 -->
        <div 
          class="nav-tab" 
          :class="{ active: activeTab === 'all' }"
          @click="changeTab('all')"
        >
          全部
        </div>
        
        <!-- 您的歌单 -->
        <div 
          class="nav-tab" 
          :class="{ active: activeTab === 'mine' }"
          @click="changeTab('mine')"
        >
          您的歌单
        </div>
        
        <!-- 排行榜 -->
        <div 
          class="nav-tab" 
          :class="{ active: activeTab === 'ranking' }"
          @click="changeTab('ranking')"
        >
          排行榜
        </div>
        
        <!-- MV -->
        <div 
          class="nav-tab" 
          :class="{ active: activeTab === 'mv' }"
          @click="changeTab('mv')"
        >
          MV
        </div>
        
        <!-- 本地收藏 -->
        <div 
          class="nav-tab" 
          :class="{ active: activeTab === 'favorites' }"
          @click="changeTab('favorites')"
        >
          本地收藏
        </div>
      </div>
    </div>

    <!-- 同步弹窗 -->
    <div v-if="showSyncDialog" class="sync-dialog-overlay" @click.self="showSyncDialog = false">
      <div class="sync-dialog">
        <div class="sync-dialog-header">
          <h3>请输入您的网易云音乐UID(用户ID)</h3>
          <button class="close-button" @click="showSyncDialog = false">×</button>
        </div>
        <div class="sync-dialog-body">
          <input 
            type="text" 
            v-model="userIdInput" 
            placeholder="请输入网易云音乐UID" 
            class="uid-input"
          />
        </div>
        <div class="sync-dialog-footer">
          <button class="confirm-button" @click="syncUserPlaylists" :disabled="isSyncing">
            {{ isSyncing ? '同步中...' : '确定' }}
          </button>
          <button class="cancel-button" @click="showSyncDialog = false">取消</button>
          <button class="help-button" @click="showHelpDialog = true">帮助</button>
        </div>
      </div>
    </div>

    <!-- 帮助弹窗 -->
    <div v-if="showHelpDialog" class="help-dialog-overlay" @click.self="showHelpDialog = false">
      <div class="help-dialog">
        <div class="help-dialog-header">
          <h3>如何获取您的网易云音乐UID?</h3>
          <button class="close-button" @click="showHelpDialog = false">×</button>
        </div>
        <div class="help-dialog-body">
          <div class="help-steps">
            <p class="help-step"><span class="step-number">1、</span>首先<a href="https://music.163.com/" target="_blank" class="help-link">https://music.163.com/</a>打开网易云音乐官网</p>
            <p class="help-step"><span class="step-number">2、</span>然后登录您的账号</p>
            <p class="help-step"><span class="step-number">3、</span>点击您的头像 > 我的主页</p>
            <p class="help-step"><span class="step-number">4、</span>此时浏览器地址栏<span class="highlight">/user/home?id=数字</span>，红色标记的数字，就是您的网易云音乐用户UID</p>
            <p class="help-step"><span class="step-number">5、</span>网易云app登录之后依次点击三个横线->设置->账号与安全，UID在页面最顶部</p>
          </div>
        </div>
        <div class="help-dialog-footer">
          <button class="confirm-button" @click="showHelpDialog = false">确定</button>
        </div>
      </div>
    </div>

    <!-- 加载中弹窗 -->
    <div v-if="currentTabData.loading && !playlists.length" class="loading-overlay">
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <div class="loading-text">加载中...</div>
      </div>
    </div>
    
    <!-- 刷新歌单加载中覆盖层 -->
    <div v-if="showLoadingOverlay" class="refresh-loading-overlay">
      <div class="loading-spinner"></div>
    </div>

    <!-- 歌单分类选择器 (仅在全部标签下显示) -->
    <div v-if="activeTab === 'all'" class="category-selector">
      <div class="current-category" @click="showCategorySelector = !showCategorySelector">
        <span>{{ currentCategory }}</span>
        <span class="arrow">{{ showCategorySelector ? '▲' : '▼' }}</span>
      </div>
      <!-- 添加返回全部的按钮，当当前分类不是"全部"时显示 -->
      <div v-if="currentCategory !== '全部'" class="back-to-all" @click="selectCategory('全部')">
        返回全部
      </div>
      <div v-if="showCategorySelector" class="category-dropdown">
        <div class="category-groups">
          <div v-for="(group, groupName) in categoryGroups" :key="groupName" class="category-group">
            <div class="group-name">{{ groupName }}</div>
            <div class="group-items">
              <div 
                v-for="category in group" 
                :key="category" 
                class="category-item"
                :class="{ active: currentCategory === category }"
                @click="selectCategory(category)"
              >
                {{ category }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 歌单列表内容 -->
    <div class="playlists-content" ref="contentScrollRef">
      <!-- 用户歌单页面 - 未同步状态 -->
      <div v-if="activeTab === 'mine' && syncStatus === '未同步'" class="mine-empty-state">
        <div class="sync-button-container">
          <button class="big-sync-button" @click="showSyncDialog = true">
            <i class="sync-icon">⟳</i> 同步
          </button>
          <p class="sync-tip">点击同步您的网易云音乐歌单</p>
        </div>
      </div>
      
      <!-- 用户歌单页面 - 已同步状态 -->
      <div v-else-if="activeTab === 'mine' && syncStatus === '已同步'">
        <!-- 用户信息展示 -->
        <div class="user-info-banner">
          <div class="user-avatar">
            <img :src="userInfo?.avatarUrl || defaultCoverUrl" alt="用户头像">
          </div>
          <div class="user-details">
            <h2 class="user-nickname">{{ userInfo?.nickname }}</h2>
            <div class="user-actions">
              <button class="user-action-button" @click="refreshUserPlaylists">
                <i class="sync-icon">⟳</i> 刷新歌单
              </button>
              <button class="user-action-button" @click="cancelSync">
                退出
              </button>
            </div>
          </div>
        </div>
        
        <!-- 用户歌单展示 -->
        <div v-if="loading && userPlaylists.length === 0" class="loading-state">
          <p>加载中...</p>
        </div>
        <div v-else-if="error" class="error-state">
          <p>{{ error }}</p>
          <button @click="refreshUserPlaylists">重试</button>
        </div>
        <div v-else class="playlists-grid">
          <div 
            v-for="(playlist, index) in userPlaylists" 
            :key="playlist._uniqueId || `${activeTab}-${playlist.id || index}`" 
            class="playlist-card"
            :class="{ 'is-ranking': playlist.isRanking }"
            @click="() => handlePlaylistClick(playlist)"
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
              <p class="playlist-creator update-frequency" v-if="playlist.isRanking">{{ playlist.updateFrequency || '未知更新频率' }}</p>
              <p class="playlist-creator" v-else>{{ playlist.creator?.nickname || '未知创建者' }}</p>
            </div>
          </div>
        </div>
        
        <!-- 用户歌单加载更多 -->
        <div v-if="isSyncing && userPlaylistOffset > 0" class="loading-more">
          <div class="loading-spinner"></div>
          <span>加载更多中...</span>
        </div>
        
        <div v-if="hasMoreUserPlaylists" ref="userPlaylistsLoadMoreTrigger" class="load-more-trigger">
          <button v-if="!isSyncing" @click="loadMoreUserPlaylists" class="load-more-button">
            加载更多
          </button>
        </div>
      </div>
      
      <!-- 其他标签页内容 -->
      <div v-if="activeTab !== 'mine'">
        <div v-if="currentTabData.loading && !displayedPlaylists.length" class="loading-state">
          <p>加载中...</p>
        </div>
        <div v-else-if="currentTabData.error" class="error-state">
          <p>{{ currentTabData.error }}</p>
          <button @click="fetchPlaylists">重试</button>
        </div>
        <div v-else class="playlists-grid">
          <div 
            v-for="(playlist, index) in displayedPlaylists" 
            :key="playlist._uniqueId || `${activeTab}-${playlist.id || index}`" 
            class="playlist-card"
            :class="{ 'is-ranking': playlist.isRanking, 'is-kw-ranking': playlist.isFromKw && playlist.isRanking }"
            @click="() => handlePlaylistClick(playlist)"
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
              <p class="playlist-creator update-frequency" v-if="playlist.isRanking">{{ playlist.updateFrequency || '未知更新频率' }}</p>
              <p class="playlist-creator" v-else>{{ playlist.creator?.nickname || '未知创建者' }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部加载指示器 -->
      <div v-if="activeTab !== 'mine' && currentTabData.loading && currentTabData.offset > 0" class="loading-indicator">
        <p>加载更多中...</p>
      </div>
      
      <!-- 无限滚动触发元素 -->
      <div v-if="activeTab !== 'mine' && currentTabData.hasMore" ref="loadMoreTrigger" class="load-more-trigger">
        <button v-if="!currentTabData.loading" @click="loadMore" class="load-more-button">加载更多</button>
        <p v-else>加载中...</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onUnmounted, onActivated, onDeactivated, nextTick, defineComponent, getCurrentInstance } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { getPlaylists, getTopLists, getTopMvs, getPlaylistCatlist, getPlaylistsByCategory, getUserPlaylists, getKwPlaylists, getHighqualityPlaylists } from '../services/api';
import axios from 'axios';

// 使用环境变量获取API基础URL
const MAIN_API_BASE = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3000';
const KW_API_URL = import.meta.env.VITE_KW_API_URL || 'https://kw-api.cenguigui.cn';
const MV_API_BASE = 'https://api.931125.xyz'; // 为MV添加专用API地址

// 定义组件名称以支持keep-alive
defineComponent({
  name: 'PlaylistsView'
});

const __NAME__ = 'PlaylistsView';

const router = useRouter();
const route = useRoute();
const instance = getCurrentInstance();

const contentScrollRef = ref(null); // Added ref for the scrollable content
const viewContainerRef = ref(null); // Added ref for the main container (backup)

const loading = ref(false);
const error = ref(null);
const playlists = ref([]); // 这个可能不再需要，因为数据现在在 tabData 中
const offset = ref(0); // 这个也可能不再需要
const limit = ref(20);
const hasMoreToLoad = ref(true); // 这个也可能不再需要
const defaultCoverUrl = 'https://p2.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg';

// 同步相关
const showSyncDialog = ref(false);
const showHelpDialog = ref(false);
const userIdInput = ref('');
const syncStatus = ref('未同步');
const userInfo = ref(null);
const userPlaylists = ref([]);
const isSyncing = ref(false);
const showLoadingOverlay = ref(false);
const userPlaylistOffset = ref(0);
const userPlaylistLimit = ref(30);
const hasMoreUserPlaylists = ref(true);

// 无限滚动相关
const loadMoreTrigger = ref(null);
const userPlaylistsLoadMoreTrigger = ref(null);
let observer = null;
let userPlaylistsObserver = null;

// 歌单分类相关
const showCategorySelector = ref(false);
const currentCategory = ref('全部');
const categories = ref([]);
const categoryGroups = ref({
  语种: ['华语', '欧美', '日语', '韩语', '粤语'],
  风格: ['流行', '摇滚', '民谣', '电子', '舞曲', '说唱', '轻音乐', '爵士', '乡村', 'R&B/Soul', '古典', '民族', '英伦', '金属', '朋克', '蓝调', '雷鬼', '世界音乐', '拉丁', '另类/独立', 'New Age', '古风', '后摇', 'Bossa Nova'],
  场景: ['清晨', '夜晚', '学习', '工作', '午休', '下午茶', '地铁', '驾车', '运动', '旅行', '散步', '酒吧'],
  情感: ['怀旧', '清新', '浪漫', '伤感', '治愈', '放松', '孤独', '感动', '兴奋', '快乐', '安静', '思念'],
  主题: ['综艺', '影视原声', 'ACG', '儿童', '校园', '游戏', '70后', '80后', '90后', '00后', '10后', '网络歌曲']
});

const tabs = [
  { id: 'all', name: '全部' },
  { id: 'mine', name: '您的歌单' },
  { id: 'ranking', name: '排行榜' },
  { id: 'mv', name: 'MV' },
  { id: 'favorites', name: '本地收藏' }
];

const activeTab = ref(route.query.tab || 'all');

const tabData = ref({
  all: { playlists: [], offset: 0, hasMore: true, loading: false, error: null },
  mine: { playlists: [], offset: 0, hasMore: true, loading: false, error: null }, // mine 的 playlists 会被 userPlaylists 覆盖
  ranking: { playlists: [], offset: 0, hasMore: true, loading: false, error: null },
  mv: { playlists: [], offset: 0, hasMore: true, loading: false, error: null },
  favorites: { playlists: [], offset: 0, hasMore: true, loading: false, error: null },
  playlists: { playlists: [], offset: 0, hasMore: true, loading: false, error: null }, // 添加playlists标签的数据
  songs: { playlists: [], offset: 0, hasMore: true, loading: false, error: null }, // 添加songs标签的数据
  mvs: { playlists: [], offset: 0, hasMore: true, loading: false, error: null }, // 添加mvs标签的数据
  rankings: { playlists: [], offset: 0, hasMore: true, loading: false, error: null } // 添加rankings标签的数据
});

const currentTabData = computed(() => {
  // 确保返回有效的数据对象，即使tabData中没有对应的tab
  if (!tabData.value[activeTab.value]) {
    return { playlists: [], offset: 0, hasMore: true, loading: false, error: null };
  }
  return tabData.value[activeTab.value];
});

const displayedPlaylists = computed(() => {
  if (activeTab.value === 'mine') {
    return userPlaylists.value; // 用户歌单直接使用 userPlaylists
  }
  return currentTabData.value.playlists;
});

const formatPlayCount = (count) => {
  if (!count) return '0';
  if (count < 10000) return count.toString();
  return (count / 10000).toFixed(1) + '万';
};

const fetchCategories = async () => {
  try {
    const response = await getPlaylistCatlist();
    if (response && response.categories && response.sub) {
      categories.value = ['全部', ...response.sub.map(item => item.name)];
    }
  } catch (err) {
    console.error('获取歌单分类失败:', err);
  }
};

const selectCategory = (category) => {
  currentCategory.value = category;
  showCategorySelector.value = false;
  const currentData = tabData.value['all'];
  currentData.offset = 0;
  currentData.hasMore = true;
  currentData.playlists = [];
  fetchPlaylists();
};

const fetchUserPlaylistsPage = async (uid, isLoadMore = false, noCache = false) => {
  console.log(`[PlaylistsView] fetchUserPlaylistsPage 调用: uid=${uid}, isLoadMore=${isLoadMore}, noCache=${noCache}`);
  try {
    console.log(`[PlaylistsView] 开始获取用户歌单: uid=${uid}, limit=${userPlaylistLimit.value}, offset=${userPlaylistOffset.value}, noCache=${noCache}`);
    const response = await getUserPlaylists(uid, userPlaylistLimit.value, userPlaylistOffset.value, noCache);
    console.log(`[PlaylistsView] 获取用户歌单成功: code=${response.code}, 歌单数量=${response.playlist?.length || 0}`);
    if (response && response.code === 200 && response.playlist) {
      if (!isLoadMore && response.playlist.length > 0) {
        userInfo.value = {
          userId: uid,
          nickname: response.playlist[0]?.creator?.nickname || '网易云用户',
          avatarUrl: convertHttpToHttps(response.playlist[0]?.creator?.avatarUrl || defaultCoverUrl)
        };
        console.log(`[PlaylistsView] 更新用户信息: nickname=${userInfo.value.nickname}`);
      }
      const formattedPlaylists = response.playlist.map((item, index) => ({
        ...item,
        coverImgUrl: convertHttpToHttps(item.coverImgUrl || item.picUrl || defaultCoverUrl),
        isUserCreated: true,
        _uniqueId: `user-${item.id}-${userPlaylistOffset.value + index}`
      }));
      if (isLoadMore) {
        userPlaylists.value = [...userPlaylists.value, ...formattedPlaylists];
      } else {
        userPlaylists.value = formattedPlaylists;
      }
      console.log(`[PlaylistsView] 更新歌单列表完成: 新增数量=${formattedPlaylists.length}, 总数量=${userPlaylists.value.length}`);
      hasMoreUserPlaylists.value = formattedPlaylists.length >= userPlaylistLimit.value;
      // if (activeTab.value === 'mine') { // displayedPlaylists 计算属性会处理
      //   // tabData.value.mine.playlists = userPlaylists.value; 
      // }
      nextTick(() => setupUserPlaylistsObserver());
      return true;
    } else {
      throw new Error('获取歌单失败');
    }
  } catch (err) {
    console.error('获取用户歌单页面错误:', err);
    if (!isLoadMore) throw err;
    return false;
  }
};

const syncUserPlaylists = async () => {
  if (!userIdInput.value.trim()) {
    alert('请输入有效的用户ID');
    return;
  }
  try {
    isSyncing.value = true;
    syncStatus.value = '同步中';
    showSyncDialog.value = false;
    showLoadingOverlay.value = true;
    userPlaylistOffset.value = 0;
    userPlaylists.value = [];
    hasMoreUserPlaylists.value = true;
    await fetchUserPlaylistsPage(userIdInput.value.trim());
    localStorage.setItem('netease_user_id', userIdInput.value.trim());
    localStorage.setItem('netease_user_info', JSON.stringify(userInfo.value));
    syncStatus.value = '已同步';
    activeTab.value = 'mine'; // 切换到 'mine' tab
    router.push({ path: '/playlists', query: { tab: 'mine' } }); // 更新路由
  } catch (err) {
    console.error('同步歌单错误:', err);
    alert('同步失败，请检查用户ID是否正确');
    syncStatus.value = '未同步';
  } finally {
    isSyncing.value = false;
    showLoadingOverlay.value = false;
  }
};

const setupUserPlaylistsObserver = () => {
  if (!hasMoreUserPlaylists.value || !userPlaylistsLoadMoreTrigger.value) return;
  if (userPlaylistsObserver) userPlaylistsObserver.disconnect();
  userPlaylistsObserver = new IntersectionObserver((entries) => {
    const entry = entries[0];
    if (entry.isIntersecting && !isSyncing.value && hasMoreUserPlaylists.value) {
      loadMoreUserPlaylists();
    }
  }, { rootMargin: '200px', threshold: 0.1 });
  userPlaylistsObserver.observe(userPlaylistsLoadMoreTrigger.value);
};

const loadMoreUserPlaylists = async () => {
  if (isSyncing.value || !hasMoreUserPlaylists.value || !userInfo.value?.userId) return;
  try {
    isSyncing.value = true;
    userPlaylistOffset.value += userPlaylistLimit.value;
    await fetchUserPlaylistsPage(userInfo.value.userId, true);
  } catch (err) {
    console.error('加载更多用户歌单错误:', err);
    hasMoreUserPlaylists.value = false;
  } finally {
    isSyncing.value = false;
  }
};

const refreshUserPlaylists = async () => {
  // 直接使用指定的UID，而不是依赖缓存中的用户ID
  const uid = "1941066868"; // 固定使用这个UID
  console.log(`[PlaylistsView] 开始刷新用户(${uid})歌单...`);
  try {
    isSyncing.value = true;
    syncStatus.value = '同步中';
    showLoadingOverlay.value = true; // 显示加载中的透明旋转图标
    userPlaylistOffset.value = 0;
    userPlaylists.value = [];
    hasMoreUserPlaylists.value = true;
    // 使用noCache=true参数确保获取最新数据
    console.log(`[PlaylistsView] 调用fetchUserPlaylistsPage，noCache=true...`);
    
    await fetchUserPlaylistsPage(uid, false, true);
    console.log(`[PlaylistsView] 用户歌单刷新完成，歌单数量: ${userPlaylists.value.length}`);
    // 更新本地存储
    localStorage.setItem('netease_user_id', uid);
    if (userInfo.value) {
      localStorage.setItem('netease_user_info', JSON.stringify(userInfo.value));
    }
    syncStatus.value = '已同步';
  } catch (err) {
    console.error('刷新歌单错误:', err);
    // 不使用alert，而是在UI中显示错误信息
  } finally {
    isSyncing.value = false;
    showLoadingOverlay.value = false; // 隐藏加载中的透明旋转图标
  }
};

const cancelSync = () => {
  userInfo.value = null;
  userPlaylists.value = [];
  syncStatus.value = '未同步';
  localStorage.removeItem('netease_user_id');
  localStorage.removeItem('netease_user_info');
  if (activeTab.value === 'mine') {
    // displayedPlaylists 计算属性会处理默认内容
  }
};

const fetchPlaylists = async (silentUpdate = false, forceReload = false) => {
  // 确保当前tab数据对象存在
  if (!tabData.value[activeTab.value]) {
    console.warn(`[PlaylistsView] fetchPlaylists: Creating missing tab data for ${activeTab.value}`);
    tabData.value[activeTab.value] = { playlists: [], offset: 0, hasMore: true, loading: false, error: null };
  }
  
  const currentData = currentTabData.value;
  const tabId = activeTab.value;
  // console.log(`[PlaylistsView] fetchPlaylists: Called for tab: ${tabId}, category: ${currentCategory.value}, offset: ${currentData.offset}, forceReload: ${forceReload}`);

  if (tabId === 'mine') { // 'mine' tab 单独处理
    if (syncStatus.value === '已同步' && userInfo.value?.userId) {
      if (userPlaylists.value.length === 0 || forceReload) {
        // console.log(`[PlaylistsView] fetchPlaylists (mine): Fetching user playlists for ${userInfo.value.userId}`);
        currentData.loading = !silentUpdate;
        await fetchUserPlaylistsPage(userInfo.value.userId, false);
        currentData.loading = false;
      }
    } else {
      currentData.playlists = [];
      currentData.hasMore = false;
    }
    nextTick(() => setupUserPlaylistsObserver());
    return;
  }

  const hasData = currentData.playlists && currentData.playlists.length > 0;
  const lastUpdateKey = `last_update_${tabId}_${currentCategory.value}`; // 缓存key加上分类
  const lastUpdate = localStorage.getItem(lastUpdateKey);
  const now = Date.now();
  const cacheExpired = !lastUpdate || (now - parseInt(lastUpdate, 10)) > 30 * 60 * 1000; // 30分钟缓存
  
  // 仅当 offset 为 0 (即首次加载或刷新)，且非强制重载，且有数据且缓存未过期时，才考虑使用缓存
  const shouldUseCache = currentData.offset === 0 && hasData && !cacheExpired && !forceReload;

  if (shouldUseCache) {
    // console.log(`[PlaylistsView] fetchPlaylists: Using cached data for tab ${tabId}, category ${currentCategory.value}`);
    nextTick(() => setupIntersectionObserver());
    return;
  }

  if (!silentUpdate) {
    currentData.loading = true;
    currentData.error = null;
  }
  // console.log(`[PlaylistsView] fetchPlaylists: Proceeding to fetch data for tab ${tabId}, category ${currentCategory.value}`);

  // 用于本次拉取操作的歌单ID缓存，防止重复添加
  const fetchedPlaylistIdsThisCall = new Set();
  const newKwPlaylists = [];
  const newMainApiPlaylists = [];

  try {
    if (tabId === 'all') {
      //\\  // console.log(`[PlaylistsView] fetchPlaylists (all): Fetching for category '${currentCategory.value}', page: ${Math.floor(currentData.offset / limit.value) + 1}`);
      
      // 1. 尝试获取酷我API的歌单
      try {
        //  // console.log(`[PlaylistsView] fetchPlaylists (all): Attempting to fetch KW playlists. Category: '精选', Page: ${Math.floor(currentData.offset / limit.value) + 1}`);
        const kwResponse = await getKwPlaylists(
          '精选', // 酷我歌单分类可能与主API不同，这里用 '精选'
          Math.floor(currentData.offset / limit.value) + 1,
          limit.value
        );
        //  // // console.log('[PlaylistsView] fetchPlaylists (all): Full KW playlists response (kwResponse):', JSON.parse(JSON.stringify(kwResponse)));
        // 重点打印 kwResponse.data 的内容，看歌单列表到底在哪里
        if (kwResponse && kwResponse.data) {
            // // console.log('[PlaylistsView] fetchPlaylists (all): Detailed kwResponse.data:', JSON.parse(JSON.stringify(kwResponse.data)));
        } else {
            // // console.log('[PlaylistsView] fetchPlaylists (all): kwResponse.data is null or undefined.');
        }

        let kwPlaylistArray = [];
        // 正确的路径应该是 kwResponse.data.musicList
        if (kwResponse && kwResponse.data && Array.isArray(kwResponse.data.musicList)) {
            kwPlaylistArray = kwResponse.data.musicList;
            // // console.log(`[PlaylistsView] fetchPlaylists (all): Extracted playlist from kwResponse.data.musicList. Count: ${kwPlaylistArray.length}`);
        // 保留之前的尝试作为非常低优先级的备选，但理论上不应该走到这里了
        } else if (kwResponse && Array.isArray(kwResponse.data)) { 
            kwPlaylistArray = kwResponse.data;
            // // console.log('[PlaylistsView] fetchPlaylists (all): KW response.data is an array (fallback 1).');
        } else if (kwResponse && kwResponse.data && Array.isArray(kwResponse.data.list)) { 
            kwPlaylistArray = kwResponse.data.list;
            // // console.log('[PlaylistsView] fetchPlaylists (all): KW response.data.list is an array (fallback 2).');
        } else if (kwResponse && kwResponse.data && Array.isArray(kwResponse.data.data)) { 
            kwPlaylistArray = kwResponse.data.data;
            // // console.log('[PlaylistsView] fetchPlaylists (all): KW response.data.data is an array (fallback 3).');
        } else {
            // // console.log('[PlaylistsView] fetchPlaylists (all): KW response does not seem to contain a playlist array in ANY expected locations.');
        }

        if (kwPlaylistArray.length > 0) {
          // // console.log(`[PlaylistsView] fetchPlaylists (all): Received ${kwPlaylistArray.length} playlists from KW API.`);
          kwPlaylistArray.forEach((item, index) => {
            const playlist = {
              id: `kw_${item.id || item.rid || index}`, // 确保酷我歌单ID的独特性
              name: item.name || '未知歌单',
              coverImgUrl: convertHttpToHttps(item.pic || item.cover || defaultCoverUrl),
              playCount: item.playCount || 0,
              creator: { nickname: item.artist || '酷我音乐' },
              isFromKw: true,
              _uniqueId: `kw-${item.id || item.rid || index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            };
            const playlistKey = `kw_${item.id || item.rid}`; // 使用原始ID进行去重检查
            if (!fetchedPlaylistIdsThisCall.has(playlistKey)) {
              newKwPlaylists.push(playlist);
              fetchedPlaylistIdsThisCall.add(playlistKey);
            }
          });
          // // console.log(`[PlaylistsView] fetchPlaylists (all): Added ${newKwPlaylists.length} new unique playlists from KW API.`);
        } else {
          // // console.log('[PlaylistsView] fetchPlaylists (all): No data or invalid format from KW playlists API after checking multiple paths.');
        }
      } catch (kwError) {
        console.error('[PlaylistsView] fetchPlaylists (all): Error fetching KW playlists:', kwError);
      }

      // 2. 尝试获取主API的歌单 (网易云) - 使用精品歌单接口
      try {
        const mainApiPageOffset = currentData.offset; // 主API使用 offset
        // // console.log(`[PlaylistsView] fetchPlaylists (all): Attempting to fetch Main API highquality playlists. Category: '${currentCategory.value}', Limit: ${limit.value}, Offset: ${mainApiPageOffset}`);
        
        // 计算before参数 - 如果有上一页数据，使用最后一个歌单的updateTime
        let before = 0;
        if (currentData.offset > 0 && currentData.playlists.length > 0) {
          const lastPlaylist = currentData.playlists[currentData.playlists.length - 1];
          if (lastPlaylist && !lastPlaylist.isFromKw && lastPlaylist.updateTime) {
            before = lastPlaylist.updateTime;
          }
        }
        
        // 使用精品歌单接口
        const responsePayload = await getHighqualityPlaylists(
          currentCategory.value === '全部' ? '全部' : currentCategory.value,
          limit.value,
          before
        );

        if (responsePayload && responsePayload.playlists) {
          // // console.log(`[PlaylistsView] fetchPlaylists (all): Received ${responsePayload.playlists.length} highquality playlists from Main API.`);
          responsePayload.playlists.forEach(p => {
            const playlist = {
              ...p,
              coverImgUrl: convertHttpToHttps(p.coverImgUrl || p.picUrl || defaultCoverUrl),
              isFromKw: false,
              _uniqueId: `main-${p.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            };
            const playlistKey = `main_${p.id}`;
            if (!fetchedPlaylistIdsThisCall.has(playlistKey)) {
              newMainApiPlaylists.push(playlist);
              fetchedPlaylistIdsThisCall.add(playlistKey);
            }
          });
          // // console.log(`[PlaylistsView] fetchPlaylists (all): Added ${newMainApiPlaylists.length} new unique highquality playlists from Main API.`);
          currentData.hasMore = responsePayload.more !== false && newMainApiPlaylists.length >= limit.value; // 基于主API判断是否还有更多
        } else {
          // // console.log('[PlaylistsView] fetchPlaylists (all): No data or invalid format from Main API highquality playlists.');
          // 如果主API失败，但酷我成功了，hasMore应该基于酷我是否填满了limit(如果酷我API也分页)
          // 但目前酷我API取的是一页，若主API无数据，则认为没有更多。
          if(newKwPlaylists.length === 0) currentData.hasMore = false;
        }
      } catch (mainApiError) {
        console.error('[PlaylistsView] fetchPlaylists (all): Error fetching Main API highquality playlists:', mainApiError);
        if(newKwPlaylists.length === 0) currentData.error = '获取歌单列表失败'; // 只有两边都失败才报错
      }
      
      // 3. 合并歌单
      if (currentData.offset === 0) { // 首次加载或刷新
        currentData.playlists = [...newKwPlaylists, ...newMainApiPlaylists];
        // // console.log(`[PlaylistsView] fetchPlaylists (all): Resetting playlists. KW: ${newKwPlaylists.length}, Main: ${newMainApiPlaylists.length}. Total: ${currentData.playlists.length}`);
      } else { // 加载更多
        currentData.playlists = [...currentData.playlists, ...newKwPlaylists, ...newMainApiPlaylists];
        // // console.log(`[PlaylistsView] fetchPlaylists (all): Appending playlists. KW: ${newKwPlaylists.length}, Main: ${newMainApiPlaylists.length}. New Total: ${currentData.playlists.length}`);
      }
       // 如果在offset > 0 时，新获取的两个源数据都为空，则可能意味着没有更多了
      if (currentData.offset > 0 && newKwPlaylists.length === 0 && newMainApiPlaylists.length === 0) {
        currentData.hasMore = false;
        // // console.log(`[PlaylistsView] fetchPlaylists (all): No new playlists from KWW or Main on load more, setting hasMore to false.`);
      }


    } else if (tabId === 'ranking') {
      // // console.log(`[PlaylistsView] fetchPlaylists (ranking): Fetching rankings.`);
      let kwRankings = [];
      try {
        // // console.log(`[PlaylistsView] fetchPlaylists (ranking): Attempting to fetch KW rankings.`);
        // 定义酷我的六个榜单
        const kwRankingTypes = [
          { name: '飙升榜', type: 'rank' },
          { name: '新歌榜', type: 'rank' },
          { name: '热歌榜', type: 'rank' },
          { name: '短视频音乐排行榜', type: 'rank' },
          { name: '万物DJ榜', type: 'rank' },
          { name: '经典怀旧榜', type: 'rank' },
          { name: '影视金曲榜', type: 'rank' },
          { name: '会员畅听榜', type: 'rank' },
          { name: '会员飙升榜', type: 'rank' },
          { name: '会员爱听榜', type: 'rank' },
          { name: '会员新歌榜', type: 'rank' },
          { name: '网红新歌榜', type: 'rank' },
          { name: '古风音乐榜', type: 'rank' },
          { name: '热评榜', type: 'rank' },
          { name: '翻唱榜', type: 'rank' },
          { name: '极品电音榜', type: 'rank' },
          { name: '流行趋势榜', type: 'rank' },
          { name: '综艺榜', type: 'rank' },
          { name: '说唱榜', type: 'rank' },
          { name: '禅心佛乐榜', type: 'rank' },
          { name: '铃声榜', type: 'rank' },
          { name: '爆笑相声榜', type: 'rank' },
          { name: '儿童歌曲榜', type: 'rank' },
          { name: '儿童故事榜', type: 'rank' },
          { name: '秋日思念榜', type: 'rank' },
          { name: '车载歌曲榜', type: 'rank' },
          { name: '跑步健身榜', type: 'rank' },
          { name: '宝宝哄睡榜', type: 'rank' },
          { name: '睡前放松榜', type: 'rank' },
          { name: '熬夜修仙榜', type: 'rank' },
          { name: 'Vlog必备榜', type: 'rank' },
          { name: 'KTV点唱榜', type: 'rank' },
          { name: '通勤路上榜', type: 'rank' },
          { name: '华语榜', type: 'rank' },
          { name: '粤语榜', type: 'rank' },
          { name: '欧美榜', type: 'rank' },
          { name: '韩语榜', type: 'rank' },
          { name: '日语榜', type: 'rank' },
          { name: '美国The Billboard', type: 'rank' },
          { name: 'beatport电音榜', type: 'rank' },
          { name: '英国UK Official', type: 'rank' },
          { name: '百大DJ榜', type: 'rank' },
          { name: 'YouTube音乐排行榜', type: 'rank' },
          { name: '日本公信榜', type: 'rank' },
          { name: 'Space Shower', type: 'rank' },
          { name: '腾讯音乐人原创榜', type: 'rank' },
          { name: '家务进行曲', type: 'rank' },
          { name: '现场音乐榜', type: 'rank' }
        ];
        
        // 依次获取每个榜单的数据
        const kwRankingPromises = kwRankingTypes.map(async (ranking, typeIndex) => {
          try {
            const response = await axios.get(`${KW_API_URL}`, { 
              params: { name: ranking.name, type: ranking.type } 
            });
            
            if (response?.data?.code === 200) {
              // 对榜单名称进行URL编码，确保特殊字符不会影响ID解析
              const encodedName = encodeURIComponent(ranking.name);
              
              // 如果是对象格式（单个榜单）
              if (response.data.data && !Array.isArray(response.data.data)) {
                const item = response.data.data;
                return {
                  id: `kw_rank_${encodedName}_${item.id || item.rid || typeIndex}`,
                  name: ranking.name,
                  coverImgUrl: convertHttpToHttps(item.pic || item.img || defaultCoverUrl),
                  playCount: item.playCount || 0,
                  updateFrequency: '每日更新',
                  isRanking: true,
                  isFromKw: true,
                  source: 'kw',
                  _uniqueId: `kw-ranking-${ranking.name}-${Date.now()}-${typeIndex}`
                };
              }
              // 如果是数组格式（多个榜单）
              else if (Array.isArray(response.data.data)) {
                return {
                  id: `kw_rank_${encodedName}_${typeIndex}`,
                  name: ranking.name,
                  coverImgUrl: convertHttpToHttps(response.data.pic || defaultCoverUrl),
                  playCount: response.data.playCount || 0,
                  updateFrequency: '每日更新',
                  isRanking: true,
                  isFromKw: true,
                  source: 'kw',
                  _uniqueId: `kw-ranking-${ranking.name}-${Date.now()}-${typeIndex}`
                };
              }
            }
            return null;
          } catch (err) {
            console.error(`[PlaylistsView] 获取酷我${ranking.name}失败:`, err);
            return null;
          }
        });
        
        // 等待所有榜单请求完成
        const results = await Promise.all(kwRankingPromises);
        kwRankings = results.filter(item => item !== null);
        
        console.log(`[PlaylistsView] fetchPlaylists (ranking): 成功获取 ${kwRankings.length} 个酷我榜单`);
      } catch (kwError) {
        console.error('[PlaylistsView] fetchPlaylists (ranking): Error fetching KW rankings:', kwError);
      }

      let mainApiRankings = [];
      try {
        // // console.log(`[PlaylistsView] fetchPlaylists (ranking): Attempting to fetch Main API rankings.`);
        // 直接使用 getTopLists 函数获取排行榜数据
        const responsePayload = await getTopLists();

        if (responsePayload && (responsePayload.code === 200 || responsePayload.list) && responsePayload.list) {
          // // console.log(`[PlaylistsView] fetchPlaylists (ranking): Received ${responsePayload.list.length} rankings from Main API.`);
          mainApiRankings = responsePayload.list.map((p, i) => ({
            id: `main_rank_${String(p.id).trim()}`, name: p.name || '未知排行榜',
            coverImgUrl: convertHttpToHttps(p.coverImgUrl || p.picUrl || defaultCoverUrl), playCount: p.playCount || 0,
            updateFrequency: p.updateFrequency || '未知更新频率', isRanking: true, isFromKw: false,
            source: 'main',
            _uniqueId: `ranking-${String(p.id).trim()}-${Date.now()}-${i}`
          }));
        } else {
          // // console.log('[PlaylistsView] fetchPlaylists (ranking): No data or invalid format from Main API rankings.');
        }
      } catch (mainApiError) {
        console.error('[PlaylistsView] fetchPlaylists (ranking): Error fetching Main API rankings:', mainApiError);
      }
      
      // 将酷我榜单放在前面
      currentData.playlists = [...kwRankings, ...mainApiRankings]; 
      currentData.hasMore = false; // 假设排行榜一次性加载完毕
      console.log(`[PlaylistsView] fetchPlaylists (ranking): Combined rankings. KW: ${kwRankings.length}, Main: ${mainApiRankings.length}. Total: ${currentData.playlists.length}`);
      if (kwRankings.length === 0 && mainApiRankings.length === 0) {
          currentData.error = '获取排行榜失败';
      }
      
      // 添加标记，表示这个tab包含酷我榜单
      // if (kwRankings.length > 0) {
      //   currentData.hasKwRankings = true;
      // }

    } else if (tabId === 'mv') {
      // // console.log(`[PlaylistsView] fetchPlaylists (mv): Fetching MV list, page: ${Math.floor(currentData.offset / limit.value) + 1}`);
      let kwMVs = [];
      try {
        // // console.log(`[PlaylistsView] fetchPlaylists (mv): Attempting to fetch KW MVs.`);
        const kwResponse = await axios.get(`${KW_API_URL}`, {
          params: { id: '236742508', page: Math.floor(currentData.offset / limit.value) + 1, limit: limit.value, type: 'mvList' }
        });
        if (kwResponse?.data?.code === 200 && Array.isArray(kwResponse.data.data)) {
           // // console.log(`[PlaylistsView] fetchPlaylists (mv): Received ${kwResponse.data.data.length} MVs from KW API.`);
          kwMVs = kwResponse.data.data.map((item, index) => ({
            id: `kw_mv_${item.id || item.rid || index}`, name: item.name || '未知MV',
            coverImgUrl: convertHttpToHttps(item.pic || item.cover || defaultCoverUrl), playCount: item.playCount || 0,
            creator: { nickname: item.artist || '未知艺术家' }, isMV: true, isFromKw: true,
             _uniqueId: `kw-mv-${item.id || item.rid || index}-${Date.now()}`
          }));
        } else {
           // // console.log('[PlaylistsView] fetchPlaylists (mv): No data or invalid format from KW MV API.');
        }
      } catch (kwError) {
        console.error('[PlaylistsView] fetchPlaylists (mv): Error fetching KW MVs:', kwError);
      }

      let mainApiMVs = [];
      try {
        // // console.log(`[PlaylistsView] fetchPlaylists (mv): Attempting to fetch Main API MVs. Offset: ${currentData.offset}`);
        const apiResponse = await fetch(`${MV_API_BASE}/mv/all?limit=${limit.value}&offset=${currentData.offset}`);
        const responsePayload = await apiResponse.json();
        if (responsePayload?.code === 200 && Array.isArray(responsePayload.data)) {
           // // console.log(`[PlaylistsView] fetchPlaylists (mv): Received ${responsePayload.data.length} MVs from Main API.`);
          mainApiMVs = responsePayload.data.map(mv => ({
            id: `main_mv_${String(mv.id).trim()}`, name: mv.name || '未知MV',
            coverImgUrl: convertHttpToHttps(mv.cover || mv.imgurl16v9 || defaultCoverUrl), playCount: mv.playCount || 0,
            creator: { nickname: mv.artistName || mv.artist || '未知艺术家' }, isMV: true, isFromKw: false,
            _uniqueId: `mv-${String(mv.id).trim()}-${Date.now()}`
          }));
          currentData.hasMore = responsePayload.hasMore !== false && mainApiMVs.length >= limit.value;
        } else {
          // console.log('[PlaylistsView] fetchPlaylists (mv): No data or invalid format from Main API MV.');
          if(kwMVs.length === 0) currentData.hasMore = false;
        }
      } catch (mainApiError) {
        console.error('[PlaylistsView] fetchPlaylists (mv): Error fetching Main API MVs:', mainApiError);
         if(kwMVs.length === 0) currentData.error = '获取MV数据失败';
      }

      if (currentData.offset === 0) {
        currentData.playlists = [...kwMVs, ...mainApiMVs];
      } else {
        currentData.playlists = [...currentData.playlists, ...kwMVs, ...mainApiMVs];
      }
      // console.log(`[PlaylistsView] fetchPlaylists (mv): Combined MVs. KW: ${kwMVs.length}, Main: ${mainApiMVs.length}. Total: ${currentData.playlists.length}`);
      if (currentData.offset > 0 && kwMVs.length === 0 && mainApiMVs.length === 0) {
        currentData.hasMore = false;
      }
    }
    
    // 只有当首次加载 (offset === 0) 且成功获取到数据时，才更新缓存时间戳
    if (currentData.offset === 0 && currentData.playlists.length > 0) {
      localStorage.setItem(lastUpdateKey, Date.now().toString());
      // console.log(`[PlaylistsView] fetchPlaylists: Updated cache timestamp for tab ${tabId}, category ${currentCategory.value}`);
    }
    
    nextTick(() => setupIntersectionObserver());
  } catch (err) {
    console.error(`[PlaylistsView] fetchPlaylists: General error for tab ${tabId}, category ${currentCategory.value}:`, err);
    currentData.error = `获取${tabId}数据出错: ${err.message}`;
  } finally {
    currentData.loading = false;
    // console.log(`[PlaylistsView] fetchPlaylists: Finished for tab ${tabId}, category ${currentCategory.value}. Loading: ${currentData.loading}, HasMore: ${currentData.hasMore}, Playlists count: ${currentData.playlists.length}`);
  }
};

const loadMore = () => {
  const tabId = activeTab.value;
  if (tabId === 'mine') { // 'mine' tab 使用自己的加载更多
    loadMoreUserPlaylists();
    return;
  }
  const currentData = currentTabData.value;
  if (currentData.loading || !currentData.hasMore) return;
  currentData.offset += limit.value;
  fetchPlaylists(false, true); // true for forceReload on loadMore for non-mine tabs
};

const handlePlaylistClick = (playlist) => {
  if (!playlist || playlist.id === undefined || playlist.id === null) {
    console.error('错误: 点击了无效的项目', playlist);
    return;
  }
  const safeId = String(playlist.id).trim();
  if (!safeId) {
    console.error('错误: ID为空', playlist);
    return;
  }

  let navigationParams = {}; // 修改：使用对象来定义导航参数
  const playlistIdStr = safeId; // safeId 已经是 trim 过的字符串

  const isMV = activeTab.value === 'mv' || playlist.isMV;
  const isKwPlaylistSource = playlist.isFromKw || playlistIdStr.startsWith('kw_'); // playlist.isFromKw 优先
  const isRanking = playlist.isRanking || activeTab.value === 'ranking'; // 判断是否是排行榜

  if (isMV) {
    const mvId = playlistIdStr.startsWith('main_mv_') ? playlistIdStr.substring(8) :
                 (playlistIdStr.startsWith('kw_mv_') ? playlistIdStr.substring(6) : playlistIdStr);
    navigationParams = {
      name: 'mv-detail', // 假设MV详情页路由名为 'mv-detail'
      params: { id: mvId }
    };
    
    // 设置MV页面的来源标记
    let queryParams = { fromMV: 'true' }; // 添加来源标记
    
    // 如果是酷我MV，添加source参数
    if (playlist.isFromKw || playlistIdStr.startsWith('kw_mv_')) {
      queryParams.source = 'kw';
    }
    
    navigationParams.query = queryParams;
    console.log(`[PlaylistsView] 点击了MV，ID: ${mvId}, 准备导航至:`, navigationParams);
  } else if (isRanking && playlistIdStr.includes('kw_rank_')) {
    // 对于酷我榜单，直接使用完整ID
    navigationParams = {
      name: 'playlist-detail', // 使用歌单详情页面
      params: { id: playlistIdStr },
      query: { 
        source: 'kw', 
        isRanking: 'true', 
        fromRanking: 'true' // 添加来源为排行榜的标记
      }
    };
    console.log(`[PlaylistsView] 点击了酷我榜单，ID: ${playlistIdStr}, 准备导航至:`, navigationParams);
  } else if (isKwPlaylistSource) {
    // 对于酷我API的歌单，提取真实ID并传递isFromKw参数
    const realId = playlistIdStr.startsWith('kw_') ? playlistIdStr.substring(3) : playlistIdStr;
    
    // 构建查询参数
    let queryParams = { source: 'kw' };
    
    // 根据当前标签页添加来源标记
    if (activeTab.value === 'ranking') {
      queryParams.fromRanking = 'true';
      queryParams.isRanking = 'true';
    } else if (activeTab.value === 'mv') {
      queryParams.fromMV = 'true';
    } else if (activeTab.value === 'mine') {
      // 添加来源为"您的歌单"的标记
      queryParams.fromPlaylists = 'true';
      queryParams.fromMine = 'true'; // 添加mine标签的标识
    } else {
      queryParams.fromPlaylists = 'true'; // 默认从歌单列表页来
    }
    
    navigationParams = {
      name: 'playlist-detail', // 使用路由名称
      params: { id: realId },
      query: queryParams
    };
    console.log(`[PlaylistsView] 点击了酷我歌单，ID: ${realId}, 准备导航至:`, navigationParams);
  } else if (isRanking && playlistIdStr.startsWith('main_rank_')) {
    // 对于网易云排行榜，需要特殊处理
    // 从ID中提取真实的排行榜ID
    const realId = playlistIdStr.substring(10); // 去掉'main_rank_'前缀
    navigationParams = {
      name: 'playlist-detail', // 使用歌单详情页面
      params: { id: realId },
      query: { 
        isRanking: 'true',
        fromRanking: 'true' // 添加来源为排行榜的标记
      }
    };
    console.log(`[PlaylistsView] 点击了排行榜，ID: ${realId}, 准备导航至:`, navigationParams);
  } else {
    // 构建查询参数
    let queryParams = {};
    
    // 根据当前标签页添加来源标记
    if (activeTab.value === 'ranking') {
      queryParams.fromRanking = 'true';
      queryParams.isRanking = 'true';
    } else if (activeTab.value === 'mv') {
      queryParams.fromMV = 'true';
    } else if (activeTab.value === 'mine') {
      // 添加来源为"您的歌单"的标记
      queryParams.fromPlaylists = 'true';
      queryParams.fromMine = 'true'; // 添加mine标签的标识
    } else {
      queryParams.fromPlaylists = 'true'; // 默认从歌单列表页来
    }
    
    navigationParams = {
      name: 'playlist-detail', // 使用路由名称
      params: { id: playlistIdStr },
      query: queryParams
    };
    console.log(`[PlaylistsView] 点击了主API歌单，ID: ${playlistIdStr}, 准备导航至:`, navigationParams);
  }

  const scrollElement = findAlternativeScrollContainer('handlePlaylistClick');
  if (scrollElement) {
    const scrollTop = scrollElement.scrollTop.toString();
    const keyGeneral = 'scroll_pos_playlists_view_general';
    const keyTab = `scroll_pos_${activeTab.value}`;
    localStorage.setItem(keyGeneral, scrollTop);
    localStorage.setItem(keyTab, scrollTop);
    localStorage.setItem(`temp_scroll_${activeTab.value}`, scrollTop);
    console.log(`[PlaylistsView][handlePlaylistClick] 保存滚动位置. 通用键: ${keyGeneral}, 值: ${scrollTop}. 标签键: ${keyTab}, 值: ${scrollTop}`);
  }

  router.push(navigationParams); // 修改：使用构造好的对象进行导航
};

const setupIntersectionObserver = () => {
  const tabId = activeTab.value;
  if (tabId === 'mine') return; // 'mine' tab has its own observer

  const currentData = currentTabData.value;
  if (!currentData.hasMore || !loadMoreTrigger.value) {
    if (observer) observer.disconnect();
    return;
  }
  if (observer) observer.disconnect();
  observer = new IntersectionObserver((entries) => {
    const entry = entries[0];
    if (entry.isIntersecting && !currentData.loading && currentData.hasMore) {
      loadMore();
    }
  }, { rootMargin: '200px', threshold: 0.1 });
  observer.observe(loadMoreTrigger.value);
  // console.log(`[无限滚动] 为标签 ${tabId} 设置了交叉观察器`);
};

const changeTab = (tab) => {
  if (activeTab.value === tab) return;
  
  if (tab === 'favorites') {
    // 跳转到本地收藏页面
    router.push('/favorites');
    return;
  }
  
  router.push({ path: '/playlists', query: { tab } });
};

const isRestoringScroll = ref(false);

const findAlternativeScrollContainer = (caller = 'Unknown') => {
  // 优先使用 contentScrollRef
  if (contentScrollRef.value) {
    // // console.log(`[PlaylistsView][${caller}] findAlternativeScrollContainer: Using contentScrollRef`);
    return contentScrollRef.value;
  }
  // 备选 viewContainerRef
  if (viewContainerRef.value) {
    // // console.log(`[PlaylistsView][${caller}] findAlternativeScrollContainer: Using viewContainerRef (as fallback for contentScrollRef)`);
    return viewContainerRef.value;
  }
  console.warn(`[PlaylistsView][${caller}] findAlternativeScrollContainer: Refs (contentScrollRef, viewContainerRef) not found! Falling back to document.querySelector('.content-area')`);
  // 保留旧逻辑作为最后的备选，但理想情况下不应该执行到这里
  return document.querySelector('.content-area');
};

watch(() => route.query.tab, (newTabQuery, oldTabQuery) => {
  const newTab = newTabQuery || 'all';
  const oldTabActual = activeTab.value; 

  if (newTab === oldTabActual) {
    // // console.log(`[PlaylistsView][watch tab] Tab value (${newTab}) hasn't changed effectively.`);
    nextTick(() => {
        const scrollElement = findAlternativeScrollContainer('watch tab - same tab restore');
        if (scrollElement) {
            const keyForTab = `scroll_pos_${newTab}`;
            const keyGeneral = 'scroll_pos_playlists_view_general';
            const savedScrollForTab = localStorage.getItem(keyForTab);
            const savedScrollGeneral = localStorage.getItem(keyGeneral);
            // console.log(`[PlaylistsView][watch tab - same tab restore] Attempting restore. Tab key: ${keyForTab}, Value: ${savedScrollForTab}. General key: ${keyGeneral}, Value: ${savedScrollGeneral}`);
            const scrollPositionToRestore = savedScrollForTab || savedScrollGeneral;
            if (scrollPositionToRestore) {
                scrollElement.scrollTop = parseInt(scrollPositionToRestore, 10);
                // console.log(`[PlaylistsView][watch tab - same tab restore] Restored scroll for ${newTab} to: ${scrollPositionToRestore}px using key: ${savedScrollForTab ? keyForTab : keyGeneral}`);
            }
        }
    });
    return;
  }

  // console.log(`[PlaylistsView][watch tab] Tab changed from ${oldTabActual} to ${newTab}`);

  const scrollElementBeforeChange = findAlternativeScrollContainer('watch tab - save old');
  if (scrollElementBeforeChange) {
    const keyToSave = `scroll_pos_${oldTabActual}`;
    const scrollValueToSave = scrollElementBeforeChange.scrollTop.toString();
    localStorage.setItem(keyToSave, scrollValueToSave);
    // console.log(`[PlaylistsView][watch tab] Saved scroll for old tab ${oldTabActual} to key ${keyToSave}: ${scrollValueToSave}px`);
  }

  activeTab.value = newTab;
  
  // 检查是否是有效的tab，如果不是有效的tab则不进行后续处理
  const validTabs = ['all', 'mine', 'ranking', 'mv', 'favorites', 'playlists', 'songs', 'mvs', 'rankings', 'albums'];
  if (!validTabs.includes(newTab)) {
    console.error(`[PlaylistsView][watch tab] Invalid tab: ${newTab}`);
    return;
  }
  
  // 确保tabData中存在对应的tab数据
  if (!tabData.value[newTab]) {
    console.warn(`[PlaylistsView][watch tab] Creating missing tab data for ${newTab}`);
    tabData.value[newTab] = { playlists: [], offset: 0, hasMore: true, loading: false, error: null };
  }
  
  const currentTargetData = tabData.value[newTab];

  if ((!currentTargetData.playlists || currentTargetData.playlists.length === 0) && !currentTargetData.loading) {
    // console.log(`[PlaylistsView][watch tab] Fetching data for new tab ${newTab}`);
    fetchPlaylists();
  } else {
    // console.log(`[PlaylistsView][watch tab] New tab ${newTab} already has data or is loading. Setting up observer.`);
    nextTick(() => {
        if (newTab === 'mine') setupUserPlaylistsObserver();
        else setupIntersectionObserver();
    });
  }

  nextTick(() => {
    const scrollElementAfterChange = findAlternativeScrollContainer('watch tab - restore new');
    if (scrollElementAfterChange) {
      const keyForNewTab = `scroll_pos_${newTab}`;
      const keyGeneral = 'scroll_pos_playlists_view_general';
      const savedScrollForNewTab = localStorage.getItem(keyForNewTab);
      const savedScrollGeneral = localStorage.getItem(keyGeneral);
      // console.log(`[PlaylistsView][watch tab - restore new] Attempting restore for ${newTab}. Tab key: ${keyForNewTab}, Value: ${savedScrollForNewTab}. General key: ${keyGeneral}, Value: ${savedScrollGeneral}`);
      
      const scrollPositionToRestore = savedScrollForNewTab || savedScrollGeneral;

      if (scrollPositionToRestore) {
        scrollElementAfterChange.scrollTop = parseInt(scrollPositionToRestore, 10);
        // console.log(`[PlaylistsView][watch tab - restore new] Restored scroll for new tab ${newTab} to: ${scrollPositionToRestore}px using key: ${savedScrollForNewTab ? keyForNewTab : keyGeneral}`);
      } else {
        scrollElementAfterChange.scrollTop = 0;
        // console.log(`[PlaylistsView][watch tab - restore new] No saved scroll for ${newTab} or general, scrolling to top.`);
      }
    }
  });
}, { immediate: false }); // immediate: false, onActivated will handle initial state from route.

onMounted(() => {
  // console.log('[PlaylistsView] Component MOUNTED');
  const initialTabFromRoute = route.query.tab || 'all';
  activeTab.value = initialTabFromRoute;
  // console.log(`[PlaylistsView] MOUNTED - activeTab initialized to: ${activeTab.value}`);
  
  // Load initial data for the active tab
  const currentTabStore = tabData.value[activeTab.value];
  // 添加对 currentTabStore 是否存在的检查
  if (currentTabStore && (!currentTabStore.playlists || currentTabStore.playlists.length === 0) && !currentTabStore.loading) {
      fetchPlaylists();
  }
  fetchCategories(); // Categories are fetched once on mount.

  // Initialize sync status from localStorage
  const savedUserId = localStorage.getItem('netease_user_id');
  const savedUserInfo = localStorage.getItem('netease_user_info');
  if (savedUserId && savedUserInfo) {
    userIdInput.value = savedUserId;
    userInfo.value = JSON.parse(savedUserInfo);
    syncStatus.value = '已同步';
    if (activeTab.value === 'mine') {
      fetchPlaylists(); // Load user playlists if mine tab is active
    }
  }
});

onActivated(() => {
  // console.log('[PlaylistsView] Component ACTIVATED');
  const currentRouteTab = route.query.tab || 'all';
  activeTab.value = currentRouteTab;

  // console.log(`[PlaylistsView][onActivated] Current tab from route: ${currentRouteTab}`);

  // 确保tabData中存在对应的tab数据
  const validTabs = ['all', 'mine', 'ranking', 'mv', 'favorites', 'playlists', 'songs', 'mvs', 'rankings', 'albums'];
  if (!validTabs.includes(currentRouteTab)) {
    console.warn(`[PlaylistsView][onActivated] Invalid tab: ${currentRouteTab}, defaulting to 'all'`);
    activeTab.value = 'all';
  }
  
  if (!tabData.value[activeTab.value]) {
    console.warn(`[PlaylistsView][onActivated] Creating missing tab data for ${activeTab.value}`);
    tabData.value[activeTab.value] = { playlists: [], offset: 0, hasMore: true, loading: false, error: null };
  }

  nextTick(async () => {
    const currentTabStore = tabData.value[activeTab.value];
    // 添加对 currentTabStore 是否存在的检查
    if (currentTabStore) {
      // 检查是否有数据和缓存是否过期
      const hasData = currentTabStore.playlists && currentTabStore.playlists.length > 0;
      const lastUpdateKey = `last_update_${activeTab.value}_${currentCategory.value}`;
      const lastUpdate = localStorage.getItem(lastUpdateKey);
      const now = Date.now();
      const cacheExpired = !lastUpdate || (now - parseInt(lastUpdate, 10)) > 30 * 60 * 1000; // 30分钟缓存
      
      // 只有在没有数据或缓存过期的情况下才强制重新加载
      if (!hasData || cacheExpired) {
        console.log(`[PlaylistsView][onActivated] 缓存不存在或已过期，重新加载数据`);
        await fetchPlaylists(false, true); // 强制获取
      } else {
        console.log(`[PlaylistsView][onActivated] 使用缓存数据，上次更新时间: ${new Date(parseInt(lastUpdate, 10)).toLocaleString()}`);
        // 不重新加载，但确保设置观察器
        nextTick(() => {
          if (activeTab.value === 'mine') setupUserPlaylistsObserver();
          else setupIntersectionObserver();
        });
      }
    }

    const scrollElement = findAlternativeScrollContainer('onActivated:post-fetch');
    if (scrollElement) {
      const keyForTab = `scroll_pos_${currentRouteTab}`;
      const keyGeneral = 'scroll_pos_playlists_view_general';
      const savedScrollForTab = localStorage.getItem(keyForTab);
      const savedScrollGeneral = localStorage.getItem(keyGeneral);
      // console.log(`[PlaylistsView][onActivated:post-fetch] Attempting restore. Tab key: ${keyForTab}, Value: ${savedScrollForTab}. General key: ${keyGeneral}, Value: ${savedScrollGeneral}`);
      
      const scrollPositionToRestore = savedScrollForTab || savedScrollGeneral;

      if (scrollPositionToRestore) {
        scrollElement.scrollTop = parseInt(scrollPositionToRestore, 10);
        // console.log(`[PlaylistsView][onActivated:post-fetch] Restored scroll for ${currentRouteTab} to: ${scrollPositionToRestore}px using key: ${savedScrollForTab ? keyForTab : keyGeneral}`);
      } else {
        // console.log(`[PlaylistsView][onActivated:post-fetch] No specific or general scroll position found for ${currentRouteTab}. Scroll position remains as is or 0.`);
      }
    } else {
      console.warn('[PlaylistsView][onActivated:post-fetch] Scroll container not found during activation.');
    }

    if (activeTab.value === 'mine') {
      setupUserPlaylistsObserver();
    } else {
      setupIntersectionObserver();
    }
  });
});

onDeactivated(() => {
  // console.log('[PlaylistsView] Component DEACTIVATED');
  nextTick(() => { // Wrap in nextTick
    const scrollElement = findAlternativeScrollContainer('onDeactivated');
    if (scrollElement) {
      const currentScrollTop = scrollElement.scrollTop;
      const keyForTab = `scroll_pos_${activeTab.value}`;
      const keyGeneral = 'scroll_pos_playlists_view_general';
      
      localStorage.setItem(keyForTab, currentScrollTop.toString());
      localStorage.setItem(keyGeneral, currentScrollTop.toString());
      // console.log(`[PlaylistsView][onDeactivated] Saved scroll. Tab key: ${keyForTab}, Value: ${currentScrollTop}. General key: ${keyGeneral}, Value: ${currentScrollTop}`);
    } else {
      console.warn('[PlaylistsView][onDeactivated] Scroll container not found, cannot save scroll position.');
    }
    // Disconnect observers when component is deactivated
    if (observer) observer.disconnect();
    if (userPlaylistsObserver) userPlaylistsObserver.disconnect();
  });
});

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

</script>

<style scoped>
.playlists-view-container {
  padding: 10px 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto; /* 确保容器可滚动 */
  position: relative; /* 添加相对定位 */
}

.playlists-nav {
  display: flex;
  margin-bottom: 15px;
  align-items: center;
  position: sticky; /* 添加粘性定位 */
  top: 0; /* 固定在顶部 */
  z-index: 10; /* 确保在内容上层 */
  background-color: transparent; /* 完全透明 */
  padding: 0 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1); /* 只保留底部细线 */
}

.nav-tabs {
  display: flex;
  flex: 1;
  flex-wrap: nowrap; /* 确保不换行 */
}

.nav-tab {
  padding: 8px 15px;
  cursor: pointer;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  position: relative;
  text-align: center;
  white-space: nowrap; /* 防止文字换行 */
  transition: all 0.2s;
  background: transparent; /* 确保背景透明 */
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
  width: 30px; /* 固定宽度的下划线 */
  height: 2px;
  background-color: #fff; /* 纯白色下划线 */
}

/* 同步弹窗样式 */
.sync-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(5px);
}

.sync-dialog {
  background-color: rgba(255, 255, 255, 0.2); /* 更透明的白色背景 */
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.2); /* 添加细边框 */
  overflow: hidden;
  backdrop-filter: blur(15px); /* 添加毛玻璃效果 */
}

.sync-dialog-header {
  padding: 15px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sync-dialog-header h3 {
  margin: 0;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.9); /* 更白的文字颜色 */
}

.close-button {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.sync-dialog-body {
  padding: 20px;
}

.uid-input {
  width: 100%;
  padding: 10px 15px;
  background-color: rgba(255, 255, 255, 0.2); /* 更透明的白色背景 */
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 20px; /* 圆角更大 */
  color: white;
  font-size: 14px;
  outline: none;
  backdrop-filter: blur(5px); /* 添加毛玻璃效果 */
}

.uid-input:focus {
  border-color: rgba(255, 255, 255, 0.5);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
}

.sync-dialog-footer {
  padding: 15px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.confirm-button, .cancel-button, .help-button {
  padding: 8px 15px;
  border-radius: 20px; /* 圆角更大 */
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.confirm-button {
  background-color: rgba(255, 255, 255, 0.3); /* 更透明的白色背景 */
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  backdrop-filter: blur(5px); /* 添加毛玻璃效果 */
}

.confirm-button:hover {
  background-color: rgba(255, 255, 255, 0.4); /* 悬停时更白一点 */
}

.cancel-button {
  background-color: transparent;
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 0.9);
}

.cancel-button:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.help-button {
  background-color: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.8);
}

.help-button:hover {
  text-decoration: underline;
  color: white;
}

/* 分类选择器样式 */
.category-selector {
  padding: 0 20px;
  margin-bottom: 15px;
  position: relative;
}

.current-category {
  display: inline-flex;
  align-items: center;
  padding: 5px 15px;
  background-color: rgba(255, 255, 255, 0.2); /* 更透明的白色背景 */
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9); /* 更白的文字颜色 */
  backdrop-filter: blur(5px); /* 添加模糊效果 */
  border: 1px solid rgba(255, 255, 255, 0.2); /* 添加细边框 */
  transition: all 0.2s ease;
}

.current-category:hover {
  background-color: rgba(255, 255, 255, 0.3); /* 悬停时稍微更白一点 */
}

.current-category .arrow {
  margin-left: 8px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.8);
}

.category-dropdown {
  position: absolute;
  top: 40px;
  left: 20px;
  width: calc(100% - 40px);
  background-color: rgba(40, 40, 40, 0.8); /* 修改为更深的背景色 */
  border-radius: 12px;
  padding: 15px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 100;
  max-height: 400px;
  overflow-y: auto;
  backdrop-filter: blur(15px); /* 添加模糊效果 */
  border: 1px solid rgba(255, 255, 255, 0.2); /* 添加细边框 */
}

.category-group {
  margin-bottom: 15px;
}

.group-name {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 8px;
}

.group-items {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.category-item {
  padding: 4px 12px;
  background-color: rgba(60, 60, 60, 0.6); /* 修改分类项的背景色 */
  border-radius: 15px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.category-item:hover {
  background-color: rgba(80, 80, 80, 0.7); /* 修改悬停时的背景色 */
}

.category-item.active {
  background-color: rgba(100, 100, 100, 0.8); /* 修改选中时的背景色 */
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.playlists-content {
  flex: 1;
  overflow-y: auto; /* 允许内容区域滚动 */
  padding: 0 20px 100px 20px; /* 增加底部内边距，确保内容可以滚动到底部 */
  -webkit-overflow-scrolling: touch; /* 在iOS上改善滚动体验 */
  height: calc(100% - 50px); /* 减去导航栏高度 */
  position: relative; /* 添加相对定位 */
}

.playlists-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); /* 减小卡片最小宽度 */
  gap: 12px; /* 减小间距 */
  padding-bottom: 20px;
}

.playlist-card {
  cursor: pointer;
  transition: transform 0.2s;
}

.playlist-card:hover {
  transform: translateY(-3px); /* 减小悬停效果 */
}

.playlist-cover {
  position: relative;
  width: 100%;
  padding-top: 100%; /* 1:1 宽高比 */
  border-radius: 6px; /* 减小圆角 */
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
  font-size: 10px; /* 减小字体 */
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
  font-size: 12px; /* 减小字体 */
  margin: 0 0 3px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.playlist-creator {
  font-size: 10px; /* 减小字体 */
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

.loading-indicator {
  text-align: center;
  padding: 15px 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
}

.load-more-trigger {
  display: flex;
  justify-content: center;
  padding: 20px 0;
  min-height: 60px;
  width: 100%; /* 确保宽度为100% */
  position: relative; /* 添加相对定位 */
  z-index: 5; /* 确保在适当的层级 */
}

.load-more-button {
  background-color: transparent;
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 8px 20px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.load-more-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.5);
}

/* 加载中弹窗样式 */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(5px);
}

.loading-container {
  background-color: rgba(255, 255, 255, 0.2); /* 更透明的白色背景 */
  border-radius: 12px;
  padding: 20px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.2); /* 添加细边框 */
  backdrop-filter: blur(15px); /* 添加毛玻璃效果 */
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  color: white;
  font-size: 16px;
}

/* 用户歌单空状态样式 */
.mine-empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 60vh;
  text-align: center;
}

.sync-button-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.big-sync-button {
  background-color: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 15px 30px;
  font-size: 18px;
  border-radius: 30px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
}

.big-sync-button:hover {
  background-color: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

.big-sync-button .sync-icon {
  font-size: 20px;
  margin-right: 8px;
}

.sync-tip {
  margin-top: 15px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
}

/* 用户信息横幅 */
.user-info-banner {
  display: flex;
  align-items: center;
  padding: 15px 20px;
  margin-bottom: 20px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  backdrop-filter: blur(10px);
}

.user-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  overflow: hidden;
  margin-right: 15px;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-details {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.user-nickname {
  font-size: 18px;
  margin: 0 0 8px 0;
  color: white;
}

.user-actions {
  display: flex;
  gap: 10px;
}

.user-action-button {
  background-color: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 5px 10px;
  font-size: 12px;
  border-radius: 15px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
}

.user-action-button:hover {
  background-color: rgba(255, 255, 255, 0.3);
}

.user-action-button .sync-icon {
  margin-right: 5px;
  font-size: 12px;
}

/* 同步按钮图标和动画 */
.sync-icon {
  font-style: normal;
  margin-right: 3px;
  font-size: 14px;
  display: inline-block;
  transform: rotate(0deg);
  transition: transform 0.3s;
}

.rotating {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 帮助弹窗样式 */
.help-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1100; /* 确保显示在同步弹窗之上 */
  backdrop-filter: blur(5px);
}

.help-dialog {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  width: 90%;
  max-width: 450px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.2);
  overflow: hidden;
  backdrop-filter: blur(15px);
}

.help-dialog-header {
  padding: 15px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.help-dialog-header h3 {
  margin: 0;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.9);
}

.help-dialog-body {
  padding: 20px;
  max-height: 70vh;
  overflow-y: auto;
}

.help-steps {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.help-step {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  line-height: 1.5;
  display: flex;
  align-items: flex-start;
}

.step-number {
  font-weight: bold;
  margin-right: 5px;
}

.help-link {
  color: #ffcc00;
  text-decoration: none;
  margin: 0 5px;
}

.help-link:hover {
  text-decoration: underline;
}

.highlight {
  background-color: rgba(255, 0, 0, 0.2);
  padding: 2px 4px;
  border-radius: 3px;
  margin: 0 3px;
  color: #ff6b6b;
}

.help-dialog-footer {
  padding: 15px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  justify-content: center;
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

/* 排行榜特殊样式 */
.playlist-card.is-ranking .playlist-cover::after {
  content: '榜单';
  position: absolute;
  top: 0;
  left: 0;
  background-color: rgba(255, 0, 0, 0.7);
  color: white;
  padding: 2px 6px;
  font-size: 10px;
  border-radius: 0 0 4px 0;
}

/* 酷我榜单特殊样式 */
.playlist-card.is-kw-ranking {
  transform: none;
  margin: 0;
  position: relative;
}

.playlist-card.is-kw-ranking .playlist-cover {
  transform: none;
  margin: 0;
  border: 1px solid rgba(255, 0, 0, 0.2);
  position: relative;
  overflow: hidden;
  width: 100%;
  height: auto;
}

.playlist-card.is-kw-ranking:hover .playlist-cover {
  border-color: rgba(255, 0, 0, 0.4);
  box-shadow: 0 2px 8px rgba(255, 0, 0, 0.2);
}

/* 调整酷我榜单文字样式 */
.playlist-card.is-kw-ranking .playlist-cover img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  aspect-ratio: 1/1;
  padding: 0;
}

.playlist-card.is-kw-ranking .playlist-name {
  font-size: 14px;
  font-weight: bold;
  margin-top: 5px;
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
  line-height: 1.2;
  height: auto;
  max-height: 2.4em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.playlist-card.is-kw-ranking .playlist-creator {
  margin-top: 2px;
  font-size: 11px;
}

.playlist-card.is-kw-ranking .playlist-cover::after {
  content: '酷我';
  background-color: rgba(255, 0, 0, 0.8);
  position: absolute;
  top: 0;
  left: 0;
  padding: 2px 6px;
  font-size: 10px;
  border-radius: 0 0 4px 0;
}

/* 排行榜更新频率样式 */
.playlist-creator.update-frequency {
  color: #ff7070;
  font-size: 10px;
}

/* 刷新歌单加载中覆盖层样式 */
.refresh-loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.2); /* 降低背景不透明度 */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(3px); /* 减少模糊效果 */
}

.refresh-loading-overlay .loading-spinner {
  width: 50px;
  height: 50px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 0.8s linear infinite;
}

/* 移除重复的动画定义，因为已经在其他地方定义了 */
/*
@keyframes spin {
  to { transform: rotate(360deg); }
}
*/

.back-to-all {
  display: inline-block;
  margin-left: 15px;
  padding: 5px 12px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.back-to-all:hover {
  background-color: rgba(255, 255, 255, 0.2);
}
</style> 