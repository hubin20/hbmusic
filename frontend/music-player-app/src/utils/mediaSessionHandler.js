/**
 * 媒体会话处理工具
 * 用于与Android和iOS原生媒体控制进行交互
 */

import { usePlayerStore } from '../stores/player';

/**
 * 初始化媒体会话控制
 * @returns {Object} 媒体会话控制对象
 */
export function initMediaSessionHandler() {
  const playerStore = usePlayerStore();

  // 创建媒体控制对象
  const mediaControls = {
    /**
     * 播放音乐
     */
    play: () => {
      console.log('[MediaSession] 收到播放命令');
      playerStore.togglePlayPause();
    },

    /**
     * 暂停音乐
     */
    pause: () => {
      console.log('[MediaSession] 收到暂停命令');
      if (playerStore.isPlaying) {
        playerStore.togglePlayPause();
      }
    },

    /**
     * 播放上一首
     */
    previous: () => {
      console.log('[MediaSession] 收到播放上一首命令');
      playerStore.playPrevious();
    },

    /**
     * 播放下一首
     */
    next: () => {
      console.log('[MediaSession] 收到播放下一首命令');
      playerStore.playNext();
    },

    /**
     * 更新当前播放信息
     */
    updateNowPlaying: () => {
      if (!playerStore.currentSong) return;

      // 检查是否在Android环境中
      if (window.AndroidPlayer && typeof window.AndroidPlayer.updateNowPlaying === 'function') {
        window.AndroidPlayer.updateNowPlaying(
          playerStore.currentSong.name || '未知歌曲',
          playerStore.currentSong.artist || '未知艺术家'
        );

        // 更新播放状态
        if (typeof window.AndroidPlayer.setPlayingState === 'function') {
          window.AndroidPlayer.setPlayingState(playerStore.isPlaying);
        }

        console.log('[MediaSession] 已更新Android媒体控制信息');
      }

      // 如果支持Web媒体会话API
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: playerStore.currentSong.name || '未知歌曲',
          artist: playerStore.currentSong.artist || '未知艺术家',
          album: playerStore.currentSong.album || '未知专辑',
          artwork: [
            { src: playerStore.currentSong.albumArt, sizes: '512x512', type: 'image/jpeg' }
          ]
        });

        // 设置媒体会话动作处理程序
        navigator.mediaSession.setActionHandler('play', () => mediaControls.play());
        navigator.mediaSession.setActionHandler('pause', () => mediaControls.pause());
        navigator.mediaSession.setActionHandler('previoustrack', () => mediaControls.previous());
        navigator.mediaSession.setActionHandler('nexttrack', () => mediaControls.next());

        // 更新播放状态
        navigator.mediaSession.playbackState = playerStore.isPlaying ? 'playing' : 'paused';

        console.log('[MediaSession] 已更新Web媒体会话信息');
      }
    }
  };

  // 将媒体控制对象暴露给全局，以便原生代码可以调用
  window.playerControls = mediaControls;

  return mediaControls;
}

/**
 * 监听播放状态变化，更新媒体会话
 * @param {Object} playerStore - 播放器状态存储
 * @param {Object} mediaControls - 媒体控制对象
 */
export function watchPlayerChanges(playerStore, mediaControls) {
  // 监听当前歌曲变化
  playerStore.$subscribe((mutation, state) => {
    if (state.currentSong) {
      console.log('[MediaSession] 检测到歌曲变化，更新媒体会话信息');
      mediaControls.updateNowPlaying();
    }
  });

  // 专门监听currentSong.id的变化，确保在歌曲切换时更新通知栏
  let lastSongId = null;
  playerStore.$subscribe((mutation, state) => {
    if (state.currentSong && state.currentSong.id !== lastSongId) {
      lastSongId = state.currentSong.id;
      console.log('[MediaSession] 检测到歌曲ID变化，强制更新媒体会话信息');
      mediaControls.updateNowPlaying();
    }
  });

  // 监听播放状态变化
  playerStore.$subscribe((mutation, state) => {
    if (window.AndroidPlayer && typeof window.AndroidPlayer.setPlayingState === 'function') {
      window.AndroidPlayer.setPlayingState(state.isPlaying);
    }

    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';
    }
  });
} 