import { readFileSync } from "node:fs"
import type { Config } from "@opencode-ai/plugin"

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/
const AUTOPILOT_COMMAND_FILES = {
  autopilot: "autopilot.md",
  "autopilot-orchestrator": "autopilot-orchestrator.md",
  "autopilot-implementer": "autopilot-implementer.md",
  "autopilot-research": "autopilot-research.md",
  "autopilot-planner": "autopilot-planner.md",
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

function loadCommandDefinition(fileName: string): CommandDefinition {
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

export function loadAutopilotCommandDefinition(): CommandDefinition {
  return loadCommandDefinition(AUTOPILOT_COMMAND_FILES.autopilot)
}

export function registerAutopilotCommands(config: Config): void {
  config.command ??= {}

  for (const [commandName, fileName] of Object.entries(AUTOPILOT_COMMAND_FILES)) {
    if (config.command[commandName]) continue
    config.command[commandName] = loadCommandDefinition(fileName)
  }
}

export function registerAutopilotCommand(config: Config): void {
  registerAutopilotCommands(config)
}
