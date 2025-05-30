<script setup>
import { ref, onMounted, computed, watch } from 'vue';

const props = defineProps({
  // 由Vite处理后的原始图片路径
  srcOriginal: {
    type: String,
    required: true
  },
  // 由Vite处理后的WebP图片路径
  srcWebp: {
    type: String,
    required: true
  },
  // 由Vite处理后的压缩JPG图片路径
  srcCompressedJpg: {
    type: String,
    required: true
  },
  // 图片替代文本
  alt: {
    type: String,
    default: ''
  },
  // 是否使用懒加载
  lazy: {
    type: Boolean,
    default: true
  },
  // 图片宽度
  width: {
    type: [Number, String],
    default: null
  },
  // 图片高度
  height: {
    type: [Number, String],
    default: null
  },
  // 占位符颜色
  placeholderColor: {
    type: String,
    default: '#121212'
  },
  // 加载失败时的回退图片 (可选, 如果都失败了可以用这个)
  fallbackSrc: {
    type: String,
    default: null
  }
});

// 定义emit
const emit = defineEmits(['load', 'error']);

// 图片加载状态
const isLoading = ref(true);
const isError = ref(false);
const loadProgress = ref(0);
const imageRef = ref(null);
const finalSrcToLoad = ref(''); // 追踪最终尝试加载的src

/**
 * 将HTTP URL转换为HTTPS
 * @param {string} url - 图片URL
 * @returns {string} - 转换后的URL
 */
const convertHttpToHttps = (url) => {
  if (!url) return url;
  if (url.startsWith('http://')) {
    // 特别处理网易云音乐图片链接
    if (url.includes('.music.126.net') || url.includes('.music.127.net')) {
      return url.replace('http://', 'https://');
    }
  }
  return url;
};

// 应用HTTP到HTTPS转换
const safeWebpSrc = computed(() => convertHttpToHttps(props.srcWebp));
const safeCompressedSrc = computed(() => convertHttpToHttps(props.srcCompressedJpg));
const safeOriginalSrc = computed(() => convertHttpToHttps(props.srcOriginal));
const safeFallbackSrc = computed(() => convertHttpToHttps(props.fallbackSrc));

watch(() => [props.srcOriginal, props.srcWebp, props.srcCompressedJpg], () => {
  // console.log('[OptimizedImage] Props changed, re-evaluating image sources.');
  // 当key改变导致组件重新创建时，onMounted会处理初始化加载
  // 如果不是通过key，而是props直接变化（不推荐用于主要src），则可能需要重新触发加载
  // 但我们的场景是用 key 来重新创建，所以这里主要是日志
}, { immediate: true });

// 检测浏览器是否支持WebP (这一步依然需要，以决定优先加载哪个)
const supportsWebp = ref(false);
const checkWebpSupport = async () => {
  // console.log('[OptimizedImage] Checking WebP support...');
  try {
    const webpData = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
    const blob = await fetch(webpData).then(r => r.blob());
    supportsWebp.value = blob.type === 'image/webp';
  } catch (e) {
    supportsWebp.value = false;
  }
  // console.log('[OptimizedImage] WebP supported:', supportsWebp.value);
};

// 加载图片
const loadImage = () => {
  // console.log('[OptimizedImage] loadImage called. Lazy:', props.lazy, 'In viewport (if lazy): ', props.lazy ? isInViewport() : 'N/A');
  if (!props.lazy || isInViewport()) {
    const img = new Image();
    isLoading.value = true; // 确保开始加载时isLoading为true
    isError.value = false;
    loadProgress.value = 0;
    
    let progressInterval = setInterval(() => {
      loadProgress.value += Math.random() * 10;
      if (loadProgress.value >= 99) {
        loadProgress.value = 99;
        clearInterval(progressInterval);
      }
    }, 100);
    
    img.onload = () => {
      // console.log('[OptimizedImage] Image successfully loaded:', img.src);
      isLoading.value = false;
      loadProgress.value = 100;
      clearInterval(progressInterval);
      emit('load', { src: img.src });
    };
    
    img.onerror = (errorEvent) => {
      // console.error('[OptimizedImage] Error loading image:', img.src, errorEvent);
      if (img.src === safeWebpSrc.value) {
        // console.warn('[OptimizedImage] WebP failed, trying Compressed JPG:', safeCompressedSrc.value);
        finalSrcToLoad.value = safeCompressedSrc.value;
        img.src = safeCompressedSrc.value;
      } 
      else if (img.src === safeCompressedSrc.value) {
        // console.warn('[OptimizedImage] Compressed JPG failed, trying Original JPG:', safeOriginalSrc.value);
        finalSrcToLoad.value = safeOriginalSrc.value;
        img.src = safeOriginalSrc.value;
      } 
      else if (img.src === safeOriginalSrc.value && safeFallbackSrc.value) {
        // console.warn('[OptimizedImage] Original JPG failed, trying Fallback Src:', safeFallbackSrc.value);
        finalSrcToLoad.value = safeFallbackSrc.value;
        img.src = safeFallbackSrc.value;
      } 
      else {
        // console.error('[OptimizedImage] All image formats failed to load.');
        isError.value = true;
        isLoading.value = false;
        clearInterval(progressInterval);
        emit('error', { src: img.src, error: errorEvent });
      }
    };
    
    finalSrcToLoad.value = supportsWebp.value ? safeWebpSrc.value : safeCompressedSrc.value;
    // console.log('[OptimizedImage] Attempting to load initial src:', finalSrcToLoad.value);
    img.src = finalSrcToLoad.value;
  } else {
    // console.log('[OptimizedImage] Image is lazy and not in viewport. Will load later.');
  }
};

// 检查元素是否在视口中
const isInViewport = () => {
  if (!imageRef.value) return false;
  const rect = imageRef.value.getBoundingClientRect();
  return (
    rect.top >= -rect.height &&
    rect.left >= -rect.width &&
    rect.bottom <= window.innerHeight + rect.height &&
    rect.right <= window.innerWidth + rect.width
  );
};

// 设置Intersection Observer用于懒加载
const setupIntersectionObserver = () => {
  if ('IntersectionObserver' in window && props.lazy) {
    // console.log('[OptimizedImage] Setting up IntersectionObserver.');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && isLoading.value) {
          // console.log('[OptimizedImage] Image in viewport, calling loadImage via Observer.');
          loadImage();
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '200px' });
    if (imageRef.value) {
      observer.observe(imageRef.value);
    } else {
        // console.warn('[OptimizedImage] imageRef not available for IntersectionObserver at setup.');
    }
  } else {
    // console.log('[OptimizedImage] Not using IntersectionObserver (either not supported or lazy=false). Calling loadImage directly.');
    loadImage();
  }
};

onMounted(async () => {
  // console.log('[OptimizedImage] Component mounted. ID (from srcOriginal for debug):', props.srcOriginal.split('/').pop());
  isLoading.value = true; // 明确在挂载时设置为加载中
  isError.value = false;
  await checkWebpSupport();
  setupIntersectionObserver();
});
</script>

<template>
  <div 
    ref="imageRef" 
    class="optimized-image-container"
    :style="{
      width: width ? (typeof width === 'number' ? `${width}px` : width) : '100%',
      height: height ? (typeof height === 'number' ? `${height}px` : height) : 'auto',
      backgroundColor: placeholderColor
    }"
  >
    <!-- Debug: Display current state -->
    <!-- 
    <div style="position:absolute; top:0; left:0; background:rgba(0,0,0,0.7); color:white; font-size:10px; z-index:10;">
      isLoading: {{ isLoading }}, isError: {{ isError }}, supportsWebp: {{ supportsWebp }} <br/>
      WebP: {{ safeWebpSrc.split('/').pop() }} <br/>
      Comp: {{ safeCompressedSrc.split('/').pop() }} <br/>
      Orig: {{ safeOriginalSrc.split('/').pop() }} <br/>
      Final attempt: {{ finalSrcToLoad.split('/').pop() }}
    </div>
    -->
    <div v-if="isLoading" class="image-loader">
      <div class="loader-spinner"></div>
      <div class="loader-progress">{{ Math.floor(loadProgress) }}%</div>
    </div>
    <div v-else-if="isError" class="image-error">
      <span>图片加载失败</span>
    </div>
    <img
      v-else
      :src="finalSrcToLoad"
      :alt="alt"
      class="optimized-image"
    />
  </div>
</template>

<style scoped>
.optimized-image-container {
  position: relative;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 4px;
  transition: opacity 0.3s ease;
}

.optimized-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.image-loader {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: inherit;
}

.loader-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top: 3px solid #ffffff;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

.loader-progress {
  color: #ffffff;
  font-size: 14px;
}

.image-error {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  color: #ffffff;
  font-size: 14px;
  background-color: rgba(0, 0, 0, 0.5);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style> 