import { copyFileSync, mkdirSync, readdirSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, extname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PACKAGE_ROOT = resolve(SCRIPT_DIR, "..")

export function installCommands({
  sourceDir = resolve(PACKAGE_ROOT, ".opencode/commands"),
  targetDir = process.env.OPENCODE_CONFIG_DIR || join(homedir(), ".config/opencode"),
} = {}) {
  const commandDir = join(targetDir, "commands")

  mkdirSync(commandDir, { recursive: true })

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    if (!entry.isFile() || extname(entry.name) !== ".md") continue

    copyFileSync(join(sourceDir, entry.name), join(commandDir, entry.name))
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  installCommands()
}
