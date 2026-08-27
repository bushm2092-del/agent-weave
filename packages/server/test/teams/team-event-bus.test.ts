import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { DatabaseSync } from "node:sqlite"
import { TeamEventBus } from "../../src/features/teams/team-event-bus.js"
import { SqliteTeamRepository } from "../../src/features/teams/persistence/sqlite-team.repository.js"

describe("TeamEventBus", () => {
  it("notifies subscribers only after the surrounding transaction commits", () => {
    const repository = new SqliteTeamRepository(new DatabaseSync(":memory:"))
    const eventBus = new TeamEventBus(repository)
    const teamId = crypto.randomUUID()
    const events: string[] = []
    repository.createTeam({
      id: teamId,
      canvasId: "canvas-one",
      name: "Transactional team",
      workspace: "/workspace",
      leaderSlotId: crypto.randomUUID(),
      sessionStatus: "starting",
      lifecycleStatus: "active",
      now: new Date().toISOString(),
    })
    eventBus.subscribe(teamId, (event) => events.push(event.type))

    assert.throws(() =>
      eventBus.transaction(() => {
        eventBus.publish({ teamId, type: "team.updated", data: { name: "Rolled back" } })
        throw new Error("rollback")
      }),
    )

    assert.deepEqual(events, [])
    assert.deepEqual(repository.listEventsAfter(teamId, 0), [])

    eventBus.transaction(() => {
      eventBus.publish({ teamId, type: "team.updated", data: { name: "Committed" } })
    })

    assert.deepEqual(events, ["team.updated"])
    assert.equal(repository.listEventsAfter(teamId, 0).length, 1)
  })
})
