import type { DirectoryListing } from "@agent-weave/contracts"

import { apiClient } from "@/lib/api"

const filesPath = "/files"

export const fileApi = {
  list(path: string, signal?: AbortSignal): Promise<DirectoryListing> {
    return apiClient.get<DirectoryListing>(`${filesPath}/list`, {
      params: { path },
      ...(signal ? { signal } : {}),
    })
  },
}
