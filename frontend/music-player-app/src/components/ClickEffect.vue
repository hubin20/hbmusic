<template>
  <div class="click-effect-container">
    <div
      v-for="(explosion, index) in explosions"
      :key="index"
      class="explosion-wrapper"
      :style="{ left: `${explosion.x}px`, top: `${explosion.y}px` }"
    >
      <ConfettiExplosion 
        :particleCount="explosion.count"
        :force="explosion.force"
        :duration="1000"
        :colors="explosion.colors"
        :particleSize="explosion.size"
      />
    </div>
  </div>
</template>

<script>
import ConfettiExplosion from 'vue-confetti-explosion'

/**
 * 点击粒子效果组件
 * 在用户点击页面时产生彩色粒子爆炸效果
 */
export default {
  name: 'ClickEffect',
  components: {
    ConfettiExplosion
  },
  data() {
    return {
      explosions: [],
      colorSets: [
        ['#FF5252', '#FF7B7B', '#FF9E9E', '#FFBDBD'], // 红色系
        ['#536DFE', '#7B8DFF', '#A4B0FF', '#CDD5FF'], // 蓝色系
        ['#00C853', '#4CDF80', '#85EBAD', '#BDFFD8'], // 绿色系
        ['#AA00FF', '#C94CFF', '#DD85FF', '#EEBDFF'], // 紫色系
        ['#FFAB00', '#FFC24C', '#FFD685', '#FFEABD']  // 橙色系
      ]
    }
  },
  mounted() {
    // 添加全局点击事件监听器
    window.addEventListener('click', this.createExplosion)
  },
  beforeDestroy() {
    // 移除事件监听器
    window.removeEventListener('click', this.createExplosion)
  },
  methods: {
    /**
     * 创建粒子爆炸效果
     * @param {MouseEvent} event - 鼠标点击事件
     */
    createExplosion(event) {
      // 随机选择一组颜色
      const colors = this.colorSets[Math.floor(Math.random() * this.colorSets.length)]
      
      // 创建新的爆炸效果
      const explosion = {
        id: Date.now(),
        x: event.clientX,
        y: event.clientY,
        count: Math.floor(Math.random() * 25) + 15, // 15-40粒子
        force: Math.random() * 0.3 + 0.2, // 0.2-0.5力度，极小的力度使粒子几乎不扩散
        colors: colors,
        size: Math.random() * 3 + 2 // 2-5大小
      }
      
      this.explosions.push(explosion)
      
      // 1秒后移除爆炸效果，缩短持续时间
      setTimeout(() => {
        this.explosions = this.explosions.filter(e => e.id !== explosion.id)
      }, 1000)
    }
  }
}
</script>

<style scoped>
.click-effect-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9999;
  pointer-events: none; /* 确保不会影响正常点击事件 */
}

.explosion-wrapper {
  position: absolute;
  transform: translate(-50%, -50%);
}
</style> 