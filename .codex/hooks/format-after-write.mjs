import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { relative, resolve } from "node:path"

function readHookPayload() {
  const input = readFileSync(0, "utf8").trim()
  return input ? JSON.parse(input) : {}
}

function getPatchText(payload) {
  const toolInput = payload.tool_input ?? payload.toolInput ?? payload.input
  if (typeof toolInput === "string") return toolInput
  if (toolInput && typeof toolInput === "object") return toolInput.patch ?? toolInput.input ?? ""
  return ""
}

function getChangedFiles(patchText, projectRoot) {
  const paths = new Set()
  const fileHeaderPattern = /^\*\*\* (?:Add|Update|Move to) File: (.+)$/gm

  for (const match of patchText.matchAll(fileHeaderPattern)) {
    const rawPath = match[1]?.trim()
    if (!rawPath) continue

    const absolutePath = resolve(projectRoot, rawPath)
    const projectPath = relative(projectRoot, absolutePath)
    if (projectPath.startsWith("..") || projectPath === "" || !existsSync(absolutePath)) continue
    paths.add(projectPath)
  }

  return [...paths]
}

try {
  const payload = readHookPayload()
  const projectRoot = resolve(payload.cwd ?? process.env.CODEX_PROJECT_DIR ?? process.cwd())
  const changedFiles = getChangedFiles(getPatchText(payload), projectRoot)

  if (changedFiles.length === 0) process.exit(0)

  const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm"
  const result = spawnSync(pnpmCommand, ["exec", "prettier", "--write", "--ignore-unknown", ...changedFiles], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "ignore", "pipe"],
  })

  if (result.status !== 0) {
    process.stderr.write(result.stderr || "Prettier hook failed.\n")
    process.exit(1)
  }
} catch (error) {
  process.stderr.write(`Prettier hook failed: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
}
