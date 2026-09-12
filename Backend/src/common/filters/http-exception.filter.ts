import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { ApiException } from '../errors/api-exception';
import { ErrorCode } from '../errors/error-codes';

/**
 * Turns everything thrown inside a request into one predictable shape:
 *
 * ```json
 * { "statusCode": 404, "code": "PROJECT_NOT_FOUND", "message": "Project not found" }
 * ```
 *
 * Two rules matter most here:
 *
 * 1. **Nothing unexpected is echoed to the client.** Any error that is not an
 *    `HttpException` (a driver failure, a `TypeError`, whatever an upstream
 *    library threw) becomes a generic 500 and is written to the log instead —
 *    those messages routinely contain connection strings, file paths and
 *    response bodies from other services.
 * 2. **Prisma errors are translated, not forwarded.** A raw Prisma message
 *    names tables and columns, which is exactly the internal detail an API
 *    should never leak, but it is also genuinely useful information to act on
 *    (a unique-violation is a conflict, a missing row is a 404).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, body } = this.describe(exception, request.method, request.url);

    response.status(status).json(body);
  }

  private describe(exception: unknown, method: string, url: string) {
    if (exception instanceof ApiException) {
      const payload = exception.getResponse() as {
        statusCode: number;
        code: ErrorCode;
        message: string;
        details?: unknown;
      };
      return {
        status: payload.statusCode,
        body: {
          statusCode: payload.statusCode,
          code: payload.code,
          message: payload.message,
          ...(payload.details ? { details: payload.details } : {}),
          path: url,
          timestamp: new Date().toISOString(),
        },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const translated = this.translatePrisma(exception);
      return {
        status: translated.status,
        body: { ...translated.body, path: url, timestamp: new Date().toISOString() },
      };
    }

    if (exception instanceof HttpException) {
      return { status: exception.getStatus(), body: this.fromHttpException(exception, url) };
    }

    const detail = exception instanceof Error ? `${exception.name}: ${exception.message}` : String(exception);
    this.logger.error(`Unhandled error on ${method} ${url} — ${detail}`, exception instanceof Error ? exception.stack : undefined);

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: ErrorCode.INTERNAL_ERROR,
        // Deliberately vague on the wire; the real reason is in the log above.
        message: 'Something went wrong on our side. Please try again.',
        path: url,
        timestamp: new Date().toISOString(),
      },
    };
  }

  private fromHttpException(exception: HttpException, url: string) {
    const status = exception.getStatus();
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return { statusCode: status, code: this.codeForStatus(status), message: response, path: url, timestamp: new Date().toISOString() };
    }

    const payload = response as { message?: string | string[]; error?: string };
    const message = payload.message ?? exception.message;

    // ValidationPipe reports one message per bad field; keep the list but put it
    // under `details` so `message` stays a single displayable string.
    if (Array.isArray(message)) {
      return {
        statusCode: status,
        code: ErrorCode.VALIDATION_FAILED,
        message: message[0] ?? 'Invalid request',
        details: message,
        path: url,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      statusCode: status,
      code: this.codeForStatus(status),
      message,
      path: url,
      timestamp: new Date().toISOString(),
    };
  }

  private translatePrisma(error: Prisma.PrismaClientKnownRequestError) {
    // P2002: unique constraint. The field name is safe to show (it's part of
    // the public DTO anyway) and tells the user what to fix.
    if (error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? (error.meta?.target as string[]).join(', ') : undefined;
      return {
        status: HttpStatus.CONFLICT,
        body: {
          statusCode: HttpStatus.CONFLICT,
          code: ErrorCode.CONFLICT,
          message: target ? `${target} is already taken` : 'That value is already taken',
          timestamp: new Date().toISOString(),
        },
      };
    }

    // P2025: the row a write targeted is gone — the same answer as "not yours".
    if (error.code === 'P2025') {
      return {
        status: HttpStatus.NOT_FOUND,
        body: {
          statusCode: HttpStatus.NOT_FOUND,
          code: ErrorCode.NOT_FOUND_GENERIC,
          message: 'The item you are looking for is no longer there',
          timestamp: new Date().toISOString(),
        },
      };
    }

    // P2003: FK constraint (e.g. attaching a row to a parent that was deleted).
    if (error.code === 'P2003') {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          statusCode: HttpStatus.BAD_REQUEST,
          code: ErrorCode.VALIDATION_FAILED,
          message: 'The referenced item does not exist',
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Anything else (P2014, P2016, connection pool exhaustion, …) stays
    // internal: log it, hand the client a 500.
    this.logger.error(`Prisma error ${error.code}`, error.stack);
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Something went wrong on our side. Please try again.',
        timestamp: new Date().toISOString(),
      },
    };
  }

  private codeForStatus(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_FAILED;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND_GENERIC;
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT;
      default:
        return status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.VALIDATION_FAILED;
    }
  }
}
