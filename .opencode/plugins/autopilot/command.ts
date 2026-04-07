import { readFileSync } from "node:fs"
import type { Config } from "@opencode-ai/plugin"

const COMMAND_FILE = new URL("../../commands/autopilot.md", import.meta.url)
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/

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

export function loadAutopilotCommandDefinition(): CommandDefinition {
  const file = readFileSync(COMMAND_FILE, "utf8")
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

export function registerAutopilotCommand(config: Config): void {
  config.command ??= {}

  if (config.command.autopilot) return

  config.command.autopilot = loadAutopilotCommandDefinition()
}
