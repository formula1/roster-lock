
type DownloadableSource = {
  protocol: string,
  validate: (url: string) => void, // throws on error
};
export const DOWNLOADABLE_SOURCE_PROTOCOLS: Record<string, DownloadableSource> = {};
// Utility function to validate any download source
export function getDownloadableSourceProtocol(url: string): string | undefined {
  for(const validator of Object.values(DOWNLOADABLE_SOURCE_PROTOCOLS)){
    try {
      validator.validate(url);
      return validator.protocol;
    }catch(e){
      continue;
    }
  }
}


// HTTPS Validator
DOWNLOADABLE_SOURCE_PROTOCOLS['https'] = {
  protocol: 'https',
  validate: (url: string) => {
    const parsed = new URL(url); // Will throw if invalid URL
    if (parsed.protocol !== 'https:') {
      throw new Error('Protocol must be https:');
    }
    if (!parsed.hostname) {
      throw new Error('Missing hostname');
    }
  }
};

// HTTP Validator
DOWNLOADABLE_SOURCE_PROTOCOLS['http'] ={
  protocol: 'http',
  validate: (url: string) => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:') {
      throw new Error('Protocol must be http:');
    }
    if (!parsed.hostname) {
      throw new Error('Missing hostname');
    }
  }
};

// FTPS Validator
DOWNLOADABLE_SOURCE_PROTOCOLS['ftps'] = {
  protocol: 'ftps',
  validate: (url: string) => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'ftps:') {
      throw new Error('Protocol must be ftps:');
    }
    if (!parsed.hostname) {
      throw new Error('Missing hostname');
    }
    // FTPS URLs should have a path
    if (!parsed.pathname || parsed.pathname === '/') {
      throw new Error('FTPS URL must include a file path');
    }
  }
};

// Magnet Validator
DOWNLOADABLE_SOURCE_PROTOCOLS['magnet'] = {
  protocol: 'magnet',
  validate: (url: string) => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'magnet:') {
      throw new Error('Protocol must be magnet:');
    }
    
    // Magnet links must have an xt (exact topic) parameter
    const xt = parsed.searchParams.get('xt');
    if (!xt) {
      throw new Error('Magnet link must include xt (exact topic) parameter');
    }
    
    // xt should be in format urn:btih:<hash>
    if (!xt.startsWith('urn:btih:')) {
      throw new Error('xt parameter must be in format urn:btih:<hash>');
    }
    
    const hash = xt.substring('urn:btih:'.length);
    // BitTorrent info hash should be 40 hex chars (SHA-1) or 64 hex chars (SHA-256)
    if (!/^[a-fA-F0-9]{40}$/.test(hash) && !/^[a-fA-F0-9]{64}$/.test(hash)) {
      throw new Error('Invalid BitTorrent info hash format');
    }
  }
};

// Git Validator
DOWNLOADABLE_SOURCE_PROTOCOLS['git'] ={
  protocol: 'git',
  validate: (url: string) => {
    // Git supports multiple URL formats:
    // - git://host.xz/path/to/repo.git
    // - https://host.xz/path/to/repo.git (already covered by https)
    // - git@host.xz:path/to/repo.git (SSH format)
    // - ssh://git@host.xz/path/to/repo.git
    
    // Check for SSH-style git URLs (git@...)
    const sshGitPattern = /^git@[\w\.-]+:[\w\-\/\.]+$/;
    if (sshGitPattern.test(url)) {
      return; // Valid
    }
    
    const parsed = (() => {
      try {
        return new URL(url);
      } catch (e) {
        throw new Error(`Invalid Git URL: ${(e as Error).message}`);
      }
    })();
    
    // Check for git:// protocol
    if (parsed.protocol !== 'git:') {
      throw new Error('Git URL must use git:// protocol');
    }
    if (!parsed.hostname) {
      throw new Error('Missing hostname');
    }
    if (!parsed.pathname || parsed.pathname === '/') {
      throw new Error('Git URL must include repository path');
    }
  }
};

// IPFS Validator
import { isCID } from 'cids'
DOWNLOADABLE_SOURCE_PROTOCOLS['ipfs'] = {
  protocol: 'ipfs',
  validate: (url: string) => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'ipfs:') {
      throw new Error('Protocol must be ipfs:');
    }
    
    // IPFS URLs are in format: ipfs://CID or ipfs://CID/path
    // The hostname is the CID (Content Identifier)
    const cid = parsed.hostname || parsed.pathname.split('/')[0];
    
    if (!cid) {
      throw new Error('IPFS URL must include a CID');
    }
    
    if(!isCID(cid)){
      throw new Error(`Invalid IPFS CID`);
    }
  }
};

