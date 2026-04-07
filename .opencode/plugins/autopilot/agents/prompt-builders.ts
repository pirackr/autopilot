import { formatPromptSections } from "./prompt-shared"
import { AUTOPILOT_PROMPT_VARIANTS } from "./prompt-variants"
import type {
  AutopilotPromptModelFamily,
  AutopilotPromptSectionSet,
  AutopilotPromptVariantContext,
} from "./prompt-types"

export function getPromptModelFamily(model: string): AutopilotPromptModelFamily {
  if (model.startsWith("openai/") || model.startsWith("github-copilot/")) return "gpt"
  if (model.startsWith("anthropic/")) return "claude"
  if (model.startsWith("google/") || model.startsWith("google-vertex/")) return "gemini"
  return "generic"
}

function mergeSections(
  base: AutopilotPromptSectionSet,
  override?: Partial<AutopilotPromptSectionSet>,
): AutopilotPromptSectionSet {
  return {
    ...base,
    ...override,
  }
}

export function buildAutopilotAgentPrompt(ctx: AutopilotPromptVariantContext): string {
  const family = getPromptModelFamily(ctx.model)
  const variants = AUTOPILOT_PROMPT_VARIANTS[ctx.role]
  const familyVariant = variants.families?.[family]
  const costTierVariant = familyVariant ? undefined : variants.costTiers?.[ctx.costTier]

  return formatPromptSections(
    mergeSections(
      mergeSections(variants.default, costTierVariant),
      familyVariant,
    ),
  )
}
