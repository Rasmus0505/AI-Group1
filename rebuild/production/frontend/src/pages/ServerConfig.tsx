import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Select, Space, Typography, Divider, Alert } from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { udpDiscoveryService } from '../services/udpDiscovery';
import { wsService } from '../services/websocket';

const { Title, Text } = Typography;
const { Option } = Select;

const ServerConfig: React.FC = () => {
  const [ip, setIp] = useState<string>('localhost');
  const [port, setPort] = useState<string>('3000');
  const [discoveredServers, setDiscoveredServers] = useState<Array<{ ip: string; port: number; name: string }>>([]);
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // 初始化时加载当前服务器配置
  useEffect(() => {
    const currentUrl = wsService.getServerUrl();
    // 解析当前URL获取IP和端口
    try {
      const url = new URL(currentUrl);
      setIp(url.hostname);
      setPort(url.port || '3000');
    } catch (error) {
      // 如果解析失败，使用默认值
    }

    // 开始发现服务器
    startDiscovery();

    return () => {
      udpDiscoveryService.stopDiscovery();
    };
  }, []);

  // 开始发现服务器
  const startDiscovery = () => {
    setIsDiscovering(true);
    udpDiscoveryService.startDiscovery((servers) => {
      setDiscoveredServers(servers);
      setIsDiscovering(false);
    });
  };

  // 选择服务器
  const handleServerSelect = (value: string) => {
    const [serverIp, serverPort] = value.split(':');
    setIp(serverIp);
    setPort(serverPort);
  };

  // 测试连接
  const testConnection = async () => {
    setConnectionStatus('connecting');
    setStatusMessage('正在测试连接...');

    try {
      const testUrl = `http://${ip}:${port}/health`;
      // 使用AbortController实现超时
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(testUrl, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        setConnectionStatus('connected');
        setStatusMessage('连接成功！');
      } else {
        setConnectionStatus('failed');
        setStatusMessage('连接失败：服务器返回错误');
      }
    } catch (error) {
      setConnectionStatus('failed');
      setStatusMessage(`连接失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 保存配置
  const saveConfig = () => {
    const newServerUrl = `http://${ip}:${port}`;
    wsService.setServerUrl(newServerUrl);
    
    // 保存到本地存储
    localStorage.setItem('gameServerUrl', newServerUrl);
    
    setStatusMessage('服务器配置已保存！');
    setConnectionStatus('idle');
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px' }}>
      <Title level={2} style={{ textAlign: 'center', marginBottom: '30px' }}>
        服务器配置
      </Title>

      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 自动发现服务器 */}
          <div>
            <Title level={4}>自动发现服务器</Title>
            <Space style={{ width: '100', marginBottom: '10px' }}>
              <Select
                placeholder="选择发现的服务器"
                style={{ width: '100%', marginBottom: '10px' }}
                onChange={handleServerSelect}
                allowClear
              >
                {discoveredServers.map((server, index) => (
                  <Option key={index} value={`${server.ip}:${server.port}`}>
                    {server.name} ({server.ip}:{server.port})
                  </Option>
                ))}
              </Select>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={startDiscovery}
                loading={isDiscovering}
              >
                重新发现
              </Button>
            </Space>
            {discoveredServers.length === 0 && !isDiscovering && (
              <Text type="secondary">未发现服务器，请尝试手动输入或检查网络连接</Text>
            )}
          </div>

          <Divider />

          {/* 手动配置 */}
          <div>
            <Title level={4}>手动配置服务器</Title>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <Text strong style={{ minWidth: 60 }}>IP地址：</Text>
                <Input
                  placeholder="输入服务器IP地址"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <Text strong style={{ minWidth: 60 }}>端口：</Text>
                <Input
                  placeholder="输入服务器端口"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  style={{ width: 150 }}
                />
              </div>
            </Space>
          </div>

          <Divider />

          {/* 连接测试 */}
          <div>
            <Title level={4}>连接测试</Title>
            <Space style={{ marginBottom: '10px' }}>
              <Button
                type="primary"
                onClick={testConnection}
                loading={connectionStatus === 'connecting'}
              >
                测试连接
              </Button>
              {connectionStatus !== 'idle' && (
                <Alert
                  message={statusMessage}
                  type={connectionStatus === 'connected' ? 'success' : 'error'}
                  showIcon
                  style={{ flex: 1 }}
                />
              )}
            </Space>
          </div>

          <Divider />

          {/* 保存配置 */}
          <div style={{ textAlign: 'center' }}>
            <Button
              type="primary"
              size="large"
              icon={<SaveOutlined />}
              onClick={saveConfig}
            >
              保存服务器配置
            </Button>
          </div>
        </Space>
      </Card>

      <Card style={{ marginTop: '20px' }}>
        <Title level={4}>当前配置</Title>
        <Text strong>WebSocket服务器地址：</Text>
        <Text>{wsService.getServerUrl()}</Text>
      </Card>
    </div>
  );
};

export default ServerConfig;