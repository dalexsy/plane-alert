/**
 * Drop-in replacement for firebase-admin used only as type/namespace glue.
 * Runtime data is LocalFirestore JSON on the Pi — never GCP.
 *
 * Note: do not export a type named `Firestore` on Windows — it collides with
 * the `firestore` value export (case-insensitive filesystem).
 */
import {
  LocalFieldValue,
  LocalFirestore,
  LocalTimestamp,
  createLocalFirestore,
} from "./local-firestore";

export type AdminFirestore = LocalFirestore;
export { LocalFieldValue, LocalFirestore, LocalTimestamp, createLocalFirestore };

type FirestoreNs = {
  FieldValue: typeof LocalFieldValue;
  Timestamp: typeof LocalTimestamp;
  FieldPath: { documentId: () => string };
  Firestore: typeof LocalFirestore;
};

const firestoreValue: FirestoreNs & ((...args: never[]) => never) = Object.assign(
  function firestoreCallable(): never {
    throw new Error(
      "admin.firestore() is disabled. Pass createLocalFirestore(path) from pi-server.",
    );
  },
  {
    FieldValue: LocalFieldValue,
    Timestamp: LocalTimestamp,
    FieldPath: { documentId: () => "__name__" },
    Firestore: LocalFirestore,
  },
) as FirestoreNs & ((...args: never[]) => never);

/** Mimics `admin.firestore` / `import { firestore } from 'firebase-admin'`. */
export const firestore = firestoreValue;

const adminCompat = {
  apps: [{ name: "[DEFAULT]" }] as { name: string }[],
  initializeApp(): { name: string } {
    return { name: "[DEFAULT]" };
  },
  firestore: firestoreValue,
};

export default adminCompat;

/** Global type some files use as FirebaseFirestore.* */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace FirebaseFirestore {
    type Firestore = LocalFirestore;
    type DocumentData = Record<string, unknown>;
    type QueryDocumentSnapshot = {
      id: string;
      data(): DocumentData;
      exists: boolean;
    };
    type DocumentSnapshot = QueryDocumentSnapshot;
    type QuerySnapshot = { docs: QueryDocumentSnapshot[]; empty: boolean; size: number };
    type DocumentReference = { id: string; path: string };
    type CollectionReference = { id: string; path: string };
    type Transaction = {
      get(ref: unknown): Promise<DocumentSnapshot>;
      set(ref: unknown, data: DocumentData, opts?: unknown): Transaction;
      update(ref: unknown, data: DocumentData): Transaction;
      delete(ref: unknown): Transaction;
    };
  }
}

export {};
