"use client";

const LESSON_STORE_BASE_KEY = "leerkrachtentools-active-lesson";
const DOCUMENT_DB_BASE_NAME = "leerkrachtentools-documents";
const LEGACY_LESSON_STORE_KEY = LESSON_STORE_BASE_KEY;
const LEGACY_DOCUMENT_DB_NAME = DOCUMENT_DB_BASE_NAME;
const SIDEBAR_STORAGE_BASE_KEY = "leerkrachtentools-sidebar-width";

let activeUserId: string | null = null;

export function setActiveUserId(userId: string | null) {
  activeUserId = userId;
}

export function getActiveUserId() {
  return activeUserId;
}

const SETTINGS_STORE_BASE_KEY = "leerkrachtentools-settings";

export function settingsStoreStorageKey(userId: string) {
  return `${SETTINGS_STORE_BASE_KEY}:${userId}`;
}

export function lessonStoreStorageKey(userId: string) {
  return `${LESSON_STORE_BASE_KEY}:${userId}`;
}

export function documentDatabaseName(userId: string) {
  return `${DOCUMENT_DB_BASE_NAME}:${userId}`;
}

export function migrateLegacyLessonStorage(userId: string) {
  if (typeof window === "undefined") return;

  const scopedKey = lessonStoreStorageKey(userId);
  const legacyValue = window.localStorage.getItem(LEGACY_LESSON_STORE_KEY);
  if (!legacyValue) return;

  if (!window.localStorage.getItem(scopedKey)) {
    window.localStorage.setItem(scopedKey, legacyValue);
  }
  window.localStorage.removeItem(LEGACY_LESSON_STORE_KEY);
}

export async function migrateLegacyDocumentStorage(userId: string) {
  if (typeof window === "undefined" || !window.indexedDB) return;

  const scopedDbName = documentDatabaseName(userId);
  const hasScopedData = await indexedDbHasEntries(scopedDbName);
  if (!hasScopedData) {
    const legacyEntries = await readAllIndexedDbEntries(
      LEGACY_DOCUMENT_DB_NAME,
    );
    if (legacyEntries.length > 0) {
      await writeIndexedDbEntries(scopedDbName, legacyEntries);
    }
  }
  await deleteIndexedDb(LEGACY_DOCUMENT_DB_NAME);
}

function deleteIndexedDb(dbName: string) {
  return new Promise<void>((resolve, reject) => {
    const request = window.indexedDB.deleteDatabase(dbName);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB verwijderen mislukt."));
    request.onblocked = () =>
      reject(new Error("IndexedDB verwijderen is geblokkeerd."));
    request.onsuccess = () => resolve();
  });
}

export async function deleteUserBrowserStorage(userId: string) {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(lessonStoreStorageKey(userId));
  window.localStorage.removeItem(settingsStoreStorageKey(userId));
  window.localStorage.removeItem(`${SIDEBAR_STORAGE_BASE_KEY}:${userId}`);
  await deleteIndexedDb(documentDatabaseName(userId));
}

function indexedDbHasEntries(dbName: string) {
  return new Promise<boolean>((resolve, reject) => {
    const request = window.indexedDB.open(dbName, 1);

    request.onerror = () => {
      if (request.error?.name === "NotFoundError") {
        resolve(false);
        return;
      }
      reject(request.error ?? new Error("IndexedDB open failed."));
    };

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("documents")) {
        database.createObjectStore("documents");
      }
    };

    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("documents")) {
        database.close();
        resolve(false);
        return;
      }

      const transaction = database.transaction("documents", "readonly");
      const countRequest = transaction.objectStore("documents").count();
      countRequest.onerror = () => {
        database.close();
        reject(countRequest.error ?? new Error("IndexedDB count failed."));
      };
      countRequest.onsuccess = () => {
        database.close();
        resolve(countRequest.result > 0);
      };
    };
  });
}

function readAllIndexedDbEntries(dbName: string) {
  return new Promise<Array<{ key: IDBValidKey; value: Blob }>>((resolve, reject) => {
    const request = window.indexedDB.open(dbName, 1);

    request.onerror = () => {
      if (request.error?.name === "NotFoundError") {
        resolve([]);
        return;
      }
      reject(request.error ?? new Error("IndexedDB open failed."));
    };

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("documents")) {
        database.createObjectStore("documents");
      }
    };

    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("documents")) {
        database.close();
        resolve([]);
        return;
      }

      const transaction = database.transaction("documents", "readonly");
      const store = transaction.objectStore("documents");
      const getAllRequest = store.getAllKeys();

      getAllRequest.onerror = () => {
        database.close();
        reject(getAllRequest.error ?? new Error("IndexedDB read failed."));
      };

      getAllRequest.onsuccess = async () => {
        const keys = getAllRequest.result;
        const entries: Array<{ key: IDBValidKey; value: Blob }> = [];

        for (const key of keys) {
          const value = await new Promise<Blob | null>((resolveValue, rejectValue) => {
            const valueRequest = store.get(key);
            valueRequest.onerror = () =>
              rejectValue(valueRequest.error ?? new Error("IndexedDB read failed."));
            valueRequest.onsuccess = () =>
              resolveValue((valueRequest.result as Blob | undefined) ?? null);
          });

          if (value) entries.push({ key, value });
        }

        database.close();
        resolve(entries);
      };
    };
  });
}

function writeIndexedDbEntries(
  dbName: string,
  entries: Array<{ key: IDBValidKey; value: Blob }>,
) {
  return new Promise<void>((resolve, reject) => {
    const request = window.indexedDB.open(dbName, 1);

    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB open failed."));

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("documents")) {
        database.createObjectStore("documents");
      }
    };

    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("documents", "readwrite");
      const store = transaction.objectStore("documents");

      for (const entry of entries) {
        store.put(entry.value, entry.key);
      }

      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error ?? new Error("IndexedDB write failed."));
      };
    };
  });
}
