import type { CompletedGameInput } from "@/lib/validation";

const DATABASE_NAME = "betting-game-scorer-offline";
const DATABASE_VERSION = 1;
const OUTBOX_STORE = "game-outbox";
const SNAPSHOT_STORE = "snapshots";
const LEADERBOARD_KEY = "leaderboard";

export interface QueuedGame {
  id: string;
  game: CompletedGameInput;
  queuedAt: string;
}

export interface CachedSnapshot<T> {
  key: string;
  data: T;
  savedAt: string;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline storage failed."));
  });
}

function transactionFinished(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Offline storage failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Offline storage was cancelled."));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (!("indexedDB" in globalThis)) {
    return Promise.reject(new Error("This browser does not support offline result storage."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(OUTBOX_STORE)) {
        database.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
        database.createObjectStore(SNAPSHOT_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open offline storage."));
  });
}

export async function queueCompletedGame(game: CompletedGameInput): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(OUTBOX_STORE, "readwrite");
    transaction.objectStore(OUTBOX_STORE).put({
      id: game.id,
      game,
      queuedAt: new Date().toISOString(),
    } satisfies QueuedGame);
    await transactionFinished(transaction);
  } finally {
    database.close();
  }
}

export async function queuedGames(): Promise<QueuedGame[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(OUTBOX_STORE, "readonly");
    const records = await requestResult(
      transaction.objectStore(OUTBOX_STORE).getAll() as IDBRequest<QueuedGame[]>,
    );
    await transactionFinished(transaction);
    return records.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
  } finally {
    database.close();
  }
}

export async function removeQueuedGame(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(OUTBOX_STORE, "readwrite");
    transaction.objectStore(OUTBOX_STORE).delete(id);
    await transactionFinished(transaction);
  } finally {
    database.close();
  }
}

export async function saveLeaderboardSnapshot<T>(data: T): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(SNAPSHOT_STORE, "readwrite");
    transaction.objectStore(SNAPSHOT_STORE).put({
      key: LEADERBOARD_KEY,
      data,
      savedAt: new Date().toISOString(),
    } satisfies CachedSnapshot<T>);
    await transactionFinished(transaction);
  } finally {
    database.close();
  }
}

export async function getLeaderboardSnapshot<T>(): Promise<CachedSnapshot<T> | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(SNAPSHOT_STORE, "readonly");
    const snapshot = await requestResult(
      transaction.objectStore(SNAPSHOT_STORE).get(LEADERBOARD_KEY) as IDBRequest<
        CachedSnapshot<T> | undefined
      >,
    );
    await transactionFinished(transaction);
    return snapshot ?? null;
  } finally {
    database.close();
  }
}
