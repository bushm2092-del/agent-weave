/* oxlint-disable react/only-export-components -- tldraw shape utilities own their renderers. */
import {
  BaseFrameLikeShapeUtil,
  type Editor,
  Group2d,
  HTMLContainer,
  Rectangle2d,
  T,
  type TLBaseShape,
  type TLShape,
  useValue,
} from "tldraw"

export type AgentTeamShape = TLBaseShape<"agent-team", { w: number; h: number; name: string }>

declare module "tldraw" {
  interface TLGlobalShapePropsMap {
    "agent-team": AgentTeamShape["props"]
  }
}

export class AgentTeamShapeUtil extends BaseFrameLikeShapeUtil<AgentTeamShape> {
  static override type = "agent-team" as const
  static override props = { w: T.nonZeroNumber, h: T.nonZeroNumber, name: T.string }

  override getDefaultProps(): AgentTeamShape["props"] {
    return { w: 980, h: 700, name: "Agent team" }
  }

  override getGeometry(shape: AgentTeamShape) {
    return new Group2d({
      children: [
        new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: false }),
        new Rectangle2d({ width: shape.props.w, height: 64, isFilled: true, isLabel: true }),
      ],
    })
  }

  override canReceiveNewChildrenOfType(shape: AgentTeamShape, type: TLShape["type"]) {
    return !shape.isLocked && type === "agent"
  }

  override component(shape: AgentTeamShape) {
    return <AgentTeamCard editor={this.editor} shape={shape} />
  }

  override getIndicatorPath(shape: AgentTeamShape) {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 8)
    return path
  }
}

function AgentTeamCard({ editor, shape }: { editor: Editor; shape: AgentTeamShape }) {
  const memberCount = useValue(
    `agent-team-members:${shape.id}`,
    () => editor.getSortedChildIdsForParent(shape.id).filter((id) => editor.getShape(id)?.type === "agent").length,
    [editor, shape.id],
  )
  return (
    <HTMLContainer className="agent-team-shape" style={{ width: shape.props.w, height: shape.props.h }}>
      <div className="agent-team-shape__header">
        <div>
          <strong>{shape.props.name}</strong>
          <span>
            {memberCount} {memberCount === 1 ? "agent" : "agents"} · Drop agents here
          </span>
        </div>
        <span className="agent-team-shape__mode">Shared context</span>
      </div>
    </HTMLContainer>
  )
}
