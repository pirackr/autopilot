import { afterEach, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import {
  clearPersistedPlanSignature,
  readPersistedPlanSignature,
  readPlanState,
  writePersistedPlanSignature,
} from "../.opencode/plugins/autopilot/sources/plan-state"

const tempDirs: string[] = []

function makeTempStateDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "autopilot-plan-state-"))
  tempDirs.push(dir)
  return dir
}

async function withStateDir(stateDir: string, run: () => Promise<void>) {
  const previous = process.env.AUTOPILOT_STATE_DIR
  process.env.AUTOPILOT_STATE_DIR = stateDir
  try {
    await run()
  } finally {
    process.env.AUTOPILOT_STATE_DIR = previous
  }
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true })
  }
})

test("readPlanState returns plan progress, first unchecked task, and signature", async () => {
  const stateDir = makeTempStateDir()
  const planPath = join(stateDir, "feature-plan.md")
  const plan = [
    "- [x] done task",
    "- [ ] first pending task",
    "- [ ] second pending task",
    "",
  ].join("\n")

  writeFileSync(planPath, plan)
  writeFileSync(join(stateDir, "active-plan-session-123"), planPath)

  await withStateDir(stateDir, async () => {
    const planState = readPlanState("session-123")

    expect(planState).toEqual({
      planPath,
      content: plan,
      checked: 1,
      unchecked: 2,
      total: 3,
      firstUncheckedTask: "first pending task",
      planSignature: createHash("sha256").update(plan).digest("hex"),
      context: "1/3 completed, 2 remaining",
    })
  })
})

test("plan signature markers persist until cleared", async () => {
  const stateDir = makeTempStateDir()

  await withStateDir(stateDir, async () => {
    expect(readPersistedPlanSignature("session-123")).toBeNull()

    writePersistedPlanSignature("session-123", "abc123")
    expect(readPersistedPlanSignature("session-123")).toBe("abc123")

    clearPersistedPlanSignature("session-123")
    expect(readPersistedPlanSignature("session-123")).toBeNull()
    expect(existsSync(join(stateDir, "active-plan-signature-session-123"))).toBe(false)
  })
})
