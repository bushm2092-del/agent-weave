import { app } from "./app.js"
import { environment } from "./config/index.js"

const server = app.listen(environment.port, environment.host, () => {
  console.log(`AgentWeave server listening at http://${environment.host}:${environment.port}`)
})

function shutdown(signal: string): void {
  server.close((error) => {
    if (error) {
      console.error("Failed to stop the HTTP server cleanly", error)
      process.exitCode = 1
    }
    process.exit()
  })
  setTimeout(() => {
    console.error(`Forced shutdown after ${signal}`)
    process.exit(1)
  }, 10_000).unref()
}

process.once("SIGINT", () => shutdown("SIGINT"))
process.once("SIGTERM", () => shutdown("SIGTERM"))
