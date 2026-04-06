import type { PluginInput } from "@opencode-ai/plugin"
import type { IncompleteResult, TodoSource } from "./types"

interface Todo {
  content: string
  status: string
  priority: string
  id: string
}

export class SessionTodoSource implements TodoSource {
  constructor(
    private ctx: PluginInput,
    private sessionID: string,
  ) {}

  async getIncomplete(): Promise<IncompleteResult | null> {
    let todos: Todo[]
    try {
      const response = await this.ctx.client.session.todo({
        path: { id: this.sessionID },
      })
      todos = (response.data ?? response) as Todo[]
    } catch {
      return null
    }

    if (!todos || todos.length === 0) return null

    const incomplete = todos.filter(
      t => t.status !== "completed" && t.status !== "cancelled"
    )

    if (incomplete.length === 0) return null

    const completed = todos.length - incomplete.length
    return {
      count: incomplete.length,
      total: todos.length,
      context: `${completed}/${todos.length} completed, ${incomplete.length} remaining`,
    }
  }
}
