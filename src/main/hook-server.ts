import { createServer, IncomingMessage, ServerResponse, Server } from 'http'
import { SessionStore } from './session-store'

export class HookServer {
  private server: Server | null = null

  constructor(
    private port: number,
    private store: SessionStore,
    private onUpdate: () => void,
  ) {}

  start() {
    this.server = createServer((req, res) => this.handleRequest(req, res))
    this.server.listen(this.port, 'localhost', () => {
      console.log(`Hook server listening on localhost:${this.port}`)
    })
  }

  stop() {
    this.server?.close()
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse) {
    if (req.method === 'POST' && req.url === '/hook') {
      let body = ''
      req.on('data', (chunk) => (body += chunk))
      req.on('end', () => {
        try {
          const data = JSON.parse(body)
          this.store.updateFromHook(data)
          this.onUpdate()
          res.writeHead(200)
          res.end('ok')
        } catch {
          res.writeHead(400)
          res.end('bad request')
        }
      })
    } else {
      res.writeHead(404)
      res.end('not found')
    }
  }
}
