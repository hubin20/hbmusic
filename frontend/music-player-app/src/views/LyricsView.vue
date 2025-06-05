<template>
  <div class="lyrics-view-container" :class="{ 'paused': !playerStore.isPlaying }">
    <div v-if="playerStore.currentSong" class="song-info-header">
      <img 
        :src="effectiveAlbumArtSrc" 
        alt="Album Art" 
        class="album-art-lyrics"
        @error="onImageLoadError"
        @load="onImageLoad"
      >
      <h2>{{ playerStore.currentSong.name }}</h2>
      <p>{{ playerStore.currentSong.artist }}</p>
      <!-- 添加作词作曲信息 -->
      <p class="song-credits" v-if="playerStore.currentSong.lyricist">作词：{{ playerStore.currentSong.lyricist }}</p>
      <p class="song-credits" v-if="playerStore.currentSong.composer">作曲：{{ playerStore.currentSong.composer }}</p>
    </div>
    <div v-else class="no-song-message">
      <p>当前没有播放歌曲</p>
    </div>

    <div ref="lyricsContainer" class="lyrics-lines-container">
      <div v-if="playerStore.isLoadingLyrics" class="lyrics-loading">
        <p>歌词加载中...</p>
      </div>
      <div v-else-if="!playerStore.currentLyrics || playerStore.currentLyrics.length === 0" class="lyrics-empty">
        <p>暂无歌词</p>
      </div>
      <div v-else class="lyrics-content">
        <div class="lyrics-padding-top"></div>
        <div
          v-for="(line, index) in playerStore.currentLyrics"
          :key="`lyric-block-${index}`"
          :ref="el => lyricLineRefs[index] = el"
          class="lyric-line-block"
          :class="{
            'active': index === playerStore.currentLyricIndex,
            'pre-active': index === playerStore.currentLyricIndex + 1,
            'post-active': index === playerStore.currentLyricIndex - 1
          }"
        >
          <p class="original-lyric" v-if="index === playerStore.currentLyricIndex" v-html="colorizeText(line.text)"></p>
          <p class="original-lyric" v-else>{{ line.text }}</p>
          <p
            v-if="playerStore.translatedLyrics && playerStore.translatedLyrics[index] && playerStore.translatedLyrics[index].text && playerStore.showTranslatedLyrics"
            class="translated-lyric"
          >
            {{ playerStore.translatedLyrics[index].text }}
          </p>
        </div>
        <div class="lyrics-padding-bottom"></div>
      </div>
    </div>

    <!-- TODO: Right side control buttons will be added here -->

  </div>
</template>

<script setup>
import { usePlayerStore } from '../stores/player';
import { useRoute } from 'vue-router'; // 导入 useRoute
import { ref, watch, onBeforeUpdate, nextTick, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router'; // 导入 useRouter

const playerStore = usePlayerStore();
const route = useRoute(); // 使用 useRoute 获取当前路由信息
const router = useRouter(); // 使用 useRouter
const lyricsContainer = ref(null);
const lyricLineRefs = ref([]);

// 在onMounted外部定义这些函数，这样onUnmounted可以引用相同的实例
let routeChangeHandler = null;

/**
 * 清除MV相关的本地存储状态
 */
const clearMVRelatedStorageState = () => {
  console.log('[LyricsView] 清除MV相关状态标记');
  localStorage.removeItem('musicPausedForMV');
  localStorage.removeItem('musicWasPlaying');
  localStorage.removeItem('isFromMV');
  sessionStorage.removeItem('mv_return_playstate');
  sessionStorage.removeItem('mv_return_timestamp');
  
  // 保证播放状态不受影响
  if (window._fromMVToPlaylist) window._fromMVToPlaylist = false;
  
  // 设置标记，表示从歌词页面返回
  localStorage.setItem('fromLyricsPage', 'true');
};

// 彩色文字颜色数组
const colorPalette = [
  '#3498db', // 蓝色
  '#2ecc71', // 绿色
  '#f1c40f', // 黄色
  '#e74c3c', // 红色
  '#9b59b6', // 紫色
  '#1abc9c', // 青绿色
  '#f39c12', // 橙色
  '#d35400', // 深橙色
  '#c0392b', // 深红色
  '#8e44ad'  // 深紫色
];

/**
 * 为文本中的每个字符应用不同的颜色
 * @param {string} text - 要着色的文本
 * @returns {string} 应用HTML颜色的文本
 */
const colorizeText = (text) => {
  if (!text) return '';
  
  return text.split('').map((char, index) => {
    // 对空格和标点符号不应用颜色
    if (char === ' ' || /[,.!?;:'"()，。！？；：""''（）]/.test(char)) {
      return char;
    }
    
    const colorIndex = index % colorPalette.length;
    const color = colorPalette[colorIndex];
    return `<span style="color: ${color};">${char}</span>`;
  }).join('');
};

// 直接使用在线默认图片
const defaultArtUrl = 'https://p2.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg';

/**
 * 将HTTP图片URL转换为HTTPS
 * @param {string} url - 图片URL
 * @returns {string} - 转换后的URL
 */
const convertHttpToHttps = (url) => {
  if (!url) return defaultArtUrl;
  
  // 处理网易云域名
  if (url.startsWith('http://') && 
      (url.includes('.music.126.net') || 
       url.includes('.music.127.net') || 
       url.includes('p1.music.126.net') || 
       url.includes('p2.music.126.net') || 
       url.includes('p3.music.126.net') || 
       url.includes('p4.music.126.net'))) {
    console.log('[LyricsView] 转换HTTP图片URL为HTTPS:', url);
    return url.replace('http://', 'https://');
  }
  
  return url;
};

// 这个响应式引用将保存图片的源URL
const effectiveAlbumArtSrc = ref(defaultArtUrl);
let currentSongArtAttempted = ''; // 防止无限重试失败的API URL
let imageRetryCount = 0; // 添加重试计数器
const MAX_IMAGE_RETRIES = 3; // 最大重试次数

// 监听currentSong整个对象的变化，确保能捕获到albumArt的更新
watch(() => playerStore.currentSong, (newSong, oldSong) => {
  if (newSong) {
    console.log(`[LyricsView] currentSong changed. New albumArt: ${newSong.albumArt}`);
    console.log(`[LyricsView] currentSong完整信息:`, JSON.stringify(newSong).substring(0, 500) + '...');
    
    // 处理网易云歌曲的专辑图片，可能在al对象中
    if (newSong.al && newSong.al.picUrl) {
      effectiveAlbumArtSrc.value = convertHttpToHttps(newSong.al.picUrl);
      currentSongArtAttempted = newSong.al.picUrl;
      imageRetryCount = 0; // 重置重试计数器
      console.log(`[LyricsView] Setting album art from al.picUrl: ${effectiveAlbumArtSrc.value}`);
    } else if (newSong.albumArt && 
        newSong.albumArt !== './default-album-art.png' && 
        newSong.albumArt !== defaultArtUrl) {
      effectiveAlbumArtSrc.value = convertHttpToHttps(newSong.albumArt);
      currentSongArtAttempted = newSong.albumArt;
      imageRetryCount = 0; // 重置重试计数器
      console.log(`[LyricsView] Setting album art from albumArt: ${effectiveAlbumArtSrc.value}`);
    } else {
      // 使用默认图片
      effectiveAlbumArtSrc.value = defaultArtUrl;
      currentSongArtAttempted = defaultArtUrl;
      console.log(`[LyricsView] Using default album art`);
    }
  }
}, { deep: true }); // 使用deep选项确保能检测到嵌套属性的变化

// 当歌曲ID变化时，确保获取歌词和专辑图片
watch(() => playerStore.currentSong?.id, (newId, oldId) => {
  if (newId && newId !== oldId) {
    console.log(`[LyricsView] Song ID changed: ${newId}, isKwSong: ${playerStore.currentSong?.isFromKw ? 'true' : 'false'}`);
    currentSongArtAttempted = ''; // 当歌曲ID变化时重置
    imageRetryCount = 0; // 重置重试计数器
    
    // 强制获取歌词，这会同时更新专辑图片
    // 使用-1参数强制重新加载歌词
    playerStore.fetchLyrics(newId, -1, 2);
    
    // 延迟一点时间后检查歌词是否加载成功
    setTimeout(() => {
      if (!playerStore.currentLyrics || playerStore.currentLyrics.length === 0) {
        console.log(`[LyricsView] 歌词未成功加载，再次尝试获取歌词: ${newId}`);
        playerStore.fetchLyrics(newId, -1, 2);
      }
    }, 1000);
  }
});

const onImageLoadError = () => {
  console.error('[LyricsView] Failed to load album art image from:', effectiveAlbumArtSrc.value);
  
  // 如果失败的URL是来自API的，并且与默认值不同，尝试重试
  if (effectiveAlbumArtSrc.value !== defaultArtUrl && imageRetryCount < MAX_IMAGE_RETRIES) {
    imageRetryCount++;
    console.log(`[LyricsView] Album art failed, retrying (${imageRetryCount}/${MAX_IMAGE_RETRIES})...`);
    
    // 延迟后重试加载同一URL
    setTimeout(() => {
      // 通过添加时间戳或随机数来避免浏览器缓存
      const timestamp = new Date().getTime();
      effectiveAlbumArtSrc.value = `${currentSongArtAttempted}?t=${timestamp}`;
    }, 1000); // 1秒后重试
  } else {
    console.log('[LyricsView] Album art failed after retries, switching to default.');
    effectiveAlbumArtSrc.value = defaultArtUrl;
  }
};

const onImageLoad = () => {
  console.log('[LyricsView] Album art loaded successfully:', effectiveAlbumArtSrc.value);
  imageRetryCount = 0; // 重置重试计数器
  
  // 如果当前图片是默认图片，但歌曲对象有更好的图片，则尝试使用歌曲对象的图片
  if (effectiveAlbumArtSrc.value === defaultArtUrl && playerStore.currentSong) {
    if (playerStore.currentSong.al && playerStore.currentSong.al.picUrl) {
      effectiveAlbumArtSrc.value = playerStore.currentSong.al.picUrl;
    } else if (playerStore.currentSong.albumArt && 
        playerStore.currentSong.albumArt !== './default-album-art.png' && 
        playerStore.currentSong.albumArt !== defaultArtUrl) {
      effectiveAlbumArtSrc.value = playerStore.currentSong.albumArt;
    }
  }
};

// 确保在更新前清空 refs 数组，以避免潜在的内存泄漏和陈旧引用
onBeforeUpdate(() => {
  lyricLineRefs.value = [];
});

// 监听当前歌词索引变化，滚动到当前行
watch(() => playerStore.currentLyricIndex, (newIndex) => {
  if (newIndex >= 0 && lyricLineRefs.value[newIndex]) {
    nextTick(() => {
      const activeLineElement = lyricLineRefs.value[newIndex];
      if (activeLineElement) {
        const container = lyricsContainer.value;
        const lineTop = activeLineElement.offsetTop;
        const lineHeight = activeLineElement.offsetHeight;
        const containerHeight = container.clientHeight;
        
        // 计算滚动位置，使高亮歌词行位于容器中央
        const scrollToPosition = lineTop - (containerHeight / 2) + (lineHeight / 2);
        
        // 立即滚动到计算的位置，使用平滑滚动效果
        container.scrollTo({
          top: Math.max(0, scrollToPosition),
          behavior: 'auto' // 改为auto，确保立即滚动，不使用平滑滚动
        });
      }
    });
  } else if (newIndex === -1 && lyricsContainer.value) {
    // 如果没有高亮歌词行（例如在歌曲开始前），滚动到顶部
    lyricsContainer.value.scrollTo({
      top: 0,
      behavior: 'auto' // 改为auto，确保立即滚动
    });
  }
}, { flush: 'post' });

// 当歌曲改变时，如果当前在歌词页，确保获取歌词
watch(() => playerStore.currentSong?.id, (newSongId, oldSongId) => {
  if (newSongId && newSongId !== oldSongId) {
    // 无论当前是否在歌词页面，都获取歌词，确保歌词数据始终是最新的
    playerStore.fetchLyrics(newSongId).then(() => {
      // 歌词加载完成后，立即更新当前歌词索引
      playerStore.updateCurrentLyricIndex(playerStore.currentTime);
      
      // 立即滚动到当前歌词位置
      nextTick(() => {
        if (playerStore.currentLyricIndex >= 0 && 
            lyricLineRefs.value[playerStore.currentLyricIndex] && 
            lyricsContainer.value) {
          const activeLineElement = lyricLineRefs.value[playerStore.currentLyricIndex];
          const container = lyricsContainer.value;
          const lineTop = activeLineElement.offsetTop;
          const lineHeight = activeLineElement.offsetHeight;
          const containerHeight = container.clientHeight;
          
          const scrollToPosition = lineTop - (containerHeight / 2) + (lineHeight / 2);
          container.scrollTo({
            top: Math.max(0, scrollToPosition),
            behavior: 'auto' // 使用即时滚动，避免动画延迟
        });
      }
      });
    }).catch(error => {
      console.error(`[LyricsView] 歌词加载失败:`, error);
    });
  }
});

// 添加对歌词加载状态的监听，确保歌词加载完成后立即更新视图
watch(() => playerStore.isLoadingLyrics, (isLoading) => {
  if (!isLoading && playerStore.currentLyrics && playerStore.currentLyrics.length > 0) {
    console.log(`[LyricsView] 歌词加载完成，立即更新视图，歌词行数: ${playerStore.currentLyrics.length}`);
    
    // 输出歌词示例
    if (playerStore.currentLyrics.length > 0) {
      console.log(`[LyricsView] 歌词示例 [0]: ${playerStore.currentLyricIndex} - ${playerStore.currentLyrics[0].text}`);
      if (playerStore.currentLyrics.length > 1) {
        console.log(`[LyricsView] 歌词示例 [1]: ${playerStore.currentLyricIndex} - ${playerStore.currentLyrics[1].text}`);
      }
    }
    
    // 检查是否只有作词作曲信息
    const onlyHasMetadata = playerStore.currentLyrics.length <= 2 && 
      playerStore.currentLyrics.every(line => 
        line.text.includes('作词') || line.text.includes('作曲') || 
        line.text.includes('编曲') || line.text.includes('制作')
      );
      
    if (onlyHasMetadata) {
      console.log('[LyricsView] 检测到仅包含作词作曲信息，但无实际歌词内容');
      
      // 更新歌曲的作词作曲信息
      if (playerStore.currentSong) {
        playerStore.currentLyrics.forEach(line => {
          if (line.text.includes('作词')) {
            const lyricistMatch = line.text.match(/作词[:：]?\s*(.+)/);
            if (lyricistMatch && lyricistMatch[1]) {
              playerStore.currentSong.lyricist = lyricistMatch[1].trim();
            }
          } else if (line.text.includes('作曲')) {
            const composerMatch = line.text.match(/作曲[:：]?\s*(.+)/);
            if (composerMatch && composerMatch[1]) {
              playerStore.currentSong.composer = composerMatch[1].trim();
            }
          }
        });
        
        // 触发重新渲染
        playerStore.currentSong = { ...playerStore.currentSong };
      }
      
      // 尝试重新获取完整歌词
      if (playerStore.currentSong && playerStore.currentSong.id) {
        console.log(`[LyricsView] 尝试重新获取完整歌词: ${playerStore.currentSong.id}`);
        setTimeout(() => {
          playerStore.fetchLyrics(playerStore.currentSong.id, -1, 2);
        }, 500);
      }
    }
    
    // 歌词加载完成，立即更新当前歌词索引
    nextTick(() => {
      // 强制更新当前歌词索引
      playerStore.updateCurrentLyricIndex(playerStore.currentTime);
      console.log(`[LyricsView] 更新后的当前歌词索引: ${playerStore.currentLyricIndex}`);
      
      // 确保滚动到当前歌词位置
      if (playerStore.currentLyricIndex >= 0 && lyricLineRefs.value[playerStore.currentLyricIndex] && lyricsContainer.value) {
        const activeLineElement = lyricLineRefs.value[playerStore.currentLyricIndex];
        const container = lyricsContainer.value;
        const lineTop = activeLineElement.offsetTop;
        const lineHeight = activeLineElement.offsetHeight;
        const containerHeight = container.clientHeight;
        
        const scrollToPosition = lineTop - (containerHeight / 2) + (lineHeight / 2);
        container.scrollTo({
          top: Math.max(0, scrollToPosition),
          behavior: 'auto' // 使用即时滚动，避免动画延迟
        });
        
        console.log(`[LyricsView] 已滚动到当前歌词行: ${playerStore.currentLyricIndex}, 位置: ${scrollToPosition}`);
      } else {
        console.log(`[LyricsView] 未找到当前歌词行或容器，无法滚动: 索引=${playerStore.currentLyricIndex}, 行元素=${!!lyricLineRefs.value[playerStore.currentLyricIndex]}, 容器=${!!lyricsContainer.value}`);
      }
    });
  } else if (!isLoading && (!playerStore.currentLyrics || playerStore.currentLyrics.length === 0)) {
    console.log('[LyricsView] 歌词加载完成，但歌词为空');
    
    // 如果当前有歌曲但歌词为空，尝试重新获取
    if (playerStore.currentSong && playerStore.currentSong.id) {
      console.log(`[LyricsView] 尝试重新获取歌词: ${playerStore.currentSong.id}`);
      setTimeout(() => {
        playerStore.fetchLyrics(playerStore.currentSong.id, -1, 2);
      }, 500);
    }
  }
});

// 监听路由变化，进入歌词页时确保显示歌词
watch(() => route.path, (newPath) => {
  if (newPath === '/lyrics' && playerStore.currentSong && playerStore.currentSong.id) {
    // 无论是否有歌词，都重新获取，确保页面切换时歌词是最新的
    // 使用-1参数强制重新加载歌词
    console.log(`[LyricsView] 进入歌词页面，强制刷新歌词: ${playerStore.currentSong.id}`);
    playerStore.fetchLyrics(playerStore.currentSong.id, -1, 2);
    
    // 立即更新当前歌词索引
    playerStore.updateCurrentLyricIndex(playerStore.currentTime);
    
    // 延迟一点时间后检查歌词是否加载成功
    setTimeout(() => {
      if (!playerStore.currentLyrics || playerStore.currentLyrics.length === 0) {
        console.log(`[LyricsView] 歌词未成功加载，再次尝试获取歌词: ${playerStore.currentSong.id}`);
        playerStore.fetchLyrics(playerStore.currentSong.id, -1, 2);
        
        // 再次更新歌词索引
        playerStore.updateCurrentLyricIndex(playerStore.currentTime);
      }
    
    // 如果已经有歌词和当前歌词索引，立即滚动到当前歌词位置
    nextTick(() => {
      if (playerStore.currentLyricIndex >= 0 && lyricLineRefs.value[playerStore.currentLyricIndex] && lyricsContainer.value) {
        const activeLineElement = lyricLineRefs.value[playerStore.currentLyricIndex];
        const container = lyricsContainer.value;
        const lineTop = activeLineElement.offsetTop;
        const lineHeight = activeLineElement.offsetHeight;
        const containerHeight = container.clientHeight;
        
        const scrollToPosition = lineTop - (containerHeight / 2) + (lineHeight / 2);
        container.scrollTo({
          top: Math.max(0, scrollToPosition),
          behavior: 'auto' // 使用即时滚动，避免动画延迟
        });
      }
    });
    }, 500);
  }
});

// 添加路由离开处理
onMounted(() => {
  // 获取前一个路由路径并保存到localStorage
  const fromRoute = router.currentRoute.value.from;
  let previousPath = '';
  
  if (fromRoute && fromRoute.path) {
    // 如果有来源路由信息，使用它
    previousPath = fromRoute.fullPath || fromRoute.path;
    console.log('[LyricsView] 从router.currentRoute.value.from获取前一个路由:', previousPath);
  } else if (document.referrer) {
    // 如果没有路由信息但有referrer，使用referrer
    previousPath = document.referrer;
    console.log('[LyricsView] 从document.referrer获取前一个路由:', previousPath);
  } else if (window.history.state && window.history.state.back) {
    // 尝试从history.state获取
    previousPath = window.history.state.back;
    console.log('[LyricsView] 从history.state获取前一个路由:', previousPath);
  }
  
  // 只有当前一个路径不是歌词页面且不为空时才保存
  if (previousPath && !previousPath.includes('/lyrics')) {
    console.log('[LyricsView] 保存前一个路由路径:', previousPath);
    localStorage.setItem('previousRouteBeforeLyrics', previousPath);
  }
  
  // 确保在组件挂载时立即获取歌词，使用-1参数强制重新加载
  if (playerStore.currentSong && playerStore.currentSong.id) {
    console.log(`[LyricsView] 组件挂载，强制刷新歌词: ${playerStore.currentSong.id}`);
    playerStore.fetchLyrics(playerStore.currentSong.id, -1, 2);
    
    // 立即更新当前歌词索引
    playerStore.updateCurrentLyricIndex(playerStore.currentTime);
    
    // 延迟一点时间后检查歌词是否加载成功
    setTimeout(() => {
      if (!playerStore.currentLyrics || playerStore.currentLyrics.length === 0) {
        console.log(`[LyricsView] 歌词未成功加载，再次尝试获取歌词: ${playerStore.currentSong.id}`);
        playerStore.fetchLyrics(playerStore.currentSong.id, -1, 2);
        
        // 再次更新歌词索引
        playerStore.updateCurrentLyricIndex(playerStore.currentTime);
      }
    }, 500);
  }
  
  // 使用window事件监听器处理路由离开
  routeChangeHandler = () => {
    // 只在页面卸载并且即将离开歌词页面时清除状态
    if (location.pathname !== '/lyrics' && route.path === '/lyrics') {
      clearMVRelatedStorageState();
    }
  };
  
  // 添加事件监听器，在页面导航前触发
  window.addEventListener('beforeunload', routeChangeHandler);
  window.addEventListener('popstate', routeChangeHandler);
});

// 在组件卸载时清理
onUnmounted(() => {
  // 清除MV相关状态标记
  clearMVRelatedStorageState();
  
  // 移除事件监听器
  if (routeChangeHandler) {
    window.removeEventListener('beforeunload', routeChangeHandler);
    window.removeEventListener('popstate', routeChangeHandler);
  }
});

</script>

<style scoped>
.lyrics-view-container {
  padding: 20px;
  color: #e0e0e0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  height: 100%; /* 占满父容器 App.vue 的内容区域 */
  box-sizing: border-box;
  overflow: hidden; /* 防止内容溢出主容器 */
}

.song-info-header {
  margin-bottom: 20px; /* 减少底部边距 */
  flex-shrink: 0;
  position: relative;
  width: 100%; /* 调整为全宽 */
  height: auto; /* 自适应高度 */
  text-align: center;
}

.album-art-lyrics {
  width: 120px; /* 减小专辑图片大小 */
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  margin-bottom: 10px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  background-color: rgba(255, 255, 255, 0.1);
  display: block;
  transition: opacity 0.3s ease;
  animation: rotate 20s linear infinite;
  opacity: 0.9;
  box-shadow: 0 0 15px rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  position: relative;
  margin: 0 auto;
}

/* 修复毛玻璃圈与图片的对齐问题 */
.song-info-header::before {
  content: '';
  position: absolute;
  top: -5px; /* 调整位置 */
  left: 50%;
  transform: translateX(-50%);
  width: 130px; /* 调整大小 */
  height: 130px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  z-index: -1;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 当暂停播放时，停止旋转 */
.paused .album-art-lyrics {
  animation-play-state: paused;
}

.song-info-header h2 {
  font-size: 1.2rem; /* 减小标题字体 */
  margin-bottom: 3px;
  color: #fff;
}

.song-info-header p {
  font-size: 0.9rem; /* 减小艺术家字体 */
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 0;
}

.no-song-message {
  margin-top: 50px;
  font-size: 1.2rem;
}

.lyrics-lines-container {
  flex-grow: 1; /* 占据剩余空间 */
  overflow-y: auto; /* 允许歌词区域独立滚动 */
  width: 100%;
  max-width: 100%; /* 调整为全宽 */
  background-color: transparent; /* 移除背景色 */
  border-radius: 0;
  padding: 10px 20px;
  margin-top: 0; /* 减少顶部边距 */
  max-height: calc(100% - 220px); /* 调整最大高度 */
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
  position: relative; /* 为内部元素的定位提供参考 */
}

.lyrics-lines-container::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}

.lyrics-loading,
.lyrics-empty {
  margin-top: 30px;
  font-size: 1.1rem;
  color: #aaa;
}

.lyric-line-block {
  padding: 6px 0; /* 减小行间距 */
  margin: 2px 0; /* 减小外边距 */
  transition: all 0.3s ease;
  text-align: center; /* 确保每行歌词居中显示 */
  opacity: 0.6; /* 默认状态下的透明度 */
  transform: scale(0.95); /* 默认状态下稍微缩小 */
  will-change: transform, opacity; /* 优化性能 */
}

.lyric-line-block p { /* Common styling for both lyric lines */
  margin: 0;
  padding: 2px 0;
  line-height: 1.5; /* 减小行高 */
  transition: color 0.2s ease, font-size 0.2s ease, opacity 0.2s ease;
}

.original-lyric {
  font-size: 0.95rem; /* 减小非活动歌词字体 */
  color: rgba(255, 255, 255, 0.6); /* 调整为半透明白色 */
  opacity: 0.8;
}

.translated-lyric {
  font-size: 0.85rem; /* 减小翻译歌词字体 */
  color: rgba(255, 255, 255, 0.5);
  opacity: 0.7;
}

/* 活动歌词行样式 - 修改为多彩字符效果 */
.lyric-line-block.active {
  opacity: 1; /* 活动行完全不透明 */
  transform: scale(1); /* 活动行正常大小 */
  transition: all 0.2s ease; /* 快速过渡 */
}

.lyric-line-block.active .original-lyric {
  font-size: 1.1rem; /* 减小高亮歌词字体大小 */
  font-weight: 500; /* 减轻字体粗细 */
  opacity: 1;
  /* 移除原有的渐变色背景 */
  background: none;
  -webkit-background-clip: initial;
  background-clip: initial;
  -webkit-text-fill-color: initial;
  text-shadow: 0 0 8px rgba(255, 255, 255, 0.3); /* 添加轻微的发光效果 */
}

/* 预激活行样式 - 下一句歌词 */
.lyric-line-block.pre-active {
  opacity: 0.8; /* 比普通行更不透明 */
  transform: scale(0.98); /* 比普通行更大 */
  transition: all 0.3s ease; /* 平滑过渡 */
}

.lyric-line-block.pre-active .original-lyric {
  color: rgba(255, 255, 255, 0.75); /* 比普通行更亮 */
}

/* 后激活行样式 - 上一句歌词 */
.lyric-line-block.post-active {
  opacity: 0.7; /* 比普通行更不透明 */
  transform: scale(0.97); /* 比普通行更大 */
  transition: all 0.3s ease; /* 平滑过渡 */
}

.lyric-line-block.post-active .original-lyric {
  color: rgba(255, 255, 255, 0.7); /* 比普通行更亮 */
}

/* 为彩色字符添加特效 */
.lyric-line-block.active .original-lyric span {
  display: inline-block;
  transition: transform 0.2s ease, opacity 0.2s ease; /* 更快的过渡 */
  animation: colorPulse 1.5s infinite alternate;
  will-change: opacity, text-shadow; /* 优化性能 */
}

/* 添加轻微的颜色脉动动画 */
@keyframes colorPulse {
  0% {
    opacity: 0.9;
    text-shadow: 0 0 5px rgba(255, 255, 255, 0.2);
  }
  100% {
    opacity: 1;
    text-shadow: 0 0 8px rgba(255, 255, 255, 0.4);
  }
}

.lyric-line-block.active .translated-lyric {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
  font-weight: 400;
  opacity: 0.9;
}

/* 添加歌词内容容器样式 */
.lyrics-content {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  text-align: center; /* 确保歌词居中显示 */
}

/* 添加上下内边距样式 */
.lyrics-padding-top {
  height: 40vh; /* 调整上内边距 */
  min-height: 150px;
}

.lyrics-padding-bottom {
  height: 40vh; /* 调整下内边距 */
  min-height: 150px;
}

.song-credits {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
  margin: 1px 0;
  line-height: 1.2;
}
</style> 