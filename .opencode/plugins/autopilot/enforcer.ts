import type { AssistantMessage, Message, PluginInput } from "@opencode-ai/plugin"
import { readPlanSummary } from "./summary-file"
import {
  clearPersistedPlanSignature,
  readPersistedPlanSignature,
  readPlanState,
  writePersistedPlanSignature,
} from "./sources/plan-state"
import { FilePlanSource } from "./sources/file-plan"
import { SessionTodoSource } from "./sources/session-todo"
import type { TodoSource } from "./sources/types"

const ABORT_WINDOW_MS = 3000
const AUTO_COMPACT_THRESHOLD_TOKENS = 200_000

const CONTINUATION_PROMPT = `Incomplete tasks remain. Continue working on the next pending task.

- Proceed without asking for permission
- Mark each task complete when finished
- Do not stop until all tasks are done`

const INVALID_PLAN_PROMPT = `Autopilot stopped because the active plan for this session could not be resolved.

- The plan marker exists, but the referenced plan is missing, unreadable, or no longer contains checklist tasks.
- I am not continuing from session todos because this session is in plan-backed mode.

Please tell me what changed and restart /autopilot with a valid plan if you want to continue.`

interface SessionState {
  autopilotActive?: boolean
  planBacked?: boolean
  abortDetectedAt?: number
  compacting?: boolean
  compactionPending?: boolean
  continueAfterCompaction?: boolean
  tokensSinceCompaction: number
  compactedMessageIDs: Set<string>
}

function buildPlanContinuationPrompt(args: {
  status: string
  currentTask: string
  nextStep: string
  blockers: string
  recentProgress: string
  shouldReconcile: boolean
  missingSections: string[]
}): string {
  const lines = [
    "Incomplete tasks remain in the active plan. Continue working on the next pending task.",
    "",
    "- Proceed without asking for permission.",
    "- Use the active plan as the source of truth.",
    "- Update the summary file after every completed task and after any meaningful progress.",
    "- Refresh Current Task, Next Step, Blockers, and Recent Progress before yielding control.",
  ]

  if (args.shouldReconcile) {
    lines.push("- reconcile the summary with the current checklist before proceeding.")
  }

  if (args.missingSections.length > 0) {
    lines.push(`- Restore the canonical summary sections: ${args.missingSections.join(", ")}.`)
  }

  lines.push(
    "- If blockers changed, record them before stopping.",
    "",
    `[Plan Status: ${args.status}]`,
    `[Current Task: ${args.currentTask || "(missing)"}]`,
    `[Next Step: ${args.nextStep || "(missing)"}]`,
    `[Blockers: ${args.blockers || "(missing)"}]`,
  )

  if (args.recentProgress) lines.push(`[Recent Progress: ${args.recentProgress}]`)

  return lines.join("\n")
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
    const sources: TodoSource[] = []

    if (!state.planBacked) {
      sources.push(new FilePlanSource(sessionID))
    }

    if (state.autopilotActive) {
      sources.push(new SessionTodoSource(this.ctx, sessionID))
    }

    return sources
  }

  markAutopilotActive(sessionID: string): void {
    const state = this.getState(sessionID)
    state.autopilotActive = true
  }

  private async injectPrompt(sessionID: string, prompt: string): Promise<void> {
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

  private async continueGeneric(sessionID: string): Promise<void> {
    const sources = this.getSources(sessionID)
    let result = null
    for (const source of sources) {
      result = await source.getIncomplete()
      if (result && result.count > 0) break
    }

    if (!result || result.count === 0) return
    await this.injectPrompt(sessionID, `${CONTINUATION_PROMPT}\n\n[Status: ${result.context}]`)
  }

  private async continuePlanBacked(sessionID: string, state: SessionState): Promise<void> {
    const planState = readPlanState(sessionID)

    if (!planState) {
      state.autopilotActive = false
      state.planBacked = false
      clearPersistedPlanSignature(sessionID)
      await this.injectPrompt(sessionID, INVALID_PLAN_PROMPT)
      return
    }

    if (planState.unchecked === 0) return

    state.planBacked = true

    const previousSignature = readPersistedPlanSignature(sessionID)
    const summary = readPlanSummary(planState.planPath, planState.firstUncheckedTask)
    const shouldReconcile = (
      previousSignature !== null && previousSignature !== planState.planSignature
    ) || summary.requiresReconcile

    const prompt = buildPlanContinuationPrompt({
      status: planState.context,
      currentTask: summary.currentTask,
      nextStep: summary.nextStep,
      blockers: summary.blockers,
      recentProgress: summary.recentProgress,
      shouldReconcile,
      missingSections: summary.missingSections,
    })

    writePersistedPlanSignature(sessionID, planState.planSignature)
    await this.injectPrompt(sessionID, prompt)
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

    const planState = readPlanState(sessionID)
    if (!planState && !state.planBacked) {
      await this.continueGeneric(sessionID)
      return
    }

    await this.continuePlanBacked(sessionID, state)
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
