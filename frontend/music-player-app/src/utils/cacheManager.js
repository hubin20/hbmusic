/**
 * 页面组件缓存管理器
 * 用于管理页面组件缓存和状态保持
 */

// 视图组件实例缓存
const viewInstances = {};

/**
 * 缓存视图组件实例
 * @param {string} viewName - 视图名称
 * @param {object} instance - 组件实例
 */
export const cacheViewInstance = (viewName, instance) => {
  if (viewName && instance) {
    viewInstances[viewName] = instance;
    console.log(`[CacheManager] 缓存视图组件: ${viewName}`);
  }
};

/**
 * 获取缓存的视图组件实例
 * @param {string} viewName - 视图名称
 * @returns {object|null} 组件实例或null
 */
export const getCachedViewInstance = (viewName) => {
  return viewInstances[viewName] || null;
};

/**
 * 清除特定视图组件实例缓存
 * @param {string} viewName - 视图名称
 */
export const clearViewInstanceCache = (viewName) => {
  if (viewName && viewInstances[viewName]) {
    delete viewInstances[viewName];
    console.log(`[CacheManager] 清除视图组件缓存: ${viewName}`);
  }
};

/**
 * 保存组件数据状态到sessionStorage
 * @param {string} viewName - 视图名称
 * @param {object} state - 状态数据
 */
export const saveViewState = (viewName, state) => {
  try {
    if (viewName && state) {
      sessionStorage.setItem(`view_state_${viewName}`, JSON.stringify(state));
    }
  } catch (error) {
    console.error(`[CacheManager] 保存视图状态失败: ${viewName}`, error);
  }
};

/**
 * 获取组件数据状态
 * @param {string} viewName - 视图名称
 * @returns {object|null} 状态数据或null
 */
export const getViewState = (viewName) => {
  try {
    const stateStr = sessionStorage.getItem(`view_state_${viewName}`);
    return stateStr ? JSON.parse(stateStr) : null;
  } catch (error) {
    console.error(`[CacheManager] 获取视图状态失败: ${viewName}`, error);
    return null;
  }
};

/**
 * 注册组件的activated和deactivated生命周期钩子
 * @param {object} options - 配置项
 * @param {string} options.viewName - 视图名称
 * @param {function} options.onActivate - 激活时的回调
 * @param {function} options.onDeactivate - 停用时的回调
 * @param {object} options.instance - 组件实例
 */
export const registerViewLifecycle = (options) => {
  const { viewName, onActivate, onDeactivate, instance } = options;

  if (!viewName) {
    console.error('[CacheManager] 注册生命周期钩子失败: 缺少viewName');
    return;
  }

  // 缓存组件实例
  if (instance) {
    cacheViewInstance(viewName, instance);
  }

  // 返回生命周期钩子处理函数
  return {
    onActivated() {
      console.log(`[CacheManager] 视图组件激活: ${viewName}`);
      if (onActivate && typeof onActivate === 'function') {
        onActivate();
      }
    },
    onDeactivated() {
      console.log(`[CacheManager] 视图组件停用: ${viewName}`);
      if (onDeactivate && typeof onDeactivate === 'function') {
        onDeactivate();
      }
    }
  };
}; 