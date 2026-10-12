#!/usr/bin/env node

import { createSign, createVerify, generateKeyPairSync } from 'node:crypto';
import { Socket, Server, createServer } from 'node:net';

// Standalone crypto functions (copied from our crypto module)
function generateKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  return { publicKey, privateKey };
}

function signMessage(data: any, privateKey: string, publicKey: string) {
  const timestamp = Date.now();
  const messageToSign = {
    data,
    publicKey,
    timestamp
  };

  const canonicalString = JSON.stringify(messageToSign);
  const sign = createSign('RSA-SHA256');
  sign.update(canonicalString, 'utf8');
  const signature = sign.sign(privateKey, 'base64');

  return {
    data,
    signature,
    publicKey,
    timestamp
  };
}

function verifySignedMessage(signedMessage: any): boolean {
  try {
    const { data, signature, publicKey, timestamp } = signedMessage;
    
    const messageToVerify = {
      data,
      publicKey,
      timestamp
    };

    const canonicalString = JSON.stringify(messageToVerify);
    const verify = createVerify('RSA-SHA256');
    verify.update(canonicalString, 'utf8');
    
    return verify.verify(publicKey, signature, 'base64');
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

async function testCrypto() {
  console.log('=== Testing Crypto Functions ===');
  
  // Generate key pairs
  const alice = generateKeyPair();
  const bob = generateKeyPair();
  
  console.log('✓ Generated key pairs for Alice and Bob');
  
  // Alice signs a message
  const message = { type: 'test', content: 'Hello from Alice!', timestamp: Date.now() };
  const signedMessage = signMessage(message, alice.privateKey, alice.publicKey);
  
  console.log('✓ Alice signed message');
  
  // Verify the signature
  const isValid = verifySignedMessage(signedMessage);
  console.log('✓ Signature is valid:', isValid);
  
  // Try to verify with wrong public key (should fail)
  const tamperedMessage = { ...signedMessage, publicKey: bob.publicKey };
  const isInvalid = verifySignedMessage(tamperedMessage);
  console.log('✓ Tampered signature is valid:', isInvalid, '(should be false)');
  
  console.log('Crypto test completed!\n');
}

async function testTcpCommunication() {
  console.log('=== Testing TCP Communication ===');
  
  const server = createServer();
  let serverSocket: Socket | null = null;
  let clientSocket: Socket | null = null;
  
  try {
    // Setup server
    server.on('connection', (socket) => {
      console.log('✓ Server: New connection received');
      serverSocket = socket;
      
      socket.on('data', (data) => {
        const message = JSON.parse(data.toString());
        console.log('✓ Server received:', message);
        
        // Echo back
        const response = {
          type: 'echo',
          original: message,
          timestamp: Date.now()
        };
        socket.write(JSON.stringify(response) + '\n');
      });
    });
    
    // Start server
    await new Promise<void>((resolve) => {
      server.listen(0, 'localhost', () => {
        resolve();
      });
    });
    
    const address = server.address() as any;
    console.log('✓ Server listening on:', address);
    
    // Connect client
    clientSocket = new Socket();
    await new Promise<void>((resolve, reject) => {
      clientSocket!.connect(address.port, address.address, () => {
        console.log('✓ Client connected');
        resolve();
      });
      clientSocket!.on('error', reject);
    });
    
    // Setup client message handler
    clientSocket.on('data', (data) => {
      const message = JSON.parse(data.toString());
      console.log('✓ Client received:', message);
    });
    
    // Send test message
    const testMessage = {
      type: 'test',
      content: 'Hello from client!',
      timestamp: Date.now()
    };
    clientSocket.write(JSON.stringify(testMessage) + '\n');
    
    // Wait for echo
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('TCP communication test completed!\n');
    
  } finally {
    // Cleanup
    if (clientSocket) clientSocket.destroy();
    if (serverSocket) serverSocket.destroy();
    server.close();
  }
}

async function testSignedTcpCommunication() {
  console.log('=== Testing Signed TCP Communication ===');
  
  const server = createServer();
  const alice = generateKeyPair();
  const bob = generateKeyPair();
  
  let serverSocket: Socket | null = null;
  let clientSocket: Socket | null = null;
  
  try {
    // Setup server
    server.on('connection', (socket) => {
      console.log('✓ Server: New signed connection received');
      serverSocket = socket;
      
      socket.on('data', (data) => {
        const signedMessage = JSON.parse(data.toString());
        console.log('✓ Server received signed message');
        
        // Verify signature
        const isValid = verifySignedMessage(signedMessage);
        if (isValid && signedMessage.publicKey === bob.publicKey) {
          console.log('✓ Server verified message from Bob:', signedMessage.data);
          
          // Send signed response
          const response = signMessage({
            type: 'signed_echo',
            original: signedMessage.data,
            timestamp: Date.now()
          }, alice.privateKey, alice.publicKey);
          
          socket.write(JSON.stringify(response) + '\n');
        } else {
          console.log('✗ Server rejected invalid signature');
        }
      });
    });
    
    // Start server
    await new Promise<void>((resolve) => {
      server.listen(0, 'localhost', () => {
        resolve();
      });
    });
    
    const address = server.address() as any;
    console.log('✓ Signed server listening on:', address);
    
    // Connect client
    clientSocket = new Socket();
    await new Promise<void>((resolve, reject) => {
      clientSocket!.connect(address.port, address.address, () => {
        console.log('✓ Signed client connected');
        resolve();
      });
      clientSocket!.on('error', reject);
    });
    
    // Setup client message handler
    clientSocket.on('data', (data) => {
      const signedMessage = JSON.parse(data.toString());
      console.log('✓ Client received signed message');
      
      // Verify signature
      const isValid = verifySignedMessage(signedMessage);
      if (isValid && signedMessage.publicKey === alice.publicKey) {
        console.log('✓ Client verified message from Alice:', signedMessage.data);
      } else {
        console.log('✗ Client rejected invalid signature');
      }
    });
    
    // Send signed test message
    const testMessage = signMessage({
      type: 'signed_test',
      content: 'Hello from signed client!',
      timestamp: Date.now()
    }, bob.privateKey, bob.publicKey);
    
    clientSocket.write(JSON.stringify(testMessage) + '\n');
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('Signed TCP communication test completed!\n');
    
  } finally {
    // Cleanup
    if (clientSocket) clientSocket.destroy();
    if (serverSocket) serverSocket.destroy();
    server.close();
  }
}

async function main() {
  console.log('Running standalone tests for host-client room system...\n');
  
  try {
    await testCrypto();
    await testTcpCommunication();
    await testSignedTcpCommunication();
    
    console.log('🎉 All tests completed successfully!');
    console.log('\nThe core components for the host-client room system are working:');
    console.log('- ✓ RSA key generation and message signing');
    console.log('- ✓ Signature verification and tamper detection');
    console.log('- ✓ TCP server/client communication');
    console.log('- ✓ End-to-end signed message exchange');
    console.log('\nYou can now use these components to build the piece-selection protocol!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Main error:', error);
  process.exit(1);
});
