/**
 * IndexedDB 的最薄一层封装。
 *
 * 只做三件事：建库建表、把 IDBRequest 包成 Promise、把事务生命周期管好。
 * 业务逻辑一律不写在这里。
 */

const DB_NAME = 'fitlog';
const DB_VERSION = 4;

export const Store = {
  meta: 'meta',
  muscles: 'muscles',
  exercises: 'exercises',
  workouts: 'workouts',
  workoutExercises: 'workoutExercises',
  workoutSets: 'workoutSets',
  supplements: 'supplements',
  supplementRecords: 'supplementRecords',
} as const;

export type StoreName = (typeof Store)[keyof typeof Store];

export interface MetaRow {
  key: string;
  value: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDatabase(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('这个浏览器不支持本地存储，无法保存数据。'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const upgradeTx = request.transaction;

      if (!db.objectStoreNames.contains(Store.meta)) {
        db.createObjectStore(Store.meta, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(Store.muscles)) {
        db.createObjectStore(Store.muscles, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(Store.exercises)) {
        const store = db.createObjectStore(Store.exercises, { keyPath: 'id' });
        store.createIndex('muscleId', 'muscleId');
      }
      if (!db.objectStoreNames.contains(Store.workouts)) {
        const store = db.createObjectStore(Store.workouts, { keyPath: 'id' });
        store.createIndex('status', 'status');
        store.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains(Store.workoutExercises)) {
        const store = db.createObjectStore(Store.workoutExercises, { keyPath: 'id' });
        store.createIndex('workoutId', 'workoutId');
        store.createIndex('exerciseId', 'exerciseId');
      }
      if (!db.objectStoreNames.contains(Store.workoutSets)) {
        const store = db.createObjectStore(Store.workoutSets, { keyPath: 'id' });
        store.createIndex('workoutExerciseId', 'workoutExerciseId');
      }

      // v1 -> v2：训练组增加「重量单位」。
      // 之前的数据都是按 kg 录入的，这里显式补上，读的时候就不用到处兜底。
      const previousVersion = event.oldVersion;
      if (previousVersion > 0 && previousVersion < 2 && upgradeTx) {
        const setsStore = upgradeTx.objectStore(Store.workoutSets);
        const cursorRequest = setsStore.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          const row = cursor.value as { weightUnit?: string };
          if (row.weightUnit === undefined) {
            cursor.update({ ...row, weightUnit: 'kg' });
          }
          cursor.continue();
        };
      }

      // v2 -> v3：补剂与补剂使用记录
      if (!db.objectStoreNames.contains(Store.supplements)) {
        db.createObjectStore(Store.supplements, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(Store.supplementRecords)) {
        const store = db.createObjectStore(Store.supplementRecords, { keyPath: 'id' });
        store.createIndex('date', 'date');
        store.createIndex('supplementId', 'supplementId');
      }

      // v3 -> v4：补剂增加「可选单位」（例如蛋白粉支持 g / 勺）。
      // 老数据先用原来的单位兜底，shared/defaults 里的新单位由 syncDefaults 补进来。
      if (previousVersion > 0 && previousVersion < 4 && upgradeTx) {
        const supplementsStore = upgradeTx.objectStore(Store.supplements);
        const cursorRequest = supplementsStore.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          const row = cursor.value as { unit?: string; units?: unknown };
          if (!Array.isArray(row.units) || row.units.length === 0) {
            cursor.update({ ...row, units: [typeof row.unit === 'string' ? row.unit : 'g'] });
          }
          cursor.continue();
        };
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('打开本地数据库失败，请重试。'));
    request.onblocked = () =>
      reject(new Error('本地数据库被其他标签页占用，请关闭其他 FitLog 页面后重试。'));
  });

  return dbPromise;
}

/**
 * 把 IDBRequest 包成 Promise。
 *
 * 注意：IDBRequest 不是 Promise，直接 `await request` 会立刻拿到 request 对象本身
 * 而不是结果 —— 事务里的每一步都必须经过这个包装。
 */
export function request<T>(idbRequest: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    idbRequest.onsuccess = () => resolve(idbRequest.result);
    idbRequest.onerror = () => reject(idbRequest.error ?? new Error('本地数据库操作失败。'));
  });
}

/**
 * 在事务里跑一段逻辑。
 * 注意：fn 里只能 await IndexedDB 请求，夹了别的异步操作会让事务提前自动提交。
 */
async function withTransaction<T>(
  storeNames: StoreName[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => Promise<T>,
): Promise<T> {
  const db = await openDatabase();
  const tx = db.transaction(storeNames, mode);

  const finished = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('本地数据库操作失败。'));
    tx.onabort = () => reject(tx.error ?? new Error('本地数据库操作被中断。'));
  });

  try {
    const result = await fn(tx);
    await finished;
    return result;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // 事务可能已经结束，忽略
    }
    throw error;
  }
}

function writeTo<T>(store: IDBObjectStore, value: T): Promise<unknown> {
  return request(store.put(value as unknown as Record<string, unknown>));
}

export function getAll<T>(storeName: StoreName): Promise<T[]> {
  return withTransaction([storeName], 'readonly', (tx) =>
    request(tx.objectStore(storeName).getAll() as IDBRequest<T[]>),
  );
}

export function get<T>(storeName: StoreName, key: string): Promise<T | undefined> {
  return withTransaction([storeName], 'readonly', (tx) =>
    request(tx.objectStore(storeName).get(key) as IDBRequest<T | undefined>),
  );
}

export function getAllByIndex<T>(
  storeName: StoreName,
  indexName: string,
  value: string,
): Promise<T[]> {
  return withTransaction([storeName], 'readonly', (tx) =>
    request(tx.objectStore(storeName).index(indexName).getAll(value) as IDBRequest<T[]>),
  );
}

export function count(storeName: StoreName): Promise<number> {
  return withTransaction([storeName], 'readonly', (tx) =>
    request(tx.objectStore(storeName).count()),
  );
}

export function put<T>(storeName: StoreName, value: T): Promise<void> {
  return withTransaction([storeName], 'readwrite', async (tx) => {
    await writeTo(tx.objectStore(storeName), value);
  });
}

export function putMany<T>(storeName: StoreName, values: readonly T[]): Promise<void> {
  if (values.length === 0) return Promise.resolve();
  return withTransaction([storeName], 'readwrite', async (tx) => {
    const store = tx.objectStore(storeName);
    for (const value of values) {
      await writeTo(store, value);
    }
  });
}

export function remove(storeName: StoreName, key: string): Promise<void> {
  return withTransaction([storeName], 'readwrite', async (tx) => {
    await request(tx.objectStore(storeName).delete(key));
  });
}

/** 跨多个 store 的原子写入（例如「删训练 + 删它的动作 + 删它的组」） */
export function runTransaction<T>(
  storeNames: StoreName[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => Promise<T>,
): Promise<T> {
  return withTransaction(storeNames, mode, fn);
}
