import { useRef, useEffect } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  pulse: number;
  pulseSpeed: number;
}

interface ParticleNetworkProps {
  /** 主题颜色 RGB 值，格式: "r, g, b"，默认: "16, 185, 129" (翠绿色) */
  themeColor?: string;
  /** 粒子数量，默认: 80 */
  particleCount?: number;
  /** 最大连线距离，默认: 150 */
  connectDistance?: number;
  /** 速度因子（越小越慢），默认: 0.15 */
  slowFactor?: number;
}

/**
 * 优化的粒子网络背景组件
 * 
 * 特性：
 * - z-index: -10 与 fixed：确保永远作为底层背景存在，不干扰内容，也不随页面滚动
 * - devicePixelRatio 适配：解决 4K 屏和 MacBook 上的模糊问题
 * - distSq 逻辑：在嵌套循环中先比较平方值，只有足够近时才开根号，节省 CPU
 * - pulse 呼吸感：每个粒子有独立的 pulseSpeed，模拟"气运"或"商业脉搏"
 * - 极慢速度：slowFactor 设为 0.15，让背景静谧如深海，不分散阅读注意力
 */
export default function ParticleNetwork({
  themeColor = '16, 185, 129', // 翠绿色，可改为 "245, 158, 11" 琥珀色
  particleCount = 80,
  connectDistance = 150,
  slowFactor = 0.15, // 极慢速度因子
}: ParticleNetworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];

    // 初始化函数：处理高清屏模糊问题
    const init = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);

      particles = [];
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          vx: (Math.random() - 0.5) * slowFactor,
          vy: (Math.random() - 0.5) * slowFactor,
          size: Math.random() * 1.5 + 0.5,
          pulse: Math.random() * Math.PI * 2,
          pulseSpeed: 0.01 + Math.random() * 0.02, // 每个粒子独立的呼吸速度
        });
      }
    };

    // 绘制函数
    const draw = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // 位置更新
        p.x += p.vx;
        p.y += p.vy;
        p.pulse += p.pulseSpeed;

        // 边界处理
        if (p.x < 0 || p.x > window.innerWidth) p.vx *= -1;
        if (p.y < 0 || p.y > window.innerHeight) p.vy *= -1;

        // 绘制粒子（带呼吸感）
        const opacity = (Math.sin(p.pulse) * 0.3 + 0.5).toFixed(2);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${themeColor}, ${opacity})`;
        ctx.fill();

        // 绘制线条 - 性能优化方案：先比较平方距离
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distSq = dx * dx + dy * dy; // 避免直接开根号，提升性能

          if (distSq < connectDistance * connectDistance) {
            const dist = Math.sqrt(distSq);
            const lineOpacity = 0.15 * (1 - dist / connectDistance);
            ctx.beginPath();
            ctx.lineWidth = 0.5; // 极细线条
            ctx.strokeStyle = `rgba(${themeColor}, ${lineOpacity})`;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    // 监听窗口缩放
    const handleResize = () => {
      init();
    };

    window.addEventListener('resize', handleResize);
    init();
    draw();

    // 清理逻辑
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [themeColor, particleCount, connectDistance, slowFactor]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -10, // 确保永远作为底层背景
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  );
}

