import type { AgentProvider, CreateRolePresetRequest, RolePreset } from "@agent-weave/contracts"
import { Sparkles } from "lucide-react"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
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
  const fieldId = useId()

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
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose() }}>
      <DialogContent aria-busy={saving} className="role-preset-dialog" showCloseButton={!saving}>
        <DialogHeader className="role-preset-dialog__header">
          <span><Sparkles /></span>
          <div><DialogTitle>{preset ? "Edit role preset" : "New role preset"}</DialogTitle><DialogDescription>Define the behavior injected into an agent session.</DialogDescription></div>
        </DialogHeader>
        <div className="role-preset-dialog__grid">
          <div className="role-preset-dialog__field"><Label htmlFor={`${fieldId}-name`}>Name</Label><Input id={`${fieldId}-name`} value={name} disabled={saving} onChange={(event) => setName(event.target.value)} /></div>
          <div className="role-preset-dialog__field"><Label htmlFor={`${fieldId}-category`}>Category</Label><Input id={`${fieldId}-category`} value={category} disabled={saving} onChange={(event) => setCategory(event.target.value)} /></div>
        </div>
        <div className="role-preset-dialog__field"><Label htmlFor={`${fieldId}-description`}>Description</Label><Textarea id={`${fieldId}-description`} rows={2} value={description} disabled={saving} onChange={(event) => setDescription(event.target.value)} /></div>
        <div className="role-preset-dialog__field"><Label>Default runner</Label><Select value={agent} disabled={saving} onValueChange={(value) => setAgent(value as AgentProvider)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{AGENT_RUNNER_IDS.map((id) => <SelectItem key={id} value={AGENT_RUNNERS[id].provider}>{AGENT_RUNNERS[id].label}</SelectItem>)}</SelectContent></Select></div>
        <div className="role-preset-dialog__field"><Label htmlFor={`${fieldId}-prompt`}>System prompt</Label><Textarea id={`${fieldId}-prompt`} className="role-preset-dialog__prompt" rows={8} value={systemPrompt} disabled={saving} onChange={(event) => setSystemPrompt(event.target.value)} /></div>
        {error && <p className="role-preset-dialog__error" role="alert">{error}</p>}
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" disabled={saving}>Cancel</Button></DialogClose>
          <Button disabled={saving || !name.trim() || !category.trim() || !description.trim() || !systemPrompt.trim()} onClick={() => void save()}>{saving ? "Saving..." : "Save preset"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
