import { Form, Input, Button, Card, message } from 'antd';
import { LockOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { authAPI } from '../services/auth';

function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      message.error('无效的重置链接');
      setTimeout(() => navigate('/login'), 2000);
    }
  }, [searchParams, navigate]);

  const onFinish = async (values: { password: string; confirmPassword: string }) => {
    if (!token) {
      message.error('重置令牌无效');
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPassword(token, values.password);
      message.success('密码重置成功！请使用新密码登录');
      setTimeout(() => navigate('/login'), 2000);
    } catch (error: unknown) {
      const msg =
        typeof error === 'object' && error && 'response' in error
          ? ((error as { response?: { data?: { message?: string } } }).response?.data?.message ??
            null)
          : null;
      message.error(msg || '密码重置失败，请检查重置链接是否有效');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
      }}
    >
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Button 
              type="text" 
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate(-1)} 
              style={{ marginRight: 16 }}
            >
              返回
            </Button>
            <span>重置密码</span>
          </div>
        } 
        style={{ width: 400 }}
      >
        <Form name="reset-password" onFinish={onFinish} autoComplete="off">
          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入新密码!' },
              { min: 6, message: '密码至少6个字符!' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="新密码" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码!' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致!'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="确认新密码" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              重置密码
            </Button>
          </Form.Item>

          <Form.Item>
            <div style={{ textAlign: 'center' }}>
              <a href="/login">返回登录</a>
            </div>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

export default ResetPassword;
