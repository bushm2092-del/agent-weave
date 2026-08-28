import type { CanvasSummary, CreateRolePresetRequest, RolePreset } from "@agent-weave/contracts"
import {
  ArrowUpRight,
  Bot,
  ChevronRight,
  Clock3,
  Copy,
  LayoutDashboard,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react'
import { useEffect, useState } from "react"
import type { CSSProperties } from "react"
import { Link, useNavigate } from 'react-router'

import aiEngineerAvatar from '@/assets/assistant/ai-engineer.png'
import dataAnalystAvatar from '@/assets/assistant/data-analyst.png'
import devopsEngineerAvatar from '@/assets/assistant/devops-engineer.png'
import productManagerAvatar from '@/assets/assistant/product-manager.png'
import projectManagerAvatar from '@/assets/assistant/project-manager.png'
import uiDesignerAvatar from '@/assets/assistant/ui-designer.png'
import previewStyles from './workspace-preview.module.css'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { canvasController, useCanvasStore } from "@/features/canvases"
import { rolePresetApi, RolePresetDialog } from "@/features/role-presets"

type HomeSection = "canvases" | "presets"

function HomeSidebar({
  activeSection,
  canvasCount,
  onSelect,
}: {
  activeSection: HomeSection
  canvasCount: number
  onSelect: (section: HomeSection) => void
}) {
  const { setOpenMobile } = useSidebar()
  const select = (section: HomeSection) => {
    onSelect(section)
    setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/" aria-label="AgentWeave home">
          <img src="/icon.png" alt="" />
          <span><strong>AgentWeave</strong><small>Agent teamwork</small></span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={activeSection === "canvases"} size="lg" tooltip="Your canvases" onClick={() => select("canvases")}>
                  <LayoutDashboard /><span>Your canvases</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>{canvasCount}</SidebarMenuBadge>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={activeSection === "presets"} size="lg" tooltip="Role presets" onClick={() => select("presets")}>
                  <Sparkles /><span>Role presets</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

function WorkspacePreview({ workspace }: { workspace: CanvasSummary }) {
  return (
    <div className={previewStyles.preview} data-accent={workspace.accent} data-thumbnail={!!workspace.thumbnailDataUrl}>
      {workspace.thumbnailDataUrl ? (
        <img alt="" src={workspace.thumbnailDataUrl} />
      ) : (
        <>
          <div className={previewStyles.team}><span /><span /><span /></div>
          <div className={`${previewStyles.agent} ${previewStyles.agentOne}`}>
            <span>CD</span><i /><i />
          </div>
          <div className={`${previewStyles.agent} ${previewStyles.agentTwo}`}>
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
  const [busyCanvasId, setBusyCanvasId] = useState<string>()
  const [actionError, setActionError] = useState<string>()
  const [activeSection, setActiveSection] = useState<HomeSection>("canvases")
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
    <SidebarProvider className="min-h-dvh bg-background text-foreground" style={{ "--sidebar-width": "244px", "--sidebar-width-icon": "76px", "--sidebar-width-mobile": "280px" } as CSSProperties}>
        <HomeSidebar activeSection={activeSection} canvasCount={canvases.length} onSelect={selectSection} />
        <SidebarInset className="min-h-dvh min-w-0">
          <header className="flex h-16 items-center justify-end border-b bg-white px-5 max-md:justify-between max-md:px-3">
            <div className="hidden items-center gap-2 max-md:flex">
              <SidebarTrigger className="hidden max-md:inline-flex" />
              <Link className="flex items-center gap-2.5 text-sm no-underline" to="/" aria-label="AgentWeave home">
                <img className="grid size-8 shrink-0 place-items-center object-cover" src="/icon.png" alt="" />
                <strong className="font-semibold max-md:hidden">AgentWeave</strong>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" aria-label="Search canvases"><Search /></Button>
              <Button disabled={creating} onClick={() => void createCanvas()}>
                <Plus data-icon="inline-start" />{creating ? "Creating…" : "New canvas"}
              </Button>
            </div>
          </header>

          <section className="mx-auto w-full max-w-6xl px-8 py-10 max-lg:px-5 max-sm:px-4 max-sm:py-6">
          {activeSection === "canvases" ? (
            <>
              <div className="home-titlebar">
                <div><p>Workspace</p><h1>Your canvases</h1></div>
                <span>{canvases.length} {canvases.length === 1 ? "canvas" : "canvases"}</span>
              </div>

              {(error || actionError) && <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{actionError ?? error}</p>}
              <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1" aria-busy={loading}>
          {canvases.map((workspace) => (
            <article className="group relative overflow-hidden rounded-lg border bg-card shadow-xs transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md data-[busy=true]:pointer-events-none data-[busy=true]:opacity-60" data-busy={busyCanvasId === workspace.id} key={workspace.id}>
              <Link className="block text-inherit no-underline" to={`/canvas/${workspace.id}`} aria-label={`Open ${workspace.name}`}>
                <WorkspacePreview workspace={workspace} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><h2 className="m-0 text-sm font-semibold">{workspace.name}</h2><p className="mb-0 mt-1 truncate text-xs text-muted-foreground">{workspace.description}</p></div>
                    <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-zinc-400 transition-colors group-hover:text-foreground" />
                  </div>
                  <div className="mt-4 flex items-center gap-3 border-t pt-3 text-[11px] text-muted-foreground [&_span]:flex [&_span]:items-center [&_span]:gap-1 [&_span:last-child]:ml-auto [&_svg]:size-3">
                    <span><Bot /> {workspace.agents} agents</span>
                    <span><Users /> {workspace.teams} {workspace.teams === 1 ? 'team' : 'teams'}</span>
                    <span><Clock3 /> {formatUpdatedAt(workspace.updatedAt)}</span>
                  </div>
                </div>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="absolute right-2 top-2 z-20 border bg-white/90 opacity-0 shadow-xs transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100" size="icon-sm" variant="outline" aria-label={`More options for ${workspace.name}`} disabled={busyCanvasId === workspace.id}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem onSelect={() => renameCanvas(workspace)}><Pencil />Rename</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => duplicateCanvas(workspace)}><Copy />Duplicate</DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={() => deleteCanvas(workspace)}><Trash2 />Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </article>
          ))}

          <Button className="flex min-h-[274px] flex-col items-center justify-center rounded-lg border border-dashed bg-white/40 text-center text-foreground no-underline transition-colors hover:border-zinc-400 hover:bg-white disabled:pointer-events-none disabled:opacity-60" type="button" variant="outline" disabled={creating} onClick={() => void createCanvas()}>
            <span className="mb-3 grid size-9 place-items-center rounded-md border bg-white shadow-xs"><Plus className="size-4" /></span><strong className="text-sm font-medium">{creating ? "Creating…" : "New canvas"}</strong><small className="mt-1 text-xs text-muted-foreground">Start with an empty workspace</small>
          </Button>
              </div>
            </>
          ) : (
            <>
              <div className="home-titlebar home-titlebar--presets">
                <div><p>Library</p><h1>Role presets</h1><small>Persisted roles inject real instructions into team agents.</small></div>
                <div className="role-preset-toolbar"><label className="role-preset-search"><Search /><Input value={presetQuery} onChange={(event) => setPresetQuery(event.target.value)} placeholder="Search roles" aria-label="Search role presets" /></label><Button onClick={() => setPresetDialog("new")}><Plus />New role</Button></div>
              </div>
              {presetError && <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{presetError}</p>}
              <div className="role-preset-grid" aria-busy={presetsLoading}>
                {visiblePresets.map((preset) => {
                  const avatar = presetAvatar(preset)
                  return (
                    <article className="role-preset-card" key={preset.id}>
                      <Button className="role-preset-card__main" type="button" variant="ghost" onClick={() => setPresetDialog(preset)}>
                        <img className="size-11 shrink-0 rounded-full border border-blue-100 bg-blue-50 object-cover" src={avatar} alt="" />
                        <span className="role-preset-card__content"><small>{preset.category} · {preset.agent}</small><strong>{preset.name}</strong><span>{preset.description}</span></span>
                        <ChevronRight />
                      </Button>
                      <div className="role-preset-card__actions"><Button size="icon-xs" variant="ghost" aria-label={`Edit ${preset.name}`} onClick={() => setPresetDialog(preset)}><Pencil /></Button>{!preset.builtIn && <Button size="icon-xs" variant="ghost" aria-label={`Delete ${preset.name}`} onClick={() => void deletePreset(preset)}><Trash2 /></Button>}</div>
                    </article>
                  )
                })}
              </div>
              {!presetsLoading && visiblePresets.length === 0 && <div className="role-preset-empty"><UserRound /><strong>No roles found</strong><span>Try a different search term.</span></div>}
            </>
          )}
          </section>
        </SidebarInset>
      {presetDialog && <RolePresetDialog preset={presetDialog === "new" ? undefined : presetDialog} onClose={() => setPresetDialog(undefined)} onSave={savePreset} />}
    </SidebarProvider>
  )
}

function presetAvatar(preset: RolePreset): string {
  const identity = `${preset.name} ${preset.category}`.toLowerCase()
  if (identity.includes("product")) return productManagerAvatar
  if (identity.includes("project") || identity.includes("plan")) return projectManagerAvatar
  if (identity.includes("design") || identity.includes("content") || identity.includes("write") || identity.includes("create")) return uiDesignerAvatar
  if (identity.includes("devops") || identity.includes("infrastructure") || identity.includes("cloud") || identity.includes("operation")) return devopsEngineerAvatar
  if (identity.includes("data") || identity.includes("research") || identity.includes("analyst")) return dataAnalystAvatar
  return aiEngineerAvatar
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
