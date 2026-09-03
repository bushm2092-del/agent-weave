/* oxlint-disable react/only-export-components -- tldraw shape utilities own their renderers. */
import {
  BaseFrameLikeShapeUtil,
  createShapePropsMigrationIds,
  createShapePropsMigrationSequence,
  type Editor,
  Group2d,
  HTMLContainer,
  Rectangle2d,
  T,
  type TLBaseShape,
  type TLShape,
} from "tldraw"
import { useTranslation } from "react-i18next"
import { TeamHeader } from "@/features/teams"
import { appI18n } from "@/i18n"

export type AgentTeamShape = TLBaseShape<"agent-team", { w: number; h: number; name: string; teamId: string }>

declare module "tldraw" {
  interface TLGlobalShapePropsMap {
    "agent-team": AgentTeamShape["props"]
  }
}

const Versions = createShapePropsMigrationIds("agent-team", { AddTeamId: 1 })

export class AgentTeamShapeUtil extends BaseFrameLikeShapeUtil<AgentTeamShape> {
  static override type = "agent-team" as const
  static override props = { w: T.nonZeroNumber, h: T.nonZeroNumber, name: T.string, teamId: T.string }
  static override migrations = createShapePropsMigrationSequence({
    sequence: [
      {
        id: Versions.AddTeamId,
        up: (props) => {
          props.teamId = ""
        },
        down: (props) => {
          delete props.teamId
        },
      },
    ],
  })

  override getDefaultProps(): AgentTeamShape["props"] {
    return { w: 980, h: 700, name: appI18n.t("canvas.defaults.teamName"), teamId: "" }
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
    return !shape.props.teamId && !shape.isLocked && type === "agent"
  }

  override canRemoveChildrenOfType(shape: AgentTeamShape, type: TLShape["type"]) {
    return !shape.props.teamId && type === "agent"
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
  const { t } = useTranslation()
  return (
    <HTMLContainer className="agent-team-shape" style={{ width: shape.props.w, height: shape.props.h }}>
      {shape.props.teamId ? (
        <TeamHeader editor={editor} teamId={shape.props.teamId} fallbackName={shape.props.name} />
      ) : (
        <div className="agent-team-shape__header">
          <div>
            <strong>{shape.props.name}</strong>
            <span>{t("teams.legacyDescription")}</span>
          </div>
          <span className="agent-team-shape__mode">{t("teams.localGroup")}</span>
        </div>
      )}
    </HTMLContainer>
  )
}
