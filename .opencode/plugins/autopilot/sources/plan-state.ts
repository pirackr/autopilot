import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const UNCHECKED_RE = /^\s*- \[ \]\s*(.*)$/gm
const CHECKED_RE = /^\s*- \[x\]/gim

export type PlanState = {
  planPath: string
  content: string
  checked: number
  unchecked: number
  total: number
  firstUncheckedTask: string | null
  planSignature: string
  context: string
}

export function getStateDir(): string {
  return process.env.AUTOPILOT_STATE_DIR
    ?? join(process.env.HOME ?? "", ".config", "opencode", "autopilot")
}

export function getActivePlanMarkerPath(sessionID: string): string {
  return join(getStateDir(), `active-plan-${sessionID}`)
}

export function getPlanSignatureMarkerPath(sessionID: string): string {
  return join(getStateDir(), `active-plan-signature-${sessionID}`)
}

export function computePlanSignature(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

export function readPersistedPlanSignature(sessionID: string): string | null {
  const marker = getPlanSignatureMarkerPath(sessionID)
  if (!existsSync(marker)) return null

  const value = readFileSync(marker, "utf-8").trim()
  return value.length > 0 ? value : null
}

export function writePersistedPlanSignature(sessionID: string, signature: string): void {
  mkdirSync(getStateDir(), { recursive: true })
  writeFileSync(getPlanSignatureMarkerPath(sessionID), `${signature}\n`)
}

export function clearPersistedPlanSignature(sessionID: string): void {
  const marker = getPlanSignatureMarkerPath(sessionID)
  if (existsSync(marker)) rmSync(marker)
}

export function readPlanState(sessionID: string): PlanState | null {
  const marker = getActivePlanMarkerPath(sessionID)
  if (!existsSync(marker)) return null

  const planPath = readFileSync(marker, "utf-8").trim()
  if (!planPath || !existsSync(planPath)) return null

  const content = readFileSync(planPath, "utf-8")
  const uncheckedMatches = [...content.matchAll(UNCHECKED_RE)]
  const checked = content.match(CHECKED_RE)?.length ?? 0
  const unchecked = uncheckedMatches.length
  const total = checked + unchecked

  if (total === 0) return null

  return {
    planPath,
    content,
    checked,
    unchecked,
    total,
    firstUncheckedTask: uncheckedMatches[0]?.[1]?.trim() || null,
    planSignature: computePlanSignature(content),
    context: `${checked}/${total} completed, ${unchecked} remaining`,
  }
}
