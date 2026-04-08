import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { IncompleteResult, TodoSource } from "./types"

const UNCHECKED_RE = /^\s*- \[ \]/gm
const CHECKED_RE = /^\s*- \[x\]/gim

export function getStateDir(): string {
  return process.env.AUTOPILOT_STATE_DIR
    ?? join(process.env.HOME ?? "", ".config", "opencode", "autopilot")
}

export class FilePlanSource implements TodoSource {
  private stateFile: string

  constructor(sessionID: string) {
    this.stateFile = join(getStateDir(), `active-plan-${sessionID}`)
  }

  async getIncomplete(): Promise<IncompleteResult | null> {
    if (!existsSync(this.stateFile)) return null

    const planPath = readFileSync(this.stateFile, "utf-8").trim()
    if (!planPath || !existsSync(planPath)) return null

    const content = readFileSync(planPath, "utf-8")
    const unchecked = content.match(UNCHECKED_RE)?.length ?? 0
    const checked = content.match(CHECKED_RE)?.length ?? 0
    const total = unchecked + checked

    if (total === 0) return null

    return {
      count: unchecked,
      total,
      context: `${checked}/${total} completed, ${unchecked} remaining`,
    }
  }
}
