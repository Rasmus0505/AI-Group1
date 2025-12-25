import React, { useState, useEffect } from 'react';
import { Badge, Tooltip } from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { wsService } from '../services/websocket';

const ConnectionStatus: React.FC = () => {
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [latency, setLatency] = useState<number>(0);

  useEffect(() => {
    // 添加连接状态监听器
    const handleConnectionStatusChange = (newStatus: 'connected' | 'disconnected' | 'connecting', newLatency: number) => {
      setStatus(newStatus);
      setLatency(newLatency);
    };

    wsService.addConnectionStatusListener(handleConnectionStatusChange);

    return () => {
      // 移除监听器
      wsService.removeConnectionStatusListener(handleConnectionStatusChange);
    };
  }, []);

  // 获取状态图标和颜色
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: <CheckCircleOutlined />,
          color: 'success' as const,
          text: '已连接',
        };
      case 'connecting':
        return {
          icon: <LoadingOutlined spin />,
          color: 'processing' as const,
          text: '连接中',
        };
      case 'disconnected':
        return {
          icon: <ExclamationCircleOutlined />,
          color: 'error' as const,
          text: '未连接',
        };
      default:
        return {
          icon: <ExclamationCircleOutlined />,
          color: 'error' as const,
          text: '未知',
        };
    }
  };

  // 获取延迟文本和颜色
  const getLatencyText = () => {
    if (status !== 'connected') {
      return 'N/A';
    }

    if (latency < 100) {
      return `${latency}ms`;
    } else if (latency < 300) {
      return `${latency}ms`;
    } else {
      return `${latency}ms`;
    }
  };

  const getLatencyColor = () => {
    if (status !== 'connected') {
      return '#d9d9d9';
    }

    if (latency < 100) {
      return '#52c41a';
    } else if (latency < 300) {
      return '#faad14';
    } else {
      return '#f5222d';
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <Tooltip 
      title={`连接状态: ${statusConfig.text}\n延迟: ${getLatencyText()}`} 
      placement="bottom"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(0, 0, 0, 0.05)' }}>
        <Badge status={statusConfig.color} text={statusConfig.text} />
        <span style={{ color: getLatencyColor(), fontSize: '12px', fontWeight: 'bold' }}>
          {getLatencyText()}
        </span>
      </div>
    </Tooltip>
  );
};

export default ConnectionStatus;