import { expect, test } from "bun:test"
import { mkdtempSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { FilePlanSource } from "../.opencode/plugins/autopilot/sources/file-plan"

function makeTempStateDir(): string {
  return mkdtempSync(join(tmpdir(), "autopilot-test-"))
}

test("FilePlanSource reads session-scoped marker file", async () => {
  const stateDir = makeTempStateDir()
  const planPath = join(stateDir, "plan.md")
  writeFileSync(planPath, "- [ ] task one\n- [x] task two\n")
  writeFileSync(join(stateDir, "active-plan-session-abc"), planPath)

  const prev = process.env.AUTOPILOT_STATE_DIR
  process.env.AUTOPILOT_STATE_DIR = stateDir
  try {
    const source = new FilePlanSource("session-abc")
    const result = await source.getIncomplete()
    expect(result).not.toBeNull()
    expect(result!.count).toBe(1)
    expect(result!.total).toBe(2)
  } finally {
    process.env.AUTOPILOT_STATE_DIR = prev
  }
})

test("FilePlanSource ignores other sessions marker files", async () => {
  const stateDir = makeTempStateDir()
  const planPath = join(stateDir, "plan.md")
  writeFileSync(planPath, "- [ ] task one\n")
  writeFileSync(join(stateDir, "active-plan-other-session"), planPath)

  const prev = process.env.AUTOPILOT_STATE_DIR
  process.env.AUTOPILOT_STATE_DIR = stateDir
  try {
    const source = new FilePlanSource("my-session")
    const result = await source.getIncomplete()
    expect(result).toBeNull()
  } finally {
    process.env.AUTOPILOT_STATE_DIR = prev
  }
})
