import { MockRoom, createMockUsers, createMockRestrictionConfig } from './MockRoom';

/**
 * Example: Basic room setup and message exchange
 */
export async function basicRoomExample(): Promise<void> {
  console.log('=== Basic Room Example ===');
  
  // Create mock users
  const users = createMockUsers(['alice', 'bob', 'charlie']);
  console.log('Created users:', users.map(u => u.userId));

  // Create mock room
  const mockRoom = new MockRoom({
    roomId: 'test-room-1',
    restrictionConfig: createMockRestrictionConfig('Basic Test'),
    users,
    hostUserId: 'alice' // Alice will be the host
  });

  try {
    // Create and start host room
    console.log('Creating host room...');
    const hostRoom = await mockRoom.createHostRoom();
    console.log('Host room created, listening on:', hostRoom.getServerAddress());

    // Create client rooms
    console.log('Creating client rooms...');
    await mockRoom.createClientRooms();

    // Connect all clients
    console.log('Connecting clients...');
    await mockRoom.connectAllClients();

    // Wait for room to be ready
    console.log('Waiting for room to be ready...');
    await mockRoom.waitForRoomReady();
    console.log('Room is ready!');

    // Example message exchange
    console.log('Testing message exchange...');
    
    // Host sends a message to all clients
    hostRoom.broadcastMessage({
      type: 'test_message',
      content: 'Hello from host!',
      timestamp: Date.now()
    });

    // Client sends a message
    const bobClient = mockRoom.getClientRoom('bob');
    if (bobClient) {
      await bobClient.sendMessage({
        type: 'test_response',
        content: 'Hello from Bob!',
        timestamp: Date.now()
      });
    }

    // Wait a bit for messages to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Message exchange completed successfully!');

  } catch (error) {
    console.error('Error in basic room example:', error);
  } finally {
    // Cleanup
    console.log('Cleaning up...');
    await mockRoom.cleanup();
    console.log('Cleanup completed');
  }
}

/**
 * Example: Testing signature verification
 */
export async function signatureVerificationExample(): Promise<void> {
  console.log('=== Signature Verification Example ===');
  
  const users = createMockUsers(['host', 'client1', 'client2']);
  
  const mockRoom = new MockRoom({
    roomId: 'signature-test-room',
    restrictionConfig: createMockRestrictionConfig('Signature Test'),
    users,
    hostUserId: 'host'
  });

  try {
    const hostRoom = await mockRoom.createHostRoom();
    await mockRoom.createClientRooms();

    // Setup message listeners to verify signatures
    hostRoom.onUserMessage((fromUserId, message) => {
      console.log(`Host received verified message from ${fromUserId}:`, message);
    });

    const client1 = mockRoom.getClientRoom('client1');
    if (client1) {
      client1.onMessage((message) => {
        console.log('Client1 received verified message:', message);
      });
    }

    await mockRoom.connectAllClients();
    await mockRoom.waitForRoomReady();

    console.log('Testing signed message exchange...');

    // Send messages that will be automatically signed and verified
    if (client1) {
      await client1.sendMessage({
        type: 'piece_selection',
        selection: { collection1: ['piece1', 'piece2'] },
        timestamp: Date.now()
      });
    }

    const client2 = mockRoom.getClientRoom('client2');
    if (client2) {
      await client2.sendMessage({
        type: 'piece_selection',
        selection: { collection1: ['piece3', 'piece4'] },
        timestamp: Date.now()
      });
    }

    // Host broadcasts a signed message
    hostRoom.broadcastMessage({
      type: 'selection_confirmed',
      finalSelection: { collection1: ['piece1', 'piece2', 'piece3', 'piece4'] },
      timestamp: Date.now()
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Signature verification test completed!');

  } catch (error) {
    console.error('Error in signature verification example:', error);
  } finally {
    await mockRoom.cleanup();
  }
}

/**
 * Example: Error handling and disconnection
 */
export async function errorHandlingExample(): Promise<void> {
  console.log('=== Error Handling Example ===');
  
  const users = createMockUsers(['host', 'client1']);
  
  const mockRoom = new MockRoom({
    roomId: 'error-test-room',
    restrictionConfig: createMockRestrictionConfig('Error Test'),
    users,
    hostUserId: 'host'
  });

  try {
    const hostRoom = await mockRoom.createHostRoom();
    await mockRoom.createClientRooms();

    // Setup error handlers
    hostRoom.onError((error) => {
      console.log('Host room error:', error.message);
    });

    const client1 = mockRoom.getClientRoom('client1');
    if (client1) {
      client1.onError((error) => {
        console.log('Client1 error:', error.message);
      });

      client1.onDisconnected((reason) => {
        console.log('Client1 disconnected:', reason);
      });
    }

    await mockRoom.connectAllClients();
    await mockRoom.waitForRoomReady();

    console.log('Testing disconnection...');
    
    // Simulate client disconnection
    if (client1) {
      client1.disconnect('Simulated disconnection');
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Error handling test completed!');

  } catch (error) {
    console.error('Error in error handling example:', error);
  } finally {
    await mockRoom.cleanup();
  }
}

/**
 * Run all examples
 */
export async function runAllExamples(): Promise<void> {
  console.log('Running all room examples...\n');
  
  await basicRoomExample();
  console.log('\n');
  
  await signatureVerificationExample();
  console.log('\n');
  
  await errorHandlingExample();
  console.log('\n');
  
  console.log('All examples completed!');
}
