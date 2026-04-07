import type { AutopilotPromptSectionSet } from "./prompt-types"

function buildBulletBlock(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n")
}

function buildWorkflowList(items: string[]): string {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n")
}

export function formatPromptSections(sections: AutopilotPromptSectionSet): string {
  return [
    `<Role>\n${sections.role}\n</Role>`,
    `<Primary_Responsibility>\n${sections.primaryResponsibility}\n</Primary_Responsibility>`,
    `<Operating_Bias>\n${buildBulletBlock(sections.operatingBias)}\n</Operating_Bias>`,
    `<Workflow>\n${buildWorkflowList(sections.workflow)}\n</Workflow>`,
    `<Do_Not>\n${buildBulletBlock(sections.doNot)}\n</Do_Not>`,
    `<Completion_Standard>\n${sections.completionStandard}\n</Completion_Standard>`,
  ].join("\n\n")
}
