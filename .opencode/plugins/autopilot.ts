import type { Plugin } from "@opencode-ai/plugin"
import { Enforcer } from "./autopilot/enforcer"
import { registerAutopilotCommand } from "./autopilot/command"

export const AutopilotPlugin: Plugin = async (ctx) => {
  const enforcer = new Enforcer(ctx)

  return {
    config: async (config) => {
      registerAutopilotCommand(config)
    },
    event: async ({ event }) => {
      const props = event.properties as Record<string, unknown> | undefined
      const sessionID = (
        props?.sessionID ??
        (props?.info as Record<string, unknown> | undefined)?.sessionID
      ) as string | undefined

      if (event.type === "session.idle") {
        if (!sessionID) return
        await enforcer.onIdle(sessionID)
        return
      }

      if (event.type === "session.error") {
        if (!sessionID) return
        const error = props?.error as { name?: string } | undefined
        if (error?.name === "MessageAbortedError" || error?.name === "AbortError") {
          enforcer.onAbort(sessionID)
        }
        return
      }

      if (
        event.type === "message.updated" ||
        event.type === "message.part.updated" ||
        event.type === "tool.execute.before" ||
        event.type === "tool.execute.after"
      ) {
        if (sessionID) enforcer.onActivity(sessionID)
        return
      }

      if (event.type === "session.deleted") {
        const info = props?.info as { id?: string } | undefined
        if (info?.id) enforcer.onSessionDeleted(info.id)
        return
      }
    },
  }
}

export default AutopilotPlugin
