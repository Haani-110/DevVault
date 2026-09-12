import { TaskPriority, TaskStatus } from '@prisma/client';

/**
 * Mirrors the Prisma enums for DTO validation. Kept as plain objects rather
 * than re-declared string enums so a value cannot drift from what the database
 * will actually accept.
 */
export const TaskStatusEnum = TaskStatus;
export type TaskStatusEnum = (typeof TaskStatusEnum)[keyof typeof TaskStatusEnum];

export const TaskPriorityEnum = TaskPriority;
export type TaskPriorityEnum = (typeof TaskPriorityEnum)[keyof typeof TaskPriorityEnum];
