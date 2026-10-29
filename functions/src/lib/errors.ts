export type ErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'invalid_argument'
  | 'rate_limited'
  | 'conflict'
  | 'hl_not_connected'
  | 'hl_reauth_required'
  | 'hl_api_error'
  | 'llm_error'
  | 'payload_too_large'
  | 'internal'

const STATUS: Record<ErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid_argument: 400,
  rate_limited: 429,
  conflict: 409,
  hl_not_connected: 412,
  hl_reauth_required: 401,
  hl_api_error: 502,
  llm_error: 502,
  payload_too_large: 413,
  internal: 500,
}

export class AppError extends Error {
  readonly status: number
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
    status?: number,
  ) {
    super(message)
    this.status = status ?? STATUS[code]
  }
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err
  if (err && typeof err === 'object' && 'issues' in err) {
    return new AppError('invalid_argument', 'Invalid request', (err as { issues: unknown }).issues)
  }
  return new AppError('internal', 'Unexpected server error')
}
