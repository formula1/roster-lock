import { resolve as pathResolve, relative as pathRelative, isAbsolute } from "node:path";
import { HTTPError } from "../../utils/http-router";

// Resolves `requestedPath` (defaulting to `root` itself when omitted) and
// verifies it's actually inside `root` - rejects anything that escapes it
// (a "../" climb, or an unrelated absolute path entirely) with 403, rather
// than letting a client list/read anything else match-agent's host
// filesystem happens to have. This is the actual fix for the exposure a
// bare "list any path, read any file" API would otherwise be: the native
// OS dialog this feature replaces could only ever hand back one path
// picked through a trusted OS UI, never enumerate a filesystem
// programmatically - a bounded root is what restores an equivalent limit
// to an HTTP API that has no such built-in ceiling on its own.
export function resolveWithinRoot(root: string, requestedPath: string | null): string {
  const resolvedRoot = pathResolve(root);
  if (!requestedPath) return resolvedRoot;

  const resolvedPath = pathResolve(requestedPath);
  const rel = pathRelative(resolvedRoot, resolvedPath);
  const isInside = rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  if (!isInside) {
    throw new HTTPError(403, `${requestedPath} is outside the configured roster-lock folder`);
  }
  return resolvedPath;
}
