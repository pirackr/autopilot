import type { PluginInput } from "@opencode-ai/plugin"
import { FilePlanSource } from "./sources/file-plan"
import { SessionTodoSource } from "./sources/session-todo"
import type { TodoSource } from "./sources/types"

const ABORT_WINDOW_MS = 3000

const CONTINUATION_PROMPT = `Incomplete tasks remain. Continue working on the next pending task.

- Proceed without asking for permission
- Mark each task complete when finished
- Do not stop until all tasks are done`

interface SessionState {
  abortDetectedAt?: number
}

export class Enforcer {
  private sessions = new Map<string, SessionState>()

  constructor(private ctx: PluginInput) {}

  private getState(sessionID: string): SessionState {
    let state = this.sessions.get(sessionID)
    if (!state) {
      state = {}
      this.sessions.set(sessionID, state)
    }
    return state
  }

  private getSources(sessionID: string): TodoSource[] {
    return [
      new FilePlanSource(),
      new SessionTodoSource(this.ctx, sessionID),
    ]
  }

  async onIdle(sessionID: string): Promise<void> {
    const state = this.getState(sessionID)

    if (state.abortDetectedAt) {
      const elapsed = Date.now() - state.abortDetectedAt
      if (elapsed < ABORT_WINDOW_MS) {
        return
      }
      state.abortDetectedAt = undefined
    }

    const sources = this.getSources(sessionID)
    let result = null
    for (const source of sources) {
      result = await source.getIncomplete()
      if (result && result.count > 0) break
    }

    if (!result || result.count === 0) return

    const prompt = `${CONTINUATION_PROMPT}\n\n[Status: ${result.context}]`

    try {
      await this.ctx.client.session.prompt({
        path: { id: sessionID },
        body: {
          parts: [{ type: "text", text: prompt }],
        },
        query: { directory: this.ctx.directory },
      })
    } catch {
      // Injection failed - session may have been deleted
    }
  }

  onAbort(sessionID: string): void {
    const state = this.getState(sessionID)
    state.abortDetectedAt = Date.now()
  }

  onActivity(sessionID: string): void {
    const state = this.sessions.get(sessionID)
    if (state) state.abortDetectedAt = undefined
  }

  onSessionDeleted(sessionID: string): void {
    this.sessions.delete(sessionID)
  }
}
