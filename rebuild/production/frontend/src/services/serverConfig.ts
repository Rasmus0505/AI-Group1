/**
 * 服务器配置服务 - 支持动态切换服务器地址
 * 用于局域网多电脑连接场景
 */

const STORAGE_KEY = 'game_server_config';

interface ServerConfig {
  apiBaseUrl: string;
  wsUrl: string;
  lastConnected?: number;
}

class ServerConfigService {
  private config: ServerConfig;
  private listeners: Array<(config: ServerConfig) => void> = [];

  constructor() {
    // 优先从 localStorage 读取，否则使用环境变量
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        this.config = JSON.parse(saved);
      } catch {
        this.config = this.getDefaultConfig();
      }
    } else {
      this.config = this.getDefaultConfig();
    }
  }

  private getDefaultConfig(): ServerConfig {
    // 智能检测：如果当前页面不是 localhost，使用页面的 host
    const currentHost = window.location.hostname;
    const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1';
    
    if (!isLocalhost) {
      // 用户通过 IP 访问，使用相同的 IP 作为 API 地址
      return {
        apiBaseUrl: `http://${currentHost}:3000/api`,
        wsUrl: `http://${currentHost}:3000`,
      };
    }

    // 使用环境变量配置
    return {
      apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
      wsUrl: import.meta.env.VITE_WS_URL || 'http://localhost:3000',
    };
  }

  getConfig(): ServerConfig {
    return { ...this.config };
  }

  getApiBaseUrl(): string {
    return this.config.apiBaseUrl;
  }

  getWsUrl(): string {
    return this.config.wsUrl;
  }

  /**
   * 设置服务器地址
   */
  setServer(host: string, port: number = 3000): void {
    this.config = {
      apiBaseUrl: `http://${host}:${port}/api`,
      wsUrl: `http://${host}:${port}`,
      lastConnected: Date.now(),
    };
    this.save();
    this.notifyListeners();
  }

  /**
   * 测试服务器连接
   */
  async testConnection(host: string, port: number = 3000): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`http://${host}:${port}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 扫描局域网常见地址
   * 使用并发限制避免性能问题
   */
  async scanLanServers(): Promise<Array<{ host: string; port: number; latency: number }>> {
    const results: Array<{ host: string; port: number; latency: number }> = [];
    
    // 获取可能的局域网地址
    const addresses = this.generateLanAddresses();
    
    // 并发限制：每批最多10个并发请求
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
      const batch = addresses.slice(i, i + BATCH_SIZE);
      const batchTests = batch.map(async (addr) => {
        const start = Date.now();
        const isOnline = await this.testConnection(addr, 3000);
        if (isOnline) {
          results.push({
            host: addr,
            port: 3000,
            latency: Date.now() - start,
          });
        }
      });
      
      await Promise.all(batchTests);
      
      // 如果已经找到足够多的服务器，提前结束扫描
      if (results.length >= 5) {
        break;
      }
    }
    
    // 按延迟排序
    return results.sort((a, b) => a.latency - b.latency);
  }

  /**
   * 生成局域网常见地址列表
   */
  private generateLanAddresses(): string[] {
    const addresses: string[] = ['localhost'];
    
    // 常见的局域网网段
    const subnets = ['192.168.1', '192.168.0', '10.0.0', '172.16.0'];
    
    // 每个网段扫描前20个地址
    subnets.forEach(subnet => {
      for (let i = 1; i <= 20; i++) {
        addresses.push(`${subnet}.${i}`);
      }
    });

    // 如果当前页面是通过 IP 访问的，优先检查同网段
    const currentHost = window.location.hostname;
    if (currentHost.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      const parts = currentHost.split('.');
      const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
      for (let i = 1; i <= 254; i++) {
        const addr = `${subnet}.${i}`;
        if (!addresses.includes(addr)) {
          addresses.unshift(addr); // 优先检查
        }
      }
    }

    return addresses;
  }

  /**
   * 重置为默认配置
   */
  reset(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.config = this.getDefaultConfig();
    this.notifyListeners();
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
  }

  /**
   * 订阅配置变化
   */
  subscribe(listener: (config: ServerConfig) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(l => l(this.config));
  }
}

export const serverConfigService = new ServerConfigService();
