/**
 * Shared types for DC Monitoring (see SPEC / Cursor prompt).
 * metric_schema from component_types drives dynamic form rendering.
 */
export type MetricField = {
  key: string
  label: string
  unit: string
  input_type: "number" | "select"
  required: boolean
  options?: string[]
  min?: number
  max?: number
}

export type ApiResponse<T> = {
  data: T | null
  error: string | null
}
