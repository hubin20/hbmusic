<template>
  <div v-if="visible" class="search-modal-overlay" @click.self="closeModal">
    <div class="search-modal">
      <button class="close-button" @click="closeModal">
        <el-icon><Close /></el-icon>
      </button>
      <div class="search-text">搜一搜你喜爱的歌</div>
      <div class="search-input-container">
        <el-input
          v-model="searchQuery"
          placeholder="搜索歌手、歌名、专辑"
          clearable
          @keyup.enter="performSearch"
          :disabled="isSearching"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
          <template #suffix>
            <el-button 
              type="primary" 
              class="search-button" 
              @click="performSearch"
              :loading="isSearching"
              :disabled="isSearching || !searchQuery.trim()"
            >
              搜索
            </el-button>
          </template>
        </el-input>
      </div>
      
      <!-- 搜索类型选择 -->
      <div class="search-type-selector">
        <el-radio-group v-model="searchType" size="small">
          <el-radio value="song" label="单曲">单曲</el-radio>
          <el-radio value="album" label="专辑">专辑</el-radio>
          <el-radio value="playlist" label="歌单">歌单</el-radio>
          <el-radio value="mv" label="MV">MV</el-radio>
        </el-radio-group>
      </div>
      
      <div v-if="isSearching" class="search-loading">
        <el-skeleton style="width: 100%;" :rows="3" animated />
      </div>
      <div v-if="showSuggestions && !isSearching" class="search-suggestions">
        <div 
          v-for="(suggestion, index) in suggestions" 
          :key="index" 
          class="suggestion-item"
          @click="selectSuggestion(suggestion)"
        >
          <el-icon><Search /></el-icon>
          <span>{{ suggestion }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * 搜索模态框组件
 * 提供毛玻璃效果的搜索弹框界面
 */
import { ref, computed, watch } from 'vue';
import { Search, Close } from '@element-plus/icons-vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'search']);

const searchQuery = ref('');
const isSearching = ref(false);
const suggestions = ref(['薛之谦', '林俊杰', '华晨宇', '五月天', '邓紫棋']);
const showSuggestions = computed(() => searchQuery.value.trim() === '');
const searchType = ref('song'); // 默认搜索类型为单曲

// 当模态框显示时，自动聚焦搜索框
watch(() => props.visible, (newValue) => {
  if (newValue) {
    searchQuery.value = '';
    searchType.value = 'song'; // 重置为默认搜索类型
    setTimeout(() => {
      document.querySelector('.search-input-container input')?.focus();
    }, 100);
  }
});

const closeModal = () => {
  if (isSearching.value) return; // 搜索中不允许关闭
  emit('close');
};

const performSearch = async () => {
  if (!searchQuery.value.trim() || isSearching.value) return;
  
  isSearching.value = true;
  
  try {
    emit('search', searchQuery.value, searchType.value);
  } finally {
    isSearching.value = false;
    closeModal(); // 搜索完成后关闭模态框
  }
};

const selectSuggestion = (suggestion) => {
  searchQuery.value = suggestion;
  performSearch();
};
</script>

<style scoped>
.search-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
  backdrop-filter: blur(2px);
}

.search-modal {
  width: 90%;
  max-width: 400px;
  background-color: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(3px);
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.08);
  position: relative;
}

.search-text {
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  margin-bottom: 15px;
}

.close-button {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px;
  z-index: 10;
}

.close-button:hover {
  color: #fff;
}

.search-input-container {
  margin-bottom: 10px;
}

/* 搜索类型选择器样式 */
.search-type-selector {
  display: flex;
  justify-content: center;
  margin: 10px 0;
}

.search-type-selector :deep(.el-radio) {
  margin-right: 15px;
  color: rgba(255, 255, 255, 0.8);
}

.search-type-selector :deep(.el-radio__input.is-checked .el-radio__inner) {
  border-color: #ffcc00;
  background: #ffcc00;
}

.search-type-selector :deep(.el-radio__input.is-checked + .el-radio__label) {
  color: #ffcc00;
}

.search-type-selector :deep(.el-radio__label) {
  font-size: 13px;
}

.search-input-container :deep(.el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  box-shadow: none;
  padding: 4px 8px;
}

.search-input-container :deep(.el-input__inner) {
  color: #fff;
  font-size: 14px;
  height: 32px;
}

.search-input-container :deep(.el-input__inner::placeholder) {
  color: rgba(255, 255, 255, 0.5);
}

.search-input-container :deep(.el-input__prefix) {
  color: rgba(255, 255, 255, 0.6);
  margin-right: 5px;
}

.search-button {
  background-color: transparent;
  border: none;
  border-radius: 4px;
  color: rgba(255, 200, 0, 0.9);
  padding: 4px 12px;
  font-size: 14px;
  height: 32px;
  line-height: 24px;
  font-weight: bold;
}

.search-button:hover {
  background-color: transparent;
  color: rgba(255, 215, 0, 1);
}

.search-button.is-disabled {
  background-color: transparent;
  color: rgba(255, 200, 0, 0.5);
}

.search-input-container :deep(.el-button.is-disabled) {
  background-color: transparent;
  border-color: transparent;
  color: rgba(255, 200, 0, 0.5);
  cursor: not-allowed;
}

.search-input-container :deep(.el-button--primary) {
  --el-button-bg-color: transparent;
  --el-button-border-color: transparent;
  --el-button-hover-bg-color: transparent;
  --el-button-hover-border-color: transparent;
  --el-button-active-bg-color: transparent;
  --el-button-active-border-color: transparent;
}

.search-input-container :deep(.el-button--primary:focus) {
  background-color: transparent;
  border-color: transparent;
}

.search-loading {
  margin-top: 10px;
}

.search-suggestions {
  margin-top: 10px;
  max-height: 150px;
  overflow-y: auto;
}

.suggestion-item {
  display: flex;
  align-items: center;
  padding: 8px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.8);
  border-radius: 4px;
  transition: background-color 0.2s;
}

.suggestion-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.suggestion-item .el-icon {
  margin-right: 8px;
  font-size: 14px;
  color: rgba(255, 200, 0, 0.8);
}
</style> 