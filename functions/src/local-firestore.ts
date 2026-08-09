import * as fs from 'fs';
import * as path from 'path';
import {
  matchesFilters,
  type DocData,
  type Store,
  type WhereClause,
  DELETE_FIELD,
  INCREMENT_FIELD,
} from './services/local-firestore-write.util';
import {
  LocalCollectionReference,
  LocalDocumentReference,
  LocalDocumentSnapshot,
  LocalTransaction,
} from './services/local-firestore-refs';

export class LocalFieldValue {
  static delete(): symbol {
    return DELETE_FIELD;
  }

  static increment(by: number): { [INCREMENT_FIELD]: number } {
    return { [INCREMENT_FIELD]: by };
  }

  static serverTimestamp(): number {
    return Date.now();
  }
}

export class LocalTimestamp {
  /** Public so JSON.stringify persists millis (private fields become `{}`). */
  readonly millis: number;

  constructor(millis: number) {
    this.millis = millis;
  }

  static fromMillis(millis: number): LocalTimestamp {
    return new LocalTimestamp(millis);
  }

  toMillis(): number {
    return this.millis;
  }

  toJSON(): { millis: number } {
    return { millis: this.millis };
  }
}

export class LocalFirestore {
  private state: Store = {};
  private readonly filePath: string;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(filePath: string) {
    this.filePath = filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (fs.existsSync(filePath)) {
      try {
        this.state = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Store;
      } catch {
        this.state = {};
      }
    } else {
      this.persistSync();
    }
  }

  collection(name: string): LocalCollectionReference {
    return new LocalCollectionReference(this, name);
  }

  /** Sequential write batch (not multi-doc atomic across process crashes). */
  batch(): {
    delete(ref: LocalDocumentReference): void;
    set(ref: LocalDocumentReference, data: DocData): void;
    commit(): Promise<void>;
  } {
    const deletes: LocalDocumentReference[] = [];
    const sets: { ref: LocalDocumentReference; data: DocData }[] = [];
    return {
      delete(ref: LocalDocumentReference) {
        deletes.push(ref);
      },
      set(ref: LocalDocumentReference, data: DocData) {
        sets.push({ ref, data });
      },
      commit: async () => {
        for (const ref of deletes) {
          await ref.delete();
        }
        for (const row of sets) {
          await row.ref.set(row.data);
        }
      },
    };
  }

  async runTransaction<T>(
    fn: (transaction: LocalTransaction) => Promise<T>,
  ): Promise<T> {
    return this.write(async (state) => {
      const tx = new LocalTransaction(this);
      const result = await fn(tx);
      tx.commit(state);
      return result;
    });
  }

  readDoc(collectionName: string, docId: string): DocData | undefined {
    const data = this.state[collectionName]?.[docId];
    return data ? { ...data } : undefined;
  }

  async readCollection(
    collectionName: string,
    filters: WhereClause[],
    limitCount?: number,
  ): Promise<LocalDocumentSnapshot[]> {
    const entries = Object.entries(this.state[collectionName] ?? {});
    let docs = entries
      .filter(([docId, data]) => matchesFilters(docId, data, filters))
      .map(
        ([docId, data]) =>
          new LocalDocumentSnapshot(
            new LocalDocumentReference(this, collectionName, docId),
            { ...data },
          ),
      );
    if (typeof limitCount === 'number') {
      docs = docs.slice(0, limitCount);
    }
    return docs;
  }

  async write<T>(fn: (state: Store) => Promise<T> | T): Promise<T> {
    const run = async () => {
      const result = await fn(this.state);
      this.persistSync();
      return result;
    };
    const next = this.writeChain.then(run, run);
    this.writeChain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private persistSync(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), 'utf8');
  }
}

export function createLocalFirestore(filePath: string): LocalFirestore {
  return new LocalFirestore(filePath);
}
