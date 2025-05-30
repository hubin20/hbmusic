/**
 * 导航守卫工具
 * 用于处理特殊导航情况下的页面状态保持
 */

// 存储播放状态的备份
let playerStateBackup = null;

/**
 * 备份当前播放状态
 * @param {Object} playerStore - 播放器store实例
 */
export const backupPlayerState = (playerStore) => {
  if (!playerStore || !playerStore.currentSong) return;

  // 备份关键状态
  playerStateBackup = {
    currentSongId: playerStore.currentSong.id,
    currentSongUrl: playerStore.currentSong.url,
    isPlaying: playerStore.isPlaying,
    currentTime: playerStore.currentTime,
    playlist: [...playerStore.playlist],
    currentSongIndex: playerStore.currentSongIndex,
    timestamp: Date.now()
  };

  console.log('[NavigationGuard] 已备份播放状态');
};

/**
 * 检查是否需要恢复播放状态
 * @returns {boolean} 是否有备份状态
 */
export const hasBackupState = () => {
  return !!playerStateBackup;
};

/**
 * 恢复播放状态
 * @param {Object} playerStore - 播放器store实例
 * @returns {boolean} 是否成功恢复
 */
export const restorePlayerState = (playerStore) => {
  if (!playerStateBackup || !playerStore) return false;

  console.log('[NavigationGuard] 尝试恢复播放状态');

  try {
    // 如果播放列表为空，恢复备份的播放列表
    if (playerStore.playlist.length === 0 && playerStateBackup.playlist.length > 0) {
      playerStore.setPlaylist(playerStateBackup.playlist);
    }

    // 恢复当前歌曲
    if (playerStateBackup.currentSongId) {
      // 找到对应索引
      let songIndex = playerStateBackup.currentSongIndex;

      // 如果索引无效，尝试通过ID查找
      if (songIndex < 0 || songIndex >= playerStore.playlist.length) {
        songIndex = playerStore.playlist.findIndex(song => song.id === playerStateBackup.currentSongId);
      }

      // 如果找到了歌曲
      if (songIndex >= 0) {
        // 先设置当前索引和歌曲
        playerStore.currentSongIndex = songIndex;

        // 如果URL也有备份，直接恢复
        if (playerStateBackup.currentSongUrl) {
          // 恢复完整的歌曲对象
          const song = playerStore.playlist[songIndex];
          if (song) {
            playerStore.currentSong = {
              ...song,
              url: playerStateBackup.currentSongUrl
            };

            // 恢复播放时间
            playerStore.currentTime = playerStateBackup.currentTime || 0;

            // 恢复播放状态
            setTimeout(() => {
              playerStore.isPlaying = playerStateBackup.isPlaying;

              // 确保音频元素状态同步
              const audio = document.querySelector('audio');
              if (audio) {
                if (playerStateBackup.isPlaying && audio.paused) {
                  audio.play().catch(err => {
                    console.warn('[NavigationGuard] 自动恢复播放失败:', err);
                    window._needManualPlayResume = true;
                  });
                } else if (!playerStateBackup.isPlaying && !audio.paused) {
                  audio.pause();
                }
              }
            }, 100);

            console.log('[NavigationGuard] 播放状态恢复成功');
            return true;
          }
        }
      }
    }
  } catch (error) {
    console.error('[NavigationGuard] 恢复播放状态失败:', error);
  }

  // 重置备份
  playerStateBackup = null;
  return false;
};

/**
 * 在特殊导航前调用，预处理导航事件
 * @param {Object} to - 目标路由
 * @param {Object} from - 来源路由
 * @param {Object} playerStore - 播放器store实例
 */
export const beforeSpecialNavigation = (to, from, playerStore) => {
  // 检查是否是从MV页面到播放页面
  const isFromMVToPlaylist = from.path.includes('/mv/') &&
    (to.path === '/' || to.path === '/playlist-display');

  if (isFromMVToPlaylist) {
    console.log('[NavigationGuard] 从MV页面返回播放页面，准备保持状态');

    // 备份当前播放状态
    backupPlayerState(playerStore);

    // 设置全局标记
    window._fromMVToPlaylist = true;
    window._preventDataReload = true;
    window._navigationSource = 'mv';

    // 将来源记录到localStorage
    localStorage.setItem('navigationInfo', JSON.stringify({
      from: from.path,
      to: to.path,
      fromMV: true,
      timestamp: Date.now()
    }));
  }
};

/**
 * 在特殊导航后调用，确保状态正确恢复
 * @param {Object} to - 目标路由
 * @param {Object} from - 来源路由
 * @param {Object} playerStore - 播放器store实例
 */
export const afterSpecialNavigation = (to, from, playerStore) => {
  // 检查是否是从MV页面到播放页面
  const isFromMVToPlaylist = from.path.includes('/mv/') &&
    (to.path === '/' || to.path === '/playlist-display');

  if (isFromMVToPlaylist || window._fromMVToPlaylist) {
    console.log('[NavigationGuard] 导航完成，确保状态正确恢复');

    // 多层保障，延迟检查播放状态
    setTimeout(() => {
      // 如果有备份状态，尝试恢复
      if (hasBackupState()) {
        restorePlayerState(playerStore);
      } else if (playerStore.currentSong && playerStore.isPlaying) {
        // 如果没有备份但有当前歌曲，确保播放正常
        const audio = document.querySelector('audio');
        if (audio && audio.paused) {
          console.log('[NavigationGuard] 确保音频继续播放');
          audio.play().catch(() => {
            window._needManualPlayResume = true;
          });
        }
      }

      // 清除导航标记
      window._fromMVToPlaylist = false;
      window._preventDataReload = false;
      window._navigationSource = null;
    }, 300);
  }
};

/**
 * 注册全局点击处理，用于恢复需要用户交互的播放
 */
export const registerUserInteractionHandler = () => {
  // 避免重复注册
  if (window._userInteractionHandlerRegistered) return;

  document.addEventListener('click', () => {
    if (window._needManualPlayResume) {
      const audio = document.querySelector('audio');
      if (audio && audio.paused) {
        console.log('[NavigationGuard] 用户交互，尝试恢复播放');
        audio.play().catch(err => {
          console.log('[NavigationGuard] 用户交互恢复播放失败:', err);
        });
      }
      window._needManualPlayResume = false;
    }
  });

  window._userInteractionHandlerRegistered = true;
};

export default {
  backupPlayerState,
  restorePlayerState,
  hasBackupState,
  beforeSpecialNavigation,
  afterSpecialNavigation,
  registerUserInteractionHandler
}; 