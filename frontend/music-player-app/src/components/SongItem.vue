<template>
  <div 
    class="song-item-row-new"
    :data-song-index="index" 
    @click="handleClick" 
    :class="{ 
      'playing': isPlaying && isCurrent
    }"
  >
    <div class="cell index-cell">
      <div v-if="isCurrent && isPlaying" class="playing-indicator-bar">
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>
      <span v-else class="song-number">{{ displayNumber }}</span>
    </div>
    <div class="cell title-cell">
      <span v-if="song.isFromKw" class="kw-hr-badge">HR</span>
      <span class="song-name-text">{{ song.name }}</span>
    </div>
    <div class="cell artist-cell">
      <span class="artist-name-text">{{ song.artist }}</span> 
    </div>
    <div class="cell album-cell">
      <span>{{ song.album }}</span> 
    </div>
    <div class="cell actions-cell">
      <div class="dropdown-container">
        <button class="icon-btn more-options-btn" @click.stop="toggleDropdown">⋮</button>
        <div class="dropdown-menu" v-show="showDropdown" @click.stop>
          <div class="dropdown-item" @click="addToFavorites">
            <div class="dropdown-icon">❤</div>
            <div class="dropdown-text">{{ isFavorited ? '取消喜欢' : '喜欢' }}</div>
          </div>
          <div class="dropdown-item" @click="addToPlaylist">
            <div class="dropdown-icon">+</div>
            <div class="dropdown-text">收藏到歌单</div>
          </div>
          <div class="dropdown-item">
            <div class="dropdown-icon">↓</div>
            <div class="dropdown-text">下载</div>
          </div>
          <div class="dropdown-item">
            <div class="dropdown-icon">↗</div>
            <div class="dropdown-text">分享</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import { usePlayerStore } from '../stores/player';
import { addToFavorites as addSongToFavorites, isFavorited as checkIsFavorited, removeFromFavorites } from '../services/favoritesService';
import { ElMessage } from 'element-plus';

const playerStore = usePlayerStore();
const showDropdown = ref(false);
const isFavorited = ref(false);

const props = defineProps({
  song: { type: Object, required: true },
  index: { type: Number, required: true },
  isPlaying: { type: Boolean, default: false },
  isCurrent: { type: Boolean, default: false },
});

const emit = defineEmits(['play-song']);

// 处理点击事件
const handleClick = (event) => {
  emitPlaySong(true); // 默认点击时自动播放
};

const emitPlaySong = (autoPlay = true) => {
  // 确保索引是数字类型
  const index = Number(props.index);
  emit('play-song', { song: props.song, index: index, autoPlay: autoPlay });
};

const displayNumber = computed(() => (props.index + 1).toString().padStart(2, '0'));

// 切换下拉菜单显示状态
const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value;
};

// 点击外部关闭下拉菜单
const handleClickOutside = (event) => {
  if (showDropdown.value) {
    showDropdown.value = false;
  }
};

// 添加到收藏
const addToFavorites = async () => {
  if (isFavorited.value) {
    // 如果已收藏，则取消收藏
    const result = removeFromFavorites('SONGS', props.song.id);
    if (result) {
      isFavorited.value = false;
      ElMessage.success('已取消喜欢');
    } else {
      ElMessage.error('取消喜欢失败');
    }
  } else {
    // 准备歌曲数据，确保保存完整的歌曲信息
    const songData = {
      ...props.song, // 保留原始歌曲对象的所有属性
      id: props.song.id,
      name: props.song.name,
      artist: props.song.artist,
      album: props.song.album,
      albumArt: props.song.albumArt || props.song.picUrl || props.song.al?.picUrl || '',
      duration: props.song.duration || props.song.dt || 0,
      // 保存URL相关信息
      url: props.song.url || null,
      directPlayUrl: props.song.directPlayUrl || null,
      timestamp: props.song.timestamp || Date.now()
    };
    
    // 检查是否是酷我歌曲
    const isKwSong = props.song.isFromKw === true || 
      props.song.rid || 
      (props.song.id && String(props.song.id).startsWith('kw_')) || 
      (props.song.id && String(props.song.id).startsWith('kw-'));
    
    // 设置isFromKw标记
    songData.isFromKw = isKwSong;
    
    // 如果是酷我歌曲，确保保存rid字段
    if (isKwSong) {
      songData.rid = props.song.rid || null;
      console.log(`[SongItem] 收藏酷我歌曲: ${props.song.name}, ID: ${props.song.id}, isFromKw: true`);
    } else {
      // 非酷我歌曲，确保标记为false
      songData.isFromKw = false;
      console.log(`[SongItem] 收藏网易云歌曲: ${props.song.name}, ID: ${props.song.id}, isFromKw: false, URL: ${songData.url || 'null'}`);
    }
    
    // 立即添加到收藏，不等待URL获取
    const result = addSongToFavorites('SONGS', songData);
    if (result) {
      isFavorited.value = true;
      ElMessage.success('已添加到我喜欢的音乐');
      
      // 如果是网易云歌曲且没有URL，在后台异步获取URL
      if (!isKwSong && !songData.url) {
        // 使用setTimeout将URL获取放到下一个事件循环，不阻塞UI
        setTimeout(async () => {
          try {
            console.log(`[SongItem] 后台异步获取网易云歌曲URL: ${props.song.name}, ID: ${props.song.id}`);
            const cleanId = String(props.song.id).replace(/^main_/, '');
            
            // 尝试从播放器获取URL
            const songDetails = await playerStore._fetchSongUrlFromMainApi(cleanId);
            
            if (songDetails && songDetails.url) {
              console.log(`[SongItem] 成功获取网易云歌曲URL: ${props.song.name}, URL: ${songDetails.url}`);
              
              // 更新收藏中的歌曲URL
              try {
                const { updateFavoriteSongUrl } = await import('../services/favoritesService');
                updateFavoriteSongUrl(songData.id, songDetails.url, Date.now());
                console.log(`[SongItem] 已更新收藏歌曲URL: ${props.song.name}`);
              } catch (e) {
                console.error(`[SongItem] 更新收藏歌曲URL失败: ${props.song.name}`, e);
              }
            } else {
              console.log(`[SongItem] 无法获取网易云歌曲URL: ${props.song.name}`);
            }
          } catch (error) {
            console.error(`[SongItem] 后台获取网易云歌曲URL失败: ${props.song.name}`, error);
          }
        }, 100);
      }
    } else {
      ElMessage.error('添加失败');
    }
  }
  
  // 关闭下拉菜单
  showDropdown.value = false;
};

// 收藏到歌单
const addToPlaylist = () => {
  // TODO: 实现收藏到歌单功能
  ElMessage.info('收藏到歌单功能即将上线');
  showDropdown.value = false;
};

// 检查歌曲是否已收藏
const checkFavoriteStatus = () => {
  isFavorited.value = checkIsFavorited('SONGS', props.song.id);
};

// 监听歌曲变化，更新收藏状态
watch(() => props.song.id, (newId) => {
  if (newId) {
    checkFavoriteStatus();
  }
}, { immediate: true });

// 组件挂载时添加全局点击事件监听器
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  checkFavoriteStatus();
  
  // 添加收藏状态变更事件监听
  document.addEventListener('favorite-status-changed', handleFavoriteStatusChanged);
});

// 组件卸载时移除全局点击事件监听器
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  
  // 移除收藏状态变更事件监听
  document.removeEventListener('favorite-status-changed', handleFavoriteStatusChanged);
});

// 处理收藏状态变更事件
const handleFavoriteStatusChanged = (event) => {
  const { id, type, isFavorited: newStatus } = event.detail;
  
  // 检查是否是当前歌曲
  if (type === 'SONGS' && props.song.id === id) {
    console.log(`[SongItem] 收到歌曲 ${id} 收藏状态变更为: ${newStatus}`);
    // 更新当前组件的收藏状态
    isFavorited.value = newStatus;
  }
};
</script>

<style scoped>
.song-item-row-new {
  display: flex;
  align-items: center;
  padding: 12px 5px; /* 根据截图微调内边距 */
  border-bottom: 1px solid rgba(255, 255, 255, 0.05); /* 非常淡的分割线 */
  cursor: pointer;
  font-size: 14px; /* 调整基础字号 */
  color: #a0a0a0; /* 默认较暗的文字颜色 */
  transition: background-color 0.15s ease;
}

.song-item-row-new:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

.song-item-row-new.playing {
  color: #D946EF; /* 播放状态下的粉色高亮 */
  background-color: rgba(255, 255, 255, 0.1); /* 更透明的白色背景 */
  backdrop-filter: blur(10px); /* 毛玻璃效果 */
  -webkit-backdrop-filter: blur(10px);
  border-radius: 8px; /* 圆角边框 */
  border: 1px solid rgba(255, 255, 255, 0.2); /* 半透明白色边框 */
  margin: 0 5px; /* 添加左右边距，使边框不贴边 */
}

.song-item-row-new.playing .index-cell .song-number {
  color: #D946EF;
}

.playing-indicator-bar {
  /* width: 4px; */ /* 彩色条宽度 */
  /* height: 18px; */ /* 彩色条高度 */
  /* background-color: #D946EF; */ /* 截图中的粉色 */
  /* border-radius: 2px; */
  display: flex;
  align-items: flex-end; /* 使竖条底部对齐 */
  justify-content: space-between; /* 分散开竖条 */
  width: 18px; /* 容器宽度，根据竖条数量和间距调整 */
  height: 18px; /* 容器高度 */
  /* 也可以用多个小方块模拟截图中的效果 
    display: flex; flex-direction: column; gap: 1px;
    span { width: 4px; height: 4px; background-color: ...}
  */
}

.playing-indicator-bar span {
  display: inline-block;
  width: 3px; /* 单个竖条宽度 */
  animation: playing-bar-animation 0.8s infinite ease-in-out alternate;
}

/* 为每个竖条设置不同的动画延迟，形成错落效果 */
.playing-indicator-bar span:nth-child(1) {
  animation-delay: 0s;
  height: 60%;
  background-color: #FF0000; /* 红色 */
}
.playing-indicator-bar span:nth-child(2) {
  animation-delay: 0.2s;
  height: 100%;
  background-color: #FFD700; /* 黄色 */
}
.playing-indicator-bar span:nth-child(3) {
  animation-delay: 0.4s;
  height: 80%;
  background-color: #00FF00; /* 绿色 */
}
.playing-indicator-bar span:nth-child(4) {
  animation-delay: 0.6s;
  height: 40%;
  background-color: #8A2BE2; /* 紫色 */
}

@keyframes playing-bar-animation {
  0% {
    transform: scaleY(0.3);
  }
  100% {
    transform: scaleY(1);
  }
}

.cell { /* 这个 .cell 的样式之前被错误地包含在了 .song-item-row-new.playing 的修改中，现在移回到正确的位置 */
  padding: 0 4px; /* 减小单元格的通用内边距 */
  display: flex;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.index-cell {
  width: 40px; /* 调整宽度以与 PlaylistView 表头一致 */
  justify-content: center;
  flex-shrink: 0;
  font-size: 13px;
  color: #777;
}

.title-cell {
  flex: 5;
  color: #d0d0d0; /* 歌曲名稍亮 */
}
.song-item-row-new.playing .title-cell .song-name-text {
  color: #D946EF;
}

.artist-cell {
  flex: 3;
}

.album-cell {
  flex: 2; 
  color: #888; 
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artist-name-text,
.album-name-text {
  /* cursor: pointer; */
  /* transition: color 0.2s ease; */
}

.sq-tag {
  background-color: rgba(217, 70, 239, 0.7); /* 粉色SQ背景 */
  color: white;
  font-size: 0.6rem;
  padding: 1px 3px;
  border-radius: 2px;
  margin-left: 6px;
  font-weight: bold;
}

.icon-btn {
  background: none;
  border: none;
  color: #888; /* 图标默认颜色 */
  cursor: pointer;
  padding: 0;
  font-size: 16px; /* 调整图标大小 */
  opacity: 0.7;
}
.icon-btn:hover {
  color: #fff;
  opacity: 1;
}

.search-icon-inline {
    margin-left: 8px;
    font-size: 13px; /* 行内搜索图标小一点 */
}

.more-options-btn {
  font-size: 20px; /* 三个点图标大一些 */
  line-height: 1;
}

/* 下拉菜单相关样式 */
.dropdown-container {
  position: relative; /* 确保是下拉菜单的定位锚点 */
}

.dropdown-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px); /* 略微减小与按钮的间距 */
  width: 160px; /* 减小宽度 */
  background-color: rgba(60, 60, 65, 0.45); /* 调整为深灰色调，并增加alpha值，降低透明度 */
  backdrop-filter: blur(22px); /* 略微调整模糊度 */
  -webkit-backdrop-filter: blur(22px);
  border-radius: 10px; /* 保持圆角 */
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.25); /* 调整阴影 */
  z-index: 9999;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.15); /* 边框可以更细微 */
}

.dropdown-item {
  display: flex;
  align-items: center;
  padding: 10px 14px; /* 减小内边距，配合宽度减小 */
  color: #F0F0F0; /* 保持浅色文字 */
  cursor: pointer;
  transition: background-color 0.2s ease;
  text-shadow: 0 0 4px rgba(0,0,0,0.35); /* 调整文字阴影 */
}

.dropdown-item:hover {
  background-color: rgba(255, 255, 255, 0.12); /* 悬停反馈 */
}

.dropdown-icon {
  margin-right: 10px; /* 减小图标与文字的间距 */
  font-size: 17px; /* 略微减小图标大小 */
  width: 20px;   /* 调整图标容器宽度 */
  display: flex;
  justify-content: center;
  align-items: center;
  color: #EAEAEA; /* 保持浅色图标 */
}

.dropdown-text {
  flex: 1;
  font-size: 13px; /* 略微减小文字大小 */
  font-weight: 500;
}

.vip-tag {
  background-color: rgba(255, 77, 79, 0.8);
  color: white;
  font-size: 10px;
  padding: 2px 5px;
  border-radius: 5px;
  font-weight: bold;
  margin-left: 8px;
}

.actions-cell {
  width: 40px;
  display: flex;
  justify-content: center;
  overflow: visible; /* 允许内容溢出，以显示下拉菜单 */
}

.kw-hr-badge {
  background-color: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  font-size: 6px;
  font-weight: bold;
  padding: 1px 4px;
  border-radius: 3px;
  margin-right: 5px;
  display: inline-block;
}
</style>
