import {
  Bell,
  Bot,
  ChevronRight,
  CircleHelp,
  FileText,
  FolderKanban,
  Home,
  Inbox,
  Plus,
  Search,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"

const navigation = [
  { id: "overview", icon: Home },
  { id: "inbox", icon: Inbox, badge: 12 },
  { id: "assistants", icon: Bot },
  { id: "notifications", icon: Bell, badge: 3 },
] as const

const projects = ["agentWorkspace", "designSystem", "researchNotes"] as const

function DemoSidebar({ active, onSelect }: { active: string; onSelect: (item: string) => void }) {
  const { t } = useTranslation()
  const navigationLabels = {
    overview: t("debug.sidebar.navigation.overview"),
    inbox: t("debug.sidebar.navigation.inbox"),
    assistants: t("debug.sidebar.navigation.assistants"),
    notifications: t("debug.sidebar.navigation.notifications"),
  }
  const projectLabels = {
    agentWorkspace: t("debug.sidebar.projectNames.agentWorkspace"),
    designSystem: t("debug.sidebar.projectNames.designSystem"),
    researchNotes: t("debug.sidebar.projectNames.researchNotes"),
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={t("debug.sidebar.agentWeaveDebugger")}
              onClick={() => onSelect("workspace")}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
                <Sparkles className="size-4" />
              </span>
              <span className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <strong className="truncate">AgentWeave</strong>
                <small className="truncate text-xs text-muted-foreground">{t("debug.sidebar.sidebarDebugger")}</small>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="relative group-data-[collapsible=icon]:hidden">
          <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
          <SidebarInput
            className="pl-8"
            placeholder={t("debug.sidebar.searchNavigation")}
            aria-label={t("debug.sidebar.searchNavigation")}
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("debug.sidebar.workspace")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={active === item.id}
                    tooltip={navigationLabels[item.id]}
                    onClick={() => onSelect(item.id)}
                  >
                    <item.icon />
                    <span>{navigationLabels[item.id]}</span>
                  </SidebarMenuButton>
                  {"badge" in item && <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>{t("debug.sidebar.projects")}</SidebarGroupLabel>
          <SidebarGroupAction title={t("debug.sidebar.addProject")} onClick={() => onSelect("newProject")}>
            <Plus />
            <span className="sr-only">{t("debug.sidebar.addProject")}</span>
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={active === "projects"}
                  tooltip={t("debug.sidebar.projects")}
                  onClick={() => onSelect("projects")}
                >
                  <FolderKanban />
                  <span>{t("debug.sidebar.projects")}</span>
                  <ChevronRight className="ml-auto" />
                </SidebarMenuButton>
                <SidebarMenuAction title={t("debug.sidebar.addProject")} onClick={() => onSelect("newProject")}>
                  <Plus />
                  <span className="sr-only">{t("debug.sidebar.addProject")}</span>
                </SidebarMenuAction>
                <SidebarMenuSub>
                  {projects.map((project, index) => (
                    <SidebarMenuSubItem key={project}>
                      <SidebarMenuSubButton
                        href={`#project-${index}`}
                        isActive={active === project}
                        onClick={() => onSelect(project)}
                      >
                        <FileText />
                        <span>{projectLabels[project]}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={t("debug.sidebar.settings")} onClick={() => onSelect("settings")}>
              <Settings />
              <span>{t("debug.sidebar.settings")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip={t("debug.sidebar.demoUser")} onClick={() => onSelect("profile")}>
              <span className="grid size-8 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                <UserRound className="size-4" />
              </span>
              <span className="grid min-w-0 flex-1 text-left text-sm">
                <strong className="truncate">{t("debug.sidebar.demoUser")}</strong>
                <small className="truncate text-xs text-muted-foreground">debug@agentweave.dev</small>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function DebuggerContent({ active }: { active: string }) {
  const { state, isMobile, openMobile } = useSidebar()
  const { t } = useTranslation()
  const activeLabels: Record<string, string> = {
    workspace: t("debug.sidebar.workspace"),
    overview: t("debug.sidebar.navigation.overview"),
    inbox: t("debug.sidebar.navigation.inbox"),
    assistants: t("debug.sidebar.navigation.assistants"),
    notifications: t("debug.sidebar.navigation.notifications"),
    projects: t("debug.sidebar.projects"),
    newProject: t("debug.sidebar.newProject"),
    agentWorkspace: t("debug.sidebar.projectNames.agentWorkspace"),
    designSystem: t("debug.sidebar.projectNames.designSystem"),
    researchNotes: t("debug.sidebar.projectNames.researchNotes"),
    settings: t("debug.sidebar.settings"),
    profile: t("debug.sidebar.profile"),
  }
  const stateLabel = state === "expanded" ? t("debug.sidebar.values.expanded") : t("debug.sidebar.values.collapsed")
  const viewportLabel = isMobile ? t("debug.sidebar.values.mobile") : t("debug.sidebar.values.desktop")
  const mobileSheetLabel = openMobile ? t("debug.sidebar.values.open") : t("debug.sidebar.values.closed")

  return (
    <SidebarInset>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <SidebarTrigger />
        <div className="h-4 w-px bg-border" />
        <Link className="text-sm text-muted-foreground hover:text-foreground" to="/">
          {t("debug.title")}
        </Link>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <strong className="text-sm">{t("debug.sidebar.sidebar")}</strong>
      </header>
      <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">shadcn/ui</p>
            <h1 className="mt-1 text-2xl font-semibold">{t("debug.sidebar.pageTitle")}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("debug.sidebar.description")}</p>
          </div>
          <Button asChild variant="outline">
            <a href="https://ui.shadcn.com/docs/components/aria/sidebar" target="_blank" rel="noreferrer">
              <CircleHelp />
              {t("debug.sidebar.documentation")}
            </a>
          </Button>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            [t("debug.sidebar.metrics.state"), stateLabel],
            [t("debug.sidebar.metrics.viewport"), viewportLabel],
            [t("debug.sidebar.metrics.mobileSheet"), mobileSheetLabel],
          ].map(([label, value]) => (
            <article className="rounded-lg border bg-card p-4" key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <strong className="mt-2 block text-lg capitalize">{value}</strong>
            </article>
          ))}
        </section>

        <section className="min-h-72 rounded-lg border bg-card p-6">
          <p className="text-xs font-medium text-muted-foreground">{t("debug.sidebar.activeMenuItem")}</p>
          <div className="mt-8 flex max-w-lg items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold">{activeLabels[active]}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("debug.sidebar.instruction")}</p>
            </div>
          </div>
        </section>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <kbd className="rounded border bg-muted px-2 py-1 font-mono">⌘/Ctrl + B</kbd>
          <span>{t("debug.sidebar.shortcutHint")}</span>
        </div>
      </main>
    </SidebarInset>
  )
}

export function SidebarDebuggerPage() {
  const [active, setActive] = useState("overview")
  return (
    <SidebarProvider defaultOpen>
      <DemoSidebar active={active} onSelect={setActive} />
      <DebuggerContent active={active} />
    </SidebarProvider>
  )
}
