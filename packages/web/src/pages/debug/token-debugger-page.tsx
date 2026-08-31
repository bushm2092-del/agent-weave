import { ArrowLeft, Check, Info, Sparkles, TriangleAlert, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"

type ColorToken = {
  name:
    | "primary"
    | "hover"
    | "soft"
    | "gradient"
    | "canvas"
    | "surface"
    | "navigation"
    | "sunken"
    | "inverse"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | "thinking"
  variable: string
  value: string
  className: string
  dark?: boolean
}

const brandTokens: ColorToken[] = [
  { name: "primary", variable: "--mio-action-primary", value: "#FD7E14", className: "token-swatch--brand" },
  {
    name: "hover",
    variable: "--mio-action-primary-hover",
    value: "#FD7E14 · 80%",
    className: "token-swatch--brand-hover",
  },
  {
    name: "soft",
    variable: "--mio-action-primary-soft",
    value: "#FD7E14 · 20%",
    className: "token-swatch--brand-soft",
  },
  {
    name: "gradient",
    variable: "--mio-gradient-brand",
    value: "#FF6A00 → #FFD21C",
    className: "token-swatch--gradient",
  },
]

const surfaceTokens: ColorToken[] = [
  { name: "canvas", variable: "--mio-bg-canvas", value: "#FFFFFF", className: "token-swatch--canvas" },
  { name: "surface", variable: "--mio-bg-surface", value: "#FAFAFA", className: "token-swatch--surface" },
  { name: "navigation", variable: "--mio-bg-navigation", value: "#F5F5F5", className: "token-swatch--navigation" },
  { name: "sunken", variable: "--mio-bg-sunken", value: "#E5E5E7", className: "token-swatch--sunken" },
  { name: "inverse", variable: "--mio-bg-inverse", value: "#1A1A1A", className: "token-swatch--inverse", dark: true },
]

const statusTokens: ColorToken[] = [
  { name: "success", variable: "--mio-success", value: "#2EA968", className: "token-swatch--success" },
  { name: "warning", variable: "--mio-warning", value: "#FA9D05", className: "token-swatch--warning" },
  { name: "danger", variable: "--mio-danger", value: "#DC3926", className: "token-swatch--danger" },
  { name: "info", variable: "--mio-info", value: "#3D72FF", className: "token-swatch--info" },
  { name: "thinking", variable: "--mio-thinking", value: "#A6D44B", className: "token-swatch--thinking" },
]

function TokenGrid({ tokens }: { tokens: ColorToken[] }) {
  const { t } = useTranslation()
  const tokenNames: Record<ColorToken["name"], string> = {
    primary: t("debug.tokens.names.primary"),
    hover: t("debug.tokens.names.hover"),
    soft: t("debug.tokens.names.soft"),
    gradient: t("debug.tokens.names.gradient"),
    canvas: t("debug.tokens.names.canvas"),
    surface: t("debug.tokens.names.surface"),
    navigation: t("debug.tokens.names.navigation"),
    sunken: t("debug.tokens.names.sunken"),
    inverse: t("debug.tokens.names.inverse"),
    success: t("debug.tokens.names.success"),
    warning: t("debug.tokens.names.warning"),
    danger: t("debug.tokens.names.danger"),
    info: t("debug.tokens.names.info"),
    thinking: t("debug.tokens.names.thinking"),
  }

  return (
    <div className="token-grid">
      {tokens.map((token) => (
        <article className="token-card" key={token.variable}>
          <div className={`token-swatch ${token.className}`} data-dark={token.dark || undefined}>
            <span>{tokenNames[token.name]}</span>
            <code>{token.value}</code>
          </div>
          <code className="token-card__variable">{token.variable}</code>
        </article>
      ))}
    </div>
  )
}

export function TokenDebuggerPage() {
  const { t } = useTranslation()
  const [promptValue, setPromptValue] = useState<string | null>(null)

  return (
    <main className="token-debugger">
      <header className="token-debugger__header">
        <Link to="/" aria-label={t("debug.backToAgentWeave")}>
          <ArrowLeft />
        </Link>
        <div>
          <span>{t("debug.tokens.agentWeaveDebugger")}</span>
          <strong>{t("debug.tokens.title")}</strong>
        </div>
        <span className="token-debugger__badge">{t("debug.tokens.badge")}</span>
      </header>

      <div className="token-debugger__content">
        <section className="token-hero">
          <p>{t("debug.tokens.heroKicker")}</p>
          <h1>
            {t("debug.tokens.heroTitle")}
            <br />
            <em>{t("debug.tokens.heroAccent")}</em>
          </h1>
          <span>{t("debug.tokens.heroDescription")}</span>
        </section>

        <section className="token-section">
          <div className="token-section__heading">
            <span>01</span>
            <div>
              <h2>{t("debug.tokens.sections.brand")}</h2>
              <p>{t("debug.tokens.descriptions.brand")}</p>
            </div>
          </div>
          <TokenGrid tokens={brandTokens} />
        </section>

        <section className="token-section">
          <div className="token-section__heading">
            <span>02</span>
            <div>
              <h2>{t("debug.tokens.sections.surfaces")}</h2>
              <p>{t("debug.tokens.descriptions.surfaces")}</p>
            </div>
          </div>
          <TokenGrid tokens={surfaceTokens} />
          <div className="surface-demo">
            <aside>
              <span>{t("debug.tokens.surfaceDemo.navigation")}</span>
              <b>{t("debug.tokens.surfaceDemo.activeItem")}</b>
              <span>{t("debug.tokens.surfaceDemo.recentProject")}</span>
            </aside>
            <div>
              <span>{t("debug.tokens.surfaceDemo.canvas")}</span>
              <article>
                <small>{t("debug.tokens.surfaceDemo.surface")}</small>
                <strong>{t("debug.tokens.surfaceDemo.asset")}</strong>
                <p>{t("debug.tokens.surfaceDemo.description")}</p>
              </article>
            </div>
          </div>
        </section>

        <section className="token-section token-section--split">
          <div>
            <div className="token-section__heading">
              <span>03</span>
              <div>
                <h2>{t("debug.tokens.sections.typography")}</h2>
                <p>{t("debug.tokens.descriptions.typography")}</p>
              </div>
            </div>
            <div className="type-scale">
              <p data-level="primary">
                <b>{t("debug.tokens.typeScale.primary")}</b>
                <span>{t("debug.tokens.typeScale.primaryUsage")}</span>
              </p>
              <p data-level="secondary">
                <b>{t("debug.tokens.typeScale.secondary")}</b>
                <span>{t("debug.tokens.typeScale.secondaryUsage")}</span>
              </p>
              <p data-level="auxiliary">
                <b>{t("debug.tokens.typeScale.auxiliary")}</b>
                <span>{t("debug.tokens.typeScale.auxiliaryUsage")}</span>
              </p>
              <p data-level="tertiary">
                <b>{t("debug.tokens.typeScale.tertiary")}</b>
                <span>{t("debug.tokens.typeScale.tertiaryUsage")}</span>
              </p>
              <p data-level="disabled">
                <b>{t("debug.tokens.typeScale.disabled")}</b>
                <span>{t("debug.tokens.typeScale.disabledUsage")}</span>
              </p>
            </div>
          </div>
          <div>
            <div className="token-section__heading">
              <span>04</span>
              <div>
                <h2>{t("debug.tokens.sections.borders")}</h2>
                <p>{t("debug.tokens.descriptions.borders")}</p>
              </div>
            </div>
            <div className="border-scale">
              <div data-border="subtle">
                <span>{t("debug.tokens.borders.subtle")}</span>
                <code>black / 6%</code>
              </div>
              <div data-border="default">
                <span>{t("debug.tokens.borders.default")}</span>
                <code>black / 8%</code>
              </div>
              <div data-border="control">
                <span>{t("debug.tokens.borders.control")}</span>
                <code>black / 16%</code>
              </div>
            </div>
          </div>
        </section>

        <section className="token-section">
          <div className="token-section__heading">
            <span>05</span>
            <div>
              <h2>{t("debug.tokens.sections.states")}</h2>
              <p>{t("debug.tokens.descriptions.states")}</p>
            </div>
          </div>
          <TokenGrid tokens={statusTokens} />
          <div className="state-demo">
            <div data-state="success">
              <Check />
              <span>
                <b>{t("debug.tokens.stateDemo.ready")}</b>
                <small>{t("debug.tokens.stateDemo.readyDescription")}</small>
              </span>
            </div>
            <div data-state="warning">
              <TriangleAlert />
              <span>
                <b>{t("debug.tokens.stateDemo.review")}</b>
                <small>{t("debug.tokens.stateDemo.reviewDescription")}</small>
              </span>
            </div>
            <div data-state="danger">
              <X />
              <span>
                <b>{t("debug.tokens.stateDemo.failed")}</b>
                <small>{t("debug.tokens.stateDemo.failedDescription")}</small>
              </span>
            </div>
            <div data-state="info">
              <Info />
              <span>
                <b>{t("debug.tokens.stateDemo.updated")}</b>
                <small>{t("debug.tokens.stateDemo.updatedDescription")}</small>
              </span>
            </div>
          </div>
        </section>

        <section className="token-playground">
          <div>
            <p>{t("debug.tokens.playground.kicker")}</p>
            <h2>{t("debug.tokens.playground.title")}</h2>
            <span>{t("debug.tokens.playground.description")}</span>
          </div>
          <article>
            <label htmlFor="debug-prompt">{t("debug.tokens.playground.promptLabel")}</label>
            <div className="token-playground__input">
              <textarea
                id="debug-prompt"
                value={promptValue ?? t("debug.tokens.playground.promptValue")}
                onChange={(event) => setPromptValue(event.target.value)}
              />
              <button type="button" aria-label={t("debug.tokens.playground.enhancePrompt")}>
                <Sparkles />
              </button>
            </div>
            <div className="token-playground__actions">
              <button type="button">{t("common.cancel")}</button>
              <button type="button">
                <Sparkles /> {t("debug.tokens.playground.startCreating")}
              </button>
            </div>
          </article>
        </section>
      </div>
    </main>
  )
}
