// serve.ts — a tiny static file server for play-testing CANYON RUN.
// Serves the repository directory on port 8080:
//   node serve.ts [--port 8080]
// Local play-testing only: it serves nothing outside this repository.
// Then open http://localhost:8080/game/ in desktop Chrome.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
let port = 8080;
const portFlag = args.indexOf('--port');
if (portFlag >= 0 && args[portFlag + 1]) port = Number(args[portFlag + 1]);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent((req.url || '/').split('?')[0]);
    if (path.endsWith('/')) path += 'index.html';
    const file = resolve(join(repoRoot, path));
    if (!file.startsWith(repoRoot) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('error');
  }
});

server.listen(port, () => {
  console.log(`CANYON RUN at http://localhost:${port}/game/`);
});
