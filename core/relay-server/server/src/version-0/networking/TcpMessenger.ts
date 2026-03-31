import { Socket, Server, createServer } from 'node:net';
import { 
  SimpleMessenger, 
  JSON_Unknown, 
  createSimpleEmitter, 
  ISimpleEventEmitter 
} from '@match-lock/shared';

/**
 * A SimpleMessenger implementation over TCP sockets
 */
export class TcpMessenger implements SimpleMessenger {
  public onMessage: ISimpleEventEmitter<[message: JSON_Unknown]> = createSimpleEmitter();
  private socket: Socket;
  private buffer: string = '';

  constructor(socket: Socket) {
    this.socket = socket;
    this.setupSocket();
  }

  private setupSocket(): void {
    this.socket.setEncoding('utf8');
    
    this.socket.on('data', (chunk: string) => {
      this.buffer += chunk;
      this.processBuffer();
    });

    this.socket.on('error', (error) => {
      console.error('TCP Socket error:', error);
      this.close(error.message);
    });

    this.socket.on('close', () => {
      console.log('TCP Socket closed');
    });
  }

  private processBuffer(): void {
    let newlineIndex;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);
      
      if (line.trim()) {
        try {
          const message = JSON.parse(line) as JSON_Unknown;
          this.onMessage.emit(message);
        } catch (error) {
          console.error('Failed to parse JSON message:', error, 'Raw line:', line);
        }
      }
    }
  }

  async sendMessage(message: JSON_Unknown): Promise<boolean> {
    try {
      const jsonString = JSON.stringify(message) + '\n';
      return new Promise((resolve) => {
        this.socket.write(jsonString, (error) => {
          if (error) {
            console.error('Failed to send message:', error);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error('Failed to serialize message:', error);
      return false;
    }
  }

  close(error?: string): void {
    if (error) {
      console.log('Closing TCP connection due to error:', error);
    }
    this.socket.destroy();
  }

  async connect(): Promise<void> {
    // For server-side sockets, connection is already established
    // For client-side sockets, this would be implemented differently
    return Promise.resolve();
  }

  isConnected(): boolean {
    return !this.socket.destroyed && this.socket.readyState === 'open';
  }
}

/**
 * TCP Server that creates TcpMessenger instances for each connection
 */
export class TcpServer {
  private server: Server;
  public onConnection: ISimpleEventEmitter<[messenger: TcpMessenger, socket: Socket]> = createSimpleEmitter();

  constructor() {
    this.server = createServer();
    this.setupServer();
  }

  private setupServer(): void {
    this.server.on('connection', (socket) => {
      console.log('New TCP connection from:', socket.remoteAddress, socket.remotePort);
      const messenger = new TcpMessenger(socket);
      this.onConnection.emit(messenger, socket);
    });

    this.server.on('error', (error) => {
      console.error('TCP Server error:', error);
    });
  }

  async listen(port: number, host: string = 'localhost'): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(port, host, () => {
        console.log(`TCP Server listening on ${host}:${port}`);
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('TCP Server closed');
        resolve();
      });
    });
  }

  getAddress(): { port: number; family: string; address: string } | null {
    const address = this.server.address();
    if (typeof address === 'string' || !address) {
      return null;
    }
    return address;
  }
}

/**
 * TCP Client that connects to a server and returns a TcpMessenger
 */
export class TcpClient {
  static async connect(port: number, host: string = 'localhost'): Promise<TcpMessenger> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      
      socket.connect(port, host, () => {
        console.log(`Connected to TCP server at ${host}:${port}`);
        const messenger = new TcpMessenger(socket);
        resolve(messenger);
      });

      socket.on('error', (error) => {
        console.error('TCP Client connection error:', error);
        reject(error);
      });
    });
  }
}
