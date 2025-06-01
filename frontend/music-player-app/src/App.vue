<script setup>
import { RouterView, useRoute, useRouter } from 'vue-router';
import PlayerControls from './components/PlayerControls.vue'; // 稍后创建
import TopNavBar from './components/TopNavBar.vue'; // <--- 替换 AppHeader
import LyricsView from './views/LyricsView.vue'; // 导入 LyricsView
import { usePlayerStore } from './stores/player';
import { onMounted, ref, watch, onUnmounted, nextTick, onBeforeMount, computed } from 'vue';
import BubblesVue from './components/BubblesVue.vue'
import ClickEffect from './components/ClickEffect.vue'
import OptimizedImage from './components/OptimizedImage.vue'
import BackgroundSelector from './components/BackgroundSelector.vue'
import * as dataCache from './stores/dataCache';
// 导入背景图片
import bg1Original from './assets/images/backgrounds/bz1.jpg';
import bg1Webp from './assets/images/backgrounds/bz1.webp';
import bg1Compressed from './assets/images/backgrounds/bz1-compressed.jpg';

// 导入更多背景图片
import pic1Original from './assets/images/backgrounds/pic_20250529193319_3gbizhi.jpg';
import pic1Webp from './assets/images/backgrounds/pic_20250529193319_3gbizhi.webp';
import pic1Compressed from './assets/images/backgrounds/pic_20250529193319_3gbizhi-compressed.jpg';

import pic2Original from './assets/images/backgrounds/pic_20250529193359_3gbizhi.jpg';
import pic2Webp from './assets/images/backgrounds/pic_20250529193359_3gbizhi.webp';
import pic2Compressed from './assets/images/backgrounds/pic_20250529193359_3gbizhi-compressed.jpg';

import pic3Original from './assets/images/backgrounds/pic_20250529193414_3gbizhi.jpg';
import pic3Webp from './assets/images/backgrounds/pic_20250529193414_3gbizhi.webp';
import pic3Compressed from './assets/images/backgrounds/pic_20250529193414_3gbizhi-compressed.jpg';

import pic4Original from './assets/images/backgrounds/pic_20250529193431_3gbizhi.jpg';
import pic4Webp from './assets/images/backgrounds/pic_20250529193431_3gbizhi.webp';
import pic4Compressed from './assets/images/backgrounds/pic_20250529193431_3gbizhi-compressed.jpg';

// 导入更多背景图片
import pic5Original from './assets/images/backgrounds/pic_20250529193651_3gbizhi.jpg';
import pic5Webp from './assets/images/backgrounds/pic_20250529193651_3gbizhi.webp';
import pic5Compressed from './assets/images/backgrounds/pic_20250529193651_3gbizhi-compressed.jpg';

import pic6Original from './assets/images/backgrounds/pic_20250529193724_3gbizhi.jpg';
import pic6Webp from './assets/images/backgrounds/pic_20250529193724_3gbizhi.webp';
import pic6Compressed from './assets/images/backgrounds/pic_20250529193724_3gbizhi-compressed.jpg';

import pic7Original from './assets/images/backgrounds/pic_20250529202025_3gbizhi.jpg';
import pic7Webp from './assets/images/backgrounds/pic_20250529202025_3gbizhi.webp';
import pic7Compressed from './assets/images/backgrounds/pic_20250529202025_3gbizhi-compressed.jpg';

import pic8Original from './assets/images/backgrounds/pic_20250529210606_3gbizhi.jpg';
import pic8Webp from './assets/images/backgrounds/pic_20250529210606_3gbizhi.webp';
import pic8Compressed from './assets/images/backgrounds/pic_20250529210606_3gbizhi-compressed.jpg';

import pic9Original from './assets/images/backgrounds/pic_20250529210736_3gbizhi.jpg';
import pic9Webp from './assets/images/backgrounds/pic_20250529210736_3gbizhi.webp';
import pic9Compressed from './assets/images/backgrounds/pic_20250529210736_3gbizhi-compressed.jpg';

import pic10Original from './assets/images/backgrounds/pic_20250529210822_3gbizhi.jpg';
import pic10Webp from './assets/images/backgrounds/pic_20250529210822_3gbizhi.webp';
import pic10Compressed from './assets/images/backgrounds/pic_20250529210822_3gbizhi-compressed.jpg';

import pic11Original from './assets/images/backgrounds/pic_20250529210914_3gbizhi.jpg';
import pic11Webp from './assets/images/backgrounds/pic_20250529210914_3gbizhi.webp';
import pic11Compressed from './assets/images/backgrounds/pic_20250529210914_3gbizhi-compressed.jpg';

import pic12Original from './assets/images/backgrounds/pic_20250529210937_3gbizhi.jpeg';
import pic12Webp from './assets/images/backgrounds/pic_20250529210937_3gbizhi.webp';
import pic12Compressed from './assets/images/backgrounds/pic_20250529210937_3gbizhi-compressed.jpg';

import pic13Original from './assets/images/backgrounds/pic_20250529210958_3gbizhi.jpg';
import pic13Webp from './assets/images/backgrounds/pic_20250529210958_3gbizhi.webp';
import pic13Compressed from './assets/images/backgrounds/pic_20250529210958_3gbizhi-compressed.jpg';

import pic14Original from './assets/images/backgrounds/pic_20250525163246_3gbizhi.png';
import pic14Webp from './assets/images/backgrounds/pic_20250525163246_3gbizhi.webp';
import pic14Compressed from './assets/images/backgrounds/pic_20250525163246_3gbizhi-compressed.jpg';

import pic15Original from './assets/images/backgrounds/pic_20250525163321_3gbizhi.jpg';
import pic15Webp from './assets/images/backgrounds/pic_20250525163321_3gbizhi.webp';
import pic15Compressed from './assets/images/backgrounds/pic_20250525163321_3gbizhi-compressed.jpg';

const availableBackgrounds = [
  {
    id: 'bz1',
    name: '默认背景',
    original: bg1Original,
    webp: bg1Webp,
    compressed: bg1Compressed,
  },
  {
    id: 'pic1',
    name: '星空',
    original: pic1Original,
    webp: pic1Webp,
    compressed: pic1Compressed,
  },
  {
    id: 'pic2',
    name: '宇宙',
    original: pic2Original,
    webp: pic2Webp,
    compressed: pic2Compressed,
  },
  {
    id: 'pic3',
    name: '山水',
    original: pic3Original,
    webp: pic3Webp,
    compressed: pic3Compressed,
  },
  {
    id: 'pic4',
    name: '森林',
    original: pic4Original,
    webp: pic4Webp,
    compressed: pic4Compressed,
  },
  {
    id: 'pic5',
    name: '极光',
    original: pic5Original,
    webp: pic5Webp,
    compressed: pic5Compressed,
  },
  {
    id: 'pic6',
    name: '海洋',
    original: pic6Original,
    webp: pic6Webp,
    compressed: pic6Compressed,
  },
  {
    id: 'pic7',
    name: '日落',
    original: pic7Original,
    webp: pic7Webp,
    compressed: pic7Compressed,
  },
  {
    id: 'pic8',
    name: '城市',
    original: pic8Original,
    webp: pic8Webp,
    compressed: pic8Compressed,
  },
  {
    id: 'pic9',
    name: '银河',
    original: pic9Original,
    webp: pic9Webp,
    compressed: pic9Compressed,
  },
  {
    id: 'pic10',
    name: '云海',
    original: pic10Original,
    webp: pic10Webp,
    compressed: pic10Compressed,
  },
  {
    id: 'pic11',
    name: '星轨',
    original: pic11Original,
    webp: pic11Webp,
    compressed: pic11Compressed,
  },
  {
    id: 'pic12',
    name: '夜景',
    original: pic12Original,
    webp: pic12Webp,
    compressed: pic12Compressed,
  },
  {
    id: 'pic13',
    name: '梦幻',
    original: pic13Original,
    webp: pic13Webp,
    compressed: pic13Compressed,
  },
  {
    id: 'pic14',
    name: '抽象',
    original: pic14Original,
    webp: pic14Webp,
    compressed: pic14Compressed,
  },
  {
    id: 'pic15',
    name: '自然',
    original: pic15Original,
    webp: pic15Webp,
    compressed: pic15Compressed,
  },
];

const currentBgId = ref(localStorage.getItem('currentBackgroundId') || availableBackgrounds[0].id);

// 背景选择器对话框显示状态
const showBackgroundSelector = ref(false);

const currentBackground = computed(() => {
  const found = availableBackgrounds.find(bg => bg.id === currentBgId.value);
  return found || availableBackgrounds[0]; // 如果没找到，则使用第一个作为默认
});

// 背景图片加载状态
const bgImageLoaded = ref(false);
const handleImageLoaded = (payload) => {
  // console.log('[App.vue] OptimizedImage emitted load event. Image src:', payload.src);
  bgImageLoaded.value = true;
};

// 全局滚动恢复标记，可以被其他组件访问
window._isRestoringScroll = false;

// 导航历史记录
window._navigationHistory = window._navigationHistory || [];

const playerStore = usePlayerStore();
const route = useRoute();
const router = useRouter();

// 滚动记忆存储
const scrollPositions = ref({
  playlist: 0,      // 播放列表
  search: 0,        // 搜索页面
  playlists: 0,     // 歌单列表
  playlistDetail: 0, // 歌单详情
  ranking: 0,       // 排行榜页面
  mv: 0             // MV页面
});

// 当前页面类型
const currentView = ref('playlist');

// 滚动事件防抖定时器
let scrollDebounceTimer = null;

// 定期保存滚动位置的计时器
let autoSaveTimer = null;

// 视图到路径的映射
const viewToPathPattern = {
  playlist: ['/', '/playlist-display'],
  search: ['/search'],  // 搜索页面返回独立的视图类型
  playlists: ['/playlists'],
  playlistDetail: ['/playlist/'],
  ranking: ['/ranking'],   // 新增排行榜页面
  mv: ['/mv'],            // 新增MV页面
  favorites: ['/favorites'] // 收藏页面
};

// 路径到视图的映射
function getViewFromPath(fullPath) {
  // 检查是否包含查询参数，如果有，提取基本路径和查询参数
  const [basePath, queryString] = fullPath.split('?');
  const params = new URLSearchParams(queryString || '');
  const tab = params.get('tab');
  const isRanking = params.get('isRanking') === 'true'; // 检查是否是排行榜详情
  const isFromSearch = params.get('fromSearch') === 'true'; // 检查是否来自搜索
  const isFromFavorites = params.get('fromFavorites') === 'true'; // 检查是否来自收藏
  const isFromMV = params.get('fromMV') === 'true'; // 检查是否来自MV页面
  const isFromRanking = params.get('fromRanking') === 'true'; // 检查是否来自排行榜
  
  // 获取更多搜索和收藏相关参数
  const keyword = params.get('keyword'); // 搜索关键词
  const searchType = params.get('searchType'); // 搜索类型
  const favoriteTab = params.get('favoriteTab'); // 收藏标签页
    
  console.log(`[App.vue] getViewFromPath 分析路径: ${fullPath}, 参数:`, {
    tab, isRanking, isFromSearch, isFromFavorites, isFromMV, isFromRanking,
    keyword, searchType, favoriteTab // 添加更多参数到日志
  });
    
  // 根据基本路径和tab参数确定视图类型
  if (basePath === '/' || basePath === '/playlist-display') return 'playlist';
  if (basePath.startsWith('/search')) return 'search';
  if (basePath.startsWith('/favorites')) return 'favorites';
  
  // 处理歌单页面的不同标签
  if (basePath === '/playlists') {
    // 检查tab参数
    if (tab === 'ranking') {
      return 'ranking';
    }
    
    if (tab === 'mv') {
      return 'mv';
    }
    
    if (tab === 'mine') {
      return 'mine';
    }
    
    // 没有指定tab或tab为all时，返回playlists
    return 'playlists';
  }
  
  // 处理歌单详情页
  if (basePath.startsWith('/playlist/')) {
    // 检查是否来自搜索
    if (isFromSearch) {
      console.log('[App.vue] 歌单详情页来自搜索，返回search，搜索关键词:', keyword, '搜索类型:', searchType);
      return 'search';
    }
    
    // 检查是否来自收藏页
    if (isFromFavorites) {
      console.log('[App.vue] 歌单详情页来自收藏，返回favorites，收藏标签页:', favoriteTab);
      return 'favorites';
    }
    
    // 检查是否来自排行榜
    if (isFromRanking || isRanking) {
      console.log('[App.vue] 歌单详情页来自排行榜，返回ranking');
      return 'ranking';
    }
    
    // 检查是否来自MV页面
    if (isFromMV) {
      console.log('[App.vue] 歌单详情页来自MV页面，返回mv');
      return 'mv';
    }
    
    // 默认返回歌单详情视图
    return 'playlistDetail';
  }
  
  // 处理MV详情页
  if (basePath.startsWith('/mv/')) {
    // 检查是否来自搜索
    if (isFromSearch) {
      console.log('[App.vue] MV详情页来自搜索，返回search，搜索关键词:', keyword, '搜索类型:', searchType);
      return 'search';
    }
    
    // 检查是否来自收藏页
    if (isFromFavorites) {
      console.log('[App.vue] MV详情页来自收藏，返回favorites，收藏标签页:', favoriteTab);
      return 'favorites';
    }
    
    // 默认返回MV视图
    return 'mv';
  }
  
  // 处理专辑详情页
  if (basePath.startsWith('/album/')) {
    // 检查是否是来自搜索
    if (isFromSearch) {
      console.log('[App.vue] 专辑详情页来自搜索，返回search，搜索关键词:', keyword, '搜索类型:', searchType);
      return 'search';
    }
    
    // 检查是否来自收藏页
    if (isFromFavorites) {
      console.log('[App.vue] 专辑详情页来自收藏，返回favorites，收藏标签页:', favoriteTab);
      return 'favorites';
    }
    
    // 默认返回播放列表视图
    return 'playlist';
  }
  
  return 'unknown';
}

/**
 * 获取当前可滚动区域元素
 */
function getScrollableElement() {
  return document.querySelector('.content-area');
}

/**
 * 保存当前滚动位置
 */
function saveCurrentScrollPosition(forceSaveToStorage = false) {
  const scrollElement = getScrollableElement();
  if (!scrollElement) {
    return;
  }
  
  const scrollTop = Math.max(0, scrollElement.scrollTop);
  const view = currentView.value;
  
  if (scrollPositions.value[view] !== scrollTop) {
    const oldScrollTop = scrollPositions.value[view];
    scrollPositions.value[view] = scrollTop;
    
    // 强制保存到本地存储
    if (forceSaveToStorage) {
      saveToLocalStorage();
    }
  }
}

/**
 * 将滚动位置保存到本地存储
 */
function saveToLocalStorage() {
  try {
    localStorage.setItem('scrollPositions', JSON.stringify(scrollPositions.value));
  } catch (e) {
    console.error('[滚动位置] 保存到本地存储失败:', e);
  }
}

/**
 * 从本地存储加载滚动位置
 */
function loadFromLocalStorage() {
  try {
    // const saved = localStorage.getItem('scrollPositions');
    // if (saved) {
    //   const positions = JSON.parse(saved);
    //   for (const [key, value] of Object.entries(positions)) {
    //     scrollPositions.value[key] = value;
    //   }
    // }
  } catch (e) {
    console.error('[滚动位置] 从本地存储加载失败:', e);
  }
}

/**
 * 恢复指定视图的滚动位置
 */
function restoreScrollPosition(view, maxAttempts = 10) {
  const scrollElement = getScrollableElement();
  if (!scrollElement) {
    return;
  }
  
  const targetScroll = scrollPositions.value[view];
  
  if (targetScroll <= 0) {
    return;
  }
  
  // 创建一个变量，标记是否在恢复滚动中，避免同时触发其他滚动事件
  window._isRestoringScroll = true;
  
  // 丝滑滚动恢复方法
  function smoothRestoreScroll() {
    // 临时禁用滚动动画
    const originalScrollBehavior = scrollElement.style.scrollBehavior;
    scrollElement.style.scrollBehavior = 'auto';
    
    // 临时隐藏内容，使用visibility而不是display，避免布局变化
    scrollElement.style.visibility = 'hidden';
    
    // 立即设置滚动位置
    scrollElement.scrollTop = targetScroll;
    
    // 在下一帧恢复可见性和滚动行为
    requestAnimationFrame(() => {
      // 确保滚动位置已应用
      scrollElement.scrollTop = targetScroll;
      
      // 延迟一帧再恢复可见性，确保滚动位置已经生效
      requestAnimationFrame(() => {
        scrollElement.style.visibility = 'visible';
        scrollElement.style.scrollBehavior = originalScrollBehavior;
        
        // 重置标记
        setTimeout(() => {
          window._isRestoringScroll = false;
        }, 50);
      });
    });
  }
  
  // 使用丝滑滚动恢复
  setTimeout(() => {
    smoothRestoreScroll();
  }, 50);
}

// 完整的路由监听函数，监听path和fullPath
watch([() => route.fullPath], ([newFullPath], [oldFullPath]) => {
  if (!oldFullPath) return; // 忽略初始化
  
  // 判断是否是从歌单页面返回播放页面
  const oldView = getViewFromPath(oldFullPath);
  const newView = getViewFromPath(newFullPath);
  
  console.log(`[App.vue] 路由变化: ${oldFullPath} (${oldView}) -> ${newFullPath} (${newView})`);
  
  // 保存导航历史
  window._navigationHistory.push({
    from: oldFullPath,
    to: newFullPath,
    fromView: oldView,
    toView: newView,
    timestamp: Date.now()
  });
  
  // 如果历史记录太长，清理旧记录
  if (window._navigationHistory.length > 20) {
    window._navigationHistory = window._navigationHistory.slice(-20);
  }
  
  // 解析查询参数，判断导航来源
  const [oldBasePath, oldQueryString] = oldFullPath.split('?');
  const oldParams = new URLSearchParams(oldQueryString || '');
  const oldFromSearch = oldParams.get('fromSearch') === 'true';
  const oldFromFavorites = oldParams.get('fromFavorites') === 'true';
  const oldFromRanking = oldParams.get('fromRanking') === 'true';
  const oldFromMV = oldParams.get('fromMV') === 'true';
  
  const [newBasePath, newQueryString] = newFullPath.split('?');
  const newParams = new URLSearchParams(newQueryString || '');
  const newFromSearch = newParams.get('fromSearch') === 'true';
  const newFromFavorites = newParams.get('fromFavorites') === 'true';
  const newFromRanking = newParams.get('fromRanking') === 'true';
  const newFromMV = newParams.get('fromMV') === 'true';
  
  // 判断是否有特殊返回逻辑
  const isDetailToSource = 
    // 从歌单详情页返回
    ((oldBasePath.startsWith('/playlist/') || oldBasePath.startsWith('/album/') || oldBasePath.startsWith('/mv/')) && 
    // 返回到原来的页面类型
    ((oldFromSearch && newBasePath === '/search') || 
     (oldFromFavorites && newBasePath === '/favorites') ||
     (oldFromRanking && newBasePath.startsWith('/playlists') && newParams.get('tab') === 'ranking') ||
     (oldFromMV && newBasePath.startsWith('/playlists') && newParams.get('tab') === 'mv')));
  
  if (isDetailToSource) {
    console.log('[App.vue] 检测到从详情页返回到源页面');
    // 应当恢复之前保存的滚动位置
    const sourceScrollKey = oldFromSearch ? 'scroll_pos_search' :
                           oldFromFavorites ? 'scroll_pos_favorites' :
                           oldFromRanking ? 'scroll_pos_ranking' :
                           oldFromMV ? 'scroll_pos_mv' : null;
    
    if (sourceScrollKey) {
      const savedScrollPos = localStorage.getItem(sourceScrollKey) ||
                            localStorage.getItem(`temp_scroll_${oldView}`);
      
      if (savedScrollPos) {
        console.log(`[App.vue] 准备恢复${oldView}页面的滚动位置: ${savedScrollPos}`);
        // 更新滚动位置缓存
        scrollPositions.value[newView] = parseInt(savedScrollPos, 10);
        // 保存到本地存储以便后续使用
        saveToLocalStorage();
      }
    }
  }
  
  // 检测从搜索页面返回播放页面的情况
  const isFromSearchToPlayerView = oldBasePath.includes('/search') && newBasePath === '/';
  
  if (isFromSearchToPlayerView) {
    console.log('[App.vue] 从搜索页面返回播放页面，设置防止自动播放标记');
    // 设置标记，防止自动播放搜索结果中的歌曲
    localStorage.setItem('preventAutoPlayFromSearch', 'true');
    
    // 延迟清除标记
    setTimeout(() => {
      localStorage.removeItem('preventAutoPlayFromSearch');
    }, 3000);
  }
  
  const isFromPlaylistToPlayerView = 
    (oldView === 'playlistDetail' || oldView === 'playlists' || oldView === 'ranking' || oldView === 'mv') && 
    (newView === 'playlist');
  
  if (isFromPlaylistToPlayerView) {
    console.log('[App.vue] 从歌单页面返回播放页面，保持播放状态');
    // 记录特殊标志，表示不要重新加载数据
    window._preventDataReload = true;
    
    // 清除搜索结果缓存，确保不会在播放页面显示搜索结果
    playerStore.lastSearchKeyword = null;
    
    // 使用replaceState替代pushState，防止页面重新加载
    const currentPath = window.location.pathname;
    if (currentPath === '/') {
      // window.history.replaceState(null, '', '/'); // <--- 注释掉或移除这一行
      
      // 确保当前歌曲继续播放
      setTimeout(() => {
        if (playerStore.currentSong && playerStore.isPlaying) {
          const audio = document.querySelector('audio');
          if (audio && audio.paused) {
            audio.play().catch(() => {});
          }
        }
      }, 100);
      
      return; // 直接返回，不执行后续的滚动恢复等操作
    }
  }
  
  // 保存离开页面的滚动位置
  if (oldView !== 'unknown') {
    // 检查是否有保存的临时滚动位置
    const tempScrollKey = `temp_scroll_${oldView}`;
    const scrollPosKey = `scroll_pos_${oldView}`;
    const tempScrollPos = localStorage.getItem(tempScrollKey) || localStorage.getItem(scrollPosKey);
    
    if (tempScrollPos) {
      const scrollTop = parseInt(tempScrollPos, 10);
      console.log(`[App.vue] 获取到临时保存的滚动位置 ${oldView}: ${scrollTop}`);
      
      // 更新scrollPositions中的值
      scrollPositions.value[oldView] = scrollTop;
      
      // 不要立即清除临时存储，延迟清除，确保其他地方有机会使用
      setTimeout(() => {
        // localStorage.removeItem(tempScrollKey);
        // console.log(`[App.vue] 保留临时滚动位置，不立即清除`);
      }, 100);
      
      // 强制保存到本地存储
      saveToLocalStorage();
    } else {
      // 正常保存当前滚动位置
      saveCurrentScrollPosition(true);
    }
  }
  
  // 更新当前视图
  currentView.value = newView;
      
  // 检查是否是从搜索页面返回播放页面（应该保持搜索页面的滚动位置）
  const isSearchToPlaylist = oldFullPath.startsWith('/search') && newFullPath === '/';
  
  // 检查是否从其他页面返回播放页面
  const isOtherToPlaylist = (oldView !== 'playlist' && oldView !== 'unknown') && newView === 'playlist';
  
  // 在下一个 tick 恢复滚动位置
  nextTick(() => {
    // 给页面内容一点时间渲染
    setTimeout(() => {
      if (newView !== 'unknown') {
        // 如果是从搜索页面或其他页面返回播放页面，使用对应页面的滚动位置
        if (isSearchToPlaylist || isOtherToPlaylist) {
          const scrollElement = getScrollableElement();
          if (scrollElement) {
            // 根据来源页面选择合适的滚动位置
            let scrollPos = 0;
            
            if (isSearchToPlaylist) {
              // 先尝试从localStorage读取保存的搜索页面滚动位置
              const savedSearchScroll = localStorage.getItem('lastSearchScrollPosition') || 
                                       localStorage.getItem('temp_scroll_search') ||
                                       localStorage.getItem('scroll_pos_search');
              if (savedSearchScroll) {
                scrollPos = parseInt(savedSearchScroll, 10);
                console.log(`[App.vue] 从搜索页面返回，恢复滚动位置: ${scrollPos}`);
              } else {
                // 如果没有找到保存的值，则使用最后记录的搜索页面滚动位置
                scrollPos = scrollPositions.value.search;
                console.log(`[App.vue] 从搜索页面返回，使用记录的滚动位置: ${scrollPos}`);
              }
            } else {
              // 从其他页面返回，使用对应页面的滚动位置
              const savedScrollPos = localStorage.getItem(`temp_scroll_${oldView}`) || 
                                    localStorage.getItem(`scroll_pos_${oldView}`);
              if (savedScrollPos) {
                scrollPos = parseInt(savedScrollPos, 10);
                console.log(`[App.vue] 从${oldView}页面返回，恢复滚动位置: ${scrollPos}`);
              } else {
                // 如果没有找到保存的值，则使用最后记录的页面滚动位置
                scrollPos = scrollPositions.value[oldView] || 0;
                console.log(`[App.vue] 从${oldView}页面返回，使用记录的滚动位置: ${scrollPos}`);
              }
            }
            
            // 使用丝滑滚动恢复
            const originalScrollBehavior = scrollElement.style.scrollBehavior;
            scrollElement.style.scrollBehavior = 'auto';
            scrollElement.style.visibility = 'hidden';
            
            // 立即设置滚动位置
            scrollElement.scrollTop = scrollPos;
            
            // 在下一帧恢复可见性和滚动行为
            requestAnimationFrame(() => {
              // 确保滚动位置已应用
              scrollElement.scrollTop = scrollPos;
              
              // 延迟一帧再恢复可见性，确保滚动位置已经生效
              requestAnimationFrame(() => {
                scrollElement.style.visibility = 'visible';
                scrollElement.style.scrollBehavior = originalScrollBehavior;
                
                // 同时更新playlist的滚动位置，保持同步
                scrollPositions.value.playlist = scrollPos;
                
                // 保存到本地存储
                saveToLocalStorage();
              });
            });
          }
        } 
        // 如果是新的搜索，强制滚动到顶部
        else if (oldFullPath === '/' && newFullPath.startsWith('/search')) {
          const scrollElement = getScrollableElement();
          if (scrollElement) {
            scrollElement.scrollTop = 0;
          }
        } 
        // 处理歌单页面标签之间的切换 (排行榜、MV等)
        else if ((newView === 'ranking' || newView === 'mv' || newView === 'playlists' || newView === 'mine') && 
                (oldView === 'ranking' || oldView === 'mv' || oldView === 'playlists' || oldView === 'mine')) {
          
          console.log(`[App.vue] 歌单页面标签切换: ${oldView} -> ${newView}`);
          
          // 检查是否有保存的滚动位置
          const scrollPosKey = `scroll_pos_${newView}`;
          const tempScrollKey = `temp_scroll_${newView}`;
          const savedScrollPos = localStorage.getItem(scrollPosKey) || localStorage.getItem(tempScrollKey);
          
          if (savedScrollPos) {
            const scrollPos = parseInt(savedScrollPos, 10);
            console.log(`[App.vue] 恢复${newView}标签滚动位置: ${scrollPos}`);
            
            // 更新scrollPositions中的值
            scrollPositions.value[newView] = scrollPos;
            
            // 不要立即清除临时存储，延迟清除
            setTimeout(() => {
              // localStorage.removeItem(scrollPosKey);
              // localStorage.removeItem(tempScrollKey);
              // console.log(`[App.vue] 保留临时滚动位置，不立即清除`);
            }, 100);
            
            // 保存到本地存储
            saveToLocalStorage();
          }
          
          // 增加延迟，确保内容已加载
          setTimeout(() => {
            restoreScrollPosition(newView, 15); // 增加尝试次数
          }, 300);
        }
        // 对于其他所有视图变化，尝试恢复各自的滚动位置
        else {
          // 恢复滚动位置
          setTimeout(() => {
            restoreScrollPosition(newView, 10); // 增加尝试次数，确保滚动恢复成功
          }, 200);
        }
      }
    }, 50);
  });
});

// 添加新的监听器，专门处理MV页面返回
watch(() => route.fullPath, (newPath, oldPath) => {
  // 检查是否从MV页面返回到播放页面
  if (oldPath && oldPath.includes('/mv/') && (newPath === '/' || newPath === '/playlist-display' || newPath.includes('/playlist'))) {
    console.log('[App.vue] 从MV页面返回到播放页面，确保播放状态');
    
    // 特殊处理标记
    window._fromMVToPlaylist = true;
    window._preventDataReload = true;
    
    // 清除所有MV相关状态标记
    localStorage.removeItem('musicPausedForMV');
    localStorage.removeItem('isFromMV');
    sessionStorage.removeItem('mv_return_playstate');
    sessionStorage.removeItem('mv_return_timestamp');
    
    // 确保页面内容已加载并恢复播放状态
    setTimeout(() => {
      if (playerStore.currentSong) {
        // 检查之前的播放状态
        const musicWasPlaying = localStorage.getItem('musicWasPlaying') === 'true';
        console.log('[App.vue] 从MV页面返回，检测到原始播放状态:', musicWasPlaying ? '播放中' : '暂停');
        
        if (musicWasPlaying) {
          // 如果之前是播放状态，确保恢复播放
          if (!playerStore.isPlaying) {
            console.log('[App.vue] 设置播放状态为true');
            playerStore.isPlaying = true;
          }
          
          // 确保音频播放
          const audio = document.querySelector('audio');
          if (audio && audio.paused) {
            console.log('[App.vue] 尝试恢复音频播放');
            try {
              const playPromise = audio.play();
              if (playPromise !== undefined) {
                playPromise.catch(err => {
                  console.warn('[App.vue] 自动恢复播放失败:', err);
                  window._needManualPlayResume = true;
                  
                  // 再次尝试播放
                  setTimeout(() => {
                    console.log('[App.vue] 再次尝试恢复播放');
                    audio.play().catch(() => {
                      console.warn('[App.vue] 二次尝试播放失败，需要用户交互');
                    });
                  }, 1000);
                });
              }
            } catch (err) {
              console.warn('[App.vue] 播放尝试出错:', err);
            }
          }
        } else {
          // 如果之前是暂停状态，确保保持暂停
          if (playerStore.isPlaying) {
            console.log('[App.vue] 设置播放状态为false');
            playerStore.isPlaying = false;
          }
          
          // 确保音频暂停
          const audio = document.querySelector('audio');
          if (audio && !audio.paused) {
            console.log('[App.vue] 确保音频保持暂停');
            audio.pause();
          }
        }
        
        // 清除记录
        localStorage.removeItem('musicWasPlaying');
      }
      
      // 300ms后再次检查，以防播放状态未正确恢复
      setTimeout(() => {
        if (playerStore.currentSong && playerStore.isPlaying) {
          const audio = document.querySelector('audio');
          if (audio && audio.paused) {
            console.log('[App.vue] 二次尝试恢复音频播放');
            audio.play().catch(() => {
              window._needManualPlayResume = true;
            });
          }
        }
      }, 500);
    }, 300); // 等待播放器组件挂载完成
  }
  // 添加对从歌词页面返回的处理
  else if (oldPath && oldPath.includes('/lyrics') && (newPath === '/' || newPath.includes('/playlist'))) {
    console.log('[App.vue] 从歌词页面返回到歌单页面，确保播放状态保持不变');
    
    // 清除可能存在的MV相关状态标记，防止误触发MV处理逻辑
    localStorage.removeItem('musicPausedForMV');
    localStorage.removeItem('musicWasPlaying');
    localStorage.removeItem('isFromMV');
    sessionStorage.removeItem('mv_return_playstate');
    sessionStorage.removeItem('mv_return_timestamp');
    
    // 重置MVView相关的标记，确保不影响当前播放状态
    if (window._fromMVToPlaylist) window._fromMVToPlaylist = false;
    
    // 设置一个短暂的标记，表示刚从歌词页面返回
    // 这个标记会在MVView组件的watch函数中被检查和清除
    localStorage.setItem('fromLyricsPage', 'true');
    
    // 延迟清除标记，确保MVView组件有足够时间检测到
    setTimeout(() => {
      localStorage.removeItem('fromLyricsPage');
    }, 3000);
    
    // 确保音乐继续播放
    setTimeout(() => {
      if (playerStore.currentSong && playerStore.isPlaying) {
        const audio = document.querySelector('audio');
        if (audio && audio.paused) {
          console.log('[App.vue] 从歌词页面返回，确保音乐继续播放');
          audio.play().catch(err => {
            console.warn('[App.vue] 恢复播放失败:', err);
          });
        }
      }
    }, 500);
  }
  
  // 特殊处理来自歌单或其他页面返回导致的播放中断
  if (window._preventDataReload && (newPath === '/' || newPath === '/playlist-display')) {
    // 延迟检查播放状态，给页面足够的时间加载
    setTimeout(() => {
      if (playerStore.currentSong && playerStore.isPlaying) {
        const audio = document.querySelector('audio');
        if (audio && audio.paused) {
          console.log('[App.vue] 导航后恢复播放');
          audio.play().catch(() => {
            window._needManualPlayResume = true;
          });
        }
      }
      
      // 清除特殊标记
      window._preventDataReload = false;
      window._fromMVToPlaylist = false;
    }, 500);
  }
}, { immediate: false });

// 挂载组件时
onBeforeMount(() => {
  // 标记正在初始化App，防止子组件重复加载数据
  window._appInitializing = true;
});

onMounted(() => {
  // 清除应用启动标记，以便能正确识别应用刚启动的状态
  localStorage.removeItem('app_has_started');
  console.log('[App.vue] 清除应用启动标记，以便正确识别应用刚启动');
  
  // 重置上次更新时间
  dataCache.resetLastUpdateTime();
  
  // 还原主题设置
  restoreThemeSettings();
  
  // 检测设备类型
  const isAndroid = /Android/.test(navigator.userAgent);
  
  // 清除初始化标记
  window._appInitializing = false;
  
  // 从本地存储加载滚动位置
  // loadFromLocalStorage(); // <--- 注释掉这里
  
  // 同时加载标签页滚动位置
  try {
    const tabPositions = localStorage.getItem('tabScrollPositions');
    if (tabPositions) {
    }
  } catch (e) {
    console.error('[标签滚动位置] 加载失败:', e);
  }
  
  // 确定初始视图类型
  currentView.value = getViewFromPath(route.fullPath);
  
  // 设置滚动事件监听
  const scrollElement = getScrollableElement();
  if (scrollElement) {
    scrollElement.addEventListener('scroll', () => {
      // 使用防抖函数避免频繁调用
      clearTimeout(scrollDebounceTimer);
      scrollDebounceTimer = setTimeout(() => {
        saveCurrentScrollPosition();
      }, 200);
    });
  }
  
  // 设置定期自动保存
  autoSaveTimer = setInterval(() => {
    saveCurrentScrollPosition(true);
  }, 3000);
  
  // 页面刷新/关闭前保存
  window.addEventListener('beforeunload', () => {
    saveCurrentScrollPosition(true);
  });
  
  // 监听前进/后退导航，防止从歌单页面返回播放页面时重置状态
  window.addEventListener('popstate', (event) => {
    // 判断是否是返回到播放页面
    if (window.location.pathname === '/' && localStorage.getItem('isInPlaylistView') === 'false') {
      console.log('[App.vue] 检测到返回到播放页面，保持播放状态');
      localStorage.setItem('isInPlaylistView', 'true');
      
      // 设置标志，防止重新加载数据
      window._preventDataReload = true;
      
      // 确保播放状态保持
      if (playerStore.currentSong && !playerStore.isPlaying) {
        setTimeout(() => {
          playerStore.isPlaying = true;
        }, 100);
      }
    }
  });
  
  // 尝试恢复初始滚动位置
  nextTick(() => {
  setTimeout(() => {
      restoreScrollPosition(currentView.value);
    }, 300);
  });
  
  // 尝试恢复播放状态
  if (playerStore.currentSong === null) {
    playerStore.restoreSavedState().then(restored => {
      // 只有在没有恢复成功且播放列表为空时才加载推荐歌曲
      if (!restored && !playerStore.isDataLoaded) {
        console.log('[App] 尝试加载推荐歌曲');
        playerStore.fetchInitialSongs();
      }
    });
  }
  
  // 监听点击事件，用于处理需要用户交互才能播放的情况
  document.addEventListener('click', () => {
    if (window._needManualPlayResume && playerStore.currentSong && playerStore.isPlaying) {
      const audio = document.querySelector('audio');
      if (audio && audio.paused) {
        console.log('[App.vue] 用户交互，尝试恢复播放');
        audio.play().catch(err => {
          console.warn('[App.vue] 用户交互恢复播放失败:', err);
        });
      }
      window._needManualPlayResume = false;
    }
  });
  
  // 监听MV页面的自定义返回事件
  window.addEventListener('mv-custom-back', handleMVCustomBack);
  
  // 检查是否是从MV页面返回
  const isFromMV = localStorage.getItem('isFromMV') === 'true';
  if (isFromMV) {
    console.log('[App.vue] 检测到从MV页面返回，尝试恢复状态');
    handleMVReturnState();
    // 清除标记
    localStorage.removeItem('isFromMV');
  }
  
  // 添加视口高度调整函数
  updateVHVariable();
  
  // 监听窗口大小变化和设备方向变化
  window.addEventListener('resize', updateVHVariable);
  window.addEventListener('orientationchange', () => {
    // 在方向变化后稍微延迟更新，确保浏览器已经完成重新计算
    setTimeout(updateVHVariable, 100);
  });
  
  // 如果有特定的移动浏览器事件，也可以监听
  if ('visualViewport' in window) {
    window.visualViewport.addEventListener('resize', updateVHVariable);
  }
  
  // 检查Android原生环境
  if (window.AndroidPlayer) {
    console.log('[App.vue] 检测到Android原生环境，初始化通信');
    
    // 如果当前有歌曲在播放，更新Android服务通知
    if (playerStore.currentSong) {
      try {
        if (typeof window.AndroidPlayer.updateNowPlaying === 'function') {
          window.AndroidPlayer.updateNowPlaying(
            playerStore.currentSong.name || '未知歌曲', 
            playerStore.currentSong.artist || '未知艺术家'
          );
          console.log('[App.vue] 已初始化Android通知信息');
        }
      } catch (err) {
        console.warn('[App.vue] 初始化Android通知失败:', err);
      }
    }
    
    // 监听播放状态变化，更新Android服务
    watch(() => [playerStore.currentSong?.name, playerStore.currentSong?.artist, playerStore.isPlaying], () => {
      if (playerStore.currentSong && typeof window.AndroidPlayer.updateNowPlaying === 'function') {
        try {
          window.AndroidPlayer.updateNowPlaying(
            playerStore.currentSong.name || '未知歌曲', 
            playerStore.currentSong.artist || '未知艺术家'
          );
        } catch (err) {
          console.warn('[App.vue] 更新Android通知失败:', err);
        }
      }
    });
  }
});

// 在组件卸载前清除计时器
onUnmounted(() => {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
  }
  
  if (scrollDebounceTimer) {
    clearTimeout(scrollDebounceTimer);
  }
  
  // 保存最终的滚动位置
  saveCurrentScrollPosition(true);
  
  // 移除滚动事件监听器
  const scrollElement = getScrollableElement();
  if (scrollElement) {
    scrollElement.removeEventListener('scroll', () => {});
  }
  
  // 移除点击事件监听
  document.removeEventListener('click', () => {});
  
  // 移除自定义事件监听
  window.removeEventListener('mv-custom-back', handleMVCustomBack);
  
  // 移除事件监听器
  window.removeEventListener('resize', updateVHVariable);
  window.removeEventListener('orientationchange', updateVHVariable);
  
  if ('visualViewport' in window) {
    window.visualViewport.removeEventListener('resize', updateVHVariable);
  }
});

const closeLyricsView = () => {
  playerStore.toggleLyricsView();
};

// 点击浮层背景时关闭歌词
const handleOverlayClick = (event) => {
  if (event.target.classList.contains('lyrics-overlay')) {
    // playerStore.toggleLyricsView(); // 如果需要点击背景关闭，则取消此行注释
  }
};

// 添加处理MV自定义返回事件的函数
const handleMVCustomBack = (event) => {
  console.log('[App.vue] 收到MV自定义返回事件', event.detail);
  
  // 延迟执行，确保DOM已更新
  setTimeout(() => {
    // 恢复播放状态
    handleMVReturnState();
    
    // 清除标记
    localStorage.removeItem('isFromMV');
  }, 100);
};

// 处理从MV返回的状态恢复
const handleMVReturnState = () => {
  try {
    // 获取保存的播放状态
    const savedStateStr = sessionStorage.getItem('mv_return_playstate');
    const timestamp = sessionStorage.getItem('mv_return_timestamp');
    
    if (savedStateStr && timestamp) {
      const savedState = JSON.parse(savedStateStr);
      const timePassed = Date.now() - parseInt(timestamp, 10);
      
      // 如果时间不超过30秒，尝试恢复状态
      if (timePassed < 30000) {
        console.log('[App.vue] 恢复MV返回前的播放状态', savedState);
        
        // 如果当前有歌曲，且与保存的相同，恢复播放状态
        if (playerStore.currentSong?.id === savedState.currentSongId) {
          // 恢复播放状态
          playerStore.isPlaying = savedState.isPlaying;
          
          // 延迟确保音频元素已就绪
          setTimeout(() => {
            const audio = document.querySelector('audio');
            if (audio) {
              // 设置播放时间
              audio.currentTime = savedState.currentTime;
              
              // 如果应该播放，确保播放
              if (savedState.isPlaying && audio.paused) {
                audio.play().catch(err => {
                  console.warn('[App.vue] 自动恢复播放失败:', err);
                  window._needManualPlayResume = true;
                });
              }
            }
          }, 300);
        }
      }
      
      // 清除会话存储
      sessionStorage.removeItem('mv_return_playstate');
      sessionStorage.removeItem('mv_return_timestamp');
    }
  } catch (error) {
    console.error('[App.vue] 恢复MV返回状态失败:', error);
  }
};

function changeBackgroundNext() {
  // console.log('[App.vue] changeBackgroundNext called.');
  const currentIndex = availableBackgrounds.findIndex(bg => bg.id === currentBgId.value);
  const nextIndex = (currentIndex + 1) % availableBackgrounds.length;
  // console.log('[App.vue] Changing background. Old ID:', currentBgId.value, 'New ID:', availableBackgrounds[nextIndex].id);
  bgImageLoaded.value = false; 
  currentBgId.value = availableBackgrounds[nextIndex].id;
  localStorage.setItem('currentBackgroundId', currentBgId.value);
}

// 打开背景选择器
const openBackgroundSelector = () => {
  showBackgroundSelector.value = true;
};

// 关闭背景选择器
const closeBackgroundSelector = () => {
  showBackgroundSelector.value = false;
};

watch(currentBgId, (newId, oldId) => {
  // console.log(`[App.vue] currentBgId changed from ${oldId} to ${newId}`);
  if (newId !== oldId) {
    bgImageLoaded.value = false;
    // console.log('[App.vue] bgImageLoaded reset to false due to background change.');
  }
});

// 添加视口高度调整函数
function updateVHVariable() {
  // 获取视口的实际高度
  const vh = window.innerHeight * 0.01;
  // 设置CSS变量
  document.documentElement.style.setProperty('--vh', `${vh}px`);
  document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
  
  // 自动检测是否有系统导航栏等占用空间
  const safeBottom = Math.max(
    0, 
    window.innerHeight - document.documentElement.clientHeight, 
    ('visualViewport' in window) ? window.innerHeight - window.visualViewport.height : 0
  );
  
  // 设置底部安全区域（如果有）
  document.documentElement.style.setProperty('--safe-bottom', `${safeBottom}px`);
  
  // 检测设备类型和方向，优化播放器高度
  if (window.innerWidth <= 768) {
    document.documentElement.style.setProperty('--player-height', '70px');
  } else {
    document.documentElement.style.setProperty('--player-height', '80px');
  }
}

// 更新背景ID
const updateBackgroundId = (id) => {
  bgImageLoaded.value = false;
  currentBgId.value = id;
  localStorage.setItem('currentBackgroundId', id);
};

// 恢复主题设置
function restoreThemeSettings() {
  try {
    // 从本地存储加载主题设置
    const theme = localStorage.getItem('themeMode');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark-theme');
      document.documentElement.classList.remove('light-theme');
    } else if (theme === 'light') {
      document.documentElement.classList.add('light-theme');
      document.documentElement.classList.remove('dark-theme');
    } else {
      // 默认深色主题
      document.documentElement.classList.add('dark-theme');
      document.documentElement.classList.remove('light-theme');
    }
    console.log(`[App.vue] 恢复主题设置: ${theme || '默认深色'}`);
  } catch (error) {
    console.error('[App.vue] 恢复主题设置失败:', error);
  }
}
</script>

<template>
  <div id="app-container" :class="{ 'bg-loaded': bgImageLoaded }">
    <div class="background-image-container">
      <OptimizedImage 
        :key="currentBackground.id"
        :srcOriginal="currentBackground.original"
        :srcWebp="currentBackground.webp"
        :srcCompressedJpg="currentBackground.compressed"
        alt="背景图片" 
        :lazy="false"
        @load="handleImageLoaded"
        @error="() => {}"
        class="background-image"
      />
    </div>

    <TopNavBar @openBackgroundSelector="openBackgroundSelector" />
    <main class="content-area" style="scroll-behavior: auto;">
      <RouterView v-slot="{ Component, route }">
        <transition name="fade" mode="out-in">
          <keep-alive :max="10" :include="['PlaylistView', 'PlaylistDetailView', 'PlaylistsView', 'SearchView', 'MVView']">
            <component :is="Component" :key="route.meta.usePathKey ? route.path : route.name" />
          </keep-alive>
        </transition>
      </RouterView>
    </main>
    <PlayerControls v-if="playerStore.currentSong" />
    
    <div v-if="playerStore.showLyricsView" class="lyrics-overlay" @click.self="handleOverlayClick">
      <div class="lyrics-modal-content">
        <button @click="closeLyricsView" class="close-lyrics-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <LyricsView />
      </div>
    </div>
    <BubblesVue />
    <ClickEffect />
    
    <!-- 背景选择器对话框 -->
    <BackgroundSelector 
      :visible="showBackgroundSelector"
      :backgrounds="availableBackgrounds"
      :current-bg-id="currentBgId.value"
      @update:current-bg-id="updateBackgroundId"
      @close="closeBackgroundSelector"
    />
  </div>
</template>

<style>
/* 全局样式 */
body, html {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
  color: #fff;
  /* 添加过度滚动行为控制 */
  overscroll-behavior: none;
}

/* 添加CSS变量以处理移动端浏览器的视口问题 */
:root {
  --vh: 1vh;
  --app-height: 100vh;
  --safe-bottom: 0px;
  --player-height: 80px; /* 添加播放器高度变量 */
}

#app-container {
  display: flex;
  flex-direction: column;
  height: var(--app-height); /* 使用CSS变量替代固定100vh */
  background-color: #121212; /* 图片加载前的底色 */
  overflow: hidden;
  position: relative; /* 确保 z-index 上下文 */
  box-sizing: border-box;
}

/* 背景图容器 */
.background-image-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0; /* 改为0，使其成为 stacking context 的基础 */
  overflow: hidden;
}

.background-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0; /* 初始透明 */
  transition: opacity 0.3s ease-in-out; /* 将过渡时间从 0.7s 修改为 0.3s */
  /* border: 5px solid red; */ /* 移除调试边框 */
}

#app-container.bg-loaded .background-image {
  opacity: 1; /* 图片加载完成后显示 */
  /* border-color: lime; */ /* 移除调试边框 */
}

/* 确保主要内容组件在背景之上 */
.top-nav-bar-component, /* 假设 TopNavBar 组件最外层是这个类或ID */
.content-area, 
.player-controls-component, /* 假设 PlayerControls 组件最外层是这个类或ID */
.lyrics-overlay,
.bubbles-vue-component, /* 假设 BubblesVue 组件最外层是这个类或ID */
.click-effect-component, /* 假设 ClickEffect 组件最外层是这个类或ID */
.debug-button /* 如果切换背景按钮还在的话 */ {
  position: relative; /* 创建新的 stacking context */
  z-index: 1;     /* 确保在 z-index: 0 的背景之上 */
}

/* 你需要将上面 .top-nav-bar-component 等替换为实际组件的根元素选择器 */
/* 如果组件没有特定的外层类或ID，你可能需要在模板中给它们加上 */

.content-area { /* content-area 已有 z-index:1, 这里是合并 */
  flex-grow: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1rem;
  backdrop-filter: blur(1px) brightness(0.8);
  background-color: rgba(0,0,0,0.3); /* 注意：如果这个半透明黑色的区域完全覆盖了背景，也会影响观感 */
  scroll-behavior: auto !important;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  will-change: scroll-position;
  position: relative;
  z-index: 1; /* 已有 */
  height: 100%; /* 使用100%填充可用空间 */
  display: flex;
  flex-direction: column;
  /* 确保内容不会被底部播放控件覆盖 */
  padding-bottom: var(--player-height); /* 使用CSS变量 */
  /* 移动设备适配 */
  max-width: 100vw;
  box-sizing: border-box;
}

/* 移动设备适配 */
@media (max-width: 768px) {
  :root {
    --player-height: 70px; /* 移动设备上播放器高度稍小 */
  }
  
  .content-area {
    padding: 0.75rem;
    padding-bottom: var(--player-height);
  }
  
  /* 调整TopNavBar的高度（如果需要） */
  .top-nav-bar-component {
    padding: 8px 10px;
  }
}

/* 自动计算content-area的最大高度，当播放器组件可见时 */
#app-container:has(.player-controls-new) .content-area {
  max-height: calc(100vh - 80px);
}

.lyrics-overlay { position: fixed; /* ... */ z-index: 1000; /* 这个很高，没问题 */ }
.lyrics-modal-content { /* ... */ }
.close-lyrics-button { /* ... */ z-index: 1010; /* 这个很高，没问题 */ }
/* 切换背景按钮示例样式 */
.change-bg-button-debug {
    position: fixed; 
    top: 120px; 
    left: 20px; 
    z-index: 10000; /* 确保按钮在最前 */
    padding: 8px 12px; 
    background-color: #333; 
    color: white; 
    border: none; 
    border-radius: 4px; 
    cursor: pointer; 
    opacity: 0.8;
}

.fade-enter-active, .fade-leave-active { /* ... */ }
.fade-enter-from, .fade-leave-to { /* ... */ }
</style>
