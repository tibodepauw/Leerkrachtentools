"use client";
import { isSharedDevice, temporaryDocuments } from "@/lib/storage/sharedDevice";

import {
  documentDatabaseName,
  getActiveUserId,
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
  if (isSharedDevice()) {
    temporaryDocuments.set(`${requireActiveUserId()}:${id}`, file);
    return;
  }
  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(file, id);

    request.onerror = () => reject(request.error ?? new Error("Document opslaan mislukt."));
    request.onsuccess = () => resolve();
  });

  database.close();
}

export async function getLessonDocument(id: string) {
  if (isSharedDevice()) return temporaryDocuments.get(`${requireActiveUserId()}:${id}`) ?? null;
  const database = await openDatabase();

  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onerror = () => reject(request.error ?? new Error("Document laden mislukt."));
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
  });

  database.close();
  return blob;
}

export async function deleteLessonDocument(id: string) {
  if (isSharedDevice()) {
    temporaryDocuments.delete(`${requireActiveUserId()}:${id}`);
    return;
  }
  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error ?? new Error("Document verwijderen mislukt."));
    request.onsuccess = () => resolve();
  });

  database.close();
}
