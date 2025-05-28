/**
 * CORS处理工具
 * 为API响应添加CORS头部
 */

// 默认的CORS头部
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // 或限制为你的前端域名，例如 'https://music.931125.xyz'
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
  // 添加安全相关头部
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload', // 强制HTTPS
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
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
      const newResponse = new Response(response.body, response);

      // 添加所有CORS头部
      Object.entries(headers).forEach(([key, value]) => {
        newResponse.headers.set(key, value);
      });

      return newResponse;
    }

    // 如果没有传入Response，创建一个空的成功响应
    return new Response(null, {
      status: 204,
      headers,
    });
  };
} 