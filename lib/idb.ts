const DB_NAME = "thaigroup-db";
const DB_VERSION = 1;

type StoreName =
  | "session"
  | "members"
  | "latestLocations"
  | "pendingLocationEvents"
  | "appSettings";

let openDatabasePromise: Promise<IDBDatabase> | null = null;

function assertBrowser() {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    throw new Error("IndexedDB no está disponible en este entorno.");
  }
}

function openDatabase() {
  assertBrowser();

  if (!openDatabasePromise) {
    openDatabasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains("session")) {
          db.createObjectStore("session", { keyPath: "key" });
        }

        if (!db.objectStoreNames.contains("members")) {
          db.createObjectStore("members", { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains("latestLocations")) {
          db.createObjectStore("latestLocations", { keyPath: "member_id" });
        }

        if (!db.objectStoreNames.contains("pendingLocationEvents")) {
          db.createObjectStore("pendingLocationEvents", { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains("appSettings")) {
          db.createObjectStore("appSettings", { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
    });
  }

  return openDatabasePromise;
}

function waitForTransaction(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function requestValue<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getRecord<T>(storeName: StoreName, key: IDBValidKey) {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, "readonly");
  const request = transaction.objectStore(storeName).get(key);
  const value = await requestValue(request);
  await waitForTransaction(transaction);
  return value as T | undefined;
}

export async function getAllRecords<T>(storeName: StoreName) {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, "readonly");
  const request = transaction.objectStore(storeName).getAll();
  const value = await requestValue(request);
  await waitForTransaction(transaction);
  return value as T[];
}

export async function putRecord<T>(storeName: StoreName, value: T) {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).put(value);
  await waitForTransaction(transaction);
}

export async function bulkPutRecords<T>(storeName: StoreName, values: T[]) {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, "readwrite");
  const store = transaction.objectStore(storeName);

  values.forEach((value) => {
    store.put(value);
  });

  await waitForTransaction(transaction);
}

export async function deleteRecord(storeName: StoreName, key: IDBValidKey) {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).delete(key);
  await waitForTransaction(transaction);
}

export async function clearStore(storeName: StoreName) {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).clear();
  await waitForTransaction(transaction);
}
