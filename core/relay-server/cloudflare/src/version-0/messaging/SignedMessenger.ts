import { 
  SimpleMessenger, 
  JSON_Unknown, 
  createSimpleEmitter, 
  ISimpleEventEmitter 
} from '@match-lock/shared';
import { 
  SignedMessage, 
  signMessage, 
  verifySignedMessageComplete, 
  KeyPair,
  CryptoError 
} from '../crypto';

export interface SignedMessengerConfig {
  keyPair: KeyPair;
  trustedPublicKeys: Record<string, string>; // userId -> publicKey
  maxMessageAge?: number; // in milliseconds
}

export interface VerifiedMessage {
  data: JSON_Unknown;
  fromUserId: string;
  timestamp: number;
}

/**
 * A messenger that automatically signs outgoing messages and verifies incoming messages
 */
export class SignedMessenger implements SimpleMessenger {
  public onMessage: ISimpleEventEmitter<[message: JSON_Unknown]> = createSimpleEmitter();
  public onVerifiedMessage: ISimpleEventEmitter<[message: VerifiedMessage]> = createSimpleEmitter();
  public onInvalidMessage: ISimpleEventEmitter<[error: CryptoError, rawMessage: JSON_Unknown]> = createSimpleEmitter();

  private config: SignedMessengerConfig;

  constructor(
    private underlyingMessenger: SimpleMessenger,
    config: SignedMessengerConfig
  ) {
    this.config = config;
    this.setupMessageHandling();
  }

  private setupMessageHandling(): void {
    this.underlyingMessenger.onMessage((rawMessage) => {
      try {
        // Try to parse as signed message
        const signedMessage = this.parseSignedMessage(rawMessage);
        
        if (signedMessage) {
          this.handleSignedMessage(signedMessage, rawMessage);
        } else {
          // Pass through unsigned messages (for backward compatibility)
          this.onMessage.emit(rawMessage);
        }
      } catch (error) {
        const cryptoError = new CryptoError(
          'Failed to process incoming message',
          error instanceof Error ? error : new Error(String(error))
        );
        this.onInvalidMessage.emit(cryptoError, rawMessage);
      }
    });
  }

  private parseSignedMessage(rawMessage: JSON_Unknown): SignedMessage | null {
    if (
      typeof rawMessage === 'object' &&
      rawMessage !== null &&
      'data' in rawMessage &&
      'signature' in rawMessage &&
      'publicKey' in rawMessage &&
      'timestamp' in rawMessage
    ) {
      return rawMessage as unknown as SignedMessage;
    }
    return null;
  }

  private handleSignedMessage(signedMessage: SignedMessage, rawMessage: JSON_Unknown): void {
    // Find the user ID for this public key
    const fromUserId = this.findUserIdByPublicKey(signedMessage.publicKey);
    
    if (!fromUserId) {
      const error = new CryptoError('Message from unknown public key');
      this.onInvalidMessage.emit(error, rawMessage);
      return;
    }

    // Verify the signature
    const isValid = verifySignedMessageComplete(
      signedMessage,
      signedMessage.publicKey,
      this.config.maxMessageAge
    );

    if (!isValid) {
      const error = new CryptoError(`Invalid signature from user ${fromUserId}`);
      this.onInvalidMessage.emit(error, rawMessage);
      return;
    }

    // Emit verified message
    const verifiedMessage: VerifiedMessage = {
      data: signedMessage.data,
      fromUserId,
      timestamp: signedMessage.timestamp
    };

    this.onVerifiedMessage.emit(verifiedMessage);
    
    // Also emit on regular message channel for backward compatibility
    this.onMessage.emit(signedMessage.data);
  }

  private findUserIdByPublicKey(publicKey: string): string | null {
    for (const [userId, userPublicKey] of Object.entries(this.config.trustedPublicKeys)) {
      if (userPublicKey === publicKey) {
        return userId;
      }
    }
    return null;
  }

  async sendMessage(message: JSON_Unknown): Promise<boolean> {
    try {
      // Sign the message
      const signedMessage = signMessage(
        message,
        this.config.keyPair.privateKey,
        this.config.keyPair.publicKey
      );

      // Send the signed message through the underlying messenger
      return await this.underlyingMessenger.sendMessage(signedMessage as unknown as JSON_Unknown);
    } catch (error) {
      console.error('Failed to send signed message:', error);
      return false;
    }
  }

  async sendUnsignedMessage(message: JSON_Unknown): Promise<boolean> {
    // For cases where you need to send unsigned messages
    return await this.underlyingMessenger.sendMessage(message);
  }

  close(error?: string): void {
    this.underlyingMessenger.close(error);
  }

  async connect(): Promise<void> {
    return await this.underlyingMessenger.connect();
  }

  /**
   * Add a new trusted public key
   */
  addTrustedPublicKey(userId: string, publicKey: string): void {
    this.config.trustedPublicKeys[userId] = publicKey;
  }

  /**
   * Remove a trusted public key
   */
  removeTrustedPublicKey(userId: string): void {
    delete this.config.trustedPublicKeys[userId];
  }

  /**
   * Get all trusted user IDs
   */
  getTrustedUserIds(): string[] {
    return Object.keys(this.config.trustedPublicKeys);
  }

  /**
   * Check if a user is trusted
   */
  isUserTrusted(userId: string): boolean {
    return userId in this.config.trustedPublicKeys;
  }
}
