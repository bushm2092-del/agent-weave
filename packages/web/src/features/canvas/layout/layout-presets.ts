import type { AgentLayoutPreset, LayoutItem, LayoutOptions, LayoutPlacement } from "./layout.types"

export const DEFAULT_AGENT_LAYOUT_GAP = 48

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
  const rows = Math.ceil(ordered.length / columns)
  const columnWidths = Array.from({ length: columns }, () => 0)
  const rowHeights = Array.from({ length: rows }, () => 0)

  ordered.forEach((item, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    columnWidths[column] = Math.max(columnWidths[column], item.w)
    rowHeights[row] = Math.max(rowHeights[row], item.h)
  })

  const origin = getOrigin(ordered)
  const columnOffsets = columnWidths.map((_, column) =>
    columnWidths.slice(0, column).reduce((total, width) => total + width, 0) + column * gap,
  )
  const rowOffsets = rowHeights.map((_, row) =>
    rowHeights.slice(0, row).reduce((total, height) => total + height, 0) + row * gap,
  )

  return ordered.map((item, index) => ({
    id: item.id,
    x: origin.x + columnOffsets[index % columns],
    y: origin.y + rowOffsets[Math.floor(index / columns)],
  }))
}

function calculateHorizontalLayout(items: LayoutItem[], gap: number): LayoutPlacement[] {
  const ordered = [...items].sort(byHorizontalPosition)
  const origin = getOrigin(ordered)
  let x = origin.x

  return ordered.map((item) => {
    const placement = { id: item.id, x, y: origin.y }
    x += item.w + gap
    return placement
  })
}

function calculateVerticalLayout(items: LayoutItem[], gap: number): LayoutPlacement[] {
  const ordered = [...items].sort(byVerticalPosition)
  const origin = getOrigin(ordered)
  let y = origin.y

  return ordered.map((item) => {
    const placement = { id: item.id, x: origin.x, y }
    y += item.h + gap
    return placement
  })
}

function calculatePrimaryLayout(items: LayoutItem[], gap: number, primaryId?: LayoutItem["id"]): LayoutPlacement[] {
  const ordered = [...items].sort(byReadingOrder)
  const primary = ordered.find((item) => item.id === primaryId) ?? ordered.at(-1)!
  const secondary = ordered.filter((item) => item.id !== primary.id)
  const origin = getOrigin(ordered)
  const secondaryX = origin.x + primary.w + gap
  let secondaryY = origin.y

  return [
    { id: primary.id, x: origin.x, y: origin.y },
    ...secondary.map((item) => {
      const placement = { id: item.id, x: secondaryX, y: secondaryY }
      secondaryY += item.h + gap
      return placement
    }),
  ]
}

export function calculateAgentLayout(
  items: LayoutItem[],
  preset: AgentLayoutPreset,
  options: LayoutOptions = {},
): LayoutPlacement[] {
  if (items.length < 2) return items.map(({ id, x, y }) => ({ id, x, y }))

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
