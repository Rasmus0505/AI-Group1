import { io, Socket } from 'socket.io-client';
import { serverConfigService } from './serverConfig';

type AckFn<T = unknown> = (response?: T) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private activeRooms: Set<string> = new Set();
  private activeSessionId: string | null = null;
  private serverUrl: string = serverConfigService.getWsUrl();
  private latency: number = 0;
  private latencyCheckInterval: number | null = null;
  private connectionStatusListeners: Array<(status: 'connected' | 'disconnected' | 'connecting', latency: number) => void> = [];

  constructor() {
    // 监听服务器配置变化
    serverConfigService.subscribe((config) => {
      if (this.serverUrl !== config.wsUrl) {
        this.setServerUrl(config.wsUrl);
      }
    });
  }

  // 设置服务器地址
  setServerUrl(url: string): void {
    this.serverUrl = url;
    // 如果已经连接，重新连接
    if (this.socket?.connected) {
      this.disconnect();
      // 注意：这里不会自动重连，需要调用者手动调用connect
    }
  }

  // 获取当前服务器地址
  getServerUrl(): string {
    return this.serverUrl;
  }

  // 获取当前延迟
  getLatency(): number {
    return this.latency;
  }

  // 添加连接状态监听器
  addConnectionStatusListener(listener: (status: 'connected' | 'disconnected' | 'connecting', latency: number) => void): void {
    this.connectionStatusListeners.push(listener);
  }

  // 移除连接状态监听器
  removeConnectionStatusListener(listener: (status: 'connected' | 'disconnected' | 'connecting', latency: number) => void): void {
    this.connectionStatusListeners = this.connectionStatusListeners.filter(l => l !== listener);
  }

  // 通知所有连接状态监听器
  private notifyConnectionStatusListeners(status: 'connected' | 'disconnected' | 'connecting'): void {
    this.connectionStatusListeners.forEach(listener => listener(status, this.latency));
  }

  // 检测延迟
  private checkLatency(): void {
    if (!this.socket?.connected) return;

    const startTime = Date.now();
    this.socket.emit('ping', (): void => {
      this.latency = Date.now() - startTime;
      this.notifyConnectionStatusListeners('connected');
    });
  }

  connect(token: string): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(this.serverUrl, {
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
      // Socket.io 的原生事件（connect, disconnect, connect_error）需要直接绑定
      // 这些事件在 socket 创建时就会触发，所以需要立即绑定
      this.socket.on(event, callback as any);
    }
  }

  off(event: string, callback?: (data: unknown) => void): void {
    if (this.socket) {
      this.socket.off(event, callback as any);
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

  // 同步会话
  private syncSession(): void {
    if (!this.socket || !this.activeSessionId) return;
    this.socket.emit('session_sync', { sessionId: this.activeSessionId }, () => {
      // no-op ack
    });
  }

  // 请求增量更新
  requestSessionDeltas(sessionId: string, fromVersion: number): void {
    if (!this.socket?.connected) {
      return;
    }
    this.socket.emit('get_session_deltas', { sessionId, fromVersion });
  }

  // 应用增量更新到状态
  applyDeltaToState(currentState: Record<string, unknown>, delta: Partial<Record<string, unknown>>): Record<string, unknown> {
    const newState = { ...currentState };

    for (const [key, value] of Object.entries(delta)) {
      if (value === undefined) {
        // 删除属性
        delete newState[key];
      } else {
        // 更新或添加属性
        newState[key] = value;
      }
    }

    return newState;
  }

  private registerHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      // 重连后恢复房间和会话状态
      this.rejoinRooms();
      this.syncSession();
      
      // 开始延迟检测
      this.startLatencyCheck();
      // 通知连接状态
      this.notifyConnectionStatusListeners('connected');
    });

    this.socket.on('disconnect', reason => {
      console.log('WebSocket disconnected', reason);
      // 停止延迟检测
      this.stopLatencyCheck();
      // 通知连接状态
      this.notifyConnectionStatusListeners('disconnected');
    });

    this.socket.on('error', (error: unknown) => {
      console.error('WebSocket error:', error);
      // 通知连接状态
      this.notifyConnectionStatusListeners('disconnected');
    });

    this.socket.on('connect_error', () => {
      console.log('WebSocket connect error');
      this.reconnectAttempts++;
      // 通知连接状态
      this.notifyConnectionStatusListeners('connecting');
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.disconnect();
      }
    });
    
    // 处理服务器的pong响应（如果服务器发送pong事件）
    this.socket.on('pong', (data: any) => {
      if (data && typeof data.timestamp === 'number') {
        this.latency = Date.now() - data.timestamp;
        this.notifyConnectionStatusListeners('connected');
      }
    });
  }
  
  // 开始延迟检测
  private startLatencyCheck(): void {
    this.stopLatencyCheck(); // 确保没有重复的定时器
    
    // 每5秒检查一次延迟
    this.latencyCheckInterval = setInterval(() => {
      this.checkLatency();
    }, 5000);
  }
  
  // 停止延迟检测
  private stopLatencyCheck(): void {
    if (this.latencyCheckInterval) {
      clearInterval(this.latencyCheckInterval);
      this.latencyCheckInterval = null;
    }
  }
}

export const wsService = new WebSocketService();
