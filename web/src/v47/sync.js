// Quartinaut 4.7 — stable, owner-scoped synchronization primitives.
// Never writes directly to Firestore. All mutations go through checked callables.
export function favoriteDocId(kind, value) {
  const input = `${String(kind)}:${String(value)}`;
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function normalizedFavorite(kind, value) {
  const allowed = ['request', 'hub', 'group', 'people', 'groups', 'searches'];
  const v = String(value || '').trim().slice(0, 120);
  if (!allowed.includes(kind) || !v || /[\u0000-\u001f]/.test(v)) return null;
  return { kind, value: v, id: favoriteDocId(kind, v) };
}
export function contentVersion(item) {
  // Key is bound to the visible content and version; a later edit becomes unread.
  const raw = [item.key, item.title, item.detail, item.at, item.version || ''].map(x => String(x ?? '')).join('\u001f');
  let a = 2166136261;
  const bytes = new TextEncoder().encode(raw);
  for (const byte of bytes) { a ^= byte; a = Math.imul(a, 16777619); }
  return `v1-${(a >>> 0).toString(16).padStart(8, '0')}`;
}
export function makeOperationId(prefix = 'op') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `${prefix}_${crypto.randomUUID()}`;
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes);
  else throw new Error('Sichere Vorgangskennung nicht verfügbar.');
  return `${prefix}_${[...bytes].map(x => x.toString(16).padStart(2, '0')).join('')}`;
}
const safeUid = uid => String(uid || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
const keyFor = (uid, kind) => `quartinaut-v47:${safeUid(uid)}:${kind}`;
export function readJson(storage, key, fallback) {
  try { const raw = storage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function saveJson(storage, key, value) { storage.setItem(key, JSON.stringify(value)); }
export function createOwnerSync({ uid, storage = localStorage, callable, subscribe, onChange = () => {}, onError = () => {} }) {
  if (!uid) throw new Error('Synchronisierung benötigt ein angemeldetes Konto.');
  let closed = false, busy = false;
  const unsubscribers = [];
  const serverFavorites = new Map();
  const serverReads = new Map();
  const queueKey = keyFor(uid, 'pending');
  const favoritesKey = keyFor(uid, 'favorites');
  const readsKey = keyFor(uid, 'reads');
  let favorites = new Map(readJson(storage, favoritesKey, []).map(x => [x.id, x]));
  let reads = new Map(readJson(storage, readsKey, []).map(x => [x.id, x]));
  const queue = () => readJson(storage, queueKey, []).filter(x => x?.opId && x?.action);
  function overlayPending() {
    const fav = new Map(serverFavorites);
    const seen = new Map(serverReads);
    for (const op of queue()) {
      if (op.action === 'favorite.set') fav.set(op.payload.id, { ...op.payload, active: op.payload.active });
      if (op.action === 'favorite.import') for (const item of op.payload.items || []) {
        // A server tombstone (active:false) must win over any stale import.
        if (!fav.has(item.id)) fav.set(item.id, { ...item, active: true, legacy: true });
      }
      if (op.action === 'read.mark') seen.set(op.payload.id, op.payload);
    }
    favorites = fav; reads = seen;
    saveJson(storage, favoritesKey, [...fav.values()]);
    saveJson(storage, readsKey, [...seen.values()]);
    onChange();
  }
  async function flush() {
    if (busy || closed || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    busy = true;
    try {
      let steps = 0;
      while (!closed && steps++ < 500) {
        const pending = queue();
        if (!pending.length) break;
        const next = pending[0];
        try { await callable('quartinautUserSync', { action: next.action, opId: next.opId, ...next.payload }); }
        catch (error) { if (!closed) onError(error); break; }
        if (closed) break;
        // If a second device changed the same favorite in the meantime, its latest
        // server state wins after the local optimistic queue is acknowledged.
        saveJson(storage, queueKey, queue().filter(x => x.opId !== next.opId));
      }
    } finally { busy = false; if (!closed) onChange(); }
  }
  function enqueue(action, payload) {
    if (closed) return;
    const pending = queue();
    pending.push({ action, payload, opId: makeOperationId('sync') });
    saveJson(storage, queueKey, pending);
    overlayPending();
    void flush();
  }
  function setFavorite(kind, value, active) {
    const entry = normalizedFavorite(kind, value); if (!entry) throw new Error('Ungültiger Favorit.');
    enqueue('favorite.set', { ...entry, active: Boolean(active) });
  }
  function markRead(entry) {
    const id = favoriteDocId('read', entry.key);
    enqueue('read.mark', { id, key: entry.key, version: contentVersion(entry) });
  }
  function isRead(entry) {
    const doc = reads.get(favoriteDocId('read', entry.key));
    return Boolean(doc && doc.version === contentVersion(entry));
  }
  function favoriteList(kind) { return [...favorites.values()].filter(x => x.active && (!kind || kind === x.kind)); }
  function isFavorite(kind, value) { return favorites.get(favoriteDocId(kind, value))?.active === true; }
  async function importLegacy(items) {
    const marker = keyFor(uid, 'migration-submitted');
    if (closed || readJson(storage, marker, false)) return;
    const unique = [...new Map(items.map(x => normalizedFavorite(x.kind, x.value)).filter(Boolean).map(x => [x.id, x])).values()];
    // Durable once-per-install import. Offline chunks are retried just like individual
    // mutations. Server tombstones always take precedence over imported values.
    for (let i = 0; i < unique.length; i += 200) enqueue('favorite.import', { items: unique.slice(i, i + 200) });
    if (!closed) saveJson(storage, marker, true);
  }
  function subscribeOwnerCollections() {
    if (closed) return;
    unsubscribers.push(subscribe(uid, 'favorites', docs => {
      if (closed) return;
      serverFavorites.clear(); for (const doc of docs) if (doc?.id) serverFavorites.set(doc.id, doc);
      overlayPending();
    }));
    unsubscribers.push(subscribe(uid, 'reads', docs => {
      if (closed) return;
      serverReads.clear(); for (const doc of docs) if (doc?.id) serverReads.set(doc.id, doc);
      overlayPending();
    }));
  }
  function dispose() { closed = true; unsubscribers.forEach(fn => fn?.()); unsubscribers.length = 0; }
  return { uid, setFavorite, favoriteList, isFavorite, markRead, isRead, flush, importLegacy, subscribeOwnerCollections, dispose };
}
