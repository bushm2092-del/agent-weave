import { FolderTree, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FileTree } from "@/features/files/components/file-tree"

export function FileSidebar({ workspace, open, onClose }: { workspace: string; open: boolean; onClose: () => void }) {
  return (
    <aside aria-hidden={!open} aria-label="Agent workspace files" className="file-sidebar" data-open={open}>
      <div className="file-sidebar__header">
        <FolderTree aria-hidden />
        <div>
          <strong>Files</strong>
          <span title={workspace}>{directoryName(workspace)}</span>
        </div>
        <Button aria-label="Hide agent files" size="icon-sm" variant="ghost" onClick={onClose}>
          <X />
        </Button>
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
