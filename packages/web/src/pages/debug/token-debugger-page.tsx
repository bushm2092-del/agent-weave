import { ArrowLeft, Check, Info, Sparkles, TriangleAlert, X } from 'lucide-react'
import { Link } from 'react-router'

type ColorToken = {
  name: string
  variable: string
  value: string
  className: string
  dark?: boolean
}

const brandTokens: ColorToken[] = [
  { name: 'Primary', variable: '--mio-action-primary', value: '#FD7E14', className: 'token-swatch--brand' },
  { name: 'Hover', variable: '--mio-action-primary-hover', value: '#FD7E14 · 80%', className: 'token-swatch--brand-hover' },
  { name: 'Soft', variable: '--mio-action-primary-soft', value: '#FD7E14 · 20%', className: 'token-swatch--brand-soft' },
  { name: 'Gradient', variable: '--mio-gradient-brand', value: '#FF6A00 → #FFD21C', className: 'token-swatch--gradient' },
]

const surfaceTokens: ColorToken[] = [
  { name: 'Canvas', variable: '--mio-bg-canvas', value: '#FFFFFF', className: 'token-swatch--canvas' },
  { name: 'Surface', variable: '--mio-bg-surface', value: '#FAFAFA', className: 'token-swatch--surface' },
  { name: 'Navigation', variable: '--mio-bg-navigation', value: '#F5F5F5', className: 'token-swatch--navigation' },
  { name: 'Sunken', variable: '--mio-bg-sunken', value: '#E5E5E7', className: 'token-swatch--sunken' },
  { name: 'Inverse', variable: '--mio-bg-inverse', value: '#1A1A1A', className: 'token-swatch--inverse', dark: true },
]

const statusTokens: ColorToken[] = [
  { name: 'Success', variable: '--mio-success', value: '#2EA968', className: 'token-swatch--success' },
  { name: 'Warning', variable: '--mio-warning', value: '#FA9D05', className: 'token-swatch--warning' },
  { name: 'Danger', variable: '--mio-danger', value: '#DC3926', className: 'token-swatch--danger' },
  { name: 'Info', variable: '--mio-info', value: '#3D72FF', className: 'token-swatch--info' },
  { name: 'Thinking', variable: '--mio-thinking', value: '#A6D44B', className: 'token-swatch--thinking' },
]

function TokenGrid({ tokens }: { tokens: ColorToken[] }) {
  return (
    <div className="token-grid">
      {tokens.map((token) => (
        <article className="token-card" key={token.variable}>
          <div className={`token-swatch ${token.className}`} data-dark={token.dark || undefined}>
            <span>{token.name}</span>
            <code>{token.value}</code>
          </div>
          <code className="token-card__variable">{token.variable}</code>
        </article>
      ))}
    </div>
  )
}

export function TokenDebuggerPage() {
  return (
    <main className="token-debugger">
      <header className="token-debugger__header">
        <Link to="/" aria-label="Back to AgentWeave"><ArrowLeft /></Link>
        <div>
          <span>AgentWeave debugger</span>
          <strong>Color tokens</strong>
        </div>
        <span className="token-debugger__badge">Miora study</span>
      </header>

      <div className="token-debugger__content">
        <section className="token-hero">
          <p>COLOR SYSTEM · 01</p>
          <h1>Neutral by default.<br /><em>Orange with intent.</em></h1>
          <span>基于 Miora 的实际 CSS Token，观察品牌色、灰阶、文字与反馈状态在真实组件中的表现。</span>
        </section>

        <section className="token-section">
          <div className="token-section__heading"><span>01</span><div><h2>Brand</h2><p>品牌色只负责行动、选中与 AI 能力强调。</p></div></div>
          <TokenGrid tokens={brandTokens} />
        </section>

        <section className="token-section">
          <div className="token-section__heading"><span>02</span><div><h2>Surfaces</h2><p>用非常接近的白灰变化构建页面深度。</p></div></div>
          <TokenGrid tokens={surfaceTokens} />
          <div className="surface-demo">
            <aside><span>Navigation</span><b>Active item</b><span>Recent project</span></aside>
            <div><span>Canvas</span><article><small>Surface</small><strong>Production-ready asset</strong><p>Subtle borders preserve hierarchy without adding visual noise.</p></article></div>
          </div>
        </section>

        <section className="token-section token-section--split">
          <div>
            <div className="token-section__heading"><span>03</span><div><h2>Typography</h2><p>黑色透明度构成稳定的文字层级。</p></div></div>
            <div className="type-scale">
              <p data-level="primary"><b>Primary · 87.5%</b><span>用于标题和关键内容</span></p>
              <p data-level="secondary"><b>Secondary · 65%</b><span>用于正文和表单标签</span></p>
              <p data-level="auxiliary"><b>Auxiliary · 48.6%</b><span>用于补充说明</span></p>
              <p data-level="tertiary"><b>Tertiary · #999</b><span>用于低优先级元数据</span></p>
              <p data-level="disabled"><b>Disabled · 30%</b><span>仅用于不可操作状态</span></p>
            </div>
          </div>
          <div>
            <div className="token-section__heading"><span>04</span><div><h2>Borders</h2><p>透明度越高，交互意图越明确。</p></div></div>
            <div className="border-scale">
              <div data-border="subtle"><span>Subtle</span><code>black / 6%</code></div>
              <div data-border="default"><span>Default</span><code>black / 8%</code></div>
              <div data-border="control"><span>Control</span><code>black / 16%</code></div>
            </div>
          </div>
        </section>

        <section className="token-section">
          <div className="token-section__heading"><span>05</span><div><h2>States</h2><p>状态色独立于品牌色，避免语义混淆。</p></div></div>
          <TokenGrid tokens={statusTokens} />
          <div className="state-demo">
            <div data-state="success"><Check /><span><b>Ready to create</b><small>All agents are online.</small></span></div>
            <div data-state="warning"><TriangleAlert /><span><b>Review required</b><small>One setting needs attention.</small></span></div>
            <div data-state="danger"><X /><span><b>Generation failed</b><small>Try a different model.</small></span></div>
            <div data-state="info"><Info /><span><b>Memory updated</b><small>Your preference was saved.</small></span></div>
          </div>
        </section>

        <section className="token-playground">
          <div><p>COMPONENT PLAYGROUND</p><h2>See the tokens working together.</h2><span>浅灰容器、白色表面、低透明度边框和单一品牌行动色。</span></div>
          <article>
            <label htmlFor="debug-prompt">Creative brief</label>
            <div className="token-playground__input"><textarea id="debug-prompt" defaultValue="Create a minimal campaign system for an agentic workspace." /><button type="button" aria-label="Enhance prompt"><Sparkles /></button></div>
            <div className="token-playground__actions"><button type="button">Cancel</button><button type="button"><Sparkles /> Start creating</button></div>
          </article>
        </section>
      </div>
    </main>
  )
}
