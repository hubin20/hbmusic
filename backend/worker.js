/**
 * hbmusic API Worker
 * 将Express后端转换为Cloudflare Workers格式
 */
import { Router } from 'itty-router';
import { cors } from './cors';

// 创建路由器
const router = Router();
const API_BASE_URL = 'https://api.931125.xyz';

// 处理CORS预检请求
router.options('*', cors());

/**
 * 获取推荐歌曲 (每日推荐)
 */
router.get('/api/recommend/songs', async (request) => {
  try {
    const response = await fetch(`${API_BASE_URL}/recommend/songs`);
    const data = await response.json();

    return cors()(new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (error) {
    return cors()(new Response(JSON.stringify({
      message: '获取推荐歌曲失败',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
});

// 不带前缀的推荐歌曲路由
router.get('/recommend/songs', async (request) => {
  try {
    const response = await fetch(`${API_BASE_URL}/recommend/songs`);
    const data = await response.json();

    return cors()(new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (error) {
    return cors()(new Response(JSON.stringify({
      message: '获取推荐歌曲失败',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
});

/**
 * 搜索歌曲
 */
router.get('/api/search', async (request) => {
  const url = new URL(request.url);
  const keywords = url.searchParams.get('keywords');

  if (!keywords) {
    return cors()(new Response(JSON.stringify({
      message: '缺少关键词参数 (keywords)'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  try {
    const response = await fetch(`${API_BASE_URL}/search?keywords=${encodeURIComponent(keywords)}`);
    const data = await response.json();

    return cors()(new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (error) {
    return cors()(new Response(JSON.stringify({
      message: '搜索歌曲失败',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
});

// 不带前缀的搜索路由
router.get('/search', async (request) => {
  const url = new URL(request.url);
  const keywords = url.searchParams.get('keywords');

  if (!keywords) {
    return cors()(new Response(JSON.stringify({
      message: '缺少关键词参数(keywords)'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  try {
    const response = await fetch(`${API_BASE_URL}/search?keywords=${encodeURIComponent(keywords)}`);
    const data = await response.json();

    return cors()(new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (error) {
    return cors()(new Response(JSON.stringify({
      message: '搜索歌曲失败',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
});

/**
 * 获取歌曲播放链接
 */
router.get('/api/song/url', async (request) => {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return cors()(new Response(JSON.stringify({
      message: '缺少歌曲 ID 参数 (id)'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  try {
    const response = await fetch(`${API_BASE_URL}/song/url/v1?id=${id}&level=exhigh`);
    const data = await response.json();

    return cors()(new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (error) {
    return cors()(new Response(JSON.stringify({
      message: '获取歌曲链接失败',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
});

// 不带前缀的歌曲URL路由
router.get('/song/url', async (request) => {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return cors()(new Response(JSON.stringify({
      message: '缺少歌曲 ID 参数 (id)'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  try {
    const response = await fetch(`${API_BASE_URL}/song/url/v1?id=${id}&level=exhigh`);
    const data = await response.json();

    return cors()(new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (error) {
    return cors()(new Response(JSON.stringify({
      message: '获取歌曲链接失败',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
});

/**
 * 获取歌曲歌词
 */
router.get('/api/lyric', async (request) => {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return cors()(new Response(JSON.stringify({
      error: 'Song ID is required'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  try {
    const response = await fetch(`${API_BASE_URL}/lyric?id=${id}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const data = await response.json();

    return cors()(new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (error) {
    return cors()(new Response(JSON.stringify({
      error: 'Failed to fetch lyrics',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
});

// 不带前缀的歌词路由
router.get('/lyric', async (request) => {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return cors()(new Response(JSON.stringify({
      error: 'Song ID is required'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  try {
    const response = await fetch(`${API_BASE_URL}/lyric?id=${id}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const data = await response.json();

    return cors()(new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (error) {
    return cors()(new Response(JSON.stringify({
      error: 'Failed to fetch lyrics',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
});

/**
 * 获取用户歌单 (API路径)
 */
router.get('/api/user/playlist', async (request) => {
  const url = new URL(request.url);
  const uid = url.searchParams.get('uid');

  if (!uid) {
    return cors()(new Response(JSON.stringify({
      code: 400,
      message: '缺少用户ID参数'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  try {
    const response = await fetch(`${API_BASE_URL}/user/playlist?uid=${uid}`);
    const data = await response.json();

    return cors()(new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (error) {
    return cors()(new Response(JSON.stringify({
      code: 500,
      message: '获取用户歌单失败'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
});

/**
 * 获取用户歌单 (直接路径)
 */
router.get('/user/playlist', async (request) => {
  const url = new URL(request.url);
  const uid = url.searchParams.get('uid');

  if (!uid) {
    return cors()(new Response(JSON.stringify({
      code: 400,
      message: '缺少用户ID参数'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  try {
    const response = await fetch(`${API_BASE_URL}/user/playlist?uid=${uid}`);
    const data = await response.json();

    return cors()(new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (error) {
    return cors()(new Response(JSON.stringify({
      code: 500,
      message: '获取用户歌单失败'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
});

// 添加播放列表详情路由
router.get('/playlist/detail', async (request) => {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return cors()(new Response(JSON.stringify({
      code: 400,
      message: '缺少播放列表ID参数'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  try {
    const response = await fetch(`${API_BASE_URL}/playlist/detail?id=${id}`);
    const data = await response.json();

    return cors()(new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (error) {
    return cors()(new Response(JSON.stringify({
      code: 500,
      message: '获取播放列表详情失败'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
});

// 添加播放列表歌曲路由
router.get('/playlist/track/all', async (request) => {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const limit = url.searchParams.get('limit') || 50;
  const offset = url.searchParams.get('offset') || 0;

  if (!id) {
    return cors()(new Response(JSON.stringify({
      code: 400,
      message: '缺少播放列表ID参数'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  try {
    const response = await fetch(`${API_BASE_URL}/playlist/track/all?id=${id}&limit=${limit}&offset=${offset}`);
    const data = await response.json();

    return cors()(new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (error) {
    return cors()(new Response(JSON.stringify({
      code: 500,
      message: '获取播放列表歌曲失败'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
});

// 添加处理 /p-11 请求的路由
router.get('/p-11', async (request) => {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return cors()(new Response(JSON.stringify({
      code: 400,
      message: '缺少ID参数'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  try {
    // 从错误信息来看，这个请求应该是获取播放列表详情
    const response = await fetch(`${API_BASE_URL}/playlist/detail?id=${id}`);
    const data = await response.json();

    return cors()(new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (error) {
    return cors()(new Response(JSON.stringify({
      code: 500,
      message: '获取详情失败',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
});

// 处理404路由
router.all('*', () => {
  return cors()(new Response(JSON.stringify({
    error: 'Not Found'
  }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  }));
});

// 导出fetch处理函数
export default {
  async fetch(request, env, ctx) {
    // 确保所有URL都是HTTPS
    if (env.API_BASE_URL && !env.API_BASE_URL.startsWith('https://')) {
      env.API_BASE_URL = env.API_BASE_URL.replace('http://', 'https://');
    }
    return router.handle(request);
  }
}; 