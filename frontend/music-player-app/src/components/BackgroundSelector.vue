<template>
  <div class="background-selector-modal" v-if="visible" @click.self="close">
    <div class="background-selector-content">
      <div class="background-selector-header">
        <h3>选择背景图片</h3>
        <button class="close-button" @click="close">×</button>
      </div>
      <div class="background-selector-body">
        <div 
          v-for="bg in backgrounds" 
          :key="bg.id" 
          class="background-option"
          :class="{ active: currentBgId === bg.id }"
          @click="selectBackground(bg.id)"
        >
          <img :src="bg.compressed" :alt="bg.name" />
          <div class="background-name">{{ bg.name }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, defineProps, defineEmits } from 'vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  backgrounds: {
    type: Array,
    default: () => []
  },
  currentBgId: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:currentBgId', 'close']);

const selectBackground = (bgId) => {
  emit('update:currentBgId', bgId);
};

const close = () => {
  emit('close');
};
</script>

<style scoped>
.background-selector-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(8px);
}

.background-selector-content {
  background-color: rgba(255, 255, 255, 0.25);
  border-radius: 20px;
  width: 90%;
  max-width: 900px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.background-selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.background-selector-header h3 {
  margin: 0;
  color: #fff;
  font-size: 18px;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.close-button {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  backdrop-filter: blur(5px);
}

.close-button:hover {
  background-color: rgba(255, 255, 255, 0.4);
  transform: scale(1.1);
}

.background-selector-body {
  padding: 20px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
  overflow-y: auto;
  max-height: calc(80vh - 60px);
}

.background-option {
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  border: 2px solid transparent;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  height: 100px;
  aspect-ratio: 1;
}

.background-option:hover {
  transform: translateY(-5px) scale(1.05);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}

.background-option.active {
  border-color: #4a90e2;
  box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.3), 0 8px 20px rgba(0, 0, 0, 0.2);
}

.background-option img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s ease;
}

.background-option:hover img {
  transform: scale(1.1);
}

.background-name {
  padding: 6px;
  text-align: center;
  font-size: 10px;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  backdrop-filter: blur(5px);
}
</style> 