import { Socket } from 'node:net';
import { 
  UserId, 
  MatchLockRestrictionConfig,
  createSimpleEmitter, 
  ISimpleEventEmitter 
} from '@match-lock/shared';
import { TcpServer, TcpMessenger } from '../networking';
import { SignedMessenger, SignedMessengerConfig } from '../messaging';
import { KeyPair, generateKeyPair } from '../crypto';

export interface HostRoomConfig {
  roomId: string;
  restrictionConfig: MatchLockRestrictionConfig;
  userPublicKeys: Record<UserId, string>;
  hostKeyPair?: KeyPair;
  port?: number;
  host?: string;
}

export interface ConnectedUser {
  userId: UserId;
  messenger: SignedMessenger;
  socket: Socket;
  isAuthenticated: boolean;
}

/**
 * Host room that listens for TCP connections and manages signed message communication
 */
export class HostRoom {
  private server: TcpServer;
  private hostKeyPair: KeyPair;
  private connectedUsers: Map<UserId, ConnectedUser> = new Map();
  private config: HostRoomConfig;

  public onUserConnected: ISimpleEventEmitter<[userId: UserId, user: ConnectedUser]> = createSimpleEmitter();
  public onUserDisconnected: ISimpleEventEmitter<[userId: UserId]> = createSimpleEmitter();
  public onUserMessage: ISimpleEventEmitter<[fromUserId: UserId, message: any]> = createSimpleEmitter();
  public onRoomReady: ISimpleEventEmitter<[]> = createSimpleEmitter();
  public onError: ISimpleEventEmitter<[error: Error]> = createSimpleEmitter();

  constructor(config: HostRoomConfig) {
    this.config = config;
    this.hostKeyPair = config.hostKeyPair || generateKeyPair();
    this.server = new TcpServer();
    this.setupServer();
  }

  private setupServer(): void {
    this.server.onConnection((tcpMessenger, socket) => {
      this.handleNewConnection(tcpMessenger, socket);
    });
  }

  private async handleNewConnection(tcpMessenger: TcpMessenger, socket: Socket): Promise<void> {
    try {
      console.log(`New connection from ${socket.remoteAddress}:${socket.remotePort}`);
      
      // Create signed messenger for this connection
      const signedMessengerConfig: SignedMessengerConfig = {
        keyPair: this.hostKeyPair,
        trustedPublicKeys: { ...this.config.userPublicKeys },
        maxMessageAge: 5 * 60 * 1000 // 5 minutes
      };

      const signedMessenger = new SignedMessenger(tcpMessenger, signedMessengerConfig);
      
      // Handle authentication
      await this.authenticateConnection(signedMessenger, socket);
      
    } catch (error) {
      console.error('Failed to handle new connection:', error);
      socket.destroy();
    }
  }

  private async authenticateConnection(messenger: SignedMessenger, socket: Socket): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Authentication timeout'));
      }, 30000); // 30 second timeout

      // Listen for authentication message
      const authHandler = (verifiedMessage: any) => {
        try {
          if (verifiedMessage.data.type === 'auth' && verifiedMessage.data.userId) {
            const userId = verifiedMessage.data.userId as UserId;
            
            // Check if user is expected
            if (!(userId in this.config.userPublicKeys)) {
              throw new Error(`Unexpected user: ${userId}`);
            }

            // Check if user is already connected
            if (this.connectedUsers.has(userId)) {
              throw new Error(`User ${userId} already connected`);
            }

            // Create connected user
            const connectedUser: ConnectedUser = {
              userId,
              messenger,
              socket,
              isAuthenticated: true
            };

            this.connectedUsers.set(userId, connectedUser);
            
            // Setup message handling for this user
            this.setupUserMessageHandling(connectedUser);
            
            // Send authentication success
            messenger.sendMessage({
              type: 'auth_success',
              roomId: this.config.roomId,
              hostPublicKey: this.hostKeyPair.publicKey
            });

            clearTimeout(timeout);
            messenger.onVerifiedMessage.off(authHandler);
            
            this.onUserConnected.emit(userId, connectedUser);
            this.checkIfRoomReady();
            
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          messenger.onVerifiedMessage.off(authHandler);
          reject(error);
        }
      };

      messenger.onVerifiedMessage(authHandler);

      // Send authentication challenge
      messenger.sendMessage({
        type: 'auth_challenge',
        roomId: this.config.roomId,
        expectedUsers: Object.keys(this.config.userPublicKeys)
      });
    });
  }

  private setupUserMessageHandling(user: ConnectedUser): void {
    user.messenger.onVerifiedMessage((verifiedMessage) => {
      this.onUserMessage.emit(user.userId, verifiedMessage.data);
    });

    user.socket.on('close', () => {
      console.log(`User ${user.userId} disconnected`);
      this.connectedUsers.delete(user.userId);
      this.onUserDisconnected.emit(user.userId);
    });

    user.socket.on('error', (error) => {
      console.error(`Socket error for user ${user.userId}:`, error);
      this.connectedUsers.delete(user.userId);
      this.onUserDisconnected.emit(user.userId);
    });
  }

  private checkIfRoomReady(): void {
    const expectedUserCount = Object.keys(this.config.userPublicKeys).length;
    const connectedUserCount = this.connectedUsers.size;
    
    if (connectedUserCount === expectedUserCount) {
      console.log('Room is ready - all users connected');
      this.onRoomReady.emit();
    }
  }

  async start(): Promise<void> {
    const port = this.config.port || 0; // 0 = random port
    const host = this.config.host || 'localhost';
    
    await this.server.listen(port, host);
    
    const address = this.server.getAddress();
    if (address) {
      console.log(`Host room ${this.config.roomId} listening on ${address.address}:${address.port}`);
    }
  }

  async stop(): Promise<void> {
    // Disconnect all users
    for (const user of this.connectedUsers.values()) {
      user.socket.destroy();
    }
    this.connectedUsers.clear();
    
    // Close server
    await this.server.close();
  }

  getConnectedUsers(): UserId[] {
    return Array.from(this.connectedUsers.keys());
  }

  getServerAddress(): { port: number; address: string } | null {
    const address = this.server.getAddress();
    return address ? { port: address.port, address: address.address } : null;
  }

  broadcastMessage(message: any, excludeUserId?: UserId): void {
    for (const [userId, user] of this.connectedUsers) {
      if (excludeUserId && userId === excludeUserId) {
        continue;
      }
      user.messenger.sendMessage(message);
    }
  }

  sendMessageToUser(userId: UserId, message: any): boolean {
    const user = this.connectedUsers.get(userId);
    if (!user) {
      return false;
    }
    user.messenger.sendMessage(message);
    return true;
  }

  getHostPublicKey(): string {
    return this.hostKeyPair.publicKey;
  }
}
