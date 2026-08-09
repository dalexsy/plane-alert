/**
 * Document field helpers for the Pi JSON document store (not a cloud SDK).
 */
import {
  DocumentFieldValue,
  DocumentTimestamp,
  JsonDocumentStore,
  createJsonDocumentStore,
} from "./json-document-store";

export {
  DocumentFieldValue,
  DocumentTimestamp,
  JsonDocumentStore,
  createJsonDocumentStore,
};

/** Field transforms used when writing documents (delete / increment / server time). */
export const FieldValue = DocumentFieldValue;

/** Path helpers for id-range queries on the JSON store. */
export const FieldPath = {
  documentId: () => "__name__" as const,
};

export type AdminFirestore = JsonDocumentStore;
