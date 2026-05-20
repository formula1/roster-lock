// services/src/download/git.ts
import { ProtocolHandler } from "@roster-lock/types";

import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import { promises as fs } from 'node:fs';

export const download: ProtocolHandler["download"] = async function(
  url, folderDestination, { onProgress, abortSignal }
){
  if (abortSignal.aborted) {
    throw new GitError(url, 'Download aborted');
  }

  // Parse ref from URL (e.g., https://github.com/user/repo.git#branch)
  const [repoUrl, ref] = url.split('#');
  const urlObj = new URL(repoUrl);

  return {
    finishPromise: runGitDownload(urlObj, ref || 'main', folderDestination, onProgress),
    metaData: {
      url,
      ref: ref || 'main',
    },
  }
};

async function runGitDownload(
  repoUrl: URL, ref: string,
  folderDestination: string, 
  onProgress?: (progress: number, total?: number) => void,
) {
  try {
    // Shallow clone (depth=1, no history)
    await git.clone({
      fs,
      http,
      dir: folderDestination,
      url: repoUrl.href,
      ref: ref, // Default to main branch
      singleBranch: true,  // Only clone specified branch
      depth: 1,            // Shallow clone - no history!
      onProgress: (event) => {
        onProgress?.(event.loaded, event.total);
      },
      onAuth: () => {
        if (!repoUrl.username || !repoUrl.password) return;
        return { username: repoUrl.username, password: repoUrl.password };
      },
    });
  } catch (error) {
    throw new GitError(repoUrl.href, error);
  }

}




export class GitError extends Error {
  constructor(
    public url: string,
    public originalError: any
  ) {
    super(`Git error: ${originalError.message || originalError}`);
    this.name = 'GitError';
  }
}