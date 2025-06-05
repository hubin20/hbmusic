const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// 加载环境变量配置
let envConfig = {};
try {
  // 尝试读取.env文件（如果存在）
  const envPath = path.resolve(__dirname, '../frontend/music-player-app/.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (key && value) {
          envConfig[key] = value;
        }
      }
    });
    console.log('已从.env文件加载配置');
  }
} catch (err) {
  console.warn('无法加载.env文件配置:', err.message);
}

const app = express();
const port = process.env.PORT || 3000; // 端口可配置

// 定义允许的域名列表
const allowedOrigins = [
  'http://localhost:5173',
  'https://localhost:5173',
  'http://localhost',
  'https://localhost',
  'https://music.931125.xyz',
  'http://music.931125.xyz',
  'https://er-sycdn.kuwo.cn',
  'http://er-sycdn.kuwo.cn',
  'https://kw-api.cenguigui.cn',
  'http://kw-api.cenguigui.cn'
];

// 检查是否是允许的域名，包括er-sycdn.kuwo.cn的子域名
function isAllowedOrigin(origin) {
  if (!origin) return false;

  // 检查是否在允许列表中
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // 检查是否是er-sycdn.kuwo.cn的子域名
  try {
    if (origin.includes('er-sycdn.kuwo.cn') ||
      origin.includes('.kuwo.cn') ||
      origin === 'http://kuwo.cn' ||
      origin === 'https://kuwo.cn') {
      return true;
    }
  } catch (e) {
    // 如果解析失败，返回false
    return false;
  }

  return false;
}

// 配置CORS中间件
app.use(cors({
  origin: function (origin, callback) {
    // 允许没有origin的请求（比如同源请求）
    if (!origin) return callback(null, true);

    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS拒绝来自 ${origin} 的请求`);
      callback(new Error('不允许的跨域请求'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // 预检请求缓存24小时
}));

app.use(express.json()); // 用于解析 JSON 请求体

// 从环境变量或配置文件中获取API基础URL
const API_BASE_URL = process.env.MAIN_API_BASE || envConfig.VITE_MAIN_API_BASE || 'https://netease-cloud-music-api-five-rouge.vercel.app';
const FALLBACK_API_BASE = process.env.FALLBACK_API_BASE || envConfig.VITE_FALLBACK_API_BASE || 'https://kw-api.cenguigui.cn';

// 添加日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

/**
 * @swagger
 * /api/recommend/songs:
 *   get:
 *     summary: 获取推荐歌曲 (每日推荐)
 *     description: 调用第三方 API 获取每日推荐歌曲列表。
 *     responses:
 *       200:
 *         description: 成功获取推荐歌曲。
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       500:
 *         description: 服务器内部错误或第三方 API 请求失败。
 */
app.get('/api/recommend/songs', async (req, res) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/recommend/songs`);
    res.json(response.data);
  } catch (error) {
    console.error('获取推荐歌曲失败:', error.message);
    res.status(500).json({ message: '获取推荐歌曲失败', error: error.message });
  }
});

/**
 * @swagger
 * /api/search:
 *   get:
 *     summary: 搜索歌曲
 *     description: 根据关键词搜索歌曲。
 *     parameters:
 *       - in: query
 *         name: keywords
 *         required: true
 *         description: 搜索的关键词。
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 成功获取搜索结果。
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: 请求参数错误，缺少 keywords。
 *       500:
 *         description: 服务器内部错误或第三方 API 请求失败。
 */
app.get('/api/search', async (req, res) => {
  const { keywords, limit, offset } = req.query;
  if (!keywords) {
    return res.status(400).json({ message: '缺少关键词参数 (keywords)' });
  }
  try {
    console.log(`[Backend /api/search] 处理搜索请求，关键词: ${keywords}, 限制: ${limit || 30}, 偏移: ${offset || 0}`);

    const response = await axios.get(`${API_BASE_URL}/search`, {
      params: {
        keywords,
        limit: limit || 30,
        offset: offset || 0
      },
    });

    // 如果需要，为歌曲ID添加前缀
    if (envConfig.VITE_USE_ID_PREFIX === 'true' && response.data && response.data.result && response.data.result.songs) {
      const mainIdPrefix = process.env.MAIN_ID_PREFIX || envConfig.VITE_MAIN_ID_PREFIX || 'main_';

      // 为每首歌曲添加ID前缀
      response.data.result.songs = response.data.result.songs.map(song => ({
        ...song,
        id: `${mainIdPrefix}${song.id}` // 添加前缀
      }));

      console.log(`[Backend /api/search] 已为 ${response.data.result.songs.length} 首歌曲添加ID前缀`);
    }

    res.json(response.data);
  } catch (error) {
    console.error('搜索歌曲失败:', error.message);
    res.status(500).json({ message: '搜索歌曲失败', error: error.message });
  }
});

/**
 * @swagger
 * /api/song/url:
 *   get:
 *     summary: 获取歌曲播放链接
 *     description: 根据歌曲 ID 获取播放链接。
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         description: 歌曲的 ID。
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 成功获取歌曲播放链接。
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: 请求参数错误，缺少 id。
 *       500:
 *         description: 服务器内部错误或第三方 API 请求失败。
 */
app.get('/api/song/url', async (req, res) => {
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ message: '缺少歌曲 ID 参数 (id)' });
  }

  // 处理ID前缀，提取纯ID
  let cleanId = id;
  // 检查ID前缀并移除
  const mainIdPrefix = process.env.MAIN_ID_PREFIX || envConfig.VITE_MAIN_ID_PREFIX || 'main_';
  if (id.startsWith(mainIdPrefix)) {
    cleanId = id.substring(mainIdPrefix.length);
  }

  console.log(`[Backend /api/song/url] 处理歌曲ID请求，原始ID: ${id}, 清理后ID: ${cleanId}`);

  try {
    // 使用清理后的ID请求API
    const response = await axios.get(`${API_BASE_URL}/song/url/v1`, { // 或者 /song/url，取决于API版本
      params: { id: cleanId, level: 'lossless' }, // level 参数可以调整音质
    });
    res.json(response.data);
  } catch (error) {
    console.error('获取歌曲链接失败:', error.message);
    res.status(500).json({ message: '获取歌曲链接失败', error: error.message });
  }
});

/**
 * @swagger
 * /api/lyric:
 *   get:
 *     summary: 获取歌曲歌词
 *     description: 根据歌曲 ID 获取歌曲歌词。
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         description: 歌曲的 ID。
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 成功获取歌曲歌词。
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: 请求参数错误，缺少 id。
 *       500:
 *         description: 服务器内部错误或第三方 API 请求失败。
 */
app.get('/api/lyric', async (req, res) => {
  const { id } = req.query;
  if (!id) {
    console.log('[Backend /api/lyric] Request received without ID');
    return res.status(400).json({ error: 'Song ID is required' });
  }
  console.log(`[Backend /api/lyric] Request received for ID: ${id}`);

  // 检查是否是酷我API的歌曲ID (以kw_开头)
  if (id.startsWith('kw_')) {
    const kwId = id.substring(3); // 移除'kw_'前缀
    console.log(`[Backend /api/lyric] 检测到酷我歌曲ID: ${kwId}，重定向到酷我API`);

    try {
      // 构造酷我API的歌词请求URL
      const kwLyricsUrl = `${FALLBACK_API_BASE}?id=${kwId}&type=lyr&format=all`;
      console.log(`[Backend /api/lyric] 请求酷我歌词API: ${kwLyricsUrl}`);

      const response = await axios.get(kwLyricsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      console.log(`[Backend /api/lyric] 酷我API响应状态: ${response.status}`);

      // 处理酷我API返回的歌词数据
      if (response.data && response.data.code === 200) {
        let processedData = response.data;

        // 如果歌词是数组格式，转换为LRC格式
        if (processedData.data && Array.isArray(processedData.data.lrclist)) {
          const lrcText = processedData.data.lrclist.map(line =>
            `[${Math.floor(line.time / 60).toString().padStart(2, '0')}:${(line.time % 60).toFixed(2).padStart(5, '0')}]${line.lineLyric}`
          ).join('\n');

          // 转换为网易云API格式，便于前端统一处理
          processedData = {
            code: 200,
            lrc: {
              version: 1,
              lyric: lrcText
            }
          };

          // 尝试获取酷我歌曲详情以获取专辑图片
          try {
            const songDetailUrl = `${FALLBACK_API_BASE}?id=${kwId}&type=song&format=json&level=lossless`;
            const songDetailResponse = await axios.get(songDetailUrl);
            if (songDetailResponse.data && songDetailResponse.data.code === 200 && songDetailResponse.data.data) {
              const songData = songDetailResponse.data.data;
              if (songData.pic) {
                processedData.picUrl = songData.pic;
                console.log(`[Backend /api/lyric] 从酷我API获取到专辑图片URL: ${songData.pic}`);
              }
            }
          } catch (detailError) {
            console.error(`[Backend /api/lyric] 获取酷我歌曲详情失败:`, detailError.message);
          }
        }

        return res.json(processedData);
      } else {
        return res.json(response.data);
      }
    } catch (error) {
      console.error(`[Backend /api/lyric] 从酷我API获取歌词失败:`, error.message);
      if (error.response) {
        console.error(`[Backend /api/lyric] 酷我API错误状态: ${error.response.status}`);
        return res.status(error.response.status).json({
          message: '从酷我API获取歌词失败',
          source: kwLyricsUrl,
          details: error.response.data
        });
      }
      return res.status(500).json({ error: '从酷我API获取歌词失败', details: error.message });
    }
  }

  // 处理ID前缀，提取纯ID
  let cleanId = id;
  // 检查ID前缀并移除
  const mainIdPrefix = process.env.MAIN_ID_PREFIX || envConfig.VITE_MAIN_ID_PREFIX || 'main_';
  if (id.startsWith(mainIdPrefix)) {
    cleanId = id.substring(mainIdPrefix.length);
  }

  console.log(`[Backend /api/lyric] 处理歌词请求，原始ID: ${id}, 清理后ID: ${cleanId}`);

  const targetUrl = `${API_BASE_URL}/lyric`;
  console.log(`[Backend /api/lyric] Attempting to fetch lyrics from: ${targetUrl} with params:`, { id: cleanId });

  try {
    const response = await axios.get(targetUrl, {
      params: { id: cleanId },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    console.log(`[Backend /api/lyric] Upstream API (${targetUrl}) response status: ${response.status}`);

    // 检查歌词是否存在
    if (response.data && response.data.code === 200) {
      if (!response.data.lrc || !response.data.lrc.lyric) {
        console.log(`[Backend /api/lyric] 网易云API返回的歌词为空，返回默认歌词`);
        response.data.lrc = {
          version: 1,
          lyric: '[00:00.00]暂无歌词'
        };
      }

      // 尝试获取歌曲详情以获取专辑图片
      if (!response.data.picUrl) {
        try {
          const songDetailUrl = `${API_BASE_URL}/song/detail`;
          const songDetailResponse = await axios.get(songDetailUrl, {
            params: { ids: cleanId },
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          });

          if (songDetailResponse.data && songDetailResponse.data.code === 200 &&
            songDetailResponse.data.songs && songDetailResponse.data.songs.length > 0) {
            const songData = songDetailResponse.data.songs[0];
            if (songData.al && songData.al.picUrl) {
              response.data.picUrl = songData.al.picUrl;
              console.log(`[Backend /api/lyric] 从网易云API获取到专辑图片URL: ${songData.al.picUrl}`);
            }
          }
        } catch (detailError) {
          console.error(`[Backend /api/lyric] 获取网易云歌曲详情失败:`, detailError.message);
        }
      }
    }

    res.json(response.data);
  } catch (error) {
    console.error(`[Backend /api/lyric] Error fetching lyrics from upstream API (${targetUrl}):`, error.message);
    if (error.response) {
      console.error(`[Backend /api/lyric] Upstream API (${targetUrl}) error status: ${error.response.status}`);
      // 如果网易云API出错，返回默认歌词
      return res.json({
        code: 200,
        lrc: {
          version: 1,
          lyric: '[00:00.00]获取歌词失败'
        }
      });
    }
    console.error(`[Backend /api/lyric] Non-HTTP error details while fetching from ${targetUrl}:`, error);
    res.json({
      code: 200,
      lrc: {
        version: 1,
        lyric: '[00:00.00]获取歌词失败'
      }
    });
  }
});

// 获取用户歌单
app.get('/api/user/playlist', async (req, res) => {
  try {
    const { uid } = req.query;
    if (!uid) {
      return res.status(400).json({ code: 400, message: '缺少用户ID参数' });
    }

    // 从网易云API获取用户歌单
    const response = await axios.get(`https://api.931125.xyz/user/playlist?uid=${uid}`);
    res.json(response.data);
  } catch (error) {
    console.error('获取用户歌单失败:', error);
    res.status(500).json({ code: 500, message: '获取用户歌单失败' });
  }
});

app.listen(port, () => {
  console.log(`后端服务运行在 http://localhost:${port}`);
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});
