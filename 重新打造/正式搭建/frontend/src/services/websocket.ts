import { io, Socket } from 'socket.io-client';

type AckFn<T = unknown> = (response?: T) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private activeRooms: Set<string> = new Set();
  private activeSessionId: string | null = null;

  connect(token: string): void {
    if (this.socket?.connected) {
      return;
    }

    const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3000';
    this.socket = io(wsUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.registerHandlers();
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.reconnectAttempts = 0;
      this.activeRooms.clear();
      this.activeSessionId = null;
    }
  }

  send(event: string, data: unknown, ack?: AckFn): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data, ack);
    }
  }

  sendWithAck<T = unknown>(event: string, data: unknown, timeoutMs = 5000): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('WebSocket not connected'));
        return;
      }
      const timer = window.setTimeout(() => {
        reject(new Error('Ack timeout'));
      }, timeoutMs);
      this.socket.emit(event, data, (resp?: T) => {
        window.clearTimeout(timer);
        resolve(resp);
      });
    });
  }

  on(event: string, callback: (data: unknown) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (data: unknown) => void): void {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  trackRoom(roomId: string): void {
    this.activeRooms.add(roomId);
    if (this.connected) {
      this.rejoinRooms();
    }
  }

  untrackRoom(roomId: string): void {
    this.activeRooms.delete(roomId);
  }

  setActiveSession(sessionId: string | null): void {
    this.activeSessionId = sessionId;
    if (this.connected && sessionId) {
      this.syncSession();
    }
  }

  get connected(): boolean {
    return this.socket?.connected || false;
  }

  private rejoinRooms(): void {
    if (!this.socket || this.activeRooms.size === 0) return;
    this.socket.emit('rejoin_rooms', { roomIds: Array.from(this.activeRooms) }, () => {
      // no-op ack
    });
  }

  private syncSession(): void {
    if (!this.socket || !this.activeSessionId) return;
    this.socket.emit('session_sync', { sessionId: this.activeSessionId }, () => {
      // no-op ack
    });
  }

  private registerHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      // 重连后恢复房间和会话状态
      this.rejoinRooms();
      this.syncSession();
    });

    this.socket.on('disconnect', reason => {
      console.log('WebSocket disconnected', reason);
    });

    this.socket.on('error', (error: unknown) => {
      console.error('WebSocket error:', error);
    });

    this.socket.on('connect_error', () => {
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.disconnect();
      }
    });
  }
}

export const wsService = new WebSocketService();
