// E2E 用の静的ファイルサーバー。nuxt generate の成果物（.output/public）を配信する。
// BASE_PATH を指定すると、そのサブパスの下で配信する（GitHub Pages と同じ形）
import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'

const root = join(process.cwd(), '.output/public')
const port = Number(process.env.PORT ?? 3100)
const basePath = process.env.BASE_PATH ?? '/'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

function resolveFile(urlPath) {
  const safe = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '')
  const candidate = join(root, safe)
  try {
    if (statSync(candidate).isDirectory()) return join(candidate, 'index.html')
    return candidate
  }
  catch {
    return null
  }
}

createServer((req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
  if (!pathname.startsWith(basePath)) {
    res.writeHead(404).end()
    return
  }
  const file = resolveFile('/' + pathname.slice(basePath.length))
  if (!file) {
    res.writeHead(404).end()
    return
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
  createReadStream(file).on('error', () => res.end()).pipe(res)
}).listen(port)
