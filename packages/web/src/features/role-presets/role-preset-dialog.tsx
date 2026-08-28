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
      <DialogContent aria-busy={saving} className="max-h-[calc(100dvh-32px)] max-w-xl gap-4 overflow-y-auto" showCloseButton={!saving}>
        <DialogHeader className="flex-row items-start gap-3 border-b pb-4 pr-8">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-emerald-100 text-emerald-700"><Sparkles className="size-4" /></span>
          <div className="min-w-0 flex-1"><DialogTitle>{preset ? "Edit role preset" : "New role preset"}</DialogTitle><DialogDescription>Define the behavior injected into an agent session.</DialogDescription></div>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <div className="grid gap-1.5"><Label htmlFor={`${fieldId}-name`}>Name</Label><Input id={`${fieldId}-name`} value={name} disabled={saving} onChange={(event) => setName(event.target.value)} /></div>
          <div className="grid gap-1.5"><Label htmlFor={`${fieldId}-category`}>Category</Label><Input id={`${fieldId}-category`} value={category} disabled={saving} onChange={(event) => setCategory(event.target.value)} /></div>
        </div>
        <div className="grid gap-1.5"><Label htmlFor={`${fieldId}-description`}>Description</Label><Textarea id={`${fieldId}-description`} rows={2} value={description} disabled={saving} onChange={(event) => setDescription(event.target.value)} /></div>
        <div className="grid gap-1.5"><Label>Default runner</Label><Select value={agent} disabled={saving} onValueChange={(value) => setAgent(value as AgentProvider)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{AGENT_RUNNER_IDS.map((id) => <SelectItem key={id} value={AGENT_RUNNERS[id].provider}>{AGENT_RUNNERS[id].label}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-1.5"><Label htmlFor={`${fieldId}-prompt`}>System prompt</Label><Textarea id={`${fieldId}-prompt`} className="min-h-40 font-mono" rows={8} value={systemPrompt} disabled={saving} onChange={(event) => setSystemPrompt(event.target.value)} /></div>
        {error && <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700" role="alert">{error}</p>}
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" disabled={saving}>Cancel</Button></DialogClose>
          <Button disabled={saving || !name.trim() || !category.trim() || !description.trim() || !systemPrompt.trim()} onClick={() => void save()}>{saving ? "Saving..." : "Save preset"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
