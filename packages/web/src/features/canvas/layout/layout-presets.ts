import type { AgentLayoutPreset, LayoutItem, LayoutOptions, LayoutPlacement } from "./layout.types"

export const DEFAULT_AGENT_LAYOUT_GAP = 0

const byReadingOrder = (a: LayoutItem, b: LayoutItem) => a.y - b.y || a.x - b.x
const byHorizontalPosition = (a: LayoutItem, b: LayoutItem) => a.x - b.x || a.y - b.y
const byVerticalPosition = (a: LayoutItem, b: LayoutItem) => a.y - b.y || a.x - b.x

function getOrigin(items: LayoutItem[]) {
  return {
    x: Math.min(...items.map((item) => item.x)),
    y: Math.min(...items.map((item) => item.y)),
  }
}

function calculateGridLayout(items: LayoutItem[], gap: number): LayoutPlacement[] {
  const ordered = [...items].sort(byReadingOrder)
  const columns = ordered.length <= 3 ? ordered.length : Math.ceil(Math.sqrt(ordered.length))
  const origin = getOrigin(ordered)
  const w = Math.max(...ordered.map((item) => item.w))
  const h = Math.max(...ordered.map((item) => item.h))

  return ordered.map((item, index) => ({
    id: item.id,
    x: origin.x + (index % columns) * (w + gap),
    y: origin.y + Math.floor(index / columns) * (h + gap),
    w,
    h,
  }))
}

function calculateHorizontalLayout(items: LayoutItem[], gap: number): LayoutPlacement[] {
  const ordered = [...items].sort(byHorizontalPosition)
  const origin = getOrigin(ordered)
  const w = Math.max(...ordered.map((item) => item.w))
  const h = Math.max(...ordered.map((item) => item.h))
  let x = origin.x

  return ordered.map((item) => {
    const placement = { id: item.id, x, y: origin.y, w, h }
    x += w + gap
    return placement
  })
}

function calculateVerticalLayout(items: LayoutItem[], gap: number): LayoutPlacement[] {
  const ordered = [...items].sort(byVerticalPosition)
  const origin = getOrigin(ordered)
  const w = Math.max(...ordered.map((item) => item.w))
  const h = Math.max(...ordered.map((item) => item.h))
  let y = origin.y

  return ordered.map((item) => {
    const placement = { id: item.id, x: origin.x, y, w, h }
    y += h + gap
    return placement
  })
}

function calculatePrimaryLayout(items: LayoutItem[], gap: number, primaryId?: LayoutItem["id"]): LayoutPlacement[] {
  const ordered = [...items].sort(byReadingOrder)
  const primary = ordered.find((item) => item.id === primaryId) ?? ordered.at(-1)!
  const secondary = ordered.filter((item) => item.id !== primary.id)
  const origin = getOrigin(ordered)
  const w = Math.max(...ordered.map((item) => item.w))
  const h = Math.max(...ordered.map((item) => item.h))
  const primaryHeight = secondary.length * h + Math.max(0, secondary.length - 1) * gap
  const secondaryX = origin.x + w + gap
  let secondaryY = origin.y

  return [
    { id: primary.id, x: origin.x, y: origin.y, w, h: primaryHeight },
    ...secondary.map((item) => {
      const placement = { id: item.id, x: secondaryX, y: secondaryY, w, h }
      secondaryY += h + gap
      return placement
    }),
  ]
}

export function calculateAgentLayout(
  items: LayoutItem[],
  preset: AgentLayoutPreset,
  options: LayoutOptions = {},
): LayoutPlacement[] {
  if (items.length < 2) return items.map(({ id, x, y, w, h }) => ({ id, x, y, w, h }))

  const gap = options.gap ?? DEFAULT_AGENT_LAYOUT_GAP
  switch (preset) {
    case "grid":
      return calculateGridLayout(items, gap)
    case "horizontal":
      return calculateHorizontalLayout(items, gap)
    case "vertical":
      return calculateVerticalLayout(items, gap)
    case "primary":
      return calculatePrimaryLayout(items, gap, options.primaryId)
  }
}
