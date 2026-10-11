/**
 * Minimal async key-value backend. IndexedDB in the browser; Map in tests.
 */
export interface PersistBackend {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  listKeys(prefix?: string): Promise<string[]>;
  clear(): Promise<void>;
}

export class MemoryPersistBackend implements PersistBackend {
  private readonly map = new Map<string, unknown>();

  async get(key: string): Promise<unknown | undefined> {
    return this.map.has(key) ? this.map.get(key) : undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.map.set(key, structuredClone(value));
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  async listKeys(prefix?: string): Promise<string[]> {
    const keys = [...this.map.keys()];
    return prefix ? keys.filter((k) => k.startsWith(prefix)) : keys;
  }

  async clear(): Promise<void> {
    this.map.clear();
  }
}

const IDB_NAME = 'mahjong-with-ai';
const IDB_STORE = 'kv';
const IDB_VERSION = 1;

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onerror = () => reject(req.error ?? new Error('indexedDB request failed'));
    req.onsuccess = () => resolve(req.result);
  });
}

/** Browser IndexedDB key-value backend for active saves and game logs. */
export class IndexedDbPersistBackend implements PersistBackend {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = openIdb();
    return this.dbPromise;
  }

  private async withStore<T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T> | void,
  ): Promise<T | undefined> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, mode);
      const store = tx.objectStore(IDB_STORE);
      let req: IDBRequest<T> | undefined;
      try {
        const result = fn(store);
        if (result) req = result;
      } catch (err) {
        reject(err);
        return;
      }
      tx.oncomplete = () => {
        resolve(req ? req.result : undefined);
      };
      tx.onerror = () => reject(tx.error ?? new Error('indexedDB tx failed'));
      if (req) {
        req.onerror = () => reject(req!.error ?? new Error('indexedDB request failed'));
      }
    });
  }

  async get(key: string): Promise<unknown | undefined> {
    const db = await this.db();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const value = await idbRequest(tx.objectStore(IDB_STORE).get(key));
    return value === undefined ? undefined : value;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.withStore('readwrite', (store) => store.put(value, key));
  }

  async delete(key: string): Promise<void> {
    await this.withStore('readwrite', (store) => store.delete(key));
  }

  async listKeys(prefix?: string): Promise<string[]> {
    const db = await this.db();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const keys = (await idbRequest(tx.objectStore(IDB_STORE).getAllKeys())) as IDBValidKey[];
    const asStrings = keys.map(String);
    return prefix ? asStrings.filter((k) => k.startsWith(prefix)) : asStrings;
  }

  async clear(): Promise<void> {
    await this.withStore('readwrite', (store) => store.clear());
  }
}

export function createDefaultBackend(): PersistBackend {
  if (typeof indexedDB !== 'undefined') {
    return new IndexedDbPersistBackend();
  }
  return new MemoryPersistBackend();
}
