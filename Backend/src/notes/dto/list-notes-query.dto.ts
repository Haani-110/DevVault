import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Query params for `GET /notes`. `projectId` is accepted as an opaque id and
 * simply narrows the caller's own notes, so it does not need to exist — the
 * service scopes everything by `userId` anyway.
 */
export class ListNotesQueryDto {
  @ApiProperty({ required: false, description: 'Filter to one project. Pass an empty string for notes with no project.' })
  @IsString()
  @MaxLength(64)
  @IsOptional()
  projectId?: string;

  @ApiProperty({
    required: false,
    default: false,
    description: 'Return archived notes instead of active ones (the Archived tab needs this: active and archived are separate halves of the list).',
  })
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  @IsOptional()
  archived?: boolean;
}
