import type { Dirent } from "node:fs"
import { lstat, open, readdir, stat } from "node:fs/promises"
import { basename, isAbsolute, join, resolve } from "node:path"
import type { DirectoryListing, FileEntry, TextFile } from "@agent-weave/contracts"
import { imageMediaType, previewType, textMediaType } from "./content-type.js"
import { FileApiError } from "./file.errors.js"

const maxTextFileBytes = 2 * 1024 * 1024
const maxImageFileBytes = 20 * 1024 * 1024
const imageHeaderBytes = 32
const entryCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" })

export type RawImage = {
  file: Awaited<ReturnType<typeof open>>
  name: string
  mediaType: string
  size: number
  modifiedAt: Date
  etag: string
}

export class FileService {
  async list(inputPath: string): Promise<DirectoryListing> {
    const path = absolutePath(inputPath)
    const directoryStat = await fileStat(path)
    if (!directoryStat.isDirectory()) {
      throw new FileApiError("PATH_NOT_DIRECTORY", "The requested path is not a directory.", 400)
    }

    let directoryEntries: Dirent[]
    try {
      directoryEntries = await readdir(path, { withFileTypes: true })
    } catch (error) {
      throw mapFileSystemError(error)
    }

    const entries = await Promise.all(
      directoryEntries.map(async (directoryEntry): Promise<FileEntry> => {
        const entryPath = join(path, directoryEntry.name)
        const entryStat = await entryFileStat(entryPath)
        const type = directoryEntry.isDirectory() ? "directory" : directoryEntry.isFile() ? "file" : "symlink"
        const entryPreviewType = type === "file" ? previewType(entryPath) : "unsupported"
        return {
          name: directoryEntry.name,
          path: entryPath,
          type,
          ...(type === "file" ? { size: entryStat.size } : {}),
          ...(type === "file" && entryPreviewType !== "unsupported"
            ? { mimeType: entryPreviewType === "image" ? imageTypeFromExtension(entryPath) : textMediaType(entryPath) }
            : {}),
          previewType: entryPreviewType,
          modifiedAt: entryStat.mtime.toISOString(),
        }
      }),
    )

    entries.sort((left, right) => {
      const typeOrder = entryTypeOrder(left.type) - entryTypeOrder(right.type)
      return typeOrder || entryCollator.compare(left.name, right.name)
    })
    return { path, entries }
  }

  async read(inputPath: string): Promise<TextFile> {
    const path = absolutePath(inputPath)
    const initialStat = await fileStat(path)
    assertRegularFile(initialStat.isFile())
    if (initialStat.size > maxTextFileBytes) {
      throw new FileApiError("FILE_TOO_LARGE", "Text files must be 2 MiB or smaller.", 413)
    }
    const file = await openFile(path)
    try {
      const fileStat = await file.stat()
      assertRegularFile(fileStat.isFile())
      if (fileStat.size > maxTextFileBytes) {
        throw new FileApiError("FILE_TOO_LARGE", "Text files must be 2 MiB or smaller.", 413)
      }
      const buffer = await file.readFile()
      if (buffer.length > maxTextFileBytes) {
        throw new FileApiError("FILE_TOO_LARGE", "Text files must be 2 MiB or smaller.", 413)
      }
      if (buffer.includes(0)) {
        throw new FileApiError("UNSUPPORTED_FILE_TYPE", "The requested file is not UTF-8 text.", 415)
      }
      let content: string
      try {
        content = new TextDecoder("utf-8", { fatal: true }).decode(buffer)
      } catch {
        throw new FileApiError("UNSUPPORTED_FILE_TYPE", "The requested file is not UTF-8 text.", 415)
      }
      return {
        path,
        name: basename(path),
        content,
        encoding: "utf-8",
        mimeType: textMediaType(path),
        size: buffer.length,
        modifiedAt: fileStat.mtime.toISOString(),
      }
    } finally {
      await file.close()
    }
  }

  async openRawImage(inputPath: string): Promise<RawImage> {
    const path = absolutePath(inputPath)
    const initialStat = await fileStat(path)
    assertRegularFile(initialStat.isFile())
    if (initialStat.size > maxImageFileBytes) {
      throw new FileApiError("FILE_TOO_LARGE", "Images must be 20 MiB or smaller.", 413)
    }
    const file = await openFile(path)
    try {
      const fileStat = await file.stat()
      assertRegularFile(fileStat.isFile())
      if (fileStat.size > maxImageFileBytes) {
        throw new FileApiError("FILE_TOO_LARGE", "Images must be 20 MiB or smaller.", 413)
      }
      const header = Buffer.alloc(Math.min(imageHeaderBytes, fileStat.size))
      if (header.length > 0) await file.read(header, 0, header.length, 0)
      const mediaType = imageMediaType(header)
      if (!mediaType) {
        throw new FileApiError("UNSUPPORTED_FILE_TYPE", "The requested file is not a supported image.", 415)
      }
      return {
        file,
        name: basename(path),
        mediaType,
        size: fileStat.size,
        modifiedAt: fileStat.mtime,
        etag: `W/"${fileStat.size.toString(16)}-${Math.trunc(fileStat.mtimeMs).toString(16)}"`,
      }
    } catch (error) {
      await file.close()
      throw error
    }
  }
}

function absolutePath(inputPath: string): string {
  if (!isAbsolute(inputPath)) {
    throw new FileApiError("FILE_PATH_NOT_ABSOLUTE", "The file path must be absolute.", 400)
  }
  return resolve(inputPath)
}

async function fileStat(path: string) {
  try {
    return await stat(path)
  } catch (error) {
    throw mapFileSystemError(error)
  }
}

async function entryFileStat(path: string) {
  try {
    return await lstat(path)
  } catch (error) {
    throw mapFileSystemError(error)
  }
}

async function openFile(path: string) {
  try {
    return await open(path, "r")
  } catch (error) {
    throw mapFileSystemError(error)
  }
}

function assertRegularFile(isFile: boolean): void {
  if (!isFile) throw new FileApiError("PATH_NOT_FILE", "The requested path is not a file.", 400)
}

function mapFileSystemError(error: unknown): FileApiError {
  const code = fileSystemErrorCode(error)
  if (code === "ENOENT" || code === "ENOTDIR") {
    return new FileApiError("FILE_NOT_FOUND", "The requested path does not exist.", 404)
  }
  if (code === "EACCES" || code === "EPERM") {
    return new FileApiError("FILE_NOT_READABLE", "The requested path is not readable.", 403)
  }
  return new FileApiError("FILE_READ_FAILED", "The requested path could not be read.", 500)
}

function fileSystemErrorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error ? String(error.code) : undefined
}

function entryTypeOrder(type: FileEntry["type"]): number {
  if (type === "directory") return 0
  if (type === "file") return 1
  return 2
}

function imageTypeFromExtension(path: string): string {
  const extension = path.toLowerCase()
  if (extension.endsWith(".png")) return "image/png"
  if (extension.endsWith(".jpg") || extension.endsWith(".jpeg")) return "image/jpeg"
  if (extension.endsWith(".gif")) return "image/gif"
  if (extension.endsWith(".webp")) return "image/webp"
  if (extension.endsWith(".avif")) return "image/avif"
  if (extension.endsWith(".bmp")) return "image/bmp"
  return "image/x-icon"
}

export const fileService = new FileService()
