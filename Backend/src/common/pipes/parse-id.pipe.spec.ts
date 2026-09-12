import { ParseIdPipe } from './parse-id.pipe';
import { ApiException } from '../errors/api-exception';
import { ErrorCode } from '../errors/error-codes';

describe('ParseIdPipe', () => {
  const pipe = new ParseIdPipe();

  it.each([
    ['a Prisma cuid', 'ckx8d9e2f00000a6q1b2c3d4e'],
    ['a shorter legacy-looking cuid', 'c1234567890'],
  ])('accepts %s', (_label, value) => {
    expect(pipe.transform(value)).toBe(value);
  });

  it.each([
    ['an empty string', ''],
    ['a path traversal attempt', '../../../../etc/passwd'],
    ['a query-string injection', 'abc?userId=1'],
    ['a SQL fragment', "1' OR '1'='1"],
    ['an id that is too short', 'c123'],
    ['an id that is not lowercase-alphanumeric', 'ckx8D9E2F00000A6Q1B2C3D4E'],
  ])('rejects %s with a 400', (_label, value) => {
    expect(() => pipe.transform(value)).toThrow(ApiException);
    try {
      pipe.transform(value);
    } catch (err) {
      expect((err as ApiException).getResponse()).toMatchObject({
        statusCode: 400,
        code: ErrorCode.VALIDATION_FAILED,
      });
    }
  });
});
