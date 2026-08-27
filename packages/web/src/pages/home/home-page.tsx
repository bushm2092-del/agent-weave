import type { CanvasSummary } from "@agent-weave/contracts"
import {
  ArrowUpRight,
  Bot,
  Clock3,
  Copy,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react'
import { useEffect, useState } from "react"
import { Link, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { canvasController, useCanvasStore } from "@/features/canvases"

function WorkspacePreview({ workspace }: { workspace: CanvasSummary }) {
  return (
    <div className="workspace-card__preview" data-accent={workspace.accent}>
      <div className="workspace-card__team"><span /><span /><span /></div>
      <div className="workspace-card__agent workspace-card__agent--one">
        <span>CD</span><i /><i />
      </div>
      <div className="workspace-card__agent workspace-card__agent--two">
        <span>OC</span><i /><i />
      </div>
      <svg aria-hidden="true" viewBox="0 0 320 140">
        <path d="M104 77 C136 77 139 52 169 52" />
        <path d="M215 66 C224 83 224 90 237 96" />
      </svg>
    </div>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const canvases = useCanvasStore((state) => state.canvases)
  const loading = useCanvasStore((state) => state.loading)
  const error = useCanvasStore((state) => state.error)
  const [creating, setCreating] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string>()
  const [busyCanvasId, setBusyCanvasId] = useState<string>()
  const [actionError, setActionError] = useState<string>()

  useEffect(() => {
    void canvasController.load().catch(() => undefined)
  }, [])

  useEffect(() => {
    const closeMenu = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest("[data-canvas-menu]")) setOpenMenuId(undefined)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenuId(undefined)
    }
    document.addEventListener("pointerdown", closeMenu)
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.removeEventListener("pointerdown", closeMenu)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [])

  const createCanvas = async () => {
    if (creating) return
    setCreating(true)
    try {
      const canvas = await canvasController.create({ name: "Untitled canvas", description: "", accent: "blue" })
      navigate(`/canvas/${canvas.id}`)
    } finally {
      setCreating(false)
    }
  }

  const runCanvasAction = async (canvasId: string, action: () => Promise<void>) => {
    setOpenMenuId(undefined)
    setBusyCanvasId(canvasId)
    setActionError(undefined)
    try {
      await action()
    } catch (actionFailure) {
      setActionError(actionFailure instanceof Error ? actionFailure.message : "The canvas action failed.")
    } finally {
      setBusyCanvasId(undefined)
    }
  }

  const renameCanvas = (canvas: CanvasSummary) => {
    const name = window.prompt("Rename canvas", canvas.name)?.trim()
    if (!name || name === canvas.name) return
    void runCanvasAction(canvas.id, async () => {
      await canvasController.update(canvas.id, { name })
    })
  }

  const duplicateCanvas = (canvas: CanvasSummary) => {
    void runCanvasAction(canvas.id, async () => {
      await canvasController.duplicate(canvas)
    })
  }

  const deleteCanvas = (canvas: CanvasSummary) => {
    if (!window.confirm(`Delete “${canvas.name}”? This will also delete its teams and cannot be undone.`)) return
    void runCanvasAction(canvas.id, async () => {
      await canvasController.delete(canvas.id)
    })
  }

  return (
    <main className="home-page">
      <header className="home-header">
        <Link className="home-brand" to="/" aria-label="AgentWeave home">
          <img src="/icon.png" alt="" />
          <strong>AgentWeave</strong>
        </Link>

        <div className="home-header__actions">
          <Button size="icon" variant="ghost" aria-label="Search canvases"><Search /></Button>
          <Button disabled={creating} onClick={() => void createCanvas()}>
            <Plus data-icon="inline-start" />{creating ? "Creating…" : "New canvas"}
          </Button>
          <button className="home-avatar" type="button" aria-label="Open profile">HF</button>
        </div>
      </header>

      <section className="home-content">
        <div className="home-titlebar">
          <div><p>Workspace</p><h1>Your canvases</h1></div>
          <span>{canvases.length} {canvases.length === 1 ? "canvas" : "canvases"}</span>
        </div>

        {(error || actionError) && <p className="home-content__error">{actionError ?? error}</p>}
        <div className="workspace-grid" aria-busy={loading}>
          {canvases.map((workspace) => (
            <article className="workspace-card" data-busy={busyCanvasId === workspace.id} key={workspace.id}>
              <Link to={`/canvas/${workspace.id}`} aria-label={`Open ${workspace.name}`}>
                <WorkspacePreview workspace={workspace} />
                <div className="workspace-card__body">
                  <div className="workspace-card__title">
                    <div><h2>{workspace.name}</h2><p>{workspace.description}</p></div>
                    <ArrowUpRight />
                  </div>
                  <div className="workspace-card__meta">
                    <span><Bot /> {workspace.agents} agents</span>
                    <span><Users /> {workspace.teams} {workspace.teams === 1 ? 'team' : 'teams'}</span>
                    <span><Clock3 /> {formatUpdatedAt(workspace.updatedAt)}</span>
                  </div>
                </div>
              </Link>
              <Button
                className="workspace-card__menu"
                data-canvas-menu
                data-open={openMenuId === workspace.id}
                size="icon-sm"
                variant="ghost"
                aria-expanded={openMenuId === workspace.id}
                aria-haspopup="menu"
                aria-label={`More options for ${workspace.name}`}
                disabled={busyCanvasId === workspace.id}
                onClick={() => setOpenMenuId((current) => current === workspace.id ? undefined : workspace.id)}
              >
                <MoreHorizontal />
              </Button>
              {openMenuId === workspace.id && (
                <div className="workspace-card__menu-popover" data-canvas-menu role="menu">
                  <button type="button" role="menuitem" onClick={() => renameCanvas(workspace)}><Pencil />Rename</button>
                  <button type="button" role="menuitem" onClick={() => duplicateCanvas(workspace)}><Copy />Duplicate</button>
                  <button className="workspace-card__menu-danger" type="button" role="menuitem" onClick={() => deleteCanvas(workspace)}><Trash2 />Delete</button>
                </div>
              )}
            </article>
          ))}

          <button className="new-workspace-card" type="button" disabled={creating} onClick={() => void createCanvas()}>
            <span><Plus /></span><strong>{creating ? "Creating…" : "New canvas"}</strong><small>Start with an empty workspace</small>
          </button>
        </div>
      </section>
    </main>
  )
}

function formatUpdatedAt(value: string): string {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return value
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1_000))
  if (seconds < 60) return "Just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}
