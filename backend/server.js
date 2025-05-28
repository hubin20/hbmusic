const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = 3000; // 您可以根据需要更改端口

app.use(cors()); // 允许所有来源的跨域请求，生产环境中建议配置更严格的规则
app.use(express.json()); // 用于解析 JSON 请求体

const API_BASE_URL = 'https://api.931125.xyz';

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
  const { keywords } = req.query;
  if (!keywords) {
    return res.status(400).json({ message: '缺少关键词参数 (keywords)' });
  }
  try {
    const response = await axios.get(`${API_BASE_URL}/search`, {
      params: { keywords },
    });
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
  try {
    // 注意：根据 API 文档，获取歌曲 URL 可能需要 /song/url/v1
    // 请确认您使用的 API 文档中正确的端点
    const response = await axios.get(`${API_BASE_URL}/song/url/v1`, { // 或者 /song/url，取决于API版本
      params: { id, level: 'exhigh' }, // level 参数可以调整音质
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

  const targetUrl = `${API_BASE_URL}/lyric`;
  console.log(`[Backend /api/lyric] Attempting to fetch lyrics from: ${targetUrl} with params:`, { id });

  try {
    const response = await axios.get(targetUrl, {
      params: { id },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    console.log(`[Backend /api/lyric] Upstream API (${targetUrl}) response status: ${response.status}`);
    console.log(`[Backend /api/lyric] Upstream API (${targetUrl}) response data:`, JSON.stringify(response.data, null, 2));
    res.json(response.data);
  } catch (error) {
    console.error(`[Backend /api/lyric] Error fetching lyrics from upstream API (${targetUrl}):`, error.message);
    if (error.response) {
      console.error(`[Backend /api/lyric] Upstream API (${targetUrl}) error status: ${error.response.status}`);
      console.error(`[Backend /api/lyric] Upstream API (${targetUrl}) error data:`, JSON.stringify(error.response.data, null, 2));
      return res.status(error.response.status).json({
        message: 'Error from upstream API when fetching lyrics',
        source: targetUrl,
        details: error.response.data
      });
    }
    console.error(`[Backend /api/lyric] Non-HTTP error details while fetching from ${targetUrl}:`, error);
    res.status(500).json({ error: 'Failed to fetch lyrics', source: targetUrl, details: error.message });
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
