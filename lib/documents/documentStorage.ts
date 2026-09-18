"use client";
import { isSharedDevice, temporaryDocuments } from "@/lib/storage/sharedDevice";

import {
  documentDatabaseName,
  getActiveUserId,
  captureStorageSession,
} from "@/lib/storage/userStorageScope";

const DB_VERSION = 1;
const STORE_NAME = "documents";

function requireActiveUserId() {
  const userId = getActiveUserId();
  if (!userId) {
    throw new Error("Geen actief account gevonden voor documentopslag.");
  }
  return userId;
}

function openDatabase() {
  const userId = requireActiveUserId();

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(documentDatabaseName(userId), DB_VERSION);

    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed."));
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
  });
}

export async function saveLessonDocument(id: string, file: Blob) {
  const session = captureStorageSession();
  if (isSharedDevice()) {
    temporaryDocuments.set(`${requireActiveUserId()}:${id}`, file);
    return;
  }
  const database = await openDatabase();
  try {
    session.assertCurrent();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const abort = () => { try { transaction.abort(); } catch { /* already complete */ } };
      session.signal.addEventListener("abort", abort, { once: true });
      const cleanup = () => session.signal.removeEventListener("abort", abort);
      transaction.oncomplete = () => { cleanup(); resolve(); };
      transaction.onabort = () => { cleanup(); reject(new Error("Documentopslag afgebroken.")); };
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(file, id);

      request.onerror = () => reject(request.error ?? new Error("Document opslaan mislukt."));
    });
    session.assertCurrent();
  } finally { database.close(); }
}

export async function getLessonDocument(id: string) {
  const session = captureStorageSession();
  if (isSharedDevice()) return temporaryDocuments.get(`${requireActiveUserId()}:${id}`) ?? null;
  const database = await openDatabase();
  try {
    session.assertCurrent();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onerror = () => reject(request.error ?? new Error("Document laden mislukt."));
      request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    });

    session.assertCurrent();
    return blob;
  } finally { database.close(); }
}

export async function deleteLessonDocument(id: string) {
  const session = captureStorageSession();
  if (isSharedDevice()) {
    temporaryDocuments.delete(`${requireActiveUserId()}:${id}`);
    return;
  }
  const database = await openDatabase();
  try {
    session.assertCurrent();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onerror = () => reject(request.error ?? new Error("Document verwijderen mislukt."));
      request.onsuccess = () => resolve();
    });

  } finally { database.close(); }
}
