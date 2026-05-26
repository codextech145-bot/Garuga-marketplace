import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const clientDir = path.resolve(__dirname, '..')
const repoRoot = path.resolve(clientDir, '..')

const HOST = '127.0.0.1'
const PORT = 5174

let deploying = false

const COMMANDS = {
  build: {
    label: 'Build client',
    steps: [`npm --prefix client run build`],
  },
  deployHosting: {
    label: 'Deploy Cloudflare Pages hosting',
    steps: [`cd client; npx wrangler pages deploy dist --project-name garuga-marketplace --branch main`],
  },
  publishAll: {
    label: 'Build and deploy Cloudflare Pages hosting',
    steps: [`npm --prefix client run deploy:cloudflare`],
  },
}

function runPowerShell(command) {
  return new Promise((resolve) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
      {
        cwd: repoRoot,
        env: process.env,
      }
    )

    let output = ''
    child.stdout.on('data', (d) => {
      const text = d.toString()
      output += text
      process.stdout.write(text)
    })
    child.stderr.on('data', (d) => {
      const text = d.toString()
      output += text
      process.stderr.write(text)
    })
    child.on('close', (code) => resolve({ code, output }))
  })
}

function setCors(res, origin) {
  const allowed = new Set(['http://localhost:5173', 'http://127.0.0.1:5173'])
  if (origin && allowed.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  } else if (origin) {
    return false
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
  return true
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 4096) {
        reject(new Error('Request body too large.'))
        req.destroy()
      }
    })
    req.on('end', () => {
      if (!body) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('Invalid JSON body.'))
      }
    })
    req.on('error', reject)
  })
}

function buildPowerShellCommand(commandId) {
  const command = COMMANDS[commandId]
  if (!command) return null

  return [
    "$ErrorActionPreference = 'Stop'",
    `Set-Location '${repoRoot.replace(/'/g, "''")}'`,
    ...command.steps,
  ].join('; ')
}

function streamShell(shell, command, res) {
  return new Promise((resolve) => {
    const useCmd = shell === 'cmd'
    const child = spawn(useCmd ? 'cmd.exe' : 'powershell.exe', useCmd ? ['/d', '/s', '/c', command] : [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      command,
    ], {
      cwd: repoRoot,
      env: process.env,
    })

    child.stdout.on('data', (d) => {
      const text = d.toString()
      process.stdout.write(text)
      res.write(text)
    })
    child.stderr.on('data', (d) => {
      const text = d.toString()
      process.stderr.write(text)
      res.write(text)
    })
    child.on('close', (code) => {
      res.write(`\n[process exited with code ${code}]\n`)
      resolve(code)
    })
    child.on('error', (error) => {
      res.write(`\n[process failed: ${error.message}]\n`)
      resolve(1)
    })
  })
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin
  if (!setCors(res, origin)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Blocked: local terminal only accepts localhost admin pages.')
    return
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: true, busy: deploying, commands: Object.keys(COMMANDS) }))
    return
  }

  const isDeployRoute = req.url === '/deploy' && req.method === 'POST'
  const isCommandRoute = req.url === '/run-command' && req.method === 'POST'
  const isTerminalRoute = req.url === '/terminal' && req.method === 'POST'

  if (!isDeployRoute && !isCommandRoute && !isTerminalRoute) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found')
    return
  }

  if (deploying) {
    res.writeHead(409, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Deploy already running.')
    return
  }

  deploying = true

  let commandId = 'publishAll'

  if (isTerminalRoute) {
    try {
      const body = await readJsonBody(req)
      const command = String(body.command || '').trim()
      const shell = body.shell === 'cmd' ? 'cmd' : 'powershell'
      if (!command) {
        deploying = false
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('Command is required.')
        return
      }

      if (command.length > 2000) {
        deploying = false
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('Command is too long.')
        return
      }

      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      res.write(`${shell === 'cmd' ? 'CMD' : 'PS'} ${repoRoot}> ${command}\n\n`)
      await streamShell(shell, command, res)
      res.end()
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(error.message)
    } finally {
      deploying = false
    }
    return
  }

  if (isCommandRoute) {
    try {
      const body = await readJsonBody(req)
      commandId = body.commandId || 'publishAll'
    } catch (error) {
      deploying = false
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(error.message)
      return
    }
  }

  const cmd = buildPowerShellCommand(commandId)
  if (!cmd) {
    deploying = false
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Unknown command.')
    return
  }

  const result = await runPowerShell(cmd)
  res.writeHead(result.code === 0 ? 200 : 500, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(result.output || (result.code === 0 ? 'Deploy completed.' : 'Deploy failed.'))

  deploying = false
})

server.listen(PORT, HOST, () => {
  console.log(`[admin-server] Listening on http://${HOST}:${PORT}`)
  console.log('[admin-server] POST /deploy to build + deploy Cloudflare Pages Hosting')
})
