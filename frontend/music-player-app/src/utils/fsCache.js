/**
 * 文件系统缓存工具
 * 用于将数据持久化存储到文件系统，提高应用性能
 */

// 文件系统缓存根目录
const FS_CACHE_DIR = 'D:/hbmusic/cache';

// 缓存文件类型
const CACHE_TYPES = {
  PLAYLIST: 'playlist',
  SONG: 'song',
  SEARCH: 'search',
  MV: 'mv',
  INITIAL: 'initial'
};

// 缓存有效期（毫秒）
const CACHE_TTL = {
  PLAYLIST: 24 * 60 * 60 * 1000, // 歌单缓存24小时
  SONG: 7 * 24 * 60 * 60 * 1000, // 歌曲缓存7天
  SEARCH: 12 * 60 * 60 * 1000,   // 搜索结果缓存12小时
  MV: 24 * 60 * 60 * 1000,       // MV缓存24小时
  INITIAL: 24 * 60 * 60 * 1000   // 初始数据缓存24小时
};

/**
 * 确保缓存目录存在
 * @returns {Promise<boolean>} 是否成功创建目录
 */
const ensureCacheDir = async () => {
  try {
    const fs = window.require('fs');
    const path = window.require('path');
    
    if (!fs.existsSync(FS_CACHE_DIR)) {
      fs.mkdirSync(FS_CACHE_DIR, { recursive: true });
    }
    
    // 创建子目录
    Object.values(CACHE_TYPES).forEach(type => {
      const typePath = path.join(FS_CACHE_DIR, type);
      if (!fs.existsSync(typePath)) {
        fs.mkdirSync(typePath, { recursive: true });
      }
    });
    
    return true;
  } catch (error) {
    console.error(`[FSCache] 创建缓存目录失败:`, error);
    return false;
  }
};

/**
 * 从文件系统读取缓存
 * @param {string} type - 缓存类型
 * @param {string} key - 缓存键
 * @returns {Promise<any|null>} 缓存数据或null
 */
export const readFromFileCache = async (type, key) => {
  try {
    const fs = window.require('fs').promises;
    const path = window.require('path');
    
    // 安全处理键名，避免路径注入
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(FS_CACHE_DIR, type, `${safeKey}.json`);
    
    // 检查文件是否存在
    try {
      await fs.access(filePath);
    } catch (err) {
      // 文件不存在
      return null;
    }
    
    const data = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(data);
    
    // 检查缓存是否过期
    if (parsed.timestamp && Date.now() - parsed.timestamp > CACHE_TTL[type.toUpperCase()]) {
      console.log(`[FSCache] 文件缓存已过期: ${type}/${safeKey}`);
      // 异步删除过期缓存文件
      fs.unlink(filePath).catch(() => {});
      return null;
    }
    
    console.log(`[FSCache] 从文件缓存读取: ${type}/${safeKey}`);
    return parsed.data;
  } catch (error) {
    console.error(`[FSCache] 读取缓存失败: ${type}/${key}`, error);
    // 如果文件不存在或读取错误，返回null
    return null;
  }
};

/**
 * 写入文件系统缓存
 * @param {string} type - 缓存类型
 * @param {string} key - 缓存键
 * @param {any} data - 要缓存的数据
 * @returns {Promise<boolean>} 是否成功写入
 */
export const writeToFileCache = async (type, key, data) => {
  try {
    await ensureCacheDir();
    
    const fs = window.require('fs').promises;
    const path = window.require('path');
    
    // 安全处理键名，避免路径注入
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(FS_CACHE_DIR, type, `${safeKey}.json`);
    
    const cacheData = {
      timestamp: Date.now(),
      data: data
    };
    
    await fs.writeFile(filePath, JSON.stringify(cacheData), 'utf8');
    console.log(`[FSCache] 写入文件缓存: ${type}/${safeKey}`);
    return true;
  } catch (error) {
    console.error(`[FSCache] 写入文件缓存失败: ${type}/${key}`, error);
    return false;
  }
};

/**
 * 清除指定类型的缓存
 * @param {string} type - 缓存类型，不指定则清除所有
 * @returns {Promise<boolean>} 是否成功清除
 */
export const clearFileCache = async (type = null) => {
  try {
    const fs = window.require('fs').promises;
    const path = window.require('path');
    const fsSync = window.require('fs');
    
    if (type) {
      // 清除指定类型的缓存
      const typePath = path.join(FS_CACHE_DIR, type);
      if (fsSync.existsSync(typePath)) {
        const files = await fs.readdir(typePath);
        for (const file of files) {
          await fs.unlink(path.join(typePath, file));
        }
      }
    } else {
      // 清除所有类型的缓存
      for (const cacheType of Object.values(CACHE_TYPES)) {
        const typePath = path.join(FS_CACHE_DIR, cacheType);
        if (fsSync.existsSync(typePath)) {
          const files = await fs.readdir(typePath);
          for (const file of files) {
            await fs.unlink(path.join(typePath, file));
          }
        }
      }
    }
    
    console.log(`[FSCache] 清除${type ? type + '类型的' : '所有'}文件缓存`);
    return true;
  } catch (error) {
    console.error(`[FSCache] 清除文件缓存失败:`, error);
    return false;
  }
};

/**
 * 获取缓存统计信息
 * @returns {Promise<object>} 缓存统计信息
 */
export const getCacheStats = async () => {
  try {
    const fs = window.require('fs').promises;
    const path = window.require('path');
    const fsSync = window.require('fs');
    
    const stats = {};
    let totalSize = 0;
    let totalFiles = 0;
    
    for (const cacheType of Object.values(CACHE_TYPES)) {
      const typePath = path.join(FS_CACHE_DIR, cacheType);
      stats[cacheType] = { files: 0, size: 0 };
      
      if (fsSync.existsSync(typePath)) {
        const files = await fs.readdir(typePath);
        stats[cacheType].files = files.length;
        totalFiles += files.length;
        
        for (const file of files) {
          const fileStat = await fs.stat(path.join(typePath, file));
          stats[cacheType].size += fileStat.size;
          totalSize += fileStat.size;
        }
      }
    }
    
    return {
      types: stats,
      total: {
        files: totalFiles,
        size: totalSize,
        sizeFormatted: formatSize(totalSize)
      }
    };
  } catch (error) {
    console.error(`[FSCache] 获取缓存统计信息失败:`, error);
    return null;
  }
};

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小
 */
const formatSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 导出缓存类型常量
export { CACHE_TYPES };