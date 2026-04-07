import { getDefaultAgentDefinitions } from "./defaults"
import { AUTOPILOT_SUBSCRIPTION_PRESETS } from "./presets"
import type {
  AutopilotAgentID,
  AutopilotAgentSettings,
  AutopilotSubscriptionPreset,
  ResolvedAutopilotAgentDefinition,
} from "./types"

const BUILTIN_AGENT_IDS: AutopilotAgentID[] = [
  "orchestrator",
  "implementer",
  "research",
  "planner",
]

function isPreset(value: string | undefined): value is AutopilotSubscriptionPreset {
  return value === "free" || value === "pro" || value === "max"
}

export { getDefaultAgentDefinitions } from "./defaults"

export function resolveAutopilotAgentConfig(
  settings: AutopilotAgentSettings = {},
): Record<AutopilotAgentID, ResolvedAutopilotAgentDefinition> {
  const defaults = getDefaultAgentDefinitions()
  const presetName = isPreset(settings.subscription) ? settings.subscription : undefined
  const preset = presetName ? AUTOPILOT_SUBSCRIPTION_PRESETS[presetName] : undefined

  return Object.fromEntries(
    BUILTIN_AGENT_IDS.map((id) => {
      const base = defaults[id]
      const presetOverride = preset?.[id] ?? {}
      const userOverride = settings.agents?.[id] ?? {}

      return [
        id,
        {
          ...base,
          ...presetOverride,
          ...userOverride,
          subscriptionSource: presetName ?? "default",
        },
      ]
    }),
  ) as Record<AutopilotAgentID, ResolvedAutopilotAgentDefinition>
}
