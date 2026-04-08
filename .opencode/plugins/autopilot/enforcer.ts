import type { AssistantMessage, Message, PluginInput } from "@opencode-ai/plugin"
import { FilePlanSource } from "./sources/file-plan"
import { SessionTodoSource } from "./sources/session-todo"
import type { TodoSource } from "./sources/types"

const ABORT_WINDOW_MS = 3000
const AUTO_COMPACT_THRESHOLD_TOKENS = 200_000

const CONTINUATION_PROMPT = `Incomplete tasks remain. Continue working on the next pending task.

- Proceed without asking for permission
- Mark each task complete when finished
- Do not stop until all tasks are done`

interface SessionState {
  autopilotActive?: boolean
  abortDetectedAt?: number
  compacting?: boolean
  compactionPending?: boolean
  continueAfterCompaction?: boolean
  tokensSinceCompaction: number
  compactedMessageIDs: Set<string>
}

export class Enforcer {
  private sessions = new Map<string, SessionState>()

  constructor(private ctx: PluginInput) {}

  private getState(sessionID: string): SessionState {
    let state = this.sessions.get(sessionID)
    if (!state) {
      state = {
        tokensSinceCompaction: 0,
        compactedMessageIDs: new Set<string>(),
      }
      this.sessions.set(sessionID, state)
    }
    return state
  }

  private getMessageTokenCount(message: AssistantMessage): number {
    return (
      message.tokens.input +
      message.tokens.output +
      message.tokens.reasoning +
      message.tokens.cache.read +
      message.tokens.cache.write
    )
  }

  private getSources(sessionID: string): TodoSource[] {
    const state = this.getState(sessionID)
    const sources: TodoSource[] = [new FilePlanSource(sessionID)]

    if (state.autopilotActive) {
      sources.push(new SessionTodoSource(this.ctx, sessionID))
    }

    return sources
  }

  markAutopilotActive(sessionID: string): void {
    const state = this.getState(sessionID)
    state.autopilotActive = true
  }

  async onIdle(sessionID: string): Promise<void> {
    const state = this.getState(sessionID)

    if (!state.autopilotActive) return

    if (state.abortDetectedAt) {
      const elapsed = Date.now() - state.abortDetectedAt
      if (elapsed < ABORT_WINDOW_MS) {
        return
      }
      state.abortDetectedAt = undefined
    }

    if (state.compactionPending && !state.compacting) {
      state.compacting = true
      state.compactionPending = false
      state.continueAfterCompaction = true

      try {
        await this.ctx.client.session.summarize({
          path: { id: sessionID },
          query: { directory: this.ctx.directory },
        })
      } catch {
        state.compacting = false
        state.compactionPending = true
        state.continueAfterCompaction = false
      }

      return
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

  async onMessageUpdated(message: Message): Promise<void> {
    if (message.role !== "assistant") return
    if (!message.time.completed || message.summary) return

    const state = this.getState(message.sessionID)
    if (!state.autopilotActive) return
    if (state.compacting || state.compactedMessageIDs.has(message.id)) return

    state.compactedMessageIDs.add(message.id)
    state.tokensSinceCompaction += this.getMessageTokenCount(message)

    if (state.tokensSinceCompaction <= AUTO_COMPACT_THRESHOLD_TOKENS) return
    state.compactionPending = true
  }

  async onSessionCompacted(sessionID: string): Promise<void> {
    const state = this.getState(sessionID)
    state.compacting = false
    state.tokensSinceCompaction = 0
    state.compactedMessageIDs.clear()

    if (!state.continueAfterCompaction) return

    state.continueAfterCompaction = false
    await this.onIdle(sessionID)
  }

  onSessionDeleted(sessionID: string): void {
    this.sessions.delete(sessionID)
  }
}
