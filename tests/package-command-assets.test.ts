import { expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"

test("packaged init-deep command is published from the package root", () => {
  expect(existsSync("commands/init-deep.md")).toBe(true)

  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    files?: string[]
  }

  expect(packageJson.files).toContain("commands")
  expect(readFileSync("commands/init-deep.md", "utf8")).toBe(
    readFileSync(".opencode/commands/init-deep.md", "utf8"),
  )
})
