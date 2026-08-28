import { startAgentWeaveServer } from "./embedded.js"

const server = await startAgentWeaveServer()
console.log(`AgentWeave server listening at ${server.origin}`)

function shutdown(signal: string): void {
  void server
    .close()
    .catch((error: unknown) => {
      console.error("Failed to stop the HTTP server cleanly", error)
      process.exitCode = 1
    })
    .finally(() => process.exit())
  setTimeout(() => {
    console.error(`Forced shutdown after ${signal}`)
    process.exit(1)
  }, 10_000).unref()
}

process.once("SIGINT", () => shutdown("SIGINT"))
process.once("SIGTERM", () => shutdown("SIGTERM"))
