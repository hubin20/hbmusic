/**
 * hbmusic API Worker
 * 将Express后端转换为Cloudflare Workers格式
 */
import { Router } from 'itty-router';
import { cors } from './cors';

// 创建路由器
const router = Router();
// 定义API_BASE_URL为全局变量，这样在fetch函数中可以被重新赋值
let API_BASE_URL = 'https://api.931125.xyz';

/**
 * 将响应中的所有HTTP图片URL转换为HTTPS
 * @param {Object} data - API返回的JSON数据
 * @returns {Object} - 处理后的数据
 */
function convertHttpToHttps(data) {
  if (!data) return data;

  // 如果是字符串，检查是否为图片URL
  if (typeof data === 'string') {
    // 处理所有网易云音乐的图片域名
    if (data.startsWith('http://') && (
      data.includes('.music.126.net') ||
      data.includes('.music.127.net') ||
      data.includes('p1.music.126.net') ||
      data.includes('p2.music.126.net') ||
      data.includes('p3.music.126.net') ||
      data.includes('p4.music.126.net')
    )) {
      return data.replace('http://', 'https://');
    }
    return data;
  }

  // 如果是数组，递归处理每个元素
  if (Array.isArray(data)) {
    return data.map(item => convertHttpToHttps(item));
  }

  // 如果是对象，递归处理每个属性
  if (typeof data === 'object' && data !== null) {
    const result = {};
    for (const key in data) {
      // 特殊处理已知包含图片URL的字段
      if (['coverImgUrl', 'picUrl', 'img1v1Url', 'backgroundUrl', 'avatarUrl', 'cover', 'coverUrl', 'pic', 'al', 'album'].includes(key)) {
        if (typeof data[key] === 'string' && data[key].startsWith('http://')) {
          result[key] = data[key].replace('http://', 'https://');
        } else if (typeof data[key] === 'object' && data[key] !== null) {
          // 处理嵌套对象，例如专辑信息中的图片
          result[key] = convertHttpToHttps(data[key]);
        } else {
          result[key] = data[key];
        }
      } else {
        result[key] = convertHttpToHttps(data[key]);
      }
    }
    return result;
  }

  return data;
}

/**
 * 处理API响应，确保所有HTTP图片链接转为HTTPS
 * @param {Response} response - 从源API获取的响应
 * @returns {Promise<Response>} - 处理后的响应
 */
async function processApiResponse(response) {
  try {
    const contentType = response.headers.get('content-type');

    // 只处理JSON响应
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();

      // 先使用递归函数处理
      let processedData = convertHttpToHttps(data);

      // 再使用字符串替换彻底处理所有的URL
      const jsonString = JSON.stringify(processedData);

      // 使用正则表达式替换所有HTTP URL
      const httpsJsonString = jsonString
        // 处理具体的域名
        .replace(/http:\/\/p1\.music\.126\.net/g, 'https://p1.music.126.net')
        .replace(/http:\/\/p2\.music\.126\.net/g, 'https://p2.music.126.net')
        .replace(/http:\/\/p3\.music\.126\.net/g, 'https://p3.music.126.net')
        .replace(/http:\/\/p4\.music\.126\.net/g, 'https://p4.music.126.net')
        .replace(/http:\/\/m1\.music\.126\.net/g, 'https://m1.music.126.net')
        .replace(/http:\/\/m2\.music\.126\.net/g, 'https://m2.music.126.net')
        .replace(/http:\/\/m3\.music\.126\.net/g, 'https://m3.music.126.net')
        .replace(/http:\/\/m4\.music\.126\.net/g, 'https://m4.music.126.net')
        .replace(/http:\/\/m5\.music\.126\.net/g, 'https://m5.music.126.net')
        .replace(/http:\/\/m6\.music\.126\.net/g, 'https://m6.music.126.net')
        .replace(/http:\/\/m7\.music\.126\.net/g, 'https://m7.music.126.net')
        .replace(/http:\/\/m8\.music\.126\.net/g, 'https://m8.music.126.net')
        .replace(/http:\/\/m9\.music\.126\.net/g, 'https://m9.music.126.net')
        .replace(/http:\/\/m10\.music\.126\.net/g, 'https://m10.music.126.net')
        // 通用替换模式，捕获所有未被上述模式覆盖的链接
        .replace(/http:\/\/(p\d+)\.music\.126\.net/g, 'https://$1.music.126.net')
        .replace(/http:\/\/(m\d+)\.music\.126\.net/g, 'https://$1.music.126.net')
        .replace(/http:\/\/([^"']+)\.music\.126\.net/g, 'https://$1.music.126.net')
        .replace(/http:\/\/([^"']+)\.music\.127\.net/g, 'https://$1.music.127.net');

      // 转回JSON对象
      const finalProcessedData = JSON.parse(httpsJsonString);

      return cors()(new Response(JSON.stringify(finalProcessedData), {
        headers: { 'Content-Type': 'application/json' }
      }));
    } else {
      // 非JSON响应直接返回
      return cors()(response);
    }
  } catch (error) {
    console.error('处理API响应失败:', error);
    return cors()(new Response(JSON.stringify({
      error: '处理API响应失败',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
}

// 处理CORS预检请求
router.options('*', cors());

/**
 * 根路径处理 - 返回API状态信息
 */
router.get('/', async () => {
  return cors()(new Response(JSON.stringify({
    status: 'ok',
    api: 'HBMusic API Worker',
    version: '1.0.0'
  }), {
    headers: { 'Content-Type': 'application/json' }
  }));
});

/**
 * 获取推荐歌曲 (每日推荐)
 */
router.get('/recommend/songs', async (request) => {
  try {
    const response = await fetch(`${API_BASE_URL}/recommend/songs`);
    return processApiResponse(response);
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
router.get('/search', async (request) => {
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
    return processApiResponse(response);
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
    return processApiResponse(response);
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
 * 获取用户歌单
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

/**
 * 获取播放列表详情
 */
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

/**
 * 获取播放列表歌曲
 */
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

/**
 * 处理 p-11 请求
 */
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

/**
 * 添加通配路由 - 处理精品歌单等其他路由
 * 支持 /top/playlist/highquality 等未明确定义的路由
 */
router.get('/top/:path*', async (request) => {
  const url = new URL(request.url);
  const path = url.pathname;
  const searchParams = url.search;

  try {
    const response = await fetch(`${API_BASE_URL}${path}${searchParams}`);
    const data = await response.json();

    return cors()(new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (error) {
    return cors()(new Response(JSON.stringify({
      error: '请求源API失败',
      details: error.message,
      path: path
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
});

/**
 * 添加其他API路由通配处理
 */
router.get('/:path+', async (request) => {
  const url = new URL(request.url);
  const path = url.pathname;
  const searchParams = url.search;

  try {
    const response = await fetch(`${API_BASE_URL}${path}${searchParams}`);
    const data = await response.json();

    return cors()(new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (error) {
    return cors()(new Response(JSON.stringify({
      error: '请求源API失败',
      details: error.message,
      path: path
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
    // 使用环境变量中的API_BASE_URL，如果未设置则使用默认值
    let apiBaseUrl = env.API_BASE_URL || API_BASE_URL;

    // 确保所有URL都是HTTPS
    if (apiBaseUrl && !apiBaseUrl.startsWith('https://')) {
      apiBaseUrl = apiBaseUrl.replace('http://', 'https://');
    }

    // 修改局部变量
    API_BASE_URL = apiBaseUrl;

    // 输出请求信息到控制台（调试用）
    console.log(`处理请求: ${request.url}`);

    return router.handle(request);
  }
}; 