// UDP服务器发现服务，用于在局域网内发现游戏服务器

class UdpDiscoveryService {
  private discoveryPort = 41234;
  private udpSocket: any = null;
  private discoveredServers: Array<{ ip: string; port: number; name: string; timestamp: number }> = [];
  private onServerDiscoveredCallback: ((servers: Array<{ ip: string; port: number; name: string }>) => void) | null = null;
  private cleanupTimeout: number | null = null;

  // 初始化UDP socket（使用浏览器的WebSocket API模拟，因为浏览器不支持原生UDP）
  // 注意：浏览器环境下无法直接使用UDP，这里使用WebSocket fallback
  // 实际项目中可能需要使用WebRTC或其他技术
  init(): void {
    // 在浏览器环境中，我们将使用不同的策略
    // 1. 首先尝试连接到默认地址
    // 2. 提供手动输入服务器地址的选项
    // 3. 对于支持WebTransport的浏览器，可以考虑使用WebTransport
    
    console.log('UDP discovery service initialized (browser mode)');
  }

  // 开始发现服务器
  startDiscovery(onServerDiscovered: (servers: Array<{ ip: string; port: number; name: string }>) => void): void {
    this.onServerDiscoveredCallback = onServerDiscovered;
    
    // 浏览器环境下的发现策略：
    // 1. 检查本地存储中的历史服务器
    // 2. 尝试常见的局域网地址
    // 3. 提供手动输入选项
    
    this.tryCommonAddresses();
    
    // 清理过期的服务器记录
    this.cleanupExpiredServers();
  }

  // 停止发现服务器
  stopDiscovery(): void {
    if (this.cleanupTimeout) {
      clearTimeout(this.cleanupTimeout);
      this.cleanupTimeout = null;
    }
    
    this.onServerDiscoveredCallback = null;
  }

  // 尝试连接常见的局域网地址
  private tryCommonAddresses(): void {
    // 常见的局域网地址段
    const commonAddresses = [
      'localhost',
      '192.168.1.1',
      '192.168.0.1',
      // 可以根据实际情况扩展
    ];

    // 尝试连接每个地址
    commonAddresses.forEach(async (address) => {
      for (let port = 3000; port <= 3002; port++) {
        try {
          // 尝试连接HTTP服务，使用AbortController实现超时
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          
          const response = await fetch(`http://${address}:${port}/health`, {
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            // 服务器存在
            const server = {
              ip: address,
              port: port,
              name: `Game Server (${address}:${port})`,
              timestamp: Date.now()
            };
            
            this.addDiscoveredServer(server);
          }
        } catch (error) {
          // 连接失败，忽略
        }
      }
    });
  }

  // 添加发现的服务器
  private addDiscoveredServer(server: { ip: string; port: number; name: string; timestamp: number }): void {
    // 检查是否已存在
    const existingIndex = this.discoveredServers.findIndex(
      s => s.ip === server.ip && s.port === server.port
    );

    if (existingIndex >= 0) {
      // 更新现有服务器
      this.discoveredServers[existingIndex] = server;
    } else {
      // 添加新服务器
      this.discoveredServers.push(server);
    }

    // 通知回调
    this.notifyServerDiscovered();
  }

  // 清理过期的服务器记录
  private cleanupExpiredServers(): void {
    const now = Date.now();
    const expirationTime = 30000; // 30秒过期
    
    this.discoveredServers = this.discoveredServers.filter(
      server => now - server.timestamp < expirationTime
    );
    
    // 通知回调
    this.notifyServerDiscovered();
    
    // 30秒后再次清理
    this.cleanupTimeout = setTimeout(() => {
      this.cleanupExpiredServers();
    }, 30000);
  }

  // 通知服务器发现事件
  private notifyServerDiscovered(): void {
    if (this.onServerDiscoveredCallback) {
      this.onServerDiscoveredCallback(
        this.discoveredServers.map(server => ({
          ip: server.ip,
          port: server.port,
          name: server.name
        }))
      );
    }
  }

  // 手动添加服务器
  addServerManually(ip: string, port: number): void {
    const server = {
      ip,
      port,
      name: `Manual Server (${ip}:${port})`,
      timestamp: Date.now()
    };
    
    this.addDiscoveredServer(server);
  }

  // 获取当前发现的服务器列表
  getDiscoveredServers(): Array<{ ip: string; port: number; name: string }> {
    return this.discoveredServers.map(server => ({
      ip: server.ip,
      port: server.port,
      name: server.name
    }));
  }
}

export const udpDiscoveryService = new UdpDiscoveryService();
