import {
  ArrowUpRight,
  Bot,
  Clock3,
  MoreHorizontal,
  Plus,
  Search,
  Users,
} from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { WORKSPACES, type WorkspaceSummary } from '@/pages/home/workspaces'

function WorkspacePreview({ workspace }: { workspace: WorkspaceSummary }) {
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
  return (
    <main className="home-page">
      <header className="home-header">
        <Link className="home-brand" to="/" aria-label="AgentWeave home">
          <span>AW</span>
          <strong>AgentWeave</strong>
        </Link>

        <div className="home-header__actions">
          <Button size="icon" variant="ghost" aria-label="Search canvases"><Search /></Button>
          <Button asChild>
            <Link to="/canvas/untitled"><Plus data-icon="inline-start" />New canvas</Link>
          </Button>
          <button className="home-avatar" type="button" aria-label="Open profile">HF</button>
        </div>
      </header>

      <section className="home-content">
        <div className="home-titlebar">
          <div><p>Workspace</p><h1>Your canvases</h1></div>
          <span>{WORKSPACES.length} canvases</span>
        </div>

        <div className="workspace-grid">
          {WORKSPACES.map((workspace) => (
            <article className="workspace-card" key={workspace.id}>
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
                    <span><Clock3 /> {workspace.updatedAt}</span>
                  </div>
                </div>
              </Link>
              <Button className="workspace-card__menu" size="icon-sm" variant="ghost" aria-label={`More options for ${workspace.name}`}>
                <MoreHorizontal />
              </Button>
            </article>
          ))}

          <Link className="new-workspace-card" to="/canvas/untitled">
            <span><Plus /></span><strong>New canvas</strong><small>Start with an empty workspace</small>
          </Link>
        </div>
      </section>
    </main>
  )
}
