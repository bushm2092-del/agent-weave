import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { startupFailureCopy } from "../src/startup-copy.js"

describe("startupFailureCopy", () => {
  it("uses Chinese startup failure copy for Chinese locales", () => {
    const expected = {
      title: "AgentWeave 启动失败",
      messagePrefix: "AgentWeave 无法启动。诊断信息：\n\n",
    }

    assert.deepEqual(startupFailureCopy("zh-CN"), expected)
    assert.deepEqual(startupFailureCopy("zh-TW"), expected)
  })

  it("uses English startup failure copy for English and unknown locales", () => {
    const expected = {
      title: "AgentWeave failed to start",
      messagePrefix: "AgentWeave could not start. Diagnostic details:\n\n",
    }

    assert.deepEqual(startupFailureCopy("en-US"), expected)
    assert.deepEqual(startupFailureCopy("fr-FR"), expected)
  })
})
