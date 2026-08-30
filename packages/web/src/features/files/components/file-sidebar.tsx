import { FolderTree, X } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { FileTree } from "@/features/files/components/file-tree"

export function FileSidebar({ workspace, open, onClose }: { workspace: string; open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <aside aria-hidden={!open} aria-label={t("files.sidebar")} className="file-sidebar" data-open={open}>
      <div className="file-sidebar__header">
        <FolderTree aria-hidden />
        <div>
          <strong>{t("files.title")}</strong>
          <span title={workspace}>{directoryName(workspace)}</span>
        </div>
        <Button aria-label={t("files.hide")} size="icon-sm" variant="ghost" onClick={onClose}>
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
