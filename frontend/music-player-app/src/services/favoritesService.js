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

    // 添加到收藏
    favorites.push(item);
    localStorage.setItem(key, JSON.stringify(favorites));
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

export default {
  getFavorites,
  addToFavorites,
  removeFromFavorites,
  isFavorited,
  clearFavorites,
  getFavoritesCount
}; 