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

    setStatus('connecting');
    wsService.connect(token);

    const handleConnect = () => {
      setStatus('connected');
    };

    const handleDisconnect = () => {
      setStatus('disconnected');
    };

    const handleConnectError = () => {
      setStatus('disconnected');
    };

    wsService.on('connect', handleConnect);
    wsService.on('disconnect', handleDisconnect);
    wsService.on('connect_error', handleConnectError);

    const heartbeatTimer = window.setInterval(() => {
      if (wsService.connected) {
        wsService.send('heartbeat', { ts: Date.now() });
      }
    }, 30000);

    return () => {
      window.clearInterval(heartbeatTimer);
      wsService.off('connect', handleConnect);
      wsService.off('disconnect', handleDisconnect);
      wsService.off('connect_error', handleConnectError);
    };
  }, [token]);

  return status;
}
