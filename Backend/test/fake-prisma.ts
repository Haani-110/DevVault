/**
 * An in-memory stand-in for `PrismaService`, shared by the unit specs and the
 * e2e specs.
 *
 * It implements the small slice of the Prisma client this app actually uses
 * (`findUnique`/`findFirst`/`findMany`/`count`/`create`/`createMany`/`update`/
 * `updateMany`/`deleteMany`, plus `select`/`include`/`orderBy` and
 * `$transaction`) with real
 * filtering, so an endpoint that forgets to scope a query by `userId` fails a
 * test here the same way it would leak data in production.
 *
 * What it deliberately does NOT do:
 *  - SQL, migrations, or anything about Postgres.
 *  - Database-level constraints. Uniqueness IS enforced (a duplicate
 *    `email`/`username`/`provider+providerUid` throws a P2002-shaped error,
 *    because the error filter's translation of that code needs to be
 *    exercisable), and cascades are emulated where the schema declares them.
 *  - Concurrency. Every operation is synchronous, so two racing writes are not
 *    a thing this can model.
 *
 * Anything that depends on real storage behaviour belongs in `prisma`-against-
 * Postgres checks (see the "Migrations" section of Backend/README.md), not here.
 */

type Row = Record<string, any>;
type ModelName =
  | 'user'
  | 'note'
  | 'snippet'
  | 'project'
  | 'task'
  | 'oAuthAccount'
  | 'passwordReset'
  | 'importJob';

interface ModelSpec {
  /** Field combinations with a unique constraint on them. */
  unique?: string[][];
  /** Values the schema (or Prisma `@default`) supplies when a create omits them. */
  defaults?: () => Row;
  /**
   * Children removed with the parent, mirroring `onDelete: Cascade` in
   * schema.prisma. Kept in sync by hand on purpose: the row that documents it
   * is the migration, and a fake that silently diverges is worse than one that
   * is explicit about not modelling it.
   */
  cascade?: { model: ModelName; foreignKey: string }[];
}

const now = () => new Date();

const SPECS: Record<ModelName, ModelSpec> = {
  user: {
    unique: [['email'], ['username']],
    defaults: () => ({
      role: 'USER',
      bio: null,
      avatarUrl: null,
      location: null,
      website: null,
      githubUrl: null,
      linkedinUrl: null,
      passwordHash: null,
      passwordChangedAt: null,
      createdAt: now(),
      updatedAt: now(),
    }),
    cascade: [
      { model: 'note', foreignKey: 'userId' },
      { model: 'snippet', foreignKey: 'userId' },
      { model: 'project', foreignKey: 'userId' },
      { model: 'task', foreignKey: 'userId' },
      { model: 'oAuthAccount', foreignKey: 'userId' },
      { model: 'passwordReset', foreignKey: 'userId' },
      { model: 'importJob', foreignKey: 'userId' },
    ],
  },
  note: {
    defaults: () => ({
      projectId: null,
      isPinned: false,
      isFavorite: false,
      isArchived: false,
      tags: [],
      generatedByAI: false,
      sourcePath: null,
      importJobId: null,
      createdAt: now(),
      updatedAt: now(),
    }),
  },
  snippet: {
    defaults: () => ({
      projectId: null,
      description: null,
      isFavorite: false,
      tags: [],
      generatedByAI: false,
      sourcePath: null,
      importJobId: null,
      createdAt: now(),
      updatedAt: now(),
    }),
  },
  project: {
    defaults: () => ({ description: null, color: '#6366f1', sourceRepo: null, createdAt: now(), updatedAt: now() }),
    cascade: [{ model: 'note', foreignKey: 'projectId' }, { model: 'snippet', foreignKey: 'projectId' }, { model: 'task', foreignKey: 'projectId' }],
  },
  task: {
    defaults: () => ({
      projectId: null,
      description: null,
      status: 'BACKLOG',
      priority: 'MEDIUM',
      dueDate: null,
      completedAt: null,
      sourcePath: null,
      importJobId: null,
      generatedByAI: false,
      createdAt: now(),
      updatedAt: now(),
    }),
  },
  oAuthAccount: {
    unique: [['provider', 'providerUid']],
    defaults: () => ({ refreshToken: null, scope: null, createdAt: now(), updatedAt: now() }),
  },
  passwordReset: {
    unique: [['token']],
    defaults: () => ({ used: false, createdAt: now() }),
  },
  importJob: {
    defaults: () => ({
      projectId: null,
      repoFullName: null,
      branch: null,
      status: 'PENDING',
      stage: 'CONNECTED',
      stageLabel: 'Repository connected',
      progress: 0,
      totalFiles: 0,
      processedFiles: 0,
      currentFile: null,
      totalBatches: 0,
      completedBatches: 0,
      notesCreated: 0,
      snippetsCreated: 0,
      tasksCreated: 0,
      filesAnalyzed: 0,
      warning: null,
      error: null,
      startedAt: null,
      completedAt: null,
      createdAt: now(),
      updatedAt: now(),
    }),
  },
};

/** Relations, so `include` can be answered the way Prisma would. */
const RELATIONS: Record<string, Record<string, { model: ModelName; localField: string; foreignField: string; many?: boolean }>> = {
  note: { project: { model: 'project', localField: 'projectId', foreignField: 'id' } },
  snippet: { project: { model: 'project', localField: 'projectId', foreignField: 'id' } },
  task: { project: { model: 'project', localField: 'projectId', foreignField: 'id' } },
  project: {
    notes: { model: 'note', localField: 'id', foreignField: 'projectId', many: true },
    snippets: { model: 'snippet', localField: 'id', foreignField: 'projectId', many: true },
    tasks: { model: 'task', localField: 'id', foreignField: 'projectId', many: true },
  },
  user: { oauthAccounts: { model: 'oAuthAccount', localField: 'id', foreignField: 'userId', many: true } },
  oAuthAccount: { user: { model: 'user', localField: 'userId', foreignField: 'id' } },
  passwordReset: { user: { model: 'user', localField: 'userId', foreignField: 'id' } },
  importJob: { project: { model: 'project', localField: 'projectId', foreignField: 'id' } },
};

/** Shaped like a real Prisma cuid (`c` + 24 lowercase base36 chars) so id-format
 * validation in the app sees the same thing it would see in production. */
function cuid(): string {
  let out = 'c';
  while (out.length < 25) out += Math.random().toString(36).slice(2);
  return out.slice(0, 25);
}

function matchesCondition(value: unknown, condition: unknown): boolean {
  if (condition === null || condition === undefined) return value === condition;

  if (typeof condition === 'object' && !Array.isArray(condition) && !(condition instanceof Date)) {
    const ops = condition as Record<string, unknown>;
    return Object.entries(ops).every(([op, operand]) => {
      switch (op) {
        case 'in':
          return Array.isArray(operand) && operand.includes(value);
        case 'notIn':
          return Array.isArray(operand) && !operand.includes(value);
        case 'not':
          return !matchesCondition(value, operand);
        case 'lt':
          return compare(value, operand) < 0;
        case 'lte':
          return compare(value, operand) <= 0;
        case 'gt':
          return compare(value, operand) > 0;
        case 'gte':
          return compare(value, operand) >= 0;
        case 'contains':
          return String(value ?? '')
            .toLowerCase()
            .includes(String(operand).toLowerCase());
        case 'startsWith':
          return String(value ?? '').toLowerCase().startsWith(String(operand).toLowerCase());
        case 'mode':
          return true; // case-insensitive matching is already the fake's default
        default:
          throw new Error(`FakePrisma: unsupported filter operator "${op}" — add it if a test needs it`);
      }
    });
  }

  if (value instanceof Date || condition instanceof Date) return compare(value, condition) === 0;
  return value === condition;
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  return String(a) < String(b) ? -1 : 1;
}

function matchesWhere(row: Row, where: Row | undefined): boolean {
  if (!where) return true;

  return Object.entries(where).every(([field, condition]) => {
    if (field === 'AND') return (condition as Row[]).every((part) => matchesWhere(row, part));
    if (field === 'OR') return (condition as Row[]).some((part) => matchesWhere(row, part));
    // Prisma's composite unique key, e.g. `provider_providerUid`.
    if (field.includes('_') && condition && typeof condition === 'object' && !isOperatorObject(condition)) {
      const parts = field.split('_');
      if (parts.every((part) => part in row)) {
        return parts.every((part) => matchesCondition(row[part], (condition as Row)[part]));
      }
    }
    return matchesCondition(row[field], condition);
  });
}

function isOperatorObject(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    Object.keys(value).length > 0 &&
    Object.keys(value).every((key) =>
      ['in', 'notIn', 'not', 'lt', 'lte', 'gt', 'gte', 'contains', 'startsWith', 'mode'].includes(key),
    )
  );
}

function sortRows(rows: Row[], orderBy: unknown): Row[] {
  const clauses = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []) as Row[];
  if (clauses.length === 0) return rows;

  return [...rows].sort((left, right) => {
    for (const clause of clauses) {
      const [field, direction] = Object.entries(clause)[0] as [string, 'asc' | 'desc' | { sort: string }];
      const dir = typeof direction === 'object' ? direction.sort : direction;
      const result = compare(left[field], right[field]);
      if (result !== 0) return dir === 'desc' ? -result : result;
    }
    return 0;
  });
}

/**
 * A tiny stand-in for one Prisma model client.
 *
 * All the returned rows are clones: a service that mutates what it read should
 * not be able to corrupt the store, and tests should not pass by accident
 * because they held the only copy.
 */
class FakeModelClient {
  rows: Row[] = [];

  constructor(private readonly name: ModelName, private readonly store: FakePrisma) {}

  private get spec(): ModelSpec {
    return SPECS[this.name];
  }

  private clone(row: Row): Row {
    return structuredClone(row);
  }

  private project(row: Row, args: { select?: Row; include?: Row }): Row {
    let output = this.clone(row);

    const include = args.include ?? {};
    for (const [relation, config] of Object.entries(include)) {
      if (config === false || config === undefined) continue;
      if (relation === '_count') {
        const counts: Row = {};
        for (const field of Object.keys((config as { select: Row }).select ?? {})) {
          const rel = RELATIONS[this.name]?.[field];
          counts[field] = rel ? this.store.table(rel.model).countBy(rel.foreignField, output[rel.localField]) : 0;
        }
        output._count = counts;
        continue;
      }

      const rel = RELATIONS[this.name]?.[relation];
      if (!rel) throw new Error(`FakePrisma: ${this.name} has no relation "${relation}" — add it to RELATIONS`);

      const related = this.store
        .table(rel.model)
        .rows.filter((child) => child[rel.foreignField] === output[rel.localField])
        .map((child) => this.clone(child));

      output[relation] = rel.many
        ? related
        : related[0] === undefined
          ? null
          : typeof config === 'object' && (config as Row).select
            ? pick(related[0], (config as { select: Row }).select)
            : related[0];
      if (rel.many && typeof config === 'object' && (config as Row).select) {
        output[relation] = (output[relation] as Row[]).map((r) => pick(r, (config as { select: Row }).select));
      }
    }

    if (args.select) {
      output = pick(output, args.select);
      // A select that names a relation means "only that relation, and nothing else".
      for (const [key, value] of Object.entries(args.select)) {
        if (value && typeof value === 'object') {
          const rel = RELATIONS[this.name]?.[key];
          if (!rel) continue;
          const related = this.store
            .table(rel.model)
            .rows.filter((child) => child[rel.foreignField] === row[rel.localField]);
          output[key] = rel.many
            ? related.map((r) => pick(this.clone(r), (value as { select?: Row }).select ?? {}))
            : related[0]
              ? pick(this.clone(related[0]), (value as { select?: Row }).select ?? {})
              : null;
        }
      }
    }

    return output;
  }

  private assertUnique(candidate: Row, ignoringId?: string): void {
    for (const fields of this.spec.unique ?? []) {
      const conflict = this.rows.find(
        (row) => row.id !== ignoringId && fields.every((field) => matchesCondition(row[field], candidate[field])),
      );
      if (conflict) {
        throw prismaUniqueError(fields.join(', '));
      }
    }
  }

  countBy(field: string, value: unknown): number {
    return this.rows.filter((row) => row[field] === value).length;
  }

  // Every method is `async`, because that is the interface the app is written
  // against: real Prisma returns promises, and code like
  // `update(...).catch(...)` (used for progress writes that must never break an
  // import) only behaves correctly against a double that does the same.
  /** Prisma's `findUnique`: the first row matching `where`, or null. */
  async findUnique(args: Row = {}): Promise<Row | null> {
    return this.findFirst(args);
  }

  async findFirst(args: Row = {}): Promise<Row | null> {
    const row = sortRows(this.rows.filter((candidate) => matchesWhere(candidate, args.where)), args.orderBy)[0];
    return row ? this.project(row, args) : null;
  }

  async findMany(args: Row = {}): Promise<Row[]> {
    let rows = sortRows(this.rows.filter((row) => matchesWhere(row, args.where)), args.orderBy);
    if (typeof args.take === 'number') rows = rows.slice(0, args.take);
    if (typeof args.skip === 'number') rows = rows.slice(args.skip);
    return rows.map((row) => this.project(row, args));
  }

  async count(args: Row = {}): Promise<number> {
    return this.rows.filter((row) => matchesWhere(row, args.where)).length;
  }

  async create(args: Row): Promise<Row> {
    const data = { ...this.defaults(), ...(args.data as Row) };
    if (!data.id) data.id = cuid();
    this.assertUnique(data);
    this.rows.push(data);
    return this.project(data, args);
  }

  async update(args: Row): Promise<Row> {
    const row = this.rows.find((candidate) => matchesWhere(candidate, args.where));
    if (!row) throw prismaNotFoundError();
    Object.assign(row, args.data, { updatedAt: now() });
    this.assertUnique(row, row.id);
    return this.project(row, args);
  }

  /** Bulk insert, as the import pipeline uses it. */
  async createMany(args: { data: Row | Row[]; skipDuplicates?: boolean }): Promise<{ count: number }> {
    const rows = Array.isArray(args.data) ? args.data : [args.data];
    for (const data of rows) {
      const created = { ...this.defaults(), ...data };
      this.assertUnique(created);
      this.rows.push(created);
    }
    return { count: rows.length };
  }

  async updateMany(args: Row): Promise<{ count: number }> {
    const rows = this.rows.filter((row) => matchesWhere(row, args.where));
    for (const row of rows) Object.assign(row, args.data, { updatedAt: now() });
    return { count: rows.length };
  }

  async delete(args: Row): Promise<Row> {
    const row = this.rows.find((candidate) => matchesWhere(candidate, args.where));
    if (!row) throw prismaNotFoundError();
    this.deleteMany({ where: { id: row.id } });
    return this.clone(row);
  }

  async deleteMany(args: Row): Promise<{ count: number }> {
    const doomed = this.rows.filter((row) => matchesWhere(row, args.where));
    if (doomed.length === 0) return { count: 0 };

    this.rows = this.rows.filter((row) => !doomed.includes(row));
    for (const row of doomed) this.cascadeDelete(row);
    return { count: doomed.length };
  }

  private cascadeDelete(row: Row): void {
    for (const child of this.spec.cascade ?? []) {
      // Fire-and-forget is wrong here, so the promise is awaited by the caller's
      // own async chain: deleteMany is the only entry point that cascades.
      void this.store.table(child.model).deleteMany({ where: { [child.foreignKey]: row.id } });
    }
  }

  private defaults(): Row {
    return { id: cuid(), ...(this.spec.defaults?.() ?? {}) };
  }
}

function pick(row: Row, select: Row): Row {
  const output: Row = {};
  for (const [field, on] of Object.entries(select)) {
    if (on === false || on === undefined) continue;
    if (on === true) {
      output[field] = row[field];
      continue;
    }
    // `{ select: {...} }` on a relation — handled by the caller; keep the raw value.
    output[field] = row[field];
  }
  return output;
}

function prismaUniqueError(target: string): Error {
  const error = new Error(`Unique constraint failed on the fields: (${target})`) as Error & {
    code: string;
    meta?: { target: string };
  };
  error.name = 'PrismaClientKnownRequestError';
  error.code = 'P2002';
  error.meta = { target };
  return error;
}

function prismaNotFoundError(): Error {
  const error = new Error('No record found') as Error & { code: string };
  error.name = 'PrismaClientKnownRequestError';
  error.code = 'P2025';
  return error;
}

/**
 * Usage: `new FakePrisma()` then pass it to `overrideProvider(PrismaService, …)`
 * or straight into a service constructor. `db.user.rows` is exposed so a test can
 * assert on storage directly (e.g. "the token in the row is not plaintext").
 */
export class FakePrisma {
  private readonly tables = new Map<ModelName, FakeModelClient>();

  readonly user: FakeModelClient;
  readonly note: FakeModelClient;
  readonly snippet: FakeModelClient;
  readonly project: FakeModelClient;
  readonly task: FakeModelClient;
  readonly oAuthAccount: FakeModelClient;
  readonly passwordReset: FakeModelClient;
  readonly importJob: FakeModelClient;

  constructor() {
    for (const name of Object.keys(SPECS) as ModelName[]) {
      this.tables.set(name, new FakeModelClient(name, this));
    }
    this.user = this.table('user');
    this.note = this.table('note');
    this.snippet = this.table('snippet');
    this.project = this.table('project');
    this.task = this.table('task');
    this.oAuthAccount = this.table('oAuthAccount');
    this.passwordReset = this.table('passwordReset');
    this.importJob = this.table('importJob');
  }

  table(name: ModelName): FakeModelClient {
    return this.tables.get(name)!;
  }

  /** Only sequential execution is modelled — see the header comment. */
  async $transaction(operations: Promise<unknown>[] | ((tx: FakePrisma) => Promise<unknown>)): Promise<unknown> {
    if (typeof operations === 'function') return operations(this);
    const results: unknown[] = [];
    for (const operation of operations) results.push(await operation);
    return results;
  }

  async $queryRaw(): Promise<unknown[]> {
    return [];
  }

  async $connect(): Promise<void> {}

  async $disconnect(): Promise<void> {}

  /** Starts every table over; call it in `beforeEach`. */
  reset(): void {
    for (const table of this.tables.values()) table.rows = [];
  }
}
