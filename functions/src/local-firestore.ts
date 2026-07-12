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
  private readonly millis: number;

  constructor(millis: number) {
    this.millis = millis;
  }

  static fromMillis(millis: number): LocalTimestamp {
    return new LocalTimestamp(millis);
  }

  toMillis(): number {
    return this.millis;
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

export function patchAdminFirestoreNamespace(
  adminModule: typeof import('firebase-admin'),
): void {
  const firestoreNs = adminModule.firestore as unknown as Record<string, unknown>;
  firestoreNs.FieldValue = LocalFieldValue as unknown;
  firestoreNs.Timestamp = LocalTimestamp as unknown;
  firestoreNs.FieldPath = {
    documentId: () => '__name__',
  };
}
