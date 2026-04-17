import { afterEach, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { tmpdir } from "node:os"
import { getPlanSummaryPath, readPlanSummary } from "../.opencode/plugins/autopilot/summary-file"

const tempDirs: string[] = []

function makeTempStateDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "autopilot-summary-"))
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

test("getPlanSummaryPath uses the sanitized basename and full hash", async () => {
  const stateDir = makeTempStateDir()
  const planPath = "/tmp/My Feature Plan.md"

  await withStateDir(stateDir, async () => {
    expect(getPlanSummaryPath(planPath)).toBe(
      join(
        stateDir,
        "plan-summaries",
        `my-feature-plan-${createHash("sha256").update(planPath).digest("hex")}.md`,
      ),
    )
  })
})

test("readPlanSummary creates a default summary file when missing", async () => {
  const stateDir = makeTempStateDir()
  const planPath = join(stateDir, "feature plan.md")
  writeFileSync(planPath, "- [ ] write docs\n")

  await withStateDir(stateDir, async () => {
    const summary = readPlanSummary(planPath, "write docs")

    expect(summary.currentTask).toBe("write docs")
    expect(summary.nextStep).toBe("Inspect the current task and take the next concrete action.")
    expect(summary.blockers).toBe("- none")
    expect(summary.missingSections).toEqual([])
    expect(readFileSync(summary.summaryPath, "utf-8")).toContain("## Recent Progress")
  })
})

test("readPlanSummary flags stale tasks and missing sections without rewriting the file", async () => {
  const stateDir = makeTempStateDir()
  const planPath = join(stateDir, "feature-plan.md")
  writeFileSync(planPath, "- [ ] current task\n")

  await withStateDir(stateDir, async () => {
    const summaryPath = getPlanSummaryPath(planPath)
    mkdirSync(dirname(summaryPath), { recursive: true })
    writeFileSync(
      summaryPath,
      [
        "# Autopilot Summary",
        "",
        "## Current Task",
        "outdated task",
        "",
        "## Blockers",
        "- none",
        "",
      ].join("\n"),
    )

    const summary = readPlanSummary(planPath, "current task")

    expect(summary.requiresReconcile).toBe(true)
    expect(summary.missingSections).toEqual(["Next Step", "Recent Progress", "Learnings"])
    expect(readFileSync(summaryPath, "utf-8")).toContain("outdated task")
  })
})

test("readPlanSummary parses CRLF-formatted summary sections", async () => {
  const stateDir = makeTempStateDir()
  const planPath = join(stateDir, "feature-plan.md")
  writeFileSync(planPath, "- [ ] current task\n")

  await withStateDir(stateDir, async () => {
    const summaryPath = getPlanSummaryPath(planPath)
    mkdirSync(dirname(summaryPath), { recursive: true })
    writeFileSync(
      summaryPath,
      [
        "# Autopilot Summary",
        "",
        "## Current Task",
        "current task",
        "",
        "## Next Step",
        "take the next step",
        "",
        "## Blockers",
        "- none",
        "",
        "## Recent Progress",
        "- made progress",
        "",
        "## Learnings",
        "- learned something",
        "",
      ].join("\r\n"),
    )

    const summary = readPlanSummary(planPath, "current task")

    expect(summary).toMatchObject({
      currentTask: "current task",
      nextStep: "take the next step",
      blockers: "- none",
      recentProgress: "- made progress",
      learnings: "- learned something",
      missingSections: [],
      requiresReconcile: false,
    })
  })
})
