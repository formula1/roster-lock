import { 
  UserId, 
  createSimpleEmitter, 
  ISimpleEventEmitter 
} from '@match-lock/shared';
import { TcpClient, TcpMessenger } from '../networking';
import { SignedMessenger, SignedMessengerConfig } from '../messaging';
import { KeyPair, generateKeyPair } from '../crypto';

export interface ClientRoomConfig {
  userId: UserId;
  hostAddress: string;
  hostPort: number;
  hostPublicKey?: string;
  clientKeyPair?: KeyPair;
  connectionTimeout?: number;
}

/**
 * Client room that connects to a host and participates in signed message communication
 */
export class ClientRoom {
  private config: ClientRoomConfig;
  private clientKeyPair: KeyPair;
  private tcpMessenger?: TcpMessenger;
  private signedMessenger?: SignedMessenger;
  private isConnected: boolean = false;
  private isAuthenticated: boolean = false;
  private hostPublicKey?: string;

  public onConnected: ISimpleEventEmitter<[]> = createSimpleEmitter();
  public onAuthenticated: ISimpleEventEmitter<[roomId: string]> = createSimpleEmitter();
  public onDisconnected: ISimpleEventEmitter<[reason?: string]> = createSimpleEmitter();
  public onMessage: ISimpleEventEmitter<[message: any]> = createSimpleEmitter();
  public onError: ISimpleEventEmitter<[error: Error]> = createSimpleEmitter();

  constructor(config: ClientRoomConfig) {
    this.config = config;
    this.clientKeyPair = config.clientKeyPair || generateKeyPair();
  }

  async connect(): Promise<void> {
    try {
      console.log(`Connecting to host at ${this.config.hostAddress}:${this.config.hostPort}`);
      
      // Connect to TCP server
      this.tcpMessenger = await TcpClient.connect(this.config.hostPort, this.config.hostAddress);
      this.isConnected = true;
      this.onConnected.emit();

      // Setup signed messenger (initially with empty trusted keys)
      const signedMessengerConfig: SignedMessengerConfig = {
        keyPair: this.clientKeyPair,
        trustedPublicKeys: {},
        maxMessageAge: 5 * 60 * 1000 // 5 minutes
      };

      this.signedMessenger = new SignedMessenger(this.tcpMessenger, signedMessengerConfig);
      
      // Setup message handling
      this.setupMessageHandling();
      
      // Wait for authentication challenge
      await this.waitForAuthenticationChallenge();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.handleError(new Error(`Failed to connect: ${errorMessage}`));
      throw error;
    }
  }

  private setupMessageHandling(): void {
    if (!this.signedMessenger) return;

    this.signedMessenger.onMessage((message) => {
      this.handleIncomingMessage(message);
    });

    this.signedMessenger.onVerifiedMessage((verifiedMessage) => {
      this.onMessage.emit(verifiedMessage.data);
    });

    this.signedMessenger.onInvalidMessage((error, rawMessage) => {
      console.warn('Received invalid signed message:', error.message);
    });
  }

  private async waitForAuthenticationChallenge(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Authentication challenge timeout'));
      }, this.config.connectionTimeout || 30000);

      const messageHandler = (message: any) => {
        try {
          if (message.type === 'auth_challenge') {
            clearTimeout(timeout);
            this.signedMessenger?.onMessage.off(messageHandler);
            
            // Store host public key if provided
            if (this.config.hostPublicKey) {
              this.hostPublicKey = this.config.hostPublicKey;
              if (this.signedMessenger && this.hostPublicKey) {
                this.signedMessenger.addTrustedPublicKey('host', this.hostPublicKey);
              }
            }
            
            // Send authentication response
            this.sendAuthenticationResponse(message);
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          this.signedMessenger?.onMessage.off(messageHandler);
          reject(error);
        }
      };

      this.signedMessenger?.onMessage(messageHandler);
    });
  }

  private async sendAuthenticationResponse(challengeMessage: any): Promise<void> {
    if (!this.signedMessenger) {
      throw new Error('Signed messenger not initialized');
    }

    // Send signed authentication message
    await this.signedMessenger.sendMessage({
      type: 'auth',
      userId: this.config.userId,
      publicKey: this.clientKeyPair.publicKey,
      challengeId: challengeMessage.challengeId
    });

    // Wait for authentication success
    await this.waitForAuthenticationSuccess();
  }

  private async waitForAuthenticationSuccess(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Authentication success timeout'));
      }, 10000);

      const messageHandler = (message: any) => {
        try {
          if (message.type === 'auth_success') {
            clearTimeout(timeout);
            this.signedMessenger?.onMessage.off(messageHandler);
            
            this.isAuthenticated = true;
            
            // Store host public key from response
            if (message.hostPublicKey) {
              this.hostPublicKey = message.hostPublicKey;
              if (this.signedMessenger && this.hostPublicKey) {
                this.signedMessenger.addTrustedPublicKey('host', this.hostPublicKey);
              }
            }
            
            this.onAuthenticated.emit(message.roomId);
            resolve();
          } else if (message.type === 'auth_error') {
            clearTimeout(timeout);
            this.signedMessenger?.onMessage.off(messageHandler);
            reject(new Error(`Authentication failed: ${message.reason}`));
          }
        } catch (error) {
          clearTimeout(timeout);
          this.signedMessenger?.onMessage.off(messageHandler);
          reject(error);
        }
      };

      this.signedMessenger?.onMessage(messageHandler);
    });
  }

  private handleIncomingMessage(message: any): void {
    // Handle special system messages
    switch (message.type) {
      case 'disconnect':
        this.disconnect(message.reason);
        break;
      case 'error':
        this.handleError(new Error(message.message));
        break;
      default:
        // Regular messages are handled by the onMessage event
        break;
    }
  }

  async sendMessage(message: any): Promise<boolean> {
    if (!this.isAuthenticated || !this.signedMessenger) {
      console.error('Cannot send message: not authenticated');
      return false;
    }

    try {
      return await this.signedMessenger.sendMessage(message);
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }

  disconnect(reason?: string): void {
    if (reason) {
      console.log(`Disconnecting: ${reason}`);
    }

    this.isConnected = false;
    this.isAuthenticated = false;

    if (this.tcpMessenger) {
      this.tcpMessenger.close(reason);
    }

    this.onDisconnected.emit(reason);
  }

  private handleError(error: Error): void {
    console.error('Client room error:', error);
    this.onError.emit(error);
  }

  getClientPublicKey(): string {
    return this.clientKeyPair.publicKey;
  }

  getHostPublicKey(): string | undefined {
    return this.hostPublicKey;
  }

  isClientConnected(): boolean {
    return this.isConnected;
  }

  isClientAuthenticated(): boolean {
    return this.isAuthenticated;
  }

  getUserId(): UserId {
    return this.config.userId;
  }
}
