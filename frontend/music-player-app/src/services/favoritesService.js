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
          (item.id.startsWith('kw_') || item.id.startsWith('kw-'))) ||
        (item.source === 'kw') ||
        (item.originalData && item.originalData.source === 'kw');

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

  const key = STORAGE_KEYS[type.toUpperCase()];
  if (!key) return false;

  try {
    const favorites = getFavorites(type);
    const idStr = String(id);

    // 直接匹配原始ID
    if (favorites.some(item => String(item.id) === idStr)) {
      return true;
    }

    // 如果是歌曲，进行更复杂的匹配
    if (type.toUpperCase() === 'SONGS') {
      // 检查是否是酷我歌曲ID (格式为 kw_123456)
      if (idStr.startsWith('kw_')) {
        const kwId = idStr.substring(3); // 移除 'kw_' 前缀
        // 搜索不带前缀的ID
        if (favorites.some(item => String(item.id) === kwId)) {
          return true;
        }
        // 搜索带rid字段的歌曲
        if (favorites.some(item => item.rid && String(item.rid) === kwId)) {
          return true;
        }
      }
      // 检查是否是酷我歌曲ID (格式为 kw-123456)
      else if (idStr.startsWith('kw-')) {
        const kwId = idStr.substring(3); // 移除 'kw-' 前缀
        // 搜索不带前缀的ID
        if (favorites.some(item => String(item.id) === kwId)) {
          return true;
        }
        // 搜索带rid字段的歌曲
        if (favorites.some(item => item.rid && String(item.rid) === kwId)) {
          return true;
        }
      }
      // 检查常规ID在酷我收藏中的匹配
      else {
        // 搜索带kw_前缀的ID
        if (favorites.some(item => String(item.id) === `kw_${idStr}`)) {
          return true;
        }
        // 搜索带kw-前缀的ID
        if (favorites.some(item => String(item.id) === `kw-${idStr}`)) {
          return true;
        }
        // 检查歌曲名称和艺术家匹配
        // 这个功能需要传入完整歌曲对象而不仅仅是ID，如果将来需要可以添加
      }
    }

    return false;
  } catch (err) {
    console.error(`检查收藏状态失败:`, err);
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
 * @param {number} timestamp - URL获取时间戳
 * @param {Object} additionalData - 其他需要更新的数据
 * @returns {boolean} - 是否成功更新
 */
export const updateFavoriteSongUrl = (songId, newUrl, timestamp, additionalData = {}) => {
  if (!songId) return false;

  try {
    console.log(`[FavoritesService] 更新歌曲URL: ${songId}`);
    const songs = getFavorites('SONGS');
    let updated = false;

    // 将songId转换为字符串，确保比较一致性
    const songIdStr = String(songId);

    // 查找匹配的歌曲，增强匹配逻辑
    const updatedSongs = songs.map(song => {
      // 将歌曲ID也转换为字符串进行比较
      const currentSongId = String(song.id);

      // 检查是否匹配，增加多种匹配方式
      const isMatch =
        currentSongId === songIdStr ||
        // 处理带有kw_前缀或后缀的情况
        (songIdStr.includes('kw_') && currentSongId === songIdStr.split('kw_')[0]) ||
        (currentSongId.includes('kw_') && songIdStr === currentSongId.split('kw_')[0]) ||
        // 处理带有时间戳后缀的情况
        (songIdStr.includes('_') && currentSongId === songIdStr.split('_')[0]) ||
        (currentSongId.includes('_') && songIdStr === currentSongId.split('_')[0]);

      if (isMatch) {
        console.log(`[FavoritesService] 找到匹配歌曲: ${song.name} (ID: ${song.id} 匹配 ${songIdStr})`);

        // 创建更新后的歌曲对象
        const updatedSong = { ...song };

        // 如果提供了新URL，更新URL和时间戳
        if (newUrl) {
          updatedSong.url = newUrl;
          updatedSong.timestamp = timestamp || Date.now();
        }

        // 更新其他提供的字段
        if (additionalData) {
          Object.keys(additionalData).forEach(key => {
            if (additionalData[key] !== undefined) {
              updatedSong[key] = additionalData[key];
            }
          });
        }

        // 特殊处理isFromKw标记
        if (additionalData.isFromKw !== undefined) {
          updatedSong.isFromKw = additionalData.isFromKw;

          // 如果设置为酷我歌曲，确保相关字段也正确设置
          if (additionalData.isFromKw === true) {
            // 如果已经有酷我RID，确保保留
            if (additionalData.rid) {
              updatedSong.rid = additionalData.rid;
            }

            // 对于灰色歌曲切换到酷我后，标记强制刷新URL
            updatedSong.forceRefreshUrl = true;

            console.log(`[FavoritesService] 歌曲已标记为酷我API: ${song.name} (ID: ${song.id})`);
          }
        }

        updated = true;
        console.log(`[FavoritesService] 成功更新歌曲 ${song.name} (ID: ${song.id}) 的URL`);
        return updatedSong;
      }
      return song;
    });

    if (updated) {
      localStorage.setItem(STORAGE_KEYS.SONGS, JSON.stringify(updatedSongs));

      // 触发收藏状态变更事件，确保UI更新
      try {
        document.dispatchEvent(new CustomEvent('favorites-updated', {
          detail: { type: 'SONGS' }
        }));
      } catch (e) {
        console.error('[FavoritesService] 触发收藏更新事件失败:', e);
      }

      return true;
    }

    console.log(`[FavoritesService] 未找到歌曲ID: ${songIdStr}，无法更新URL`);
    return false;
  } catch (err) {
    console.error('[FavoritesService] 更新歌曲URL失败:', err);
    return false;
  }
};

/**
 * 批量更新收藏歌曲的信息
 * @param {Array} updatedSongs - 更新后的歌曲数组
 * @returns {boolean} - 是否成功更新
 */
export const batchUpdateFavoriteSongs = (updatedSongs) => {
  if (!Array.isArray(updatedSongs) || updatedSongs.length === 0) {
    console.error('[FavoritesService] 批量更新收藏歌曲失败: 无效的参数');
    return false;
  }

  try {
    localStorage.setItem(STORAGE_KEYS.SONGS, JSON.stringify(updatedSongs));
    console.log(`[FavoritesService] 批量更新收藏歌曲成功，共更新${updatedSongs.length}首歌曲`);
    return true;
  } catch (err) {
    console.error('[FavoritesService] 批量更新收藏歌曲时出错:', err);
    return false;
  }
};

/**
 * 修复收藏歌曲中的isFromKw标记
 * @returns {boolean} - 是否成功修复
 */
export const fixFavoriteSongsKwFlag = () => {
  try {
    const songs = getFavorites('SONGS');
    if (songs.length === 0) return true;

    let updated = false;

    const fixedSongs = songs.map(song => {
      // 检查是否是酷我歌曲
      const isKwSong = song.rid ||
        (typeof song.id === 'string' &&
          (song.id.startsWith('kw_') || song.id.startsWith('kw-'))) ||
        (song.source === 'kw') ||
        (song.originalData && song.originalData.source === 'kw');

      // 如果标记不正确，进行修复
      if (isKwSong && !song.isFromKw) {
        updated = true;
        console.log(`[FavoritesService] 修复酷我歌曲标记: ${song.name}, ID: ${song.id}`);
        return {
          ...song,
          isFromKw: true,
          forceRefreshUrl: true // 强制在下次播放时刷新URL
        };
      }

      return song;
    });

    // 如果有更新，保存回本地存储
    if (updated) {
      localStorage.setItem(STORAGE_KEYS.SONGS, JSON.stringify(fixedSongs));
      console.log(`[FavoritesService] 成功修复收藏歌曲的酷我标记`);
    } else {
      console.log(`[FavoritesService] 收藏歌曲的酷我标记无需修复`);
    }

    return true;
  } catch (err) {
    console.error('[FavoritesService] 修复收藏歌曲酷我标记时出错:', err);
    return false;
  }
};

/**
 * 修复网易云收藏歌曲的URL
 * @returns {boolean} - 是否成功修复
 */
export const fixNeteaseFavoriteSongs = () => {
  try {
    const songs = getFavorites('SONGS');
    if (songs.length === 0) return true;

    let updated = false;

    const fixedSongs = songs.map(song => {
      // 检查是否是网易云歌曲（非酷我歌曲）
      const isNeteaseSong = !song.isFromKw &&
        !song.rid &&
        !(typeof song.id === 'string' &&
          (song.id.startsWith('kw_') || song.id.startsWith('kw-'))) &&
        !(song.source === 'kw') &&
        !(song.originalData && song.originalData.source === 'kw');

      // 如果是网易云歌曲，始终清除URL强制刷新
      if (isNeteaseSong) {
        updated = true;
        console.log(`[FavoritesService] 修复网易云歌曲URL: ${song.name}, ID: ${song.id}`);
        return {
          ...song,
          url: null,
          directPlayUrl: null,
          forceRefreshUrl: true,
          timestamp: null
        };
      }

      return song;
    });

    // 如果有更新，保存回本地存储
    if (updated) {
      localStorage.setItem(STORAGE_KEYS.SONGS, JSON.stringify(fixedSongs));
      console.log(`[FavoritesService] 成功修复网易云收藏歌曲的URL`);
    } else {
      console.log(`[FavoritesService] 网易云收藏歌曲的URL无需修复`);
    }

    return true;
  } catch (err) {
    console.error('[FavoritesService] 修复网易云收藏歌曲URL时出错:', err);
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
  updateFavoriteSongUrl,
  batchUpdateFavoriteSongs,
  fixFavoriteSongsKwFlag,
  fixNeteaseFavoriteSongs
}; 