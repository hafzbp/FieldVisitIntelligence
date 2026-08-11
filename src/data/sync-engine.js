import * as Local from './local-db.js';
import * as Cloud from './cloud-repository.js';
import { nowISO, uid } from '../config/utils.js';

let listeners=[]; let syncing=false;
export function onSyncStatus(fn){listeners.push(fn);return()=>listeners=listeners.filter(x=>x!==fn)}
export async function getQueue(){return (await Local.all('queue')).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)))}
async function emit(){const q=await getQueue();const errors=q.filter(x=>x.status==='ERROR').length;const pending=q.filter(x=>x.status!=='ERROR').length;listeners.forEach(fn=>fn({online:navigator.onLine,pending:q.length,actionablePending:pending,errors,syncing}))}

function recordKey(entity,operation,payload){return `${entity}:${operation}:${payload?.id||''}`}

export async function enqueue(entity,operation,payload){
  // Coalesce repeated UPSERTs for the same record. Field edits made before cloud sync
  // should result in one queue item containing the newest canonical local state.
  const queue=await getQueue();
  const key=recordKey(entity,operation,payload);
  const duplicates=queue.filter(x=>recordKey(x.entity,x.operation,x.payload)===key);
  let item;
  if(duplicates.length){
    item={...duplicates[0],payload,updated_at:nowISO(),status:'PENDING',last_error:null};
    await Local.put('queue',item);
    for(const extra of duplicates.slice(1)) await Local.del('queue',extra.id);
  }else{
    item={id:uid('queue'),entity,operation,payload,created_at:nowISO(),updated_at:nowISO(),status:'PENDING',attempts:0,last_error:null};
    await Local.put('queue',item);
  }
  await emit();if(navigator.onLine) syncNow();return item;
}

async function processItem(item){
  item.status='SYNCING';item.last_attempt_at=nowISO();await Local.put('queue',item);await emit();
  if(item.entity==='visit'&&item.operation==='UPSERT') await Cloud.upsertVisit(item.payload);
  else if(item.entity==='call'&&item.operation==='UPSERT') await Cloud.upsertCall(item.payload);
  else if(item.entity==='call'&&item.operation==='SOFT_DELETE') await Cloud.softDeleteCall(item.payload.id);
  else throw new Error(`Unsupported sync operation: ${item.entity}/${item.operation}`);
  await Local.del('queue',item.id);
}

export async function syncNow(){
  if(syncing||!navigator.onLine) return;
  syncing=true;await emit();
  const items=await getQueue();
  for(const item of items){
    try{
      await processItem(item);
    }catch(e){
      item.status='ERROR';item.attempts=(item.attempts||0)+1;item.last_error=e?.message||String(e);item.last_attempt_at=nowISO();await Local.put('queue',item);await emit();
      if(/JWT|session|auth|refresh token/i.test(item.last_error)) break;
    }
  }
  syncing=false;await emit();
}

export async function retryItem(id){
  const item=await Local.get('queue',id);if(!item)return false;
  item.status='PENDING';item.last_error=null;await Local.put('queue',item);await emit();
  await syncNow();return true;
}
export async function retryAllErrors(){
  const items=await getQueue();
  for(const item of items.filter(x=>x.status==='ERROR')){item.status='PENDING';item.last_error=null;await Local.put('queue',item)}
  await emit();await syncNow();
}
export async function queueDiagnostics(){
  const items=await getQueue();
  return {items,total:items.length,errors:items.filter(x=>x.status==='ERROR').length,pending:items.filter(x=>x.status!=='ERROR').length};
}

window.addEventListener('online',()=>syncNow());
window.addEventListener('offline',()=>emit());
