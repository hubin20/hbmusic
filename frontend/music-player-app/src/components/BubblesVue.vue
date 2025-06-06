<template>
  <div class="bubbles-container">
    <div
      v-for="bubble in bubbles"
      :key="bubble.id"
      class="bubble"
      :style="{
        left: `${bubble.left}%`,
        width: `${bubble.size}px`,
        height: `${bubble.size}px`,
        background: bubble.gradient,
        animationDuration: `${bubble.duration}s`
      }"
    ></div>
  </div>
</template>

<script>
/**
 * 气泡组件 - 创建随机漂浮的彩色气泡效果
 * 使用纯CSS动画提高性能
 */
export default {
  name: 'BubblesVue',
  data() {
    return {
      bubbles: [],
      interval: null,
      maxBubbles: 25,
      colorPalettes: [
        ['#0055FF', '#0033BB', '#001E77'], // 更深更鲜艳的蓝色系
        ['#00BB33', '#008822', '#005511'], // 更深更鲜艳的绿色系
        ['#9900EE', '#7700BB', '#550088'], // 更深更鲜艳的紫色系
        ['#FF1100', '#BB0C00', '#880900'], // 更深更鲜艳的红色系
        ['#FFBB00', '#CC9900', '#996600']  // 更深更鲜艳的金色系
      ]
    }
  },
  methods: {
    /**
     * 生成随机渐变色
     */
    generateGradient() {
      const palette = this.colorPalettes[Math.floor(Math.random() * this.colorPalettes.length)]
      const angle = Math.floor(Math.random() * 360)
      return `linear-gradient(${angle}deg, ${palette[0]}CC, ${palette[1]}CC, ${palette[2]}CC)`
    },

    /**
     * 创建新的气泡
     */
    createBubble() {
      if (this.bubbles.length >= this.maxBubbles) return

      const duration = Math.random() * 10 + 15 // 15-25秒
      const newBubble = {
        id: Date.now() + Math.random(),
        left: Math.random() * 100,
        size: Math.random() * 8 + 4, // 4-12px
        gradient: this.generateGradient(),
        duration: duration
      }

      this.bubbles.push(newBubble)

      // 在动画结束后移除气泡
      setTimeout(() => {
        this.bubbles = this.bubbles.filter(b => b.id !== newBubble.id)
      }, duration * 1000)
    }
  },
  mounted() {
    // 初始创建更多气泡
    for (let i = 0; i < 10; i++) {
      setTimeout(() => this.createBubble(), i * 200)
    }

    // 定期创建新气泡，减少间隔时间
    this.interval = setInterval(() => {
      this.createBubble()
    }, 800) // 进一步减少间隔时间
  },
  beforeDestroy() {
    if (this.interval) {
      clearInterval(this.interval)
    }
  }
}
</script>

<style scoped>
.bubbles-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.bubble {
  position: absolute;
  bottom: -20px;
  border-radius: 50%;
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.7);
  animation: float linear forwards;
  will-change: transform;
}

@keyframes float {
  0% {
    transform: translateY(0) translateX(0);
    opacity: 0;
  }
  5% {
    opacity: 0.9;
  }
  95% {
    opacity: 0.7;
  }
  100% {
    transform: translateY(-100vh) translateX(20px);
    opacity: 0;
  }
}
</style> 