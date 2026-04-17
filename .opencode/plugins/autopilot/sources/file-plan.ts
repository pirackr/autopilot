import type { IncompleteResult, TodoSource } from "./types"
import { readPlanState } from "./plan-state"

export class FilePlanSource implements TodoSource {
  constructor(private sessionID: string) {}

  async getIncomplete(): Promise<IncompleteResult | null> {
    const planState = readPlanState(this.sessionID)
    if (!planState) return null

    return {
      count: planState.unchecked,
      total: planState.total,
      context: planState.context,
    }
  }
}
