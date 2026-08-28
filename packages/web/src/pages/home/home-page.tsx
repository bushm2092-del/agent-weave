import type { CanvasSummary, CreateRolePresetRequest, RolePreset } from "@agent-weave/contracts"
import {
  ArrowUpRight,
  Bot,
  BrainCircuit,
  ChevronRight,
  Clock3,
  Copy,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Search,
  Sparkles,
  SquarePen,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react'
import { useEffect, useState } from "react"
import type { CSSProperties } from "react"
import { Link, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { canvasController, useCanvasStore } from "@/features/canvases"
import { rolePresetApi, RolePresetDialog } from "@/features/role-presets"

type HomeSection = "canvases" | "presets"

function WorkspacePreview({ workspace }: { workspace: CanvasSummary }) {
  return (
    <div className="workspace-card__preview" data-accent={workspace.accent} data-thumbnail={!!workspace.thumbnailDataUrl}>
      {workspace.thumbnailDataUrl ? (
        <img alt="" src={workspace.thumbnailDataUrl} />
      ) : (
        <>
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
        </>
      )}
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
  const [activeSection, setActiveSection] = useState<HomeSection>("canvases")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [presetQuery, setPresetQuery] = useState("")
  const [rolePresets, setRolePresets] = useState<RolePreset[]>([])
  const [presetsLoading, setPresetsLoading] = useState(true)
  const [presetDialog, setPresetDialog] = useState<RolePreset | "new">()
  const [presetError, setPresetError] = useState<string>()

  useEffect(() => {
    void canvasController.load().catch(() => undefined)
    void rolePresetApi.list().then(setRolePresets).catch((loadError: unknown) => {
      setPresetError(loadError instanceof Error ? loadError.message : "Unable to load role presets.")
    }).finally(() => setPresetsLoading(false))
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

  const selectSection = (section: HomeSection) => {
    setActiveSection(section)
    setSidebarOpen(false)
  }

  const visiblePresets = rolePresets.filter((preset) => {
    const query = presetQuery.trim().toLowerCase()
    return !query || `${preset.name} ${preset.description} ${preset.category}`.toLowerCase().includes(query)
  })

  const savePreset = async (input: CreateRolePresetRequest) => {
    const saved = presetDialog === "new"
      ? await rolePresetApi.create(input)
      : await rolePresetApi.update(presetDialog!.id, input)
    setRolePresets((current) => {
      const remaining = current.filter((preset) => preset.id !== saved.id)
      return [...remaining, saved].sort((left, right) => Number(right.builtIn) - Number(left.builtIn) || left.category.localeCompare(right.category) || left.name.localeCompare(right.name))
    })
    setPresetDialog(undefined)
  }

  const deletePreset = async (preset: RolePreset) => {
    if (preset.builtIn || !window.confirm(`Delete “${preset.name}”?`)) return
    setPresetError(undefined)
    try {
      await rolePresetApi.delete(preset.id)
      setRolePresets((current) => current.filter((item) => item.id !== preset.id))
    } catch (deleteError) {
      setPresetError(deleteError instanceof Error ? deleteError.message : "Unable to delete the role preset.")
    }
  }

  return (
    <main className="home-page" data-sidebar-collapsed={sidebarCollapsed}>
      <div className="home-shell">
        <button className="home-sidebar__scrim" data-open={sidebarOpen} style={{ opacity: sidebarOpen ? 1 : 0, pointerEvents: sidebarOpen ? "auto" : "none" }} type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />
        <aside className="home-sidebar" data-open={sidebarOpen} style={{ "--home-sidebar-translate": sidebarOpen ? "0%" : "-100%" } as CSSProperties} aria-label="Main navigation">
          <div className="home-sidebar__header">
            <Link className="home-sidebar__brand" to="/" aria-label="AgentWeave home">
              <img src="/icon.png" alt="" />
              <span><strong>AgentWeave</strong><small>Agent teamwork</small></span>
            </Link>
            <Button className="home-sidebar__collapse" size="icon-sm" variant="ghost" aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"} onClick={() => setSidebarCollapsed((value) => !value)}>
              {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
          </div>
          <nav className="home-nav">
            <button title="Your canvases" data-active={activeSection === "canvases"} type="button" onClick={() => selectSection("canvases")}>
              <LayoutDashboard /><span>Your canvases</span><small>{canvases.length}</small>
            </button>
            <button title="Role presets" data-active={activeSection === "presets"} type="button" onClick={() => selectSection("presets")}>
              <Sparkles /><span>Role presets</span><ChevronRight />
            </button>
          </nav>
        </aside>

        <div className="home-main">
          <header className="home-header">
            <div className="home-header__leading">
              <Button className="home-sidebar-trigger" size="icon" variant="ghost" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu /></Button>
              <Link className="home-brand" to="/" aria-label="AgentWeave home">
                <img src="/icon.png" alt="" />
                <strong>AgentWeave</strong>
              </Link>
            </div>
            <div className="home-header__actions">
              <Button size="icon" variant="ghost" aria-label="Search canvases"><Search /></Button>
              <Button disabled={creating} onClick={() => void createCanvas()}>
                <Plus data-icon="inline-start" />{creating ? "Creating…" : "New canvas"}
              </Button>
            </div>
          </header>

          <section className="home-content">
          {activeSection === "canvases" ? (
            <>
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
            </>
          ) : (
            <>
              <div className="home-titlebar home-titlebar--presets">
                <div><p>Library</p><h1>Role presets</h1><small>Persisted roles inject real instructions into team agents.</small></div>
                <div className="role-preset-toolbar"><label className="role-preset-search"><Search /><input value={presetQuery} onChange={(event) => setPresetQuery(event.target.value)} placeholder="Search roles" aria-label="Search role presets" /></label><Button onClick={() => setPresetDialog("new")}><Plus />New role</Button></div>
              </div>
              {presetError && <p className="home-content__error">{presetError}</p>}
              <div className="role-preset-grid" aria-busy={presetsLoading}>
                {visiblePresets.map((preset) => {
                  const { Icon, tone } = presetAppearance(preset.category)
                  return (
                    <article className="role-preset-card" key={preset.id}>
                      <button className="role-preset-card__main" type="button" onClick={() => setPresetDialog(preset)}>
                        <span className="role-preset-card__icon" data-tone={tone}><Icon /></span>
                        <span className="role-preset-card__content"><small>{preset.category} · {preset.agent}</small><strong>{preset.name}</strong><span>{preset.description}</span></span>
                        <ChevronRight />
                      </button>
                      <div className="role-preset-card__actions"><Button size="icon-xs" variant="ghost" aria-label={`Edit ${preset.name}`} onClick={() => setPresetDialog(preset)}><Pencil /></Button>{!preset.builtIn && <Button size="icon-xs" variant="ghost" aria-label={`Delete ${preset.name}`} onClick={() => void deletePreset(preset)}><Trash2 /></Button>}</div>
                    </article>
                  )
                })}
              </div>
              {!presetsLoading && visiblePresets.length === 0 && <div className="role-preset-empty"><UserRound /><strong>No roles found</strong><span>Try a different search term.</span></div>}
            </>
          )}
          </section>
        </div>
      </div>
      {presetDialog && <RolePresetDialog preset={presetDialog === "new" ? undefined : presetDialog} onClose={() => setPresetDialog(undefined)} onSave={savePreset} />}
    </main>
  )
}

function presetAppearance(category: string) {
  const normalized = category.toLowerCase()
  if (normalized.includes("research")) return { Icon: Search, tone: "blue" }
  if (normalized.includes("plan") || normalized.includes("product")) return { Icon: LayoutDashboard, tone: "amber" }
  if (normalized.includes("create") || normalized.includes("write")) return { Icon: SquarePen, tone: "rose" }
  return { Icon: BrainCircuit, tone: "green" }
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
