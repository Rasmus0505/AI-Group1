import { Button, Typography } from 'antd';
import {
  ArrowRightOutlined,
  TeamOutlined,
  PlayCircleOutlined,
  LogoutOutlined,
  LoginOutlined,
  ThunderboltOutlined,
  HistoryOutlined,
  LockOutlined,
  UserOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import UserRegistryPanel from '../components/UserRegistryPanel';
import OnlineRoomsPanel from '../components/OnlineRoomsPanel';
import { useAuthStore } from '../stores/authStore';

const { Title, Paragraph, Text } = Typography;

/**
 * Fullscreen canvas background with slow network particles.
 * Purely visual; does not affect game logic or interactions.
 */
function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
    }> = [];

    let animationFrameId: number;

    const themeColor = { r: 56, g: 189, b: 248 }; // cyan-like, matches cyber-noir / data theme

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const initParticles = (count: number) => {
      particles.length = 0;
      for (let i = 0; i < count; i += 1) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          // slower velocity for mysterious feeling
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
          size: Math.random() * 1.8 + 0.7,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p, index) => {
        // update position
        p.x += p.vx;
        p.y += p.vy;

        // bounce on edges with gentle reflection
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        // draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${themeColor.r}, ${themeColor.g}, ${themeColor.b}, 0.55)`;
        ctx.fill();

        // draw connections
        for (let j = index + 1; j < particles.length; j += 1) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 110) {
            const alpha = 1 - dist / 110;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${themeColor.r}, ${themeColor.g}, ${themeColor.b}, ${alpha * 0.8})`;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      });

      animationFrameId = window.requestAnimationFrame(draw);
    };

    const handleResize = () => {
      resize();
      initParticles(90);
    };

    resize();
    initParticles(90);
    draw();

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}

function Home() {
  const [userPanelOpen, setUserPanelOpen] = useState(false);
  const [roomsPanelOpen, setRoomsPanelOpen] = useState(false);
  const { user, logout } = useAuthStore();
  useClickExplosion();

  return (
    <div className="home-shell">
      <ParticleBackground />
      <div className="grid-lines" />
      <div className="home-content">
        <header className="home-topbar">
          <div className="brand-pill">
            <span className="brand-dot" />
            <span className="brand-name">不止进入房间，开启一场策略冒险。</span>
          </div>
          <div className="top-actions">
            {user ? (
              <>
                <span className="user-pill">
                  <UserOutlined />
                  <span>{user.nickname || user.username}</span>
                </span>
                <Button size="small" onClick={logout}>
                  退出登录
                </Button>
              </>
            ) : (
              <Link to="/login">
                <Button size="small" type="primary" icon={<LoginOutlined />}>
                  登录
                </Button>
              </Link>
            )}
          </div>
        </header>

        <section className="hero-layout">
          <div className="hero-left glass-surface">
            <div className="hero-pill">
              <span className="pill-dot" />
              <Text strong>AI文字交互式多人竞争博弈游戏</Text>
            </div>
            <div className="hero-copy">
              <Title level={1} className="hero-title">
                凡墙皆是门
              </Title>
              <Paragraph className="hero-desc">
                欢迎来到游戏世界！在这里，你可以快速选择房间，召集队友，体验实时事件，沉浸式地展开每一局策略对抗。
              </Paragraph>
            </div>

            <div className="stack-cards">
              <div className="side-card glass-surface">
                <div className="side-head">
                  <span className="side-dot" />
                  <span>快速入口</span>
                </div>
                <p className="side-desc">直接浏览房间列表，随时加入或创建新的战局。</p>
                <Link to="/rooms" className="btn-strong glow slim">
                  开始匹配 <ArrowRightOutlined />
                </Link>
              </div>
              <div className="side-card soft-green">
                <div className="side-head">
                  <TeamOutlined />
                  <span>查看在册用户</span>
                </div>
                <p className="side-desc">查看全部注册玩家，快速找到熟悉的队友。</p>
                <button className="btn-ghost slim" onClick={() => setUserPanelOpen(true)}>
                  打开名单 <ArrowRightOutlined />
                </button>
              </div>
              <div className="side-card soft-green">
                <div className="side-head">
                  <EyeOutlined />
                  <span>在线房间</span>
                </div>
                <p className="side-desc">实时查看开放中的房间，选择加入或旁观。</p>
                <button className="btn-ghost slim" onClick={() => setRoomsPanelOpen(true)}>
                  去看看 <ArrowRightOutlined />
                </button>
              </div>
            </div>
          </div>
        </section>

      </div>

      <UserRegistryPanel open={userPanelOpen} onClose={() => setUserPanelOpen(false)} />
      <OnlineRoomsPanel open={roomsPanelOpen} onClose={() => setRoomsPanelOpen(false)} />
    </div>
  );
}

export default Home;
