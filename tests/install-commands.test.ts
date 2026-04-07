import { expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { installCommands } from "../scripts/install-commands.mjs"

test("installCommands copies packaged commands into the OpenCode config directory", () => {
  const root = mkdtempSync(join(tmpdir(), "autopilot-install-commands-"))
  const sourceDir = join(root, "source")
  const targetDir = join(root, "config")

  mkdirSync(sourceDir, { recursive: true })
  writeFileSync(join(sourceDir, "init-deep.md"), "# /init-deep\n")
  writeFileSync(join(sourceDir, "autopilot.md"), "# /autopilot\n")

  installCommands({ sourceDir, targetDir })

  expect(readFileSync(join(targetDir, "commands", "init-deep.md"), "utf8")).toBe(
    "# /init-deep\n",
  )
  expect(readFileSync(join(targetDir, "commands", "autopilot.md"), "utf8")).toBe(
    "# /autopilot\n",
  )
})
