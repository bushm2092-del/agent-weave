import type { Server } from "node:http"
import { app } from "./app.js"
import { environment } from "./config/index.js"
import { conversationService } from "./features/conversations/index.js"
import { teamService } from "./features/teams/index.js"

export type AgentWeaveServer = {
  origin: string
  close(): Promise<void>
}

export async function startAgentWeaveServer(): Promise<AgentWeaveServer> {
  await teamService.prepareRestore()
  await conversationService.restoreAll()

  const server = await listen()
  const address = server.address()
  if (!address || typeof address === "string") {
    await closeServer(server)
    throw new Error("AgentWeave server did not expose a TCP address.")
  }

  environment.port = address.port
  await teamService.restoreAll()

  const host = environment.host === "0.0.0.0" || environment.host === "::" ? "127.0.0.1" : environment.host
  return {
    origin: `http://${host}:${address.port}`,
    close: () => closeServer(server),
  }
}

function listen(): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(environment.port, environment.host)
    server.once("listening", () => resolve(server))
    server.once("error", reject)
  })
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}
