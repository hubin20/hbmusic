/**
 * CORS处理工具
 * 为API响应添加CORS头部
 */

// 默认的CORS头部
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // 允许所有来源访问
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
    // 如果传入的是Response对象，为其添加CORS头部
    if (response instanceof Response) {
      const newHeaders = new Headers(response.headers);

      // 添加所有CORS头部
      Object.entries(headers).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    }

    // 如果没有传入Response，创建一个空的成功响应
    return new Response(null, {
      status: 204,
      headers,
    });
  };
} 