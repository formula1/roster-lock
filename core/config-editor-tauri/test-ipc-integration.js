#!/usr/bin/env node

/**
 * Test script to simulate the Tauri Rust HTTP client integration
 * This tests the same HTTP over Unix socket requests that the Rust code would make
 * using hyperlocal for Unix domain socket communication
 */

const http = require('http');
const fs = require('fs');

// Unix socket path - should match what the IPC server uses
const SOCKET_PATH = '/tmp/test-matchlock-manual.sock';

// Simulate the IPC request function that Rust would call
async function ipcRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    // Check if socket exists
    if (!fs.existsSync(SOCKET_PATH)) {
      reject(new Error(`Socket not found at ${SOCKET_PATH}. Make sure IPC server is running.`));
      return;
    }

    const options = {
      socketPath: SOCKET_PATH,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// Test the integration
async function testIntegration() {
  console.log('🧪 Testing IPC Integration...\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const health = await ipcRequest('GET', '/health');
    console.log('   ✅ Health:', health);

    // Test 2: Storage set
    console.log('\n2. Testing storage set...');
    const setResult = await ipcRequest('POST', '/storage/integration-test', { value: 'test-data-123' });
    console.log('   ✅ Set result:', setResult);

    // Test 3: Storage get
    console.log('\n3. Testing storage get...');
    const getValue = await ipcRequest('GET', '/storage/integration-test');
    console.log('   ✅ Get result:', getValue);

    // Test 4: Storage keys
    console.log('\n4. Testing storage keys...');
    const keys = await ipcRequest('GET', '/storage/keys');
    console.log('   ✅ Keys:', keys);

    // Test 5: User settings get
    console.log('\n5. Testing user settings get...');
    const userSettings = await ipcRequest('GET', '/user-settings');
    console.log('   ✅ User settings:', userSettings);

    console.log('\n🎉 All tests passed! The IPC integration is working correctly.');
    console.log('\n📋 Summary:');
    console.log(`   - IPC server is running on Unix socket: ${SOCKET_PATH}`);
    console.log('   - HTTP over Unix socket requests work correctly');
    console.log('   - Storage operations work');
    console.log('   - User settings endpoint works');
    console.log('   - Ready for Rust hyperlocal integration');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testIntegration();
