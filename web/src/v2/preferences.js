// Quartinaut 2.0: Benutzeroberflächen-Präferenzen. Nur lokaler Browser-Speicher.
const PREFIX = 'quartinaut-v2-preferences:';
export const DEFAULT_PREFERENCES = Object.freeze({ categories: [] });
function keyFor(uid) { return PREFIX + String(uid || 'guest').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100); }
export function readPreferences(uid) {
  try {
    const raw = JSON.parse(localStorage.getItem(keyFor(uid)) || 'null');
    return {
      categories: Array.isArray(raw?.categories) ? [...new Set(raw.categories.filter(x => typeof x === 'string'))].slice(0, 30) : []
    };
  } catch { return { ...DEFAULT_PREFERENCES, categories: [] }; }
}
export function updatePreferences(uid, changes) {
  const previous = readPreferences(uid);
  const next = { categories: Array.isArray(changes?.categories)
    ? [...new Set(changes.categories.filter(x => typeof x === 'string'))].slice(0, 30)
    : previous.categories };
  try { localStorage.setItem(keyFor(uid), JSON.stringify(next)); } catch { /* Storage unavailable: retain usable UI */ }
  return next;
}
export function matchHelpRequests(requests, { uid = '', categories = [], area = '', score = () => 0 } = {}) {
  const wanted = new Set(categories);
  return requests.filter(r => r && r.status === 'offen' && r.type === 'Suche' && String(r.uid || r.authorId || '') !== uid)
    .map(r => ({ request: r, points: (wanted.has(r.category) ? 100 : 0) + (r.area === area ? 30 : 0) + Number(score(r) || 0) }))
    .sort((a, b) => b.points - a.points || String(b.request.createdAt || '').localeCompare(String(a.request.createdAt || '')))
    .map(item => item.request);
}
export function requestJourney(request, chats = []) {
  if (!request) return { label: 'Unbekannt', step: 0, detail: '' };
  if (request.status === 'wartet_freigabe') return { label: 'In Prüfung', step: 1, detail: 'Dein Anliegen wartet auf Freigabe.' };
  if (request.status === 'abgelehnt') return { label: 'Überarbeiten', step: 1, detail: 'Bitte den Ablehnungsgrund prüfen.' };
  if (request.status === 'erledigt' || request.status === 'archiviert') return { label: 'Abgeschlossen', step: 3, detail: 'Dieses Anliegen ist abgeschlossen.' };
  if (request.status === 'abgelaufen') return { label: 'Abgelaufen', step: 3, detail: 'Die Laufzeit ist beendet.' };
  const hasConversation = chats.some(c => c && (c.requestId === request.id || c.reqId === request.id));
  return hasConversation
    ? { label: 'Im Gespräch', step: 2, detail: 'Öffne deine Chats, um die Hilfe zu koordinieren.' }
    : { label: 'Veröffentlicht', step: 1, detail: 'Nachbarn können jetzt antworten.' };
}
