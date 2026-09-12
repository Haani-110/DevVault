import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from './error-codes';

export interface ApiExceptionDetails {
  [key: string]: unknown;
}

/**
 * The shape every API error has on the wire:
 *
 * ```json
 * { "statusCode": 404, "code": "PROJECT_NOT_FOUND", "message": "Project not found" }
 * ```
 *
 * `code` is the stable, machine-readable part clients are meant to branch on;
 * `message` is user-facing copy and may be reworded at any time. Anything the
 * filter cannot classify falls back to a generic 500 with no internals —
 * stack traces, driver errors and upstream response bodies stay in the logs.
 */
export class ApiException extends HttpException {
  readonly code: ErrorCode;

  constructor(
    status: HttpStatus,
    code: ErrorCode,
    message: string,
    details?: ApiExceptionDetails,
  ) {
    super(
      {
        statusCode: status,
        code,
        message,
        ...(details ? { details } : {}),
      },
      status,
    );
    this.code = code;
  }

  static notFound(code: ErrorCode, message: string): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, code, message);
  }

  static badRequest(code: ErrorCode, message: string, details?: ApiExceptionDetails): ApiException {
    return new ApiException(HttpStatus.BAD_REQUEST, code, message, details);
  }

  static conflict(code: ErrorCode, message: string): ApiException {
    return new ApiException(HttpStatus.CONFLICT, code, message);
  }

  static unauthorized(code: ErrorCode, message: string): ApiException {
    return new ApiException(HttpStatus.UNAUTHORIZED, code, message);
  }
}
