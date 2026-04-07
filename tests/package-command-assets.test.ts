import { expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"

test("packaged init-deep command is published from the package root", () => {
  expect(existsSync("commands/init-deep.md")).toBe(true)

  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    files?: string[]
  }

  expect(packageJson.files).toContain("commands")

  const commandFiles = [
    "init-deep.md",
    "autopilot.md",
    "autopilot-orchestrator.md",
    "autopilot-implementer.md",
    "autopilot-research.md",
    "autopilot-planner.md",
  ]

  for (const file of commandFiles) {
    expect(readFileSync(`commands/${file}`, "utf8")).toBe(
      readFileSync(`.opencode/commands/${file}`, "utf8"),
    )
  }
})
