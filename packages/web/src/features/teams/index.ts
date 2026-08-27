export { teamApi } from "./api"
export {
  createTeamProjection,
  isProgrammaticTeamDelete,
  reconcileCanvasTeams,
  removeTeamProjection,
  syncCanvasTeams,
  syncTeamEventToCanvas,
} from "./canvas/team-shape-binding"
export { CreateTeamDialog } from "./components/create-team-dialog"
export type { TeamDraft } from "./components/create-team-dialog"
export { TeamHeader } from "./components/team-header"
export { TeamInspector } from "./components/team-inspector"
export { teamController } from "./lifecycle"
export { teamStore, useTeamStore } from "./store"
