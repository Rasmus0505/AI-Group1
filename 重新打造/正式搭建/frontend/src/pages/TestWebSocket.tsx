import { useEffect, useState } from 'react';
import { Card, Typography, Tag, Space, Button, List } from 'antd';
import { wsService } from '../services/websocket';

const { Title, Text } = Typography;

function TestWebSocket() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [socketId, setSocketId] = useState<string>('');

  useEffect(() => {
    // 尝试从localStorage获取token，如果没有则使用测试token
    const token = localStorage.getItem('token') || 'test-token';
    
    wsService.connect(token);
    
    wsService.on('connect', () => {
      setConnected(true);
      setMessages(prev => [...prev, `[${new Date().toLocaleTimeString()}] 已连接`]);
    });

    wsService.on('disconnect', () => {
      setConnected(false);
      setMessages(prev => [...prev, `[${new Date().toLocaleTimeString()}] 已断开连接`]);
    });

    wsService.on('error', (error: any) => {
      setMessages(prev => [...prev, `[${new Date().toLocaleTimeString()}] 错误: ${JSON.stringify(error)}`]);
    });

    return () => {
      wsService.disconnect();
    };
  }, []);

  const handleSendTest = () => {
    if (wsService.connected) {
      wsService.send('test', { message: 'Hello from client', timestamp: new Date().toISOString() });
      setMessages(prev => [...prev, `[${new Date().toLocaleTimeString()}] 发送测试消息`]);
    }
  };

  const handleReconnect = () => {
    wsService.disconnect();
    setTimeout(() => {
      const token = localStorage.getItem('token') || 'test-token';
      wsService.connect(token);
    }, 1000);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Card>
        <Title level={2}>WebSocket 连接测试</Title>
        
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Text strong>连接状态: </Text>
            <Tag color={connected ? 'green' : 'red'}>
              {connected ? '已连接' : '未连接'}
            </Tag>
          </div>

          <Space>
            <Button 
              type="primary" 
              onClick={handleSendTest}
              disabled={!connected}
            >
              发送测试消息
            </Button>
            <Button onClick={handleReconnect}>
              重新连接
            </Button>
          </Space>

          <div>
            <Text strong>消息日志:</Text>
            <List
              bordered
              dataSource={messages}
              renderItem={(item) => (
                <List.Item>
                  <Text code>{item}</Text>
                </List.Item>
              )}
              style={{ 
                maxHeight: '400px', 
                overflowY: 'auto',
                marginTop: '8px'
              }}
            />
          </div>

          <div>
            <Text type="secondary">
              提示：确保后端服务器正在运行，并且WebSocket服务已启动。
              如果连接失败，请检查浏览器控制台的错误信息。
            </Text>
          </div>
        </Space>
      </Card>
    </div>
  );
}

export default TestWebSocket;

