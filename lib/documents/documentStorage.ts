const DB_NAME = "leerkrachtentools-documents";
const DB_VERSION = 1;
const STORE_NAME = "documents";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed."));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
  });
}

export async function saveLessonDocument(id: string, file: Blob) {
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
