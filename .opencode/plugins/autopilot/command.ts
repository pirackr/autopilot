import { readFileSync } from "node:fs"
import type { Config } from "@opencode-ai/plugin"
import { resolveAutopilotAgentConfig } from "./agents/resolve"
import type {
  AutopilotAgentID,
  AutopilotAgentSettings,
  ResolvedAutopilotAgentDefinition,
} from "./agents/types"

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/
const AUTOPILOT_COMMAND_FILES = {
  autopilot: { fileName: "autopilot.md" },
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
  resolvedAgent?: ResolvedAutopilotAgentDefinition,
): CommandDefinition {
  const file = readFileSync(new URL(`../../commands/${fileName}`, import.meta.url), "utf8")
  const match = file.match(FRONTMATTER_RE)

  if (!match) {
    return { template: applyResolvedAgentConfig(file.trim(), resolvedAgent) }
  }

  const [, frontmatter, body] = match
  const metadata = parseFrontmatter(frontmatter)

  return {
    description: metadata.description,
    template: applyResolvedAgentConfig(body.trim(), resolvedAgent),
  }
}

function applyResolvedAgentConfig(
  template: string,
  resolvedAgent?: ResolvedAutopilotAgentDefinition,
): string {
  if (!resolvedAgent) return template

  return `${template}\n\nUse the resolved model \`${resolvedAgent.model}\`.\nUse this role prompt: ${resolvedAgent.prompt}`
}

function getAutopilotSettings(config: Config): AutopilotAgentSettings {
  const value = (config as Config & { autopilot?: AutopilotAgentSettings }).autopilot
  return value ?? {}
}

export function loadAutopilotCommandDefinition(): CommandDefinition {
  return loadCommandDefinition(AUTOPILOT_COMMAND_FILES.autopilot.fileName)
}

export function registerAutopilotCommands(config: Config): void {
  config.command ??= {}
  const resolvedAgents = resolveAutopilotAgentConfig(getAutopilotSettings(config))

  for (const [commandName, definition] of Object.entries(AUTOPILOT_COMMAND_FILES)) {
    if (config.command[commandName]) continue

    const resolvedAgent = definition.role
      ? resolvedAgents[definition.role as AutopilotAgentID]
      : undefined

    config.command[commandName] = loadCommandDefinition(definition.fileName, resolvedAgent)
  }
}

export function registerAutopilotCommand(config: Config): void {
  registerAutopilotCommands(config)
}
