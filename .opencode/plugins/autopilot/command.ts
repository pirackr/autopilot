import { readFileSync } from "node:fs"
import type { Config } from "@opencode-ai/plugin"
import { resolveAutopilotAgentConfig } from "./agents/resolve"
import type {
  AutopilotAgentID,
  AutopilotAgentOverride,
  AutopilotAgentSettings,
  ResolvedAutopilotAgentDefinition,
} from "./agents/types"

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/
const AUTOPILOT_COMMAND_FILES = {
  autopilot: {
    fileName: "autopilot.md",
    role: "orchestrator",
  },
  "autopilot-orchestrator": {
    fileName: "autopilot-orchestrator.md",
    role: "orchestrator",
  },
  "autopilot-implementer": {
    fileName: "autopilot-implementer.md",
    role: "implementer",
  },
  "autopilot-research": {
    fileName: "autopilot-research.md",
    role: "research",
  },
  "autopilot-planner": {
    fileName: "autopilot-planner.md",
    role: "planner",
  },
} as const

type CommandDefinition = {
  description?: string
  template: string
  agent?: string
  model?: string
}

type AgentDefinition = {
  description?: string
  prompt?: string
  model?: string
}

type AutopilotConfig = Config & {
  agent?: Record<string, AgentDefinition>
  autopilot?: AutopilotAgentSettings
}

function getAutopilotAgentName(role: AutopilotAgentID): string {
  return `autopilot-${role}`
}

function getAgentOverrides(
  config: AutopilotConfig,
): Partial<Record<AutopilotAgentID, AutopilotAgentOverride>> {
  return Object.fromEntries(
    (["orchestrator", "implementer", "research", "planner"] as const)
      .map((role) => {
        const agent = config.agent?.[getAutopilotAgentName(role)]
        if (!agent) return null

        return [
          role,
          {
            model: agent.model,
            prompt: agent.prompt,
          },
        ] as const
      })
      .filter(
        (
          entry,
        ): entry is readonly [AutopilotAgentID, AutopilotAgentOverride] => entry !== null,
      ),
  )
}

function parseFrontmatter(frontmatter: string): Record<string, string> {
  const entries = frontmatter
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(":")
      if (separator === -1) return null

      const key = line.slice(0, separator).trim()
      const rawValue = line.slice(separator + 1).trim()
      const value = rawValue.replace(/^"|"$/g, "")

      return [key, value] as const
    })
    .filter((entry): entry is readonly [string, string] => entry !== null)

  return Object.fromEntries(entries)
}

function loadCommandDefinition(
  fileName: string,
): CommandDefinition {
  const file = readFileSync(new URL(`../../commands/${fileName}`, import.meta.url), "utf8")
  const match = file.match(FRONTMATTER_RE)

  if (!match) {
    return { template: file.trim() }
  }

  const [, frontmatter, body] = match
  const metadata = parseFrontmatter(frontmatter)

  return {
    description: metadata.description,
    template: body.trim(),
  }
}

function getAutopilotSettings(config: Config): AutopilotAgentSettings {
  const typedConfig = config as AutopilotConfig
  const value = typedConfig.autopilot ?? {}
  const agentOverrides = getAgentOverrides(typedConfig)

  return {
    ...value,
    agents: {
      ...value.agents,
      ...agentOverrides,
    },
  }
}

function registerAutopilotAgent(
  config: AutopilotConfig,
  role: AutopilotAgentID,
  resolvedAgent: ResolvedAutopilotAgentDefinition,
): string {
  const agentName = getAutopilotAgentName(role)
  config.agent ??= {}
  config.agent[agentName] = {
    ...config.agent[agentName],
    description: resolvedAgent.description,
    model: config.agent[agentName]?.model ?? resolvedAgent.model,
    prompt: config.agent[agentName]?.prompt ?? resolvedAgent.prompt,
  }
  return agentName
}

export function loadAutopilotCommandDefinition(): CommandDefinition {
  return loadCommandDefinition(AUTOPILOT_COMMAND_FILES.autopilot.fileName)
}

export function registerAutopilotCommands(config: Config): void {
  config.command ??= {}
  const resolvedAgents = resolveAutopilotAgentConfig(getAutopilotSettings(config))
  const autopilotConfig = config as AutopilotConfig

  for (const [commandName, definition] of Object.entries(AUTOPILOT_COMMAND_FILES)) {
    if (config.command[commandName]) continue

    const resolvedAgent = definition.role
      ? resolvedAgents[definition.role as AutopilotAgentID]
      : undefined

    const command = loadCommandDefinition(definition.fileName)

    if (resolvedAgent && definition.role) {
      command.agent = registerAutopilotAgent(
        autopilotConfig,
        definition.role as AutopilotAgentID,
        resolvedAgent,
      )
      command.model = resolvedAgent.model
    }

    config.command[commandName] = command
  }
}

export function registerAutopilotCommand(config: Config): void {
  registerAutopilotCommands(config)
}
