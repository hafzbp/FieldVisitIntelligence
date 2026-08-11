import * as Local from './local-db.js';
import * as Cloud from './cloud-repository.js';
import { nowISO, uid } from '../config/utils.js';

let listeners=[]; let syncing=false;
export function onSyncStatus(fn){listeners.push(fn);return()=>listeners=listeners.filter(x=>x!==fn)}
async function emit(){const q=await Local.all('queue');const errors=q.filter(x=>x.status==='ERROR').length;listeners.forEach(fn=>fn({online:navigator.onLine,pending:q.length,errors,syncing}))}

export async function enqueue(entity,operation,payload){
  const item={id:uid('queue'),entity,operation,payload,created_at:nowISO(),status:'PENDING',attempts:0,last_error:null};
  await Local.put('queue',item);await emit();if(navigator.onLine) syncNow();return item;
}

export async function syncNow(){
  if(syncing||!navigator.onLine) return;
  syncing=true;await emit();
  const items=(await Local.all('queue')).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
  for(const item of items){
    try{
      if(item.entity==='visit'&&item.operation==='UPSERT') await Cloud.upsertVisit(item.payload);
      else if(item.entity==='call'&&item.operation==='UPSERT') await Cloud.upsertCall(item.payload);
      else if(item.entity==='call'&&item.operation==='SOFT_DELETE') await Cloud.softDeleteCall(item.payload.id);
      await Local.del('queue',item.id);
    }catch(e){
      item.status='ERROR';item.attempts=(item.attempts||0)+1;item.last_error=e?.message||String(e);await Local.put('queue',item);
      if(/JWT|session|auth/i.test(item.last_error)) break;
    }
  }
  syncing=false;await emit();
}

window.addEventListener('online',()=>syncNow());
window.addEventListener('offline',()=>emit());
