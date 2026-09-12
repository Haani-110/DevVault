import { Prisma } from '@prisma/client';
import { HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from '../errors/api-exception';
import { ErrorCode } from '../errors/error-codes';

/**
 * Resource-level authorization for every user-owned row in the app.
 *
 * The rule this enforces, in one place: a resource is only ever loaded by a
 * query that filters on **both** its id and the authenticated user, e.g.
 *
 * ```ts
 * prisma.project.findFirst({ where: { id: projectId, userId } })
 * ```
 *
 * Doing the ownership check in the query (rather than `findUnique({ id })`
 * followed by `if (row.userId !== userId)`) has two benefits:
 *
 * 1. It cannot be forgotten on a new endpoint by forgetting the `if`, because
 *    there is no `if` to forget.
 * 2. Someone else's resource and a non-existent one are indistinguishable —
 *    both are a 404. A 403 instead would confirm that the id exists, which
 *    turns every id into an enumeration oracle.
 *
 * Services keep their own shaping/serialization; this module only decides
 * "may this user see this row at all".
 */

const PROJECT_FIELDS = { id: true, userId: true, name: true, sourceRepo: true } as const;
const NOTE_FIELDS = { id: true, userId: true, isPinned: true, isFavorite: true, isArchived: true } as const;
const SNIPPET_FIELDS = { id: true, userId: true, isFavorite: true } as const;
const TASK_FIELDS = { id: true, userId: true, projectId: true, status: true } as const;

export type OwnedProject = Prisma.ProjectGetPayload<{ select: typeof PROJECT_FIELDS }>;
export type OwnedNote = Prisma.NoteGetPayload<{ select: typeof NOTE_FIELDS }>;
export type OwnedSnippet = Prisma.SnippetGetPayload<{ select: typeof SNIPPET_FIELDS }>;
export type OwnedTask = Prisma.TaskGetPayload<{ select: typeof TASK_FIELDS }>;

/** A project the caller is allowed to touch — or a 404 that looks like any other 404. */
export async function requireOwnedProject(
  prisma: PrismaService,
  userId: string,
  projectId: string,
): Promise<OwnedProject> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: PROJECT_FIELDS,
  });
  if (!project) throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.PROJECT_NOT_FOUND, 'Project not found');
  return project;
}

export async function requireOwnedNote(
  prisma: PrismaService,
  userId: string,
  noteId: string,
): Promise<OwnedNote> {
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId },
    select: NOTE_FIELDS,
  });
  if (!note) throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NOTE_NOT_FOUND, 'Note not found');
  return note;
}

export async function requireOwnedSnippet(
  prisma: PrismaService,
  userId: string,
  snippetId: string,
): Promise<OwnedSnippet> {
  const snippet = await prisma.snippet.findFirst({
    where: { id: snippetId, userId },
    select: SNIPPET_FIELDS,
  });
  if (!snippet) throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.SNIPPET_NOT_FOUND, 'Snippet not found');
  return snippet;
}

/**
 * Tasks are authorized through their parent project rather than only their own
 * `userId`: a task's project owner is the authority on who may edit it. Checking
 * both in one query also covers a row whose `userId` and `projectId` disagree.
 */
export async function requireOwnedTask(
  prisma: PrismaService,
  userId: string,
  taskId: string,
): Promise<OwnedTask> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId, project: { userId } },
    select: TASK_FIELDS,
  });
  if (!task) throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.TASK_NOT_FOUND, 'Task not found');
  return task;
}
