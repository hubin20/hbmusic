<template>
  <div class="player-controls-new" @click="handleUserInteraction">
    <div class="progress-section">
      <div class="time-display current-time-left">{{ playerStore.formattedCurrentTime }}</div>
      <div class="progress-bar-container">
        <input 
          type="range" 
          min="0" 
          :max="playerStore.currentSongDuration || 0" 
          :value="playerStore.currentTime" 
          @input="onSeek" 
          class="progress-bar-new"
          :disabled="!playerStore.currentSong"
          :style="progressBarStyle"
        />
      </div>
      <div class="time-display total-time-right">{{ playerStore.formattedTotalDuration }}</div>
    </div>

    <div class="controls-main">
      <button @click="toggleMute" class="control-button-new volume-button" :disabled="!playerStore.currentSong">
        <Icon icon="mdi:volume-high" v-if="!isMuted" width="1.5em" height="1.5em" />
        <Icon icon="mdi:volume-mute" v-else width="1.5em" height="1.5em" />
      </button>
      <button @click="playerStore.playPrevious()" class="control-button-new prev-button" :disabled="!playerStore.currentSong">
        <Icon icon="mdi:skip-previous" width="1.8em" height="1.8em" />
      </button>
      <button @click="playerStore.togglePlayPause()" class="control-button-new play-pause-button-new" :disabled="!playerStore.currentSong">
        <Icon v-if="playerStore.isPlaying && !playerStore.isLoadingNewSong" icon="mdi:pause" width="2em" height="2em" />
        <Icon v-else-if="playerStore.isLoadingNewSong" icon="mdi:loading" class="is-loading" width="2em" height="2em" />
        <Icon v-else icon="mdi:play" width="2em" height="2em" />
      </button>
      <button @click="playerStore.playNext()" class="control-button-new next-button" :disabled="!playerStore.currentSong">
        <Icon icon="mdi:skip-next" width="1.8em" height="1.8em" />
      </button>
      <button @click="playerStore.togglePlaybackMode()" class="control-button-new loop-button" :class="{ active: playerStore.playbackMode !== 'sequential' }">
        <Icon v-if="playerStore.playbackMode === 'sequential'" icon="mdi:repeat" width="1.5em" height="1.5em" />
        <Icon v-else-if="playerStore.playbackMode === 'single'" icon="mdi:repeat-once" width="1.5em" height="1.5em" />
        <Icon v-else-if="playerStore.playbackMode === 'shuffle'" icon="mdi:shuffle" width="1.5em" height="1.5em" />
      </button>
    </div>

    <!-- 播放模式提示框 -->
    <div v-if="playerStore.showPlaybackModeToast" class="playback-mode-toast">
      {{ playerStore.toastMessage }}
    </div>

    <audio ref="audioPlayer" 
           id="audio-player"
           @timeupdate="onTimeUpdate" 
           @loadedmetadata="onLoadedMetadata" 
           @ended="playerStore.handleSongEnd()"
           :src="playerStore.currentSong?.url"
           :volume="playerStore.volume"
           controlslist="nodownload noremoteplayback"
           preload="auto"
           playsinline
           webkit-playsinline="true"
           x-webkit-airplay="allow"
           disablePictureInPicture
           autoplay
    ></audio>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, onUnmounted, provide } from 'vue';
import { usePlayerStore } from '../stores/player';
import { savePlayerState } from '../stores/persistedState';
import { Icon } from '@iconify/vue';
import { useRouter } from 'vue-router';

const playerStore = usePlayerStore();
const audioPlayer = ref(null);
let previousVolume = playerStore.volume;
const router = useRouter();

// 全局共享播放器引用，以便其他组件可以访问
provide('audioPlayer', audioPlayer);

// 定期保存播放状态的定时器
let persistStateTimer = null;

// 检测是否为iOS设备
const isIOS = ref(false);

// 唤醒锁引用
let wakeLock = null;

/**
 * 请求唤醒锁，防止设备进入休眠状态
 */
const requestWakeLock = async () => {
  // 检查是否支持唤醒锁API
  if ('wakeLock' in navigator) {
    try {
      // 请求屏幕唤醒锁
      wakeLock = await navigator.wakeLock.request('screen');
      
      console.log('[PlayerControls] 唤醒锁已激活');
      
      // 监听唤醒锁释放事件
      wakeLock.addEventListener('release', () => {
        console.log('[PlayerControls] 唤醒锁已释放');
        // 如果音乐仍在播放，尝试重新获取唤醒锁
        if (playerStore.isPlaying && !document.hidden) {
          requestWakeLock();
        }
      });
      
      // 监听页面可见性变化，在页面变为可见时重新请求唤醒锁
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && playerStore.isPlaying) {
          requestWakeLock();
        }
      });
    } catch (err) {
      console.warn('[PlayerControls] 无法获取唤醒锁:', err.message);
    }
  } else {
    console.warn('[PlayerControls] 此浏览器不支持唤醒锁API');
  }
};

onMounted(() => {
  // 检测设备类型
  isIOS.value = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  
  // 如果是iOS设备，添加特定的类名
  if (isIOS.value) {
    document.documentElement.classList.add('ios-device');
  } else {
    document.documentElement.classList.add('non-ios-device');
  }
  
  // 保存引用到window对象，以便在组件外部访问
  window._audioPlayer = audioPlayer.value;
  
  // 确保音频在页面不可见时继续播放（适用于大多数现代浏览器）
  if (audioPlayer.value) {
    // 设置媒体会话元数据，使其在后台可以继续播放
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        audioPlayer.value.play();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        audioPlayer.value.pause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        playerStore.playPrevious();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        playerStore.playNext();
      });
      
      // 更新媒体会话元数据
      if (playerStore.currentSong) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: playerStore.currentSong.name,
          artist: playerStore.currentSong.artist,
          album: playerStore.currentSong.album,
          artwork: [
            { src: playerStore.currentSong.albumArt, sizes: '512x512', type: 'image/jpeg' }
          ]
        });
      }
    }
    
    // 为音频元素添加keepalive特性（如果浏览器支持）
    audioPlayer.value.setAttribute('x-webkit-airplay', 'allow');
    audioPlayer.value.setAttribute('webkit-playsinline', 'true');
    
    // 防止系统自动暂停音频
    audioPlayer.value.addEventListener('pause', (event) => {
      // 如果播放器状态是播放中，但音频被系统暂停，尝试恢复播放
      if (playerStore.isPlaying && !playerStore.isLoadingNewSong) {
        console.log('[PlayerControls] 检测到系统暂停，尝试恢复播放');
        setTimeout(() => {
          audioPlayer.value.play().catch(err => {
            console.warn('[PlayerControls] 自动恢复播放失败:', err);
          });
        }, 300);
      }
    });
    
    // 应用保存的播放速度
    const savedPlaybackSpeed = localStorage.getItem('playbackSpeed');
    if (savedPlaybackSpeed) {
      audioPlayer.value.playbackRate = parseFloat(savedPlaybackSpeed);
      console.log(`[PlayerControls] 应用保存的播放速度: ${savedPlaybackSpeed}x`);
    }
  }
  
  // 每5秒保存一次播放状态
  persistStateTimer = setInterval(() => {
    if (playerStore.currentSong) {
      savePlayerState(playerStore);
    }
  }, 5000);
  
  // 如果从歌单页面返回播放页面，确保音乐继续播放
  if (localStorage.getItem('isInPlaylistView') === 'true' && playerStore.currentSong) {
    setTimeout(() => {
      if (playerStore.isPlaying && audioPlayer.value) {
        audioPlayer.value.play().catch(error => {
          console.warn("[PlayerControls] 恢复播放失败:", error);
          // 尝试再次恢复播放
          setTimeout(() => {
            if (playerStore.isPlaying) {
              audioPlayer.value.play().catch(() => {});
            }
          }, 300);
        });
      }
    }, 100);
  }
  
  // 添加唤醒锁，防止设备进入休眠状态
  requestWakeLock();
});

// 组件卸载时清除定时器
onUnmounted(() => {
  if (persistStateTimer) {
    clearInterval(persistStateTimer);
  }
  
  // 最后保存一次播放状态
  if (playerStore.currentSong) {
    savePlayerState(playerStore);
  }
  
  // 释放唤醒锁
  if (wakeLock !== null) {
    try {
      wakeLock.release();
      console.log('[PlayerControls] 组件卸载时释放唤醒锁');
    } catch (err) {
      console.warn('[PlayerControls] 释放唤醒锁失败:', err);
    }
  }
  
  // 移除页面可见性变化监听器
  document.removeEventListener('visibilitychange', () => {});
});

// 监听播放状态变化，保存播放状态
watch(() => [
  playerStore.isPlaying,
  playerStore.currentSong?.id,
  playerStore.currentTime,
  playerStore.playbackMode
], () => {
  if (playerStore.currentSong) {
    savePlayerState(playerStore);
    
    // 如果是Android环境，更新原生服务的歌曲信息
    if (window.AndroidPlayer && typeof window.AndroidPlayer.updateNowPlaying === 'function') {
      try {
        window.AndroidPlayer.updateNowPlaying(
          playerStore.currentSong.name || '未知歌曲', 
          playerStore.currentSong.artist || '未知艺术家'
        );
      } catch (err) {
        console.warn('[PlayerControls] 无法更新Android通知:', err);
      }
    }
  }
}, { deep: true });

const isMuted = computed(() => playerStore.volume === 0);

const toggleMute = () => {
  if (isMuted.value) {
    playerStore.setVolume(previousVolume || 0.5);
  } else {
    previousVolume = playerStore.volume;
    playerStore.setVolume(0);
  }
};

watch(() => playerStore.isPlaying, (newVal) => {
  if (!audioPlayer.value) return;
  if (newVal && playerStore.currentSong) {
    // 使用Promise和重试逻辑播放音频
    const attemptPlay = (retries = 3) => {
      audioPlayer.value.play()
        .then(() => {
          // 播放成功
        })
        .catch(error => {
          // 过滤掉常见的 AbortError
          if (error.name !== 'AbortError') {
            console.error(`播放状态切换错误 (尝试 ${3-retries+1}/3): `, error);
          }
          if (retries > 0 && playerStore.isPlaying) {
            setTimeout(() => attemptPlay(retries - 1), 1000);
          } else if (retries <= 0 && error.name !== 'AbortError') {
            console.error("播放状态切换失败，达到最大重试次数");
            // 可能需要通知用户或更新UI状态
          }
        });
    };
    
    attemptPlay();
  } else {
    audioPlayer.value.pause();
  }
});

watch(() => playerStore.currentSong?.url, (newUrl) => {
  if (audioPlayer.value) {
    // 先暂停并清除当前音频
    audioPlayer.value.pause();
    audioPlayer.value.currentTime = 0;
    audioPlayer.value.src = '';
    
    // 然后设置新的URL并加载
    if (newUrl) {
      audioPlayer.value.src = newUrl;
      audioPlayer.value.load();
      
      // 应用保存的播放速度
      const savedPlaybackSpeed = localStorage.getItem('playbackSpeed');
      if (savedPlaybackSpeed) {
        audioPlayer.value.playbackRate = parseFloat(savedPlaybackSpeed);
      }
      
      if (playerStore.isPlaying) {
        // 等待 onLoadedMetadata 或 canplay 事件后播放更稳妥
        // audioPlayer.value.play().catch(error => console.error("切换歌曲后播放错误:", error));
      }
    }
  }
  if (!newUrl && audioPlayer.value) {
    audioPlayer.value.pause();
    audioPlayer.value.src = '';
    playerStore.updateCurrentTime(0);
  }
});

watch(() => playerStore.volume, (newVolume) => {
  if (audioPlayer.value) {
    audioPlayer.value.volume = newVolume;
  }
});

watch(() => playerStore.currentTime, (newTime) => {
  if (audioPlayer.value && Math.abs(audioPlayer.value.currentTime - newTime) > 0.5 && playerStore.playbackMode === 'single' && newTime === 0) {
    audioPlayer.value.currentTime = 0;
    if(playerStore.isPlaying) {
      // 使用Promise和重试逻辑播放音频
      const attemptPlay = (retries = 3) => {
        audioPlayer.value.play()
          .then(() => {
            console.log("单曲循环重播成功");
          })
          .catch(error => {
            // 过滤掉常见的 AbortError
            if (error.name !== 'AbortError') {
              console.error(`单曲循环重播失败 (尝试 ${3-retries+1}/3): `, error);
            }
            if (retries > 0 && playerStore.isPlaying) {
              console.log(`将在1秒后重试单曲循环播放，剩余重试次数: ${retries-1}`);
              setTimeout(() => attemptPlay(retries - 1), 1000);
            } else if (retries <= 0 && error.name !== 'AbortError') {
              console.error("单曲循环重播失败，达到最大重试次数");
            }
          });
      };
      
      attemptPlay();
    }
  }
});

const onTimeUpdate = () => {
  if (audioPlayer.value) {
    playerStore.updateCurrentTime(audioPlayer.value.currentTime);
  }
};

const onLoadedMetadata = () => {
  if (audioPlayer.value) {
    // 更新Store中当前歌曲的真实时长
    if (playerStore.currentSong && audioPlayer.value.duration) {
      playerStore.updateCurrentSongRealDuration(audioPlayer.value.duration);
    }

    // 应用保存的播放速度
    const savedPlaybackSpeed = localStorage.getItem('playbackSpeed');
    if (savedPlaybackSpeed) {
      audioPlayer.value.playbackRate = parseFloat(savedPlaybackSpeed);
    }

    // 只有当不在加载新歌曲状态时才播放
    if (playerStore.isPlaying && playerStore.currentSong && !playerStore.isLoadingNewSong) {
      // 使用Promise和重试逻辑播放音频
      const attemptPlay = (retries = 3) => {
        audioPlayer.value.play()
          .then(() => {
            // 播放成功
          })
          .catch(error => {
            // 过滤掉常见的 AbortError
            if (error.name !== 'AbortError') {
              console.error(`音频播放错误 (尝试 ${3-retries+1}/3): `, error);
            }
            if (retries > 0 && playerStore.isPlaying) {
              setTimeout(() => attemptPlay(retries - 1), 1000);
            } else if (retries <= 0 && error.name !== 'AbortError') {
              console.error("音频播放失败，达到最大重试次数");
            }
          });
      };
      
      attemptPlay();
    }
  }
};

const onSeek = (event) => {
  if (audioPlayer.value && playerStore.currentSong) {
    const time = parseFloat(event.target.value);
    audioPlayer.value.currentTime = time;
    playerStore.updateCurrentTime(time);
  }
};

const progressBarStyle = computed(() => {
  if (!playerStore.currentSong || playerStore.currentSongDuration === 0) {
    return { background: 'rgba(255, 255, 255, 0.3)' };
  }
  const progress = (playerStore.currentTime / playerStore.currentSongDuration) * 100;
  return {
    background: `linear-gradient(to right, #ffffff ${progress}%, rgba(255, 255, 255, 0.3) ${progress}%)`
  };
});

// 监听特殊路由返回情况，确保播放不中断
watch(() => router.currentRoute.value.path, (newPath, oldPath) => {
  if (!oldPath) return;
  
  // 检查是否从MV页面返回播放页面
  const isFromMV = oldPath.includes('/mv/') && (newPath === '/' || newPath === '/playlist-display');
  
  if (isFromMV || window._fromMVToPlaylist) {
    console.log('[PlayerControls] 检测到从MV页面返回播放页面');
    
    // 添加多重保障，确保音频正常播放
    if (playerStore.currentSong && playerStore.isPlaying && audioPlayer.value) {
      // 延迟执行，确保DOM已更新
      setTimeout(() => {
        // 如果音频已暂停，尝试恢复播放
        if (audioPlayer.value.paused) {
          console.log('[PlayerControls] 尝试恢复音频播放');
          audioPlayer.value.play().catch(err => {
            console.warn('[PlayerControls] 自动恢复播放失败:', err);
            
            // 如果自动播放失败，设置一个标志，用于后续用户交互时恢复
            window._needManualPlayResume = true;
          });
        }
      }, 300);
    }
  }
});

// 添加处理用户交互恢复播放的逻辑
const handleUserInteraction = () => {
  // 如果存在需要手动恢复的标记
  if (window._needManualPlayResume && playerStore.currentSong && playerStore.isPlaying && audioPlayer.value && audioPlayer.value.paused) {
    console.log('[PlayerControls] 用户交互，尝试恢复播放');
    audioPlayer.value.play().catch(err => {
      console.warn('[PlayerControls] 用户交互恢复播放失败:', err);
    });
    window._needManualPlayResume = false;
  }
};

// 监听组件是否可见（用于处理从歌词视图返回时的恢复播放）
const isVisible = ref(true);
watch(() => playerStore.showLyricsView, (showLyrics) => {
  // 如果从歌词视图返回
  if (!showLyrics && !isVisible.value) {
    isVisible.value = true;
    
    // 检查是否需要恢复播放
    if (playerStore.isPlaying && audioPlayer.value && audioPlayer.value.paused) {
      setTimeout(() => {
        audioPlayer.value.play().catch(() => {});
      }, 100);
    }
  } else if (showLyrics && isVisible.value) {
    isVisible.value = false;
  }
});

</script>

<style scoped>
.player-controls-new {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 15px;
  background-color: transparent;
  color: #ffffff;
  height: var(--player-height, 80px);
  width: 100%;
  box-sizing: border-box;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding-bottom: max(8px, env(safe-area-inset-bottom, 0px));
  z-index: 100;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.player-controls-new::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100%;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0));
  z-index: -1;
  pointer-events: none;
}

.progress-section {
  display: flex;
  align-items: center;
  width: 100%;
  margin-bottom: 5px;
  padding: 0 5px;
  /* 轻微提高不透明度 */
  opacity: 0.95;
}

.time-display {
  font-size: 0.75rem;
  min-width: 40px; 
  text-align: center;
  color: rgba(255, 255, 255, 0.9); /* 更清晰的白色 */
  /* 添加轻微文字阴影增强可读性 */
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
.current-time-left {
  margin-right: 10px;
}
.total-time-right {
  margin-left: 10px;
}

.progress-bar-container {
  flex-grow: 1;
  display: flex;
  align-items: center;
  padding: 0 5px;
}

.progress-bar-new {
  width: 100%;
  height: 4px; 
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.3); /* 未播放部分使用较高不透明度 */
  border-radius: 2px;
  cursor: pointer;
  /* 添加阴影增强可见度 */
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.2);
}

.progress-bar-new::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 10px;
  background: #ffffff;
  border-radius: 50%;
  cursor: pointer;
  margin-top: -3px; 
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.3);
}

.progress-bar-new::-moz-range-thumb {
  width: 10px;
  height: 10px;
  background: #ffffff;
  border-radius: 50%;
  cursor: pointer;
  border: none; 
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.3);
}
.progress-bar-new::-ms-thumb {
  width: 10px;
  height: 10px;
  background: #ffffff;
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.3);
}


.controls-main {
  display: flex;
  align-items: center;
  justify-content: center; 
  width: 100%;
  margin-top: 5px;
}

.control-button-new {
  background: none;
  border: none;
  color: #ffffff; /* 纯白色 */
  padding: 8px;
  margin: 0 12px;
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  /* 添加轻微阴影使图标在透明背景上更加醒目 */
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

.control-button-new .el-icon {
  font-size: 1.3rem;
}

.control-button-new.play-pause-button-new {
  margin: 0 18px;
}

.control-button-new.play-pause-button-new .el-icon {
  font-size: 1.8rem;
}

.control-button-new:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.15);
  transform: scale(1.05);
}

.control-button-new:active:not(:disabled) {
  transform: scale(0.95);
}

.control-button-new:disabled {
  color: rgba(255, 255, 255, 0.3);
  cursor: not-allowed;
}

.loop-button.active {
  color: #1DB954;
}

.playback-mode-toast {
  position: absolute;
  top: -50px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px 15px;
  border-radius: 15px;
  font-size: 0.9rem;
  z-index: 1000;
  animation: fadeInOut 1.5s ease-out forwards;
  text-align: center;
  min-width: 100px;
}

@keyframes fadeInOut {
  0% { opacity: 0; transform: translateY(10px); }
  20% { opacity: 1; transform: translateY(0); }
  80% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-10px); }
}

.is-loading {
  animation: rotating 2s linear infinite;
}

@keyframes rotating {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 添加移动设备适配样式 */
@media (max-width: 768px) {
  .player-controls-new {
    padding: 5px 10px;
    padding-bottom: max(5px, env(safe-area-inset-bottom, 0px));
    height: var(--player-height, 70px);
    /* 增强移动设备上的背景渐变 */
    background-color: rgba(0, 0, 0, 0.1); /* 轻微的半透明背景 */
  }
  
  .time-display {
    font-size: 0.65rem;
    min-width: 30px;
  }
  
  .control-button-new {
    padding: 4px;
    margin: 0 8px;
  }

  .control-button-new.play-pause-button-new {
    margin: 0 12px;
  }
  
  .control-button-new .el-icon {
    font-size: 1rem;
  }
  
  .control-button-new.play-pause-button-new .el-icon {
    font-size: 1.4rem;
  }
  
  .progress-section {
    margin-bottom: 2px;
  }
  
  .progress-bar-new::-webkit-slider-thumb {
    width: 10px;
    height: 10px;
  }
  
  .progress-bar-new::-moz-range-thumb {
    width: 10px;
    height: 10px;
  }
  
  .progress-bar-new::-ms-thumb {
    width: 10px;
    height: 10px;
  }
}

/* 移除多余的安全区域支持代码 */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .player-controls-new {
    padding-bottom: max(8px, env(safe-area-inset-bottom, 0px));
  }
}

/* iOS特定样式 */
:global(.ios-device) .player-controls-new {
  padding-bottom: max(8px, env(safe-area-inset-bottom, 0px));
}

/* 非iOS设备特定样式 */
:global(.non-ios-device) .player-controls-new {
  padding-bottom: 8px;
}

@media (max-width: 768px) {
  :global(.ios-device) .player-controls-new {
    padding-bottom: max(5px, env(safe-area-inset-bottom, 0px));
  }
  
  :global(.non-ios-device) .player-controls-new {
    padding-bottom: 5px;
  }
}
</style>
