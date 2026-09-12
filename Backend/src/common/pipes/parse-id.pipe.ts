import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import { ApiException } from '../errors/api-exception';
import { ErrorCode } from '../errors/error-codes';

/**
 * Every `@id` in this schema is a Prisma cuid (`c` + 24 lowercase alphanumerics),
 * so a value that is not shaped like one cannot match a row. Rejecting it here
 * turns "unknown route parameter" into a 400 instead of a database round trip
 * and a 500-shaped surprise, and keeps a caller-supplied id from carrying path
 * or query fragments into URLs built from it (the GitHub API calls in
 * `ImportService` interpolate user-supplied segments the same way).
 *
 * The length is a range rather than exactly 24 because cuid is a convention, not
 * a fixed-width format — older rows may differ, and matching a cuid shape is a
 * fast pre-filter, not a uniqueness claim.
 */
const CUID = /^c[a-z0-9]{10,40}$/;

@Injectable()
export class ParseIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !CUID.test(value)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, 'Malformed id');
    }
    return value;
  }
}
