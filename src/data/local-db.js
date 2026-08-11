import { DB_NAME, DB_VERSION } from '../config/app-config.js';

let dbPromise = null;
let dbHandle = null;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function resetConnection(db = null){
  if(db && dbHandle && db !== dbHandle) return;
  dbHandle = null;
  dbPromise = null;
}

function isRetryableConnectionError(error){
  const name = error?.name || '';
  const message = String(error?.message || error || '').toLowerCase();
  return name === 'InvalidStateError' ||
    name === 'TransactionInactiveError' ||
    message.includes('connection is closing') ||
    message.includes('database connection is closing') ||
    message.includes('database is closing');
}

function configureConnection(db){
  dbHandle = db;
  db.onversionchange = () => {
    try { db.close(); } catch {}
    resetConnection(db);
  };
  // Supported by modern Chromium/Firefox. Safe to assign where available.
  try {
    db.onclose = () => resetConnection(db);
  } catch {}
  return db;
}

function openDB(){
  if(dbHandle) return Promise.resolve(dbHandle);
  if(dbPromise) return dbPromise;

  dbPromise = new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles',{keyPath:'id'});
      if(!db.objectStoreNames.contains('visits')) {
        const s=db.createObjectStore('visits',{keyPath:'id'});
        s.createIndex('jovis_user_id','jovis_user_id',{unique:false});
        s.createIndex('status','status',{unique:false});
      }
      if(!db.objectStoreNames.contains('calls')) {
        const s=db.createObjectStore('calls',{keyPath:'id'});
        s.createIndex('visit_id','visit_id',{unique:false});
        s.createIndex('jovis_user_id','jovis_user_id',{unique:false});
      }
      if(!db.objectStoreNames.contains('queue')) {
        const s=db.createObjectStore('queue',{keyPath:'id'});
        s.createIndex('created_at','created_at',{unique:false});
      }
      if(!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts',{keyPath:'id'});
      if(!db.objectStoreNames.contains('settings')) db.createObjectStore('settings',{keyPath:'key'});
      if(!db.objectStoreNames.contains('taxonomy')) db.createObjectStore('taxonomy',{keyPath:'reason_code'});
    };

    req.onsuccess = () => {
      const db = configureConnection(req.result);
      resolve(db);
    };
    req.onerror = () => {
      resetConnection();
      reject(req.error);
    };
    req.onblocked = () => {
      // Do not fail immediately: an older tab may release the connection shortly.
      // The browser will continue the open request when the blocker disappears.
      console.warn('[FVI] IndexedDB open is blocked by another tab/version.');
    };
  });

  return dbPromise;
}

async function runRequest(storeName, mode, requestFactory, {retries=2}={}){
  let lastError;

  for(let attempt=0; attempt<=retries; attempt++){
    const db = await openDB();
    try {
      return await new Promise((resolve,reject)=>{
        let settled = false;
        let transaction;
        let request;

        const finishResolve = value => {
          if(settled) return;
          settled = true;
          resolve(value);
        };
        const finishReject = error => {
          if(settled) return;
          settled = true;
          reject(error);
        };

        try {
          // Create the transaction and enqueue its request in the same synchronous turn.
          // This avoids transactions becoming inactive between separate async helpers.
          transaction = db.transaction(storeName, mode);
          const store = transaction.objectStore(storeName);
          request = requestFactory(store);
        } catch(error){
          finishReject(error);
          return;
        }

        request.onsuccess = () => finishResolve(request.result);
        request.onerror = () => finishReject(request.error || transaction?.error || new Error('IndexedDB request failed'));
        transaction.onabort = () => finishReject(transaction.error || new Error('IndexedDB transaction aborted'));
      });
    } catch(error){
      lastError = error;
      if(!isRetryableConnectionError(error) || attempt >= retries) throw error;

      // A cached IDBDatabase may have entered the closing state (for example after
      // a browser lifecycle/versionchange event). Discard it and reopen cleanly.
      try { db.close(); } catch {}
      resetConnection(db);
      await wait(20 * (attempt + 1));
    }
  }

  throw lastError;
}

export async function put(store, value){
  await runRequest(store,'readwrite',s=>s.put(value));
  return value;
}

export async function get(store,key){
  const result = await runRequest(store,'readonly',s=>s.get(key));
  return result ?? null;
}

export async function del(store,key){
  await runRequest(store,'readwrite',s=>s.delete(key));
}

export async function all(store){
  const result = await runRequest(store,'readonly',s=>s.getAll());
  return result || [];
}

export async function byIndex(store,index,key){
  const result = await runRequest(store,'readonly',s=>s.index(index).getAll(key));
  return result || [];
}

export async function clear(store){
  await runRequest(store,'readwrite',s=>s.clear());
}

export async function bulkPut(store, values=[]){
  for(const value of values) await put(store,value);
}

export async function getSetting(key, fallback=null){
  const row = await get('settings',key);
  return row?.value ?? fallback;
}

export async function setSetting(key,value){
  return put('settings',{key,value});
}

export async function cacheDataset({profiles=[],visits=[],calls=[],taxonomy=[]}){
  await bulkPut('profiles',profiles);
  await bulkPut('visits',visits);
  await bulkPut('calls',calls);
  await bulkPut('taxonomy',taxonomy);
}

// Explicit lifecycle hook for future use/tests. Normal application code does not
// need to call this; operations self-heal if the browser closes the connection.
export function closeLocalDatabase(){
  if(dbHandle){
    try { dbHandle.close(); } catch {}
  }
  resetConnection();
}
