/**
 * 数据缓存模块
 * 用于缓存已加载的数据，避免重复请求
 * 支持IndexedDB离线存储和内存缓存
 */

// 内存缓存
const cachedData = {
  playlists: {}, // 歌单数据 { id: { data } }
  songs: {},     // 歌曲数据 { id: { data } }
  searchResults: {}, // 搜索结果 { keyword: { data } }
  mvs: {},       // MV数据 { id: { data } }
  initialSongs: null, // 初始歌曲列表
};

// 标记是否已初始化播放器数据
let initialized = false;

// IndexedDB 数据库信息
const DB_NAME = 'hbmusic-cache';
const DB_VERSION = 1;
const STORES = {
  PLAYLISTS: 'playlists',
  SONGS: 'songs',
  SEARCH_RESULTS: 'searchResults',
  INITIAL_SONGS: 'initialSongs',
  MVS: 'mvs'
};

// 缓存有效期（毫秒）
const CACHE_EXPIRY = {
  PLAYLISTS: 24 * 60 * 60 * 1000, // 24小时
  SONGS: 7 * 24 * 60 * 60 * 1000, // 7天
  SEARCH_RESULTS: 24 * 60 * 60 * 1000, // 24小时
  INITIAL_SONGS: 12 * 60 * 60 * 1000, // 12小时
  MVS: 24 * 60 * 60 * 1000 // 24小时
};

/**
 * 确保数据可序列化，移除循环引用和不可序列化的内容
 * @param {*} data - 需要处理的数据
 * @returns {*} 可序列化的数据
 */
function makeSerializable(data) {
  if (!data) return data;

  // 对于简单类型，直接返回
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  // 处理数组
  if (Array.isArray(data)) {
    return data.map(item => makeSerializable(item));
  }

  // 处理对象
  const result = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = data[key];

      // 跳过函数
      if (typeof value === 'function') continue;

      // 处理对象和数组
      if (typeof value === 'object' && value !== null) {
        result[key] = makeSerializable(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

/**
 * 打开IndexedDB数据库连接
 * @returns {Promise<IDBDatabase>} 数据库连接
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('浏览器不支持IndexedDB'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('[DataCache] 打开数据库失败:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 创建对象存储
      if (!db.objectStoreNames.contains(STORES.PLAYLISTS)) {
        db.createObjectStore(STORES.PLAYLISTS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.SONGS)) {
        db.createObjectStore(STORES.SONGS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.SEARCH_RESULTS)) {
        db.createObjectStore(STORES.SEARCH_RESULTS, { keyPath: 'keyword' });
      }

      if (!db.objectStoreNames.contains(STORES.MVS)) {
        db.createObjectStore(STORES.MVS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.INITIAL_SONGS)) {
        // 对于初始歌曲列表，使用固定的key
        db.createObjectStore(STORES.INITIAL_SONGS);
      }
    };
  });
}

/**
 * 将数据保存到IndexedDB
 * @param {string} storeName - 存储名称
 * @param {*} data - 要保存的数据
 * @param {string|number} key - 数据的键（对于有keyPath的存储可以省略）
 * @returns {Promise<void>}
 */
async function saveToIndexedDB(storeName, data, key = null) {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      // 确保数据可序列化
      const serializedData = makeSerializable(data);

      let request;
      if (key !== null) {
        request = store.put(serializedData, key);
      } else {
        request = store.put(serializedData);
      }

      request.onsuccess = () => resolve();
      request.onerror = (event) => {
        console.error(`[DataCache] 保存到${storeName}失败:`, event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error(`[DataCache] 保存到IndexedDB失败:`, error);
    // 失败时不抛出错误，继续使用内存缓存
  }
}

/**
 * 从IndexedDB获取数据
 * @param {string} storeName - 存储名称
 * @param {string|number} key - 数据的键
 * @returns {Promise<*>} 获取的数据
 */
async function getFromIndexedDB(storeName, key) {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = (event) => {
        const result = event.target.result;

        // 检查缓存是否过期
        if (result && result.timestamp) {
          const expiry = CACHE_EXPIRY[storeName.toUpperCase()] || 24 * 60 * 60 * 1000;
          if (Date.now() - result.timestamp > expiry) {
            resolve(null); // 缓存已过期
            return;
          }
        }

        resolve(result);
      };

      request.onerror = (event) => {
        console.error(`[DataCache] 从${storeName}获取失败:`, event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error(`[DataCache] 从IndexedDB获取失败:`, error);
    return null;
  }
}

/**
 * 设置已初始化标志
 * @param {boolean} value - 初始化状态
 */
export const setInitialized = (value) => {
  initialized = value;
};

/**
 * 检查是否已初始化
 * @returns {boolean} 初始化状态
 */
export const isInitialized = () => initialized;

/**
 * 缓存搜索结果
 * @param {string} keyword - 搜索关键词
 * @param {Array} songs - 搜索结果歌曲列表
 */
export const cacheSearchResults = async (keyword, songs) => {
  if (!keyword || !songs) return;

  const data = {
    keyword,
    songs,
    timestamp: Date.now()
  };

  // 内存缓存
  cachedData.searchResults[keyword] = data;

  // IndexedDB缓存
  await saveToIndexedDB(STORES.SEARCH_RESULTS, data);

  // console.log(`[DataCache] 缓存搜索结果: "${keyword}", ${songs.length}首歌曲`);
};

/**
 * 获取缓存的搜索结果
 * @param {string} keyword - 搜索关键词
 * @returns {Array|null} 搜索结果歌曲列表或null
 */
export const getCachedSearchResults = async (keyword) => {
  if (!keyword) return null;

  // 先尝试从内存缓存获取
  if (cachedData.searchResults[keyword]) {
    const cached = cachedData.searchResults[keyword];
    // console.log(`[DataCache] 使用内存缓存的搜索结果: "${keyword}", ${cached.songs.length}首歌曲`);
    return cached.songs;
  }

  // 从IndexedDB获取
  try {
    const result = await getFromIndexedDB(STORES.SEARCH_RESULTS, keyword);
    if (result && result.songs) {
      // 更新内存缓存
      cachedData.searchResults[keyword] = result;
      // console.log(`[DataCache] 使用IndexedDB缓存的搜索结果: "${keyword}", ${result.songs.length}首歌曲`);
      return result.songs;
    }
  } catch (error) {
    console.error(`[DataCache] 获取缓存的搜索结果失败:`, error);
  }

  return null;
};

/**
 * 缓存初始歌曲列表
 * @param {Array} songs - 初始歌曲列表
 */
export const cacheInitialSongs = async (songs) => {
  if (!songs) return;

  const data = {
    songs,
    timestamp: Date.now()
  };

  // 内存缓存
  cachedData.initialSongs = data;

  // IndexedDB缓存 - 使用固定的key 'initialSongs'
  await saveToIndexedDB(STORES.INITIAL_SONGS, data, 'initialSongs');

  // console.log(`[DataCache] 缓存初始歌曲列表: ${songs.length}首歌曲`);
};

/**
 * 获取缓存的初始歌曲列表
 * @returns {Array|null} 初始歌曲列表或null
 */
export const getCachedInitialSongs = async () => {
  // 先尝试从内存缓存获取
  if (cachedData.initialSongs) {
    // console.log(`[DataCache] 使用内存缓存的初始歌曲列表: ${cachedData.initialSongs.songs.length}首歌曲`);
    return cachedData.initialSongs.songs;
  }

  // 从IndexedDB获取
  try {
    const result = await getFromIndexedDB(STORES.INITIAL_SONGS, 'initialSongs');
    if (result && result.songs) {
      // 更新内存缓存
      cachedData.initialSongs = result;
      // console.log(`[DataCache] 使用IndexedDB缓存的初始歌曲列表: ${result.songs.length}首歌曲`);
      return result.songs;
    }
  } catch (error) {
    console.error(`[DataCache] 获取缓存的初始歌曲列表失败:`, error);
  }

  return null;
};

/**
 * 缓存歌曲详情 (包括URL, duration, isFallbackDirect等)
 * @param {number} songId - 歌曲ID
 * @param {object} songDetails - 包含歌曲URL、时长等信息的对象
 */
export const cacheSongUrl = async (songId, songDetails) => {
  if (!songId || !songDetails || (!songDetails.url && !songDetails.directPlayUrl)) {
    console.warn(`[DataCache] 缓存歌曲详情失败: ID ${songId} 或 songDetails 无效 (无url或directPlayUrl)`, songDetails);
    return;
  }

  const data = {
    id: songId,
    details: songDetails,
    timestamp: Date.now()
  };

  // 内存缓存
  if (!cachedData.songs[songId]) {
    cachedData.songs[songId] = {};
  }
  cachedData.songs[songId].details = songDetails;
  cachedData.songs[songId].timestamp = Date.now();

  // IndexedDB缓存
  await saveToIndexedDB(STORES.SONGS, data);

  // console.log(`[DataCache] 缓存歌曲详情: ID ${songId}`, songDetails);
};

/**
 * 获取缓存的歌曲详情
 * @param {number} songId - 歌曲ID
 * @returns {object|null} 包含url, duration, isFallbackDirect等的songDetails对象或null
 */
export const getCachedSongUrl = async (songId) => {
  if (!songId) return null;

  // 先尝试从内存缓存获取
  if (cachedData.songs[songId] && cachedData.songs[songId].details) {
    // console.log(`[DataCache] 使用内存缓存的歌曲详情: ID ${songId}`, cachedData.songs[songId].details);
    // 确保返回的对象中包含时间戳
    return {
      ...cachedData.songs[songId].details,
      timestamp: cachedData.songs[songId].timestamp || Date.now() - 8 * 24 * 60 * 60 * 1000 // 如果没有时间戳，设置为8天前（确保会刷新）
    };
  }

  // 从IndexedDB获取
  try {
    const result = await getFromIndexedDB(STORES.SONGS, songId);
    if (result && result.details) {
      // 更新内存缓存
      if (!cachedData.songs[songId]) {
        cachedData.songs[songId] = {};
      }
      cachedData.songs[songId].details = result.details;
      cachedData.songs[songId].timestamp = result.timestamp || Date.now() - 8 * 24 * 60 * 60 * 1000;

      // console.log(`[DataCache] 使用IndexedDB缓存的歌曲详情: ID ${songId}`, result.details);
      // 确保返回的对象中包含时间戳
      return {
        ...result.details,
        timestamp: result.timestamp || Date.now() - 8 * 24 * 60 * 60 * 1000 // 如果没有时间戳，设置为8天前（确保会刷新）
      };
    }
  } catch (error) {
    console.error(`[DataCache] 获取缓存的歌曲详情失败:`, error);
  }

  return null;
};

/**
 * 缓存歌曲歌词
 * @param {number} songId - 歌曲ID
 * @param {object} lyrics - 歌词对象，包含lrc和tlyric
 */
export const cacheLyrics = async (songId, lyrics) => {
  if (!songId || !lyrics) return;

  const data = {
    id: songId,
    lyrics: lyrics,
    timestamp: Date.now()
  };

  // 内存缓存
  if (!cachedData.songs[songId]) {
    cachedData.songs[songId] = {};
  }
  cachedData.songs[songId].lyrics = lyrics;
  cachedData.songs[songId].lyricsTimestamp = Date.now();

  // 确保歌词对象不包含无法序列化的内容
  lyrics = makeSerializable(lyrics);

  // IndexedDB缓存 - 合并现有数据
  try {
    const existing = await getFromIndexedDB(STORES.SONGS, songId);
    if (existing) {
      existing.lyrics = lyrics;
      existing.lyricsTimestamp = Date.now();
      await saveToIndexedDB(STORES.SONGS, existing);
    } else {
      await saveToIndexedDB(STORES.SONGS, data);
    }
  } catch (error) {
    console.error(`[DataCache] 缓存歌词失败:`, error);
  }
};

/**
 * 获取缓存的歌词
 * @param {number} songId - 歌曲ID
 * @returns {object|null} 歌词对象或null
 */
export const getCachedLyrics = async (songId) => {
  if (!songId) return null;

  // 先尝试从内存缓存获取
  if (cachedData.songs[songId] && cachedData.songs[songId].lyrics) {
    return cachedData.songs[songId].lyrics;
  }

  // 从IndexedDB获取
  try {
    const result = await getFromIndexedDB(STORES.SONGS, songId);
    if (result && result.lyrics) {
      // 更新内存缓存
      if (!cachedData.songs[songId]) {
        cachedData.songs[songId] = {};
      }
      cachedData.songs[songId].lyrics = result.lyrics;
      cachedData.songs[songId].lyricsTimestamp = result.lyricsTimestamp || result.timestamp;

      return result.lyrics;
    }
  } catch (error) {
    console.error(`[DataCache] 获取缓存的歌词失败:`, error);
  }

  return null;
};

/**
 * 缓存当前播放状态
 * @param {object} state - 播放状态对象
 */
export const cachePlayState = (state) => {
  if (!state) return;

  // 将状态保存到localStorage，确保APP关闭后仍能恢复
  try {
    localStorage.setItem('cached_play_state', JSON.stringify(state));
    // console.log(`[DataCache] 缓存播放状态`);
  } catch (error) {
    console.error(`[DataCache] 缓存播放状态失败:`, error);
  }
};

/**
 * 获取缓存的播放状态
 * @returns {object|null} 播放状态对象或null
 */
export const getCachedPlayState = () => {
  try {
    const state = localStorage.getItem('cached_play_state');
    if (!state) return null;

    // console.log(`[DataCache] 使用缓存的播放状态`);
    return JSON.parse(state);
  } catch (error) {
    console.error(`[DataCache] 获取缓存的播放状态失败:`, error);
    return null;
  }
};

/**
 * 清除所有缓存数据
 */
export const clearAllCache = async () => {
  // 清除内存缓存
  cachedData.playlists = {};
  cachedData.songs = {};
  cachedData.searchResults = {};
  cachedData.mvs = {};
  cachedData.initialSongs = null;

  // 清除localStorage缓存
  try {
    localStorage.removeItem('cached_play_state');
  } catch (error) {
    console.error(`[DataCache] 清除localStorage缓存失败:`, error);
  }

  // 清除IndexedDB缓存
  try {
    const db = await openDatabase();
    const stores = [STORES.PLAYLISTS, STORES.SONGS, STORES.SEARCH_RESULTS, STORES.MVS, STORES.INITIAL_SONGS];

    for (const storeName of stores) {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = (event) => {
          console.error(`[DataCache] 清除${storeName}失败:`, event.target.error);
          reject(event.target.error);
        };
      });
    }

    db.close();
    console.log(`[DataCache] 所有IndexedDB缓存已清除`);
  } catch (error) {
    console.error(`[DataCache] 清除IndexedDB缓存失败:`, error);
  }

  // 通知Service Worker清除API缓存
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      action: 'clearApiCache'
    });
  }

  console.log(`[DataCache] 清除所有缓存数据完成`);
};

/**
 * 重置所有最后更新时间标记
 * 当应用启动时调用，确保能正确检测首次加载
 */
export const resetLastUpdateTime = () => {
  try {
    // 清除所有与最后更新时间相关的localStorage项
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('last_update_') || key.includes('_timestamp'))) {
        keysToRemove.push(key);
      }
    }

    // 分开移除以避免在循环中修改集合
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`[DataCache] 重置最后更新时间: ${key}`);
    });

    console.log(`[DataCache] 已重置${keysToRemove.length}个时间标记`);
  } catch (error) {
    console.error('[DataCache] 重置最后更新时间失败:', error);
  }
}; 