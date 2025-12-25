/**
 * 服务器选择组件 - 用于局域网多电脑连接
 */
import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, List, Space, Tag, message, Spin } from 'antd';
import { WifiOutlined, SearchOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { serverConfigService } from '../services/serverConfig';

interface ServerSelectorProps {
  visible: boolean;
  onClose: () => void;
  onServerSelected?: (host: string, port: number) => void;
}

interface DiscoveredServer {
  host: string;
  port: number;
  latency: number;
  status: 'online' | 'offline' | 'checking';
}

const ServerSelector: React.FC<ServerSelectorProps> = ({ visible, onClose, onServerSelected }) => {
  const [manualHost, setManualHost] = useState('');
  const [manualPort, setManualPort] = useState('3000');
  const [scanning, setScanning] = useState(false);
  const [testing, setTesting] = useState(false);
  const [servers, setServers] = useState<DiscoveredServer[]>([]);
  const [currentServer, setCurrentServer] = useState(serverConfigService.getConfig());

  useEffect(() => {
    if (visible) {
      setCurrentServer(serverConfigService.getConfig());
    }
  }, [visible]);

  const handleScan = async () => {
    setScanning(true);
    setServers([]);
    
    try {
      const found = await serverConfigService.scanLanServers();
      setServers(found.map(s => ({ ...s, status: 'online' as const })));
      
      if (found.length === 0) {
        message.info('未发现局域网服务器，请手动输入地址');
      } else {
        message.success(`发现 ${found.length} 个服务器`);
      }
    } catch (error) {
      message.error('扫描失败');
    } finally {
      setScanning(false);
    }
  };

  const handleTestManual = async () => {
    if (!manualHost) {
      message.warning('请输入服务器地址');
      return;
    }

    setTesting(true);
    const port = parseInt(manualPort) || 3000;
    
    try {
      const isOnline = await serverConfigService.testConnection(manualHost, port);
      if (isOnline) {
        message.success('连接成功！');
        // 添加到列表
        setServers(prev => {
          const exists = prev.find(s => s.host === manualHost && s.port === port);
          if (exists) return prev;
          return [...prev, { host: manualHost, port, latency: 0, status: 'online' }];
        });
      } else {
        message.error('无法连接到服务器');
      }
    } catch {
      message.error('连接测试失败');
    } finally {
      setTesting(false);
    }
  };

  const handleSelectServer = (host: string, port: number) => {
    serverConfigService.setServer(host, port);
    setCurrentServer(serverConfigService.getConfig());
    message.success(`已切换到服务器 ${host}:${port}`);
    onServerSelected?.(host, port);
    onClose();
  };

  const handleReset = () => {
    serverConfigService.reset();
    setCurrentServer(serverConfigService.getConfig());
    message.info('已重置为默认服务器');
  };

  return (
    <Modal
      title={
        <Space>
          <WifiOutlined />
          <span>局域网服务器连接</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={500}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8, color: '#666' }}>
          当前服务器: <Tag color="blue">{currentServer.apiBaseUrl}</Tag>
        </div>
      </div>

      {/* 手动输入 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>手动输入服务器地址</div>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="IP 地址，如 192.168.1.100"
            value={manualHost}
            onChange={e => setManualHost(e.target.value)}
            style={{ width: '60%' }}
          />
          <Input
            placeholder="端口"
            value={manualPort}
            onChange={e => setManualPort(e.target.value)}
            style={{ width: '20%' }}
          />
          <Button 
            type="primary" 
            onClick={handleTestManual}
            loading={testing}
          >
            测试
          </Button>
        </Space.Compact>
      </div>

      {/* 扫描按钮 */}
      <div style={{ marginBottom: 16 }}>
        <Button 
          icon={<SearchOutlined />} 
          onClick={handleScan}
          loading={scanning}
          block
        >
          {scanning ? '正在扫描局域网...' : '扫描局域网服务器'}
        </Button>
      </div>

      {/* 服务器列表 */}
      {servers.length > 0 && (
        <List
          size="small"
          bordered
          dataSource={servers}
          renderItem={server => (
            <List.Item
              actions={[
                <Button 
                  type="link" 
                  size="small"
                  onClick={() => handleSelectServer(server.host, server.port)}
                >
                  连接
                </Button>
              ]}
            >
              <List.Item.Meta
                avatar={
                  server.status === 'online' 
                    ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                    : server.status === 'checking'
                    ? <Spin size="small" />
                    : <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
                }
                title={`${server.host}:${server.port}`}
                description={
                  server.status === 'online' 
                    ? `延迟: ${server.latency}ms`
                    : server.status === 'checking'
                    ? '检测中...'
                    : '离线'
                }
              />
            </List.Item>
          )}
        />
      )}

      {/* 重置按钮 */}
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Button type="link" onClick={handleReset}>
          重置为默认服务器
        </Button>
      </div>

      {/* 使用说明 */}
      <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 4, fontSize: 12, color: '#666' }}>
        <div style={{ fontWeight: 500, marginBottom: 4 }}>局域网连接说明：</div>
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          <li>确保所有电脑在同一局域网内</li>
          <li>主机需要运行后端服务（端口 3000）</li>
          <li>其他电脑输入主机的 IP 地址即可连接</li>
          <li>可在主机终端运行 <code>ipconfig</code> 查看 IP</li>
        </ul>
      </div>
    </Modal>
  );
};

export default ServerSelector;
