# Match Lock Server - Host-Client Room System

This package provides a host-client room system for testing the piece-selection protocol with signed message communication over TCP.

## Features

- **Host-Client Architecture**: One user acts as a host (listens on a port), others connect as clients
- **Message Signing**: All users sign their messages before sending them out using RSA cryptography
- **Signature Verification**: Recipients can verify message authenticity and detect tampering
- **TCP Communication**: Direct TCP socket communication between host and clients
- **Room Management**: Handle user connections, message routing, and room lifecycle

## Core Components

### 1. Cryptographic Utilities (`src/crypto/`)
- RSA key pair generation
- Message signing with private keys
- Signature verification with public keys
- Tamper detection and security validation

### 2. TCP Networking (`src/networking/`)
- `TcpServer`: Creates TCP server for host rooms
- `TcpClient`: Connects to host servers
- `TcpMessenger`: Handles JSON message exchange over TCP

### 3. Signed Messaging (`src/messaging/`)
- `SignedMessenger`: Automatically signs outgoing messages and verifies incoming messages
- Trusted public key management
- Invalid message detection and handling

### 4. Host-Client Rooms (`src/HostClientRoom/`)
- `HostRoom`: Manages a room as the host, handles client connections
- `ClientRoom`: Connects to a host room and participates in communication
- Authentication and user management

### 5. Testing Utilities (`src/testing/`)
- `MockRoom`: Create test rooms with multiple users
- Example scenarios and integration tests
- Helper functions for testing

## Quick Start

### Running Tests

```bash
# Run the standalone test to verify all components work
npm run standalone-test
```

### Basic Usage Example

```typescript
import { generateKeyPair } from './crypto';
import { HostRoom, ClientRoom } from './HostClientRoom';

// Generate key pairs for users
const hostKeys = generateKeyPair();
const clientKeys = generateKeyPair();

// Create host room
const hostRoom = new HostRoom({
  roomId: 'test-room',
  restrictionConfig: mockRestrictionConfig,
  userPublicKeys: { 'client1': clientKeys.publicKey },
  hostKeyPair: hostKeys
});

// Start host
await hostRoom.start();
const address = hostRoom.getServerAddress();

// Create and connect client
const clientRoom = new ClientRoom({
  userId: 'client1',
  hostAddress: address.address,
  hostPort: address.port,
  hostPublicKey: hostKeys.publicKey,
  clientKeyPair: clientKeys
});

await clientRoom.connect();

// Send signed messages
await clientRoom.sendMessage({
  type: 'piece_selection',
  selection: { collection1: ['piece1', 'piece2'] }
});
```

## Architecture

The system follows a host-client model similar to Ikemen Go's direct TCP communication:

1. **Host Setup**: One user creates a `HostRoom` that listens on a TCP port
2. **Client Connection**: Other users create `ClientRoom` instances and connect to the host
3. **Authentication**: Clients authenticate using their signed messages and public keys
4. **Message Exchange**: All messages are automatically signed and verified
5. **Security**: The host can verify all client messages, but clients must trust the host

## Security Considerations

- **Host Trust**: Clients must trust the host not to lie about other users' signatures
- **Message Integrity**: All messages are cryptographically signed and verified
- **Replay Protection**: Messages include timestamps to prevent replay attacks
- **Key Management**: Public keys must be shared securely before room creation

## Testing

The system includes comprehensive tests:

- **Crypto Tests**: Key generation, signing, and verification
- **TCP Tests**: Basic socket communication
- **Signed Communication**: End-to-end signed message exchange
- **Integration Tests**: Full room scenarios with multiple users

Run tests with:
```bash
npm run standalone-test
```

## Future Enhancements

- Support for smart contract messaging (as mentioned in user preferences)
- Event listening capabilities for blockchain platforms
- Enhanced security with certificate authorities
- Room discovery and matchmaking services
- Protocol extensions for specific game mechanics

## Files Structure

```
src/
├── crypto/           # Cryptographic utilities
├── messaging/        # Signed messaging system
├── networking/       # TCP communication
├── HostClientRoom/   # Host-client room implementation
├── testing/          # Test utilities and examples
├── Room/            # Original room system (legacy)
└── standalone-test.ts # Comprehensive test suite
```

This system provides a solid foundation for implementing the piece-selection protocol with secure, signed communication between players.
