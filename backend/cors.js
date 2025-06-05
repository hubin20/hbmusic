/**
 * CORS处理工具
 * 为API响应添加CORS头部
 */

// 默认的CORS头部
const corsHeaders = {
  // 不再使用通配符，而是根据请求来源动态设置
  // 'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
  // 安全相关头部
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload', // 强制HTTPS
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cache-Control': 'no-cache, no-store, must-revalidate' // 禁止缓存
};

// 允许的域名列表
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

// 添加er-sycdn.kuwo.cn的子域名检查函数
/**
 * 检查域名是否在允许列表中，或者是否是er-sycdn.kuwo.cn的子域名
 * @param {string} origin - 请求的Origin
 * @returns {boolean} - 是否允许该Origin
 */
function isAllowedOrigin(origin) {
  if (!origin) return false;

  // 检查是否在允许列表中
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // 检查是否是er-sycdn.kuwo.cn的子域名
  try {
    const url = new URL(origin);
    if (url.hostname.endsWith('er-sycdn.kuwo.cn') ||
      url.hostname.endsWith('.kuwo.cn') ||
      url.hostname === 'kuwo.cn') {
      return true;
    }
  } catch (e) {
    // 如果URL解析失败，返回false
    return false;
  }

  return false;
}

/**
 * 处理CORS的中间件函数
 * @param {Object} options - CORS配置选项
 * @returns {Function} CORS处理函数
 */
export function cors(options = {}) {
  // 合并默认头部和自定义选项
  const headers = { ...corsHeaders, ...options.headers };

  // 返回一个函数，该函数可以处理Response对象或创建新的Response
  return (response) => {
    // 获取请求的Origin
    const origin = options.origin || '*';

    // 如果传入的是Response对象，为其添加CORS头部
    if (response instanceof Response) {
      const newHeaders = new Headers(response.headers);

      // 设置Access-Control-Allow-Origin头部
      if (origin !== '*') {
        // 如果是特定的源，检查是否在允许列表中
        if (isAllowedOrigin(origin)) {
          newHeaders.set('Access-Control-Allow-Origin', origin);
          // 添加Vary头部，表明响应会根据Origin请求头变化
          newHeaders.set('Vary', 'Origin');
        } else {
          // 如果不在允许列表中，使用通配符
          newHeaders.set('Access-Control-Allow-Origin', '*');
        }
      } else {
        // 使用通配符
        newHeaders.set('Access-Control-Allow-Origin', '*');
      }

      // 添加其他CORS头部
      Object.entries(headers).forEach(([key, value]) => {
        if (key !== 'Access-Control-Allow-Origin') { // 跳过已设置的Origin头部
          newHeaders.set(key, value);
        }
      });

      // 如果使用了特定的源，允许携带凭据
      if (origin !== '*' && isAllowedOrigin(origin)) {
        newHeaders.set('Access-Control-Allow-Credentials', 'true');
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    }

    // 如果没有传入Response，创建一个空的成功响应
    const responseHeaders = { ...headers };

    // 设置Access-Control-Allow-Origin头部
    if (origin !== '*') {
      // 如果是特定的源，检查是否在允许列表中
      if (isAllowedOrigin(origin)) {
        responseHeaders['Access-Control-Allow-Origin'] = origin;
        // 添加Vary头部，表明响应会根据Origin请求头变化
        responseHeaders['Vary'] = 'Origin';
        // 允许携带凭据
        responseHeaders['Access-Control-Allow-Credentials'] = 'true';
      } else {
        // 如果不在允许列表中，使用通配符
        responseHeaders['Access-Control-Allow-Origin'] = '*';
      }
    } else {
      // 使用通配符
      responseHeaders['Access-Control-Allow-Origin'] = '*';
    }

    return new Response(null, {
      status: 204,
      headers: responseHeaders,
    });
  };
} 