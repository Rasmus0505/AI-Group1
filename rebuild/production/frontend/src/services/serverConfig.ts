import { clearAuthSession } from '../utils/authSession';

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
    const currentHost = window.location.hostname;
    const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1';

    if (!isLocalhost) {
      return {
        apiBaseUrl: `http://${currentHost}:3000/api`,
        wsUrl: `http://${currentHost}:3000`,
      };
    }

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

  setServer(host: string, port: number = 3000): void {
    const nextApiBaseUrl = `http://${host}:${port}/api`;
    const nextWsUrl = `http://${host}:${port}`;
    const serverChanged =
      this.config.apiBaseUrl !== nextApiBaseUrl || this.config.wsUrl !== nextWsUrl;

    this.config = {
      apiBaseUrl: nextApiBaseUrl,
      wsUrl: nextWsUrl,
      lastConnected: Date.now(),
    };

    if (serverChanged) {
      clearAuthSession();
    }

    this.save();
    this.notifyListeners();
  }

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

  async scanLanServers(): Promise<Array<{ host: string; port: number; latency: number }>> {
    const results: Array<{ host: string; port: number; latency: number }> = [];
    const addresses = this.generateLanAddresses();
    const BATCH_SIZE = 10;

    for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
      const batch = addresses.slice(i, i + BATCH_SIZE);
      const batchTests = batch.map(async addr => {
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

      if (results.length >= 5) {
        break;
      }
    }

    return results.sort((a, b) => a.latency - b.latency);
  }

  private generateLanAddresses(): string[] {
    const addresses: string[] = ['localhost'];
    const subnets = ['192.168.1', '192.168.0', '10.0.0', '172.16.0'];

    subnets.forEach(subnet => {
      for (let i = 1; i <= 20; i++) {
        addresses.push(`${subnet}.${i}`);
      }
    });

    const currentHost = window.location.hostname;
    if (currentHost.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      const parts = currentHost.split('.');
      const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
      for (let i = 1; i <= 254; i++) {
        const addr = `${subnet}.${i}`;
        if (!addresses.includes(addr)) {
          addresses.unshift(addr);
        }
      }
    }

    return addresses;
  }

  reset(): void {
    const nextConfig = this.getDefaultConfig();
    const serverChanged =
      this.config.apiBaseUrl !== nextConfig.apiBaseUrl || this.config.wsUrl !== nextConfig.wsUrl;

    localStorage.removeItem(STORAGE_KEY);
    this.config = nextConfig;

    if (serverChanged) {
      clearAuthSession();
    }

    this.notifyListeners();
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
  }

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
