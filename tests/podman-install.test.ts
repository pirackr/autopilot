import { expect, test } from "bun:test"
import { spawnSync } from "node:child_process"

const RUN_PODMAN_INSTALL_TEST = process.env.RUN_PODMAN_INSTALL_TEST === "1"
const PODMAN_IMAGE = process.env.PODMAN_TEST_IMAGE || "docker.io/node:22-bookworm-slim"
const COMMAND_FILES = [
  "init-deep.md",
  "autopilot.md",
  "autopilot-orchestrator.md",
  "autopilot-implementer.md",
  "autopilot-research.md",
  "autopilot-planner.md",
]

function formatFailure(result: ReturnType<typeof spawnSync>) {
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n")
  return output.length > 0 ? output : "command produced no output"
}

test(
  "podman installs OpenCode and this plugin",
  { timeout: 10 * 60 * 1000 },
  () => {
    if (!RUN_PODMAN_INSTALL_TEST) return

    const podmanCheck = spawnSync("podman", ["--version"], { encoding: "utf8" })
    expect(podmanCheck.status, formatFailure(podmanCheck)).toBe(0)

    const installScript = [
      "set -eu",
      "npm install --global opencode-ai",
      "mkdir -p /tmp/dist",
      "npm pack /workspace/plugin --pack-destination /tmp/dist >/dev/null",
      "tarball=$(ls /tmp/dist/*.tgz)",
      "OPENCODE_CONFIG_DIR=/tmp/config/opencode npm install --global \"$tarball\"",
      "mkdir -p /tmp/project",
      "cd /tmp/project",
      "HOME=/tmp/home XDG_CONFIG_HOME=/tmp/config opencode plugin /workspace/plugin",
      "test -f .opencode/opencode.json",
      "node -e 'const fs = require(\"node:fs\"); const config = JSON.parse(fs.readFileSync(\".opencode/opencode.json\", \"utf8\")); if (!Array.isArray(config.plugin) || !config.plugin.includes(\"/workspace/plugin\")) throw new Error(`unexpected plugin config: ${JSON.stringify(config)}`)'",
      `node -e 'const fs = require("node:fs"); const files = ${JSON.stringify(COMMAND_FILES)}; for (const file of files) { if (!fs.existsSync("/tmp/config/opencode/commands/" + file)) throw new Error("missing command: " + file) }'`,
    ].join(" && ")

    const result = spawnSync(
      "podman",
      [
        "run",
        "--rm",
        "--volume",
        `${process.cwd()}:/workspace/plugin:ro`,
        PODMAN_IMAGE,
        "sh",
        "-lc",
        installScript,
      ],
      {
        encoding: "utf8",
        timeout: 10 * 60 * 1000,
      },
    )

    expect(result.status, formatFailure(result)).toBe(0)
    expect(result.stdout).toContain("Installed /workspace/plugin")
  },
)
