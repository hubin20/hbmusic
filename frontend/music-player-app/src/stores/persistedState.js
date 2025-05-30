/**
 * 播放状态持久化工具
 * 保存和恢复播放器状态，确保页面切换时不丢失播放状态
 */

// 持久化播放状态的键名
const PLAYER_STATE_KEY = 'music_player_state';

/**
 * 保存播放状态到localStorage
 * @param {Object} playerState - 播放器状态对象
 */
export const savePlayerState = (playerState) => {
  try {
    const stateToSave = {
      currentSongId: playerState.currentSong?.id,
      currentSongUrl: playerState.currentSong?.url,
      currentSongIndex: playerState.currentSongIndex,
      isPlaying: playerState.isPlaying,
      currentTime: playerState.currentTime,
      volume: playerState.volume,
      playbackMode: playerState.playbackMode,
      timestamp: Date.now()
    };

    localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify(stateToSave));
    // console.log('[持久化] 已保存播放状态', stateToSave);
  } catch (error) {
    console.error('[持久化] 保存播放状态失败:', error);
  }
};

/**
 * 从localStorage获取保存的播放状态
 * @returns {Object|null} 恢复的播放器状态或null
 */
export const getPlayerState = () => {
  try {
    const savedState = localStorage.getItem(PLAYER_STATE_KEY);
    if (!savedState) return null;

    const parsedState = JSON.parse(savedState);

    // 检查状态是否过期（超过24小时）
    const isExpired = Date.now() - parsedState.timestamp > 24 * 60 * 60 * 1000;
    if (isExpired) {
      localStorage.removeItem(PLAYER_STATE_KEY);
      return null;
    }

    // console.log('[持久化] 已恢复播放状态', parsedState);
    return parsedState;
  } catch (error) {
    console.error('[持久化] 恢复播放状态失败:', error);
    return null;
  }
};

/**
 * 清除保存的播放状态
 */
export const clearPlayerState = () => {
  try {
    localStorage.removeItem(PLAYER_STATE_KEY);
    // console.log('[持久化] 已清除播放状态');
  } catch (error) {
    console.error('[持久化] 清除播放状态失败:', error);
  }
}; 