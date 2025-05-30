import axios from 'axios';

// API基础URL - 使用环境变量
const BASE_URL = import.meta.env.VITE_BACKEND_API_URL || 'https://api.931125.xyz';
// 酷我API基础URL
const KW_API_URL = import.meta.env.VITE_KW_API_URL || 'https://kw-api.cenguigui.cn';

/**
 * 获取推荐歌单列表
 * @param {number} limit - 每页数量
 * @param {number} offset - 分页偏移量
 * @returns {Promise} 返回歌单列表数据
 */
export const getPlaylists = async (limit = 20, offset = 0) => {
  try {
    const response = await axios.get(`${BASE_URL}/top/playlist`, {
      params: { limit, offset }
    });
    return response.data;
  } catch (error) {
    console.error('获取歌单列表失败:', error);
    throw error;
  }
};

/**
 * 获取精品歌单
 * @param {string} cat - 歌单分类
 * @param {number} limit - 每页数量
 * @param {number} before - 分页参数,取上一页最后一个歌单的 updateTime 获取下一页数据
 * @returns {Promise} 返回精品歌单列表数据
 */
export const getHighqualityPlaylists = async (cat = '全部', limit = 20, before = 0) => {
  try {
    const params = { limit };
    if (cat !== '全部') params.cat = cat;
    if (before) params.before = before;

    const response = await axios.get(`${BASE_URL}/top/playlist/highquality`, { params });
    return response.data;
  } catch (error) {
    console.error('获取精品歌单失败:', error);
    throw error;
  }
};

/**
 * 获取歌单详情
 * @param {number|string} id - 歌单ID
 * @returns {Promise} 返回歌单详情数据
 */
export const getPlaylistDetail = async (id) => {
  try {
    const response = await axios.get(`${BASE_URL}/playlist/detail`, {
      params: { id }
    });
    return response.data;
  } catch (error) {
    console.error('获取歌单详情失败:', error);
    throw error;
  }
};

/**
 * 获取歌单中的所有歌曲
 * @param {number|string} id - 歌单ID
 * @param {number} limit - 每页数量
 * @param {number} offset - 分页偏移量
 * @returns {Promise} 返回歌单歌曲列表
 */
export const getPlaylistTracks = async (id, limit = 50, offset = 0) => {
  try {
    const response = await axios.get(`${BASE_URL}/playlist/track/all`, {
      params: { id, limit, offset }
    });
    return response.data;
  } catch (error) {
    console.error('获取歌单歌曲失败:', error);
    throw error;
  }
};

/**
 * 获取歌曲URL
 * @param {number|string} id - 歌曲ID
 * @returns {Promise} 返回歌曲URL数据
 */
export const getSongUrl = async (id) => {
  try {
    const response = await axios.get(`${BASE_URL}/song/url`, {
      params: { id }
    });
    return response.data;
  } catch (error) {
    console.error('获取歌曲URL失败:', error);
    throw error;
  }
};

/**
 * 获取歌词
 * @param {number|string} id - 歌曲ID
 * @returns {Promise} 返回歌词数据
 */
export const getLyrics = async (id) => {
  try {
    const response = await axios.get(`${BASE_URL}/lyric`, {
      params: { id }
    });
    return response.data;
  } catch (error) {
    console.error('获取歌词失败:', error);
    throw error;
  }
};

/**
 * 搜索歌曲
 * @param {string} keywords - 搜索关键词
 * @param {number} limit - 每页数量
 * @param {number} offset - 分页偏移量
 * @returns {Promise} 返回搜索结果
 */
export const searchSongs = async (keywords, limit = 30, offset = 0) => {
  try {
    const response = await axios.get(`${BASE_URL}/search`, {
      params: { keywords, limit, offset, type: 1 }
    });
    return response.data;
  } catch (error) {
    console.error('搜索歌曲失败:', error);
    throw error;
  }
};

/**
 * 获取推荐歌单分类
 * @returns {Promise} 返回歌单分类数据
 */
export const getPlaylistCatlist = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/playlist/catlist`);
    return response.data;
  } catch (error) {
    console.error('获取歌单分类失败:', error);
    throw error;
  }
};

/**
 * 根据分类获取歌单
 * @param {string} cat - 歌单分类
 * @param {number} limit - 每页数量
 * @param {number} offset - 分页偏移量
 * @returns {Promise} 返回指定分类的歌单列表
 */
export const getPlaylistsByCategory = async (cat = '全部', limit = 20, offset = 0) => {
  try {
    const response = await axios.get(`${BASE_URL}/top/playlist`, {
      params: { cat, limit, offset }
    });
    return response.data;
  } catch (error) {
    console.error('获取分类歌单失败:', error);
    throw error;
  }
};

/**
 * 获取榜单列表
 * @returns {Promise} 返回榜单列表数据
 */
export const getTopLists = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/toplist`);
    return response.data;
  } catch (error) {
    console.error('获取榜单列表失败:', error);
    throw error;
  }
};

/**
 * 获取MV排行榜
 * @param {number} limit - 每页数量
 * @param {number} offset - 分页偏移量
 * @returns {Promise} 返回MV排行榜数据
 */
export const getTopMvs = async (limit = 20, offset = 0) => {
  try {
    const response = await axios.get(`${BASE_URL}/top/mv`, {
      params: { limit, offset }
    });
    return response.data;
  } catch (error) {
    console.error('获取MV排行榜失败:', error);
    throw error;
  }
};

/**
 * 获取用户歌单
 * @param {string} uid - 用户ID
 * @param {number} limit - 每页数量
 * @param {number} offset - 分页偏移量
 * @param {boolean} noCache - 是否禁用缓存
 * @returns {Promise} - 返回用户歌单数据
 */
export const getUserPlaylists = async (uid, limit = 30, offset = 0, noCache = false) => {
  try {
    const params = { uid, limit, offset };

    // 添加时间戳参数避免缓存
    if (noCache) {
      params.timestamp = Date.now();
      console.log(`[API] getUserPlaylists 禁用缓存，添加时间戳: ${params.timestamp}`);
    }

    console.log(`[API] 获取用户歌单, 参数:`, params);
    const response = await axios.get(`${BASE_URL}/user/playlist`, {
      params
    });
    console.log(`[API] 获取用户歌单成功, 状态码: ${response.status}, 歌单数量: ${response.data?.playlist?.length || 0}`);
    return response.data;
  } catch (error) {
    console.error('获取用户歌单失败:', error);
    throw error;
  }
};

/**
 * 获取酷我推荐歌单
 * @param {string} name - 精选/最热，默认精选
 * @param {number} page - 页数
 * @param {number} limit - 每页数量
 * @returns {Promise} 返回酷我推荐歌单数据
 */
export const getKwPlaylists = async (name = '精选', page = 1, limit = 30) => {
  try {
    const response = await axios.get(`${KW_API_URL}`, {
      params: { name, page, limit, type: 'rcmlist' }
    });
    return response.data;
  } catch (error) {
    console.error('获取酷我推荐歌单失败:', error);
    throw error;
  }
};

/**
 * 获取酷我歌单详情
 * @param {string|number} id - 歌单ID
 * @param {number} page - 页数
 * @param {number} limit - 每页数量
 * @returns {Promise} 返回酷我歌单详情数据
 */
export const getKwPlaylistDetail = async (id, page = 1, limit = 30) => {
  try {
    // 处理带有"kw-"前缀的ID
    const realId = id.toString().startsWith('kw-') ? id.toString().substring(3) : id;

    const response = await axios.get(`${KW_API_URL}`, {
      params: { id: realId, page, limit, type: 'list' }
    });
    return response.data;
  } catch (error) {
    console.error('获取酷我歌单详情失败:', error);
    throw error;
  }
};

export default {
  getPlaylists,
  getPlaylistDetail,
  getPlaylistTracks,
  getSongUrl,
  getLyrics,
  searchSongs,
  getPlaylistCatlist,
  getPlaylistsByCategory,
  getTopLists,
  getTopMvs,
  getUserPlaylists,
  getKwPlaylists,
  getKwPlaylistDetail,
  getHighqualityPlaylists
}; 