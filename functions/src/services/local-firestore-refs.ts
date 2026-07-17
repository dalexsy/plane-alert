import {
  applyPatch,
  normalizeWhereField,
  type DocData,
  type Store,
  type WhereClause,
} from './local-firestore-write.util';

export interface LocalFirestoreStore {
  readDoc(collectionName: string, docId: string): DocData | undefined;
  write<T>(fn: (state: Store) => Promise<T> | T): Promise<T>;
  readCollection(
    collectionName: string,
    filters: WhereClause[],
    limitCount?: number,
  ): Promise<LocalDocumentSnapshot[]>;
}

export class LocalDocumentSnapshot {
  constructor(
    readonly ref: LocalDocumentReference,
    private readonly dataValue: DocData | undefined,
  ) {}

  get exists(): boolean {
    return this.dataValue !== undefined;
  }

  data(): DocData | undefined {
    return this.dataValue ? { ...this.dataValue } : undefined;
  }

  get id(): string {
    return this.ref.id;
  }
}

export class LocalQuerySnapshot {
  constructor(readonly docs: LocalDocumentSnapshot[]) {}

  get empty(): boolean {
    return this.docs.length === 0;
  }

  get size(): number {
    return this.docs.length;
  }
}

export class LocalDocumentReference {
  constructor(
    private readonly store: LocalFirestoreStore,
    readonly collectionName: string,
    readonly id: string,
  ) {}

  get path(): string {
    return `${this.collectionName}/${this.id}`;
  }

  async get(): Promise<LocalDocumentSnapshot> {
    const data = this.store.readDoc(this.collectionName, this.id);
    return new LocalDocumentSnapshot(this, data);
  }

  async set(data: DocData, options?: { merge?: boolean }): Promise<void> {
    await this.store.write(async (state) => {
      const existing = state[this.collectionName]?.[this.id];
      state[this.collectionName] ??= {};
      state[this.collectionName][this.id] = applyPatch(
        existing,
        data,
        options?.merge === true,
      );
    });
  }

  async update(data: DocData): Promise<void> {
    await this.set(data, { merge: true });
  }

  async delete(): Promise<void> {
    await this.store.write(async (state) => {
      if (state[this.collectionName]) {
        delete state[this.collectionName][this.id];
      }
    });
  }
}

export class LocalCollectionReference {
  private readonly filters: WhereClause[] = [];
  private readonly limitCount?: number;

  constructor(
    private readonly store: LocalFirestoreStore,
    readonly id: string,
    filters: WhereClause[] = [],
    limitCount?: number,
  ) {
    this.filters = filters;
    this.limitCount = limitCount;
  }

  doc(docId: string): LocalDocumentReference {
    return new LocalDocumentReference(this.store, this.id, docId);
  }

  where(field: unknown, op: string, value: unknown): LocalCollectionReference {
    const type =
      op === '==' ? 'eq' : op === '>=' ? 'gte' : op === '<' ? 'lt' : null;
    if (!type) {
      throw new Error(`Unsupported where operator: ${op}`);
    }
    return new LocalCollectionReference(
      this.store,
      this.id,
      [...this.filters, { type, field: normalizeWhereField(field), value }],
      this.limitCount,
    );
  }

  limit(count: number): LocalCollectionReference {
    return new LocalCollectionReference(
      this.store,
      this.id,
      this.filters,
      count,
    );
  }

  async get(): Promise<LocalQuerySnapshot> {
    const docs = await this.store.readCollection(
      this.id,
      this.filters,
      this.limitCount,
    );
    return new LocalQuerySnapshot(docs);
  }
}

export class LocalTransaction {
  private readonly pending = new Map<string, DocData | null>();

  constructor(private readonly store: LocalFirestoreStore) {}

  async get(ref: LocalDocumentReference): Promise<LocalDocumentSnapshot> {
    const key = ref.path;
    if (this.pending.has(key)) {
      const data = this.pending.get(key);
      return new LocalDocumentSnapshot(ref, data ?? undefined);
    }
    const data = this.store.readDoc(ref.collectionName, ref.id);
    return new LocalDocumentSnapshot(ref, data);
  }

  set(
    ref: LocalDocumentReference,
    data: DocData,
    options?: { merge?: boolean },
  ): void {
    const existing =
      this.pending.get(ref.path) ??
      this.store.readDoc(ref.collectionName, ref.id);
    this.pending.set(
      ref.path,
      applyPatch(existing ?? undefined, data, options?.merge === true),
    );
  }

  delete(ref: LocalDocumentReference): void {
    this.pending.set(ref.path, null);
  }

  commit(state: Store): void {
    for (const [docPath, data] of this.pending.entries()) {
      const slash = docPath.indexOf('/');
      const collectionName =
        slash === -1 ? docPath : docPath.slice(0, slash);
      const docId = slash === -1 ? '' : docPath.slice(slash + 1);
      state[collectionName] ??= {};
      if (data === null) {
        delete state[collectionName][docId];
      } else {
        state[collectionName][docId] = data;
      }
    }
  }
}
