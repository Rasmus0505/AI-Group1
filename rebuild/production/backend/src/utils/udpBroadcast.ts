import dgram from 'dgram';
import { logger } from './logger';

const BROADCAST_PORT = 41234;
const BROADCAST_INTERVAL = 5000; // 每5秒广播一次

export class UdpBroadcastService {
  private udpServer: dgram.Socket | null = null;
  private broadcastInterval: NodeJS.Timeout | null = null;
  private serverPort: number;

  constructor(serverPort: number) {
    this.serverPort = serverPort;
  }

  start(): void {
    if (this.udpServer) {
      logger.warn('UDP broadcast server already running');
      return;
    }

    // 创建UDP服务器
    this.udpServer = dgram.createSocket('udp4');

    // 绑定事件
    this.udpServer.on('error', (err) => {
      logger.error(`UDP broadcast server error: ${err.stack}`);
      this.udpServer?.close();
      this.udpServer = null;
    });

    this.udpServer.on('listening', () => {
      const address = this.udpServer?.address();
      if (address && typeof address === 'object') {
        logger.info(`UDP broadcast server listening on ${address.address}:${address.port}`);
        // 允许广播
        this.udpServer?.setBroadcast(true);
        // 开始广播
        this.startBroadcasting();
      }
    });

    this.udpServer.on('message', (msg, rinfo) => {
      // 接收客户端的发现请求
      const message = msg.toString();
      if (message === 'DISCOVER_SERVER') {
        this.sendServerInfo(rinfo.address, rinfo.port);
      }
    });

    // 绑定端口
    this.udpServer.bind(BROADCAST_PORT);
  }

  stop(): void {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }

    if (this.udpServer) {
      this.udpServer.close();
      this.udpServer = null;
      logger.info('UDP broadcast server stopped');
    }
  }

  private startBroadcasting(): void {
    if (this.broadcastInterval || !this.udpServer) return;

    this.broadcastInterval = setInterval(() => {
      this.broadcastServerInfo();
    }, BROADCAST_INTERVAL);

    logger.info(`UDP broadcast started, interval: ${BROADCAST_INTERVAL}ms`);
  }

  private broadcastServerInfo(): void {
    if (!this.udpServer) return;

    const serverInfo = {
      type: 'GAME_SERVER',
      name: 'AI Game Server',
      port: this.serverPort,
      timestamp: Date.now(),
      version: '1.0.0'
    };

    const message = Buffer.from(JSON.stringify(serverInfo));

    // 向局域网广播
    this.udpServer.send(message, 0, message.length, BROADCAST_PORT, '255.255.255.255', (err) => {
      if (err) {
        logger.error(`UDP broadcast error: ${err.message}`);
      }
    });
  }

  private sendServerInfo(clientAddress: string, clientPort: number): void {
    if (!this.udpServer) return;

    const serverInfo = {
      type: 'GAME_SERVER',
      name: 'AI Game Server',
      port: this.serverPort,
      timestamp: Date.now(),
      version: '1.0.0'
    };

    const message = Buffer.from(JSON.stringify(serverInfo));

    // 直接回复客户端
    this.udpServer.send(message, 0, message.length, clientPort, clientAddress, (err) => {
      if (err) {
        logger.error(`UDP reply error: ${err.message}`);
      }
    });
  }
}