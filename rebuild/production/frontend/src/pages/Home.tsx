import { Button, Typography } from 'antd';
import {
  ArrowRightOutlined,
  LoginOutlined,
  UserOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import ConnectionStatus from '../components/ConnectionStatus';

const { Title, Paragraph, Text } = Typography;

function Home() {
  const { user, logout } = useAuthStore();

  return (
    <div className="home-shell">
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
                <Link to="/server-config">
                  <Button size="small" icon={<SettingOutlined />} style={{ height: 'auto', padding: '8px 12px', marginRight: '8px' }}>
                    服务器配置
                  </Button>
                </Link>
                <ConnectionStatus />
                <span className="user-pill">
                  <UserOutlined />
                  <span>{user.nickname || user.username}</span>
                </span>
                <Button size="small" onClick={logout} style={{ height: 'auto', padding: '8px 12px' }}>
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
              <div className="side-card" style={{ background: 'linear-gradient(135deg, rgba(235, 250, 235, 0.7) 0%, rgba(245, 255, 245, 0.4) 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div className="side-head" style={{ justifyContent: 'center', width: '100%' }}>
                  <span>快速入口</span>
                </div>
                <p className="side-desc">直接浏览房间列表，随时加入或创建新的战局。</p>
                <Link to="/rooms" className="btn-strong" style={{ background: 'rgba(200, 235, 200, 0.3)', color: '#0f172a', border: '1px solid rgba(127, 201, 127, 0.15)', boxShadow: 'none', alignSelf: 'center', padding: '10px 24px', fontSize: '18px' }}>
                  开始匹配 <ArrowRightOutlined />
                </Link>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

export default Home;
