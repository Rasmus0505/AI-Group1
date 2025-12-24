import { Button, Typography, Form, Input, Card, message } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { authAPI } from '../services/auth';
import { useAuthStore } from '../stores/authStore';

const { Title, Paragraph, Text } = Typography;

function Login() {
  const { user, login } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [buttonHovered, setButtonHovered] = useState(false);

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
    <div 
      className="home-shell"
      style={{
        background: 'linear-gradient(135deg, rgba(245, 255, 245, 0.9) 0%, rgba(235, 250, 235, 0.7) 100%)',
      }}
    >
      <div className="grid-lines" />
      <div className="home-content">
        <div className="hero-left glass-surface">
          <div className="hero-pill" style={{ marginBottom: 12 }}>
            <span className="pill-dot" />
            <Text strong>凡墙皆是门·AI文字交互式多人竞争博弈游戏</Text>
          </div>
          <Title level={1} className="hero-title" style={{ marginTop: 8 }}>
            欢迎来到游戏世界！
          </Title>
          <Paragraph className="hero-desc" style={{ marginBottom: 20 }}>
            不止进入房间，开启一场策略冒险。
          </Paragraph>

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
                    onMouseEnter={() => setButtonHovered(true)}
                    onMouseLeave={() => setButtonHovered(false)}
                    style={{
                      backgroundColor: buttonHovered ? '#A8D8A8' : '#B8E6B8',
                      borderColor: buttonHovered ? '#A8D8A8' : '#B8E6B8',
                      transition: 'all 0.3s ease',
                      transform: buttonHovered ? 'translateY(-2px)' : 'translateY(0)',
                      boxShadow: buttonHovered ? '0 8px 16px rgba(168, 216, 168, 0.4)' : '0 2px 8px rgba(184, 230, 184, 0.2)',
                    }}
                  >
                    登录
                  </Button>
                </Form.Item>
                <Form.Item>
                  <div style={{ textAlign: 'center' }}>
                    <Link to="/register">没有账号？立即注册</Link>
                  </div>
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
