import { useEffect } from 'react';

/**
 * Global click explosion effect (gold/spark burst).
 * Adds a fixed canvas overlay to the document and listens for mouse clicks.
 * Purely visual; does not intercept pointer events.
 */
export function useClickExplosion() {
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let particles: Array<{
      x: number;
      y: number;
      angle: number;
      speed: number;
      friction: number;
      gravity: number;
      life: number;
      decay: number;
      color: string;
    }> = [];

    let animationId = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const createExplosion = (x: number, y: number) => {
      const count = 28;
      for (let i = 0; i < count; i += 1) {
        particles.push({
          x,
          y,
          angle: Math.random() * Math.PI * 2,
          speed: Math.random() * 4 + 2,
          friction: 0.93,
          gravity: 0.25,
          life: 1,
          decay: Math.random() * 0.03 + 0.01,
          // Gold / ember palette
          color: `hsl(${Math.random() * 20 + 35}, 90%, ${Math.random() * 20 + 50}%)`,
        });
      }
    };

    const update = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        const vx = Math.cos(p.angle) * p.speed;
        const vy = Math.sin(p.angle) * p.speed;
        p.x += vx;
        p.y += vy + p.gravity;
        p.speed *= p.friction;
        p.life -= p.decay;

        if (p.life <= 0) {
          particles.splice(i, 1);
        } else {
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      animationId = window.requestAnimationFrame(update);
    };

    const handleClick = (ev: MouseEvent) => {
      createExplosion(ev.clientX, ev.clientY);
    };

    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '2'; // above background, below UI (home grid-lines already at z-index higher)
    document.body.appendChild(canvas);

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('click', handleClick);
    animationId = window.requestAnimationFrame(update);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('click', handleClick);
      window.cancelAnimationFrame(animationId);
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      particles = [];
    };
  }, []);
}

export default useClickExplosion;

