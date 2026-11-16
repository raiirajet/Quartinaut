// Persönliches Dashboard-Bild: ausschliesslich auf diesem Gerät, ohne Firebase-Upload.
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_SAVED_CHARS = 480000;
export const ALLOWED_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);
export function dashboardPhotoKey(uid) {
  return `quartinaut-dashboard-photo-v462:${String(uid || 'guest').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128)}`;
}
export function isValidDashboardPhoto(data) {
  return typeof data === 'string' && data.length < MAX_SAVED_CHARS && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data);
}
export function readDashboardPhoto(uid, storage = localStorage) {
  try { const data = storage.getItem(dashboardPhotoKey(uid)); return isValidDashboardPhoto(data) ? data : ''; } catch { return ''; }
}
export function saveDashboardPhoto(uid, data, storage = localStorage) {
  if (!isValidDashboardPhoto(data)) throw new Error('Das Hintergrundbild ist zu gross oder hat ein ungültiges Format.');
  storage.setItem(dashboardPhotoKey(uid), data);
}
export function clearDashboardPhoto(uid, storage = localStorage) {
  storage.removeItem(dashboardPhotoKey(uid));
}
export async function prepareDashboardPhoto(file) {
  if (!file || !ALLOWED_TYPES.includes(file.type)) throw new Error('Bitte JPG, PNG oder WebP auswählen.');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Das Bild darf höchstens 8 MB gross sein.');
  const blobUrl = URL.createObjectURL(file);
  let img;
  try {
    img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Das Bild konnte nicht geöffnet werden.'));
      image.src = blobUrl;
    });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
  const naturalWidth = img.naturalWidth, naturalHeight = img.naturalHeight;
  if (!naturalWidth || !naturalHeight || naturalWidth * naturalHeight > 70000000) throw new Error('Das Foto hat eine zu hohe Auflösung.');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Bildbearbeitung wird auf diesem Gerät nicht unterstützt.');
  let scale = Math.min(1, 1400 / Math.max(naturalWidth, naturalHeight));
  for (let i = 0; i < 5; i++) {
    canvas.width = Math.max(1, Math.round(naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(naturalHeight * scale));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const jpeg = canvas.toDataURL('image/jpeg', Math.max(.53, .78 - i * .06));
    if (isValidDashboardPhoto(jpeg)) return jpeg;
    scale *= .77;
  }
  throw new Error('Bild zu gross. Bitte ein kleineres Foto verwenden.');
}
