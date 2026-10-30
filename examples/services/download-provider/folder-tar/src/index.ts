import express, { Request, Response } from 'express';
import type { ErrorRequestHandler } from 'express';
import path from 'path';
import fs from 'fs';
import tar from 'tar';

const PORT = process.env.PORT ?? '80';
const PIECES_DIR = process.env.PIECES_DIR ?? '/pieces';

const app = express();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively collect all files under a directory with their sizes. */
function collectFiles(dir: string, base: string = dir): Array<{ path: string; size: number }> {
  const results: Array<{ path: string; size: number }> = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, base));
    } else {
      const { size } = fs.statSync(full);
      results.push({ path: path.relative(base, full), size });
    }
  }
  return results;
}

/** Resolve the piece directory; returns null if it doesn't exist. */
function pieceDir(pieceType: string, pieceName: string): string | null {
  const dir = path.join(PIECES_DIR, pieceType, pieceName);
  try {
    if (fs.statSync(dir).isDirectory()) return dir;
  } catch {
    // not found
  }
  return null;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** Health check */
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

/** List all available piece types and pieces */
app.get('/pieces', (_req: Request, res: Response) => {
  try {
    const index: Record<string, Array<{ name: string, path: string }>> = {};
    for (const type of fs.readdirSync(PIECES_DIR, { withFileTypes: true })) {
      if (!type.isDirectory()) continue;
      const typeDir = path.join(PIECES_DIR, type.name);
      index[type.name] = fs.readdirSync(typeDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e =>({
          name: e.name,
          type: type.name,
          path: path.join(type.name, e.name),
        }));
    }
    res.json(index);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /pieces/:type/:name
 * Returns a JSON listing of all files in the piece folder with byte sizes.
 *
 * GET /pieces/:type/:name.tar
 * Streams an uncompressed tar archive of the entire piece folder.
 */
app.get('/pieces/:type/:nameWithExt', (req, res, next) => {
  try {
    const { type, nameWithExt } = req.params;

    const isTar = nameWithExt.endsWith('.tar');
    if(!isTar) return next();
    const name = nameWithExt.slice(0, -4);

    const dir = pieceDir(type, name);
    if (!dir) {
      throw new HTTPError(404, `Piece "${type}/${name}" not found`);
    }

    // Stream a plain (non-gzipped) tar of the piece folder
    res.setHeader('Content-Type', 'application/x-tar');
    res.setHeader('Content-Disposition', `attachment; filename="${name}.tar"`);

    tar.create({ gzip: false, cwd: dir }, ['.'])
      .on('error', (err: Error) => {
        if (!res.headersSent) {
          res.status(500).json({ error: err.message });
        }
      })
      .pipe(res);
  } catch (err) {
    next(err);
  }
});

app.get("/pieces/:type/:name", (req, res, next) => {

  // Return a JSON file listing with sizes
  try {
    const { type, name } = req.params;
    const dir = pieceDir(type, name);
    if (!dir) {
      throw new HTTPError(404, `Piece "${type}/${name}" not found`);
    }
    const files = collectFiles(dir);
    const totalSize = files.reduce((acc, f) => acc + f.size, 0);
    res.json({ piece: `${type}/${name}`, totalSize, files });
  } catch (err) {
    next(err);
  }
});

const errorHandler: ErrorRequestHandler = (err, req, res, next)=>{
  if(err instanceof HTTPError){
    res.status(err.status).json({ error: err.message });
    return;
  }
  if(err instanceof Error){
    res.status(500).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: String(err) });
}
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`Download provider listening on port ${PORT}`);
  console.log(`Serving pieces from: ${PIECES_DIR}`);
});


class HTTPError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.status = status;
  }
}
