import type { Message, Plugin } from "@opencode-ai/plugin"
import { Enforcer } from "./autopilot/enforcer"
import { registerAutopilotCommand } from "./autopilot/command"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function getCommandName(props: Record<string, unknown> | undefined): string | undefined {
  if (!props) return undefined

  const info = isRecord(props.info) ? props.info : undefined
  const directCommand = isRecord(props.command) ? props.command : undefined
  const infoCommand = isRecord(info?.command) ? info.command : undefined

  const candidates = [
    props.commandName,
    directCommand?.name,
    directCommand?.id,
    info?.commandName,
    infoCommand?.name,
    infoCommand?.id,
  ]

  return candidates.find(
    (value): value is string => typeof value === "string" && value.length > 0,
  )
}

function isAutopilotCommand(commandName: string | undefined): boolean {
  return commandName === "autopilot" || commandName?.startsWith("autopilot-") === true
}

export const AutopilotPlugin: Plugin = async (ctx) => {
  const enforcer = new Enforcer(ctx)

  return {
    config: async (config) => {
      registerAutopilotCommand(config)
    },
    "shell.env": async (input, output) => {
      if (input.sessionID) {
        output.env.AUTOPILOT_SESSION_ID = input.sessionID
      }
    },
    event: async ({ event }) => {
      const props = event.properties as Record<string, unknown> | undefined
      const sessionID = (
        props?.sessionID ??
        (props?.info as Record<string, unknown> | undefined)?.sessionID
      ) as string | undefined

      if (sessionID && isAutopilotCommand(getCommandName(props))) {
        enforcer.markAutopilotActive(sessionID)
      }

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
        if (event.type === "message.updated") {
          const info = props?.info as Message | undefined
          if (info) await enforcer.onMessageUpdated(info)
        }
        return
      }

      if (event.type === "session.compacted") {
        if (sessionID) enforcer.onSessionCompacted(sessionID)
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
