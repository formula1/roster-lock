import { invoke } from '@tauri-apps/api/core';

// Console bridge - forward console messages to Rust terminal
export const bridgeConsoleToRust = () => {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;

  console.log = (...args: any[]) => {
    originalLog(...args);
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    invoke('console_log', { level: 'log', message }).catch(() => {});
  };

  console.warn = (...args: any[]) => {
    originalWarn(...args);
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    invoke('console_log', { level: 'warn', message }).catch(() => {});
  };

  console.error = (...args: any[]) => {
    originalError(...args);
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    invoke('console_log', { level: 'error', message }).catch(() => {});
  };

  console.info = (...args: any[]) => {
    originalInfo(...args);
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    invoke('console_log', { level: 'info', message }).catch(() => {});
  };
};
