<template>
  <div class="lyrics-view-content">
    <div class="lyrics-header">
      <img :src="playerStore.currentSong?.albumArt || './default-album-art.png'" alt="Album Art" class="album-art-large">
      <h3>{{ playerStore.currentSong?.name || '歌曲名称' }}</h3>
      <p>{{ playerStore.currentSong?.artist || '歌手' }}</p>
    </div>
    <div class="lyrics-body" ref="lyricsContainer">
      <!-- 
        这里将显示歌词。
        歌词数据获取和解析逻辑需要添加到 Pinia store 或此组件中。
        常见的歌词格式是 .lrc，需要按时间戳高亮当前行。
      -->
      <p v-if="!lyrics || lyrics.length === 0">暂无歌词，或正在加载...</p>
      <p v-for="(line, index) in lyrics" 
         :key="index" 
         :class="{ active: isCurrentLine(line.time) }"
         class="lyric-line"
      >
        {{ line.text }}
      </p>
    </div>
    <button @click="playerStore.toggleLyricsView()" class="close-lyrics-btn">关闭</button>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { usePlayerStore } from '../stores/player';

const playerStore = usePlayerStore();
const lyricsContainer = ref(null);

const lyrics = ref([]); 

const fetchLyrics = async (songId) => {
  if (!songId) {
    lyrics.value = [{ time:0, text: "请先选择一首歌曲"}];
    return;
  }
  console.log("尝试为歌曲ID获取歌词: ", songId);
  // 模拟歌词，实际应该从API获取和解析
  lyrics.value = [
    { time: 0, text: "(歌曲准备中...)" },
    { time: 5, text: "这是第一句歌词" },
    { time: 10, text: "这是第二句歌词，它可能会比较长一点，需要换行显示" },
    { time: 15, text: "跟着节奏摇摆" },
    { time: 20, text: "啦啦啦 啦啦啦" },
    { time: 25, text: "音乐即将结束" },
  ];
  // 实际应在 Pinia store 中添加 action: getLyrics(songId)
  // 例如: const rawLrc = await playerStore.fetchLyricsFromAPI(songId);
  // if (rawLrc) lyrics.value = parseLrc(rawLrc);
};

/*
function parseLrc(lrcText) {
  if (!lrcText) return [];
  const lines = lrcText.split('\n');
  const result = [];
  const timeRegex = /^\[(\d{2}):(\d{2})[.:](\d{2,3})\](.*)$/;
  for (const line of lines) {
    const match = line.match(timeRegex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = parseInt(match[3], 10);
      const time = minutes * 60 + seconds + milliseconds / (match[3].length === 2 ? 100 : 1000);
      const text = match[4].trim();
      if (text || !text) { // 允许空歌词行，有些lrc文件会有时间戳但无文本
        result.push({ time, text });
      }
    }
  }
  return result.sort((a, b) => a.time - b.time);
}
*/

watch(() => playerStore.currentSong?.id, (newId) => {
  if (newId) {
    fetchLyrics(newId);
  } else {
    lyrics.value = [];
  }
}, { immediate: true });

const isCurrentLine = (lineTime) => {
  if (!lyrics.value || lyrics.value.length === 0) return false;
  const currentTime = playerStore.currentTime;
  let activeLineIndex = -1;

  for (let i = lyrics.value.length - 1; i >= 0; i--) {
    if (lyrics.value[i].time <= currentTime) {
      activeLineIndex = i;
      break;
    }
  }
  
  if (activeLineIndex !== -1 && lyrics.value[activeLineIndex].time === lineTime) {
    scrollToActiveLine(activeLineIndex);
    return true;
  }
  return false;
};

const scrollToActiveLine = (lineIndex) => {
  nextTick(() => {
    if (lyricsContainer.value) {
      const activeElement = lyricsContainer.value.children[lineIndex]; // 直接通过索引获取子元素
      if (activeElement) {
        const containerRect = lyricsContainer.value.getBoundingClientRect();
        const activeRect = activeElement.getBoundingClientRect();
        const desiredScrollTop = lyricsContainer.value.scrollTop +
                               (activeRect.top - containerRect.top) -
                               (containerRect.height / 2) +
                               (activeRect.height / 2);
        
        lyricsContainer.value.scrollTo({
          top: desiredScrollTop,
          behavior: 'smooth'
        });
      }
    }
  });
};

</script>

<style scoped>
.lyrics-view-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  height: 100%;
  width: 100%;
  padding: 20px;
  box-sizing: border-box;
  color: #e0e0e0;
}

.lyrics-header {
  margin-bottom: 20px;
}

.album-art-large {
  width: 150px;
  height: 150px;
  border-radius: 10px;
  margin-bottom: 15px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.3);
}

.lyrics-header h3 {
  margin: 10px 0 5px;
  font-size: 1.6rem;
  color: #fff;
}

.lyrics-header p {
  margin: 0;
  font-size: 1rem;
  color: #bbb;
}

.lyrics-body {
  flex-grow: 1;
  overflow-y: auto;
  width: 100%;
  max-width: 600px; 
  padding: 10px 0;
  line-height: 2.2; 
  font-size: 1.1rem; 
  scrollbar-width: thin; 
  scrollbar-color: #555 #333; 
}

.lyrics-body::-webkit-scrollbar {
  width: 6px;
}

.lyrics-body::-webkit-scrollbar-track {
  background: #333;
  border-radius: 3px;
}

.lyrics-body::-webkit-scrollbar-thumb {
  background-color: #555;
  border-radius: 3px;
}

.lyric-line {
  margin-bottom: 10px;
  transition: color 0.3s ease, transform 0.3s ease;
  color: #aaa; 
}

.lyric-line.active {
  color: var(--vt-c-indigo); 
  font-weight: 600;
  transform: scale(1.05);
}

.close-lyrics-btn {
  margin-top: 20px;
  padding: 10px 25px;
  border: none;
  border-radius: 20px;
  background-color: var(--vt-c-indigo);
  color: white;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.close-lyrics-btn:hover {
  background-color: #3b5168;
}
</style>
