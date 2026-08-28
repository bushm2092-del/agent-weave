import { cjk } from "@streamdown/cjk"
import { createCodePlugin, type ThemeInput } from "@streamdown/code"
import { createMathPlugin } from "@streamdown/math"
import { mermaid } from "@streamdown/mermaid"
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  LoaderCircle,
  Maximize,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react"
import type { SVGProps } from "react"
import { Streamdown, type IconMap } from "streamdown"

const shikiThemes: [ThemeInput, ThemeInput] = ["one-light", "one-dark-pro"]
const markdownPlugins = {
  cjk,
  code: createCodePlugin({ themes: shikiThemes }),
  math: createMathPlugin({ singleDollarTextMath: true }),
  mermaid,
}

type StreamdownIconProps = SVGProps<SVGSVGElement> & { size?: number }

function createStreamdownIcon(Icon: LucideIcon) {
  return function StreamdownIcon({ className, size = 14, ...props }: StreamdownIconProps) {
    return (
      <Icon
        {...props}
        aria-hidden="true"
        className={`markdown-streamdown-icon ${className ?? ""}`}
        size={size}
        strokeWidth={1.5}
      />
    )
  }
}

const streamdownIcons = {
  CheckIcon: createStreamdownIcon(Check),
  CopyIcon: createStreamdownIcon(Copy),
  DownloadIcon: createStreamdownIcon(Download),
  ExternalLinkIcon: createStreamdownIcon(ExternalLink),
  Loader2Icon: createStreamdownIcon(LoaderCircle),
  Maximize2Icon: createStreamdownIcon(Maximize),
  RotateCcwIcon: createStreamdownIcon(RotateCcw),
  XIcon: createStreamdownIcon(X),
  ZoomInIcon: createStreamdownIcon(ZoomIn),
  ZoomOutIcon: createStreamdownIcon(ZoomOut),
} satisfies IconMap

export function MarkdownMessage({ children, streaming }: { children: string; streaming: boolean }) {
  return (
    <Streamdown
      className="markdown-render"
      codeBlockMaxHeight={320}
      controls={{
        code: { copy: true, download: false },
        mermaid: { copy: true, download: true, fullscreen: true, panZoom: true },
        table: { copy: true, download: false, fullscreen: true },
      }}
      dir="auto"
      icons={streamdownIcons}
      isAnimating={streaming}
      lineNumbers={false}
      linkSafety={{ enabled: true }}
      mermaid={{ config: { securityLevel: "strict", theme: "neutral" } }}
      mode={streaming ? "streaming" : "static"}
      parseIncompleteMarkdown
      plugins={markdownPlugins}
      shikiTheme={shikiThemes}
      skipHtml
      tableMaxHeight={320}
    >
      {children}
    </Streamdown>
  )
}
