import * as Local from './local-db.js';
import * as Cloud from './cloud-repository.js';

function imageFromFile(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
    img.onerror=e=>{URL.revokeObjectURL(url);reject(e)};
    img.src=url;
  });
}

export async function compressImage(file,{maxDimension=1280,quality=0.78,maxBytes=950000}={}){
  if(!file?.type?.startsWith('image/')) throw new Error('File harus berupa gambar.');
  const img=await imageFromFile(file);
  let dim=Math.max(480,Number(maxDimension||1280));
  let q=Math.min(0.9,Math.max(0.45,Number(quality||0.78)));
  let last=null;
  for(let attempt=0;attempt<6;attempt++){
    const scale=Math.min(1,dim/Math.max(img.naturalWidth,img.naturalHeight));
    const width=Math.max(1,Math.round(img.naturalWidth*scale));
    const height=Math.max(1,Math.round(img.naturalHeight*scale));
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d',{alpha:false});ctx.drawImage(img,0,0,width,height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',q));
    if(!blob) throw new Error('Gagal mengompresi foto.');
    last={blob,width,height,mime_type:'image/webp',size_bytes:blob.size};
    if(blob.size<=Number(maxBytes||950000)) return last;
    // Stay below the private bucket's 1 MB limit with safety headroom.
    q=Math.max(0.45,q-0.10);
    dim=Math.max(480,Math.round(dim*0.82));
  }
  if(last?.size_bytes>Number(maxBytes||950000)) throw new Error('Foto masih terlalu besar setelah kompresi. Ambil/pilih foto dengan resolusi lebih kecil.');
  return last;
}

export async function stagePhoto({id,callId,userId,file,photoType='OTHER',caption='',config={}}){
  const compressed=await compressImage(file,config);
  const storagePath=`${userId}/${callId}/${id}.webp`;
  const row={id,call_id:callId,jovis_user_id:userId,storage_path:storagePath,photo_type:photoType,caption,mime_type:compressed.mime_type,size_bytes:compressed.size_bytes,created_at:new Date().toISOString()};
  await Local.put('photoBlobs',{id,blob:compressed.blob,row});
  return row;
}

export async function uploadStagedPhoto(payload){
  const staged=await Local.get('photoBlobs',payload.id);
  if(!staged?.blob) throw new Error('Foto lokal tidak ditemukan. Pilih ulang foto jika cache browser sudah dibersihkan.');
  await Cloud.uploadPhotoBlob(staged.row.storage_path,staged.blob,staged.row.mime_type);
  const remote=await Cloud.upsertPhoto(staged.row);
  await Local.put('photos',remote||staged.row);
  await Local.del('photoBlobs',payload.id);
  return remote||staged.row;
}

export async function pendingPhotoRows(ids=[]){
  const out=[];
  for(const id of ids){const x=await Local.get('photoBlobs',id);if(x?.row)out.push(x.row)}
  return out;
}

export async function signedPhotoUrl(storagePath,expiresIn=900){return Cloud.createPhotoSignedUrl(storagePath,expiresIn)}
