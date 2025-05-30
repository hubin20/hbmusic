import { createRouter, createWebHistory } from 'vue-router';
// import HomeView from '../views/HomeView.vue'; //不再需要HomeView作为独立路由
import PlaylistView from '../views/PlaylistView.vue'; // 直接导入 PlaylistView
import LyricsView from '../views/LyricsView.vue'; // 导入实际的 LyricsView 组件
import SearchView from '../views/SearchView.vue'; // 导入搜索结果组件
import PlaylistsView from '../views/PlaylistsView.vue'; // 导入歌单列表页面
import PlaylistDetailView from '../views/PlaylistDetailView.vue'; // 导入歌单详情页面
import MVView from '../views/MVView.vue'; // 导入MV详情页面
import FavoritesView from '../views/FavoritesView.vue'; // 导入本地收藏页面
// import { usePlayerStore } from '../stores/player'; // 可能不再需要在全局守卫中直接使用

// 临时的占位符组件
const PlaceholderComponent = (text) => ({
  template: `<div style="padding: 20px; color: white; text-align: center;">${text} 页面占位符</div>`
});

// 存储路由历史和组件实例
const routeHistory = [];
let currentViewInstance = null;
// 标记特定路由是否已加载
const loadedRoutes = {
  'now-playing': false,
  'playlist-display': false,
  'mv-detail': false
};

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/', // 根路径，作为主要的"播放页面"
      name: 'now-playing', // 首页，显示歌曲列表
      component: PlaylistView,
      meta: {
        keepAlive: true,
        usePathKey: false,  // 使用路由名称作为key
        viewName: 'playlist',  // 视图标识
        scrollToTop: true // 添加标记，表示需要滚动到顶部
      }
    },
    {
      path: '/playlist-display', // 用于点击"歌单"标签时激活
      name: 'playlist-display',
      component: PlaylistView, // 也显示歌曲列表
      meta: {
        keepAlive: true,
        usePathKey: false,  // 使用路由名称作为key
        viewName: 'playlist',  // 视图标识
        scrollToTop: true // 添加标记，表示需要滚动到顶部
      }
    },
    {
      path: '/lyrics',
      name: 'lyrics',
      component: LyricsView, // 指向实际的 LyricsView 组件
      meta: {
        keepAlive: false  // 不需要缓存
      }
    },
    {
      path: '/search',
      name: 'search-results',
      component: SearchView, // 指向实际的搜索结果组件
      meta: {
        keepAlive: true,
        usePathKey: true,  // 使用路径作为key
        viewName: 'search',  // 视图标识
        scrollToTop: true // 添加标记，表示需要滚动到顶部
      }
    },
    {
      path: '/playlists',
      name: 'playlists',
      component: PlaylistsView, // 歌单列表页面
      meta: {
        keepAlive: true,
        usePathKey: true,  // 使用路径作为key
        viewName: 'playlists',  // 视图标识
        scrollToTop: true // 添加标记，表示需要滚动到顶部
      }
    },
    {
      path: '/playlist/:id',
      name: 'playlist-detail',
      component: PlaylistDetailView, // 歌单详情页面
      meta: {
        keepAlive: true,
        usePathKey: true,  // 使用路径作为key（每个歌单ID不同）
        viewName: 'playlistDetail',  // 视图标识
        scrollToTop: true // 添加标记，表示需要滚动到顶部
      }
    },
    {
      path: '/mv/:id',
      name: 'mv-detail',
      component: MVView,
      meta: {
        keepAlive: true
      }
    },
    {
      path: '/favorites',
      name: 'favorites',
      component: FavoritesView, // 本地收藏页面
      meta: {
        keepAlive: true,
        usePathKey: true,  // 使用路径作为key
        viewName: 'favorites',  // 视图标识
        scrollToTop: true // 添加标记，表示需要滚动到顶部
      }
    },
    {
      path: '/album/:id',
      name: 'AlbumDetail',
      component: () => import('../views/AlbumDetailView.vue'), // 假设组件路径
      meta: { keepAlive: true, title: '专辑详情' } // 可以考虑是否缓存专辑页
    }
  ],
  scrollBehavior(to, from, savedPosition) {
    // 路由切换时，尝试恢复滚动位置
    // keep-alive 组件切换时，savedPosition 会是之前记录的位置
    if (savedPosition) {
      return savedPosition;
    }
    // 对于新进入的页面，滚动到顶部
    // 特定路由可以自定义滚动行为，例如在 meta 中添加标记
    if (to.meta.scrollToTop) {
      return { left: 0, top: 0 };
    }
    // 默认不改变滚动行为，让浏览器自行处理或由 App.vue 中的逻辑处理
    // 如果App.vue中有更复杂的滚动管理，这里可以返回 false 来禁用默认行为
    return false;
  }
});

// 全局前置守卫 (beforeEach)
router.beforeEach((to, from, next) => {
  // 这里可以放置真正必要的全局逻辑，例如：
  // 1. 页面访问权限控制 (如果需要)
  // 2. 设置页面标题 (document.title = to.meta.title || 'Music App')
  // 3. 轻量级的打点/分析

  // 移除之前复杂的导航控制逻辑
  // console.log(`[Router] Navigating from ${from.fullPath} to ${to.fullPath}`);

  // 确保 Pinia store 实例在这里可以被访问 (如果确实需要的话)
  // const playerStore = usePlayerStore(); 
  // 但通常建议在组件内部通过生命周期钩子与 store 交互

  next(); // 必须调用 next()
});

// 全局后置钩子 (afterEach)
router.afterEach((to, from) => {
  // 这里可以放置导航成功后的逻辑，例如：
  // 1. 页面加载完成后的分析
  // 2. 辅助功能：通知屏幕阅读器页面已更改

  // 移除之前复杂的滚动恢复和状态恢复逻辑
  // console.log(`[Router] Navigated from ${from.fullPath} to ${to.fullPath}`);
});

export default router;
