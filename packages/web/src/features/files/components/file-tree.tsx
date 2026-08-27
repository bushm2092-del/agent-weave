import type { FileEntry } from "@agent-weave/contracts"
import { ChevronRight, File, Folder, FolderOpen, Image, LoaderCircle, RotateCw } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { fileApi } from "@/features/files/api/file-api"
import { ApiClientError } from "@/lib/api"

type DirectoryState =
  | { status: "idle"; entries: FileEntry[]; error?: undefined }
  | { status: "loading"; entries: FileEntry[]; error?: undefined }
  | { status: "loaded"; entries: FileEntry[]; error?: undefined }
  | { status: "error"; entries: FileEntry[]; error: string }

export function FileTree({ rootPath }: { rootPath: string }) {
  const [state, setState] = useState<DirectoryState>({ status: "loading", entries: [] })
  const [selectedPath, setSelectedPath] = useState<string>()

  useEffect(() => {
    const controller = new AbortController()
    void loadDirectory(rootPath, controller.signal).then((nextState) => {
      if (!controller.signal.aborted) setState(nextState)
    })
    return () => controller.abort()
  }, [rootPath])

  if (state.status === "loading") {
    return (
      <div className="file-tree__status">
        <LoaderCircle className="animate-spin" />
        <span>Loading files...</span>
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <div className="file-tree__status file-tree__status--error">
        <span>{state.error}</span>
        <button type="button" aria-label="Retry directory" title="Retry" onClick={() => retryRoot(rootPath, setState)}>
          <RotateCw />
        </button>
      </div>
    )
  }

  if (state.entries.length === 0) {
    return <div className="file-tree__status">Empty directory</div>
  }

  return (
    <div aria-label="Workspace files" className="file-tree" role="tree">
      {state.entries.map((entry) => (
        <FileTreeNode depth={0} entry={entry} key={entry.path} selectedPath={selectedPath} onSelect={setSelectedPath} />
      ))}
    </div>
  )
}

function FileTreeNode({
  depth,
  entry,
  selectedPath,
  onSelect,
}: {
  depth: number
  entry: FileEntry
  selectedPath?: string
  onSelect: (path: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [state, setState] = useState<DirectoryState>({ status: "idle", entries: [] })
  const controllerRef = useRef<AbortController | null>(null)
  const isDirectory = entry.type === "directory"

  useEffect(() => () => controllerRef.current?.abort(), [])

  const toggle = () => {
    onSelect(entry.path)
    if (!isDirectory) return
    const nextExpanded = !expanded
    setExpanded(nextExpanded)
    if (!nextExpanded || (state.status !== "idle" && state.status !== "error")) return
    const controller = new AbortController()
    controllerRef.current = controller
    setState({ status: "loading", entries: [] })
    void loadDirectory(entry.path, controller.signal).then((nextState) => {
      if (!controller.signal.aborted) setState(nextState)
    })
  }

  return (
    <div role="none">
      <button
        aria-expanded={isDirectory ? expanded : undefined}
        className="file-tree__row"
        data-selected={selectedPath === entry.path}
        role="treeitem"
        style={{ paddingLeft: 8 + depth * 16 }}
        title={entry.path}
        type="button"
        onClick={toggle}
      >
        <ChevronRight aria-hidden className="file-tree__chevron" data-visible={isDirectory} data-expanded={expanded} />
        <EntryIcon entry={entry} expanded={expanded} />
        <span>{entry.name}</span>
      </button>
      {expanded && (
        <div role="group">
          {state.status === "loading" && (
            <div className="file-tree__nested-status" style={{ paddingLeft: 32 + depth * 16 }}>
              <LoaderCircle className="animate-spin" />
            </div>
          )}
          {state.status === "error" && (
            <button
              className="file-tree__nested-error"
              style={{ paddingLeft: 32 + depth * 16 }}
              title={state.error}
              type="button"
              onClick={() => retryNode(entry.path, setState, controllerRef)}
            >
              <RotateCw />
              Retry
            </button>
          )}
          {state.status === "loaded" && state.entries.length === 0 && (
            <div className="file-tree__nested-empty" style={{ paddingLeft: 32 + depth * 16 }}>
              Empty
            </div>
          )}
          {state.status === "loaded" &&
            state.entries.map((child) => (
              <FileTreeNode
                depth={depth + 1}
                entry={child}
                key={child.path}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            ))}
        </div>
      )}
    </div>
  )
}

function EntryIcon({ entry, expanded }: { entry: FileEntry; expanded: boolean }) {
  if (entry.type === "directory") return expanded ? <FolderOpen aria-hidden /> : <Folder aria-hidden />
  if (entry.previewType === "image") return <Image aria-hidden />
  return <File aria-hidden />
}

async function loadDirectory(path: string, signal: AbortSignal): Promise<DirectoryState> {
  try {
    const result = await fileApi.list(path, signal)
    return { status: "loaded", entries: result.entries }
  } catch (error) {
    if (signal.aborted) return { status: "loading", entries: [] }
    return {
      status: "error",
      entries: [],
      error: error instanceof ApiClientError ? error.message : "Unable to read this directory.",
    }
  }
}

function retryRoot(path: string, setState: (state: DirectoryState) => void) {
  const controller = new AbortController()
  setState({ status: "loading", entries: [] })
  void loadDirectory(path, controller.signal).then(setState)
}

function retryNode(
  path: string,
  setState: (state: DirectoryState) => void,
  controllerRef: { current: AbortController | null },
) {
  const controller = new AbortController()
  controllerRef.current = controller
  setState({ status: "loading", entries: [] })
  void loadDirectory(path, controller.signal).then(setState)
}
