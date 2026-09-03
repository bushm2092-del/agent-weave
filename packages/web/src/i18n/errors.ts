import type { TFunction } from "i18next"

import { ApiClientError } from "@/lib/api"
import type { en } from "./resources/en"

type ResourceLeafKey<T, Prefix extends string = ""> = {
  [Key in keyof T & string]: T[Key] extends string
    ? `${Prefix}${Key}`
    : T[Key] extends object
      ? ResourceLeafKey<T[Key], `${Prefix}${Key}.`>
      : never
}[keyof T & string]

export type TranslationResourceKey = ResourceLeafKey<typeof en>

const ERROR_KEYS = {
  AGENT_EMPTY_RESPONSE: "errors.codes.agentEmptyResponse",
  AGENT_TURN_CANCELLED: "errors.codes.agentTurnCancelled",
  ATTACHMENT_NOT_FOUND: "errors.codes.attachmentNotFound",
  ATTACHMENT_OUTSIDE_WORKSPACE: "errors.codes.attachmentOutsideWorkspace",
  CANVAS_NOT_FOUND: "errors.codes.canvasNotFound",
  CONFIG_OPTION_NOT_FOUND: "errors.codes.configOptionNotFound",
  CONFIG_OPTION_TYPE_INVALID: "errors.codes.configOptionTypeInvalid",
  CONFIG_OPTION_VALUE_INVALID: "errors.codes.configOptionValueInvalid",
  CONFIG_UPDATE_UNSUPPORTED: "errors.codes.configUpdateUnsupported",
  CONVERSATION_DELETED: "errors.codes.conversationDeleted",
  CONVERSATION_NOT_FOUND: "errors.codes.conversationNotFound",
  FILE_NOT_FOUND: "errors.codes.fileNotFound",
  FILE_NOT_READABLE: "errors.codes.fileNotReadable",
  FILE_PATH_NOT_ABSOLUTE: "errors.codes.filePathNotAbsolute",
  FILE_READ_FAILED: "errors.codes.fileReadFailed",
  FILE_TOO_LARGE: "errors.codes.fileTooLarge",
  HTTP_ERROR: "errors.codes.httpError",
  INTERNAL_ERROR: "errors.codes.internalError",
  INVALID_API_RESPONSE: "errors.codes.invalidApiResponse",
  MANAGED_CONVERSATION: "errors.codes.managedConversation",
  MANAGED_CONVERSATION_OWNER_MISMATCH: "errors.codes.managedConversationOwnerMismatch",
  NETWORK_ERROR: "errors.codes.networkError",
  NOT_FOUND: "errors.codes.notFound",
  PATH_NOT_DIRECTORY: "errors.codes.pathNotDirectory",
  PATH_NOT_FILE: "errors.codes.pathNotFile",
  PERMISSION_ALREADY_RESOLVED: "errors.codes.permissionAlreadyResolved",
  PERMISSION_OPTION_INVALID: "errors.codes.permissionOptionInvalid",
  PERMISSION_REQUEST_NOT_FOUND: "errors.codes.permissionRequestNotFound",
  REQUEST_CANCELLED: "errors.codes.requestCancelled",
  REQUEST_TIMEOUT: "errors.codes.requestTimeout",
  ROLE_PRESET_BUILT_IN: "errors.codes.rolePresetBuiltIn",
  ROLE_PRESET_NOT_FOUND: "errors.codes.rolePresetNotFound",
  RUN_NOT_FOUND: "errors.codes.runNotFound",
  TEAM_CONTROL_UNAUTHORIZED: "errors.codes.teamControlUnauthorized",
  TEAM_INTENT_NOT_FOUND: "errors.codes.teamIntentNotFound",
  TEAM_LEADER_REQUIRED: "errors.codes.teamLeaderRequired",
  TEAM_MEMBER_LIMIT: "errors.codes.teamMemberLimit",
  TEAM_MEMBER_NAME_CONFLICT: "errors.codes.teamMemberNameConflict",
  TEAM_MEMBER_NOT_FOUND: "errors.codes.teamMemberNotFound",
  TEAM_MEMBER_REMOVING: "errors.codes.teamMemberRemoving",
  TEAM_MESSAGE_NOT_FOUND: "errors.codes.teamMessageNotFound",
  TEAM_NOT_FOUND: "errors.codes.teamNotFound",
  TEAM_RUN_ACTIVE: "errors.codes.teamRunActive",
  TEAM_RUN_CANCELLING: "errors.codes.teamRunCancelling",
  TEAM_RUN_NOT_ACTIVE: "errors.codes.teamRunNotActive",
  TEAM_RUN_NOT_FOUND: "errors.codes.teamRunNotFound",
  TEAM_SPAWN_REQUEST_LIMIT: "errors.codes.teamSpawnRequestLimit",
  TEAM_SPAWN_REQUEST_NOT_FOUND: "errors.codes.teamSpawnRequestNotFound",
  TEAM_SPAWN_REQUEST_RESOLVED: "errors.codes.teamSpawnRequestResolved",
  TEAM_TASK_DEPENDENCY_CYCLE: "errors.codes.teamTaskDependencyCycle",
  TEAM_TASK_DEPENDENCY_NOT_FOUND: "errors.codes.teamTaskDependencyNotFound",
  TEAM_TASK_NOT_FOUND: "errors.codes.teamTaskNotFound",
  TEAM_TASK_OWNER_NOT_FOUND: "errors.codes.teamTaskOwnerNotFound",
  TEAM_TOOL_FORBIDDEN: "errors.codes.teamToolForbidden",
  TEAM_TOOL_NOT_FOUND: "errors.codes.teamToolNotFound",
  TEAM_TOOL_UNAUTHORIZED: "errors.codes.teamToolUnauthorized",
  UNSUPPORTED_FILE_TYPE: "errors.codes.unsupportedFileType",
  VALIDATION_ERROR: "errors.codes.validationError",
  WORKSPACE_NOT_DIRECTORY: "errors.codes.workspaceNotDirectory",
  WORKSPACE_NOT_FOUND: "errors.codes.workspaceNotFound",
} as const satisfies Record<string, TranslationResourceKey>

type ExternalErrorPresentation = {
  code?: string
  fallbackKey: TranslationResourceKey
  message?: string
  status?: number
}

export type OwnedErrorPresentation = {
  kind: "owned"
  translationKey: TranslationResourceKey
  values?: Record<string, string | number>
}

export type ErrorPresentation = ExternalErrorPresentation | OwnedErrorPresentation

export type PresentableError = ErrorPresentation | string

export function ownedErrorPresentation(
  translationKey: TranslationResourceKey,
  values?: Record<string, string | number>,
): OwnedErrorPresentation {
  return { kind: "owned", translationKey, ...(values === undefined ? {} : { values }) }
}

export function toErrorPresentation(error: unknown, fallbackKey: TranslationResourceKey): ErrorPresentation {
  if (isOwnedErrorPresentation(error)) return error
  if (error instanceof ApiClientError) {
    return {
      code: error.code,
      fallbackKey,
      message: error.message,
      ...(error.status === undefined ? {} : { status: error.status }),
    }
  }
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return { fallbackKey, message: error.message }
  }
  if (error instanceof Error) return { fallbackKey, message: error.message }
  if (typeof error === "string") return { fallbackKey, message: error }
  return { fallbackKey }
}

export function localizeErrorPresentation(error: PresentableError | undefined, t: TFunction): string | undefined {
  if (error === undefined || typeof error === "string") return error
  if (isOwnedErrorPresentation(error)) return t(error.translationKey, error.values)
  const key = error.code ? ERROR_KEYS[error.code as keyof typeof ERROR_KEYS] : undefined
  if (key) return t(key, { status: error.status })
  if (error.message !== undefined) return error.message
  return t(error.fallbackKey)
}

export function localizeError(error: unknown, t: TFunction, fallbackKey: TranslationResourceKey): string {
  return localizeErrorPresentation(toErrorPresentation(error, fallbackKey), t)!
}

function isOwnedErrorPresentation(error: unknown): error is OwnedErrorPresentation {
  return Boolean(
    error &&
    typeof error === "object" &&
    "kind" in error &&
    error.kind === "owned" &&
    "translationKey" in error &&
    typeof error.translationKey === "string",
  )
}
