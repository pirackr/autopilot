import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, join } from "node:path"
import { getStateDir } from "./sources/plan-state"

const REQUIRED_SECTIONS = [
  "Current Task",
  "Next Step",
  "Blockers",
  "Recent Progress",
  "Learnings",
] as const

export type PlanSummary = {
  summaryPath: string
  currentTask: string
  nextStep: string
  blockers: string
  recentProgress: string
  learnings: string
  missingSections: string[]
  requiresReconcile: boolean
}

function sanitizePlanBasename(planPath: string): string {
  const raw = basename(planPath, ".md").toLowerCase()
  const sanitized = raw.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  return (sanitized || "plan").slice(0, 48)
}

function buildInitialSummary(firstUncheckedTask: string | null): string {
  return [
    "# Autopilot Summary",
    "",
    "## Current Task",
    firstUncheckedTask ?? "Resume the next unchecked task in the active plan.",
    "",
    "## Next Step",
    "Inspect the current task and take the next concrete action.",
    "",
    "## Blockers",
    "- none",
    "",
        "## Recent Progress",
        "- summary initialized from active plan",
        "",
        "## Learnings",
        "- none yet",
        "",
  ].join("\n")
}

function parseSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {}

  for (const section of REQUIRED_SECTIONS) {
    const pattern = new RegExp(`## ${section}\\r?\\n([\\s\\S]*?)(?=\\r?\\n## |$)`)
    const match = content.match(pattern)
    if (match) sections[section] = match[1].trim()
  }

  return sections
}

export function getPlanSummaryPath(planPath: string): string {
  const hash = createHash("sha256").update(planPath).digest("hex")
  return join(getStateDir(), "plan-summaries", `${sanitizePlanBasename(planPath)}-${hash}.md`)
}

export function readPlanSummary(planPath: string, firstUncheckedTask: string | null): PlanSummary {
  const summaryPath = getPlanSummaryPath(planPath)

  if (!existsSync(summaryPath)) {
    mkdirSync(join(getStateDir(), "plan-summaries"), { recursive: true })
    writeFileSync(summaryPath, buildInitialSummary(firstUncheckedTask))
  }

  const content = readFileSync(summaryPath, "utf-8")
  const sections = parseSections(content)
  const missingSections = REQUIRED_SECTIONS.filter((section) => !sections[section])
  const currentTask = sections["Current Task"] ?? ""
  const requiresReconcile = missingSections.length > 0 || (
    firstUncheckedTask !== null
    && currentTask.length > 0
    && currentTask !== firstUncheckedTask
  )

  return {
    summaryPath,
    currentTask,
    nextStep: sections["Next Step"] ?? "",
    blockers: sections["Blockers"] ?? "",
    recentProgress: sections["Recent Progress"] ?? "",
    learnings: sections["Learnings"] ?? "",
    missingSections: [...missingSections],
    requiresReconcile,
  }
}
