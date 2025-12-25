import { useEffect, useState } from 'react';
import { wsService } from '../services/websocket';
import { useAuthStore } from '../stores/authStore';

export type SocketConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export function useSocket(): SocketConnectionStatus {
  const { token } = useAuthStore();
  const [status, setStatus] = useState<SocketConnectionStatus>('disconnected');

  useEffect(() => {
    if (!token) {
      setStatus('disconnected');
      wsService.disconnect();
      return;
    }

    // 检查是否已经连接
    if (wsService.connected) {
      setStatus('connected');
    } else {
      setStatus('connecting');
    }

    wsService.connect(token);

    const handleConnect = () => {
      console.log('useSocket: WebSocket connected');
      setStatus('connected');
    };

    const handleDisconnect = () => {
      console.log('useSocket: WebSocket disconnected');
      setStatus('disconnected');
    };

    const handleConnectError = (error: unknown) => {
      console.error('useSocket: WebSocket connection error', error);
      setStatus('disconnected');
    };

    // 使用 setTimeout 确保 socket 已经创建后再绑定事件
    const timeoutId = setTimeout(() => {
      wsService.on('connect', handleConnect);
      wsService.on('disconnect', handleDisconnect);
      wsService.on('connect_error', handleConnectError);
      
      // 如果已经连接，立即更新状态
      if (wsService.connected) {
        setStatus('connected');
      }
    }, 100);

    const heartbeatTimer = window.setInterval(() => {
      if (wsService.connected) {
        wsService.send('heartbeat', { ts: Date.now() });
      }
    }, 30000);

    return () => {
      clearTimeout(timeoutId);
      window.clearInterval(heartbeatTimer);
      wsService.off('connect', handleConnect);
      wsService.off('disconnect', handleDisconnect);
      wsService.off('connect_error', handleConnectError);
    };
  }, [token]);

  return status;
}
