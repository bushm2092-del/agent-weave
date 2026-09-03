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
} from "lucide-react"
import { useEffect, useState } from "react"
import type { CSSProperties } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router"

import aiEngineerAvatar from "@/assets/assistant/ai-engineer.png"
import dataAnalystAvatar from "@/assets/assistant/data-analyst.png"
import devopsEngineerAvatar from "@/assets/assistant/devops-engineer.png"
import productManagerAvatar from "@/assets/assistant/product-manager.png"
import projectManagerAvatar from "@/assets/assistant/project-manager.png"
import uiDesignerAvatar from "@/assets/assistant/ui-designer.png"
import previewStyles from "./workspace-preview.module.css"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { canvasController, useCanvasStore } from "@/features/canvases"
import { rolePresetApi, RolePresetDialog } from "@/features/role-presets"
import { LanguageSwitcher } from "@/i18n/language-switcher"
import {
  formatNumber,
  formatRelativeTime,
  localizeErrorPresentation,
  localizeRolePreset,
  toErrorPresentation,
  type PresentableError,
} from "@/i18n"

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
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage === "zh-CN" ? "zh-CN" : "en"
  const { setOpenMobile } = useSidebar()
  const select = (section: HomeSection) => {
    onSelect(section)
    setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip={t("home.canvasHome")} onClick={() => select("canvases")}>
              <span className="grid size-8 shrink-0 place-items-center">
                <img className="size-8 object-contain" src="/icon.png" alt="" />
              </span>
              <span className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <strong className="truncate">AgentWeave</strong>
                <small className="truncate text-xs text-muted-foreground">{t("home.agentTeamwork")}</small>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("home.workspace")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeSection === "canvases"}
                  tooltip={t("home.canvases")}
                  onClick={() => select("canvases")}
                >
                  <LayoutDashboard />
                  <span>{t("home.canvases")}</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>{formatNumber(canvasCount, locale)}</SidebarMenuBadge>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeSection === "presets"}
                  tooltip={t("home.rolePresets")}
                  onClick={() => select("presets")}
                >
                  <Sparkles />
                  <span>{t("home.rolePresets")}</span>
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
          <div className={previewStyles.team}>
            <span />
            <span />
            <span />
          </div>
          <div className={`${previewStyles.agent} ${previewStyles.agentOne}`}>
            <span>CD</span>
            <i />
            <i />
          </div>
          <div className={`${previewStyles.agent} ${previewStyles.agentTwo}`}>
            <span>OC</span>
            <i />
            <i />
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
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const canvases = useCanvasStore((state) => state.canvases)
  const loading = useCanvasStore((state) => state.loading)
  const error = useCanvasStore((state) => state.error)
  const [creating, setCreating] = useState(false)
  const [busyCanvasId, setBusyCanvasId] = useState<string>()
  const [actionError, setActionError] = useState<PresentableError>()
  const [activeSection, setActiveSection] = useState<HomeSection>("canvases")
  const [presetQuery, setPresetQuery] = useState("")
  const [rolePresets, setRolePresets] = useState<RolePreset[]>([])
  const [presetsLoading, setPresetsLoading] = useState(true)
  const [presetDialog, setPresetDialog] = useState<RolePreset | "new">()
  const [presetError, setPresetError] = useState<PresentableError>()

  useEffect(() => {
    void canvasController.load().catch(() => undefined)
    void rolePresetApi
      .list()
      .then(setRolePresets)
      .catch((loadError: unknown) => {
        setPresetError(toErrorPresentation(loadError, "errors.fallbacks.loadRolePresets"))
      })
      .finally(() => setPresetsLoading(false))
  }, [])

  const createCanvas = async () => {
    if (creating) return
    setCreating(true)
    try {
      const canvas = await canvasController.create({
        name: t("canvas.defaults.untitled"),
        description: "",
        accent: "blue",
      })
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
      setActionError(toErrorPresentation(actionFailure, "errors.fallbacks.canvasAction"))
    } finally {
      setBusyCanvasId(undefined)
    }
  }

  const renameCanvas = (canvas: CanvasSummary) => {
    const name = window.prompt(t("canvas.rename"), canvas.name)?.trim()
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
    if (!window.confirm(t("home.deleteCanvasConfirm", { name: canvas.name }))) return
    void runCanvasAction(canvas.id, async () => {
      await canvasController.delete(canvas.id)
    })
  }

  const selectSection = (section: HomeSection) => {
    setActiveSection(section)
  }

  const visiblePresets = rolePresets
    .map((preset) => ({ preset, display: localizeRolePreset(preset, t) }))
    .filter(({ display }) => {
      const query = presetQuery.trim().toLowerCase()
      return !query || `${display.name} ${display.description} ${display.category}`.toLowerCase().includes(query)
    })

  const savePreset = async (input: CreateRolePresetRequest) => {
    const saved =
      presetDialog === "new" ? await rolePresetApi.create(input) : await rolePresetApi.update(presetDialog!.id, input)
    setRolePresets((current) => {
      const remaining = current.filter((preset) => preset.id !== saved.id)
      return [...remaining, saved].sort(
        (left, right) =>
          Number(right.builtIn) - Number(left.builtIn) ||
          left.category.localeCompare(right.category) ||
          left.name.localeCompare(right.name),
      )
    })
    setPresetDialog(undefined)
  }

  const deletePreset = async (preset: RolePreset) => {
    const display = localizeRolePreset(preset, t)
    if (preset.builtIn || !window.confirm(t("home.deletePresetConfirm", { name: display.name }))) return
    setPresetError(undefined)
    try {
      await rolePresetApi.delete(preset.id)
      setRolePresets((current) => current.filter((item) => item.id !== preset.id))
    } catch (deleteError) {
      setPresetError(toErrorPresentation(deleteError, "errors.fallbacks.deleteRolePreset"))
    }
  }

  const visibleCanvasError = localizeErrorPresentation(actionError ?? error, t)
  const visiblePresetError = localizeErrorPresentation(presetError, t)
  const locale = i18n.resolvedLanguage === "zh-CN" ? "zh-CN" : "en"

  return (
    <SidebarProvider
      className="min-h-dvh bg-background text-foreground"
      style={{ "--sidebar-width": "244px", "--sidebar-width-mobile": "280px" } as CSSProperties}
    >
      <HomeSidebar activeSection={activeSection} canvasCount={canvases.length} onSelect={selectSection} />
      <SidebarInset className="min-h-dvh min-w-0">
        <header className="flex h-11 items-center justify-end border-b bg-white px-2.5 max-md:justify-between">
          <div className="hidden items-center gap-2 max-md:flex">
            <SidebarTrigger className="hidden max-md:inline-flex" />
            <Link className="flex items-center gap-2.5 text-sm no-underline" to="/" aria-label={t("home.canvasHome")}>
              <img className="grid size-8 shrink-0 place-items-center object-cover" src="/icon.png" alt="" />
              <strong className="font-semibold max-md:hidden">AgentWeave</strong>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button size="icon" variant="ghost" aria-label={t("home.searchCanvases")}>
              <Search />
            </Button>
            <Button disabled={creating} onClick={() => void createCanvas()}>
              <Plus data-icon="inline-start" />
              {creating ? t("home.creatingCanvas") : t("home.createCanvas")}
            </Button>
          </div>
        </header>

        <section className="mx-auto w-full max-w-6xl px-8 py-10 max-lg:px-5 max-sm:px-4 max-sm:py-6">
          {activeSection === "canvases" ? (
            <>
              <div className="home-titlebar">
                <div>
                  <p>{t("home.workspace")}</p>
                  <h1>{t("home.canvases")}</h1>
                </div>
                <span>
                  {t("home.canvasCount", {
                    count: canvases.length,
                    formattedCount: formatNumber(canvases.length, locale),
                  })}
                </span>
              </div>

              {visibleCanvasError && (
                <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {visibleCanvasError}
                </p>
              )}
              <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1" aria-busy={loading}>
                {canvases.map((workspace) => (
                  <article
                    className="group relative overflow-hidden rounded-lg border bg-card shadow-xs transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md data-[busy=true]:pointer-events-none data-[busy=true]:opacity-60"
                    data-busy={busyCanvasId === workspace.id}
                    key={workspace.id}
                  >
                    <Link
                      className="block text-inherit no-underline"
                      to={`/canvas/${workspace.id}`}
                      aria-label={t("home.openCanvas", { name: workspace.name })}
                    >
                      <WorkspacePreview workspace={workspace} />
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="m-0 text-sm font-semibold">{workspace.name}</h2>
                            <p className="mb-0 mt-1 truncate text-xs text-muted-foreground">{workspace.description}</p>
                          </div>
                          <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-zinc-400 transition-colors group-hover:text-foreground" />
                        </div>
                        <div className="mt-4 flex items-center gap-3 border-t pt-3 text-[11px] text-muted-foreground [&_span]:flex [&_span]:items-center [&_span]:gap-1 [&_span:last-child]:ml-auto [&_svg]:size-3">
                          <span>
                            <Bot />{" "}
                            {t("home.agentCount", {
                              count: workspace.agents,
                              formattedCount: formatNumber(workspace.agents, locale),
                            })}
                          </span>
                          <span>
                            <Users />{" "}
                            {t("home.teamCount", {
                              count: workspace.teams,
                              formattedCount: formatNumber(workspace.teams, locale),
                            })}
                          </span>
                          <span>
                            <Clock3 /> {formatUpdatedAt(workspace.updatedAt, locale)}
                          </span>
                        </div>
                      </div>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          className="absolute right-2 top-2 z-20 border bg-white/90 opacity-0 shadow-xs transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                          size="icon-sm"
                          variant="outline"
                          aria-label={t("home.moreOptions", { name: workspace.name })}
                          disabled={busyCanvasId === workspace.id}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onSelect={() => renameCanvas(workspace)}>
                          <Pencil />
                          {t("canvas.rename")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => duplicateCanvas(workspace)}>
                          <Copy />
                          {t("common.duplicate")}
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onSelect={() => deleteCanvas(workspace)}>
                          <Trash2 />
                          {t("common.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </article>
                ))}

                <Button
                  className="flex min-h-[274px] flex-col items-center justify-center rounded-lg border border-dashed bg-white/40 text-center text-foreground no-underline transition-colors hover:border-zinc-400 hover:bg-white disabled:pointer-events-none disabled:opacity-60"
                  type="button"
                  variant="outline"
                  disabled={creating}
                  onClick={() => void createCanvas()}
                >
                  <span className="mb-3 grid size-9 place-items-center rounded-md border bg-white shadow-xs">
                    <Plus className="size-4" />
                  </span>
                  <strong className="text-sm font-medium">
                    {creating ? t("home.creatingCanvas") : t("home.createCanvas")}
                  </strong>
                  <small className="mt-1 text-xs text-muted-foreground">{t("home.startEmpty")}</small>
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="home-titlebar home-titlebar--presets">
                <div>
                  <p>{t("home.library")}</p>
                  <h1>{t("home.rolePresets")}</h1>
                  <small>{t("home.presetsDescription")}</small>
                </div>
                <div className="role-preset-toolbar">
                  <label className="role-preset-search">
                    <Search />
                    <Input
                      value={presetQuery}
                      onChange={(event) => setPresetQuery(event.target.value)}
                      placeholder={t("home.searchRoles")}
                      aria-label={t("home.searchRolePresets")}
                    />
                  </label>
                  <Button onClick={() => setPresetDialog("new")}>
                    <Plus />
                    {t("presets.create")}
                  </Button>
                </div>
              </div>
              {visiblePresetError && (
                <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {visiblePresetError}
                </p>
              )}
              <div className="role-preset-grid" aria-busy={presetsLoading}>
                {visiblePresets.map(({ preset, display }) => {
                  const avatar = presetAvatar(preset)
                  return (
                    <article className="role-preset-card" key={preset.id}>
                      <Button
                        className="role-preset-card__main"
                        type="button"
                        variant="ghost"
                        onClick={() => setPresetDialog(preset)}
                      >
                        <img
                          className="size-11 shrink-0 rounded-full border border-blue-100 bg-blue-50 object-cover"
                          src={avatar}
                          alt=""
                        />
                        <span className="role-preset-card__content">
                          <small>
                            {display.category} · {preset.agent}
                          </small>
                          <strong>{display.name}</strong>
                          <span>{display.description}</span>
                        </span>
                        <ChevronRight />
                      </Button>
                      <div className="role-preset-card__actions">
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label={t("home.editPreset", { name: display.name })}
                          onClick={() => setPresetDialog(preset)}
                        >
                          <Pencil />
                        </Button>
                        {!preset.builtIn && (
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            aria-label={t("home.deletePreset", { name: display.name })}
                            onClick={() => void deletePreset(preset)}
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
              {!presetsLoading && visiblePresets.length === 0 && (
                <div className="role-preset-empty">
                  <UserRound />
                  <strong>{t("home.noRoles")}</strong>
                  <span>{t("home.tryDifferentSearch")}</span>
                </div>
              )}
            </>
          )}
        </section>
      </SidebarInset>
      {presetDialog && (
        <RolePresetDialog
          preset={presetDialog === "new" ? undefined : presetDialog}
          onClose={() => setPresetDialog(undefined)}
          onSave={savePreset}
        />
      )}
    </SidebarProvider>
  )
}

function presetAvatar(preset: RolePreset): string {
  const identity = `${preset.name} ${preset.category}`.toLowerCase()
  if (identity.includes("product")) return productManagerAvatar
  if (identity.includes("project") || identity.includes("plan")) return projectManagerAvatar
  if (
    identity.includes("design") ||
    identity.includes("content") ||
    identity.includes("write") ||
    identity.includes("create")
  )
    return uiDesignerAvatar
  if (
    identity.includes("devops") ||
    identity.includes("infrastructure") ||
    identity.includes("cloud") ||
    identity.includes("operation")
  )
    return devopsEngineerAvatar
  if (identity.includes("data") || identity.includes("research") || identity.includes("analyst"))
    return dataAnalystAvatar
  return aiEngineerAvatar
}

function formatUpdatedAt(value: string, locale: "en" | "zh-CN"): string {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return value
  return formatRelativeTime(timestamp, locale)
}
