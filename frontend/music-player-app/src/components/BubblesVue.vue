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
        ['#3A80D2', '#2561A8', '#1151A5'], // 更深的蓝色系
        ['#40B868', '#1E7B47', '#125B12'], // 更深的绿色系
        ['#8B49A6', '#7E349D', '#5C2473'], // 更深的紫色系
        ['#D73C2C', '#B0291B', '#821B11'], // 更深的红色系
        ['#E1B40F', '#C49A0D', '#A7850B']  // 更深的金色系
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
      return `linear-gradient(${angle}deg, ${palette[0]}88, ${palette[1]}88, ${palette[2]}88)`
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
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.25);
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