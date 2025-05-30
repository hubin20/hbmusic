import React, { useEffect, useState } from 'react';
import './Bubbles.css';

/**
 * 气泡组件 - 创建随机漂浮的彩色气泡效果
 * @returns {JSX.Element} 返回气泡容器组件
 */
const Bubbles = () => {
  const [bubbles, setBubbles] = useState([]);

  useEffect(() => {
    // 定期创建新气泡
    const interval = setInterval(() => {
      const newBubble = {
        id: Date.now(),
        left: Math.random() * 100, // 随机水平位置
        size: Math.random() * 30 + 10, // 随机大小 10-40px
        animationDuration: Math.random() * 10 + 8, // 随机动画时长 8-18s
        hue: Math.random() * 360, // 随机色相
      };

      setBubbles(prev => [...prev, newBubble]);

      // 移除超出屏幕的气泡
      setTimeout(() => {
        setBubbles(prev => prev.filter(b => b.id !== newBubble.id));
      }, newBubble.animationDuration * 1000);
    }, 1000); // 每秒创建一个新气泡

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bubbles-container">
      {bubbles.map(bubble => (
        <div
          key={bubble.id}
          className="bubble"
          style={{
            left: `${bubble.left}%`,
            width: `${bubble.size}px`,
            height: `${bubble.size}px`,
            animationDuration: `${bubble.animationDuration}s`,
            background: `hsla(${bubble.hue}, 100%, 75%, 0.3)`,
            backdropFilter: 'blur(2px)',
          }}
        />
      ))}
    </div>
  );
};

export default Bubbles; 