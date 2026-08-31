import { execFile } from "node:child_process"
import { existsSync, statSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { promisify } from "node:util"
import { app, BrowserWindow, dialog, net, protocol, shell } from "electron"
import type { AgentWeaveServer } from "@agent-weave/server/embedded"
import { startupFailureCopy } from "./startup-copy.js"

const APP_SCHEME = "agent-weave"
const APP_ORIGIN = `${APP_SCHEME}://app`
const SHELL_PATH_MARKER = "__AGENT_WEAVE_PATH__="
const execFileAsync = promisify(execFile)
let apiOrigin = process.env.AGENT_WEAVE_API_ORIGIN?.trim() || "http://127.0.0.1:3001"
let embeddedServer: AgentWeaveServer | undefined

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      codeCache: true,
    },
  },
])

function webRoot(): string {
  return app.isPackaged ? path.join(process.resourcesPath, "web") : path.resolve(import.meta.dirname, "../../web/dist")
}

function resolveWebAsset(pathname: string): string {
  const root = webRoot()
  const requestedPath = decodeURIComponent(pathname).replace(/^\/+/, "")
  const candidate = path.resolve(root, requestedPath || "index.html")
  const relativePath = path.relative(root, candidate)

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return path.join(root, "index.html")
  }
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  return path.extname(candidate) ? candidate : path.join(root, "index.html")
}

async function handleAppRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  if (url.hostname !== "app") return new Response("Not found", { status: 404 })

  if (url.pathname.startsWith("/api/")) {
    const target = new URL(`${url.pathname}${url.search}`, apiOrigin)
    return net.fetch(new Request(target, request))
  }

  const assetPath = resolveWebAsset(url.pathname)
  if (!existsSync(assetPath)) return new Response("Not found", { status: 404 })
  return net.fetch(pathToFileURL(assetPath).toString())
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    title: "AgentWeave",
    backgroundColor: "#fafafa",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) void shell.openExternal(url)
    return { action: "deny" }
  })
  window.webContents.on("will-navigate", (event, url) => {
    const allowedOrigin = process.env.ELECTRON_RENDERER_URL || APP_ORIGIN
    if (!url.startsWith(allowedOrigin)) event.preventDefault()
  })

  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  void window.loadURL(rendererUrl || `${APP_ORIGIN}/`)
  return window
}

async function startEmbeddedServer(): Promise<void> {
  if (!app.isPackaged || process.env.AGENT_WEAVE_API_ORIGIN?.trim()) return

  const dataDirectory = app.getPath("userData")
  process.env.ACPX_CLAUDE_INCLUDE_USER_SETTINGS ??= "1"
  process.env.NODE_ENV = "production"
  process.env.HOST = "127.0.0.1"
  process.env.PORT = "0"
  process.env.CORS_ORIGINS = APP_ORIGIN
  process.env.DATABASE_PATH = path.join(dataDirectory, "agent-weave.db")
  process.env.ACPX_STATE_DIR = path.join(dataDirectory, "acpx")

  const { startAgentWeaveServer } = await import("@agent-weave/server/embedded")
  embeddedServer = await startAgentWeaveServer()
  apiOrigin = embeddedServer.origin
}

async function hydrateShellPath(): Promise<void> {
  if (!app.isPackaged || process.platform === "win32") return

  const userShell = process.env.SHELL?.trim() || (process.platform === "darwin" ? "/bin/zsh" : "/bin/sh")
  try {
    const { stdout } = await execFileAsync(userShell, ["-ilc", `printf '${SHELL_PATH_MARKER}%s\\n' "$PATH"`], {
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    })
    const markerIndex = stdout.lastIndexOf(SHELL_PATH_MARKER)
    if (markerIndex < 0) throw new Error("The login shell did not return PATH.")

    const shellPath = stdout
      .slice(markerIndex + SHELL_PATH_MARKER.length)
      .split(/\r?\n/, 1)[0]
      ?.trim()
    if (!shellPath) throw new Error("The login shell returned an empty PATH.")
    process.env.PATH = mergePath(shellPath, process.env.PATH)
  } catch (error) {
    console.warn("Unable to load PATH from the user login shell.", error)
  }
}

function mergePath(primary: string, fallback: string | undefined): string {
  return [...new Set(`${primary}${path.delimiter}${fallback ?? ""}`.split(path.delimiter).filter(Boolean))].join(
    path.delimiter,
  )
}

app
  .whenReady()
  .then(async () => {
    await hydrateShellPath()
    await startEmbeddedServer()
    await protocol.handle(APP_SCHEME, handleAppRequest)
    createWindow()

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
  .catch((error: unknown) => {
    const copy = startupFailureCopy(app.getLocale())
    const diagnostics = error instanceof Error ? error.stack || error.message : String(error)
    dialog.showErrorBox(copy.title, `${copy.messagePrefix}${diagnostics}`)
    app.quit()
  })

app.on("before-quit", () => {
  if (embeddedServer) void embeddedServer.close()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
