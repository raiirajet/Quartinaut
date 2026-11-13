'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const sharp = require('sharp');
const { BUCKET, MAX_IMAGE_PIXELS, safeUid, imagePath, decodeImage } = require('./validation');

if (!getApps().length) initializeApp();
const db = getFirestore();
const bucket = getStorage().bucket(BUCKET);
const COLLECTION = db.collection('dashboardBackgrounds');
const MAX_OUTPUT_BYTES = 480000;
const OPTIONS = {
  region: 'europe-west6',
  memory: '512MiB',
  maxInstances: 6,
  timeoutSeconds: 45
};

function error(code, detail) { throw new HttpsError(code, detail); }

async function authorize(request) {
  if (!request.auth?.uid) error('unauthenticated','Bitte anmelden.');
  const uid = safeUid(request.auth.uid);
  if (request.auth.token.email_verified !== true) {
    error('permission-denied','Bitte zuerst deine E-Mail-Adresse bestätigen.');
  }
  // Never trust the caller-supplied uid or "admin" role. The function only
  // operates on the Firebase-authenticated caller's private background.
  const snap = await db.collection('users').doc(uid).get();
  const profile = snap.data();
  if (!profile || ['disabled','deleted','pending_verification'].includes(profile.accountStatus)) {
    error('permission-denied','Dein Konto ist nicht freigeschaltet.');
  }
  return uid;
}

async function sanitizedJpeg(raw) {
  let input;
  try { input = decodeImage(raw); }
  catch(e) { error('invalid-argument',e.message); }
  try {
    const picture = sharp(input,{ limitInputPixels: MAX_IMAGE_PIXELS, failOn:'error' });
    const info = await picture.metadata();
    if (info.format!=='jpeg' || !info.width || !info.height ||
        info.width*info.height > MAX_IMAGE_PIXELS) {
      error('invalid-argument','Bildauflösung oder JPEG-Format ungültig.');
    }
    const width = Math.min(info.width,1600);
    const height = Math.min(info.height,1600);
    for (const quality of [82,72,60,48]) {
      // Rotate according to original EXIF, then remove all original metadata.
      // Without enlargement, even panoramic input remains bounded.
      const output = await sharp(input,{limitInputPixels:MAX_IMAGE_PIXELS,failOn:'error'})
        .rotate()
        .resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true})
        .jpeg({quality,mozjpeg:true,progressive:true})
        .toBuffer({resolveWithObject:true});
      if(output.data.length <= MAX_OUTPUT_BYTES) {
        return {buffer:output.data,width:output.info.width,height:output.info.height};
      }
    }
    error('resource-exhausted','Bild konnte nicht ausreichend verkleinert werden.');
  } catch(e) {
    if (e instanceof HttpsError) throw e;
    error('invalid-argument','Bild konnte nicht verarbeitet werden.');
  }
}

// Prevent a single authenticated account from incurring excessive image writes.
// A daily limit of 24 image writes and a 10 second minimum spacing protect costs;
// reads are still private and only return a 480 KB maximum JPEG.
async function checkWriteQuota(uid) {
  const today=new Date().toISOString().slice(0,10);
  const ref=db.collection('dashboardBackgroundQuotas').doc(uid+'_'+today);
  const now=Date.now();
  await db.runTransaction(async tx => {
    const snap=await tx.get(ref);
    const used=Number(snap.data()?.count||0);
    const last=Number(snap.data()?.lastWriteMillis||0);
    if(used>=24)error('resource-exhausted','Tageslimit für Hintergrundänderungen erreicht.');
    if(now-last<10000)error('resource-exhausted','Bitte zwischen zwei Bildänderungen kurz warten.');
    tx.set(ref,{
      ownerUid:uid,day:today,count:used+1,lastWriteMillis:now,
      updatedAt:FieldValue.serverTimestamp()
    },{merge:true});
  });
}

exports.quartinautAppearance = onCall(OPTIONS,async request => {
  const uid = await authorize(request);
  const data = request.data || {};
  const action = data.action;
  if (!['get','save','remove','status'].includes(action)) {
    error('invalid-argument','Unbekannte Hintergrundbild-Aktion.');
  }
  const doc = COLLECTION.doc(uid);
  const file = bucket.file(imagePath(uid));
  if (action === 'status') {
    const snap = await doc.get();
    return {ok:true,hasImage:snap.exists,updatedAt:snap.data()?.updatedAt?.toDate?.()?.toISOString?.() || null};
  }
  if (action === 'get') {
    const [metadata, exists] = await Promise.all([doc.get(),file.exists()]);
    if (!metadata.exists || !exists[0]) return {ok:true,hasImage:false,base64:null};
    try {
      const [image] = await file.download();
      if(image.length > MAX_OUTPUT_BYTES) error('internal','Serverbild ist unerwartet gross.');
      return {
        ok:true,hasImage:true,mime:'image/jpeg',
        base64:image.toString('base64'),
        updatedAt:metadata.data()?.updatedAt?.toDate?.()?.toISOString?.() || null
      };
    } catch(e) {
      if (e instanceof HttpsError) throw e;
      error('unavailable','Hintergrundbild momentan nicht erreichbar.');
    }
  }
  if (action === 'save') {
    const image = await sanitizedJpeg(data.base64);
    await checkWriteQuota(uid);
    await file.save(image.buffer,{
      resumable:false,
      validation:'crc32c',
      metadata:{
        contentType:'image/jpeg',
        cacheControl:'private, no-store',
        metadata:{ownerUid:uid,kind:'dashboardBackground',version:'1'}
      }
    });
    await doc.set({
      ownerUid:uid,storagePath:imagePath(uid),
      size:image.buffer.length,width:image.width,height:image.height,
      updatedAt:FieldValue.serverTimestamp()
    },{merge:true});
    return {ok:true,hasImage:true,size:image.buffer.length};
  }
  // Remove is safe to call repeatedly. Storage rules deny client reads.
  await checkWriteQuota(uid);
  try { await file.delete({ignoreNotFound:true}); }
  catch(e) { error('unavailable','Hintergrundbild konnte nicht gelöscht werden.'); }
  await doc.delete();
  return {ok:true,hasImage:false};
});
