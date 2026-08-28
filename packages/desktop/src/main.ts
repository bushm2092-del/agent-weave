import { existsSync, statSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { app, BrowserWindow, net, protocol, shell } from "electron"

const APP_SCHEME = "agent-weave"
const APP_ORIGIN = `${APP_SCHEME}://app`
const API_ORIGIN = process.env.AGENT_WEAVE_API_ORIGIN?.trim() || "http://127.0.0.1:3001"

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
  return app.isPackaged
    ? path.join(process.resourcesPath, "web")
    : path.resolve(import.meta.dirname, "../../web/dist")
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
    const target = new URL(`${url.pathname}${url.search}`, API_ORIGIN)
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

app.whenReady().then(async () => {
  await protocol.handle(APP_SCHEME, handleAppRequest)
  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
