import * as fs from 'fs';
import * as path from 'path';
import {
  matchesFilters,
  type DocData,
  type Store,
  type WhereClause,
  DELETE_FIELD,
  INCREMENT_FIELD,
} from './services/json-document-store-write.util';
import {
  JsonCollectionReference,
  JsonDocumentReference,
  JsonDocumentSnapshot,
  JsonTransaction,
} from './services/json-document-store-refs';

export class DocumentFieldValue {
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

export class DocumentTimestamp {
  /** Public so JSON.stringify persists millis (private fields become `{}`). */
  readonly millis: number;

  constructor(millis: number) {
    this.millis = millis;
  }

  static fromMillis(millis: number): DocumentTimestamp {
    return new DocumentTimestamp(millis);
  }

  toMillis(): number {
    return this.millis;
  }

  toJSON(): { millis: number } {
    return { millis: this.millis };
  }
}

export class JsonDocumentStore {
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

  collection(name: string): JsonCollectionReference {
    return new JsonCollectionReference(this, name);
  }

  /** Sequential write batch (not multi-doc atomic across process crashes). */
  batch(): {
    delete(ref: JsonDocumentReference): void;
    set(ref: JsonDocumentReference, data: DocData): void;
    commit(): Promise<void>;
  } {
    const deletes: JsonDocumentReference[] = [];
    const sets: { ref: JsonDocumentReference; data: DocData }[] = [];
    return {
      delete(ref: JsonDocumentReference) {
        deletes.push(ref);
      },
      set(ref: JsonDocumentReference, data: DocData) {
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
    fn: (transaction: JsonTransaction) => Promise<T>,
  ): Promise<T> {
    return this.write(async (state) => {
      const tx = new JsonTransaction(this);
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
  ): Promise<JsonDocumentSnapshot[]> {
    const entries = Object.entries(this.state[collectionName] ?? {});
    let docs = entries
      .filter(([docId, data]) => matchesFilters(docId, data, filters))
      .map(
        ([docId, data]) =>
          new JsonDocumentSnapshot(
            new JsonDocumentReference(this, collectionName, docId),
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

export function createJsonDocumentStore(filePath: string): JsonDocumentStore {
  return new JsonDocumentStore(filePath);
}
