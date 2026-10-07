// Minimal static file server for the e2e scripts (no caching, correct MIME types for .js/.wasm).
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".wasm": "application/wasm", ".svg": "image/svg+xml" };

export function serve(dir, port) {
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(ok => server.listen(port, () => ok({ url: `http://localhost:${port}/`, close: () => server.close() })));
}
