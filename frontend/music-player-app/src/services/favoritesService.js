/**
 * 本地收藏服务
 * 提供管理本地收藏的歌曲、歌单和MV的功能
 */

// 存储键名
const STORAGE_KEYS = {
  SONGS: 'favorite_songs',
  PLAYLISTS: 'favorite_playlists',
  MVS: 'favorite_mvs',
  RANKINGS: 'favorite_rankings',
  ALBUMS: 'favorite_albums'
};

/**
 * 获取收藏的内容
 * @param {string} type - 收藏类型：'songs'、'playlists' 或 'mvs'
 * @returns {Array} - 收藏的内容数组
 */
export const getFavorites = (type) => {
  const key = STORAGE_KEYS[type.toUpperCase()];
  if (!key) return [];

  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error(`获取${type}收藏失败:`, err);
    return [];
  }
};

/**
 * 添加内容到收藏
 * @param {string} type - 收藏类型：'songs'、'playlists' 或 'mvs'
 * @param {Object} item - 要收藏的内容对象
 * @returns {boolean} - 是否成功添加
 */
export const addToFavorites = (type, item) => {
  if (!item || !item.id) return false;

  const key = STORAGE_KEYS[type.toUpperCase()];
  if (!key) return false;

  try {
    const favorites = getFavorites(type);

    // 检查是否已经收藏
    if (favorites.some(fav => fav.id === item.id)) {
      return true; // 已经收藏过了
    }

    // 特殊处理歌曲，确保保存必要的播放信息
    let itemToSave = { ...item }; // 创建副本，避免修改原对象

    if (type.toUpperCase() === 'SONGS') {
      // 确保保存关键的播放信息字段
      // 即使这些字段在item中不存在，也预留占位，确保结构一致
      const keysToPreserve = [
        'id', 'name', 'artist', 'album', 'albumId', 'albumArt',
        'duration', 'isFromKw', 'url', 'directPlayUrl', 'isFallbackDirect',
        'rid', 'originalData', 'lyricist', 'composer', 'timestamp'
      ];

      // 使用上述字段创建一个新对象
      const enhancedItem = {};
      keysToPreserve.forEach(key => {
        if (item[key] !== undefined) {
          enhancedItem[key] = item[key];
        }
      });

      // 添加时间戳，用于后续判断是否需要刷新
      enhancedItem.favoritedAt = Date.now();

      // 检查是否是酷我API的歌曲 - 增强检测逻辑
      const isKwSong = item.isFromKw === true ||
        (item.rid !== undefined && item.rid !== null) ||
        (typeof item.id === 'string' &&
          (item.id.startsWith('kw_') || item.id.startsWith('kw-')));

      // 确保酷我API标记正确保存
      if (isKwSong) {
        enhancedItem.isFromKw = true;
        enhancedItem.forceRefreshUrl = true; // 添加标记，强制在播放时刷新URL

        // 确保rid字段存在，这对于酷我API歌曲非常重要
        if (item.rid) {
          enhancedItem.rid = item.rid;
        }

        console.log(`[FavoritesService] 收藏酷我歌曲: ${item.name}, ID: ${item.id}, RID: ${item.rid || '未知'}, isFromKw: true`);
      } else {
        // 非酷我歌曲，确保标记为false
        enhancedItem.isFromKw = false;
      }

      // 如果有url但没有timestamp，添加当前时间作为timestamp
      if (enhancedItem.url && !enhancedItem.timestamp) {
        enhancedItem.timestamp = Date.now();
      }

      itemToSave = enhancedItem;

      console.log(`[FavoritesService] 收藏歌曲: ${item.name}, ID: ${item.id}, 是否包含URL: ${!!enhancedItem.url}, 是否酷我歌曲: ${enhancedItem.isFromKw}`);
    }

    // 添加到收藏
    favorites.push(itemToSave);
    localStorage.setItem(key, JSON.stringify(favorites));

    // 触发收藏状态变更事件，通知其他组件
    try {
      const event = new CustomEvent('favorite-status-changed', {
        detail: {
          id: item.id,
          type: type.toUpperCase(),
          isFavorited: true
        }
      });
      document.dispatchEvent(event);
    } catch (eventError) {
      console.error('触发收藏状态变更事件失败:', eventError);
    }

    return true;
  } catch (err) {
    console.error(`添加${type}收藏失败:`, err);
    return false;
  }
};

/**
 * 从收藏中移除内容
 * @param {string} type - 收藏类型：'songs'、'playlists' 或 'mvs'
 * @param {string|number} id - 要移除的内容ID
 * @returns {boolean} - 是否成功移除
 */
export const removeFromFavorites = (type, id) => {
  if (!id) return false;

  const key = STORAGE_KEYS[type.toUpperCase()];
  if (!key) return false;

  try {
    const favorites = getFavorites(type);
    const newFavorites = favorites.filter(item => item.id !== id);

    if (newFavorites.length === favorites.length) {
      return false; // 没有找到要移除的项目
    }

    localStorage.setItem(key, JSON.stringify(newFavorites));
    return true;
  } catch (err) {
    console.error(`移除${type}收藏失败:`, err);
    return false;
  }
};

/**
 * 检查内容是否已收藏
 * @param {string} type - 收藏类型：'songs'、'playlists' 或 'mvs'
 * @param {string|number} id - 内容ID
 * @returns {boolean} - 是否已收藏
 */
export const isFavorited = (type, id) => {
  if (!id) return false;

  try {
    const favorites = getFavorites(type);
    return favorites.some(item => item.id === id);
  } catch (err) {
    console.error(`检查${type}收藏状态失败:`, err);
    return false;
  }
};

/**
 * 清空指定类型的所有收藏
 * @param {string} type - 收藏类型：'songs'、'playlists' 或 'mvs'
 * @returns {boolean} - 是否成功清空
 */
export const clearFavorites = (type) => {
  const key = STORAGE_KEYS[type.toUpperCase()];
  if (!key) return false;

  try {
    localStorage.removeItem(key);
    return true;
  } catch (err) {
    console.error(`清空${type}收藏失败:`, err);
    return false;
  }
};

/**
 * 获取收藏数量
 * @param {string} type - 收藏类型：'songs'、'playlists' 或 'mvs'
 * @returns {number} - 收藏数量
 */
export const getFavoritesCount = (type) => {
  try {
    const favorites = getFavorites(type);
    return favorites.length;
  } catch (err) {
    console.error(`获取${type}收藏数量失败:`, err);
    return 0;
  }
};

/**
 * 更新收藏歌曲的URL
 * @param {string} songId - 歌曲ID
 * @param {string} newUrl - 新的URL
 * @param {number} timestamp - 时间戳，如果不提供则使用当前时间
 * @returns {boolean} - 是否成功更新
 */
export const updateFavoriteSongUrl = (songId, newUrl, timestamp = null) => {
  if (!songId || !newUrl) {
    console.error('[FavoritesService] 更新收藏歌曲URL失败: 无效的参数');
    return false;
  }

  try {
    // 获取收藏歌曲列表
    const songs = getFavorites('SONGS');

    // 查找对应ID的歌曲
    const songIndex = songs.findIndex(s => String(s.id) === String(songId));

    if (songIndex === -1) {
      console.error(`[FavoritesService] 更新收藏歌曲URL失败: 未找到ID为 ${songId} 的歌曲`);
      return false;
    }

    // 更新URL和时间戳
    songs[songIndex].url = newUrl;
    songs[songIndex].timestamp = timestamp || Date.now();

    // 保存回本地存储
    localStorage.setItem(STORAGE_KEYS.SONGS, JSON.stringify(songs));

    console.log(`[FavoritesService] 成功更新歌曲 ${songs[songIndex].name} (ID: ${songId}) 的URL`);
    return true;
  } catch (err) {
    console.error('[FavoritesService] 更新收藏歌曲URL时出错:', err);
    return false;
  }
};

export default {
  getFavorites,
  addToFavorites,
  removeFromFavorites,
  isFavorited,
  clearFavorites,
  getFavoritesCount,
  updateFavoriteSongUrl
}; 