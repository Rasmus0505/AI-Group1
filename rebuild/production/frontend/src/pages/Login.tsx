import { Button, Typography, Space, Form, Input, Card, message } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { authAPI } from '../services/auth';
import { useAuthStore } from '../stores/authStore';

const { Title, Paragraph, Text } = Typography;

function Login() {
  const { user, login, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const response = await authAPI.login(values);
      login(response.token, response.user);
      message.success('登录成功！');
      const from =
        (location.state as { from?: { pathname?: string } } | undefined)?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (error: unknown) {
      const msg =
        typeof error === 'object' && error && 'response' in error
          ? ((error as { response?: { data?: { message?: string } } }).response?.data?.message ??
            null)
          : null;
      message.error(msg || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-shell">
      <div className="grid-lines" />
      <div className="home-content">
        <header className="home-topbar">
          <div className="brand-pill">
            <span className="brand-dot" />
            <span className="brand-name">凡墙皆是门</span>
          </div>
          {user && (
            <Space align="center" size="middle">
              <span className="user-pill">
                <Text>当前用户：</Text>
                <Text strong>{user.nickname || user.username}</Text>
              </span>
              <Button size="small" onClick={logout} className="logout-btn">
                退出登录
              </Button>
            </Space>
          )}
        </header>

        <div className="hero-left glass-surface">
          <div className="hero-pill" style={{ marginBottom: 12 }}>
            <span className="pill-dot" />
            <Text strong>AI文字交互式多人竞争博弈游戏</Text>
          </div>
          <Title level={1} className="hero-title" style={{ marginTop: 8 }}>
            欢迎来到游戏世界！
          </Title>
          <Paragraph className="hero-desc" style={{ marginBottom: 20 }}>
            不止进入房间，开启一场策略冒险。
          </Paragraph>

          <Space wrap size="middle">
            <Link to="/rooms" className="btn-strong">
              进入房间列表
            </Link>
            <Link to="/rooms" className="btn-ghost">
              在册用户
            </Link>
            <Link to="/rooms" className="btn-ghost">
              在线房间
            </Link>
          </Space>

          {!user && (
            <Card
              bordered={false}
              className="glass-surface"
              style={{
                marginTop: 24,
                width: '100%',
                maxWidth: 420,
                alignSelf: 'center',
                padding: 16,
              }}
            >
              <Form layout="vertical" onFinish={onFinish} autoComplete="off">
                <Form.Item
                  name="username"
                  label="用户名"
                  rules={[{ required: true, message: '请输入用户名' }]}
                >
                  <Input prefix={<UserOutlined />} placeholder="用户名" />
                </Form.Item>
                <Form.Item
                  name="password"
                  label="密码"
                  rules={[{ required: true, message: '请输入密码' }]}
                >
                  <Input.Password prefix={<LockOutlined />} placeholder="密码" />
                </Form.Item>
                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    icon={<LoginOutlined />}
                    loading={loading}
                  >
                    登录
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
