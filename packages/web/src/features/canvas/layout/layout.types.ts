import type { TLShapeId } from "tldraw"

export type AgentLayoutPreset = "grid" | "horizontal" | "vertical" | "primary"

export type LayoutItem = {
  id: TLShapeId
  x: number
  y: number
  w: number
  h: number
}

export type LayoutPlacement = {
  id: TLShapeId
  x: number
  y: number
  w: number
  h: number
}

export type LayoutOptions = {
  gap?: number
  primaryId?: TLShapeId
}

export type AgentSplit = {
  orientation: "horizontal" | "vertical"
  beforeId: TLShapeId
  afterId: TLShapeId
  x: number
  y: number
  length: number
}
