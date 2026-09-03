import type { AgentProvider, CreateRolePresetRequest, RolePreset } from "@agent-weave/contracts"
import { Sparkles, X } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { AGENT_RUNNERS, AGENT_RUNNER_IDS } from "@/features/canvas/agent-options"
import { localizeErrorPresentation, localizeRolePreset, toErrorPresentation, type PresentableError } from "@/i18n"

export function RolePresetDialog({
  preset,
  onClose,
  onSave,
}: {
  preset?: RolePreset
  onClose: () => void
  onSave: (input: CreateRolePresetRequest) => Promise<void>
}) {
  const { t } = useTranslation()
  const displayPreset = preset ? localizeRolePreset(preset, t) : undefined
  const [nameOverride, setNameOverride] = useState<string>()
  const [categoryOverride, setCategoryOverride] = useState<string | undefined>(() =>
    preset ? undefined : t("presets.defaultCategory"),
  )
  const [descriptionOverride, setDescriptionOverride] = useState<string>()
  const [agent, setAgent] = useState<AgentProvider>(preset?.agent ?? "codex")
  const [systemPrompt, setSystemPrompt] = useState(preset?.systemPrompt ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<PresentableError>()
  const fieldId = useId()
  const name = nameOverride ?? displayPreset?.name ?? ""
  const category = categoryOverride ?? displayPreset?.category ?? ""
  const description = descriptionOverride ?? displayPreset?.description ?? ""

  const save = async () => {
    setSaving(true)
    setError(undefined)
    try {
      await onSave({
        name: nameOverride === undefined && preset ? preset.name : name.trim(),
        category: categoryOverride === undefined && preset ? preset.category : category.trim(),
        description: descriptionOverride === undefined && preset ? preset.description : description.trim(),
        agent,
        systemPrompt: systemPrompt.trim(),
      })
    } catch (saveError) {
      setError(toErrorPresentation(saveError, "errors.fallbacks.saveRolePreset"))
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose()
      }}
    >
      <DialogContent
        aria-busy={saving}
        className="max-h-[calc(100dvh-32px)] max-w-xl gap-4 overflow-y-auto"
        showCloseButton={false}
      >
        <DialogClose asChild>
          <Button
            className="absolute right-3 top-3"
            size="icon-sm"
            variant="ghost"
            aria-label={t("common.close")}
            disabled={saving}
          >
            <X />
          </Button>
        </DialogClose>
        <DialogHeader className="flex-row items-start gap-3 border-b pb-4 pr-8">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-emerald-100 text-emerald-700">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle>{preset ? t("presets.editDialog") : t("presets.newDialog")}</DialogTitle>
            <DialogDescription>{t("presets.dialogDescription")}</DialogDescription>
          </div>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <div className="grid gap-1.5">
            <Label htmlFor={`${fieldId}-name`}>{t("presets.name")}</Label>
            <Input
              id={`${fieldId}-name`}
              value={name}
              disabled={saving}
              onChange={(event) => setNameOverride(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${fieldId}-category`}>{t("presets.category")}</Label>
            <Input
              id={`${fieldId}-category`}
              value={category}
              disabled={saving}
              onChange={(event) => setCategoryOverride(event.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${fieldId}-description`}>{t("presets.description")}</Label>
          <Textarea
            id={`${fieldId}-description`}
            rows={2}
            value={description}
            disabled={saving}
            onChange={(event) => setDescriptionOverride(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>{t("presets.defaultRunner")}</Label>
          <Select value={agent} disabled={saving} onValueChange={(value) => setAgent(value as AgentProvider)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGENT_RUNNER_IDS.map((id) => (
                <SelectItem key={id} value={AGENT_RUNNERS[id].provider}>
                  {AGENT_RUNNERS[id].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${fieldId}-prompt`}>{t("presets.systemPrompt")}</Label>
          <Textarea
            id={`${fieldId}-prompt`}
            className="min-h-40 font-mono"
            rows={8}
            value={systemPrompt}
            disabled={saving}
            onChange={(event) => setSystemPrompt(event.target.value)}
          />
        </div>
        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700" role="alert">
            {localizeErrorPresentation(error, t)}
          </p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={saving}>
              {t("common.cancel")}
            </Button>
          </DialogClose>
          <Button
            disabled={saving || !name.trim() || !category.trim() || !description.trim() || !systemPrompt.trim()}
            onClick={() => void save()}
          >
            {saving ? t("presets.saving") : t("presets.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
