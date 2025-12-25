import { useEffect, useState, useCallback } from 'react';
import { wsService } from '../services/websocket';
import { useAuthStore } from '../stores/authStore';

export type SocketConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export function useSocket(): SocketConnectionStatus {
  const { token } = useAuthStore();
  const [status, setStatus] = useState<SocketConnectionStatus>('disconnected');

  const handleConnect = useCallback(() => {
    console.log('useSocket: WebSocket connected');
    setStatus('connected');
  }, []);

  const handleDisconnect = useCallback(() => {
    console.log('useSocket: WebSocket disconnected');
    setStatus('disconnected');
  }, []);

  const handleConnectError = useCallback((error: unknown) => {
    console.error('useSocket: WebSocket connection error', error);
    setStatus('connecting'); // 连接错误时保持 connecting 状态，因为会自动重试
  }, []);

  useEffect(() => {
    if (!token) {
      setStatus('disconnected');
      wsService.disconnect();
      return;
    }

    // 先绑定事件监听器，再调用 connect
    // 这样可以确保不会错过任何事件
    wsService.on('connect', handleConnect);
    wsService.on('disconnect', handleDisconnect);
    wsService.on('connect_error', handleConnectError);

    // 检查当前连接状态
    if (wsService.connected) {
      setStatus('connected');
    } else {
      setStatus('connecting');
      wsService.connect(token);
    }

    // 心跳定时器
    const heartbeatTimer = window.setInterval(() => {
      if (wsService.connected) {
        wsService.send('heartbeat', { ts: Date.now() });
      }
    }, 30000);

    // 定期检查连接状态（作为备用机制）
    const statusCheckTimer = window.setInterval(() => {
      const currentConnected = wsService.connected;
      setStatus(prev => {
        if (currentConnected && prev !== 'connected') {
          return 'connected';
        }
        if (!currentConnected && prev === 'connected') {
          return 'disconnected';
        }
        return prev;
      });
    }, 2000);

    return () => {
      window.clearInterval(heartbeatTimer);
      window.clearInterval(statusCheckTimer);
      wsService.off('connect', handleConnect);
      wsService.off('disconnect', handleDisconnect);
      wsService.off('connect_error', handleConnectError);
    };
  }, [token, handleConnect, handleDisconnect, handleConnectError]);

  return status;
}
