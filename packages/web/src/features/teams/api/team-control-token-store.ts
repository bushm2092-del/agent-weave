const storageKey = "agent-weave:team-control-tokens"

function readTokens(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as unknown
    if (!value || typeof value !== "object" || Array.isArray(value)) return {}
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    )
  } catch {
    return {}
  }
}

function writeTokens(tokens: Record<string, string>): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(tokens))
  } catch {
    // A missing token produces an explicit authorization error on mutation.
  }
}

export const teamControlTokenStore = {
  get(teamId: string): string | undefined {
    return readTokens()[teamId]
  },

  set(teamId: string, token: string): void {
    writeTokens({ ...readTokens(), [teamId]: token })
  },

  remove(teamId: string): void {
    const tokens = readTokens()
    delete tokens[teamId]
    writeTokens(tokens)
  },
}
