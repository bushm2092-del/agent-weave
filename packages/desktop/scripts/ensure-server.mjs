import { spawn } from "node:child_process"

const healthUrl = "http://127.0.0.1:3001/health"

for (let attempt = 0; attempt < 10; attempt += 1) {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(500) })
    if (response.ok) {
      console.log(`Using existing AgentWeave server at ${healthUrl}`)
      setInterval(() => {}, 60_000)
      await new Promise(() => {})
    }
  } catch {
    if (attempt < 9) await new Promise((resolve) => setTimeout(resolve, 300))
  }
}

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm"
const server = spawn(pnpm, ["--filter", "@agent-weave/server", "dev"], {
  stdio: "inherit",
  env: process.env,
})

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.kill(signal))
}

process.exitCode = await new Promise((resolve) => {
  server.once("exit", (code) => resolve(code ?? 1))
  server.once("error", () => resolve(1))
})
