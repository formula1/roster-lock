#!/usr/bin/env node

import { runAllExamples } from './testing/examples';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'test':
      console.log('Running room tests...');
      await runAllExamples();
      break;
    
    case 'help':
    case '--help':
    case '-h':
      console.log(`
Match Lock Server CLI

Commands:
  test    Run all room examples and tests
  help    Show this help message

Examples:
  npm run cli test
  node dist/cli.js test
      `);
      break;
    
    default:
      console.log('Unknown command. Use "help" for available commands.');
      process.exit(1);
  }
}

main().catch((error) => {
  console.error('CLI error:', error);
  process.exit(1);
});
