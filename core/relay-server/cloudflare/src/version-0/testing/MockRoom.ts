import { 
  UserId, 
  MatchLockRestrictionConfig 
} from '@match-lock/shared';
import { HostRoom, HostRoomConfig, ClientRoom, ClientRoomConfig } from '../HostClientRoom';
import { generateKeyPair, KeyPair } from '../crypto';

export interface MockUser {
  userId: UserId;
  keyPair: KeyPair;
}

export interface MockRoomConfig {
  roomId: string;
  restrictionConfig: MatchLockRestrictionConfig;
  users: MockUser[];
  hostUserId?: UserId;
}

/**
 * Utility class for creating mock rooms for testing
 */
export class MockRoom {
  private config: MockRoomConfig;
  private hostRoom?: HostRoom;
  private clientRooms: Map<UserId, ClientRoom> = new Map();
  private hostUser: MockUser;

  constructor(config: MockRoomConfig) {
    this.config = config;
    
    // Determine host user
    if (config.hostUserId) {
      const hostUser = config.users.find(u => u.userId === config.hostUserId);
      if (!hostUser) {
        throw new Error(`Host user ${config.hostUserId} not found in users list`);
      }
      this.hostUser = hostUser;
    } else {
      // Use first user as host
      if (config.users.length === 0) {
        throw new Error('No users provided for mock room');
      }
      this.hostUser = config.users[0];
    }
  }

  /**
   * Create a host room with the configured users
   */
  async createHostRoom(): Promise<HostRoom> {
    const userPublicKeys: Record<UserId, string> = {};
    
    // Add all users except host to the public keys (host will be added separately)
    for (const user of this.config.users) {
      if (user.userId !== this.hostUser.userId) {
        userPublicKeys[user.userId] = user.keyPair.publicKey;
      }
    }

    const hostConfig: HostRoomConfig = {
      roomId: this.config.roomId,
      restrictionConfig: this.config.restrictionConfig,
      userPublicKeys,
      hostKeyPair: this.hostUser.keyPair,
      port: 0, // Random port
      host: 'localhost'
    };

    this.hostRoom = new HostRoom(hostConfig);
    await this.hostRoom.start();
    
    return this.hostRoom;
  }

  /**
   * Create client rooms for all non-host users
   */
  async createClientRooms(): Promise<Map<UserId, ClientRoom>> {
    if (!this.hostRoom) {
      throw new Error('Host room must be created first');
    }

    const hostAddress = this.hostRoom.getServerAddress();
    if (!hostAddress) {
      throw new Error('Host room address not available');
    }

    const clientUsers = this.config.users.filter(u => u.userId !== this.hostUser.userId);
    
    for (const user of clientUsers) {
      const clientConfig: ClientRoomConfig = {
        userId: user.userId,
        hostAddress: hostAddress.address,
        hostPort: hostAddress.port,
        hostPublicKey: this.hostUser.keyPair.publicKey,
        clientKeyPair: user.keyPair,
        connectionTimeout: 10000
      };

      const clientRoom = new ClientRoom(clientConfig);
      this.clientRooms.set(user.userId, clientRoom);
    }

    return this.clientRooms;
  }

  /**
   * Connect all client rooms to the host
   */
  async connectAllClients(): Promise<void> {
    const connectionPromises = Array.from(this.clientRooms.values()).map(client => 
      client.connect()
    );

    await Promise.all(connectionPromises);
  }

  /**
   * Wait for the room to be ready (all users connected)
   */
  async waitForRoomReady(): Promise<void> {
    if (!this.hostRoom) {
      throw new Error('Host room not created');
    }

    return new Promise((resolve) => {
      this.hostRoom!.onRoomReady(() => {
        resolve();
      });
    });
  }

  /**
   * Cleanup all rooms
   */
  async cleanup(): Promise<void> {
    // Disconnect all clients
    for (const clientRoom of this.clientRooms.values()) {
      clientRoom.disconnect('Test cleanup');
    }
    this.clientRooms.clear();

    // Stop host room
    if (this.hostRoom) {
      await this.hostRoom.stop();
      this.hostRoom = undefined;
    }
  }

  getHostRoom(): HostRoom | undefined {
    return this.hostRoom;
  }

  getClientRoom(userId: UserId): ClientRoom | undefined {
    return this.clientRooms.get(userId);
  }

  getAllClientRooms(): ClientRoom[] {
    return Array.from(this.clientRooms.values());
  }

  getHostUser(): MockUser {
    return this.hostUser;
  }

  getClientUsers(): MockUser[] {
    return this.config.users.filter(u => u.userId !== this.hostUser.userId);
  }

  getAllUsers(): MockUser[] {
    return this.config.users;
  }
}

/**
 * Create mock users with generated key pairs
 */
export function createMockUsers(userIds: UserId[]): MockUser[] {
  return userIds.map(userId => ({
    userId,
    keyPair: generateKeyPair()
  }));
}

/**
 * Create a simple mock restriction config for testing
 */
export function createMockRestrictionConfig(name: string = 'Test Restriction'): MatchLockRestrictionConfig {
  return {
    name,
    version: '1.0.0',
    published: new Date().toISOString(),
    sha256: 'mock-sha256-hash',
    signature: 'mock-signature',
    signatureVerificationUrl: 'https://example.com/verify',
    engine: {
      name: 'test-engine',
      version: '1.0.0',
      pieceDefinitions: {}
    },
    pieces: {}
  };
}
