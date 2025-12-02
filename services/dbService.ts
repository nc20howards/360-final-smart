
import type { ConversationEntry } from '../types';

const DB_NAME = '360SmartSchoolDB';
const DB_VERSION = 2; // Incremented to add index
const STORE_NAME = 'conversationHistory';

let db: IDBDatabase;

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject('Error opening database.');
    };

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = (event.target as IDBOpenDBRequest).transaction!;
      let store: IDBObjectStore;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      } else {
        store = transaction.objectStore(STORE_NAME);
      }
      
      if (!store.indexNames.contains('userId')) {
          store.createIndex('userId', 'userId', { unique: false });
      }
    };
  });
};

export const addMessage = async (entry: Omit<ConversationEntry, 'id' | 'feedback'>): Promise<number> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add({ ...entry, feedback: null });

    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => {
      console.error('Error adding message to DB:', request.error);
      reject('Could not add message.');
    };
  });
};

export const getHistory = async (userId: string): Promise<ConversationEntry[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        
        let request: IDBRequest;
        try {
            const index = store.index('userId');
            request = index.getAll(userId);
        } catch (e) {
            // Fallback if index missing (shouldn't happen with correct versioning)
            request = store.getAll(); 
        }

        request.onsuccess = () => {
            let results = request.result as ConversationEntry[];
            // Filter in memory if fallback was used or index returned too much (paranoia)
            if (!store.indexNames.contains('userId')) {
                results = results.filter(r => r.userId === userId);
            }
            
            // Sort by timestamp
            results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            resolve(results);
        };

        request.onerror = () => {
            console.error('Error fetching history:', request.error);
            reject('Could not fetch history.');
        };
    });
};

export const clearHistory = async (userId: string): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        try {
            const index = store.index('userId');
            const keyRange = IDBKeyRange.only(userId);
            const cursorRequest = index.openCursor(keyRange);

            cursorRequest.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result as IDBCursor;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            
            cursorRequest.onerror = () => reject(cursorRequest.error);

        } catch (e) {
             console.error('Error clearing history with index, trying fallback (delete all - avoided for safety)', e);
             // Ideally we shouldn't delete all if index fails, so just reject
             reject(e);
        }
    });
};

export const updateMessageFeedback = async (id: number, feedback: 'up' | 'down' | null): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
            const entry = getRequest.result as ConversationEntry | undefined;
            if (entry) {
                entry.feedback = feedback;
                const putRequest = store.put(entry);
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => {
                    console.error('Error updating feedback in DB:', putRequest.error);
                    reject('Could not update feedback.');
                };
            } else {
                reject('Message not found.');
            }
        };

        getRequest.onerror = () => {
            console.error('Error getting message to update feedback:', getRequest.error);
            reject('Could not find message to update.');
        };
    });
};
