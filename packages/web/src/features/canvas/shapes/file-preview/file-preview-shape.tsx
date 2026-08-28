/* oxlint-disable react/only-export-components -- tldraw shape utility owns its renderer. */
import { BaseBoxShapeUtil, HTMLContainer, Rectangle2d, T, type TLBaseShape } from "tldraw"

export type FilePreviewShape = TLBaseShape<"file-preview", { w: number; h: number; name: string; mimeType: string; dataUrl: string }>

declare module "tldraw" { interface TLGlobalShapePropsMap { "file-preview": FilePreviewShape["props"] } }

export class FilePreviewShapeUtil extends BaseBoxShapeUtil<FilePreviewShape> {
  static override type = "file-preview" as const
  static override props = { w: T.nonZeroNumber, h: T.nonZeroNumber, name: T.string, mimeType: T.string, dataUrl: T.string }
  override getDefaultProps() { return { w: 360, h: 280, name: "File preview", mimeType: "text/plain", dataUrl: "" } }
  override getGeometry(shape: FilePreviewShape) { return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true }) }
  override component(shape: FilePreviewShape) {
    return <HTMLContainer style={{ width: shape.props.w, height: shape.props.h }}><FilePreviewContent shape={shape} /></HTMLContainer>
  }
  override getIndicatorPath(shape: FilePreviewShape) { const path = new Path2D(); path.roundRect(0, 0, shape.props.w, shape.props.h, 8); return path }
}

function FilePreviewContent({ shape }: { shape: FilePreviewShape }) {
  const isImage = shape.props.mimeType.startsWith("image/")
  return <div className="flex size-full flex-col overflow-hidden rounded-lg border bg-background shadow-sm"><header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b bg-muted/40 px-3"><strong className="truncate text-xs" title={shape.props.name}>{shape.props.name}</strong><span className="shrink-0 text-[10px] text-muted-foreground">{shape.props.mimeType || "file"}</span></header><div className="min-h-0 flex-1 overflow-auto p-2">{isImage ? <img className="mx-auto max-h-full max-w-full object-contain" src={shape.props.dataUrl} alt={shape.props.name} /> : <iframe className="size-full min-h-48 border-0" title={shape.props.name} src={shape.props.dataUrl} />}</div></div>
}
