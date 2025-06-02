import { defineStore } from 'pinia';
import axios from 'axios';
import { getPlayerState } from './persistedState';
import * as dataCache from './dataCache';

// 从环境变量中获取 API 地址
const API_URL = import.meta.env.VITE_BACKEND_API_URL || 'https://api.931125.xyz';
const PLAYBACK_MODES = ['sequential', 'single', 'shuffle']; // 顺序, 单曲, 随机
const MAIN_API_BASE = import.meta.env.VITE_MAIN_API_BASE || 'https://api.931125.xyz'; // 主API基础URL
const FALLBACK_API_BASE = import.meta.env.VITE_FALLBACK_API_BASE || 'https://kw-api.cenguigui.cn'; // 备用API基础URL

// 是否使用ID前缀来区分歌曲来源
const USE_ID_PREFIX = import.meta.env.VITE_USE_ID_PREFIX === 'true';
const MAIN_ID_PREFIX = import.meta.env.VITE_MAIN_ID_PREFIX || 'main_';
const KW_ID_PREFIX = import.meta.env.VITE_KW_ID_PREFIX || 'kw_';

// 默认专辑图片URL
const DEFAULT_ALBUM_ART = 'https://p2.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg';

// 从localStorage加载保存的播放状态
const savedState = getPlayerState();

export const usePlayerStore = defineStore('player', {
  state: () => ({
    playlist: [], // 当前播放列表，歌曲对象会包含 preloadedUrl
    currentSong: null, // 当前播放的歌曲对象 { id, name, artist, albumArt, url, duration, ... }
    currentSongIndex: savedState?.currentSongIndex || -1, // 当前歌曲在播放列表中的索引
    isPlaying: false, // 默认为false，会在恢复时更新
    currentTime: savedState?.currentTime || 0, // 当前播放时间（秒）
    volume: savedState?.volume || 0.5, // 音量 (0 到 1)
    showLyricsView: false, // 是否显示歌词界面
    playbackMode: savedState?.playbackMode || PLAYBACK_MODES[0], // 播放模式
    showPlaybackModeToast: false, // 是否显示播放模式提示
    toastMessage: '', // 提示框消息
    // 歌词相关 state
    currentLyrics: [], // 解析后的歌词对象数组: [{ time: number, text: string }]
    translatedLyrics: [], // 解析后的翻译歌词对象数组
    currentLyricIndex: -1, // 当前高亮歌词行的索引
    showTranslatedLyrics: false, // 是否显示翻译歌词
    isLoadingLyrics: false, // 是否正在加载歌词
    _currentLoadingSongId: null, // 当前正在加载歌词的歌曲ID，用于防止重复请求
    _hasPreloadedBeforeEnd: false, // 用于跟踪歌曲是否已经在接近结束时预加载过
    lastSearchKeyword: null, // 用于存储最后一次搜索的关键词
    isDataLoaded: false, // 标记是否已加载数据

    // 新增状态：用于双API搜索
    isSearching: false, // 是否正在搜索中
    mainApiOffset: 0, // 主API的当前偏移量
    fallbackApiOffset: 0, // 备用API的当前偏移量
    mainApiHasMore: true, // 主API是否还有更多结果
    fallbackApiHasMore: true, // 备用API是否还有更多结果
    mainApiSongs: [], // 主API返回的歌曲列表(用于去重)
    fallbackApiSongs: [], // 备用API返回的歌曲列表(用于去重)
    combinedSongIds: new Set(), // 用于去重的歌曲ID集合

    // 新增状态：用于解决歌曲切换时的播放问题
    isLoadingNewSong: false, // 是否正在加载新歌曲
    _tempSearchResults: null, // 临时存储搜索结果，以便在不替换播放列表时恢复
  }),
  getters: {
    /**
     * 获取当前歌曲的总时长。
     * @param {object} state - Pinia state。
     * @returns {number} 歌曲时长（秒），如果歌曲未加载则为 0。
     */
    currentSongDuration(state) {
      if (!state.currentSong || !state.currentSong.duration) return 0;

      // 统一处理：currentSong.duration 现在总是存储毫秒，需要转换为秒
      return state.currentSong.duration / 1000;
    },
    /**
     * 获取格式化后的当前播放时间 (m:ss)。
     * @param {object} state - Pinia state。
     * @returns {string} 格式化后的时间字符串。
     */
    formattedCurrentTime(state) {
      const minutes = Math.floor(state.currentTime / 60);
      const seconds = Math.floor(state.currentTime % 60).toString().padStart(2, '0');
      return `${minutes}:${seconds}`;
    },
    /**
     * 获取格式化后的歌曲总时长 (m:ss)。
     * @param {object} state - Pinia state。
     * @returns {string} 格式化后的时间字符串。
     */
    formattedTotalDuration(state) {
      if (!state.currentSong || !state.currentSong.duration) return '0:00';

      // 统一处理：currentSong.duration 现在总是存储毫秒，需要转换为秒
      const durationInSeconds = state.currentSong.duration / 1000;
      const minutes = Math.floor(durationInSeconds / 60);
      const seconds = Math.floor(durationInSeconds % 60).toString().padStart(2, '0');
      return `${minutes}:${seconds}`;
    },
    currentPlaybackModeText(state) {
      switch (state.playbackMode) {
        case 'sequential': return '顺序播放';
        case 'single': return '单曲循环';
        case 'shuffle': return '随机播放';
        default: return '未知模式';
      }
    },
    hasLyrics(state) {
      return state.currentLyrics && state.currentLyrics.length > 0;
    },
  },
  actions: {
    /**
     * 将酷我API返回的URL中的level=exhigh替换为level=lossless
     * @param {string} url - 原始URL
     * @returns {string} - 替换后的URL
     * @private
     */
    _convertExhighToLossless(url) {
      if (!url) return url;

      // 替换level=exhigh为level=lossless
      if (url.includes('level=exhigh')) {
        return url.replace('level=exhigh', 'level=lossless');
      }

      return url;
    },

    /**
     * 添加歌曲到最近播放列表
     * @param {Object} song - 歌曲对象
     * @private
     */
    _addToRecentlyPlayed(song) {
      // 这里可以实现最近播放功能，暂时只记录日志
      console.log(`[PlayerStore] 添加歌曲到最近播放: ${song.name}`);
      // 实际的最近播放功能可以在未来实现
    },

    /**
     * 格式化备用API (酷我) 返回的歌曲数据
     * @param {Object} song - 备用API返回的歌曲对象
     * @returns {Object} 格式化后的歌曲对象，与主API格式一致
     */
    _formatFallbackApiSong(song) {
      if (!song) return null;

      // 提取歌手名称
      let artistName = song.artist || '未知艺术家';

      // 处理ID，添加前缀
      let songId = song.rid || song.id;
      if (USE_ID_PREFIX && songId) {
        songId = `${KW_ID_PREFIX}${songId}`;
      }

      // 确保专辑封面URL可用
      let albumArt = song.pic || song.albumpic || '';
      // 如果没有封面或封面URL不可用，使用默认封面
      if (!albumArt || albumArt.trim() === '') {
        albumArt = DEFAULT_ALBUM_ART;
      }

      // 直接使用API返回的url字段（如果有），并替换level=exhigh为level=lossless
      let url = null;
      if (song.url && typeof song.url === 'string' && song.url.startsWith('http')) {
        url = this._convertExhighToLossless(song.url);
      }

      // 构建格式化的歌曲对象
      return {
        id: songId, // 使用添加了前缀的ID
        rid: song.rid || song.id, // 保存原始RID，用于后续获取详情
        name: song.name || '未知歌曲',
        artist: artistName,
        album: song.album || '未知专辑',
        albumId: null, // 备用API可能没有专辑ID
        albumArt: albumArt,
        duration: song.duration || 0, // 保持酷我API的时长单位为秒
        lyricist: artistName, // 假设作词者是歌手
        composer: artistName, // 假设作曲者是歌手
        isFromKw: true, // 标记来源为备用API
        originalData: song, // 保留原始数据，以备后用
        url: url, // 保留原始URL字段
        lrcUrl: song.lrc ? this._convertExhighToLossless(song.lrc) : null // 保存歌词URL并替换level
      };
    },
    /**
     * 设置播放列表
     * @param {Array} songs - 歌曲数组
     * @param {boolean} replaceExisting - 是否替换现有播放列表，默认为true
     * @param {boolean} fromCache - 是否来自缓存，用于避免再次缓存
     */
    setPlaylist(songs, replaceExisting = true, fromCache = false) {
      if (!songs || !Array.isArray(songs)) {
        console.error('[PlayerStore] setPlaylist: 提供的歌曲列表无效');
        return;
      }

      // 如果完全替换播放列表，重置所有搜索相关状态
      if (replaceExisting) {
        this.resetSearchState();
      }

      // 格式化歌曲数据，确保有必要的字段
      const formattedSongs = songs.map(song => ({
        ...song,
        // 确保有专辑封面（如果没有，使用默认图片）
        albumArt: song.albumArt || 'https://p2.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg',
        // 预加载URL初始为null
        preloadedUrl: null
      }));

      if (replaceExisting) {
        const previouslyPlayingSong = this.currentSong; // 保存替换前的 currentSong
        this.playlist = formattedSongs;

        if (previouslyPlayingSong) {
          const newIndexOfPreviouslyPlayingSong = this.playlist.findIndex(song => song.id === previouslyPlayingSong.id);
          if (newIndexOfPreviouslyPlayingSong !== -1) {
            // 原来播放/选中的歌曲仍在新列表中
            this.currentSongIndex = newIndexOfPreviouslyPlayingSong;
            // this.currentSong 保持不变，因为它就是 previouslyPlayingSong
          } else {
            // 原来播放/选中的歌曲已不在新列表中
            this.currentSongIndex = -1; // 清除高亮索引
            // this.currentSong 和 this.isPlaying 保持不变，允许当前歌曲播完
            // 如果希望停止播放并清除currentSong，可以在这里添加逻辑
          }
        } else {
          // 替换列表时，原本就没有歌曲在播放/选中
          this.currentSongIndex = this.playlist.length > 0 ? 0 : -1;
          this.currentSong = this.playlist.length > 0 ? this.playlist[0] : null;
        }
      } else {
        // 如果播放列表为空，直接设置
        if (this.playlist.length === 0) {
          this.playlist = formattedSongs;
        } else {
          // 保留当前播放列表中的歌曲，将新歌曲添加到列表末尾
          // 避免重复添加，通过ID检查
          const existingIds = new Set(this.playlist.map(s => s.id));
          const uniqueNewSongs = formattedSongs.filter(s => !existingIds.has(s.id));
          this.playlist = [...this.playlist, ...uniqueNewSongs];
        }
      }

      // 如果当前没有选中的歌曲但列表不为空，预设第一首
      if (!replaceExisting && this.currentSongIndex === -1 && this.playlist.length > 0) {
        this.currentSongIndex = 0;
        this.currentSong = this.playlist[0];
      }

      // 预加载当前歌曲的下一首
      if (this.playlist.length > 1) {
        this.preloadNextSong();
      }

      // 标记数据已加载
      this.isDataLoaded = true;

      // 如果不是来自缓存，则缓存歌曲列表
      if (!fromCache && this.lastSearchKeyword) {
        // 缓存搜索结果
        dataCache.cacheSearchResults(this.lastSearchKeyword, formattedSongs);
      } else if (!fromCache && !this.lastSearchKeyword) {
        // 缓存初始歌曲列表
        dataCache.cacheInitialSongs(formattedSongs);
      }
    },

    /**
     * 内部方法：根据歌曲对象获取歌曲URL和时长，支持重试。
     * 根据歌曲的 isFromKw 属性决定使用哪个API获取URL。
     * @param {Object} songObject - 歌曲对象。
     * @param {number} retryCount - 当前重试次数。
     * @param {number} maxRetries - 最大重试次数。
     * @returns {Promise<object|null>} 包含 url 和 duration 的对象，或 null。
     */
    async _fetchSongUrl(songObject, retryCount = 0, maxRetries = 2) {
      if (!songObject || typeof songObject.id === 'undefined') {
        console.error("[PlayerStore] 歌曲对象或歌曲ID缺失，无法获取URL");
        return null;
      }

      // 如果歌曲来自备用API，直接使用备用API获取URL
      if (songObject.isFromKw) {
        // 酷我歌曲直接重新获取，不使用缓存或使用较短的缓存时间
        const cachedSongDetails = await dataCache.getCachedSongUrl(songObject.id);
        const isKwCacheValid = cachedSongDetails &&
          cachedSongDetails.timestamp &&
          (Date.now() - cachedSongDetails.timestamp < 1 * 24 * 60 * 60 * 1000); // 酷我URL缓存只有1天有效期

        if (cachedSongDetails && isKwCacheValid) {
          console.log(`[PlayerStore] 使用有效缓存的酷我歌曲URL: ID ${songObject.id}, 歌名 ${songObject.name}`);
          return cachedSongDetails;
        }

        return this._fetchSongUrlFromFallbackApi(songObject);
      }

      const songId = songObject.id;
      const songName = songObject.name || '未知歌曲';
      const retryDelay = 500;

      // 首先检查缓存
      const cachedSongDetails = await dataCache.getCachedSongUrl(songId);

      // 检查缓存是否存在且是否过期（7天）
      const isCacheValid = cachedSongDetails &&
        cachedSongDetails.timestamp &&
        (Date.now() - cachedSongDetails.timestamp < 7 * 24 * 60 * 60 * 1000);

      // 如果缓存有效，直接使用缓存
      if (cachedSongDetails && isCacheValid) {
        console.log(`[PlayerStore] 使用有效缓存的歌曲URL: ID ${songId}, 歌名 ${songName}`);
        return cachedSongDetails;
      } else if (cachedSongDetails) {
        console.log(`[PlayerStore] 缓存的歌曲URL已过期: ID ${songId}, 歌名 ${songName}, 重新获取`);

        // 我们将尝试获取新的URL，不再使用过期的缓存并在后台更新
        // 这样可以确保始终使用最新的URL播放歌曲
      }

      // 处理ID前缀，提取纯ID
      let cleanId = songId;
      if (USE_ID_PREFIX && typeof songId === 'string' && songId.startsWith(MAIN_ID_PREFIX)) {
        cleanId = songId.substring(MAIN_ID_PREFIX.length);
      }

      // 打印主API请求URL
      const mainApiUrl = `${MAIN_API_BASE}/song/url?id=${cleanId}`;
      // // console.log(`[PlayerStore] 主API请求URL: ${mainApiUrl}`);

      try {
        const response = await axios.get(`${MAIN_API_BASE}/song/url`, {
          params: { id: cleanId }
        });

        if (response.data && response.data.data && response.data.data[0] && response.data.data[0].url) {
          const songData = response.data.data[0];

          const songDetails = {
            url: songData.url,
            duration: (songData.time || 0), // 直接使用毫秒
            isFallbackDirect: false,
            directPlayUrl: null,
            id: songId,
            timestamp: Date.now() // 添加时间戳记录缓存时间
          };
          await dataCache.cacheSongUrl(songId, songDetails);
          return songDetails;
        } else {
          console.warn(`[PlayerStore] 主API返回的数据中没有有效的URL, 歌曲ID: ${cleanId}, 响应数据:`, JSON.stringify(response.data));

          // 检测到灰色歌曲（网易云没有版权的歌曲），直接尝试从备用API获取
          // // console.log(`[PlayerStore] 检测到灰色歌曲，直接尝试从备用API通过歌名获取: ${songObject.name}`);
          const fallbackDetails = await this._fetchSongUrlFromFallbackApi(songObject);
          if (fallbackDetails) {
            return fallbackDetails;
          }

          throw new Error('主API未返回有效歌曲URL数据');
        }
      } catch (error) {
        console.error(`[PlayerStore] 主API获取歌曲链接时出错: ID ${songId}, 重试次数: ${retryCount}/${maxRetries}, 错误: `, error);

        // 对于404错误或网络错误，直接尝试备用API，不再重试主API
        if (error.response && (error.response.status === 404 || error.response.status === 403)) {
          // // console.log(`[PlayerStore] 主API返回${error.response.status}错误，直接尝试备用API`);
          const fallbackDetails = await this._fetchSongUrlFromFallbackApi(songObject);
          if (fallbackDetails) {
            return fallbackDetails;
          }
        }

        // 对于其他错误，也直接尝试从备用API获取，不进行重试
        // // console.log(`[PlayerStore] 主API获取失败，直接尝试从备用API通过歌名获取: ${songObject.name}`);
        const fallbackDetails = await this._fetchSongUrlFromFallbackApi(songObject);
        if (fallbackDetails) {
          return fallbackDetails;
        }

        // 只有在备用API也失败且有过期缓存的情况下，尝试使用过期缓存
        if (cachedSongDetails) {
          console.log(`[PlayerStore] 所有API都失败，使用过期缓存作为最后的备用: ID ${songId}, 歌名 ${songName}`);
          return {
            ...cachedSongDetails,
            needsRefresh: true // 标记需要刷新，但此时已无法刷新
          };
        }

        // 如果备用API也失败且没有缓存，尝试重试主API
        if (retryCount < maxRetries) {
          // // console.log(`[PlayerStore] 备用API也失败，将在${retryDelay}ms后进行第${retryCount + 1}次重试获取歌曲URL`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return this._fetchSongUrl(songObject, retryCount + 1, maxRetries);
        } else {
          // // console.log(`[PlayerStore] 主API重试${maxRetries}次后仍然失败，且备用API也失败，无法获取歌曲URL`);
          return null;
        }
      }
    },

    /**
     * 在后台更新歌曲URL，不阻塞播放流程
     * @param {object} songObject - 歌曲对象
     * @param {object} cachedDetails - 缓存的详情
     * @private
     */
    async _updateSongUrlInBackground(songObject, cachedDetails) {
      try {
        console.log(`[PlayerStore] 在后台更新歌曲URL: ${songObject.name}`);

        // 对于酷我歌曲，使用酷我API获取URL
        if (songObject.isFromKw) {
          console.log(`[PlayerStore] 在后台更新酷我歌曲URL: ${songObject.name}`);
          const fallbackDetails = await this._fetchSongUrlFromFallbackApi(songObject);
          if (fallbackDetails && fallbackDetails.url) {
            // 缓存新的URL
            await dataCache.cacheSongUrl(songObject.id, fallbackDetails);
            console.log(`[PlayerStore] 酷我歌曲URL已在后台更新: ${songObject.name}`);

            // 如果当前正在播放这首歌曲，更新播放器
            this._updateCurrentPlayerIfNeeded(songObject, fallbackDetails);
          } else {
            console.error(`[PlayerStore] 在后台更新酷我歌曲URL失败: ${songObject.name}`);
          }
          return;
        }

        // 处理ID前缀，提取纯ID
        let cleanId = songObject.id;
        if (USE_ID_PREFIX && typeof songObject.id === 'string' && songObject.id.startsWith(MAIN_ID_PREFIX)) {
          cleanId = songObject.id.substring(MAIN_ID_PREFIX.length);
        }

        const response = await axios.get(`${MAIN_API_BASE}/song/url`, {
          params: { id: cleanId }
        });

        if (response.data && response.data.data && response.data.data[0] && response.data.data[0].url) {
          const songData = response.data.data[0];

          const songDetails = {
            url: songData.url,
            duration: (songData.time || 0),
            isFallbackDirect: false,
            directPlayUrl: null,
            id: songObject.id,
            timestamp: Date.now()
          };

          await dataCache.cacheSongUrl(songObject.id, songDetails);
          console.log(`[PlayerStore] 歌曲URL已在后台更新: ${songObject.name}`);

          // 如果当前正在播放这首歌曲，更新播放器
          this._updateCurrentPlayerIfNeeded(songObject, songDetails);
        } else {
          console.warn(`[PlayerStore] 在后台更新URL时，主API返回的数据中没有有效的URL`);

          // 如果主API失败，尝试备用API
          const fallbackDetails = await this._fetchSongUrlFromFallbackApi(songObject);
          if (fallbackDetails && fallbackDetails.url) {
            await dataCache.cacheSongUrl(songObject.id, fallbackDetails);
            console.log(`[PlayerStore] 使用备用API更新歌曲URL: ${songObject.name}`);

            // 如果当前正在播放这首歌曲，更新播放器
            this._updateCurrentPlayerIfNeeded(songObject, fallbackDetails);
          }
        }
      } catch (error) {
        console.error(`[PlayerStore] 后台更新歌曲URL失败:`, error);
      }
    },

    /**
     * 如果当前正在播放的歌曲与更新的歌曲相同，则更新播放器
     * @param {object} songObject - 更新URL的歌曲对象
     * @param {object} newDetails - 新的歌曲详情，包含URL
     * @private
     */
    _updateCurrentPlayerIfNeeded(songObject, newDetails) {
      // 如果当前正在播放这首歌曲且URL已经变化，则需要更新播放器
      if (this.currentSong && this.currentSong.id === songObject.id &&
        this.currentSong.url !== newDetails.url) {
        console.log(`[PlayerStore] 当前正在播放的歌曲URL已更新，准备更新播放器`);

        // 获取当前播放时间和播放状态
        const audioElement = this._getAudioElement();
        if (audioElement) {
          const currentTime = audioElement.currentTime;
          const wasPlaying = !audioElement.paused;
          const volume = audioElement.volume;

          // 更新当前歌曲对象的URL
          this.currentSong.url = newDetails.url;
          this.currentSong.directPlayUrl = newDetails.directPlayUrl || null;
          this.currentSong.isFallbackDirect = newDetails.isFallbackDirect || false;
          this.currentSong.timestamp = newDetails.timestamp;

          // 确定要使用的URL
          const urlToUse = newDetails.url || newDetails.directPlayUrl;

          if (urlToUse) {
            console.log(`[PlayerStore] 使用新URL更新播放器: ${urlToUse.substring(0, 100)}...`);

            // 更新音频元素
            audioElement.src = urlToUse;
            audioElement.volume = volume;
            audioElement.currentTime = currentTime;

            // 如果之前正在播放，则恢复播放
            if (wasPlaying) {
              audioElement.play().catch(e => {
                console.error(`[PlayerStore] 更新URL后恢复播放失败:`, e);
              });
            }
          }
        }
      }
    },

    /**
     * 内部方法：从备用 API 获取歌曲 URL。
     * 如果歌曲来自备用API (isFromKw=true)，则直接使用rid获取URL。
     * 否则，先通过歌名搜索获取备用API的歌曲ID(rid)，然后用rid获取URL。
     * @param {object} originalSongObject - 原始歌曲对象 (包含主API的id, name, artist等)。
     * @returns {Promise<object|null>} 包含 url 和 duration 的对象，或 null。
     */
    async _fetchSongUrlFromFallbackApi(originalSongObject) {
      if (!originalSongObject || typeof originalSongObject.id === 'undefined') {
        console.error('[PlayerStore] 备用API: originalSongObject 无效或缺少ID');
        return null;
      }

      let kwRid = null;
      const rawId = String(originalSongObject.id);

      // 首先尝试从ID中提取kwRid
      if (USE_ID_PREFIX && typeof rawId === 'string') {
        if (rawId.startsWith(KW_ID_PREFIX)) {
          kwRid = rawId.substring(KW_ID_PREFIX.length);
        } else if (rawId.startsWith('kw-')) {
          kwRid = rawId.substring(3);
        }
        // 注意：不再从 MAIN_ID_PREFIX 中提取并假设它是kwRid，因为这通常是错误的
      } else if (/^\d+$/.test(rawId) && originalSongObject.isFromKw) {
        // 如果 originalSongObject 明确来自酷我，并且ID是纯数字，则直接使用
        kwRid = rawId;
      }

      // 如果通过ID成功提取了kwRid，并且是纯数字，则尝试直接获取
      if (kwRid && /^\d+$/.test(kwRid)) {
        //// // console.log(`[PlayerStore] 备用API: 尝试使用提取的 kwRid ${kwRid} 获取歌曲详情`);
        const songDetailsById = await this._fetchKwSongDetailsByRid(kwRid, originalSongObject);
        if (songDetailsById && songDetailsById.url) {
          dataCache.cacheSongUrl(originalSongObject.id, songDetailsById);
          return songDetailsById;
        }
        //// // console.log(`[PlayerStore] 备用API: 使用 kwRid ${kwRid} 未能获取到有效歌曲详情或URL。`);
      }

      // 如果通过ID未能获取，或者没有有效的kwRid，则尝试通过歌名和歌手名搜索
      // // console.log(`[PlayerStore] 备用API: 尝试通过歌名 "${originalSongObject.name}" 和歌手 "${originalSongObject.artist}" 搜索`);
      // // console.log("[PlayerStore] 备用API: originalSongObject:", JSON.stringify(originalSongObject).substring(0, 500)); // 打印部分对象结构

      // 检查歌曲名是否存在
      if (!originalSongObject.name) {
        console.warn('[PlayerStore] 备用API: 歌曲名缺失，无法进行搜索。');
        return null;
      }

      try {
        // 构建搜索关键词，即使歌手名缺失也能搜索
        let searchKeywords = originalSongObject.name;

        // 尝试获取有效的歌手名
        let artistName = null;
        if (originalSongObject.artist && originalSongObject.artist !== 'undefined') {
          artistName = originalSongObject.artist;
        } else if (originalSongObject.ar && originalSongObject.ar.length > 0 && originalSongObject.ar[0].name) {
          // 尝试从网易云歌曲对象的ar数组中获取歌手名
          artistName = originalSongObject.ar[0].name;
        } else if (originalSongObject.artists && originalSongObject.artists.length > 0 && originalSongObject.artists[0].name) {
          // 尝试从网易云歌曲对象的artists数组中获取歌手名
          artistName = originalSongObject.artists[0].name;
        }

        // 如果有有效的歌手名，添加到搜索关键词中
        if (artistName) {
          searchKeywords = `${originalSongObject.name}${artistName}`;
          // // console.log(`[PlayerStore] 备用API: 使用歌曲名和歌手名搜索(无空格): ${searchKeywords}`);
        } else {
          // // console.log(`[PlayerStore] 备用API: 歌手名缺失或无效，仅使用歌曲名进行搜索: ${searchKeywords}`);
        }

        // 打印完整的搜索URL
        const fullSearchUrl = `${FALLBACK_API_BASE}?name=${encodeURIComponent(searchKeywords)}&level=lossless`;
        // // console.log(`[PlayerStore] 备用API: 完整搜索URL: ${fullSearchUrl}`);

        // 使用简单的搜索关键词
        const searchResults = await this._searchSongsFromFallbackApi(searchKeywords);

        // // console.log(`[PlayerStore] 备用API: 搜索结果数量: ${searchResults ? searchResults.length : 0}`);
        if (searchResults && searchResults.length > 0) {
          // // console.log(`[PlayerStore] 备用API: 搜索结果第一首: ${JSON.stringify(searchResults[0])}`);
        }

        if (searchResults && searchResults.length > 0) {
          // 如果有多个搜索结果，尝试找到最匹配的那一首
          let bestMatch = searchResults[0]; // 默认使用第一个结果
          let bestScore = 0;

          // 对每个搜索结果进行评分，找出最匹配的
          for (const result of searchResults) {
            let score = 0;

            // 歌曲名完全匹配加高分
            if (result.name.toLowerCase() === originalSongObject.name.toLowerCase()) {
              score += 10;
            }
            // 歌曲名包含原始歌曲名加分
            else if (result.name.toLowerCase().includes(originalSongObject.name.toLowerCase())) {
              score += 5;
            }

            // 如果有歌手名，匹配歌手名
            if (artistName && result.artist) {
              // 歌手名完全匹配加高分
              if (result.artist.toLowerCase() === artistName.toLowerCase()) {
                score += 8;
              }
              // 歌手名包含原始歌手名加分
              else if (result.artist.toLowerCase().includes(artistName.toLowerCase()) ||
                artistName.toLowerCase().includes(result.artist.toLowerCase())) {
                score += 4;
              }
            }

            // 更新最佳匹配
            if (score > bestScore) {
              bestScore = score;
              bestMatch = result;
            }
          }

          // // console.log(`[PlayerStore] 备用API: 找到最佳匹配歌曲，歌名: ${bestMatch.name}, 歌手: ${bestMatch.artist}, 匹配分数: ${bestScore}`);

          // 1. 首先尝试直接使用搜索结果中的URL字段
          if (bestMatch.url) {
            // // console.log(`[PlayerStore] 备用API: 直接使用搜索结果中的URL字段: ${bestMatch.url.substring(0, 100)}...`);

            const songDetails = {
              url: this._convertExhighToLossless(bestMatch.url),
              directPlayUrl: this._convertExhighToLossless(bestMatch.url),
              isFallbackDirect: true,
              isFromKw: true,
              duration: bestMatch.duration || 0,
              name: bestMatch.name,
              artist: bestMatch.artist,
              albumArt: bestMatch.albumArt,
              id: originalSongObject.id
            };

            // 缓存结果
            dataCache.cacheSongUrl(originalSongObject.id, songDetails);
            return songDetails;
          }

          // 2. 如果没有直接的URL字段，尝试使用RID构建URL
          const foundKwRid = bestMatch.rid || bestMatch.id;
          if (foundKwRid && /^\d+$/.test(String(foundKwRid))) {
            // // console.log(`[PlayerStore] 备用API: 使用搜索结果的RID构建播放链接: ${foundKwRid}`);

            // 直接构建播放链接
            const mp3PlayUrl = `${FALLBACK_API_BASE}?id=${foundKwRid}&type=song&level=lossless&format=flac`;

            const songDetails = {
              url: mp3PlayUrl,
              directPlayUrl: mp3PlayUrl,
              isFallbackDirect: true,
              isFromKw: true,
              duration: bestMatch.duration || 0,
              name: bestMatch.name,
              artist: bestMatch.artist,
              albumArt: bestMatch.albumArt,
              id: originalSongObject.id
            };

            // 缓存结果
            dataCache.cacheSongUrl(originalSongObject.id, songDetails);
            return songDetails;
          }
        } else {
          // // console.log(`[PlayerStore] 备用API: 通过歌名${originalSongObject.artist ? "和歌手名" : ""}未能搜索到匹配的酷我歌曲。`);
        }
      } catch (searchError) {
        console.error('[PlayerStore] 备用API: 通过歌名和歌手名搜索时出错:', searchError);
      }

      console.warn(`[PlayerStore] 备用API: 最终未能通过ID或搜索获取到 ${originalSongObject.name} 的播放链接。`);
      return null;
    },

    /**
     * 辅助方法：根据酷我RID获取歌曲详情和播放链接
     * @param {string} kwRid - 酷我歌曲的纯数字ID
     * @param {object} originalSongObject - 用于获取初始信息和缓存键的原始歌曲对象
     * @param {object|null} searchedSongData - (可选) 通过搜索获取到的歌曲数据，用于补充信息
     * @returns {Promise<object|null>} 包含 url, duration 等的对象，或 null
     */
    async _fetchKwSongDetailsByRid(kwRid, originalSongObject, searchedSongData = null) {
      // 构建详细URL
      const mp3Url = `${FALLBACK_API_BASE}?id=${kwRid}&type=song&level=lossless&format=flac`;
      const flacUrl = `${FALLBACK_API_BASE}?id=${kwRid}&type=song&level=lossless&format=flac`;
      const detailUrl = `${FALLBACK_API_BASE}?id=${kwRid}&type=song&level=lossless`;

      // // // console.log(`[PlayerStore] _fetchKwSongDetailsByRid: MP3播放链接 ${mp3Url}`);
      // // // console.log(`[PlayerStore] _fetchKwSongDetailsByRid: FLAC播放链接 ${flacUrl}`);
      //// // console.log(`[PlayerStore] _fetchKwSongDetailsByRid: 详情API ${detailUrl}`);

      // 根据截图中的URL格式构建播放链接
      const mp3PlayUrl = `${FALLBACK_API_BASE}?id=${kwRid}&type=song&level=lossless&format=flac`;
      const flacPlayUrl = `${FALLBACK_API_BASE}?id=${kwRid}&type=song&level=lossless&format=flac`;

      // 优先使用 searchedSongData (如果提供)，否则使用 originalSongObject
      const baseSongInfo = searchedSongData || originalSongObject;

      let songDetailsToReturn = {
        url: mp3PlayUrl,
        directPlayUrl: mp3PlayUrl,
        flacUrl: flacPlayUrl,
        isFallbackDirect: true,
        isFromKw: true,
        duration: baseSongInfo.duration || 0,
        name: baseSongInfo.name || '未知歌曲',
        artist: baseSongInfo.artist || '未知艺术家',
        albumArt: baseSongInfo.albumArt || (searchedSongData ? searchedSongData.albumArt : originalSongObject.albumArt),
        // 使用 originalSongObject.id 进行后续的播放器内部逻辑和缓存键
        id: originalSongObject.id
      };

      try {
        // 获取歌曲详情，使用正确的API格式
        const songInfoResponse = await axios.get(FALLBACK_API_BASE, {
          params: {
            id: kwRid,
            type: 'song',
            level: 'lossless' // 修改为lossless无损音质
            // 移除format参数，使用API默认格式
          },
        });

        if (songInfoResponse.data && songInfoResponse.data.code === 200 && songInfoResponse.data.data) {
          const kwApiData = songInfoResponse.data.data;

          songDetailsToReturn.duration = parseInt(kwApiData.duration, 10) || songDetailsToReturn.duration;
          songDetailsToReturn.name = kwApiData.name || songDetailsToReturn.name;
          songDetailsToReturn.artist = kwApiData.artist || songDetailsToReturn.artist || '未知艺术家';

          if (kwApiData.pic && kwApiData.pic !== 'NO_PIC') {
            songDetailsToReturn.albumArt = kwApiData.pic;
          } else if (kwApiData.pic === 'NO_PIC') {
            // 保留已有的 albumArt (可能来自 originalSongObject 或 searchedSongData)
            // // console.log(`[PlayerStore] _fetchKwSongDetailsByRid: 酷我API返回NO_PIC，保留图片: ${songDetailsToReturn.albumArt}`);
          }

          // 如果API返回了直接的url字段，使用它
          if (kwApiData.url) {
            songDetailsToReturn.url = this._convertExhighToLossless(kwApiData.url);
            songDetailsToReturn.directPlayUrl = this._convertExhighToLossless(kwApiData.url);
            // // // console.log(`[PlayerStore] _fetchKwSongDetailsByRid: 使用API返回的直接URL: ${kwApiData.url.substring(0, 100)}...`);
          }

          // 如果当前歌曲正在播放且ID匹配，则更新播放器中的歌曲信息
          if (this.currentSong && this.currentSong.id === originalSongObject.id) {
            this.currentSong.albumArt = songDetailsToReturn.albumArt;
            this.currentSong.name = songDetailsToReturn.name;
            this.currentSong.artist = songDetailsToReturn.artist;
            this.currentSong.duration = songDetailsToReturn.duration;
          }
          return songDetailsToReturn;
        }
      } catch (infoError) {
        console.error(`[PlayerStore] _fetchKwSongDetailsByRid: 获取酷我歌曲详情(RID: ${kwRid})时出错:`, infoError);
      }
      return songDetailsToReturn; // 即使获取详情失败，也返回基本的播放链接
    },

    /**
     * 预加载下一首歌曲的URL
     * @param {number} specificIndex - 指定要预加载的歌曲索引，如果不提供则自动计算下一首
     */
    async preloadNextSong(specificIndex = null) {
      // 如果没有播放列表或只有一首歌，不需要预加载
      if (!this.playlist || this.playlist.length <= 1) {
        return;
      }

      // 如果当前没有播放歌曲，也无法预加载
      if (this.currentSongIndex === -1) {
        return;
      }

      // 确定要预加载的歌曲索引
      let nextIndex;
      if (specificIndex !== null && specificIndex >= 0 && specificIndex < this.playlist.length) {
        nextIndex = specificIndex;
      } else {
        // 根据播放模式确定下一首歌
        if (this.playbackMode === 'single') {
          // 单曲循环模式下，预加载当前歌曲
          nextIndex = this.currentSongIndex;
        } else if (this.playbackMode === 'shuffle') {
          // 随机模式下，随机选择一首歌（除了当前歌曲）
          if (this.playlist.length > 1) {
            let randomIndex;
            do {
              randomIndex = Math.floor(Math.random() * this.playlist.length);
            } while (randomIndex === this.currentSongIndex);
            nextIndex = randomIndex;
          } else {
            nextIndex = 0;
          }
        } else {
          // 顺序播放模式下，预加载下一首歌
          nextIndex = (this.currentSongIndex + 1) % this.playlist.length;
        }
      }

      // 检查是否已经预加载过
      if (this.playlist[nextIndex].preloadedUrl) {
        return;
      }

      try {
        // 获取歌曲URL
        const nextSong = this.playlist[nextIndex];
        const songDetails = await this._fetchSongUrl(nextSong);

        if (songDetails) {
          // 确定预加载的URL
          let preloadUrl = null;

          if (songDetails.isFallbackDirect && songDetails.directPlayUrl) {
            // 如果是备用API的直接播放URL
            preloadUrl = songDetails.directPlayUrl;
          } else if (songDetails.url) {
            // 如果是常规URL
            preloadUrl = songDetails.url;
          }

          if (preloadUrl) {
            // 更新播放列表中的预加载URL
            this.playlist[nextIndex].preloadedUrl = preloadUrl;

            // 如果是备用API的歌曲，保存相关标记
            if (songDetails.isFallbackDirect) {
              this.playlist[nextIndex].isFallbackDirect = true;
              this.playlist[nextIndex].directPlayUrl = songDetails.directPlayUrl;
            }

            // 可选：创建一个隐藏的audio元素来预加载
            // const preloadAudio = new Audio();
            // preloadAudio.src = preloadUrl;
            // preloadAudio.preload = 'auto';
            // preloadAudio.load();
          }
        }
      } catch (error) {
        console.error(`[PlayerStore] 预加载歌曲时出错:`, error);
      }
    },

    /**
     * 解析LRC歌词字符串，支持处理网易云的逐字歌词格式。
     * @param {string} lrcString - LRC或YRC格式的歌词字符串。
     * @returns {Array<object>} 解析后的歌词对象数组。
     */
    parseLrc(lrcString) {
      if (!lrcString) return [];
      const lines = lrcString.split('\n');
      const lyrics = [];
      // 标准LRC时间标签: [mm:ss.xx] 或 [mm:ss.xxx]
      const timeRegex = /^\[(\\d{2}):(\\d{2})\\.(\\d{2,3})\](.*)/;

      // console.log(`[PlayerStore] parseLrc 处理歌词，行数: ${lines.length}`);
      // console.log(`[PlayerStore] 歌词内容前100个字符: ${lrcString.substring(0, 100)}`);

      let processedLineCount = 0;
      let skippedLineCount = 0;
      let jsonParseFailCount = 0;
      let jsonParseSuccessCount = 0;
      let yrcLineCount = 0;
      let normalLrcLineCount = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) {
          skippedLineCount++;
          continue; // 跳过空行
        }

        // 首先判断是否带有时间标签 [mm:ss.xxx]
        if (line.startsWith('[') && line.indexOf(']') > 0) {
          try {
            // 提取时间标签和歌词内容
            const timeEndIndex = line.indexOf(']') + 1;
            const timeTag = line.substring(0, timeEndIndex);
            const content = line.substring(timeEndIndex).trim();

            // 解析时间标签 [mm:ss.xxx]
            const timeMatch = timeTag.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\]$/);
            if (timeMatch) {
              const minutes = parseInt(timeMatch[1], 10);
              const seconds = parseInt(timeMatch[2], 10);
              const milliseconds = parseInt(timeMatch[3].padEnd(3, '0'), 10);
              const time = minutes * 60 + seconds + milliseconds / 1000;

              // 处理歌词内容
              let text = '';

              // 检查内容是否为YRC格式的JSON对象
              if (content.startsWith('{') && content.includes('"c":[')) {
                try {
                  const yrcObj = JSON.parse(content);
                  if (yrcObj && yrcObj.c && Array.isArray(yrcObj.c)) {
                    // 提取所有"tx"字段并连接
                    text = yrcObj.c.map(item => item.tx || '').join('');
                    yrcLineCount++;
                  }
                  jsonParseSuccessCount++;
                } catch (e) {
                  jsonParseFailCount++;
                  // JSON解析失败，尝试使用正则表达式提取文本
                  text = content.replace(/<\d+,\d+>/g, '');
                }
              } else {
                // 普通LRC内容或包含<t,d>格式的逐字标记
                text = content.replace(/<\d+,\d+>/g, '');
                normalLrcLineCount++;
              }

              // 如果成功提取到文本，添加到歌词数组
              if (text.trim()) {
                lyrics.push({ time, text: text.trim() });
                processedLineCount++;
              }
            }
          } catch (e) {
            console.error(`[PlayerStore] parseLrc: 解析第${i + 1}行时出错:`, e);
            skippedLineCount++;
          }
        }
        // 如果不是标准的带时间标签的歌词行，检查是否为YRC元数据
        else if (line.startsWith('{') && line.includes('"c":[')) {
          try {
            // 尝试解析为JSON
            const metaObj = JSON.parse(line);
            if (metaObj && metaObj.t !== undefined && metaObj.c && Array.isArray(metaObj.c)) {
              // 这是YRC元数据行，如{"t":0,"c":[{"tx":"作词: "},{"tx":"周杰伦"}]}
              // 通常这些元数据不包含时间标签，我们可以选择跳过或添加为时间为0的特殊行
              // 例如：我们可以把它作为时间为metaObj.t/1000秒的特殊行
              const time = metaObj.t / 1000;
              const text = metaObj.c.map(item => item.tx || '').join('');

              if (text.trim()) {
                lyrics.push({ time, text: text.trim() });
                processedLineCount++;
                yrcLineCount++;
              }
            }
            jsonParseSuccessCount++;
          } catch (e) {
            jsonParseFailCount++;
            skippedLineCount++;
          }
        } else {
          // 其他无法识别的行，跳过
          skippedLineCount++;
        }
      }

      // console.log(`[PlayerStore] parseLrc 统计: 总行数=${lines.length}, 处理=${processedLineCount}, 跳过=${skippedLineCount}, JSON成功=${jsonParseSuccessCount}, JSON失败=${jsonParseFailCount}, YRC行=${yrcLineCount}, 普通LRC行=${normalLrcLineCount}`);

      // 按时间排序
      return lyrics.sort((a, b) => a.time - b.time);
    },

    /**
     * 获取歌词并解析
     * @param {string|number} songId - 歌曲ID
     * @param {number} retryCount - 当前重试次数
     * @param {number} maxRetries - 最大重试次数
     */
    async fetchLyrics(songId, retryCount = 0, maxRetries = 2) {
      if (!songId) return;

      // 确保songId是字符串
      const songIdStr = String(songId);

      // --- BEGIN ADDED LOGS ---
      // console.log(`[PlayerStore] fetchLyrics called with songIdStr: ${songIdStr}`);
      // const isKwSongInitialCheck = songIdStr.startsWith('kw_') || songIdStr.startsWith('kw-') ||
      //   (this.currentSong && this.currentSong.id === songIdStr && this.currentSong.isFromKw);
      // // console.log(`[PlayerStore] fetchLyrics - isKwSong initial check: ${isKwSongInitialCheck}`);
      // --- END ADDED LOGS ---

      let isKwSong = false;
      if (songIdStr.startsWith(KW_ID_PREFIX) || songIdStr.startsWith('kw-')) {
        isKwSong = true;
      } else if (this.currentSong && this.currentSong.id === songIdStr && this.currentSong.isFromKw) {
        // 如果当前歌曲对象明确标记了 isFromKw，并且ID不是 main_ 开头，则认为是酷我
        if (!songIdStr.startsWith(MAIN_ID_PREFIX)) {
          isKwSong = true;
        }
      }
      // console.log(`[PlayerStore] fetchLyrics - Final isKwSong check for ${songIdStr}: ${isKwSong}`);

      // 如果当前已经在加载相同ID的歌词，则不重复请求
      if (this.isLoadingLyrics && this._currentLoadingSongId === songIdStr && retryCount === 0) {
        // // console.log(`[PlayerStore] 已经在加载歌词中，ID: ${songIdStr}，跳过重复请求`);
        return;
      }

      // 记录当前正在加载的歌曲ID
      this._currentLoadingSongId = songIdStr;

      // 只有在第一次请求时(非重试)才设置加载状态
      if (retryCount === 0) {
        this.isLoadingLyrics = true;
      }

      try {
        // 检查缓存中是否有歌词
        const cachedLyrics = await dataCache.getCachedLyrics(songIdStr); // 确保这里是 await
        // --- BEGIN ADDED LOGS ---
        if (cachedLyrics) {
          // console.log(`[PlayerStore] fetchLyrics - Cache HIT for songIdStr: ${songIdStr}`, cachedLyrics);
        } else {
          // console.log(`[PlayerStore] fetchLyrics - Cache MISS for songIdStr: ${songIdStr}`);
        }
        // --- END ADDED LOGS ---
        if (cachedLyrics) {
          // // console.log(`[PlayerStore] 使用缓存的歌词，ID: ${songIdStr}`);
          // 从缓存读取歌词数据后，同样需要经过parseLrc处理
          this.currentLyrics = this.parseLrc(cachedLyrics.lrc); // 确保解析
          // --- BEGIN ADDED LOGS ---
          // console.log('[PlayerStore] After parsing cached lrc, this.currentLyrics:', JSON.stringify(this.currentLyrics).substring(0, 500) + '...');
          // console.log('[PlayerStore] After parsing cached lrc, this.currentLyrics.length:', this.currentLyrics.length);
          // --- END ADDED LOGS ---
          if (cachedLyrics.tlyric) {
            this.translatedLyrics = this.parseLrc(cachedLyrics.tlyric); // 确保解析
          } else {
            this.translatedLyrics = [];
          }

          // 如果当前歌曲存在且与歌词ID匹配，更新专辑图片
          if (this.currentSong && this.currentSong.id === songIdStr && cachedLyrics.picUrl) {
            this.currentSong.albumArt = cachedLyrics.picUrl;
          }

          // 更新当前歌词索引，确保立即显示正确的歌词行
          this.updateCurrentLyricIndex(this.currentTime);

          this.isLoadingLyrics = false;
          this._currentLoadingSongId = null;
          return;
        }

        // 判断是否是酷我歌曲ID - 修复判断逻辑
        const isKwSong = songIdStr.startsWith('kw_') || songIdStr.startsWith('kw-') ||
          (this.currentSong && this.currentSong.id === songIdStr && this.currentSong.isFromKw);

        // 提取纯数字ID
        let cleanId = songIdStr;
        let kwId = null;

        if (isKwSong) {
          // 处理酷我歌曲ID
          if (songIdStr.startsWith('kw_')) {
            cleanId = songIdStr; // 保留kw_前缀，后端需要这个前缀来识别酷我歌曲
            kwId = songIdStr.substring(3); // 提取纯ID用于日志和直接API调用
          } else if (songIdStr.startsWith('kw-')) {
            cleanId = 'kw_' + songIdStr.substring(3); // 将kw-前缀转换为kw_前缀
            kwId = songIdStr.substring(3);
          } else {
            // 如果是通过isFromKw标记识别的酷我歌曲，但ID没有前缀，添加kw_前缀
            kwId = songIdStr;
            cleanId = 'kw_' + songIdStr;
          }

          // // console.log(`[PlayerStore] 检测到酷我歌曲ID: ${songIdStr}, 处理后ID: ${cleanId}, 纯ID: ${kwId}`);

          // 对于酷我歌曲，直接使用酷我API获取歌词
          try {
            // // console.log(`[PlayerStore] 直接从酷我API获取歌词，ID: ${kwId}`);
            // 修正酷我API歌词请求URL格式，将format=all改为format=json
            const kwResponse = await axios.get(`${FALLBACK_API_BASE}`, {
              params: { id: kwId, type: 'lyr', format: 'json' }
            });

            // // console.log(`[PlayerStore] 直接从酷我API获取歌词成功:`, kwResponse.data);

            // 处理酷我API返回的歌词数据
            if (kwResponse.data && kwResponse.data.code === 200) {
              // 使用专门的方法处理酷我歌词
              const lrcContent = this._processKwLyrics(kwResponse.data);

              if (lrcContent) {
                // 解析歌词
                this.currentLyrics = this.parseLrc(lrcContent);
                // --- BEGIN ADDED LOGS ---
                // console.log('[PlayerStore] After parsing network lrcContent, this.currentLyrics:', JSON.stringify(this.currentLyrics).substring(0, 500) + '...');
                // console.log('[PlayerStore] After parsing network lrcContent, this.currentLyrics.length:', this.currentLyrics.length);
                // --- END ADDED LOGS ---
                this.translatedLyrics = []; // 酷我API不提供翻译歌词

                // 尝试获取歌曲详情以获取专辑图片
                try {
                  const songInfoResponse = await axios.get(FALLBACK_API_BASE, {
                    params: { id: kwId, type: 'song', format: 'json', level: 'lossless' }
                  });

                  if (songInfoResponse.data && songInfoResponse.data.code === 200 && songInfoResponse.data.data) {
                    const picUrl = songInfoResponse.data.data.pic;
                    if (picUrl && picUrl !== 'NO_PIC') {
                      // // console.log(`[PlayerStore] 从酷我API获取到专辑图片: ${picUrl}`);
                      // 更新当前歌曲的专辑图片
                      if (this.currentSong && this.currentSong.id === songIdStr) {
                        this.currentSong.albumArt = picUrl;
                        // // console.log(`[PlayerStore] 更新当前歌曲专辑图片为: ${picUrl}`);
                      }

                      // 缓存歌词和专辑图片
                      dataCache.cacheLyrics(songIdStr, {
                        lrc: lrcContent,
                        tlyric: '',
                        picUrl: picUrl
                      });
                    } else if (picUrl === 'NO_PIC') {
                      // // console.log(`[PlayerStore] 酷我API返回NO_PIC，保留原有专辑图片`);
                      // 缓存歌词，但使用当前歌曲的专辑图片
                      dataCache.cacheLyrics(songIdStr, {
                        lrc: lrcContent,
                        tlyric: '',
                        picUrl: this.currentSong?.albumArt
                      });
                    }
                  }
                } catch (picError) {
                  console.error(`[PlayerStore] 获取酷我歌曲专辑图片失败:`, picError);
                  // 即使获取专辑图片失败，也继续使用已获取到的歌词
                  dataCache.cacheLyrics(songIdStr, {
                    lrc: lrcContent,
                    tlyric: '',
                    picUrl: this.currentSong?.albumArt
                  });
                }

                // 更新当前歌词索引
                this.updateCurrentLyricIndex(this.currentTime);

                // 设置加载状态
                this.isLoadingLyrics = false;
                this._currentLoadingSongId = null;

                return; // 成功获取歌词，直接返回
              }
            }
          } catch (kwError) {
            console.error(`[PlayerStore] 直接从酷我API获取歌词失败:`, kwError);
          }
        } else {
          // 网易云歌曲处理
          if (USE_ID_PREFIX && songIdStr.startsWith(MAIN_ID_PREFIX)) {
            cleanId = songIdStr.substring(MAIN_ID_PREFIX.length);
          }

          // // console.log(`[PlayerStore] 检测到网易云歌曲ID: ${songIdStr}, 处理后ID: ${cleanId}`);

          try {
            // 使用新的/lyric/new接口获取逐字歌词
            const response = await axios.get(`${MAIN_API_BASE}/lyric/new`, {
              params: { id: cleanId }
            });

            // // console.log(`[PlayerStore] 网易云新歌词API响应:`, response.data);

            if (response.data && response.data.code === 200) {
              let lrcContent = '';
              let translatedLrcContent = '';
              let romajiLrcContent = '';  // 罗马音歌词
              let picUrl = null;

              // 提取歌词，优先使用逐字歌词
              if (response.data.lrc && response.data.lrc.lyric) {
                lrcContent = response.data.lrc.lyric;

                // 检查是否有逐字歌词
                if (response.data.yrc && response.data.yrc.lyric) {
                  // 使用逐字歌词替换普通歌词
                  // console.log('[PlayerStore] 检测到逐字歌词，使用逐字歌词');
                  lrcContent = response.data.yrc.lyric;
                }
              }

              // 提取翻译歌词
              if (response.data.tlyric && response.data.tlyric.lyric) {
                translatedLrcContent = response.data.tlyric.lyric;
              }

              // 提取罗马音歌词
              if (response.data.romalrc && response.data.romalrc.lyric) {
                romajiLrcContent = response.data.romalrc.lyric;
                // 如果没有翻译歌词但有罗马音歌词，使用罗马音歌词作为翻译
                if (!translatedLrcContent && romajiLrcContent) {
                  translatedLrcContent = romajiLrcContent;
                }
              }

              // 尝试提取专辑图片URL
              picUrl = this._extractAlbumArtFromNeteaseLyrics(response.data);

              // --- BEGIN ADDED LOGS ---
              // console.log('[PlayerStore] Netease API Response - Raw lrcContent:', lrcContent);
              // console.log('[PlayerStore] Netease API Response - Raw picUrl:', picUrl);
              // --- END ADDED LOGS ---

              // 如果没有找到专辑图片URL，尝试从歌曲详情获取
              if (!picUrl) {
                try {
                  // 获取歌曲详情
                  const songDetailResponse = await axios.get(`${MAIN_API_BASE}/song/detail`, {
                    params: { ids: cleanId }
                  });

                  if (songDetailResponse.data && songDetailResponse.data.code === 200 &&
                    songDetailResponse.data.songs && songDetailResponse.data.songs.length > 0) {
                    const songDetail = songDetailResponse.data.songs[0];
                    if (songDetail.al && songDetail.al.picUrl) {
                      picUrl = songDetail.al.picUrl;
                      // console.log(`[PlayerStore] 从歌曲详情获取到专辑图片URL: ${picUrl}`);
                    }
                  }
                } catch (detailError) {
                  console.error(`[PlayerStore] 获取网易云歌曲详情失败:`, detailError);
                }
              }

              // 解析歌词
              this.currentLyrics = this.parseLrc(lrcContent);
              // --- BEGIN ADDED LOGS ---
              // console.log('[PlayerStore] After parsing network lrcContent, this.currentLyrics:', JSON.stringify(this.currentLyrics).substring(0, 500) + '...');
              // console.log('[PlayerStore] After parsing network lrcContent, this.currentLyrics.length:', this.currentLyrics.length);
              // --- END ADDED LOGS ---
              if (translatedLrcContent) {
                this.translatedLyrics = this.parseLrc(translatedLrcContent);
              } else {
                this.translatedLyrics = [];
              }

              // 如果当前歌曲存在且与歌词ID匹配，更新专辑图片
              if (this.currentSong && this.currentSong.id === songIdStr && picUrl) {
                this.currentSong.albumArt = picUrl;
                // // console.log(`[PlayerStore] 更新当前歌曲专辑图片: ${picUrl}`);

                // 如果在歌词页面，立即触发UI更新
                if (this.showLyricsView) {
                  // 创建一个临时对象，触发Vue的响应式更新
                  this.currentSong = { ...this.currentSong };
                }
              }

              // 缓存歌词和专辑图片
              dataCache.cacheLyrics(songIdStr, {
                lrc: lrcContent,
                tlyric: translatedLrcContent,
                picUrl: picUrl || (this.currentSong?.albumArt !== DEFAULT_ALBUM_ART ? this.currentSong?.albumArt : null)
              });

              // 更新当前歌词索引
              this.updateCurrentLyricIndex(this.currentTime);

              // 设置加载状态
              this.isLoadingLyrics = false;
              this._currentLoadingSongId = null;

              return; // 成功获取歌词，直接返回
            }
          } catch (error) {
            console.error(`[PlayerStore] 从网易云API获取歌词失败:`, error);
          }
        }
      } catch (error) {
        console.error(`[PlayerStore] 获取歌词时出错，ID: ${songIdStr}，错误:`, error);

        // 添加重试逻辑
        if (retryCount < maxRetries) {
          // // console.log(`[PlayerStore] 歌词获取失败，将在1秒后进行第${retryCount + 1}次重试`);

          // 延迟后重试
          setTimeout(() => {
            this.fetchLyrics(songId, retryCount + 1, maxRetries);
          }, 1000);

          return; // 退出当前执行，等待重试
        }

        // 所有重试都失败后，设置默认歌词
        this.currentLyrics = [{ time: 0, text: '获取歌词失败' }];
        this.translatedLyrics = [];
      } finally {
        if (retryCount === maxRetries || this.currentLyrics.length > 0) {
          // 只有在最后一次重试或成功获取歌词时才设置加载状态为false
          this.isLoadingLyrics = false;
          this._currentLoadingSongId = null;
        }
      }
    },

    /**
     * 更新当前应该高亮显示的歌词行索引。
     * @param {number} currentTime - 当前播放时间（秒）。
     */
    updateCurrentLyricIndex(currentTime) {
      if (!this.currentLyrics || this.currentLyrics.length === 0) {
        this.currentLyricIndex = -1;
        return;
      }

      // 寻找第一个时间大于当前时间的歌词行，则其前一行是当前行
      let currentIdx = -1;

      // 优化：直接从当前索引开始查找，避免每次都从头开始
      let startIdx = Math.max(0, this.currentLyricIndex);

      // 如果当前索引已经是最后一个，或者当前时间小于当前索引对应的时间，则从头开始查找
      if (startIdx >= this.currentLyrics.length - 1 ||
        (startIdx > 0 && currentTime < this.currentLyrics[startIdx].time)) {
        startIdx = 0;
      }

      for (let i = startIdx; i < this.currentLyrics.length; i++) {
        if (this.currentLyrics[i].time > currentTime) {
          currentIdx = i - 1;
          break;
        }
      }

      // 如果循环结束都没找到（即currentTime超过了所有歌词时间），则最后一句是当前行
      if (currentIdx === -1 && currentTime >= this.currentLyrics[this.currentLyrics.length - 1].time) {
        currentIdx = this.currentLyrics.length - 1;
      }

      // 处理currentTime在第一句歌词之前的情况
      if (currentIdx < 0 && this.currentLyrics.length > 0 && currentTime < this.currentLyrics[0].time) {
        currentIdx = -1; // 在第一句歌词之前，不高亮任何歌词
      }

      // 只有当索引发生变化时才更新，避免不必要的重渲染
      if (this.currentLyricIndex !== currentIdx) {
        this.currentLyricIndex = currentIdx;
      }
    },

    /**
     * 获取页面中的音频元素
     * @returns {HTMLAudioElement|null} 找到的音频元素或null
     */
    _getAudioElement() {
      // 首先尝试通过ID查找
      const audioElement = document.getElementById('audio-player');
      if (!audioElement) {
        console.error('[PlayerStore] 关键错误: 无法通过ID \'audio-player\' 找到音频元素!');
      }
      return audioElement;
    },

    /**
     * 内部方法：实际播放歌曲，获取URL并设置音频元素。
     * @param {object} song - 歌曲对象。
     * @param {number} index - 歌曲在播放列表中的索引。
     * @param {boolean} wasPlaying - 之前的播放状态。
     */
    async _actuallyPlaySong(song, index, wasPlaying = true) {
      if (!song) {
        console.error(`[PlayerStore] _actuallyPlaySong: 无效的歌曲对象`);
        return;
      }

      console.log(`[PlayerStore] _actuallyPlaySong: 准备播放歌曲 - ${song.name}`);

      // 设置加载标志
      this.isLoadingNewSong = true;

      try {
        // 标记当前歌曲和索引
        this.currentSong = song;
        this.currentSongIndex = index;

        // 检查是否需要强制刷新URL
        const shouldRefreshUrl = song.forceRefreshUrl || false;

        // 检查URL是否过期或不存在
        const isUrlExpired = song.timestamp && (Date.now() - song.timestamp > 7 * 24 * 60 * 60 * 1000);
        const needsUrl = !song.url || isUrlExpired || shouldRefreshUrl;

        // 如果需要获取URL
        if (needsUrl) {
          console.log(`[PlayerStore] _actuallyPlaySong: 需要获取歌曲URL - ${song.name}, 强制刷新: ${shouldRefreshUrl}, URL过期: ${isUrlExpired}, URL不存在: ${!song.url}`);

          try {
            // 获取歌曲URL
            const songDetails = await this._fetchSongUrl(song, 0, 2);
            if (!songDetails || !songDetails.url) {
              throw new Error(`无法获取歌曲URL: ${song.name}`);
            }

            // 更新当前歌曲的URL
            song.url = songDetails.url;
            song.timestamp = songDetails.timestamp || Date.now();
            song.forceRefreshUrl = false; // 重置强制刷新标记

            // 检查是否需要更新当前播放器
            this._updateCurrentPlayerIfNeeded(song, songDetails);
          } catch (urlError) {
            console.error(`[PlayerStore] _actuallyPlaySong: 获取歌曲URL失败 - ${song.name}`, urlError);

            // 如果是酷我歌曲，尝试使用备用API获取
            if (song.isFromKw && song.rid) {
              console.log(`[PlayerStore] _actuallyPlaySong: 尝试使用备用API获取酷我歌曲 - ${song.name}, RID: ${song.rid}`);
              try {
                const kwDetails = await this._fetchKwSongDetailsByRid(song.rid, song);
                if (kwDetails && kwDetails.url) {
                  song.url = kwDetails.url;
                  song.timestamp = Date.now();
                  console.log(`[PlayerStore] _actuallyPlaySong: 成功从备用API获取酷我歌曲URL - ${song.name}`);
                } else {
                  throw new Error(`备用API无法获取酷我歌曲URL: ${song.name}`);
                }
              } catch (kwError) {
                console.error(`[PlayerStore] _actuallyPlaySong: 备用API获取酷我歌曲URL失败 - ${song.name}`, kwError);
                throw new Error(`无法播放歌曲: ${song.name}, 原因: ${kwError.message}`);
              }
            } else {
              // 非酷我歌曲或无法使用备用API，直接抛出错误
              throw new Error(`无法播放歌曲: ${song.name}, 原因: ${urlError.message}`);
            }
          }
        }

        // 更新音频元素的src
        this._updateAudioSrc();

        // 加载歌词
        this.fetchLyrics(song.id);

        // 如果之前在播放，则继续播放
        if (wasPlaying) {
          try {
            await this._playAudio();
          } catch (playError) {
            console.error(`[PlayerStore] _actuallyPlaySong: 播放音频失败 - ${song.name}`, playError);

            // 如果播放失败，可能是URL已失效，尝试强制刷新URL并重新播放
            if (!shouldRefreshUrl) {
              console.log(`[PlayerStore] _actuallyPlaySong: 播放失败，尝试强制刷新URL - ${song.name}`);
              song.forceRefreshUrl = true;
              song.url = null; // 清除可能失效的URL
              song.timestamp = null;

              // 递归调用自身，但带有强制刷新标记，并增加延迟
              setTimeout(() => {
                this._actuallyPlaySong(song, index, wasPlaying);
              }, 800); // 增加延迟时间
              return;
            }
          }
        }

        // 更新最近播放记录
        this._addToRecentlyPlayed(song);

        // 重置加载状态
        this.isLoadingNewSong = false;

        // 播放成功后，预加载下一首歌曲
        this.preloadNextSong();
      } catch (error) {
        console.error(`[PlayerStore] _actuallyPlaySong: 播放歌曲时出错 - ${song?.name || 'unknown'}`, error);
        this.isLoadingNewSong = false;

        // 显示错误通知
        this._showErrorNotification(`播放歌曲时出错: ${error.message || '未知错误'}`);

        // 尝试播放下一首
        if (this.playlist.length > 1) {
          console.log(`[PlayerStore] _actuallyPlaySong: 出错后尝试播放下一首歌曲`);

          // 延迟执行playNext，避免连续多次调用API
          setTimeout(() => {
            this.playNext();
          }, 1000);
        }
      }
    },

    /**
     * 更新音频元素的src并处理播放
     * @private
     */
    _updateAudioSrc() {
      const audioElement = this._getAudioElement();
      if (!audioElement) {
        console.error(`[PlayerStore] _updateAudioSrc: 无法获取音频元素`);
        return;
      }

      if (!this.currentSong || !this.currentSong.url) {
        console.error(`[PlayerStore] _updateAudioSrc: 当前歌曲或URL无效`);
        return;
      }

      // 清除当前音频
      audioElement.pause();
      audioElement.currentTime = 0;
      audioElement.src = '';

      // 设置新的音频源
      audioElement.src = this.currentSong.url;
      audioElement.volume = this.volume;

      // 加载音频
      audioElement.load();
    },

    /**
     * 播放音频并处理错误
     * @returns {Promise<void>}
     * @private
     */
    async _playAudio() {
      const audioElement = this._getAudioElement();
      if (!audioElement) {
        console.error(`[PlayerStore] _playAudio: 无法获取音频元素`);
        return;
      }

      try {
        this.isPlaying = true;

        // 添加延迟，避免播放和暂停操作冲突
        await new Promise(resolve => setTimeout(resolve, 100));

        // 使用重试机制播放
        let attempts = 0;
        const maxAttempts = 3;
        let lastError = null;

        while (attempts < maxAttempts) {
          try {
            console.log(`[PlayerStore] _playAudio: 尝试播放 (第${attempts + 1}次)`);
            await audioElement.play();
            console.log(`[PlayerStore] _playAudio: 播放成功`);
            return; // 播放成功，退出函数
          } catch (error) {
            lastError = error;
            console.warn(`[PlayerStore] _playAudio: 第${attempts + 1}次播放尝试失败`, error);

            // 如果是用户交互导致的中断，不再重试
            if (error.name === 'AbortError' && error.message.includes('interrupted by a call to pause')) {
              console.log(`[PlayerStore] _playAudio: 播放被用户暂停操作中断，不再重试`);
              break;
            }

            // 等待一段时间后重试
            await new Promise(resolve => setTimeout(resolve, 300));
            attempts++;
          }
        }

        // 如果所有尝试都失败，抛出最后一个错误
        if (lastError) {
          console.error(`[PlayerStore] _playAudio: 多次尝试后播放失败`, lastError);
          this.isPlaying = false;
          throw new Error(`播放失败: ${lastError.message}`);
        }
      } catch (error) {
        console.error(`[PlayerStore] _playAudio: 播放失败`, error);
        this.isPlaying = false;

        // 如果播放失败，可能是URL已失效，抛出错误以便上层处理
        throw new Error(`播放失败: ${error.message}`);
      }
    },

    /**
     * 显示错误通知
     * @param {string} message - 错误消息
     * @private
     */
    _showErrorNotification(message) {
      try {
        // 直接使用Element Plus的ElMessage组件
        const { ElMessage } = window.ElementPlus || {};
        if (ElMessage) {
          ElMessage({
            message: `播放错误: ${message}`,
            type: 'error',
            duration: 5000
          });
        } else {
          console.error(`[PlayerStore] 通知组件不可用，错误消息: ${message}`);
        }
      } catch (err) {
        console.error(`[PlayerStore] 显示错误通知失败:`, err);
      }
    },

    /**
     * 播放指定歌曲
     * @param {object|array} song - 单首歌曲对象或歌曲数组
     * @param {number|boolean} indexOrQueue - 歌曲在播放列表中的索引或是否清空当前队列
     * @param {number|null} playlistIdContext - 播放列表ID上下文，用于记录来源
     */
    async playSong(song, indexOrQueue, playlistIdContext = null) {
      // 防止重复加载同一首歌曲
      if (this.isLoadingNewSong) {
        console.log('[PlayerStore] 正在加载歌曲，忽略重复请求');
        return;
      }

      // 设置加载标志
      this.isLoadingNewSong = true;

      try {
        // 参数处理：如果indexOrQueue是布尔值，表示是否清空当前队列；如果是数字，表示歌曲在列表中的索引
        let clearQueue = false;
        let index = -1;

        if (typeof indexOrQueue === 'boolean') {
          clearQueue = indexOrQueue;
        } else if (typeof indexOrQueue === 'number') {
          index = indexOrQueue;
        }

        // 处理歌曲数组的情况
        if (Array.isArray(song)) {
          // 如果是数组，且indexOrQueue是布尔值，则设置为新的播放列表
          if (typeof indexOrQueue === 'boolean') {
            this.setPlaylist(song, clearQueue);
            index = 0; // 从第一首开始播放
          } else {
            // 否则，保留当前播放列表，将新歌曲添加到列表末尾
            this.setPlaylist(song, false);
            index = this.playlist.length - song.length; // 从新添加的第一首开始播放
          }

          if (index >= 0 && index < this.playlist.length) {
            await this._actuallyPlaySong(this.playlist[index], index, true);
            this.isPlaying = true;
          }
        } else {
          // 单首歌曲的情况

          // 检查是否是收藏的歌曲
          const isFavorited = song.favoritedAt !== undefined;

          // 检查收藏的酷我歌曲是否需要强制刷新URL
          if (isFavorited && song.isFromKw) {
            console.log(`[PlayerStore] 检测到收藏的酷我歌曲，强制刷新URL: ${song.name}`);
            song.forceRefreshUrl = true;
          }

          // 检查URL是否过期
          const isUrlExpired = song.timestamp && (Date.now() - song.timestamp > 7 * 24 * 60 * 60 * 1000);

          // 如果是收藏的歌曲且URL已过期，标记需要刷新
          if (isFavorited && (isUrlExpired || !song.url)) {
            console.log(`[PlayerStore] 检测到收藏的歌曲URL已过期或缺失: ${song.name}`);
            song.forceRefreshUrl = true;
          }

          if (clearQueue) {
            // 清空当前队列，用这首歌创建新的播放列表
            this.setPlaylist([song], true);
            index = 0;
          } else if (index === -1) {
            // 如果没有指定索引，检查歌曲是否已在播放列表中
            index = this.playlist.findIndex(s => s.id === song.id);
            if (index === -1) {
              // 不在播放列表中，添加到末尾
              this.playlist.push(song);
              index = this.playlist.length - 1;
            }
          }

          // 执行实际的播放逻辑
          await this._actuallyPlaySong(song, index, true);
          this.isPlaying = true;
        }
      } catch (error) {
        console.error('[PlayerStore] 播放歌曲出错:', error);
      } finally {
        // 清除加载标志
        this.isLoadingNewSong = false;
      }
    },

    /**
     * 切换播放/暂停状态。
     */
    togglePlayPause() {
      if (!this.currentSong) {
        console.error(`[PlayerStore] togglePlayPause: 没有当前歌曲，无法切换播放状态`);
        return;
      }

      try {
        // 获取音频元素
        const audioElement = this._getAudioElement();
        if (!audioElement) {
          console.error(`[PlayerStore] togglePlayPause: 无法获取音频元素`);
          return;
        }

        // 切换播放状态
        this.isPlaying = !this.isPlaying;

        // 根据新状态执行播放或暂停
        if (this.isPlaying) {
          // 确保音频元素有有效的src
          if (!audioElement.src || audioElement.src === 'about:blank') {
            console.error(`[PlayerStore] togglePlayPause: 音频元素没有有效的src`);

            // 尝试重新获取URL
            this._actuallyPlaySong(this.currentSong, this.currentSongIndex);
            return;
          }

          // 尝试播放
          audioElement.play().then(() => {
            // 播放成功
          }).catch(error => {
            console.error(`[PlayerStore] togglePlayPause: 播放失败`, error);

            // 如果播放失败，重置状态
            this.isPlaying = false;

            // 尝试重新获取URL并播放
            setTimeout(() => {
              this._actuallyPlaySong(this.currentSong, this.currentSongIndex);
            }, 300);
          });
        } else {
          audioElement.pause();
        }
      } catch (error) {
        console.error(`[PlayerStore] togglePlayPause: 切换播放状态时出错`, error);
        // 发生错误时，确保状态一致
        const audioElement = this._getAudioElement();
        if (audioElement) {
          this.isPlaying = !audioElement.paused;
        }
      }
    },

    /**
     * 播放下一首歌曲。
     */
    async playNext() {
      if (this.playlist.length === 0) return;
      let nextIndex = this.currentSongIndex + 1;
      if (nextIndex >= this.playlist.length) {
        nextIndex = 0; // 循环到第一首
      }
      await this.playSong(this.playlist[nextIndex], nextIndex);
    },

    /**
     * 播放上一首歌曲。
     */
    async playPrevious() {
      if (this.playlist.length === 0) return;
      let prevIndex = this.currentSongIndex - 1;
      if (prevIndex < 0) {
        prevIndex = this.playlist.length - 1; // 循环到最后一首
      }
      await this.playSong(this.playlist[prevIndex], prevIndex);
    },

    /**
     * 更新当前播放时间。
     * @param {number} time - 当前播放时间（秒）。
     */
    updateCurrentTime(time) {
      this.currentTime = time;
      this.updateCurrentLyricIndex(time); // 在时间更新时，也更新歌词索引

      // 当歌曲播放到接近结束时（剩余时间小于10秒），再次预加载下一首歌
      const totalDuration = this.currentSongDuration;
      if (totalDuration > 0 && (totalDuration - time) <= 10) {
        // 判断是否需要再次预加载
        const shouldPreloadAgain = !this._hasPreloadedBeforeEnd;
        if (shouldPreloadAgain) {
          this._hasPreloadedBeforeEnd = true;
          this.preloadNextSong();
        }
      }
    },

    /**
     * 设置音量。
     * @param {number} volumeLevel - 音量值 (0 到 1)。
     */
    setVolume(volumeLevel) {
      this.volume = Math.max(0, Math.min(1, volumeLevel));
    },

    /**
     * 切换歌词视图的显示状态。
     */
    toggleLyricsView() {
      this.showLyricsView = !this.showLyricsView;
    },

    /**
     * 更新当前歌曲的真实时长，该时长从 <audio> 元素的 loadedmetadata 事件获取。
     * @param {number} realDurationInSeconds - 音频元素的实际总时长（秒）。
     */
    updateCurrentSongRealDuration(realDurationInSeconds) {
      if (this.currentSong) {
        // 确保 realDurationInSeconds 是一个有效的数字
        const durationInSeconds = Number(realDurationInSeconds);
        if (isNaN(durationInSeconds) || durationInSeconds <= 0) {
          return;
        }

        // 对于所有歌曲，我们统一在 currentSong.duration 中存储毫秒
        // 这样 currentSongDuration getter 就可以统一处理
        const newDuration = Math.round(durationInSeconds * 1000);
        this.currentSong.duration = newDuration;
      }
    },

    /**
     * 加载应用初始歌曲列表 (例如，默认搜索特定歌手)。
     */
    async fetchInitialSongs() {
      try {
        // 创建存储所有歌曲的数组
        let allSongs = [];
        let hasKwSongs = false;
        let neteaseSongs = [];
        let kwSongs = [];

        // 1. 获取酷我飙升榜和新歌榜（放在前面）
        try {
          // 定义要获取的榜单
          const kwRankings = [
            { name: '飙升榜', type: 'rank' },
            { name: '新歌榜', type: 'rank' }
          ];

          // 按顺序获取每个榜单数据
          for (const ranking of kwRankings) {
            try {
              console.log(`[PlayerStore] fetchInitialSongs: 正在获取酷我${ranking.name}...`);
              // 使用正确的URL格式调用API
              const kwResponse = await axios.get(`${FALLBACK_API_BASE}`, {
                params: {
                  name: ranking.name,
                  type: ranking.type
                }
              });

              if (kwResponse.data && kwResponse.data.code === 200 && kwResponse.data.data && kwResponse.data.data.musicList) {
                const rankingSongs = kwResponse.data.data.musicList;
                console.log(`[PlayerStore] fetchInitialSongs: 成功获取酷我${ranking.name}，数量: ${rankingSongs.length}`);

                // 格式化榜单歌曲
                const formattedRankingSongs = rankingSongs.map(song => {
                  return this._formatKwRankingSong(song, ranking.name);
                });

                // 添加到酷我歌曲列表
                kwSongs = [...kwSongs, ...formattedRankingSongs];

                // 如果这是第一个获取到的榜单，则设置为播放列表
                if (!hasKwSongs && formattedRankingSongs.length > 0) {
                  this.setPlaylist(formattedRankingSongs, true, false); // replace=true, fromCache=false
                  hasKwSongs = true;
                  console.log(`[PlayerStore] fetchInitialSongs: 已设置酷我${ranking.name}为播放列表，共 ${formattedRankingSongs.length} 首歌曲`);
                } else if (hasKwSongs && formattedRankingSongs.length > 0) {
                  // 如果已经有歌曲，则将新榜单歌曲追加到播放列表末尾
                  this.setPlaylist([...this.playlist, ...formattedRankingSongs], false, false);
                  console.log(`[PlayerStore] fetchInitialSongs: 已将酷我${ranking.name}追加到播放列表末尾，共 ${formattedRankingSongs.length} 首歌曲`);
                }
              } else {
                console.warn(`[PlayerStore] fetchInitialSongs: 酷我${ranking.name}API返回格式不正确`);
              }
            } catch (rankError) {
              console.error(`[PlayerStore] fetchInitialSongs: 获取酷我${ranking.name}失败:`, rankError);
            }
          }

          // 如果没有成功获取到榜单数据，尝试获取热门搜索关键词对应的歌曲
          if (kwSongs.length === 0) {
            console.warn('[PlayerStore] fetchInitialSongs: 未能获取到酷我榜单，尝试使用备用方法获取热门歌曲');

            // 备用方法：获取热门搜索关键词，然后只获取每个关键词的第一首歌曲
            const kwKeywordResponse = await axios.get(FALLBACK_API_BASE, {
              params: { type: 'searchKey' }
            });
            if (kwKeywordResponse.data && kwKeywordResponse.data.code === 200 &&
              kwKeywordResponse.data.data && kwKeywordResponse.data.data.hots) {

              const hotKeywords = kwKeywordResponse.data.data.hots;
              console.log(`[PlayerStore] fetchInitialSongs: 成功获取酷我热门搜索关键词，数量: ${hotKeywords.length}`);

              // 获取热门关键词对应的歌曲
              let kwHotSongs = [];
              for (const keyword of hotKeywords) {
                try {
                  // 使用关键词获取歌曲
                  const songResponse = await axios.get(`${FALLBACK_API_BASE}`, {
                    params: { name: keyword.name }
                  });

                  if (songResponse.data && songResponse.data.code === 200 && Array.isArray(songResponse.data.data)) {
                    // 每个关键词只取第一首歌
                    if (songResponse.data.data.length > 0) {
                      kwHotSongs.push(songResponse.data.data[0]);
                      console.log(`[PlayerStore] fetchInitialSongs: 关键词 "${keyword.name}" 获取到第一首歌曲`);

                      // 每获取5首歌曲就更新一次播放列表，提高用户体验
                      if (kwHotSongs.length % 5 === 0) {
                        const formattedBatch = kwHotSongs.slice(-5).map(s => {
                          const formatted = this._formatFallbackApiSong(s);
                          formatted.isFromKw = true;
                          formatted.source = 'kw';
                          formatted.sourceType = '酷我热门歌曲';
                          return formatted;
                        });

                        if (kwHotSongs.length === 5) {
                          // 第一批5首歌曲时替换播放列表
                          this.setPlaylist(formattedBatch, true, false);
                          hasKwSongs = true;
                          console.log(`[PlayerStore] fetchInitialSongs: 已设置第一批酷我歌曲为播放列表，数量: ${formattedBatch.length}`);
                        } else {
                          // 后续批次追加到播放列表
                          this.setPlaylist([...this.playlist, ...formattedBatch], false, false);
                          console.log(`[PlayerStore] fetchInitialSongs: 已追加一批酷我歌曲，数量: ${formattedBatch.length}`);
                        }
                      }
                    }
                  }
                } catch (error) {
                  console.error(`[PlayerStore] fetchInitialSongs: 获取关键词 "${keyword.name}" 的歌曲失败:`, error);
                }
              }

              // 格式化酷我热门歌曲
              const formattedKwSongs = kwHotSongs.map(song => {
                const formattedSong = this._formatFallbackApiSong(song);
                formattedSong.isFromKw = true;
                formattedSong.source = 'kw';
                formattedSong.sourceType = '酷我热门歌曲';
                return formattedSong;
              });

              // 添加到酷我歌曲列表
              kwSongs = [...kwSongs, ...formattedKwSongs];

              // 处理尚未添加到播放列表的歌曲
              const remainingSongs = formattedKwSongs.slice(-(formattedKwSongs.length % 5));
              if (remainingSongs.length > 0) {
                if (!hasKwSongs) {
                  // 如果之前没有设置过播放列表，则设置
                  this.setPlaylist(remainingSongs, true, false);
                  hasKwSongs = true;
                  console.log(`[PlayerStore] fetchInitialSongs: 已设置剩余酷我歌曲为播放列表，数量: ${remainingSongs.length}`);
                } else {
                  // 追加到现有播放列表
                  this.setPlaylist([...this.playlist, ...remainingSongs], false, false);
                  console.log(`[PlayerStore] fetchInitialSongs: 已追加剩余酷我歌曲，数量: ${remainingSongs.length}`);
                }
              }

              console.log(`[PlayerStore] fetchInitialSongs: 成功获取酷我热门歌曲，总数: ${formattedKwSongs.length}`);
            }
          }
        } catch (kwError) {
          console.error('[PlayerStore] fetchInitialSongs: 获取酷我榜单失败:', kwError);
        }

        // 2. 获取网易云每日推荐（放在后面）
        try {
          const response = await axios.get(`${MAIN_API_BASE}/recommend/songs`);
          let dailySongsData = [];

          // 检查两种可能的推荐歌曲路径
          if (response.data && response.data.data && response.data.data.dailySongs) {
            dailySongsData = response.data.data.dailySongs;
          } else if (response.data && response.data.recommend) { // 兼容旧的或不同的API结构
            dailySongsData = response.data.recommend;
          }

          if (dailySongsData.length > 0) {
            console.log(`[PlayerStore] fetchInitialSongs: 成功获取网易云每日推荐，数量: ${dailySongsData.length}`);

            // 格式化网易云每日推荐歌曲
            const formattedDailySongs = dailySongsData.map(s => {
              let albumArtUrl = null;
              if (s.al && s.al.picUrl) {
                albumArtUrl = s.al.picUrl;
              } else if (s.ar && s.ar[0] && s.ar[0].img1v1Url && s.ar[0].img1v1Url.indexOf('default') === -1) {
                albumArtUrl = s.ar[0].img1v1Url;
              }
              const lyricist = s.lyricist || s.ar?.map(a => a.name).join('/');
              const composer = s.composer || s.ar?.map(a => a.name).join('/');
              return {
                id: s.id,
                name: s.name,
                artist: s.ar?.map(a => a.name).join('/') || s.artists?.map(a => a.name).join('/') || '未知艺术家',
                album: s.al?.name || s.album?.name || '未知专辑',
                albumId: s.al?.id || null,
                albumArt: albumArtUrl,
                duration: s.dt || s.duration,
                lyricist: lyricist,
                composer: composer,
                isFromKw: false, // 明确标记每日推荐歌曲非KW来源 (主API)
                source: 'netease',
                sourceType: '网易云每日推荐'
              };
            });

            // 保存网易云歌曲列表
            neteaseSongs = formattedDailySongs;

            // 如果没有酷我歌曲，则使用网易云歌曲
            if (!hasKwSongs && formattedDailySongs.length > 0) {
              this.setPlaylist(formattedDailySongs, true, false);
              console.log(`[PlayerStore] fetchInitialSongs: 没有获取到酷我歌曲，使用网易云每日推荐，共 ${formattedDailySongs.length} 首歌曲`);
            } else if (hasKwSongs && formattedDailySongs.length > 0) {
              // 如果已经有酷我歌曲，则将网易云歌曲追加到播放列表末尾
              this.setPlaylist([...this.playlist, ...formattedDailySongs], false, false);
              console.log(`[PlayerStore] fetchInitialSongs: 已将网易云每日推荐追加到播放列表末尾，共 ${formattedDailySongs.length} 首歌曲`);
            }
          }
        } catch (neError) {
          console.error('[PlayerStore] fetchInitialSongs: 获取网易云每日推荐失败:', neError);
        }

        // 合并所有歌曲
        allSongs = [...kwSongs, ...neteaseSongs];

        // 最终日志输出
        console.log(`[PlayerStore] fetchInitialSongs: 完成初始歌曲加载，总共 ${allSongs.length} 首歌曲`);
      } catch (error) {
        console.error('[PlayerStore] fetchInitialSongs: 获取初始歌曲失败:', error);
      }
    },

    /**
     * 搜索歌曲并更新播放列表
     * @param {string} keywords - 搜索关键词。
     * @param {boolean} resetPagination - 是否重置分页状态，默认为true。
     * @param {boolean} useCache - 是否使用缓存，默认为true。
     * @param {boolean} skipCache - 是否跳过缓存，默认为false。
     * @param {boolean} replacePlaylist - 是否替换当前播放列表，默认为false。
     * @returns {Promise<Array>} 合并后的歌曲列表。
     */
    async searchSongs(keywords, resetPagination = true, useCache = true, skipCache = false, replacePlaylist = false) {
      // 修改默认行为：始终跳过缓存
      skipCache = true;

      const originalCombinedSongIdsSize = this.combinedSongIds?.size; // 用于日志

      // 保存当前播放状态，以便在不替换播放列表时恢复
      const currentSong = this.currentSong;
      const currentSongIndex = this.currentSongIndex;
      const wasPlaying = this.isPlaying;

      // 如果需要重置分页，彻底重置所有相关状态
      if (resetPagination) {
        this.mainApiOffset = 0;
        this.fallbackApiOffset = 0;
        this.mainApiHasMore = true; // 假定重置后有更多
        this.fallbackApiHasMore = true; // 假定重置后有更多
        this.mainApiSongs = [];
        this.fallbackApiSongs = [];
        this.combinedSongIds = new Set();
        // 确保清空临时搜索结果
        this._tempSearchResults = [];
        console.log(`[PlayerStore] searchSongs: 彻底重置分页状态和搜索结果`);
      }

      // 1. 缓存检查 (如果命中缓存且 resetPagination=true, 需要正确初始化分页状态和IDs)
      if (useCache && !skipCache) {
        const cachedResults = dataCache.getCachedSearchResults(keywords);
        if (cachedResults) {
          // 只有在需要替换播放列表时才替换
          if (replacePlaylist) {
            this.setPlaylist(cachedResults, true, true); // replace=true, fromCache=true
          } else {
            // 仅更新搜索结果，不替换播放列表
            // 这里我们只需要获取搜索结果，不需要更新播放列表
            // 将缓存结果存储在临时变量中供调用者使用
            this._tempSearchResults = cachedResults;
          }

          this.lastSearchKeyword = keywords;

          // 如果是从缓存加载，并且是"重置"类型的调用，需要更新分页和ID集合以反映缓存状态
          if (resetPagination) {
            this.mainApiSongs = cachedResults.filter(s => !s.isFromKw);
            this.fallbackApiSongs = cachedResults.filter(s => s.isFromKw);
            this.mainApiOffset = this.mainApiSongs.length;
            this.fallbackApiOffset = this.fallbackApiSongs.length;
            // 假设缓存的数据是完整的，所以 hasMore 可以先设为true，交给下一次loadMore判断
            this.mainApiHasMore = true;
            this.fallbackApiHasMore = true;
            this.combinedSongIds = new Set(cachedResults.map(s => s.isFromKw ? `kw_${s.id}` : `main_${s.id}`));
          }

          // 如果不替换播放列表，恢复之前的播放状态
          if (!replacePlaylist && currentSong) {
            this.currentSong = currentSong;
            this.currentSongIndex = currentSongIndex;
            this.isPlaying = wasPlaying;
          }

          return replacePlaylist ? this.playlist : this._tempSearchResults; // 返回当前播放列表或临时搜索结果
        }
      }

      this.isSearching = true;

      // 2. 初始化本次搜索操作的局部状态
      let localSongIdCache = new Set();
      const newFallbackSongsThisCall = []; // 修改变量名
      const newMainSongsThisCall = [];   // 修改变量名

      if (resetPagination) {
        this.mainApiOffset = 0;
        this.fallbackApiOffset = 0;
        this.mainApiHasMore = true; // 假定重置后有更多
        this.fallbackApiHasMore = true; // 假定重置后有更多
        // this.mainApiSongs 和 this.fallbackApiSongs 会在最后被完整替换
        // this.combinedSongIds 也会在最后被完整替换
      } else {
        // 加载更多：localSongIdCache 需要包含当前已有的歌曲ID
        localSongIdCache = new Set(this.combinedSongIds);
      }


      try {
        let fallbackAddedThisCall = 0;
        let mainAddedThisCall = 0;

        // 3. 获取并处理备用API (酷我) 歌曲
        if (this.fallbackApiHasMore || resetPagination) { // 只有在还有更多或者需要重置时才请求
          const fallbackSongs = await this._searchSongsFromFallbackApi(keywords, 30, this.fallbackApiOffset);
          for (const song of fallbackSongs) {
            song.isFromKw = true;
            // 确保每首歌曲都强制刷新URL
            song.forceRefreshUrl = true;
            song.timestamp = null;

            const songKey = `kw_${song.id}`;
            // 使用局部缓存判断重复
            if (!localSongIdCache.has(songKey)) {
              newFallbackSongsThisCall.push(song); // 使用修改后的变量名
              localSongIdCache.add(songKey);
              fallbackAddedThisCall++;
            }
          }
          if (!resetPagination) { // 如果是加载更多，更新下一页的offset
            this.fallbackApiOffset += fallbackSongs.length;
          } else { // 如果是重置，offset就是本次获取的数量
            this.fallbackApiOffset = fallbackSongs.length;
          }
          this.fallbackApiHasMore = fallbackSongs.length >= 30;
        }

        // 4. 获取并处理主API歌曲
        if (this.mainApiHasMore || resetPagination) { // 只有在还有更多或者需要重置时才请求
          const mainSongs = await this._searchSongsFromMainApi(keywords, 30, this.mainApiOffset);
          for (const song of mainSongs) {
            song.isFromKw = false; // 确保标记
            // 确保每首歌曲都强制刷新URL
            song.forceRefreshUrl = true;
            song.timestamp = null;

            const songKey = `main_${song.id}`;
            // 使用局部缓存判断重复
            if (!localSongIdCache.has(songKey)) {
              newMainSongsThisCall.push(song); // 使用修改后的变量名
              localSongIdCache.add(songKey);
              mainAddedThisCall++;
            }
          }
          if (!resetPagination) { // 如果是加载更多，更新下一页的offset
            this.mainApiOffset += mainSongs.length;
          } else { // 如果是重置，offset就是本次获取的数量
            this.mainApiOffset = mainSongs.length;
          }
          this.mainApiHasMore = mainSongs.length >= 30;
        }

        // 5. 合并本次调用获取的新歌曲 (酷我API在前，网易云在后)
        const newSongsThisCall = [...newFallbackSongsThisCall, ...newMainSongsThisCall]; // 酷我API结果在前

        // 6. 更新 Store 状态
        if (resetPagination) {
          // 只有在需要替换播放列表时才替换
          if (replacePlaylist) {
            this.setPlaylist(newSongsThisCall, true, false); // true for replaceExisting
          } else {
            // 仅存储搜索结果，不替换播放列表
            this._tempSearchResults = newSongsThisCall;
          }

          this.mainApiSongs = newMainSongsThisCall.slice(); // 使用修改后的变量名
          this.fallbackApiSongs = newFallbackSongsThisCall.slice(); // 使用修改后的变量名
          this.combinedSongIds = new Set(localSongIdCache); // 使用本次调用最终的ID集合

          if (newSongsThisCall.length > 0) { // 只有当实际获取到歌曲时才缓存
            dataCache.cacheSearchResults(keywords, newSongsThisCall);
          }
        } else { // 加载更多
          if (newSongsThisCall.length > 0) {
            // 只有在需要替换播放列表时才更新播放列表
            if (replacePlaylist) {
              this.setPlaylist([...this.playlist, ...newSongsThisCall], false, false); // false for replaceExisting
            } else {
              // 仅更新临时搜索结果，不影响播放列表
              this._tempSearchResults = [...(this._tempSearchResults || []), ...newSongsThisCall];
            }

            this.mainApiSongs.push(...newMainSongsThisCall); // 使用修改后的变量名
            this.fallbackApiSongs.push(...newFallbackSongsThisCall); // 使用修改后的变量名
            this.combinedSongIds = new Set(localSongIdCache); // 更新为最新的完整集合
            // 对于加载更多，一般不需要覆盖整个搜索缓存，除非有特殊需求
          }
        }

        this.lastSearchKeyword = keywords;
        this.isSearching = false;

        // 如果不替换播放列表，恢复之前的播放状态
        if (!replacePlaylist && currentSong) {
          this.currentSong = currentSong;
          this.currentSongIndex = currentSongIndex;
          this.isPlaying = wasPlaying;
        }

        return replacePlaylist ? this.playlist : (this._tempSearchResults || []); // 返回本次调用获取的新歌，或者也可以返回 this.playlist

      } catch (error) {
        console.error(`[PlayerStore] 搜索歌曲 "${keywords}" 时出错:`, error);
        this.isSearching = false;

        // 如果不替换播放列表，恢复之前的播放状态
        if (!replacePlaylist && currentSong) {
          this.currentSong = currentSong;
          this.currentSongIndex = currentSongIndex;
          this.isPlaying = wasPlaying;
        }

        // 即使出错，也应该重置分页标记吗？或者保留，以便用户可以重试"加载更多"？
        // 暂时不修改分页标记，允许用户重试。
        return []; // 返回空数组表示出错或无结果
      }
    },

    /**
     * 从播放列表的第一首歌曲开始播放。
     */
    async playAllFromFirst() {
      if (this.playlist.length > 0) {
        await this.playSong(this.playlist[0], 0);
      } else {
        alert('播放列表为空，请先添加歌曲。');
      }
    },

    /**
     * 加载更多歌曲
     * @param {string} keywords - 搜索关键词，如果不提供则使用上次的搜索关键词
     * @param {number} limit - 每次加载的数量
     * @param {boolean} replacePlaylist - 是否替换当前播放列表，默认为false
     * @returns {Promise<boolean>} - 是否还有更多歌曲可加载
     */
    async loadMoreSongs(keywords = null, limit = 30, replacePlaylist = false) {
      // 如果没有提供关键词，使用上次搜索的关键词
      // 如果lastSearchKeyword也为空，则无法加载更多
      const searchKeywords = keywords || this.lastSearchKeyword;

      // 如果没有搜索关键词，无法加载更多
      if (!searchKeywords) {
        // // console.log('[PlayerStore] loadMoreSongs: 没有搜索关键词，无法加载更多');
        return false;
      }

      // 记录本次使用的关键词
      if (!this.lastSearchKeyword && searchKeywords) {
        this.lastSearchKeyword = searchKeywords;
      }

      // 输出当前API状态
      console.log(`[PlayerStore] loadMoreSongs: 关键词=${searchKeywords}, 主API偏移=${this.mainApiOffset}, 备用API偏移=${this.fallbackApiOffset}, 主API还有更多=${this.mainApiHasMore}, 备用API还有更多=${this.fallbackApiHasMore}`);

      // 如果两个API都没有更多结果，直接返回false
      if (!this.mainApiHasMore && !this.fallbackApiHasMore) {
        console.log('[PlayerStore] loadMoreSongs: 两个API都没有更多结果，返回false');
        return false;
      }

      // 保存当前播放状态，确保加载更多后不会中断当前播放
      const currentSongId = this.currentSong?.id;
      const currentSongIndex = this.currentSongIndex;
      const wasPlaying = this.isPlaying;

      // 设置搜索状态
      this.isSearching = true;

      try {
        // 创建两个独立的数组，分别存储备用API和主API的歌曲
        const fallbackApiSongs = [];
        const mainApiSongs = [];

        // 首先尝试从备用API加载更多
        let fallbackAdded = 0;
        if (this.fallbackApiHasMore) {
          const fallbackSongs = await this._searchSongsFromFallbackApi(searchKeywords, limit, this.fallbackApiOffset);

          // 更新备用API歌曲列表
          this.fallbackApiSongs = [...this.fallbackApiSongs, ...fallbackSongs];

          // 添加备用API的歌曲（去重）
          for (const song of fallbackSongs) {
            // 确保每首歌曲都有isFromKw标志
            song.isFromKw = true;

            // 生成唯一键
            const songKey = `kw_${song.id}`;
            if (!this.combinedSongIds.has(songKey)) {
              fallbackApiSongs.push(song); // 添加到备用API歌曲数组
              this.combinedSongIds.add(songKey);
              fallbackAdded++;
            }
          }

          // 更新备用API的偏移量
          this.fallbackApiOffset += fallbackSongs.length;

          // 更新是否还有更多结果
          this.fallbackApiHasMore = fallbackSongs.length >= limit;
        }

        // 然后再从主API加载更多
        let mainAdded = 0;
        if (this.mainApiHasMore) {
          const mainSongs = await this._searchSongsFromMainApi(searchKeywords, limit, this.mainApiOffset);

          // 更新主API歌曲列表
          this.mainApiSongs = [...this.mainApiSongs, ...mainSongs];

          // 添加主API的歌曲（去重）
          for (const song of mainSongs) {
            // 确保每首歌曲都标记非备用API
            song.isFromKw = false;

            // 生成唯一键
            const songKey = `main_${song.id}`;
            if (!this.combinedSongIds.has(songKey)) {
              mainApiSongs.push(song); // 添加到主API歌曲数组
              this.combinedSongIds.add(songKey);
              mainAdded++;
            }
          }

          // 更新主API的偏移量
          this.mainApiOffset += mainSongs.length;

          // 更新是否还有更多结果
          this.mainApiHasMore = mainSongs.length >= limit;
        }

        // 合并歌曲列表，确保酷我API的歌曲在前面
        const combinedSongs = [...fallbackApiSongs, ...mainApiSongs];

        // 如果合并后的歌曲列表为空，但API返回了结果，可能是合并逻辑有问题
        if (combinedSongs.length === 0 && (fallbackAdded > 0 || mainAdded > 0)) {
          console.error(`[PlayerStore] 错误: 加载更多时合并后歌曲为0，但API返回了结果 (备用API: ${fallbackAdded}, 主API: ${mainAdded})`);

          // 直接使用备用API的结果
          if (fallbackAdded > 0) {
            const fallbackSongs = this.fallbackApiSongs.slice(-fallbackAdded);

            // 追加到当前播放列表，但不改变当前播放状态
            if (replacePlaylist) {
              const newPlaylist = [...this.playlist, ...fallbackSongs];
              this.playlist = newPlaylist;

              // 恢复当前播放的歌曲和状态
              if (currentSongId) {
                this.currentSongIndex = newPlaylist.findIndex(song => song.id === currentSongId);
                if (this.currentSongIndex === -1) {
                  this.currentSongIndex = currentSongIndex;
                }
              }
            } else {
              // 仅更新临时搜索结果，不影响播放列表
              this._tempSearchResults = [...(this._tempSearchResults || []), ...fallbackSongs];
            }

            // 更新搜索状态
            this.isSearching = false;

            // 如果没有新增歌曲，返回false
            if (fallbackSongs.length === 0) {
              console.log('[PlayerStore] 备用API没有返回新的歌曲，返回false');
              return false;
            }

            return this.mainApiHasMore || this.fallbackApiHasMore;
          }

          // 如果备用API没有结果，使用主API的结果
          if (mainAdded > 0) {
            const mainSongs = this.mainApiSongs.slice(-mainAdded);

            // 追加到当前播放列表，但不改变当前播放状态
            if (replacePlaylist) {
              const newPlaylist = [...this.playlist, ...mainSongs];
              this.playlist = newPlaylist;

              // 恢复当前播放的歌曲和状态
              if (currentSongId) {
                this.currentSongIndex = newPlaylist.findIndex(song => song.id === currentSongId);
                if (this.currentSongIndex === -1) {
                  this.currentSongIndex = currentSongIndex;
                }
              }
            } else {
              // 仅更新临时搜索结果，不影响播放列表
              this._tempSearchResults = [...(this._tempSearchResults || []), ...mainSongs];
            }

            // 更新搜索状态
            this.isSearching = false;

            // 如果没有新增歌曲，返回false
            if (mainSongs.length === 0) {
              console.log('[PlayerStore] 主API没有返回新的歌曲，返回false');
              return false;
            }

            return this.mainApiHasMore || this.fallbackApiHasMore;
          }
        }

        // 追加到当前播放列表，但不改变当前播放状态
        if (combinedSongs.length > 0) {
          // 保存旧的播放列表长度，用于更新索引
          const oldPlaylistLength = this.playlist.length;

          if (replacePlaylist) {
            // 追加新歌曲到播放列表
            const newPlaylist = [...this.playlist, ...combinedSongs];
            this.playlist = newPlaylist;

            // 恢复当前播放的歌曲和状态
            if (currentSongId) {
              // 尝试在新播放列表中找到当前歌曲
              const newIndex = newPlaylist.findIndex(song => song.id === currentSongId);
              if (newIndex !== -1) {
                this.currentSongIndex = newIndex;
              } else if (currentSongIndex < oldPlaylistLength) {
                // 如果在新列表中找不到，但原索引有效，保持原索引
                this.currentSongIndex = currentSongIndex;
              }

              // 恢复播放状态
              this.isPlaying = wasPlaying;

              // 如果当前正在播放，确保音频元素的状态与播放状态一致
              if (wasPlaying) {
                const audioElement = this._getAudioElement();
                if (audioElement && audioElement.paused) {
                  audioElement.play().catch(err => {
                    console.warn('[PlayerStore] 恢复播放失败:', err);
                  });
                }
              }
            }
          } else {
            // 仅更新临时搜索结果，不影响播放列表
            this._tempSearchResults = [...(this._tempSearchResults || []), ...combinedSongs];
          }
        } else {
          // 没有新增歌曲，返回false
          console.log('[PlayerStore] 没有新增歌曲，返回false');
          this.isSearching = false;
          return false;
        }

        // 更新搜索状态
        this.isSearching = false;

        // 返回是否还有更多结果
        const hasMore = this.mainApiHasMore || this.fallbackApiHasMore;
        console.log(`[PlayerStore] loadMoreSongs: 完成加载，还有更多结果=${hasMore}`);
        return hasMore;
      } catch (error) {
        console.error(`[PlayerStore] 加载更多歌曲时出错:`, error);
        this.isSearching = false;
        return false;
      }
    },

    /**
     * 处理歌曲播放结束事件。
     */
    async handleSongEnd() {
      // 重置预加载标志
      this._hasPreloadedBeforeEnd = false;

      if (this.playbackMode === 'single') {
        this.currentTime = 0;
        this.isPlaying = true; // 重新播放当前歌曲
        // 对于单曲循环，可能需要重新触发audio.play()，这通常在组件层面处理
      } else if (this.playbackMode === 'shuffle') {
        if (this.playlist.length > 0) {
          let randomIndex = Math.floor(Math.random() * this.playlist.length);
          // 确保不是同一首歌（除非列表只有一首歌）
          if (this.playlist.length > 1 && randomIndex === this.currentSongIndex) {
            randomIndex = (randomIndex + 1) % this.playlist.length;
          }
          await this.playSong(this.playlist[randomIndex], randomIndex);
        } else {
          this.isPlaying = false;
        }
      } else { // sequential
        await this.playNext();
      }
    },

    /**
     * 切换播放模式并显示提示。
     */
    togglePlaybackMode() {
      const currentIndex = PLAYBACK_MODES.indexOf(this.playbackMode);
      const nextIndex = (currentIndex + 1) % PLAYBACK_MODES.length;
      this.playbackMode = PLAYBACK_MODES[nextIndex];
      this.toastMessage = this.currentPlaybackModeText; // 使用getter获取文本
      this.showPlaybackModeToast = true;
      // 短暂显示后自动隐藏提示
      setTimeout(() => {
        this.showPlaybackModeToast = false;
      }, 1500); // 显示1.5秒
      // 如果切换到单曲循环且当前有歌曲，预加载逻辑可能需要调整，暂时不动
      // 如果从单曲循环切换走，且当前有歌曲，可能需要触发一次预加载
      if (PLAYBACK_MODES[currentIndex] === 'single' && this.playbackMode !== 'single' && this.currentSong) {
        this.preloadNextSong();
      }
    },

    /**
     * 恢复保存的播放状态
     */
    async restoreSavedState() {
      try {
        // console.log('[PlayerStore] 尝试恢复保存的状态');

        // 从持久化存储恢复播放状态
        const savedState = getPlayerState();
        if (savedState) {
          // console.log('[PlayerStore] 从本地存储找到保存的状态');

          // 恢复播放模式和音量
          if (savedState.playbackMode && PLAYBACK_MODES.includes(savedState.playbackMode)) {
            this.playbackMode = savedState.playbackMode;
          }

          if (typeof savedState.volume === 'number' && savedState.volume >= 0 && savedState.volume <= 1) {
            this.volume = savedState.volume;
          }

          // 尝试恢复播放列表和当前歌曲
          if (savedState.currentSongId) {
            // console.log(`[PlayerStore] 尝试恢复歌曲ID: ${savedState.currentSongId}`);

            // 先尝试从缓存恢复播放列表
            let cachedSongs = null;
            try {
              cachedSongs = await dataCache.getCachedInitialSongs();
              if (!cachedSongs && savedState.lastSearchKeyword) {
                // 如果没有初始歌曲列表缓存，但有最后的搜索关键词，尝试恢复搜索结果
                cachedSongs = await dataCache.getCachedSearchResults(savedState.lastSearchKeyword);
                if (cachedSongs) {
                  // console.log(`[PlayerStore] 从缓存恢复搜索结果: "${savedState.lastSearchKeyword}"`);
                  this.lastSearchKeyword = savedState.lastSearchKeyword;
                }
              }
            } catch (error) {
              console.error('[PlayerStore] 从缓存恢复歌曲列表失败:', error);
            }

            if (cachedSongs && cachedSongs.length > 0) {
              // console.log(`[PlayerStore] 从缓存恢复了 ${cachedSongs.length} 首歌曲`);

              // 恢复播放列表
              this.playlist = cachedSongs.map(song => ({
                ...song,
                preloadedUrl: null
              }));

              // 查找当前歌曲
              const currentSongIndex = this.playlist.findIndex(song => song.id === savedState.currentSongId);

              if (currentSongIndex !== -1) {
                this.currentSongIndex = currentSongIndex;
                this.currentSong = this.playlist[currentSongIndex];

                // 恢复播放时间
                if (typeof savedState.currentTime === 'number' && savedState.currentTime >= 0) {
                  this.currentTime = savedState.currentTime;
                  // console.log(`[PlayerStore] 恢复播放时间: ${this.formattedCurrentTime}`);
                }

                // console.log(`[PlayerStore] 成功恢复歌曲: ${this.currentSong.name}`);

                // 如果歌曲URL不存在或已过期，尝试从缓存获取
                if (!this.currentSong.url) {
                  try {
                    const cachedUrl = await dataCache.getCachedSongUrl(this.currentSong.id);
                    if (cachedUrl && (cachedUrl.url || cachedUrl.directPlayUrl)) {
                      // 检查缓存是否过期
                      const isCacheExpired = cachedUrl.timestamp && (Date.now() - cachedUrl.timestamp > 7 * 24 * 60 * 60 * 1000);

                      if (!isCacheExpired) {
                        // 缓存未过期，使用缓存的URL
                        this.currentSong.url = cachedUrl.url || cachedUrl.directPlayUrl;
                        console.log(`[PlayerStore] 从有效缓存恢复歌曲URL: ${this.currentSong.name}`);
                      } else {
                        // 缓存已过期，重新获取
                        console.log(`[PlayerStore] 缓存已过期，重新获取歌曲URL: ${this.currentSong.name}`);
                        const songDetails = await this._fetchSongUrl(this.currentSong);
                        if (songDetails && (songDetails.url || songDetails.directPlayUrl)) {
                          this.currentSong.url = songDetails.url || songDetails.directPlayUrl;
                          this.currentSong.directPlayUrl = songDetails.directPlayUrl;
                          this.currentSong.isFallbackDirect = songDetails.isFallbackDirect;
                          this.currentSong.timestamp = Date.now();
                        }
                      }
                    } else {
                      // 缓存中没有URL，尝试重新获取
                      console.log(`[PlayerStore] 缓存中没有歌曲URL，重新获取: ${this.currentSong.name}`);
                      const songDetails = await this._fetchSongUrl(this.currentSong);
                      if (songDetails && (songDetails.url || songDetails.directPlayUrl)) {
                        this.currentSong.url = songDetails.url || songDetails.directPlayUrl;
                        this.currentSong.directPlayUrl = songDetails.directPlayUrl;
                        this.currentSong.isFallbackDirect = songDetails.isFallbackDirect;
                        this.currentSong.timestamp = Date.now();
                      }
                    }
                  } catch (error) {
                    console.error('[PlayerStore] 恢复歌曲URL失败:', error);
                    // 错误时尝试重新获取
                    const songDetails = await this._fetchSongUrl(this.currentSong);
                    if (songDetails && (songDetails.url || songDetails.directPlayUrl)) {
                      this.currentSong.url = songDetails.url || songDetails.directPlayUrl;
                      this.currentSong.timestamp = Date.now();
                    }
                  }
                }

                // 离线模式下不自动恢复播放状态，等待用户交互
                const isOffline = !navigator.onLine;
                // 修改：应用重启时不自动播放，始终设置为false
                // this.isPlaying = !isOffline && savedState.isPlaying === true;
                this.isPlaying = false; // 禁止应用重启时自动播放
                console.log(`[PlayerStore] 应用重启时禁止自动播放，isPlaying设置为false`);

                // 预加载下一首歌曲
                this.preloadNextSong();

                // 恢复歌词
                if (this.currentSong) {
                  this.fetchLyrics(this.currentSong.id).catch(() => {
                    // console.log('[PlayerStore] 无法获取歌词，将使用缓存或空歌词');
                  });
                }

                return true;
              } else {
                // console.log('[PlayerStore] 未找到保存的歌曲ID，尝试初始化默认播放列表');
              }
            } else {
              // console.log('[PlayerStore] 缓存中没有找到歌曲列表，尝试获取新数据');
            }
          }
        }

        // 如果没有找到保存的状态或恢复失败，尝试获取初始歌曲列表
        if (!this.playlist || this.playlist.length === 0) {
          await this.fetchInitialSongs();
        }

        return false;
      } catch (error) {
        console.error('[PlayerStore] 恢复保存的状态失败:', error);

        // 出错时尝试获取初始歌曲列表
        if (!this.playlist || this.playlist.length === 0) {
          await this.fetchInitialSongs().catch(err => {
            console.error('[PlayerStore] 获取初始歌曲列表失败:', err);
          });
        }

        return false;
      } finally {
        // 标记数据已加载完成
        this.isDataLoaded = true;
      }
    },

    /**
     * 从备用API搜索歌曲
     * @param {string} keywords - 搜索关键词
     * @param {number} limit - 每页数量
     * @param {number} offset - 分页偏移量
     * @returns {Promise<Array>} 歌曲列表
     */
    async _searchSongsFromFallbackApi(keywords, limit = 30, offset = 0) {
      try {
        // 确保关键词中没有多余的空格
        const cleanKeywords = keywords.replace(/\s+/g, '');

        // 备用API使用简单的name参数，不需要page和limit参数
        const apiUrl = `${FALLBACK_API_BASE}?name=${encodeURIComponent(cleanKeywords)}&level=lossless`;
        // // console.log(`[PlayerStore] 备用API搜索: 完整URL "${apiUrl}"`);
        // // console.log(`[PlayerStore] 备用API基础URL: ${FALLBACK_API_BASE}`);
        // // console.log(`[PlayerStore] 备用API搜索关键词(清理后): "${cleanKeywords}"`);

        // 使用正确的API调用格式
        const requestConfig = {
          params: {
            name: cleanKeywords,
            level: 'lossless' // 修改为lossless无损音质
            // 备用API不支持分页参数
          }
        };

        // // console.log(`[PlayerStore] 备用API请求配置:`, JSON.stringify(requestConfig));

        const response = await axios.get(`${FALLBACK_API_BASE}`, requestConfig);

        // // console.log(`[PlayerStore] 备用API响应状态:`, response.status);
        // // console.log(`[PlayerStore] 备用API响应头:`, JSON.stringify(response.headers));

        if (response.data && response.data.code === 200 && Array.isArray(response.data.data)) {
          // // console.log(`[PlayerStore] 备用API搜索结果: ${response.data.data.length} 首歌曲`);

          // 打印第一个结果的结构，帮助调试
          if (response.data.data.length > 0) {
            // // console.log(`[PlayerStore] 备用API搜索结果第一首歌曲结构:`, JSON.stringify(response.data.data[0]));
          }

          const songs = response.data.data.map(song => {
            // 使用_formatFallbackApiSong方法格式化歌曲数据
            const formattedSong = this._formatFallbackApiSong(song);

            // 确保所有URL都使用lossless
            if (formattedSong.url) {
              formattedSong.url = this._convertExhighToLossless(formattedSong.url);
            }
            if (formattedSong.lrcUrl) {
              formattedSong.lrcUrl = this._convertExhighToLossless(formattedSong.lrcUrl);
            }

            return formattedSong;
          });

          // 备用API不支持分页，所以一次返回所有结果
          this.fallbackApiHasMore = false;

          return songs;
        } else {
          console.warn(`[PlayerStore] 备用API搜索无结果或格式不正确: ${cleanKeywords}, 响应:`, JSON.stringify(response.data).substring(0, 300));
          this.fallbackApiHasMore = false;
          return [];
        }
      } catch (error) {
        console.error(`[PlayerStore] 备用API搜索出错, 关键词: ${cleanKeywords}`, error);
        this.fallbackApiHasMore = false;
        return [];
      }
    },

    /**
     * 从主API搜索歌曲
     * @param {string} keywords - 搜索关键词
     * @param {number} limit - 每页数量
     * @param {number} offset - 分页偏移量
     * @returns {Promise<Array>} 歌曲列表
     */
    async _searchSongsFromMainApi(keywords, limit = 30, offset = 0) {
      try {
        console.log(`[PlayerStore] 从主API搜索歌曲: ${keywords}, 偏移: ${offset}, 限制: ${limit}`);
        const response = await axios.get(`${MAIN_API_BASE}/search`, {
          params: {
            keywords,
            limit,
            offset,
            type: 1
          }
        });

        if (response.data && response.data.code === 200 && response.data.result && Array.isArray(response.data.result.songs)) {
          const songs = response.data.result.songs.map(song => {
            // 处理专辑封面
            let albumArt = '';
            if (song.album && song.album.picUrl) {
              albumArt = song.album.picUrl;
            } else if (song.artists && song.artists[0] && song.artists[0].img1v1Url) {
              albumArt = song.artists[0].img1v1Url;
            }

            // 如果没有获取到有效的专辑封面，使用默认图片
            if (!albumArt || albumArt.includes('default') || albumArt.trim() === '') {
              albumArt = 'https://p2.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg';
            }

            // 格式化歌曲数据
            const formattedSong = {
              id: USE_ID_PREFIX ? `${MAIN_ID_PREFIX}${song.id}` : song.id, // 添加前缀以区分主API的歌曲
              name: song.name || '未知歌曲',
              artist: song.artists ? song.artists.map(a => a.name).join(', ') : '未知歌手',
              album: song.album?.name || '未知专辑',
              albumId: song.album?.id,
              albumArt: albumArt,
              duration: song.duration || 0,
              isFromKw: false // 标记来源为主API
            };

            return formattedSong;
          });

          // 更新主API搜索状态
          const hasMore = response.data.result.hasMore !== false;
          this.mainApiHasMore = hasMore;
          this.mainApiOffset = offset + songs.length;

          // 添加到主API歌曲列表，用于去重
          this.mainApiSongs = this.mainApiSongs.concat(songs);

          console.log(`[PlayerStore] 主API搜索结果: ${songs.length} 首歌曲，hasMore=${hasMore}，新的偏移量=${this.mainApiOffset}`);
          return songs;
        } else {
          console.log(`[PlayerStore] 主API搜索无结果或格式不正确`);
          this.mainApiHasMore = false;
          return [];
        }
      } catch (error) {
        console.error(`[PlayerStore] 主API搜索出错, 关键词: ${keywords}`, error);
        this.mainApiHasMore = false;
        return [];
      }
    },

    /**
     * 处理酷我API返回的歌词数据，转换为LRC格式
     * @param {Object} kwLyricData - 酷我API返回的歌词数据
     * @returns {string} 转换后的LRC格式歌词
     */
    _processKwLyrics(kwLyricData) {
      if (!kwLyricData) {
        console.error('[PlayerStore] 酷我歌词数据为空');
        return '';
      }

      // // console.log('[PlayerStore] 处理酷我歌词数据:', JSON.stringify(kwLyricData).substring(0, 200) + '...');

      // 检查不同的数据结构
      let lrcContent = '';

      // 情况1: 直接包含lrclist字符串
      if (kwLyricData.data && typeof kwLyricData.data.lrclist === 'string') {
        lrcContent = kwLyricData.data.lrclist;
        // // console.log(`[PlayerStore] 处理酷我字符串格式歌词，长度: ${lrcContent.length}`);

        // 检查是否需要处理转义字符
        if (lrcContent.includes('\\n')) {
          lrcContent = lrcContent.replace(/\\n/g, '\n');
          // // console.log(`[PlayerStore] 处理歌词中的转义换行符，处理后长度: ${lrcContent.length}`);
        }

        return lrcContent;
      }

      // 情况2: 包含lrclist数组
      if (kwLyricData.data && Array.isArray(kwLyricData.data.lrclist)) {
        try {
          lrcContent = kwLyricData.data.lrclist.map(line => {
            // 如果line是字符串，可能已经是格式化的LRC行
            if (typeof line === 'string') {
              return line;
            }

            // 如果line是对象，需要提取time和lineLyric属性
            if (typeof line === 'object' && line !== null) {
              // 处理time属性
              let timeStr = '';
              if (line.time !== undefined) {
                const time = parseFloat(line.time);
                if (!isNaN(time)) {
                  const minutes = Math.floor(time / 60).toString().padStart(2, '0');
                  const seconds = (time % 60).toFixed(2).padStart(5, '0');
                  timeStr = `[${minutes}:${seconds}]`;
                }
              }

              // 处理歌词文本
              const lyricText = line.lineLyric || '';
              return `${timeStr}${lyricText}`;
            }

            return '';
          }).filter(line => line.trim() !== '').join('\n');

          // // console.log(`[PlayerStore] 成功处理酷我数组格式歌词，行数: ${kwLyricData.data.lrclist.length}, 结果长度: ${lrcContent.length}`);
          return lrcContent;
        } catch (error) {
          console.error('[PlayerStore] 处理酷我歌词数组格式时出错:', error);
        }
      }

      // 情况3: JSON格式返回的歌词
      if (kwLyricData.data && kwLyricData.data.lyric) {
        lrcContent = kwLyricData.data.lyric;
        // // console.log(`[PlayerStore] 处理酷我JSON格式歌词，长度: ${lrcContent.length}`);
        return lrcContent;
      }

      // 情况4: 包含lyric字符串
      if (kwLyricData.data && typeof kwLyricData.data.lyric === 'string') {
        lrcContent = kwLyricData.data.lyric;
        // // console.log(`[PlayerStore] 处理酷我lyric字符串格式歌词，长度: ${lrcContent.length}`);
        return lrcContent;
      }

      // 情况5: 包含content字符串
      if (kwLyricData.data && typeof kwLyricData.data.content === 'string') {
        lrcContent = kwLyricData.data.content;
        // // console.log(`[PlayerStore] 处理酷我content字符串格式歌词，长度: ${lrcContent.length}`);
        return lrcContent;
      }

      // 如果没有找到任何歌词内容，返回默认歌词
      console.warn('[PlayerStore] 未能从酷我API响应中提取歌词内容');
      return '[00:00.00]暂无歌词';
    },

    /**
     * 播放整个歌单（播放列表）
     * @param {Array<Object>} songsQueue - 要播放的歌曲队列
     * @param {string|null} playlistIdContext - 当前播放列表的上下文ID (例如歌单ID)。
     */
    async playPlaylist(songsQueue, playlistIdContext = null) {
      if (!songsQueue || songsQueue.length === 0) {
        console.warn('[PlayerStore] playPlaylist: 提供的歌曲队列为空');
        // 可以选择弹出一个提示给用户
        // this.toastMessage = '歌单为空，无法播放';
        // this.showPlaybackModeToast = true;
        // setTimeout(() => { this.showPlaybackModeToast = false; }, 1500);
        return;
      }

      // // console.log(`[PlayerStore] playPlaylist: 接收到包含 ${songsQueue.length} 首歌曲的歌单, 上下文ID: ${playlistIdContext}`);

      // 1. 设置播放列表
      // true 表示替换现有播放列表
      // false 表示非来自缓存（因此会触发缓存更新，如果适用）
      this.setPlaylist(songsQueue, true, false);

      // 2. 播放第一首歌曲
      // 确保 setPlaylist 完成后，playlist 和 currentSongIndex 已更新
      if (this.playlist.length > 0) {
        // playSong 方法的第二个参数可以是索引，也可以是包含索引和完整队列的对象
        // 这里我们已经通过 setPlaylist 更新了整个播放列表，所以只需要传递索引0
        // playSong 方法内部会处理 currentSong 和 currentSongIndex 的设置
        await this.playSong(this.playlist[0], 0, playlistIdContext);
      } else {
        console.error('[PlayerStore] playPlaylist: 设置播放列表后，列表仍然为空，无法播放。');
      }
    },

    /**
     * 从网易云API返回的歌词数据中提取专辑图片URL
     * @param {Object} lyricsData - 网易云API返回的歌词数据
     * @returns {string|null} 提取到的专辑图片URL，如果没有则返回null
     */
    _extractAlbumArtFromNeteaseLyrics(lyricsData) {
      if (!lyricsData) return null;

      try {
        // 1. 首先检查直接的picUrl字段
        if (lyricsData.picUrl) {
          return this._convertHttpToHttps(lyricsData.picUrl);
        }

        // 2. 检查al对象
        if (lyricsData.al && lyricsData.al.picUrl) {
          return this._convertHttpToHttps(lyricsData.al.picUrl);
        }

        // 3. 从歌词文本中提取图片URL
        const lyricText = lyricsData.lrc?.lyric || '';
        const imgUrlMatches = lyricText.match(/https?:\/\/[^"'\s)]+\.(?:jpg|jpeg|png|gif)/g);
        if (imgUrlMatches && imgUrlMatches.length > 0) {
          // 优先选择包含album的URL作为专辑图片
          const url = imgUrlMatches.find(url => url.includes('album')) || imgUrlMatches[0];
          return this._convertHttpToHttps(url);
        }

        // 4. 从整个响应中提取图片URL
        const responseStr = JSON.stringify(lyricsData);
        const picUrlMatches = responseStr.match(/http[^"',\s]+\.(jpg|jpeg|png|gif)/g);
        if (picUrlMatches && picUrlMatches.length > 0) {
          // 优先选择包含album的URL作为专辑图片
          const url = picUrlMatches.find(url => url.includes('album')) || picUrlMatches[0];
          return this._convertHttpToHttps(url);
        }
      } catch (e) {
        console.error('[PlayerStore] 从网易云歌词提取专辑图片URL失败:', e);
      }

      return null;
    },

    /**
     * 将HTTP图片URL转换为HTTPS
     * @param {string} url - 图片URL
     * @returns {string} - 转换后的URL
     * @private
     */
    _convertHttpToHttps(url) {
      if (!url) return url;

      // 处理网易云域名
      if (url.startsWith('http://') &&
        (url.includes('.music.126.net') ||
          url.includes('.music.127.net') ||
          url.includes('p1.music.126.net') ||
          url.includes('p2.music.126.net') ||
          url.includes('p3.music.126.net') ||
          url.includes('p4.music.126.net'))) {
        console.log('[PlayerStore] 转换HTTP图片URL为HTTPS:', url);
        return url.replace('http://', 'https://');
      }

      return url;
    },

    /**
     * 格式化酷我榜单中的歌曲数据
     * @param {Object} song - 榜单API返回的歌曲对象
     * @param {string} rankName - 榜单名称
     * @returns {Object} 格式化后的歌曲对象
     */
    _formatKwRankingSong(song, rankName) {
      if (!song) return null;

      // 提取歌手名称
      let artistName = song.artist || '未知艺术家';

      // 处理ID，添加前缀
      let songId = song.rid || song.id;
      if (USE_ID_PREFIX && songId) {
        songId = `${KW_ID_PREFIX}${songId}`;
      }

      // 确保专辑封面URL可用
      let albumArt = song.pic || '';
      // 如果没有封面或封面URL不可用，使用默认封面
      if (!albumArt || albumArt.trim() === '') {
        albumArt = DEFAULT_ALBUM_ART;
      }

      // 榜单歌曲通常有lrc字段，内部有歌词URL
      let lrcUrl = null;
      if (song.lrc && typeof song.lrc === 'string' && song.lrc.startsWith('http')) {
        lrcUrl = this._convertExhighToLossless(song.lrc);
      }

      // 榜单歌曲通常在url字段中保存歌曲直链
      let url = null;
      if (song.url && typeof song.url === 'string' && song.url.startsWith('http')) {
        url = this._convertExhighToLossless(song.url);
      }

      // 处理时长格式
      let duration = 0;
      if (song.interval && typeof song.interval === 'string') {
        // 将"01:31"格式转换为秒数
        const parts = song.interval.split(':');
        if (parts.length === 2) {
          const minutes = parseInt(parts[0], 10);
          const seconds = parseInt(parts[1], 10);
          duration = (minutes * 60 + seconds) * 1000; // 转换为毫秒
        }
      } else if (song.duration) {
        duration = song.duration;
      }

      // 构建格式化的歌曲对象
      return {
        id: songId,
        rid: song.rid || song.id,
        name: song.name || '未知歌曲',
        artist: artistName,
        album: song.album || `酷我${rankName || '榜单'}`,
        albumId: null,
        albumArt: albumArt,
        duration: duration,
        lyricist: artistName,
        composer: artistName,
        isFromKw: true,
        source: 'kw',
        sourceType: `酷我${rankName || '榜单'}`,
        ranking: rankName || '榜单',
        originalData: song,
        url: url,
        lrcUrl: lrcUrl
      };
    },

    /**
     * 重置所有搜索相关的状态
     */
    resetSearchState() {
      console.log('[PlayerStore] 重置所有搜索相关状态');
      this.lastSearchKeyword = null;
      this.mainApiOffset = 0;
      this.fallbackApiOffset = 0;
      this.mainApiHasMore = true;
      this.fallbackApiHasMore = true;
      this.mainApiSongs = [];
      this.fallbackApiSongs = [];
      this.combinedSongIds = new Set();
      this._tempSearchResults = [];
    },

    /**
     * 清理收藏歌曲的URL缓存
     * 用于解决收藏歌曲URL过期或无效的问题
     */
    async cleanupFavoriteSongUrls() {
      try {
        // 导入收藏服务
        const { getFavorites } = await import('../services/favoritesService');

        // 获取所有收藏的歌曲
        const favoriteSongs = getFavorites('SONGS');
        console.log(`[PlayerStore] 开始清理收藏歌曲URL缓存，共${favoriteSongs.length}首歌曲`);

        if (favoriteSongs.length === 0) {
          return;
        }

        // 获取localStorage中的存储键
        const STORAGE_KEY = 'favorite_songs';

        // 处理每首歌曲
        const updatedSongs = favoriteSongs.map(song => {
          // 对于酷我歌曲，清除URL并标记需要刷新
          if (song.isFromKw) {
            console.log(`[PlayerStore] 清理酷我歌曲URL: ${song.name}, ID: ${song.id}`);
            return {
              ...song,
              url: null,
              directPlayUrl: null,
              forceRefreshUrl: true,
              timestamp: null
            };
          }

          // 检查URL是否过期
          const isUrlExpired = song.timestamp && (Date.now() - song.timestamp > 7 * 24 * 60 * 60 * 1000);

          // 如果URL已过期，清除URL
          if (isUrlExpired) {
            console.log(`[PlayerStore] 清理过期歌曲URL: ${song.name}, ID: ${song.id}`);
            return {
              ...song,
              url: null,
              directPlayUrl: null,
              forceRefreshUrl: true,
              timestamp: null
            };
          }

          return song;
        });

        // 更新localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSongs));
        console.log(`[PlayerStore] 收藏歌曲URL缓存清理完成`);

        return true;
      } catch (error) {
        console.error(`[PlayerStore] 清理收藏歌曲URL缓存失败:`, error);
        return false;
      }
    },

    /**
     * 从主API获取歌曲URL
     * 供其他组件调用，用于获取网易云歌曲URL
     * @param {string|number} songId - 歌曲ID
     * @returns {Promise<object|null>} 包含url和timestamp的对象，或null
     */
    async _fetchSongUrlFromMainApi(songId) {
      if (!songId) {
        console.error("[PlayerStore] _fetchSongUrlFromMainApi: 歌曲ID缺失，无法获取URL");
        return null;
      }

      // 处理可能的ID前缀
      let cleanId = songId;
      if (typeof songId === 'string' && songId.startsWith(MAIN_ID_PREFIX)) {
        cleanId = songId.substring(MAIN_ID_PREFIX.length);
      }

      console.log(`[PlayerStore] _fetchSongUrlFromMainApi: 获取歌曲URL, ID: ${cleanId}`);

      try {
        const response = await axios.get(`${MAIN_API_BASE}/song/url`, {
          params: { id: cleanId }
        });

        if (response.data && response.data.data && response.data.data[0] && response.data.data[0].url) {
          const songData = response.data.data[0];

          const songDetails = {
            url: songData.url,
            duration: (songData.time || 0), // 直接使用毫秒
            isFallbackDirect: false,
            directPlayUrl: null,
            id: songId,
            timestamp: Date.now() // 添加时间戳记录缓存时间
          };

          // 缓存结果
          await dataCache.cacheSongUrl(songId, songDetails);
          return songDetails;
        } else {
          console.warn(`[PlayerStore] _fetchSongUrlFromMainApi: 主API返回的数据中没有有效的URL, 歌曲ID: ${cleanId}`);
          return null;
        }
      } catch (error) {
        console.error(`[PlayerStore] _fetchSongUrlFromMainApi: 获取歌曲URL失败, ID: ${cleanId}`, error);
        return null;
      }
    },
  }
});

