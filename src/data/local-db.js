import { DB_NAME, DB_VERSION } from '../config/app-config.js';

let dbPromise;

function openDB(){
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
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
  return dbPromise;
}

async function tx(store, mode='readonly'){
  const db = await openDB();
  return db.transaction(store, mode).objectStore(store);
}

export async function put(store, value){
  const s=await tx(store,'readwrite');
  return new Promise((resolve,reject)=>{const r=s.put(value);r.onsuccess=()=>resolve(value);r.onerror=()=>reject(r.error)});
}
export async function get(store,key){
  const s=await tx(store);
  return new Promise((resolve,reject)=>{const r=s.get(key);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)});
}
export async function del(store,key){
  const s=await tx(store,'readwrite');
  return new Promise((resolve,reject)=>{const r=s.delete(key);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)});
}
export async function all(store){
  const s=await tx(store);
  return new Promise((resolve,reject)=>{const r=s.getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)});
}
export async function byIndex(store,index,key){
  const s=await tx(store); const idx=s.index(index);
  return new Promise((resolve,reject)=>{const r=idx.getAll(key);r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)});
}
export async function clear(store){
  const s=await tx(store,'readwrite');
  return new Promise((resolve,reject)=>{const r=s.clear();r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)});
}
export async function bulkPut(store, values=[]){for(const v of values) await put(store,v)}

export async function getSetting(key, fallback=null){const r=await get('settings',key);return r?.value ?? fallback}
export async function setSetting(key,value){return put('settings',{key,value})}

export async function cacheDataset({profiles=[],visits=[],calls=[],taxonomy=[]}){
  await bulkPut('profiles',profiles);await bulkPut('visits',visits);await bulkPut('calls',calls);await bulkPut('taxonomy',taxonomy);
}
