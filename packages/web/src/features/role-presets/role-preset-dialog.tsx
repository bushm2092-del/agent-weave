import type { AgentProvider, CreateRolePresetRequest, RolePreset } from "@agent-weave/contracts"
import { Sparkles, X } from "lucide-react"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { AGENT_RUNNERS, AGENT_RUNNER_IDS } from "@/features/canvas/agent-options"

export function RolePresetDialog({
  preset,
  onClose,
  onSave,
}: {
  preset?: RolePreset
  onClose: () => void
  onSave: (input: CreateRolePresetRequest) => Promise<void>
}) {
  const [name, setName] = useState(preset?.name ?? "")
  const [category, setCategory] = useState(preset?.category ?? "Build")
  const [description, setDescription] = useState(preset?.description ?? "")
  const [agent, setAgent] = useState<AgentProvider>(preset?.agent ?? "codex")
  const [systemPrompt, setSystemPrompt] = useState(preset?.systemPrompt ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const titleId = useId()

  const save = async () => {
    setSaving(true)
    setError(undefined)
    try {
      await onSave({
        name: name.trim(),
        category: category.trim(),
        description: description.trim(),
        agent,
        systemPrompt: systemPrompt.trim(),
      })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the role preset.")
      setSaving(false)
    }
  }

  return (
    <div className="role-preset-dialog-backdrop" role="presentation">
      <section aria-busy={saving} aria-labelledby={titleId} className="role-preset-dialog" role="dialog">
        <header>
          <span><Sparkles /></span>
          <div><h2 id={titleId}>{preset ? "Edit role preset" : "New role preset"}</h2><p>Define the behavior injected into an agent session.</p></div>
          <Button aria-label="Close" disabled={saving} size="icon-sm" variant="ghost" onClick={onClose}><X /></Button>
        </header>
        <div className="role-preset-dialog__grid">
          <label>Name<input value={name} disabled={saving} onChange={(event) => setName(event.target.value)} /></label>
          <label>Category<input value={category} disabled={saving} onChange={(event) => setCategory(event.target.value)} /></label>
        </div>
        <label>Description<textarea rows={2} value={description} disabled={saving} onChange={(event) => setDescription(event.target.value)} /></label>
        <label>Default runner<select value={agent} disabled={saving} onChange={(event) => setAgent(event.target.value as AgentProvider)}>
          {AGENT_RUNNER_IDS.map((id) => <option key={id} value={AGENT_RUNNERS[id].provider}>{AGENT_RUNNERS[id].label}</option>)}
        </select></label>
        <label>System prompt<textarea className="role-preset-dialog__prompt" rows={8} value={systemPrompt} disabled={saving} onChange={(event) => setSystemPrompt(event.target.value)} /></label>
        {error && <p role="alert">{error}</p>}
        <footer><Button variant="ghost" disabled={saving} onClick={onClose}>Cancel</Button><Button disabled={saving || !name.trim() || !category.trim() || !description.trim() || !systemPrompt.trim()} onClick={() => void save()}>{saving ? "Saving..." : "Save preset"}</Button></footer>
      </section>
    </div>
  )
}
