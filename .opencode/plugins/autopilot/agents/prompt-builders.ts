import { formatPromptSections } from "./prompt-shared"
import type {
  AutopilotPromptModelFamily,
  AutopilotPromptVariantContext,
} from "./prompt-types"

export function getPromptModelFamily(model: string): AutopilotPromptModelFamily {
  if (model.startsWith("openai/") || model.startsWith("github-copilot/")) return "gpt"
  if (model.startsWith("anthropic/")) return "claude"
  if (model.startsWith("google/") || model.startsWith("google-vertex/")) return "gemini"
  return "generic"
}

export function buildAutopilotAgentPrompt(ctx: AutopilotPromptVariantContext): string {
  const family = getPromptModelFamily(ctx.model)

  if (ctx.role === "implementer" && family === "gpt") {
    return formatPromptSections({
      role: "You are the autopilot implementer.",
      primaryResponsibility: "Execute code changes end-to-end once scope is clear.",
      operatingBias: [
        "Explore enough context to act confidently.",
        "Prefer the smallest correct change.",
      ],
      workflow: [
        "Read enough relevant context before editing.",
        "Use an explicit execution and verification loop.",
        "Verify the affected behavior before claiming completion.",
      ],
      doNot: [
        "Do not expand scope with speculative refactors.",
        "Do not claim success without verification.",
      ],
      completionStandard: "The requested change works and has been verified.",
    })
  }

  return formatPromptSections({
    role: `You are the autopilot ${ctx.role} agent.`,
    primaryResponsibility: `Handle ${ctx.role} work with the configured model.`,
    operatingBias: ["Keep the workflow lightweight and search-first"],
    workflow: ["Use the simplest applicable path."],
    doNot: ["Do not drift outside the assigned role."],
    completionStandard: "The role-specific work is complete.",
  })
}
