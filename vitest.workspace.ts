import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'plugins/untrusted/lua',
  'plugins/untrusted/ts',
  'plugins/download/protocol/http',
  'plugins/download/protocol/ftp',
  'plugins/download/protocol/torrent',
  'plugins/download/protocol/ipfs',
  'plugins/download/protocol/git',
  'core/plugin-runtime',
]);
