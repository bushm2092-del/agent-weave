import { FolderTree } from "lucide-react"

import { FileTree } from "@/features/files/components/file-tree"

export function FileSidebar({ workspace }: { workspace: string }) {
  return (
    <aside aria-label="Agent workspace files" className="file-sidebar">
      <div className="file-sidebar__header">
        <FolderTree aria-hidden />
        <div>
          <strong>Files</strong>
          <span title={workspace}>{directoryName(workspace)}</span>
        </div>
      </div>
      <div className="file-sidebar__tree">
        <FileTree key={workspace} rootPath={workspace} />
      </div>
    </aside>
  )
}

function directoryName(path: string): string {
  const segments = path.replace(/[\\/]+$/, "").split(/[\\/]/)
  return segments.at(-1) || path
}
