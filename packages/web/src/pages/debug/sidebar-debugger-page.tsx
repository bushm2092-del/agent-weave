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
  { label: "Overview", icon: Home },
  { label: "Inbox", icon: Inbox, badge: 12 },
  { label: "Assistants", icon: Bot },
  { label: "Notifications", icon: Bell, badge: 3 },
] as const

const projects = ["Agent workspace", "Design system", "Research notes"]

function DemoSidebar({ active, onSelect }: { active: string; onSelect: (item: string) => void }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="AgentWeave debugger" onClick={() => onSelect("Workspace")}>
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground"><Sparkles className="size-4" /></span>
              <span className="grid min-w-0 flex-1 text-left text-sm leading-tight"><strong className="truncate">AgentWeave</strong><small className="truncate text-xs text-muted-foreground">Sidebar debugger</small></span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="relative group-data-[collapsible=icon]:hidden">
          <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
          <SidebarInput className="pl-8" placeholder="Search navigation" aria-label="Search navigation" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton isActive={active === item.label} tooltip={item.label} onClick={() => onSelect(item.label)}>
                    <item.icon /><span>{item.label}</span>
                  </SidebarMenuButton>
                  {"badge" in item && <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarGroupAction title="Add project" onClick={() => onSelect("New project")}><Plus /><span className="sr-only">Add project</span></SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={active === "Projects"} tooltip="Projects" onClick={() => onSelect("Projects")}>
                  <FolderKanban /><span>Projects</span><ChevronRight className="ml-auto" />
                </SidebarMenuButton>
                <SidebarMenuAction title="Add project" onClick={() => onSelect("New project")}><Plus /><span className="sr-only">Add project</span></SidebarMenuAction>
                <SidebarMenuSub>
                  {projects.map((project, index) => (
                    <SidebarMenuSubItem key={project}>
                      <SidebarMenuSubButton href={`#project-${index}`} isActive={active === project} onClick={() => onSelect(project)}><FileText /><span>{project}</span></SidebarMenuSubButton>
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
          <SidebarMenuItem><SidebarMenuButton tooltip="Settings" onClick={() => onSelect("Settings")}><Settings /><span>Settings</span></SidebarMenuButton></SidebarMenuItem>
          <SidebarMenuItem><SidebarMenuButton size="lg" tooltip="Demo user" onClick={() => onSelect("Profile")}><span className="grid size-8 place-items-center rounded-full bg-emerald-100 text-emerald-700"><UserRound className="size-4" /></span><span className="grid min-w-0 flex-1 text-left text-sm"><strong className="truncate">Demo user</strong><small className="truncate text-xs text-muted-foreground">debug@agentweave.dev</small></span></SidebarMenuButton></SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function DebuggerContent({ active }: { active: string }) {
  const { state, isMobile, openMobile } = useSidebar()
  return (
    <SidebarInset>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <SidebarTrigger />
        <div className="h-4 w-px bg-border" />
        <Link className="text-sm text-muted-foreground hover:text-foreground" to="/">Debugger</Link>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <strong className="text-sm">Sidebar</strong>
      </header>
      <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-medium uppercase text-muted-foreground">shadcn/ui</p><h1 className="mt-1 text-2xl font-semibold">Sidebar component debugger</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">A live composition of the project&apos;s CLI-generated Sidebar primitives.</p></div>
          <Button asChild variant="outline"><a href="https://ui.shadcn.com/docs/components/aria/sidebar" target="_blank" rel="noreferrer"><CircleHelp />Documentation</a></Button>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["Sidebar state", state],
            ["Viewport mode", isMobile ? "mobile" : "desktop"],
            ["Mobile sheet", openMobile ? "open" : "closed"],
          ].map(([label, value]) => <article className="rounded-lg border bg-card p-4" key={label}><p className="text-xs text-muted-foreground">{label}</p><strong className="mt-2 block text-lg capitalize">{value}</strong></article>)}
        </section>

        <section className="min-h-72 rounded-lg border bg-card p-6">
          <p className="text-xs font-medium text-muted-foreground">ACTIVE MENU ITEM</p>
          <div className="mt-8 flex max-w-lg items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Sparkles className="size-5" /></span><div><h2 className="text-xl font-semibold">{active}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Select items in the sidebar to verify active states, badges, nested navigation, actions and tooltip behavior while collapsed.</p></div></div>
        </section>

        <div className="flex items-center gap-2 text-xs text-muted-foreground"><kbd className="rounded border bg-muted px-2 py-1 font-mono">⌘/Ctrl + B</kbd><span>toggles the sidebar using the component&apos;s built-in keyboard handler.</span></div>
      </main>
    </SidebarInset>
  )
}

export function SidebarDebuggerPage() {
  const [active, setActive] = useState("Overview")
  return <SidebarProvider defaultOpen><DemoSidebar active={active} onSelect={setActive} /><DebuggerContent active={active} /></SidebarProvider>
}
