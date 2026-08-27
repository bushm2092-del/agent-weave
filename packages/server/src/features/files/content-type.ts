import { extname } from "node:path"
import type { FilePreviewType } from "@agent-weave/contracts"

const textMediaTypes = new Map<string, string>([
  [".c", "text/x-c"],
  [".cc", "text/x-c++"],
  [".conf", "text/plain"],
  [".cpp", "text/x-c++"],
  [".css", "text/css"],
  [".csv", "text/csv"],
  [".env", "text/plain"],
  [".go", "text/x-go"],
  [".h", "text/x-c"],
  [".hpp", "text/x-c++"],
  [".html", "text/html"],
  [".java", "text/x-java-source"],
  [".js", "text/javascript"],
  [".json", "application/json"],
  [".jsx", "text/jsx"],
  [".log", "text/plain"],
  [".md", "text/markdown"],
  [".mjs", "text/javascript"],
  [".py", "text/x-python"],
  [".rb", "text/x-ruby"],
  [".rs", "text/x-rust"],
  [".sh", "text/x-shellscript"],
  [".sql", "application/sql"],
  [".svg", "image/svg+xml"],
  [".toml", "application/toml"],
  [".ts", "text/typescript"],
  [".tsx", "text/tsx"],
  [".txt", "text/plain"],
  [".xml", "application/xml"],
  [".yaml", "application/yaml"],
  [".yml", "application/yaml"],
  [".zsh", "text/x-shellscript"],
])

const imageExtensions = new Set([".avif", ".bmp", ".gif", ".ico", ".jpeg", ".jpg", ".png", ".webp"])

export function previewType(path: string): FilePreviewType {
  const extension = extname(path).toLowerCase()
  if (imageExtensions.has(extension)) return "image"
  if (textMediaTypes.has(extension) || extension === "") return "text"
  return "unsupported"
}

export function textMediaType(path: string): string {
  return textMediaTypes.get(extname(path).toLowerCase()) ?? "text/plain"
}

export function imageMediaType(header: Buffer): string | undefined {
  if (header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png"
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return "image/jpeg"
  if (header.subarray(0, 6).toString("ascii") === "GIF87a" || header.subarray(0, 6).toString("ascii") === "GIF89a") {
    return "image/gif"
  }
  if (header.subarray(0, 4).toString("ascii") === "RIFF" && header.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp"
  }
  if (header.subarray(0, 2).toString("ascii") === "BM") return "image/bmp"
  if (header[0] === 0x00 && header[1] === 0x00 && header[2] === 0x01 && header[3] === 0x00) return "image/x-icon"
  if (header.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = header.subarray(8, 12).toString("ascii")
    if (brand === "avif" || brand === "avis") return "image/avif"
  }
  return undefined
}
