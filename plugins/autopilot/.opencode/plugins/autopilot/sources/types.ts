export interface IncompleteResult {
  count: number
  total: number
  context: string
}

export interface TodoSource {
  getIncomplete(): Promise<IncompleteResult | null>
}
