import { readPreferences, updatePreferences, matchHelpRequests, requestJourney } from './src/v2/preferences.js';
import { mountRequestWizard } from './src/v2/wizard.js';
import { setupPwaUpdates, setupConnectivity } from './src/v2/pwa-updates.js';
import { HUB_MODULES, HUB_CATEGORIES, HOME_OPTIONS, NOTIFY_TOPICS, loadHome, saveHome, matchingItems, localDraft } from './src/v3/community.js';
import { V46_FILTERS, V46_SEARCH_TYPES, V46_INBOX_TYPES, normalizeSearch, readUserData, writeUserData, publicSearchIndex, searchRecords, filterFeed, safeMapPoint, cleanCollection, safeDrafts, safeEmbedBox } from './src/v46/features.js';
import { readDashboardPhoto, saveDashboardPhoto, clearDashboardPhoto, prepareDashboardPhoto } from './src/v462/dashboard-background.js';
import { openDashboardPhotoEditor } from './src/v47/dashboard-editor.js';
import { createOwnerSync, makeOperationId } from './src/v47/sync.js';
const STORAGE_KEY = 'quartinaut-app-v4'; // Nur unsensible globale UI-Einstellungen (kompatibler Schlüssel)
const USER_PREFS_PREFIX = 'quartinaut-user-prefs-v1:';
const LOCAL_STATE_PREFIX = 'quartinaut-local-state-v1:';
const MAX_COLLECTION_RESULTS = 250;
const AUTH_SESSION_KEY = 'quartinaut-auth-session-v1';
const AUTH_USERS_KEY = 'quartinaut-auth-users-v1';
const LOCATION_DATA_URL = './assets/data/ch-locations-2026.json';
const PENDING_GOOGLE_REG_KEY = 'quartinaut-pending-google-registration-v1';
const VIEWER_GEO_KEY = 'quartinaut-viewer-geo-v1';
const ONBOARDING_VERSION = 2;
const ONBOARDING_SEEN_KEY = `quartinaut-onboarding-seen-v${ONBOARDING_VERSION}`;
const NOTIFICATION_BANNER_DISMISSED_KEY = 'quartinaut-notification-banner-dismissed-v1';
const THEME_KEY = 'quartinaut-theme';
const FIREBASE_VAPID_KEY = window.QUARTINAUT_FIREBASE_VAPID_KEY || '';
const FIREBASE_CONFIG = window.QUARTINAUT_FIREBASE_CONFIG || {};
const FIREBASE_APP_CHECK_SITE_KEY = window.QUARTINAUT_APP_CHECK_SITE_KEY || '';
const FIREBASE_READY = Boolean(FIREBASE_CONFIG.apiKey && !String(FIREBASE_CONFIG.apiKey).includes('ERSETZEN'));
const APP_ICON_192 = 'assets/icons/icon-192.png';
const byId = (id) => document.getElementById(id);
const nowIso = () => new Date().toISOString();
const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();
const hoursFromNow = (h) => new Date(Date.now() + h * 3600000).toISOString();

// Standard-Ablaufzeit (TTL) je Dringlichkeit – P4 "Daten verfallen".
const TTL_HOURS = { 'Heute': 24, 'Morgen': 48, 'Diese Woche': 168, 'Nicht dringend': 336 };
function expiryForUrgency(urgency) {
  return hoursFromNow(TTL_HOURS[urgency] || 72);
}

const FALLBACK_LOCATION_DATA = {
  source: 'Fallback',
  snapshotDate: '2026-01-01',
  cantons: [
    { id: '1', bfsCode: '1', code: 'ZH', name: 'Zürich', municipalities: [{ bfsCode: '261', name: 'Zürich', shortName: 'Zürich' }] },
    { id: '2', bfsCode: '2', code: 'BE', name: 'Bern / Berne', municipalities: [{ bfsCode: '351', name: 'Bern', shortName: 'Bern' }] }
  ]
};
const CATEGORIES = [
  'Alltagshilfe',
  'Kinder',
  'Werkzeug',
  'Mobilität',
  'Tiere',
  'Information',
  'Notfall',
  'Gesundheit',
  'Seniorenhilfe',
  'Digitalhilfe',
  'Wohnen',
  'Bildung',
  'Nachhaltigkeit',
  'Firmen / Arbeit'
];
const OFFICIAL_NOTICE_CATEGORIES = [
  'Allgemein',
  'Verkehr',
  'Versorgung',
  'Entsorgung',
  'Veranstaltung',
  'Verwaltung',
  'Schule',
  'Sicherheit'
];
const NOTIFICATION_SOURCES = ['alerts', 'officialNotices', 'requests'];
const MAX_NOTIFICATION_KEYWORD_RULES = 20;
const SWISS_CANTON_CODES = [
  'ZH', 'BE', 'LU', 'UR', 'SZ', 'OW', 'NW', 'GL', 'ZG', 'FR', 'SO', 'BS', 'BL',
  'SH', 'AR', 'AI', 'SG', 'GR', 'AG', 'TG', 'TI', 'VD', 'VS', 'NE', 'GE', 'JU'
];
const DISTANCE_FILTER_VALUES = ['Alle', '2', '5', '10', '20', '50'];
const DEFAULT_REQUEST_RADIUS_KM = 15;
const VERSION = '6.7.2-auth-login-fallback'; // Legacy storage version remains unchanged to preserve existing data
const UI_VERSION = '4.7.0';
const CHAT_TRASH_RETENTION_DAYS = 30;
const CHAT_TRASH_RETENTION_MS = CHAT_TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const ADMIN_INVITE_CODES = new Set(); // Keine Admincodes im öffentlichen Client
const DEFAULT_INVITE_CODE = 'QRT-2026'; // Einladungskennzeichen, KEIN Administrationsnachweis
const PRIMARY_ADMIN_EMAILS = new Set(); // Adminrechte ausschliesslich aus verifizierten Firebase Custom Claims
const FIRESTORE_COLLECTIONS = {
  users: 'users',
  requests: 'requests',
  alerts: 'alerts',
  officialNotices: 'officialNotices',
  moderation: 'moderationCases',
  inviteCodes: 'inviteCodes',
  locationChangeRequests: 'locationChangeRequests',
  verificationRequests: 'verificationRequests',
  changeRequests: 'changeRequests',
  deviceTokens: 'deviceTokens',
  alertReads: 'alertReads',
  areaCategoryPriority: 'areaCategoryPriority',
  bulletinFilters: 'bulletinFilters',
  notificationPreferences: 'notificationPreferences',
  pushDeliveries: 'pushDeliveries',
  pushTests: 'pushTests',
  publicStats: 'publicStats',
  auditLog: 'auditLog',
  chats: 'chats',
  chatMessages: 'chatMessages',
  communityEvents: 'communityEvents',
  communityReviews: 'communityReviews',
  communityTrust: 'communityTrust'
};

const seed = {
  version: VERSION,
  route: 'home',
  chatView: 'active',
  locale: '',
  filter: { q: '', category: 'Alle', type: 'Alle', distanceKm: 'Alle' },
  dashboard: {
    version: 2,
    order: [],
    hidden: [],
    collapsed: ['kennzahlen', 'kantonskarte', 'firmen', 'erststart', 'so-funktionierts']
  },
  onboarding: {
    version: 0,
    completed: false,
    completedAt: '',
    skipped: false,
    checklist: {}
  },
  adminUsers: {
    view: 'active',
    q: '',
    status: 'all',
    role: 'all',
    accountType: 'all',
    verification: 'all',
    canton: 'all',
    sort: 'updatedAt',
    dir: 'desc',
    page: 1,
    pageSize: 20
  },
  profile: {
    name: '',
    initials: '',
    area: '',
    location: null,
    role: 'resident',
    accountType: 'resident',
    accountStatus: 'active',
    companyName: '',
    companyPurpose: '',
    companyStatus: 'none',
    municipalityName: '',
    municipalityDepartment: '',
    municipalityWebsite: '',
    municipalityStatus: 'none',
    adminScopeArea: '',
    verified: false,
    verificationStatus: 'none',
    verificationLabel: '',
    titleVisible: true,
    titlePreset: 'auto',
    titleGrants: [],
    passkeyReady: false,
    notifications: false,
    geoOptIn: true
  },
  requests: [],
  chats: [],
  chatMessages: [],
  communityEvents: [],
  communityTrust: {count:0,average:0},
  eligibleReviews: [],
  publicTrust: {},
  alerts: [],
  officialNotices: [],
  alertReads: [],
  deviceTokens: [],
  areaCategoryPriority: [],
  bulletinFilters: [],
  notificationPreferences: null,
  pushDeliveries: [],
  registeredUsers: [],
  publicStats: { cantonCounts: {}, totalUsers: 0, updatedAt: '' },
  archive: [],
  inviteCodes: [],
  moderation: [],
  locationChangeRequests: [],
  verificationRequests: [],
  changeRequests: [],
  auditLog: [],
  changelog: []
};

const VALID_ROUTES = ['home', 'bulletin', 'chats', 'alarme', 'profile', 'events', 'inbox', 'hub', 'search', 'map', 'saved', 'drafts'];

let state = loadState();

// Deep-Link über ?route= (z. B. aus PWA-Shortcuts).
try {
  const routeParam = new URLSearchParams(location.search).get('route');
  if (routeParam && VALID_ROUTES.includes(routeParam)) state.route = routeParam;
} catch { /* ignore */ }

let authMode = 'login';
let emailAuthNotice = ''; // No password or verification token is saved here
let authState = { ready: false, mode: FIREBASE_READY ? 'firebase' : 'local', user: null, error: '' };
let firebaseProfileRetryHandler = null; // Re-read signed-in user's profile without repeating Google OAuth
let firebaseAuthApi = null;
let firebaseStoreApi = null;
let firebaseFunctionsApi = null;
let firebaseAppCheckApi = null;
let firebaseAppInstance = null;
let firebaseMessagingApi = null;
let firebaseStorageApi = null;
let messagingWorkerRegistration = null;
let chatsUnsubscribe = null;
let chatMessagesUnsubscribe = null;
let renderQueued = false;
let activeChatUnsubscribe = null;
let contentUnsubscribe = null;
let activeChatPagination = null;
let dashboardDragId = '';
let dashboardPointerDrag = null;
const readReceiptInFlight = new Set();
let currentPushToken = '';
let locationData = FALLBACK_LOCATION_DATA;
let viewerGeo = null;
let viewerGeoPromise = null;
let swissMapSvgTemplate = null;
let swissMapSvgPromise = null;
let swissMapRenderedCacheKey = '';
let swissMapRenderedCache = null;
let swissMapHydrationId = 0;
let notificationNudgeShownInSession = false;
let onboardingTourScheduled = false;
let deferredInstallPrompt = null;
let chatTrashPruneKey = '';
let saveStateTimer = null;
let saveStateDirty = false;
let activeAccountUid = '';
let accountEpoch = 0;
let v47Sync = null;
let v47SearchGeneration = 0;
let v47SearchState = { rows: [], cursor: null, history: [null], loading: false, error: '', page: 0, next: null };
let v47ActiveDeepLink = '';
let dashboardEditing = false;
const editCards = new Set();
const activeModalClosers = new Set();

try {
  const storedGeo = JSON.parse(localStorage.getItem(VIEWER_GEO_KEY));
  if (storedGeo && Number.isFinite(Number(storedGeo.lat)) && Number.isFinite(Number(storedGeo.lng))) {
    viewerGeo = storedGeo;
  }
} catch {
  viewerGeo = null;
}

// Keine Firebase-Dokumente, Chats, Verifizierungen oder Profile global persistieren.
function globalUiSnapshot(candidate = {}) {
  return {
    version: VERSION,
    route: VALID_ROUTES.includes(candidate.route) ? candidate.route : 'home',
    locale: typeof candidate.locale === 'string' ? candidate.locale.slice(0, 12) : '',
    filter: candidate.filter && typeof candidate.filter === 'object'
      ? { q: String(candidate.filter.q || '').slice(0, 100), category: String(candidate.filter.category || 'Alle').slice(0, 80), type: String(candidate.filter.type || 'Alle').slice(0, 50), distanceKm: String(candidate.filter.distanceKm || 'Alle').slice(0, 10) }
      : structuredClone(seed.filter)
  };
}
function safeLocalRead(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function safeLocalWrite(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (error) { console.warn('[Quartinaut] Lokale Einstellungen konnten nicht gespeichert werden.', String(error?.name || error)); return false; }
}
function loadState() {
  const old = safeLocalRead(STORAGE_KEY);
  const neutral = globalUiSnapshot(old || {});
  // Der reine Offline-Demomodus darf ältere Daten genau EINEM bereits angemeldeten
  // lokalen Konto zuordnen; niemals an den nächsten (fremden) Login weitergeben.
  if (!FIREBASE_READY && old?.version === VERSION) {
    const previousLocalSession = safeLocalRead(AUTH_SESSION_KEY);
    const previousUid = previousLocalSession?.uid;
    if (previousUid && !safeLocalRead(LOCAL_STATE_PREFIX + previousUid)) {
      // Nur nach erfolgreicher Sicherung den ungesicherten globalen Speicher neutralisieren.
      if (!safeLocalWrite(LOCAL_STATE_PREFIX + previousUid, old)) return mergeDeep(structuredClone(seed), neutral);
    }
  }
  // Alte Firebase-Cache-Daten werden NICHT in eine neue Sitzung übernommen.
  // Die produktiven Datensätze verbleiben unverändert in Firestore.
  safeLocalWrite(STORAGE_KEY, neutral);
  return mergeDeep(structuredClone(seed), neutral);
}
function loadScopedState(uidValue, mode = 'firebase') {
  if (!uidValue) return loadState();
  const base = loadState();
  const saved = safeLocalRead((mode === 'local' ? LOCAL_STATE_PREFIX : USER_PREFS_PREFIX) + uidValue);
  if (!saved || saved.version !== VERSION) return base;
  if (mode === 'local') return mergeDeep(base, saved);
  return mergeDeep(base, {
    dashboard: saved.dashboard || {},
    onboarding: saved.onboarding || {},
    chatView: saved.chatView === 'trash' ? 'trash' : 'active'
  });
}
function resetAccountSession(nextUid = '', mode = 'firebase') {
  if (activeAccountUid === nextUid) return;
  // Sensitive modals (private chats, ID photos) must not survive an account switch.
  // Close before switching UID so old drafts are saved only under the old account.
  for (const close of [...activeModalClosers]) close();
  accountEpoch++;
  v47SearchGeneration++;
  if (v47Sync) { v47Sync.dispose(); v47Sync = null; }
  v47SearchState = { rows: [], cursor: null, history: [null], loading: false, error: '', page: 0, next: null };
  v46SearchUi.q='';v46SearchUi.category='';v46SearchUi.from='';v46SearchUi.to='';
  if (saveStateTimer) { clearTimeout(saveStateTimer); saveStateTimer = null; }
  saveStateDirty = false;
  stopRealtimeSubscriptions();
  photoUrlCache.clear();
  readReceiptInFlight.clear();
  v44Social.summaries.clear(); v44Social.attempted.clear();
  hubState.loaded = false; hubState.loading = false; hubState.items = []; hubState.joins = [];
  hubState.threads = []; hubState.messages = []; hubState.settings = null; hubState.stats = null;
  hubState.rsvps = []; hubState.eventRows = []; hubState.activeThread = '';
  communityBackend.eventsReady = false; communityBackend.reviewsReady = false; communityBackend.error = '';
  activeAccountUid = nextUid;
  state = nextUid ? loadScopedState(nextUid, mode) : loadState();
}
function currentAccountEpoch(uidValue, epoch) {
  return Boolean(uidValue) && activeAccountUid === uidValue &&
    authState.user?.uid === uidValue && accountEpoch === epoch;
}

function mergeDeep(base, incoming) {
  for (const [key, value] of Object.entries(incoming || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
      base[key] = mergeDeep(base[key], value);
    } else {
      base[key] = value;
    }
  }
  return base;
}

function saveStateNow() {
  if (saveStateTimer) { clearTimeout(saveStateTimer); saveStateTimer = null; }
  saveStateDirty = false;
  // Der globale Schlüssel enthält ausschliesslich neutrale Einstellungen.
  safeLocalWrite(STORAGE_KEY, globalUiSnapshot(state));
  const currentUid = authState?.user?.uid;
  if (!currentUid || currentUid !== activeAccountUid) return;
  if (authState.mode === 'local') {
    // Lokaler Demo-Modus speichert nur nach erfolgtem Login unter der jeweiligen UID.
    const scoped = structuredClone(state);
    if (scoped.dashboard) delete scoped.dashboard.editing;
    safeLocalWrite(LOCAL_STATE_PREFIX + currentUid, scoped);
    return;
  }
  const scoped = {
    version: VERSION,
    dashboard: sanitizeDashboardLayout(state.dashboard || {}),
    onboarding: normalizeOnboardingState(state.onboarding),
    chatView: state.chatView === 'trash' ? 'trash' : 'active'
  };
  safeLocalWrite(USER_PREFS_PREFIX + currentUid, scoped);
}

function saveState() {
  saveStateDirty = true;
  if (saveStateTimer) return;
  saveStateTimer = setTimeout(saveStateNow, 220);
}

window.addEventListener('pagehide', () => {
  if (saveStateDirty) saveStateNow();
});

window.addEventListener('beforeunload', () => {
  if (saveStateDirty) saveStateNow();
});

// TTL / Ablauf erzwingen (Produktprinzip P4 "Daten verfallen").
// Offene Anliegen nach Ablauf automatisch archivieren, abgelaufene Alarme entfernen.
function pruneExpired() {
  const now = Date.now();
  let changed = false;
  for (const req of state.requests) {
    if (req.status === 'offen' && req.expiresAt && new Date(req.expiresAt).getTime() < now) {
      req.status = 'abgelaufen';
      state.archive.unshift({ id: req.id, title: req.title, closedAt: nowIso(), closedAtText: 'automatisch abgelaufen (TTL)' });
      changed = true;
    }
  }
  const beforeAlerts = state.alerts.length;
  state.alerts = state.alerts.filter(alert => !alert.validUntil || new Date(alert.validUntil).getTime() > now);
  if (state.alerts.length !== beforeAlerts) changed = true;
  if (changed) {
    state.archive = state.archive.slice(0, 30);
    saveState();
  }
}

async function initLocations() {
  try {
    const response = await fetch(LOCATION_DATA_URL, { cache: 'force-cache' });
    if (!response.ok) throw new Error('Standortdaten konnten nicht geladen werden.');
    locationData = await response.json();
  } catch {
    locationData = FALLBACK_LOCATION_DATA;
  }
}

function cantons() {
  return locationData?.cantons || FALLBACK_LOCATION_DATA.cantons;
}

function firstCanton() {
  return cantons()[0];
}

function municipalitiesForCanton(cantonBfsCode) {
  return cantons().find(canton => String(canton.bfsCode) === String(cantonBfsCode))?.municipalities || [];
}

function findMunicipality(bfsCode) {
  for (const canton of cantons()) {
    const municipality = canton.municipalities.find(item => String(item.bfsCode) === String(bfsCode));
    if (municipality) return { canton, municipality };
  }
  return null;
}

function buildLocation(cantonBfsCode, municipalityBfsCode) {
  const selected = findMunicipality(municipalityBfsCode);
  if (selected && String(selected.canton.bfsCode) === String(cantonBfsCode)) {
    return {
      cantonCode: selected.canton.code,
      cantonName: selected.canton.name,
      cantonBfsCode: selected.canton.bfsCode,
      municipalityBfsCode: selected.municipality.bfsCode,
      municipalityName: selected.municipality.name
    };
  }
  const canton = cantons().find(item => String(item.bfsCode) === String(cantonBfsCode)) || firstCanton();
  const municipality = canton?.municipalities?.[0];
  if (!canton || !municipality) return null;
  return {
    cantonCode: canton.code,
    cantonName: canton.name,
    cantonBfsCode: canton.bfsCode,
    municipalityBfsCode: municipality.bfsCode,
    municipalityName: municipality.name
  };
}

function locationFromAreaLabel(areaLabel = '') {
  const target = String(areaLabel || '').trim().toLowerCase();
  if (!target) return null;
  for (const canton of cantons()) {
    for (const municipality of canton.municipalities || []) {
      const label = `${municipality.name} (${canton.code})`.toLowerCase();
      if (label === target || municipality.name.toLowerCase() === target) {
        return buildLocation(canton.bfsCode, municipality.bfsCode);
      }
    }
  }
  return null;
}

function locationLabel(location = state.profile.location) {
  if (!location) return state.profile.area || 'Kein Standort gesetzt';
  return `${location.municipalityName} (${location.cantonCode})`;
}

function parseDistanceFilterKm(value = state.filter.distanceKm) {
  if (!value || value === 'Alle') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeGeoCoordinates(geoLike) {
  if (!geoLike) return null;
  const lat = Number(geoLike.lat);
  const lng = Number(geoLike.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const accuracyM = Number(geoLike.accuracyM || 0);
  return {
    lat: Number(lat.toFixed(5)),
    lng: Number(lng.toFixed(5)),
    accuracyM: Number.isFinite(accuracyM) ? Math.max(0, Math.round(accuracyM)) : 0,
    capturedAt: normalizeStoredDate(geoLike.capturedAt) || nowIso()
  };
}

function storeViewerGeo(geo) {
  const normalized = normalizeGeoCoordinates(geo);
  if (!normalized) return null;
  viewerGeo = normalized;
  localStorage.setItem(VIEWER_GEO_KEY, JSON.stringify(normalized));
  return normalized;
}

function viewerGeoIsFresh(geo = viewerGeo) {
  if (!geo?.capturedAt) return false;
  const ageMs = Date.now() - new Date(geo.capturedAt).getTime();
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < (45 * 60 * 1000);
}

async function ensureViewerGeo({ force = false, silent = false } = {}) {
  if (!force && viewerGeoIsFresh()) return viewerGeo;
  if (viewerGeoPromise) return viewerGeoPromise;
  if (!navigator.geolocation) {
    if (!silent) toast('Distanzfilter benötigt Standortfreigabe im Browser.');
    return null;
  }
  viewerGeoPromise = new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const normalized = normalizeGeoCoordinates({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: position.coords.accuracy,
          capturedAt: nowIso()
        });
        resolve(storeViewerGeo(normalized));
      },
      () => {
        if (!silent) toast('Standortzugriff abgelehnt. Distanzfilter bleibt aus.');
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: 7000,
        maximumAge: 300000
      }
    );
  }).finally(() => {
    viewerGeoPromise = null;
  });
  return viewerGeoPromise;
}

function distanceBetweenKm(origin, target) {
  const originGeo = normalizeGeoCoordinates(origin);
  const targetGeo = normalizeGeoCoordinates(target);
  if (!originGeo || !targetGeo) return null;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(targetGeo.lat - originGeo.lat);
  const dLng = toRad(targetGeo.lng - originGeo.lng);
  const lat1 = toRad(originGeo.lat);
  const lat2 = toRad(targetGeo.lat);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((earthRadiusKm * c).toFixed(1));
}

function requestDistanceKm(req) {
  if (!req?.geo || !viewerGeo) return null;
  return distanceBetweenKm(viewerGeo, req.geo);
}

function requestRadiusKm(req) {
  const value = Number(req?.radiusKm);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(1, Math.round(value));
}

function requestIsReachable(req, selectedDistanceKm = parseDistanceFilterKm()) {
  const distance = requestDistanceKm(req);
  const requestRadius = requestRadiusKm(req);
  if (requestRadius > 0 && distance !== null && distance > requestRadius) return false;
  if (!selectedDistanceKm) return true;
  if (distance === null) return false;
  return distance <= selectedDistanceKm;
}

function locationOptions(location = null) {
  const selectedCanton = location?.cantonBfsCode || firstCanton()?.bfsCode || '';
  const selectedMunicipality = location?.municipalityBfsCode || municipalitiesForCanton(selectedCanton)[0]?.bfsCode || '';
  return {
    cantonSelect: `<select name="cantonBfsCode" id="locationCanton" required>${cantons().map(canton => `<option value="${escapeHtml(canton.bfsCode)}" ${String(canton.bfsCode) === String(selectedCanton) ? 'selected' : ''}>${escapeHtml(canton.name)} (${escapeHtml(canton.code)})</option>`).join('')}</select>`,
    municipalitySelect: `<select name="municipalityBfsCode" id="locationMunicipality" required>${municipalitiesForCanton(selectedCanton).map(municipality => `<option value="${escapeHtml(municipality.bfsCode)}" ${String(municipality.bfsCode) === String(selectedMunicipality) ? 'selected' : ''}>${escapeHtml(municipality.name)}</option>`).join('')}</select>`
  };
}

function allMunicipalityOptions(selected = state.profile.area) {
  return cantons().flatMap(canton => canton.municipalities.map(municipality => {
    const label = `${municipality.name} (${canton.code})`;
    return `<option value="${escapeHtml(label)}" ${label === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`;
  })).join('');
}

function bindLocationPicker(root = document) {
  const cantonSelect = root.querySelector('#locationCanton');
  const municipalitySelect = root.querySelector('#locationMunicipality');
  if (!cantonSelect || !municipalitySelect) return;
  cantonSelect.addEventListener('change', () => {
    municipalitySelect.innerHTML = municipalitiesForCanton(cantonSelect.value)
      .map(municipality => `<option value="${escapeHtml(municipality.bfsCode)}">${escapeHtml(municipality.name)}</option>`)
      .join('');
  });
}

function profileName(user = authState.user) {
  return user?.displayName || state.profile.name || 'Quartinaut-Nutzer/in';
}

function verifiedMark(verified = state.profile.verified) {
  return verified ? '<span class="verified-mark" title="Verifiziert" aria-label="Verifiziert">✓</span>' : '';
}

function syncCurrentUser(updates) {
  if (!authState.user) return;
  authState.user = { ...authState.user, ...updates };
  if (authState.mode === 'local') {
    saveLocalSession(authState.user);
    const users = loadLocalUsers();
    if (authState.user.email && users[authState.user.email]) {
      users[authState.user.email] = { ...users[authState.user.email], ...updates };
      saveLocalUsers(users);
    }
  }
}

function loadLocalSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY));
  } catch {
    return null;
  }
}

function saveLocalSession(user) {
  if (!user) {
    localStorage.removeItem(AUTH_SESSION_KEY);
    return;
  }
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
}

function loadLocalUsers() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_USERS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveLocalUsers(users) {
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

async function sha256(value) {
  const input = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', input);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function initialsFromName(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map(part => part[0]).join('').toUpperCase();
  return initials || 'ICH';
}

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function inviteRole(inviteCode = '') {
  return 'resident';
}

function isPrimaryAdminEmail(email = '') {
  return PRIMARY_ADMIN_EMAILS.has(normalizeEmail(email));
}

function roleFromAuthClaims(claims = {}) {
  if (claims.admin === true || claims.role === 'admin') return 'admin';
  if (claims.role === 'area_admin') return 'area_admin';
  return '';
}

function roleLabel(role = state.profile.role) {
  if (role === 'admin') return 'Admin';
  if (role === 'area_admin') return 'Gemeindeadmin';
  return 'Bewohner/in';
}

function normalizeAccountType(type = 'resident') {
  return ['resident', 'company', 'municipality'].includes(type) ? type : 'resident';
}

function accountTypeLabel(type = state.profile.accountType) {
  if (type === 'company') return 'Firma';
  if (type === 'municipality') return 'Gemeinde';
  return 'Privatperson';
}

function accountStatusLabel(status = state.profile.accountStatus) {
  if (status === 'deleted') return 'Gelöscht';
  if (status === 'disabled') return 'Deaktiviert';
  if (status === 'limited') return 'Eingeschränkt';
  if (status === 'pending_verification') return 'Wartet auf Freigabe';
  return 'Aktiv';
}

function accountStatusBadge(status = 'active') {
  const cls = status === 'deleted'
    ? 'danger'
    : status === 'disabled' || status === 'pending_verification'
      ? 'warn'
      : status === 'limited'
        ? 'info'
        : 'done';
  return `<span class="badge ${cls}">${escapeHtml(accountStatusLabel(status))}</span>`;
}

function isAccountDisabled(user = authState.user) {
  return (user?.accountStatus || state.profile.accountStatus || 'active') === 'disabled';
}

function isAccountPendingApproval(user = authState.user) {
  return (user?.accountStatus || state.profile.accountStatus || 'active') === 'pending_verification';
}

function isArchivedUser(user = {}) {
  return (user.accountStatus || 'active') === 'disabled'
    || (user.accountStatus || '') === 'deleted'
    || (user.verificationStatus || '') === 'deleted'
    || Boolean(user.deletedAt);
}

const TITLE_PRESET_LABELS = {
  auto: 'Automatisch',
  admin: 'Admin',
  resident: 'Bewohner/in',
  verified: 'Verifiziert',
  registry: 'Gemeinderegister',
  district: 'Quartierverein',
  municipality: 'Gemeinde',
  none: 'Kein Titel'
};

function normalizeTitleGrants(value) {
  return Array.isArray(value)
    ? value.filter(item => ['verified', 'registry', 'district'].includes(item))
    : [];
}

function titlePresetLabel(preset = 'auto') {
  return TITLE_PRESET_LABELS[preset] || TITLE_PRESET_LABELS.auto;
}

function allowedTitlePresets(profile = state.profile) {
  const allowed = new Set(['auto', 'resident', 'none']);
  if (['admin', 'area_admin'].includes(profile.role)) allowed.add('admin');
  if (profile.accountType === 'municipality' && profile.verified) allowed.add('municipality');
  if (profile.verified) allowed.add('verified');
  normalizeTitleGrants(profile.titleGrants).forEach(grant => allowed.add(grant));
  return [...allowed];
}

function normalizeTitlePresetForProfile(preset = 'auto', profile = state.profile) {
  return allowedTitlePresets(profile).includes(preset) ? preset : 'auto';
}

function titlePresetOptions(profile = state.profile) {
  const selected = normalizeTitlePresetForProfile(profile.titlePreset || 'auto', profile);
  return allowedTitlePresets(profile)
    .map(value => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(titlePresetLabel(value))}</option>`)
    .join('');
}

function verificationTitleOptions(selected = 'verified') {
  return ['verified', 'resident', 'registry', 'district']
    .map(value => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(titlePresetLabel(value))}</option>`)
    .join('');
}

function profileTitle(profile = state.profile) {
  if (profile.titleVisible === false) return '';
  const preset = normalizeTitlePresetForProfile(profile.titlePreset || 'auto', profile);
  if (preset === 'none') return '';
  if (preset === 'admin') return 'Admin';
  if (preset === 'resident') return 'Bewohner/in';
  if (preset === 'registry') return 'Gemeinderegister';
  if (preset === 'district') return 'Quartierverein';
  if (preset === 'municipality') return 'Gemeinde';
  if (preset === 'verified') return profile.verificationLabel || 'Verifiziert';
  if (profile.role === 'admin') return 'Admin';
  if (profile.role === 'area_admin') return 'Gemeindeadmin';
  if (profile.verified) return profile.verificationLabel || 'Verifiziert';
  return 'Bewohner/in';
}

function trustLevelMeta(profile = state.profile) {
  const role = profile.role || 'resident';
  if (role === 'admin') return { key: 'admin', label: 'Admin', detail: 'Plattform-Administration', cls: 'official' };
  if (role === 'area_admin') return { key: 'area_admin', label: 'Gemeindeadmin', detail: profile.adminScopeArea || 'Gebietsverwaltung', cls: 'official' };
  if (profile.accountType === 'municipality') {
    if (profile.municipalityStatus === 'verified') return { key: 'municipality_verified', label: 'Gemeinde geprüft', detail: profile.municipalityName || profile.area || 'bestätigte Gemeinde', cls: 'official' };
    if (profile.municipalityStatus === 'rejected') return { key: 'municipality_rejected', label: 'Gemeinde abgelehnt', detail: 'Freigabe wurde abgelehnt', cls: 'warn' };
    return { key: 'municipality_pending', label: 'Gemeinde in Prüfung', detail: 'Freigabe durch Plattform-Admin ausstehend', cls: 'info' };
  }
  if (profile.accountType === 'company') {
    if (profile.companyStatus === 'verified') return { key: 'company_verified', label: 'Firma geprüft', detail: profile.companyName || 'bestätigte Firma', cls: 'official' };
    if (profile.companyStatus === 'rejected') return { key: 'company_rejected', label: 'Firma abgelehnt', detail: profile.companyName || 'nicht freigegeben', cls: 'warn' };
    return { key: 'company_pending', label: 'Firma ungeprüft', detail: profile.companyName || 'Prüfung offen', cls: 'info' };
  }
  if (profile.verified) return { key: 'verified', label: profile.verificationLabel || 'Verifiziert', detail: 'Identität bestätigt', cls: 'official' };
  if (profile.verificationStatus === 'pending') return { key: 'pending', label: 'Verifizierung offen', detail: 'Antrag eingereicht', cls: 'info' };
  return { key: 'unverified', label: 'Unverifiziert', detail: 'Nur registriert', cls: '' };
}

function trustBadge(profile = state.profile, options = {}) {
  const meta = trustLevelMeta(profile);
  const detail = options.detail && meta.detail ? ` title="${escapeHtml(meta.detail)}"` : '';
  return `<span class="badge ${meta.cls}"${detail}>${escapeHtml(meta.label)}</span>`;
}

function profileFromRequest(req = {}) {
  const user = state.registeredUsers.find(item => item.uid === (req.uid || req.authorId));
  if (user) return user;
  return {
    role: req.authorRole || 'resident',
    verified: Boolean(req.authorVerified),
    verificationStatus: req.authorVerificationStatus || '',
    verificationLabel: req.authorVerificationLabel || '',
    accountType: req.authorAccountType || 'resident',
    companyName: req.companyName || '',
    companyStatus: req.companyStatus || 'none',
    municipalityStatus: req.municipalityStatus || 'none',
    municipalityName: req.municipalityName || ''
  };
}

function companyNameForProfile(profile = state.profile) {
  return String(profile.companyName || '').trim();
}

function applyAuthenticatedUser(user) {
  if (!user) return;
  const location = user.location || null;
  const role = user.role || 'resident';
  const verified = Boolean(user.verified);
  const verificationLabel = user.verificationLabel || (verified ? 'Verifiziert' : '');
  const titlePreset = user.titlePreset || 'auto';
  state.profile = {
    ...structuredClone(seed.profile),
    name: user.displayName || '',
    initials: user.initials || initialsFromName(user.displayName || user.email),
    area: location ? locationLabel(location) : (user.area || ''),
    location,
    role,
    accountType: normalizeAccountType(user.accountType || 'resident'),
    accountStatus: user.accountStatus || 'active',
    companyName: user.companyName || '',
    companyPurpose: user.companyPurpose || '',
    companyStatus: user.companyStatus || 'none',
    municipalityName: user.municipalityName || '',
    municipalityDepartment: user.municipalityDepartment || '',
    municipalityWebsite: user.municipalityWebsite || '',
    municipalityStatus: user.municipalityStatus || 'none',
    adminScopeArea: user.adminScopeArea || '',
    verified,
    verificationStatus: user.verificationStatus || 'none',
    verificationLabel,
    titleVisible: user.titleVisible ?? true,
    titlePreset: normalizeTitlePresetForProfile(titlePreset, { ...user, verified, role, titleGrants: user.titleGrants }),
    titleGrants: normalizeTitleGrants(user.titleGrants),
    notifications: Boolean(user.notifications),
    passkeyReady: Boolean(user.passkeyReady)
  };
  if (user.dashboard) {
    state.dashboard = { ...state.dashboard, ...sanitizeDashboardLayout(user.dashboard) };
    delete state.dashboard.editing;
  }
  state.onboarding = normalizeOnboardingState(user.onboarding || state.onboarding);
  if (user.locale) setLocale(user.locale);
  saveState();
}

function isFirebaseMode() {
  return authState.mode === 'firebase' && Boolean(firebaseAuthApi && firebaseStoreApi && firebaseAppInstance);
}

async function authClaims(firebaseUser, forceRefresh = false) {
  if (!firebaseUser?.getIdTokenResult) return {};
  try {
    const token = await firebaseUser.getIdTokenResult(forceRefresh);
    return token?.claims || {};
  } catch {
    return {};
  }
}

async function ensureServerAdminClaim(firebaseUser, profileDoc = {}, claims = {}) {
  // Nie aufgrund E-Mail-Adresse oder Profilfeld Rollen zuweisen.
  // Fehlende Claims müssen von einem berechtigten Administrator gesetzt werden.
  return claims;
}

function parseJsonStorage(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function savePendingGoogleRegistration(data) {
  localStorage.setItem(PENDING_GOOGLE_REG_KEY, JSON.stringify({ ...data, createdAt: nowIso() }));
}

function loadPendingGoogleRegistration() {
  const payload = parseJsonStorage(PENDING_GOOGLE_REG_KEY, null);
  if (!payload?.createdAt) return null;
  const ageMs = Date.now() - new Date(payload.createdAt).getTime();
  if (ageMs > 12 * 3600000) {
    localStorage.removeItem(PENDING_GOOGLE_REG_KEY);
    return null;
  }
  return payload;
}

function clearPendingGoogleRegistration() {
  localStorage.removeItem(PENDING_GOOGLE_REG_KEY);
}

function validateInviteCode(inputCode = '') {
  const code = String(inputCode || '').trim().toUpperCase();
  if (!code) return '';
  if (code !== DEFAULT_INVITE_CODE && !ADMIN_INVITE_CODES.has(code)) {
    throw new Error('Ungültiger Einladungscode. Bitte die Quartinaut-Verwaltung kontaktieren.');
  }
  return code;
}

function normalizeStoredDate(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  return String(value);
}

function sanitizeLocation(locationLike) {
  if (!locationLike) return null;
  if (locationLike.municipalityBfsCode && locationLike.cantonBfsCode) {
    return buildLocation(locationLike.cantonBfsCode, locationLike.municipalityBfsCode);
  }
  return null;
}

function makeAuthUser(firebaseUser, profileDoc = {}, claims = {}) {
  const location = sanitizeLocation(profileDoc.location) || null;
  const displayName = profileDoc.displayName || firebaseUser.displayName || firebaseUser.email || 'Quartinaut-Nutzer/in';
  const verified = Boolean(profileDoc.verified);
  const claimRole = roleFromAuthClaims(claims);
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName,
    initials: profileDoc.initials || initialsFromName(displayName),
    area: location ? locationLabel(location) : (profileDoc.area || ''),
    location,
    role: claimRole || 'resident',
    accountType: normalizeAccountType(profileDoc.accountType || 'resident'),
    accountStatus: profileDoc.accountStatus || 'active',
    companyName: profileDoc.companyName || '',
    companyPurpose: profileDoc.companyPurpose || '',
    companyStatus: profileDoc.companyStatus || 'none',
    municipalityName: profileDoc.municipalityName || '',
    municipalityDepartment: profileDoc.municipalityDepartment || '',
    municipalityWebsite: profileDoc.municipalityWebsite || '',
    municipalityStatus: profileDoc.municipalityStatus || 'none',
    adminScopeArea: claims.adminScopeArea || profileDoc.adminScopeArea || '',
    verified,
    verificationStatus: profileDoc.verificationStatus || 'none',
    verificationLabel: profileDoc.verificationLabel || (verified ? 'Verifiziert' : ''),
    titleVisible: profileDoc.titleVisible ?? true,
    titlePreset: profileDoc.titlePreset || 'auto',
    titleGrants: normalizeTitleGrants(profileDoc.titleGrants),
    dashboard: sanitizeDashboardLayout(profileDoc.dashboard || {}),
    onboarding: normalizeOnboardingState(profileDoc.onboarding),
    locale: profileDoc.locale || currentLocale(),
    notifications: Boolean(profileDoc.notifications),
    passkeyReady: Boolean(profileDoc.passkeyReady)
  };
}

async function upsertFirebaseUserDoc(firebaseUser) {
  const { db, doc, getDoc, setDoc } = firebaseStoreApi;
  const userRef = doc(db, FIRESTORE_COLLECTIONS.users, firebaseUser.uid);
  const snapshot = await getDoc(userRef);
  const existing = snapshot.exists() ? snapshot.data() : null;
  const pendingRaw = loadPendingGoogleRegistration();
  const passwordOnly = firebaseUser.providerData?.some(item=>item.providerId==='password') &&
    !firebaseUser.providerData?.some(item=>item.providerId==='google.com');
  // Never reuse another user's locally stored registration when a password account signs in.
  const pending = passwordOnly
    ? (pendingRaw?.provider === 'password' && normalizeEmail(pendingRaw.email) === normalizeEmail(firebaseUser.email) ? pendingRaw : null)
    : (pendingRaw?.provider === 'password' ? null : pendingRaw);

  if (!existing) {
    const registration = pending?.location && pending?.displayName
      ? {
        displayName: pending.displayName,
        inviteCode: pending.inviteCode,
        location: sanitizeLocation(pending.location),
        accountType: normalizeAccountType(pending.accountType),
        companyName: String(pending.companyName || '').trim(),
        companyPurpose: String(pending.companyPurpose || '').trim(),
        municipalityDepartment: String(pending.municipalityDepartment || '').trim(),
        municipalityWebsite: String(pending.municipalityWebsite || '').trim()
      }
      : null; // Niemals Profil-/Standortdaten einer alten Sitzung als Registrierung nutzen.
    if (!registration?.location || !registration?.displayName) {
      clearPendingGoogleRegistration();
      throw new Error(passwordOnly
        ? 'Dieses E-Mail-Konto ist noch nicht registriert. Bitte erst dein Profil vervollständigen.'
        : 'Dieses Google-Konto ist noch nicht registriert. Bitte zuerst "Konto erstellen" nutzen.');
    }
    const inviteCode = validateInviteCode(registration.inviteCode);
    const location = sanitizeLocation(registration.location);
    if (!location) throw new Error('Registrierung benötigt eine gültige Standortauswahl.');
    const area = locationLabel(location);
    const accountType = normalizeAccountType(registration.accountType);
    const isMunicipality = accountType === 'municipality';
    const profileDoc = {
      uid: firebaseUser.uid,
      email: normalizeEmail(firebaseUser.email || ''),
      displayName: registration.displayName,
      initials: initialsFromName(registration.displayName),
      area,
      areaKey: normalizeAreaKey(area),
      cantonCode: cantonCodeForLocation(location),
      location,
      role: isMunicipality ? 'resident' : inviteRole(inviteCode),
      accountType,
      accountStatus: isMunicipality ? 'pending_verification' : 'active',
      companyName: accountType === 'company' ? registration.companyName : '',
      companyPurpose: accountType === 'company' ? registration.companyPurpose : '',
      companyStatus: accountType === 'company' ? 'pending' : 'none',
      municipalityName: isMunicipality ? location.municipalityName : '',
      municipalityDepartment: isMunicipality ? registration.municipalityDepartment : '',
      municipalityWebsite: isMunicipality ? registration.municipalityWebsite : '',
      municipalityStatus: isMunicipality ? 'pending' : 'none',
      adminScopeArea: '',
      verified: false,
      verificationStatus: isMunicipality ? 'pending' : 'none',
      verificationLabel: '',
      titleVisible: true,
      titlePreset: 'auto',
      titleGrants: [],
      dashboard: dashboardLayoutPayload(),
      onboarding: normalizeOnboardingState(),
      locale: currentLocale(),
      notifications: false,
      passkeyReady: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastLoginAt: nowIso()
    };
    await setDoc(userRef, profileDoc, { merge: false });
    if (!isMunicipality) {
      await setDoc(doc(db, FIRESTORE_COLLECTIONS.notificationPreferences, firebaseUser.uid), {
        uid: firebaseUser.uid,
        tenantId: 'quartinaut',
        enabled: false,
        area,
        areaKey: normalizeAreaKey(area),
        cantonCode: cantonCodeForLocation(location),
        criticalAlerts: true,
        alerts: { enabled: true, severities: ['warn', 'info'] },
        officialNotices: { enabled: true, priorities: ['wichtig'], categories: [] },
        bulletin: { enabled: false, types: [], categories: [] },
        chats: { enabled: true },
        keywordRules: [],
        quietHours: { enabled: false, start: '22:00', end: '07:00', timezone: 'Europe/Zurich' },
        createdAt: nowIso(),
        updatedAt: nowIso()
      }, { merge: false });
    }
    if (firebaseUser.displayName !== registration.displayName) {
      await firebaseAuthApi.updateProfile(firebaseUser, { displayName: registration.displayName });
    }
    clearPendingGoogleRegistration();
    return profileDoc;
  }

  const mergedLocation = sanitizeLocation(existing.location) || sanitizeLocation(pending?.location) || fallbackLocation || null;
  const displayName = existing.displayName || firebaseUser.displayName || pending?.displayName || state.profile.name || 'Quartinaut-Nutzer/in';
  const verified = Boolean(existing.verified);
  const area = mergedLocation ? locationLabel(mergedLocation) : (existing.area || '');
  const profileDoc = {
    ...existing,
    uid: firebaseUser.uid,
    email: normalizeEmail(firebaseUser.email || existing.email || ''),
    displayName,
    initials: existing.initials || initialsFromName(displayName),
    area,
    areaKey: normalizeAreaKey(area),
    cantonCode: cantonCodeForLocation(mergedLocation || existing),
    location: mergedLocation,
    role: existing.role || inviteRole(pending?.inviteCode || ''),
    accountType: normalizeAccountType(existing.accountType || 'resident'),
    accountStatus: existing.accountStatus || 'active',
    companyName: existing.companyName || '',
    companyPurpose: existing.companyPurpose || '',
    companyStatus: existing.companyStatus || (existing.accountType === 'company' ? 'pending' : 'none'),
    municipalityName: existing.municipalityName || (existing.accountType === 'municipality' ? mergedLocation?.municipalityName || '' : ''),
    municipalityDepartment: existing.municipalityDepartment || '',
    municipalityWebsite: existing.municipalityWebsite || '',
    municipalityStatus: existing.municipalityStatus || (existing.accountType === 'municipality' ? 'pending' : 'none'),
    adminScopeArea: existing.adminScopeArea || '',
    verified,
    verificationStatus: existing.verificationStatus || 'none',
    verificationLabel: existing.verificationLabel || (verified ? 'Verifiziert' : ''),
    titleVisible: existing.titleVisible ?? true,
    titlePreset: existing.titlePreset || 'auto',
    titleGrants: normalizeTitleGrants(existing.titleGrants),
    dashboard: sanitizeDashboardLayout(existing.dashboard || {}),
    onboarding: normalizeOnboardingState(existing.onboarding),
    locale: existing.locale || currentLocale(),
    notifications: Boolean(existing.notifications),
    passkeyReady: Boolean(existing.passkeyReady),
    createdAt: normalizeStoredDate(existing.createdAt) || nowIso(),
    updatedAt: nowIso(),
    lastLoginAt: nowIso()
  };
  // Existing profiles can be read even when policies disallow overwriting them.
  // Refreshing the optional last-login metadata must not block authentication.
  void setDoc(userRef, { lastLoginAt: nowIso() }, { merge: true }).catch(error =>
    reportBackgroundError('Bestehendes Profil aktualisieren', error, { notify: false, collection: FIRESTORE_COLLECTIONS.users })
  );
  if (pending?.displayName && firebaseUser.displayName !== pending.displayName) {
    await firebaseAuthApi.updateProfile(firebaseUser, { displayName: pending.displayName }).catch(error => reportBackgroundError('Google-Profilnamen synchronisieren', error));
  }
  clearPendingGoogleRegistration();
  return profileDoc;
}

function mapFirestoreDocs(snapshot) {
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}

function mergeById(items = []) {
  return [...items.reduce((map, item) => {
    if (item?.id) map.set(item.id, { ...(map.get(item.id) || {}), ...item });
    return map;
  }, new Map()).values()];
}

function sortByCreatedDesc(items) {
  return items.slice().sort((a, b) => new Date(normalizeStoredDate(b.createdAt) || 0) - new Date(normalizeStoredDate(a.createdAt) || 0));
}

function isAdminRole() {
  return ['admin', 'area_admin'].includes(authState.user?.role || '');
}

function currentAreaKey() {
  return normalizeAreaKey(state.profile.area || authState.user?.area || '');
}

function currentCantonCode() {
  return cantonCodeForLocation(state.profile.location || authState.user?.location || { area: state.profile.area || authState.user?.area || '' });
}

async function readCollection(collectionName, options = {}) {
  const { db, collection, getDocs, query, orderBy, where, limit } = firebaseStoreApi;
  const { ownUid = '', participantUid = '', ownerUid = '', areaKey = '', cantonCode = '', status = '', orderField = 'createdAt' } = options;
  const maxResults = Math.min(350, Math.max(1, Number(options.maxResults) || MAX_COLLECTION_RESULTS));
  const col = collection(db, collectionName);
  const constraints = [];
  if (ownUid) constraints.push(where('uid', '==', ownUid));
  if (participantUid) constraints.push(where('participants', 'array-contains', participantUid));
  if (ownerUid) constraints.push(where('requestOwnerUid', '==', ownerUid));
  if (status) constraints.push(where('status', '==', status));
  if (cantonCode) constraints.push(where('cantonCode', '==', cantonCode));
  else if (areaKey) constraints.push(where('areaKey', '==', areaKey));
  try {
    return mapFirestoreDocs(await getDocs(query(col, ...constraints, orderBy(orderField, 'desc'), limit(maxResults))));
  } catch (error) {
    const code = String(error?.code || '');
    if (code.includes('permission-denied')) {
      console.warn('[Quartinaut] Firestore-Zugriff verweigert:', collectionName);
      return [];
    }
    // Ein fehlender Composite-Index darf nie zu einer unbeschränkten Collection-Lesung führen.
    if (!code.includes('failed-precondition') || !constraints.length) throw error;
    console.warn('[Quartinaut] Sortierindex fehlt; eng begrenzter Fallback:', collectionName);
    return sortByCreatedDesc(mapFirestoreDocs(await getDocs(query(col, ...constraints, limit(maxResults)))));
  }
}

async function readFirebaseDoc(collectionName, id) {
  if (!isFirebaseMode() || !id) return null;
  const { db, doc, getDoc } = firebaseStoreApi;
  const snapshot = await getDoc(doc(db, collectionName, id));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

function normalizeRequestDoc(req) {
  return {
    ...req,
    createdAt: normalizeStoredDate(req.createdAt) || nowIso(),
    submittedAt: normalizeStoredDate(req.submittedAt) || '',
    approvedAt: normalizeStoredDate(req.approvedAt) || '',
    rejectedAt: normalizeStoredDate(req.rejectedAt) || '',
    resubmittedAt: normalizeStoredDate(req.resubmittedAt) || '',
    expiresAt: normalizeStoredDate(req.expiresAt) || '',
    replies: Array.isArray(req.replies) ? req.replies.map((reply) => ({ ...reply, at: normalizeStoredDate(reply.at) || nowIso() })) : [],
    reports: Number(req.reports || 0),
    status: req.status || 'offen',
    rejectionReason: req.rejectionReason || '',
    escalationLevel: req.escalationLevel || 'keine',
    recurringMode: req.recurringMode || 'einmalig',
    recurringParentId: req.recurringParentId || '',
    anonymousOffer: Boolean(req.anonymousOffer),
    radiusKm: requestRadiusKm(req) || DEFAULT_REQUEST_RADIUS_KM,
    geo: normalizeGeoCoordinates(req.geo)
  };
}

function normalizeSimpleCreated(item) {
  return { ...item, createdAt: normalizeStoredDate(item.createdAt) || nowIso() };
}

function normalizeAlertDoc(item) {
  const normalized = normalizeSimpleCreated(item);
  return {
    ...normalized,
    areaKey: normalized.areaKey || normalizeAreaKey(normalized.area || ''),
    cantonCode: normalized.cantonCode || cantonCodeForLocation({ area: normalized.area || '' }),
    scopeLevel: normalized.scopeLevel === 'canton' ? 'canton' : 'municipality',
    validUntil: normalizeStoredDate(normalized.validUntil) || ''
  };
}

function normalizeOfficialNoticeDoc(item) {
  const normalized = normalizeSimpleCreated(item);
  return {
    ...normalized,
    title: String(normalized.title || ''),
    text: String(normalized.text || ''),
    category: String(normalized.category || 'Allgemein'),
    priority: ['info', 'wichtig'].includes(normalized.priority) ? normalized.priority : 'info',
    status: ['entwurf', 'online', 'archiviert'].includes(normalized.status) ? normalized.status : 'online',
    areaKey: normalized.areaKey || normalizeAreaKey(normalized.area || ''),
    cantonCode: normalized.cantonCode || cantonCodeForLocation({ area: normalized.area || '' }),
    scopeLevel: normalized.scopeLevel === 'canton' ? 'canton' : 'municipality',
    validFrom: normalizeStoredDate(normalized.validFrom) || '',
    validUntil: normalizeStoredDate(normalized.validUntil) || ''
  };
}

function normalizeChatDoc(chat) {
  return {
    ...chat,
    participants: Array.isArray(chat.participants) ? chat.participants : [],
    participantLabels: chat.participantLabels || {},
    mutedBy: Array.isArray(chat.mutedBy) ? chat.mutedBy : [],
    readBy: chat.readBy && typeof chat.readBy === 'object' ? chat.readBy : {},
    trashedBy: chat.trashedBy && typeof chat.trashedBy === 'object' ? chat.trashedBy : {},
    purgedBy: chat.purgedBy && typeof chat.purgedBy === 'object' ? chat.purgedBy : {},
    createdAt: normalizeStoredDate(chat.createdAt) || nowIso(),
    lastMessageAt: normalizeStoredDate(chat.lastMessageAt) || normalizeStoredDate(chat.createdAt) || nowIso()
  };
}

function normalizeChatMessage(msg) {
  return {
    ...msg,
    participants: Array.isArray(msg.participants) ? msg.participants : [],
    participantLabels: msg.participantLabels || {},
    createdAt: normalizeStoredDate(msg.createdAt) || nowIso(),
    readAt: normalizeStoredDate(msg.readAt) || '',
    deliveryStatus: ['pending', 'sent', 'failed'].includes(msg.deliveryStatus) ? msg.deliveryStatus : 'sent'
  };
}

async function syncStateFromFirestore() {
  if (!isFirebaseMode() || !authState.user) return;
  if (isAccountPendingApproval()) return;
  const expectedUid = authState.user.uid;
  const expectedEpoch = accountEpoch;
  const admin = isAdminRole();
  const scope = admin ? {} : { cantonCode: currentCantonCode(), areaKey: currentAreaKey() };
  const hasContentScope = admin || Boolean(scope.cantonCode || scope.areaKey);
  const [
    requests,
    ownRequests,
    alerts,
    officialNotices,
    moderation,
    inviteCodes,
    locationChangeRequests,
    verificationRequests,
    changeRequests,
    alertReads,
    deviceTokens,
    areaCategoryPriority,
    bulletinFilters,
    notificationPreferences,
    pushDeliveries,
    registeredUsers,
    publicStatsDoc,
    auditLog,
    chats
  ] = await Promise.all([
    hasContentScope ? readCollection(FIRESTORE_COLLECTIONS.requests, admin ? scope : { ...scope, status: 'offen' }) : Promise.resolve([]),
    admin ? Promise.resolve([]) : readCollection(FIRESTORE_COLLECTIONS.requests, { ownUid: expectedUid }),
    readCollection(FIRESTORE_COLLECTIONS.alerts),
    hasContentScope ? readCollection(FIRESTORE_COLLECTIONS.officialNotices, admin ? {} : { ...scope, status: 'online' }) : Promise.resolve([]),
    admin ? readCollection(FIRESTORE_COLLECTIONS.moderation) : Promise.resolve([]),
    admin ? readCollection(FIRESTORE_COLLECTIONS.inviteCodes) : Promise.resolve([]),
    readCollection(FIRESTORE_COLLECTIONS.locationChangeRequests, admin ? {} : { ownUid: expectedUid }),
    readCollection(FIRESTORE_COLLECTIONS.verificationRequests, admin ? {} : { ownUid: expectedUid }),
    readCollection(FIRESTORE_COLLECTIONS.changeRequests, admin ? {} : { ownUid: expectedUid }),
    readCollection(FIRESTORE_COLLECTIONS.alertReads, admin ? {} : { ownUid: expectedUid }),
    readCollection(FIRESTORE_COLLECTIONS.deviceTokens, admin ? {} : { ownUid: expectedUid }),
    readCollection(FIRESTORE_COLLECTIONS.areaCategoryPriority, { orderField: 'updatedAt' }),
    readCollection(FIRESTORE_COLLECTIONS.bulletinFilters, { ownUid: expectedUid, orderField: 'updatedAt' }),
    readFirebaseDoc(FIRESTORE_COLLECTIONS.notificationPreferences, expectedUid),
    admin ? readCollection(FIRESTORE_COLLECTIONS.pushDeliveries, { orderField: 'attemptedAt' }) : Promise.resolve([]),
    admin ? readCollection(FIRESTORE_COLLECTIONS.users, { orderField: 'updatedAt' }) : Promise.resolve([]),
    readPublicCantonStatsDoc(),
    admin ? readCollection(FIRESTORE_COLLECTIONS.auditLog, { orderField: 'createdAt' }) : Promise.resolve([]),
    readCollection(FIRESTORE_COLLECTIONS.chats, { participantUid: expectedUid, orderField: 'lastMessageAt' })
  ]);

  if (!currentAccountEpoch(expectedUid, expectedEpoch)) return;
  state.requests = mergeById([...requests, ...ownRequests]).map(normalizeRequestDoc);
  state.alerts = alerts.map(normalizeAlertDoc);
  state.officialNotices = officialNotices.map(normalizeOfficialNoticeDoc);
  state.moderation = moderation.map(normalizeSimpleCreated);
  state.inviteCodes = inviteCodes.map(normalizeSimpleCreated);
  state.locationChangeRequests = locationChangeRequests.map(item => ({
    ...normalizeSimpleCreated(item),
    currentLocation: sanitizeLocation(item.currentLocation),
    targetLocation: sanitizeLocation(item.targetLocation),
    decidedAt: normalizeStoredDate(item.decidedAt) || ''
  }));
  state.verificationRequests = verificationRequests.map(item => ({
    ...normalizeSimpleCreated(item),
    decidedAt: normalizeStoredDate(item.decidedAt) || ''
  }));
  state.changeRequests = changeRequests.map(item => ({
    ...normalizeSimpleCreated(item),
    decidedAt: normalizeStoredDate(item.decidedAt) || ''
  }));
  state.alertReads = alertReads.map(item => ({
    ...normalizeSimpleCreated(item),
    readAt: normalizeStoredDate(item.readAt) || normalizeStoredDate(item.createdAt) || nowIso()
  }));
  state.deviceTokens = deviceTokens.map(item => ({
    ...normalizeSimpleCreated(item),
    updatedAt: normalizeStoredDate(item.updatedAt) || nowIso()
  }));
  state.areaCategoryPriority = areaCategoryPriority.map(item => ({
    ...item,
    updatedAt: normalizeStoredDate(item.updatedAt) || nowIso(),
    priority: Array.isArray(item.priority) ? item.priority.filter(cat => CATEGORIES.includes(cat)) : []
  }));
  state.bulletinFilters = bulletinFilters.map(item => ({
    ...normalizeSimpleCreated(item),
    updatedAt: normalizeStoredDate(item.updatedAt) || nowIso(),
    filter: normalizeBulletinFilter(item.filter || item)
  }));
  state.notificationPreferences = normalizeNotificationPreferences(notificationPreferences || {});
  state.pushDeliveries = pushDeliveries.map(item => ({
    ...item,
    attemptedAt: normalizeStoredDate(item.attemptedAt) || nowIso()
  }));
  state.registeredUsers = registeredUsers.map((user) => ({
    ...user,
    location: sanitizeLocation(user.location),
    titleGrants: normalizeTitleGrants(user.titleGrants),
    accountType: normalizeAccountType(user.accountType || 'resident'),
    accountStatus: user.accountStatus || 'active',
    updatedAt: normalizeStoredDate(user.updatedAt) || nowIso()
  }));
  state.auditLog = auditLog.map(normalizeSimpleCreated).slice(0, 80);
  state.chats = mergeById(chats).map(normalizeChatDoc);
  state.publicStats = {
    cantonCounts: sanitizeCantonCounts(publicStatsDoc?.cantonCounts || {}),
    totalUsers: Number(publicStatsDoc?.totalUsers || 0),
    updatedAt: normalizeStoredDate(publicStatsDoc?.updatedAt) || ''
  };
  if (admin && state.registeredUsers.length) {
    if (!currentAccountEpoch(expectedUid, expectedEpoch)) return;
    await publishPublicCantonStats().catch(error => reportBackgroundError('Kantonsstatistik veröffentlichen', error));
  }
  if (!currentAccountEpoch(expectedUid, expectedEpoch)) return;
  await loadCommunityFeatures();
  if (!currentAccountEpoch(expectedUid, expectedEpoch)) return;
  saveState();
}

async function updateFirebaseProfile(updates = {}) {
  if (!isFirebaseMode() || !authState.user) return;
  const { db, doc, setDoc } = firebaseStoreApi;
  const userRef = doc(db, FIRESTORE_COLLECTIONS.users, authState.user.uid);
  const editable = ['titleVisible','titlePreset','locale','notifications','dashboard','onboarding','passkeyReady'];
  const safe = Object.fromEntries(Object.entries(updates).filter(([key]) => editable.includes(key)));
  await setDoc(userRef, { ...safe, updatedAt: nowIso() }, { merge: true });
}

async function setFirebaseDoc(collectionName, id, data, merge = true) {
  const { db, doc, setDoc } = firebaseStoreApi;
  const ref = doc(db, collectionName, id);
  if (merge) {
    await setDoc(ref, data, { merge: true });
    return;
  }
  await setDoc(ref, data);
}

function actionErrorMessage(error, fallback = 'Aktion konnte nicht ausgeführt werden.') {
  const raw = String(error?.message || error?.code || fallback);
  if (raw.includes('messaging/permission-blocked') || raw.includes('permission was not granted and blocked')) {
    return 'Benachrichtigungen sind im Browser blockiert. Bitte in den Website-Einstellungen für quartinaut.web.app auf „Zulassen“ stellen.';
  }
  if (raw.includes('permission-denied') || raw.includes('Missing or insufficient permissions')) {
    if (['admin', 'area_admin'].includes(state.profile.role || '') && !isAdminRole()) {
      return 'Adminrechte sind noch nicht aktiv. Bitte abmelden und erneut mit Google anmelden.';
    }
    return 'Keine Berechtigung zum Speichern. Bitte einmal neu anmelden und erneut versuchen.';
  }
  if (raw.includes('network') || raw.includes('offline') || raw.includes('unavailable')) {
    return 'Speichern ist gerade nicht möglich. Bitte Verbindung prüfen und erneut versuchen.';
  }
  return raw || fallback;
}

function reportBackgroundError(context, error, options = {}) {
  const message = actionErrorMessage(error, options.fallback || `${context} konnte nicht abgeschlossen werden.`);
  const details = {
    context,
    code: error?.code || '',
    message: error?.message || String(error || ''),
    collection: options.collection || '',
    notify: Boolean(options.notify)
  };
  console.warn(`[Quartinaut] ${context}`, details, error);
  if (options.notify) toast(message);
  return null;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Foto konnte nicht gelesen werden.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Foto konnte nicht verarbeitet werden.'));
    image.src = dataUrl;
  });
}

function dataUrlByteSize(dataUrl = '') {
  const base64 = String(dataUrl).split(',')[1] || '';
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

async function loadDrawableImage(dataUrl) {
  if (window.createImageBitmap) {
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      // Fallback für Browser/Formate ohne createImageBitmap-Unterstützung.
    }
  }
  return loadImage(dataUrl);
}

async function prepareVerificationPhoto(file) {
  if (!file) throw new Error('Bitte ein Foto deines Ausweises hochladen.');
  if (!String(file.type || '').startsWith('image/')) throw new Error('Bitte eine Bilddatei hochladen.');
  if (/\.hei[cf]$/i.test(file.name || '') || /hei[cf]/i.test(file.type || '')) {
    throw new Error('HEIC/HEIF kann dieser Browser nicht zuverlässig lesen. Bitte als JPG oder PNG hochladen.');
  }
  const raw = await readFileAsDataUrl(file);
  const image = await loadDrawableImage(raw);
  const targetBytes = 820000;
  const maxSides = [1800, 1600, 1400, 1280, 1120, 1000, 900, 800, 700, 620, 560];
  const qualities = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42];
  let best = null;
  for (const maxSide of maxSides) {
    const scale = Math.min(1, maxSide / Math.max(image.width || maxSide, image.height || maxSide));
    const width = Math.max(1, Math.round((image.width || maxSide) * scale));
    const height = Math.max(1, Math.round((image.height || maxSide) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    for (const quality of qualities) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const bytes = dataUrlByteSize(dataUrl);
      const candidate = { dataUrl, bytes, width, height, quality };
      if (!best || candidate.bytes < best.bytes) best = candidate;
      if (bytes <= targetBytes) {
        return {
          dataUrl,
          name: `${(file.name || 'ausweisfoto').replace(/\.[^.]+$/, '')}.jpg`,
          type: 'image/jpeg',
          size: bytes,
          originalSize: file.size,
          width,
          height,
          quality,
          uploadedAt: nowIso()
        };
      }
    }
  }
  if (!best || best.bytes > 890000) throw new Error('Das Foto konnte nicht klein genug komprimiert werden. Bitte Bild zuschneiden und erneut versuchen.');
  return {
    dataUrl: best.dataUrl,
    name: `${(file.name || 'ausweisfoto').replace(/\.[^.]+$/, '')}.jpg`,
    type: 'image/jpeg',
    size: best.bytes,
    originalSize: file.size,
    width: best.width,
    height: best.height,
    quality: best.quality,
    uploadedAt: nowIso()
  };
}


function postPhotoField(){
  return `<fieldset class="v43-photo-field"><legend>Fotos zum Beitrag (optional)</legend>
    <label class="v43-photo-pick">📷 Fotos auswählen <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple data-post-photo-input aria-label="Bis zu drei Fotos auswählen"></label>
    <p class="help">Maximal 3 Fotos. JPG, PNG oder WebP; die Bilder werden verkleinert und ohne Foto-Standortdaten gespeichert. Keine Ausweisfotos oder privaten Adressen hochladen.</p>
    <div class="v43-photo-preview" data-post-photo-preview aria-live="polite"></div>
    <p class="v43-photo-status" data-post-photo-status role="status" aria-live="polite">Noch keine Fotos ausgewählt.</p>
  </fieldset>`;
}
const POST_PHOTO_LIMIT = 3;
const POST_PHOTO_BYTES = 850000;
const photoPickerState = new WeakMap();
let photoDraftDbPromise;
function photoDraftDb(){
  if(!('indexedDB' in window))return Promise.resolve(null);
  if(photoDraftDbPromise)return photoDraftDbPromise;
  photoDraftDbPromise=new Promise(resolve=>{
    try{
      const open=indexedDB.open('quartinaut-post-photo-drafts',1);
      open.onupgradeneeded=()=>{if(!open.result.objectStoreNames.contains('images'))open.result.createObjectStore('images');};
      open.onsuccess=()=>resolve(open.result);
      open.onerror=()=>resolve(null);
      open.onblocked=()=>resolve(null);
    }catch{resolve(null);}
  });
  return photoDraftDbPromise;
}
async function photoDraftTransaction(key,images){
  const db=await photoDraftDb();if(!db)return null;
  return new Promise(resolve=>{
    try{
      const tx=db.transaction('images','readwrite');
      const store=tx.objectStore('images');
      if(images===null)store.delete(key);
      else store.put({saved:Date.now(),images},key);
      tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false);tx.onabort=()=>resolve(false);
    }catch{resolve(false);}
  });
}
async function photoDraftLoad(key){
  const db=await photoDraftDb();if(!db)return [];
  return new Promise(resolve=>{
    try{
      const req=db.transaction('images','readonly').objectStore('images').get(key);
      req.onsuccess=()=>{const v=req.result;if(!v||Date.now()-Number(v.saved)>72*3600000)return resolve([]);resolve(Array.isArray(v.images)?v.images.slice(0,POST_PHOTO_LIMIT):[]);};
      req.onerror=()=>resolve([]);
    }catch{resolve([]);}
  });
}
async function preparePostPhoto(file){
  if(file.size>15*1024*1024)throw new Error('Das Foto ist zu gross (maximal 15 MB Originalgrösse).');
  if(!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)&& !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name))throw new Error('Bitte ein JPG-, PNG- oder WebP-Foto wählen.');
  if(/\.hei[cf]$/i.test(file.name)||/hei[cf]/i.test(file.type))throw new Error('HEIC/HEIF wird hier nicht zuverlässig unterstützt. Bitte Foto als JPG speichern.');
  const source=await readFileAsDataUrl(file);
  const image=await loadDrawableImage(source);
  const width0=image.width||image.naturalWidth,height0=image.height||image.naturalHeight;
  if(!width0||!height0)throw new Error('Das Foto konnte nicht geöffnet werden.');
  for(const max of [1600,1280,1024,800,640,500]){
    const scale=Math.min(1,max/Math.max(width0,height0));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width0*scale));canvas.height=Math.max(1,Math.round(height0*scale));
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Fotoverarbeitung ist auf diesem Gerät nicht verfügbar.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
    for(const quality of [0.83,0.7,0.58,0.45]){
      const dataUrl=canvas.toDataURL('image/jpeg',quality);
      const size=dataUrlByteSize(dataUrl);
      if(size<=POST_PHOTO_BYTES)return {dataUrl,size,width:canvas.width,height:canvas.height};
    }
  }
  throw new Error('Foto konnte nicht ausreichend verkleinert werden.');
}
function photoDraftKey(form,context){return `quartinaut-photos-v43:${authState.user?.uid||'guest'}:${form.id}:${context||'default'}`;}
function postPhotoStatus(form,text,problem=false){const el=form.querySelector('[data-post-photo-status]');if(el){el.textContent=text;el.classList.toggle('v43-error',problem);}}
function renderSelectedPhotos(form){
  const model=photoPickerState.get(form);if(!model)return;
  const target=form.querySelector('[data-post-photo-preview]');if(!target)return;
  const all=[...model.existing.map((path,index)=>({path,index,old:true})),...model.selected.map((photo,index)=>({photo,index,old:false}))];
  target.innerHTML=all.map(item=>`<div class="v43-photo-chip">${item.old?`<img data-post-photo-path="${escapeHtml(item.path)}" alt="Vorhandenes Beitragsfoto" loading="lazy">`:`<img src="${item.photo.dataUrl}" alt="Foto-Vorschau" loading="lazy">`}
    <button type="button" data-move-photo="-1" data-photo-class="${item.old?'old':'new'}" data-photo-index="${item.index}" aria-label="Foto nach links verschieben" ${item.index===0?'disabled':''}>←</button>
    <button type="button" data-move-photo="1" data-photo-class="${item.old?'old':'new'}" data-photo-index="${item.index}" aria-label="Foto nach rechts verschieben" ${item.index===(item.old?model.existing.length:model.selected.length)-1?'disabled':''}>→</button>
    <button type="button" data-remove-photo="${item.old?'old':'new'}" data-photo-index="${item.index}" aria-label="Foto entfernen">×</button></div>`).join('');
  postPhotoStatus(form,`${all.length} von ${POST_PHOTO_LIMIT} Fotos ausgewählt.`);
  if(all.some(x=>x.old))void hydratePostPhotoImages(target);
}
async function mountPostPhotoPicker(form,context,existing=[]){
  const key=photoDraftKey(form,context);
  const model={selected:[],existing:validPostPhotoPaths(existing),key,changed:false};photoPickerState.set(form,model);
  const input=form.querySelector('[data-post-photo-input]');
  const pending=photoDraftLoad(key).then(photos=>{
    if(!form.isConnected||model.changed)return;
    model.selected=photos.filter(p=>p&&/^data:image\/jpeg;base64,/.test(p.dataUrl)&&p.size<=POST_PHOTO_BYTES).slice(0,POST_PHOTO_LIMIT-model.existing.length);
    renderSelectedPhotos(form);
  });
  model.ready=pending;
  input?.addEventListener('change',async()=>{
    model.changed=true;await pending;
    const files=[...(input.files||[])];input.value='';
    if(!files.length)return;
    const available=POST_PHOTO_LIMIT-model.existing.length-model.selected.length;
    if(files.length>available){postPhotoStatus(form,`Es sind höchstens ${POST_PHOTO_LIMIT} Fotos erlaubt. Bitte zuerst ein Foto entfernen.`,true);return;}
    postPhotoStatus(form,'Fotos werden vorbereitet …');
    try{
      const processed=[];for(const f of files)processed.push(await preparePostPhoto(f));
      model.selected.push(...processed);
      await photoDraftTransaction(key,model.selected);
      renderSelectedPhotos(form);
    }catch(error){postPhotoStatus(form,error.message||'Foto konnte nicht vorbereitet werden.',true);}
  });
  form.querySelector('[data-post-photo-preview]')?.addEventListener('click',async event=>{
    const mover=event.target.closest('[data-move-photo]');
    if(mover){model.changed=true;await pending;const list=mover.dataset.photoClass==='old'?model.existing:model.selected;const from=Number(mover.dataset.photoIndex),to=from+Number(mover.dataset.movePhoto);if(to<0||to>=list.length)return;[list[from],list[to]]=[list[to],list[from]];await photoDraftTransaction(key,model.selected);renderSelectedPhotos(form);return;}
    const btn=event.target.closest('[data-remove-photo]');if(!btn)return;
    model.changed=true;await pending;
    const index=Number(btn.dataset.photoIndex);
    if(btn.dataset.removePhoto==='old')model.existing.splice(index,1);else model.selected.splice(index,1);
    await photoDraftTransaction(key,model.selected);renderSelectedPhotos(form);
  });
  form.closest('.modal-backdrop')?.addEventListener('modal:close',()=>{
    if(form.dataset.photoSaved==='yes')void photoDraftTransaction(key,null);
    else void photoDraftTransaction(key,model.selected);
  },{once:true});
  renderSelectedPhotos(form);
  return model;
}
function validPostPhotoPaths(raw){
  if(!Array.isArray(raw))return [];
  return raw.filter(x=>typeof x==='string'&&/^post-photos\/(requests|community|groups)\/[A-Za-z0-9_-]{5,128}\/[A-Za-z0-9_-]{5,128}\/[0-2]\.jpg$/.test(x)).slice(0,POST_PHOTO_LIMIT);
}
function postPhotoGallery(paths){
  const photos=validPostPhotoPaths(paths);
  if(!photos.length)return '';
  return `<div class="v44-carousel" data-v44-carousel data-current="0" aria-label="Beitragsfotos, ${photos.length} Bilder">
    <div class="v44-carousel-track">${photos.map((path,index)=>`<div class="v44-carousel-slide"><img alt="Beitragsfoto ${index+1} von ${photos.length}" loading="lazy" data-post-photo-path="${escapeHtml(path)}"></div>`).join('')}</div>
    ${photos.length>1?`<button type="button" class="v44-carousel-prev" data-v44-carousel-step="-1" aria-label="Vorheriges Foto">‹</button>
    <button type="button" class="v44-carousel-next" data-v44-carousel-step="1" aria-label="Nächstes Foto">›</button>
    <div class="v44-carousel-count" aria-live="polite">1 / ${photos.length}</div>
    <div class="v44-carousel-dots" aria-hidden="true">${photos.map((_,i)=>`<span class="${i===0?'active':''}"></span>`).join('')}</div>`:''}
  </div>`;
}
async function removeOwnedPostPhotos(paths){
  try{
    const api=await initFirebaseStorage();if(!api||!authState.user?.uid)return;
    for(const path of validPostPhotoPaths(paths)){
      if(path.split('/')[2]!==authState.user.uid)continue;
      try{await api.deleteObject(api.ref(api.storage,path));}
      catch(error){console.warn('[Quartinaut] Altes Beitragsfoto konnte nicht gelöscht werden.',error);}
    }
  }catch(error){console.warn('[Quartinaut] Foto-Bereinigung fehlgeschlagen.',error);}
}
// v4.5: Keine dauerhaften Firebase-Download-URLs für Gruppen- oder Beitragsfotos.
// Das Backend prüft den Beitrag, Freigabestatus, den Kanton und die Gruppenmitgliedschaft.
const photoUrlCache=new Map();
async function hydratePostPhotoImages(root=document){
  const imgs=[...(root.querySelectorAll?.('img[data-post-photo-path]')||[])];
  if(!imgs.length||!isFirebaseMode()||!authState.user)return;
  const expectedUid=authState.user.uid, expectedEpoch=accountEpoch;
  await Promise.all(imgs.map(async img=>{
    const path=img.dataset.postPhotoPath, cacheKey=expectedUid+':'+path;
    if(!validPostPhotoPaths([path]).length)return;
    try{
      let src=photoUrlCache.get(cacheKey);
      if(!src){
        const result=await callQuartinaut('quartinautPhoto',{action:'read',path});
        if(result?.mime!=='image/jpeg'||!/^\/9j/.test(String(result.base64||''))||result.base64.length>1300000)throw new Error('Ungültiges Fotoformat.');
        if(!currentAccountEpoch(expectedUid,expectedEpoch))return;
        src='data:image/jpeg;base64,'+result.base64;
        if(photoUrlCache.size>=36)photoUrlCache.delete(photoUrlCache.keys().next().value);
        photoUrlCache.set(cacheKey,src);
      }
      if(img.isConnected&&currentAccountEpoch(expectedUid,expectedEpoch))img.src=src;
    }catch(error){
      if(img.isConnected&&currentAccountEpoch(expectedUid,expectedEpoch)){img.alt='Foto nicht verfügbar oder keine Berechtigung';img.classList.add('v43-photo-unavailable');}
      console.warn('[Quartinaut] Foto nicht verfügbar',String(error?.code||error?.message||''));
    }
  }));
}
const postPhotoObserver=new MutationObserver(()=>{
  if(document.querySelector('img[data-post-photo-path]:not([src])'))void hydratePostPhotoImages(document);
});
postPhotoObserver.observe(document.documentElement,{childList:true,subtree:true});
async function uploadPostPhotos(namespace,token,photos){
  if(!photos.length)return [];
  if(!['requests','community','groups'].includes(namespace)||!/^[A-Za-z0-9_-]{5,128}$/.test(String(token)))throw new Error('Ungültiges Foto-Ziel.');
  if(!authState.user?.uid||!isFirebaseMode())throw new Error('Zum Hochladen von Fotos musst du angemeldet sein.');
  const expectedUid=authState.user.uid,expectedEpoch=accountEpoch;
  const api=await initFirebaseStorage();if(!api)throw new Error('Firebase Storage ist nicht verfügbar.');
  if(!currentAccountEpoch(expectedUid,expectedEpoch))throw new Error('Sitzung gewechselt; Foto-Upload abgebrochen.');
  const uploaded=[];
  for(let i=0;i<photos.length;i++){
    const path=`post-photos/${namespace}/${expectedUid}/${token}/${i}.jpg`;
    try{
      if(!currentAccountEpoch(expectedUid,expectedEpoch))throw new Error('Sitzung gewechselt; Foto-Upload abgebrochen.');
      await api.uploadString(api.ref(api.storage,path),photos[i].dataUrl,'data_url',{contentType:'image/jpeg',customMetadata:{uploadedBy:expectedUid}});uploaded.push(path);
      if(!currentAccountEpoch(expectedUid,expectedEpoch))throw new Error('Sitzung gewechselt; Foto-Upload abgebrochen.');}
    catch(error){for(const oldPath of uploaded){try{await api.deleteObject(api.ref(api.storage,oldPath));}catch{}}throw new Error('Foto-Upload nicht möglich. Die Berechtigung oder Verbindung prüfen. Der Entwurf bleibt erhalten.');}
  }
  return uploaded;
}

async function initFirebaseStorage() {
  if (!firebaseAppInstance) return null;
  if (firebaseStorageApi) return firebaseStorageApi;
  const storageModule = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js');
  const storage = storageModule.getStorage(firebaseAppInstance);
  firebaseStorageApi = { storage, ...storageModule };
  return firebaseStorageApi;
}

async function persistVerificationPhoto(requestId, photo) {
  if (!isFirebaseMode()) return { ...photo, storageMode: 'local' };
  const api = await initFirebaseStorage();
  if (!api) throw new Error('Firebase Storage ist momentan nicht verfügbar.');
  const { storage, ref, uploadString } = api;
  const storagePath = `verification-photos/${authState.user.uid}/${requestId}.jpg`;
  const fileRef = ref(storage, storagePath);
  try {
    await uploadString(fileRef, photo.dataUrl, 'data_url', { contentType: 'image/jpeg' });
  } catch (error) {
    reportBackgroundError('Verifizierungsfoto speichern', error);
    throw new Error('Ausweisfoto konnte nicht sicher in Firebase Storage gespeichert werden. Bitte Storage/CORS-Freigabe prüfen und danach erneut versuchen.');
  }
  return {
    storageMode: 'storage',
    storagePath,
    name: photo.name,
    type: photo.type,
    size: photo.size,
    uploadedAt: photo.uploadedAt
  };
}

async function deleteVerificationPhoto(req) {
  const storagePath = req?.idPhoto?.storagePath;
  if (!storagePath || !isFirebaseMode()) return;
  try {
    const { storage, ref, deleteObject } = await initFirebaseStorage();
    await deleteObject(ref(storage, storagePath));
  } catch (error) {
    if (String(error?.code || '') === 'storage/object-not-found') return;
    throw new Error('Ausweisfoto konnte nicht aus Firebase Storage entfernt werden. Bitte erneut versuchen.');
  }
}

function verificationPhotoAvailable(req) {
  const photo = req?.idPhoto || {};
  return Boolean(photo.storagePath || (!isFirebaseMode() && photo.dataUrl));
}

function verificationPhotoMetaText(req) {
  const photo = req?.idPhoto || {};
  const storedAt = photo.uploadedAt ? formatDate(photo.uploadedAt) : 'unbekannt';
  if (photo.storagePath) return `Geschützt gespeichert: ${photo.storagePath} · ${storedAt}`;
  if (photo.dataUrl && !isFirebaseMode()) return `Lokale Vorschau · ${storedAt}`;
  return 'Kein Ausweisfoto vorhanden.';
}

async function openVerificationPhotoModal(id) {
  const expectedUid = authState.user?.uid, expectedEpoch = accountEpoch;
  if (!expectedUid) throw new Error('Bitte anmelden.');
  const req = state.verificationRequests.find(item => item.id === id);
  if (!req?.idPhoto) throw new Error('Ausweisfoto nicht gefunden.');
  const photo = req.idPhoto;
  let objectUrl = '';
  let photoUrl = '';
  if (photo.storagePath && isFirebaseMode()) {
    const { storage, ref, getBytes } = await initFirebaseStorage();
    const bytes = await getBytes(ref(storage, photo.storagePath), 900000);
    if (!currentAccountEpoch(expectedUid, expectedEpoch)) return;
    objectUrl = URL.createObjectURL(new Blob([bytes], { type: photo.type || 'image/jpeg' }));
    photoUrl = objectUrl;
  } else if (photo.dataUrl && !isFirebaseMode()) {
    photoUrl = photo.dataUrl;
  }
  if (!photoUrl) throw new Error('Ausweisfoto kann nicht geladen werden.');
  if (!currentAccountEpoch(expectedUid, expectedEpoch)) { if (objectUrl) URL.revokeObjectURL(objectUrl); return; }
  openModal('Ausweisfoto prüfen', `
    <section class="form-grid">
      <p class="help">Dieses Foto ist nur für die Namens- und Identitätsprüfung vorgesehen. Nach Bestätigung oder Ablehnung wird es aus dem Antrag entfernt.</p>
      <figure class="id-photo-preview">
        <img src="${escapeHtml(photoUrl)}" alt="Ausweisfoto von ${escapeHtml(req.displayName || 'Nutzer/in')}" />
        <figcaption>${escapeHtml(req.registeredName || req.displayName || 'Registrierter Name')}</figcaption>
      </figure>
    </section>
  `, (modal) => {
    if (objectUrl) modal.addEventListener('modal:close', () => URL.revokeObjectURL(objectUrl));
  });
}

async function readPublicCantonStatsDoc() {
  if (!isFirebaseMode()) return null;
  const { db, doc, getDoc } = firebaseStoreApi;
  try {
    const ref = doc(db, FIRESTORE_COLLECTIONS.publicStats, 'cantonRegistrations');
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) return null;
    return snapshot.data();
  } catch {
    return null;
  }
}

async function publishPublicCantonStats() {
  if (!isFirebaseMode() || !isAdminRole()) return;
  const expectedUid = authState.user.uid, expectedEpoch = accountEpoch;
  const counts = sanitizeCantonCounts(cantonRegistrationCounts());
  const totalUsers = totalRegisteredUsersFromCounts(counts);
  const payload = {
    id: 'cantonRegistrations',
    cantonCounts: counts,
    totalUsers,
    updatedAt: nowIso()
  };
  if (!currentAccountEpoch(expectedUid, expectedEpoch)) return;
  await setFirebaseDoc(FIRESTORE_COLLECTIONS.publicStats, 'cantonRegistrations', payload, true);
  if (currentAccountEpoch(expectedUid, expectedEpoch)) state.publicStats = payload;
}

function tokenDocId(token = '') {
  const compact = String(token).replace(/[^a-zA-Z0-9]/g, '').slice(-28) || uid('tok');
  return `tok_${authState.user?.uid || 'anon'}_${compact}`;
}

async function initFirebaseMessaging() {
  if (!firebaseAppInstance || !('Notification' in window) || !('serviceWorker' in navigator)) return;
  if (firebaseMessagingApi) return;
  try {
    const messagingModule = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js');
    const supported = await messagingModule.isSupported().catch(() => false);
    if (!supported) return;
    messagingWorkerRegistration = await navigator.serviceWorker.register('./firebase-messaging-sw.js', { scope: '/firebase-cloud-messaging-push-scope' }).catch(error => reportBackgroundError('FCM-Service-Worker registrieren', error, { notify: true, fallback: 'Benachrichtigungs-Service konnte nicht registriert werden.' }));
    const messaging = messagingModule.getMessaging(firebaseAppInstance);
    firebaseMessagingApi = { messaging, ...messagingModule };
    messagingModule.onMessage(messaging, (payload) => {
      const title = payload?.notification?.title || payload?.data?.title || 'Quartinaut';
      const body = payload?.notification?.body || payload?.data?.body || 'Neue Meldung';
      toast(`Push: ${title}`);
      if (Notification.permission === 'granted') {
        void showSystemNotification(title, body, {
          tag: payload?.data?.chatId ? `chat_${payload.data.chatId}` : (payload?.data?.alertId ? `alert_${payload.data.alertId}` : 'quartinaut-push'),
          data: { alertId: payload?.data?.alertId || '', chatId: payload?.data?.chatId || '', route: payload?.data?.route || (payload?.data?.chatId ? 'chats' : 'alarme') }
        });
      }
    });
  } catch (error) {
    firebaseMessagingApi = null;
    reportBackgroundError('Firebase Messaging initialisieren', error, { notify: false });
  }
}

async function registerPushToken() {
  if (!isFirebaseMode() || !authState.user) return '';
  await initFirebaseMessaging();
  if (!firebaseMessagingApi) throw new Error('FCM wird auf diesem Gerät/Browserversion nicht unterstützt.');
  if (!FIREBASE_VAPID_KEY) throw new Error('FCM VAPID-Key fehlt. Bitte in firebase-config.js setzen.');
  const registration = messagingWorkerRegistration || await navigator.serviceWorker.ready;
  const token = await firebaseMessagingApi.getToken(firebaseMessagingApi.messaging, {
    vapidKey: FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration
  });
  if (!token) throw new Error('Kein FCM-Token erhalten.');
  currentPushToken = token;
  const payload = {
    id: tokenDocId(token),
    uid: authState.user.uid,
    email: authState.user.email,
    displayName: profileName(),
    area: state.profile.area,
    areaKey: normalizeAreaKey(state.profile.area),
    cantonCode: cantonCodeFromArea(state.profile.area),
    token,
    active: true,
    updatedAt: nowIso(),
    createdAt: nowIso()
  };
  await setFirebaseDoc(FIRESTORE_COLLECTIONS.deviceTokens, payload.id, payload, true);
  const preferences = normalizeNotificationPreferences({
    ...currentNotificationPreferences(),
    uid: authState.user.uid,
    enabled: true,
    area: state.profile.area,
    areaKey: currentAreaKey(),
    cantonCode: currentCantonCode(),
    updatedAt: nowIso()
  });
  await setFirebaseDoc(FIRESTORE_COLLECTIONS.notificationPreferences, authState.user.uid, preferences, true);
  state.notificationPreferences = preferences;
  await updateFirebaseProfile({ notifications: true, hasPushToken: true });
  await syncStateFromFirestore();
  return token;
}

async function queueFcmSelfTest(pushToken = currentPushToken) {
  if (!isFirebaseMode() || !authState.user) throw new Error('FCM-Test benötigt Firebase-Anmeldung.');
  const id = uid('push_test');
  await setFirebaseDoc(FIRESTORE_COLLECTIONS.pushTests, id, {
    id,
    uid: authState.user.uid,
    email: authState.user.email,
    displayName: profileName(),
    area: state.profile.area,
    areaKey: normalizeAreaKey(state.profile.area),
    cantonCode: cantonCodeFromArea(state.profile.area),
    tokenHint: pushToken ? `${pushToken.slice(0, 10)}…${pushToken.slice(-8)}` : '',
    status: 'requested',
    createdAt: nowIso(),
    updatedAt: nowIso()
  }, false);
  return id;
}

// Keep Google OAuth helper on the same origin as the application.
// Official guidance: https://firebase.google.com/docs/auth/web/redirect-best-practices
// Mobile browsers use redirect; desktop keeps popup. Never silently retry OAuth in a loop.
const LOGIN_ATTEMPT_KEY = 'quartinaut-login-attempt-v2-0-4';
function currentLoginAttempt() {
  try {
    const attempt = JSON.parse(localStorage.getItem(LOGIN_ATTEMPT_KEY) || 'null');
    if (!attempt || Date.now() - attempt.at > 10 * 60 * 1000) {
      localStorage.removeItem(LOGIN_ATTEMPT_KEY);
      return null;
    }
    return attempt;
  } catch { return null; }
}
function noteLoginAttempt(stage) {
  try { localStorage.setItem(LOGIN_ATTEMPT_KEY, JSON.stringify({at: Date.now(), stage})); } catch {}
}
function clearLoginAttempt() {
  try { localStorage.removeItem(LOGIN_ATTEMPT_KEY); } catch {}
}
function shouldPreferRedirectAuth() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
function loginSessionError() {
  const attempt = currentLoginAttempt();
  if (!attempt) return '';
  return 'Google-Anmeldung wurde gestartet, aber die Firebase-Sitzung wurde hier nicht wiederhergestellt. Öffne https://quartinaut.web.app direkt im normalen Chrome/Safari-Browser (nicht in einer anderen App), prüfe Pop-ups/Cookies und versuche es erneut. Keine Konten löschen.';
}
async function signInWithGoogleFlow() {
  if (!firebaseAuthApi) throw new Error('Google-Anmeldung ist momentan nicht verfügbar.');
  const {auth, provider, signInWithPopup, signInWithRedirect} = firebaseAuthApi;
  noteLoginAttempt('started');
  try {
    // Redirect is recommended on mobile when the authDomain equals the Hosting origin.
    if (shouldPreferRedirectAuth()) {
      noteLoginAttempt('redirect_started');
      await signInWithRedirect(auth, provider);
      return;
    }
    const result = await signInWithPopup(auth, provider);
    if (result?.user) noteLoginAttempt('google_authenticated');
  } catch (error) {
    const code = String(error?.code || '');
    const message = String(error?.message || '');
    clearLoginAttempt();
    if (code === 'auth/popup-blocked' || /Cross-Origin-Opener-Policy|window\.closed/i.test(message)) {
      throw new Error('Das Google-Anmeldefenster wurde blockiert. Öffne quartinaut.web.app direkt in Chrome oder Safari und erlaube Pop-ups.');
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      throw new Error('Die Google-Anmeldung wurde abgebrochen. Bitte erneut versuchen.');
    }
    if (code === 'auth/unauthorized-domain') {
      throw new Error('Firebase Authentication: quartinaut.web.app ist noch nicht als autorisierte Domain eingetragen. Bitte Authentication → Einstellungen → Autorisierte Domains prüfen.');
    }
    throw error;
  }
}

// Firebase E-Mail/Passwort registration: verification is required before any Firestore profile is created.
function emailOnlyUnverified(firebaseUser) {
  return Boolean(firebaseUser?.email && !firebaseUser.emailVerified &&
    !firebaseUser.providerData?.some(provider => provider.providerId === 'google.com'));
}
function readableEmailAuthError(error) {
  switch (String(error?.code || '')) {
    case 'auth/operation-not-allowed': return 'E-Mail/Passwort ist in Firebase noch nicht aktiviert. Die Verwaltung muss Authentication → Anmeldemethode → E-Mail/Passwort einschalten.';
    case 'auth/email-already-in-use': return 'Zu dieser E-Mail-Adresse gibt es bereits ein Konto. Bitte anmelden oder bei einem bestehenden Google-Konto zunächst das Konto verknüpfen lassen.';
    case 'auth/weak-password': return 'Bitte ein längeres, sicheres Passwort auswählen.';
    case 'auth/invalid-email': return 'Bitte eine gültige E-Mail-Adresse eingeben.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'Anmeldung fehlgeschlagen. Prüfe E-Mail und Passwort oder nutze „Passwort vergessen“.';
    case 'auth/too-many-requests': return 'Zu viele Versuche. Bitte später erneut versuchen.';
    case 'auth/network-request-failed': return 'Verbindung fehlgeschlagen. Bitte Internetverbindung prüfen und erneut versuchen.';
    default: return error?.message || 'Die E-Mail-Anmeldung konnte nicht abgeschlossen werden.';
  }
}
function registrationFieldsFromForm(data) {
  const displayName = String(data.displayName || '').trim();
  const location = buildLocation(data.cantonBfsCode, data.municipalityBfsCode);
  const inviteCode = validateInviteCode(data.inviteCode);
  const accountType = normalizeAccountType(data.accountType);
  const companyName = String(data.companyName || '').trim();
  const municipalityDepartment = String(data.municipalityDepartment || '').trim();
  if (!displayName) throw new Error('Bitte einen Namen eingeben.');
  if (!location) throw new Error('Bitte Kanton und Gemeinde/Ort auswählen.');
  if (accountType === 'company' && companyName.length < 2) throw new Error('Für Firmenkonten bitte einen Firmennamen eingeben.');
  if (accountType === 'municipality' && municipalityDepartment.length < 2) throw new Error('Für Gemeindekonten bitte Abteilung oder Funktion eingeben.');
  return { displayName, location, inviteCode, accountType, companyName,
    companyPurpose: String(data.companyPurpose || '').trim(), municipalityDepartment,
    municipalityWebsite: String(data.municipalityWebsite || '').trim() };
}
async function registerWithFirebaseEmail(data) {
  const {auth,createUserWithEmailAndPassword,sendEmailVerification} = firebaseAuthApi;
  const email=normalizeEmail(data.email), password=String(data.password || '');
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Bitte gültige E-Mail-Adresse eingeben.');
  if (password.length < 10) throw new Error('Das Passwort muss mindestens 10 Zeichen enthalten.');
  if (password !== String(data.passwordConfirm || '')) throw new Error('Die Passwörter stimmen nicht überein.');
  const registration=registrationFieldsFromForm(data);
  // Keep only non-sensitive registration fields locally until email is verified.
  savePendingGoogleRegistration({...registration, email, provider:'password'});
  try {
    const result=await createUserWithEmailAndPassword(auth,email,password);
    await sendEmailVerification(result.user, {url: `${location.origin}/?emailVerified=1`});
    emailAuthNotice='Bestätigungs-E-Mail wurde verschickt. Bitte Posteingang und Spam prüfen. Anschliessend „E-Mail geprüft“ antippen.';
  } catch(error) {
    // If the account exists we must not overwrite its pending registration data.
    if (error?.code === 'auth/email-already-in-use') clearPendingGoogleRegistration();
    throw new Error(readableEmailAuthError(error));
  }
  render();
}
async function loginWithFirebaseEmail(data) {
  const {auth,signInWithEmailAndPassword} = firebaseAuthApi;
  const email=normalizeEmail(data.email),password=String(data.password || '');
  if (!email || !password) throw new Error('Bitte E-Mail und Passwort eingeben.');
  try {await signInWithEmailAndPassword(auth,email,password);} catch(error){throw new Error(readableEmailAuthError(error));}
}
async function resendFirebaseEmailVerification() {
  const user=firebaseAuthApi?.auth.currentUser;
  if (!user) throw new Error('Bitte melde dich zuerst mit E-Mail und Passwort an.');
  await firebaseAuthApi.sendEmailVerification(user,{url:`${location.origin}/?emailVerified=1`});
  emailAuthNotice='Eine neue Bestätigungs-E-Mail wurde verschickt.';
  render();
}
async function checkFirebaseEmailVerification() {
  const user=firebaseAuthApi?.auth.currentUser;
  if(!user) {authMode='login';render();return;}
  await firebaseAuthApi.reload(user);
  if (!user.emailVerified) {
    emailAuthNotice='Die E-Mail-Adresse ist noch nicht bestätigt. Öffne den Link in der E-Mail und versuche es dann erneut.';
    render();return;
  }
  emailAuthNotice='';
  if(firebaseProfileRetryHandler) await firebaseProfileRetryHandler();
}
async function resetFirebaseEmailPassword() {
  const field=byId('firebaseEmailInput');
  const email=normalizeEmail(field?.value || '');
  if (!email) { emailAuthNotice='Bitte zuerst deine E-Mail-Adresse ins Feld eingeben.';render();return; }
  try { await firebaseAuthApi.sendPasswordResetEmail(firebaseAuthApi.auth,email); }
  catch(error) {if(error?.code==='auth/operation-not-allowed')throw new Error(readableEmailAuthError(error));}
  emailAuthNotice='Falls ein Konto für diese Adresse besteht, erhältst du eine E-Mail zum Zurücksetzen des Passworts.';
  render();
}

async function initAuth() {
  if (FIREBASE_READY) {
    try {
      // Parallel requests avoid waiting for the Firebase SDK modules one by one.
      const [appModule, authModule, firestoreModule, functionsModule] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'),
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js')
      ]);
      const app = appModule.initializeApp(FIREBASE_CONFIG);
      if (FIREBASE_APP_CHECK_SITE_KEY) {
        const appCheckModule = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-check.js');
        const appCheck = appCheckModule.initializeAppCheck(app, {
          provider: new appCheckModule.ReCaptchaV3Provider(FIREBASE_APP_CHECK_SITE_KEY),
          isTokenAutoRefreshEnabled: true
        });
        firebaseAppCheckApi = { appCheck, ...appCheckModule };
      }
      const auth = authModule.getAuth(app);
      try { await authModule.setPersistence(auth, authModule.browserLocalPersistence); }
      catch (error) { reportBackgroundError('Anmeldesitzung dauerhaft speichern', error, {notify:false}); }
      const provider = new authModule.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      let db;
      try {
        db = firestoreModule.initializeFirestore(app, {
          localCache: firestoreModule.persistentLocalCache({
            tabManager: firestoreModule.persistentMultipleTabManager()
          })
        });
      } catch (error) {
        reportBackgroundError('Firestore Offline-Persistenz aktivieren', error, { notify: false });
        db = firestoreModule.getFirestore(app);
      }
      const functions = functionsModule.getFunctions(app, 'europe-west6');
      firebaseAppInstance = app;
      firebaseAuthApi = { auth, provider, ...authModule };
      firebaseStoreApi = { db, ...firestoreModule };
      firebaseFunctionsApi = { functions, ...functionsModule };

      // Firebase auth and Firestore profile are separate stages. Never sign the Google
      // account out just because Firestore is offline, denied or a Function fails.
      let authCallbackGeneration = 0;
      const handleFirebaseUser = async (firebaseUser) => {
        const callbackGeneration = ++authCallbackGeneration;
        resetAccountSession(firebaseUser?.uid || '', 'firebase');
        if (!firebaseUser) {
          stopRealtimeSubscriptions();
          authState = { ready: true, mode: 'firebase', user: null, error: loginSessionError() };
          render();
          return;
        }
        stopRealtimeSubscriptions();
        authState = { ready: false, mode: 'firebase', user: null, error: '' };
        render();
        try {
          // Refresh Firebase's verified flag once, then block unverified password accounts.
          if (emailOnlyUnverified(firebaseUser)) {
            try {await firebaseAuthApi.reload(firebaseUser);} catch {} // Remains blocked if offline
            if (emailOnlyUnverified(firebaseUser)) {
              authState={ready:true,mode:'firebase',user:null,error:'',verifyPending:{email:firebaseUser.email}};
              render();return;
            }
          }
          const initialClaims = await authClaims(firebaseUser, false); // Reuse valid cached claims; no forced network refresh on every launch
          const userDoc = await upsertFirebaseUserDoc(firebaseUser);
          let finalClaims = initialClaims;
          try {
            finalClaims = await ensureServerAdminClaim(firebaseUser, userDoc, initialClaims);
          } catch (claimError) {
            // An optional admin bootstrap failure must not invalidate a normal login.
            reportBackgroundError('Adminrechte prüfen', claimError, { notify: false });
          }
          // Login completed only after a profile was successfully read/created.
          if (callbackGeneration !== authCallbackGeneration || firebaseAuthApi.auth.currentUser?.uid !== firebaseUser.uid) return;
          const signedInUser = makeAuthUser(firebaseUser, userDoc, finalClaims);
          authState = { ready: true, mode: 'firebase', user: signedInUser, error: '' };
          clearLoginAttempt();
          applyAuthenticatedUser(signedInUser);
          if (!new URLSearchParams(location.search).has('route')) state.route = loadHome(signedInUser.uid);
          render();
          void loadHub();
          void v47StartOwnerSync(signedInUser.uid);
          void v47ApplyDeepLink();
          const expectedUid = signedInUser.uid;
          if (isAccountPendingApproval(signedInUser)) {
            stopRealtimeSubscriptions();
            return;
          }
          // UI anzeigen, Firestore-Abfragen und Push im Hintergrund nachziehen.
          void syncStateFromFirestore()
            .then(() => {
              if (authState.user?.uid !== expectedUid) return;
              startUserChatRealtime(expectedUid);
              startScopedContentRealtime(expectedUid);
              render();
            })
            .catch(error => reportBackgroundError('Firebase-Daten synchronisieren', error, { notify: false, fallback: 'Daten konnten nicht synchronisiert werden.', collection: 'sync' }));
          void initFirebaseMessaging()
            .then(() => (authState.user?.uid === expectedUid && signedInUser.notifications ? registerPushToken().catch(error => reportBackgroundError('Push-Token speichern', error, { notify: false, fallback: 'Push-Token konnte nicht gespeichert werden.', collection: FIRESTORE_COLLECTIONS.deviceTokens })) : null))
            .then(() => { if (authState.user?.uid === expectedUid) render(); })
            .catch(error => reportBackgroundError('Push initialisieren', error, { notify: false }));
        } catch (error) {
          if (callbackGeneration !== authCallbackGeneration || firebaseAuthApi.auth.currentUser?.uid !== firebaseUser.uid) return;
          const code = String(error?.code || '');
          let message = error?.message || 'Benutzerprofil konnte nicht geladen werden.';
          if (/noch nicht registriert/i.test(message) && firebaseUser.emailVerified) {
            authMode='register';
            authState={ready:true,mode:'firebase',user:null,error:'',needsProfileCompletion:true};
            render();return;
          }
          if (code.includes('permission-denied')) message = 'Anmeldung erfolgreich, aber Firestore verweigert den Zugriff auf dein Benutzerprofil (permission-denied). Die Firebase-Sicherheitsregeln müssen geprüft werden.';
          if (code.includes('unavailable') || code.includes('deadline-exceeded')) message = 'Anmeldung erfolgreich, aber Firebase ist gerade nicht erreichbar. Prüfe deine Internetverbindung und versuche es erneut.';
          if (code.includes('failed-precondition')) message = 'Anmeldung erfolgreich, aber Firestore konnte nicht gestartet werden (failed-precondition).';
          stopRealtimeSubscriptions();
          clearLoginAttempt();
          authState = { ready: true, mode: 'firebase', user: null, error: '', profileError: message };
          reportBackgroundError('Benutzerprofil nach Firebase-Anmeldung', error, { notify: false });
          render();
        }
      };
      firebaseProfileRetryHandler = () => handleFirebaseUser(auth.currentUser);
      authModule.onAuthStateChanged(auth, handleFirebaseUser);
      void authModule.getRedirectResult(auth)
        .then(result => {
          if (result?.user) {
            noteLoginAttempt('google_authenticated');
            return; // onAuthStateChanged handles the signed-in user and Firestore profile.
          }
          if (!auth.currentUser && currentLoginAttempt() && !authState.profileError) {
            authState = { ready: true, mode: 'firebase', user: null, error: loginSessionError() };
            render();
          }
        })
        .catch(error => {
          const code = String(error?.code || '');
          if (code === 'auth/no-auth-event') return;
          clearLoginAttempt();
          reportBackgroundError('Google-Redirect-Anmeldung', error, { notify: false });
          if (!authState.user && !authState.profileError) {
            authState = {
              ready: true,
              mode: 'firebase',
              user: null,
              error: actionErrorMessage(error, 'Google-Anmeldung fehlgeschlagen.')
            };
            render();
          }
        });
      return;
    } catch (error) {
      // Important: A failed Firebase connection must never downgrade production users
      // to a disconnected local-password mode. This does NOT weaken Firestore access.
      console.error('[Quartinaut] Firebase Auth konnte nicht geladen werden', error);
      authState = { ready: true, mode: 'firebase', user: null,
        error: 'Die Verbindung zur Anmeldung konnte nicht hergestellt werden. Bitte prüfe das Internet und versuche es erneut.' };
      render();
      return;
    }
  }

  // Local mode is used only when no Firebase configuration is supplied.
  const restoredLocalUser = loadLocalSession();
  resetAccountSession(restoredLocalUser?.uid || '', 'local');
  authState = { ready: true, mode: 'local', user: restoredLocalUser, error: '' };
  applyAuthenticatedUser(authState.user);
  render();
}

async function signInWithLocalAuth(data) {
  const email = normalizeEmail(data.email);
  const password = String(data.password || '');
  if (!email || !password) throw new Error('E-Mail und Passwort sind erforderlich.');
  if (!email.includes('@')) throw new Error('Bitte eine gültige E-Mail-Adresse eingeben.');

  const users = loadLocalUsers();
  const stored = users[email];
  const passwordHash = await sha256(`${email}:${password}`);
  if (!stored || stored.passwordHash !== passwordHash) {
    throw new Error('Login fehlgeschlagen. Prüfe E-Mail und Passwort.');
  }

  const fallbackLocation = stored.location || (stored.area ? { municipalityName: stored.area, cantonCode: '', cantonName: '', cantonBfsCode: '', municipalityBfsCode: '' } : null);
  const user = {
    uid: stored.uid,
    email,
    displayName: stored.displayName,
    initials: stored.initials,
    area: fallbackLocation ? locationLabel(fallbackLocation) : stored.area,
    location: fallbackLocation,
    role: isPrimaryAdminEmail(email) ? 'admin' : stored.role,
    accountType: normalizeAccountType(stored.accountType || 'resident'),
    accountStatus: stored.accountStatus || 'active',
    companyName: stored.companyName || '',
    companyPurpose: stored.companyPurpose || '',
    companyStatus: stored.companyStatus || (stored.accountType === 'company' ? 'pending' : 'none'),
    municipalityName: stored.municipalityName || '',
    municipalityDepartment: stored.municipalityDepartment || '',
    municipalityWebsite: stored.municipalityWebsite || '',
    municipalityStatus: stored.municipalityStatus || (stored.accountType === 'municipality' ? 'pending' : 'none'),
    adminScopeArea: stored.adminScopeArea || '',
    verified: Boolean(stored.verified),
    verificationStatus: stored.verificationStatus || 'none',
    verificationLabel: stored.verificationLabel || (stored.verified ? 'Verifiziert' : ''),
    titleVisible: stored.titleVisible ?? true,
    titlePreset: stored.titlePreset || 'auto',
    titleGrants: normalizeTitleGrants(stored.titleGrants),
    onboarding: normalizeOnboardingState(stored.onboarding)
  };
  saveLocalSession(user);
  resetAccountSession(user.uid, 'local');
  authState = { ready: true, mode: 'local', user, error: '' };
  applyAuthenticatedUser(user);
}

async function registerWithLocalAuth(data) {
  const email = normalizeEmail(data.email);
  const password = String(data.password || '');
  const displayName = String(data.displayName || '').trim();
  const location = buildLocation(data.cantonBfsCode, data.municipalityBfsCode);
  const inviteCode = validateInviteCode(data.inviteCode);
  const accountType = normalizeAccountType(data.accountType);
  const companyName = String(data.companyName || '').trim();
  const companyPurpose = String(data.companyPurpose || '').trim();
  const municipalityDepartment = String(data.municipalityDepartment || '').trim();
  const municipalityWebsite = String(data.municipalityWebsite || '').trim();

  if (!email || !displayName || !password) throw new Error('Name, E-Mail und Passwort sind erforderlich.');
  if (!email.includes('@')) throw new Error('Bitte eine gültige E-Mail-Adresse eingeben.');
  if (password.length < 8) throw new Error('Das Passwort muss mindestens 8 Zeichen haben.');
  if (!location) throw new Error('Bitte Kanton und Gemeinde/Ort auswählen.');
  if (accountType === 'company' && companyName.length < 2) throw new Error('Für Firmenkonten bitte Firmennamen angeben.');
  if (accountType === 'municipality' && municipalityDepartment.length < 2) throw new Error('Für Gemeindekonten bitte Abteilung oder Funktion angeben.');

  const users = loadLocalUsers();
  if (users[email]) throw new Error('Für diese E-Mail existiert bereits ein Konto.');

  const user = {
    uid: uid('user'),
    email,
    displayName,
    initials: initialsFromName(displayName),
    area: locationLabel(location),
    location,
    role: isPrimaryAdminEmail(email) ? 'admin' : inviteRole(inviteCode),
    accountType,
    accountStatus: accountType === 'municipality' && !isPrimaryAdminEmail(email) ? 'pending_verification' : 'active',
    companyName: accountType === 'company' ? companyName : '',
    companyPurpose: accountType === 'company' ? companyPurpose : '',
    companyStatus: accountType === 'company' ? 'pending' : 'none',
    municipalityName: accountType === 'municipality' ? location.municipalityName : '',
    municipalityDepartment: accountType === 'municipality' ? municipalityDepartment : '',
    municipalityWebsite: accountType === 'municipality' ? municipalityWebsite : '',
    municipalityStatus: accountType === 'municipality' && !isPrimaryAdminEmail(email) ? 'pending' : (accountType === 'municipality' ? 'verified' : 'none'),
    adminScopeArea: '',
    verified: accountType === 'municipality' && isPrimaryAdminEmail(email),
    verificationStatus: accountType === 'municipality' ? (isPrimaryAdminEmail(email) ? 'verified' : 'pending') : 'none',
    verificationLabel: accountType === 'municipality' && isPrimaryAdminEmail(email) ? 'Gemeinde' : '',
    titleVisible: true,
    titlePreset: 'auto',
    titleGrants: [],
    onboarding: normalizeOnboardingState()
  };
  users[email] = { ...user, passwordHash: await sha256(`${email}:${password}`), createdAt: nowIso() };
  saveLocalUsers(users);
  saveLocalSession(user);
  resetAccountSession(user.uid, 'local');
  authState = { ready: true, mode: 'local', user, error: '' };
  applyAuthenticatedUser(user);
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = event.submitter || form.querySelector('button[type="submit"]');
  const authProvider = submit?.dataset?.authProvider || 'google';
  const errorNode = byId('authError');
  const data = Object.fromEntries(new FormData(form));
  submit.disabled = true;
  if (errorNode) {
    errorNode.textContent = '';
    errorNode.classList.remove('critical');
  }

  try {
    if (authState.mode === 'firebase') {
      if (!firebaseAuthApi) throw new Error('Firebase-Anmeldung ist momentan nicht verfügbar. Bitte verbinde dich erneut.');
      if (authProvider === 'email') {
        if (authMode === 'register') {
          if (authState.needsProfileCompletion && firebaseAuthApi.auth.currentUser?.emailVerified) {
            savePendingGoogleRegistration({...registrationFieldsFromForm(data),provider:'password',email:firebaseAuthApi.auth.currentUser.email});
            emailAuthNotice='';
            await firebaseProfileRetryHandler?.();
          } else await registerWithFirebaseEmail(data);
        } else await loginWithFirebaseEmail(data);
      } else {
        if (authMode === 'register') savePendingGoogleRegistration(registrationFieldsFromForm(data));
        await signInWithGoogleFlow();
      }
    } else if (authMode === 'register') {
      await registerWithLocalAuth(data);
    } else {
      await signInWithLocalAuth(data);
    }
    if (authState.mode === 'firebase') {
      if (authProvider === 'google') toast('Google-Anmeldung wird abgeschlossen. Profil wird geladen.');
      else if (authMode === 'login') toast('E-Mail-Anmeldung wird geprüft.');
    } else {
      toast(authMode === 'register' ? 'Konto erstellt und angemeldet.' : 'Angemeldet.');
      setRoute('home');
    }
  } catch (error) {
    const originalMessage = authProvider === 'email' ? readableEmailAuthError(error) : (error.message || 'Anmeldung fehlgeschlagen.');
    const unregisteredGoogle = String(originalMessage).toLowerCase().includes('noch nicht registriert');
    const finalMessage = unregisteredGoogle
      ? 'Dieses Google-Konto hat noch kein Quartinaut-Profil. Bitte Name und Gemeinde erfassen und dann mit Google fortfahren.'
      : originalMessage;
    if (authProvider === 'google' && (!unregisteredGoogle || authMode !== 'register')) clearPendingGoogleRegistration();
    if (errorNode) {
      errorNode.textContent = finalMessage;
      errorNode.classList.toggle('critical', unregisteredGoogle);
    }
    if (unregisteredGoogle) {
      authMode = 'register';
      render();
      requestAnimationFrame(() => {
        const nextErrorNode = byId('authError');
        if (nextErrorNode) {
          nextErrorNode.textContent = finalMessage;
          nextErrorNode.classList.add('critical');
        }
      });
      toast('Bitte Profil fertig erfassen.');
    }
  } finally {
    submit.disabled = false;
  }
}

async function signOutCurrentUser() {
  if (authState.mode === 'firebase' && firebaseAuthApi) {
    await firebaseAuthApi.signOut(firebaseAuthApi.auth);
  }
  clearPendingGoogleRegistration();
  clearLoginAttempt();
  resetAccountSession('', authState.mode);
  saveLocalSession(null);hubState.stats=null;
  authState = { ...authState, user: null, ready: true };
  authMode = 'register';
  render();
  toast('Abgemeldet.');
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function cssEscape(value = '') {
  if (window.CSS?.escape) return CSS.escape(String(value));
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function iconSvg(name, className = 'touch-icon') {
  const icons = {
    location: '<path d="M12 22s7-7.2 7-12a7 7 0 0 0-14 0c0 4.8 7 12 7 12Z"/><circle cx="12" cy="10" r="2.6"/>',
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
    bulletin: '<path d="M5 6h14"/><path d="M5 12h14"/><path d="M5 18h10"/>',
    alert: '<path d="M12 4 3.5 19h17L12 4Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    profile: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
    help: '<path d="M9.5 9a2.7 2.7 0 1 1 4.35 2.1c-.97.69-1.85 1.35-1.85 2.65"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
    logout: '<path d="M10 6H6v12h4"/><path d="M14 8l4 4-4 4"/><path d="M18 12H9"/>',
    heart: '<path d="M20.8 8.5c0 4.3-8.8 10.9-8.8 10.9S3.2 12.8 3.2 8.5a5.1 5.1 0 0 1 8.8-3.3 5.1 5.1 0 0 1 8.8 3.3Z"/>',
    bookmark: '<path d="M6 3h12v18l-6-4-6 4V3Z"/>',
    share: '<path d="M12 16V3m0 0L7 8m5-5 5 5"/><path d="M5 13v7h14v-7"/>',
    chat: '<path d="M4 5.5h16v10H8l-4 3v-13Z"/><path d="M8 9h8"/><path d="M8 12h5"/>',
    bell: '<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    bellOff: '<path d="m3 3 18 18"/><path d="M9.7 4.5A6 6 0 0 1 18 10c0 1.4.13 2.5.34 3.38"/><path d="M6.34 13.38C6.13 12.5 6 11.4 6 10a6 6 0 0 1 .78-2.95"/><path d="M4 16h12"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m6 6 1 16h10l1-16"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    restore: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v6h6"/><path d="M12 7v5l3 2"/>',
    edit: '<path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    translate: '<path d="M4 5h9"/><path d="M9 3v2"/><path d="M6 9c1.1 2.4 3.1 4 6 5"/><path d="M12 5c-.6 4.4-3 7.3-7 9"/><path d="M13 19l4-9 4 9"/><path d="M15 15h4"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    need: '<path d="M12 5v14"/><path d="M5 12h14"/><circle cx="12" cy="12" r="9"/>',
    offer: '<path d="M4 12h5l2-3 4 6 2-3h3"/><path d="M5 19h14"/><path d="M7 5h10"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    moon: '<path d="M20 14.5A7.7 7.7 0 0 1 9.5 4 7.8 7.8 0 1 0 20 14.5Z"/>',
    system: '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M8 21h8"/><path d="M12 16v5"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>'
  };
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icons[name] || icons.help}</svg>`;
}

function storedThemeChoice() {
  const value = localStorage.getItem(THEME_KEY);
  return ['light', 'dark', 'white', 'amoled', 'system'].includes(value) ? value : 'system';
}

function systemPrefersDark() {
  return Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches);
}

function resolvedTheme(choice = storedThemeChoice()) {
  if (choice === 'amoled') return 'dark';
  if (choice === 'white') return 'light';
  if (choice === 'dark' || choice === 'light') return choice;
  return systemPrefersDark() ? 'dark' : 'light';
}

function themeLabel(choice = storedThemeChoice()) {
  return ({ system: 'Automatisch', light: 'Grün', dark: 'Dunkel', white: 'Hell', amoled: 'Schwarz' })[choice] || 'Wie auf dem Gerät';
}

function themeIcon(choice = storedThemeChoice()) {
  if (choice === 'dark' || choice === 'amoled') return 'moon';
  if (choice === 'light' || choice === 'white') return 'sun';
  return 'system';
}

function updateThemeMeta(activeTheme = resolvedTheme()) {
  const choice=storedThemeChoice();
  const themeColor=choice==='amoled'?'#000000':choice==='white'?'#ffffff':activeTheme==='dark'?'#08120f':'#24584a';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
}

function updateThemeControls(choice = storedThemeChoice()) {
  const button = byId('themeButton');
  if (button) {
    button.innerHTML = iconSvg(themeIcon(choice));
    button.setAttribute('aria-label', `Darstellung wechseln. Aktuell: ${themeLabel(choice)}`);
    button.setAttribute('title', `Darstellung: ${themeLabel(choice)}`);
  }
  const select = byId('themeChoiceSelect');
  if (select) select.value = choice;
  const profileSelect=byId('v41ThemeSelect');
  if(profileSelect)profileSelect.value=choice;
}

function applyTheme(choice = storedThemeChoice()) {
  const normalized = ['light', 'dark', 'white', 'amoled', 'system'].includes(choice) ? choice : 'system';
  document.documentElement.dataset.themeChoice = normalized;
  document.documentElement.dataset.theme = normalized === 'white' ? 'light' : normalized === 'amoled' ? 'dark' : normalized === 'system' ? resolvedTheme('system') : normalized;
  updateThemeMeta(resolvedTheme(normalized));
  updateThemeControls(normalized);
}

function setThemeChoice(choice, options = {}) {
  const normalized = ['light', 'dark', 'white', 'amoled', 'system'].includes(choice) ? choice : 'system';
  localStorage.setItem(THEME_KEY, normalized);
  applyTheme(normalized);
  if (options.notify) toast(`Darstellung: ${themeLabel(normalized)}`);
}

function cycleThemeChoice() {
  const current = storedThemeChoice();
  const choices=['system','light','dark','white','amoled'];
  const next=choices[(choices.indexOf(current)+1)%choices.length];
  setThemeChoice(next, { notify: true });
}

function themeOptionsHtml() {
  const current = storedThemeChoice();
  return ['system', 'light', 'dark', 'white', 'amoled']
    .map(choice => `<option value="${choice}" ${current === choice ? 'selected' : ''}>${themeLabel(choice)}</option>`)
    .join('');
}

const systemThemeQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
systemThemeQuery?.addEventListener?.('change', () => {
  if (storedThemeChoice() === 'system') applyTheme('system');
});

function formatNumber(value) {
  return Number(value || 0).toLocaleString('de-CH');
}

function formatFileSize(bytes = 0) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return '0 KB';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value = '') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unbekannt';
  return date.toLocaleString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const I18N_LABELS = {
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano'
};

const I18N_TEXT = {
  fr: {
    'Was brauchst du?': 'De quoi as-tu besoin ?',
    'Lokale Nachbarschaftshilfe und Beiträge aus deiner Gemeinde – Fotos, Kommentare und private Nachrichten.': 'Entraide de voisinage et publications de ta commune : photos, commentaires et messages privés.',
    'lokal · einfach · hilfreich': 'local · simple · utile',
    'Ich brauche Hilfe': "J’ai besoin d’aide",
    'Ich biete Hilfe': 'Je propose de l’aide',
    'Lokale Alarme': 'Alertes locales',
    'Startseite anpassen': "Personnaliser l’accueil",
    'Zurücksetzen': 'Réinitialiser',
    'Ausgeblendet': 'Masqué',
    'Ausblenden': 'Masquer',
    'Einklappen': 'Réduire',
    'Aufklappen': 'Développer',
    'Kennzahlen': 'Indicateurs',
    'Relevante Anliegen': 'Demandes pertinentes',
    'Live-Kantonskarte': 'Carte cantonale en direct',
    'Firmen / Arbeit': 'Entreprises / Emploi',
    'So funktioniert Quartinaut': 'Fonctionnement de Quartinaut',
    'offene Anliegen': 'demandes ouvertes',
    'aktive Vermittlungen': 'mises en relation actives',
    'aktive Alarme': 'alertes actives',
    'erledigt/archiviert': 'terminé/archivé',
    'Zum Schwarzen Brett': 'Vers le tableau de quartier',
    'Noch keine offenen Anliegen. Erfasse mit „Ich brauche Hilfe“ das erste.': 'Aucune demande ouverte. Crée la première avec « J’ai besoin d’aide ».',
    'Schwarzes Brett': 'Tableau de quartier',
    'Brett': 'Tableau',
    'Kurz, konkret, lokal: Suche oder biete Hilfe. Für private Absprachen steht der Chat bereit.': 'Court, concret et local : demande ou propose de l’aide. Utilise la messagerie pour les accords privés.',
    'Anliegen': 'Demandes',
    'Sortiert nach Relevanz: Gebiet, Dringlichkeit, Zweck und Alter.': 'Trié par pertinence : zone, urgence, objet et âge.',
    'Neu': 'Nouveau',
    'Suchbegriff eingeben': 'Saisir un terme',
    'Suche': 'Recherche',
    'Kategorie': 'Catégorie',
    'Typ': 'Type',
    'Distanz': 'Distance',
    'Alle': 'Tous',
    'Biete': 'Propose',
    'Filter löschen': 'Supprimer le filtre',
    'Keine passenden Anliegen. Filter anpassen oder ein neues Anliegen erfassen.': 'Aucune demande correspondante. Adapte le filtre ou crée une nouvelle demande.',
    'Profil': 'Profil',
    'Rolle': 'Rôle',
    'Konto': 'Compte',
    'Sprache': 'Langue',
    'Erscheinungsbild': 'Apparence',
    'Profil gespeichert.': 'Profil enregistré.',
    'Verifizierung beantragen': 'Demander la vérification',
    'Verifizierungsmethode': 'Méthode de vérification',
    'Gemeinderegister / Einwohnerkontrolle': 'Registre communal / contrôle des habitants',
    'Notiz': 'Note',
    'Ausweisfoto': 'Photo de pièce d’identité',
    'Standortwechsel beantragen': 'Demander un changement de lieu',
    'Meine Daten exportieren': 'Exporter mes données',
    'Konto löschen': 'Supprimer le compte',
    'Abmelden': 'Déconnexion',
    'Benachrichtigungen aktivieren': 'Activer les notifications',
    'Benachrichtigungen blockiert': 'Notifications bloquées',
    'Anleitung': 'Guide',
    'Prüfen': 'Vérifier',
    'Test senden': 'Envoyer un test',
    'Push prüfen': 'Vérifier les notifications',
    'Chats': 'Discussions',
    'Privater Direkt-Chat': 'Discussion directe privée',
    'Nachricht': 'Message',
    'Nachricht schreiben': 'Écrire un message',
    'Senden': 'Envoyer',
    'Termin': 'Rendez-vous',
    'Chat melden': 'Signaler la discussion',
    'Öffnen': 'Ouvrir',
    'Stumm': 'Muet',
    'Papierkorb': 'Corbeille',
    'Wiederherstellen': 'Restaurer',
    'Endgültig löschen': 'Supprimer définitivement',
    'Admin · Schnellzugriff': 'Admin · Accès rapide',
    'Alarm erstellen': 'Créer une alerte',
    'Code erstellen': 'Créer un code',
    'Moderation': 'Modération',
    'Offene Anträge': 'Demandes ouvertes',
    'Einladungscodes': 'Codes d’invitation',
    'Admin-Auswertungen': 'Statistiques admin',
    'Alle registrierten Nutzer': 'Tous les utilisateurs inscrits',
    'Aktive Konten': 'Comptes actifs',
    'Archiv': 'Archive',
    'Suchen': 'Rechercher',
    'Sortierung': 'Tri',
    'Systempflege': 'Maintenance système',
    'Kategorie-Priorität': 'Priorité des catégories',
    'Datenschutz': 'Protection des données',
    'Nutzungsbedingungen': 'Conditions d’utilisation',
    'Impressum': 'Mentions légales',
    'Speichern': 'Enregistrer',
    'Filter speichern': 'Enregistrer le filtre',
    'Gespeicherten Filter laden': 'Charger le filtre enregistré',
    'Sprache gespeichert.': 'Langue enregistrée.',
    'Filter am Schwarzen Brett gespeichert. Passende neue Anliegen können Push auslösen.': 'Filtre du tableau de quartier enregistré. Les nouvelles demandes correspondantes peuvent déclencher une notification.',
    'Gespeicherter Filter am Schwarzen Brett geladen.': 'Filtre enregistré du tableau de quartier chargé.',
    'Gespeicherter Filter am Schwarzen Brett gelöscht.': 'Filtre enregistré du tableau de quartier supprimé.',
    'Wegleitung': 'Guide',
    'Wegleitung anzeigen': 'Afficher le guide',
    'Überspringen': 'Passer',
    'Zurück': 'Retour',
    'Weiter': 'Suivant',
    'Wegleitung abschliessen': 'Terminer le guide',
    'Installation starten': 'Démarrer l’installation',
    'Benachrichtigungen erlauben': 'Autoriser les notifications',
    'Das digitale Schwarze Brett': 'Le tableau de quartier numérique',
    'Nachrichten bleiben im 1:1-Chat': 'Les messages restent dans la discussion privée',
    'Konto erstellen': 'Créer un compte',
    'Anmelden': 'Se connecter',
    'Kontotyp': 'Type de compte',
    'Privatperson': 'Particulier',
    'Firma': 'Entreprise',
    'Gemeinde': 'Commune',
    'Abteilung / Funktion': 'Service / fonction',
    'Offizielle Webseite (optional)': 'Site officiel (facultatif)',
    'Gemeinde freigeben': 'Valider la commune',
    'Wartet auf Freigabe': 'En attente de validation',
    'Dein Gemeindekonto wird geprüft.': 'Ton compte communal est en cours de vérification.'
  },
  it: {
    'Was brauchst du?': 'Di cosa hai bisogno?',
    'Lokale Nachbarschaftshilfe und Beiträge aus deiner Gemeinde – Fotos, Kommentare und private Nachrichten.': 'Aiuto di vicinato e post del tuo comune: foto, commenti e messaggi privati.',
    'lokal · einfach · hilfreich': 'locale · semplice · utile',
    'Ich brauche Hilfe': 'Ho bisogno di aiuto',
    'Ich biete Hilfe': 'Offro aiuto',
    'Lokale Alarme': 'Allarmi locali',
    'Startseite anpassen': 'Personalizza la home',
    'Zurücksetzen': 'Ripristina',
    'Ausgeblendet': 'Nascosto',
    'Ausblenden': 'Nascondi',
    'Einklappen': 'Comprimi',
    'Aufklappen': 'Espandi',
    'Kennzahlen': 'Indicatori',
    'Relevante Anliegen': 'Richieste rilevanti',
    'Live-Kantonskarte': 'Mappa cantonale live',
    'Firmen / Arbeit': 'Aziende / Lavoro',
    'So funktioniert Quartinaut': 'Come funziona Quartinaut',
    'offene Anliegen': 'richieste aperte',
    'aktive Vermittlungen': 'mediazioni attive',
    'aktive Alarme': 'allarmi attivi',
    'erledigt/archiviert': 'completato/archiviato',
    'Zum Schwarzen Brett': 'Vai alla bacheca di quartiere',
    'Noch keine offenen Anliegen. Erfasse mit „Ich brauche Hilfe“ das erste.': 'Nessuna richiesta aperta. Crea la prima con «Ho bisogno di aiuto».',
    'Schwarzes Brett': 'Bacheca di quartiere',
    'Brett': 'Bacheca',
    'Kurz, konkret, lokal: Suche oder biete Hilfe. Für private Absprachen steht der Chat bereit.': 'Breve, concreto e locale: cerca o offri aiuto. Per gli accordi privati usa la chat.',
    'Anliegen': 'Richieste',
    'Sortiert nach Relevanz: Gebiet, Dringlichkeit, Zweck und Alter.': 'Ordinato per rilevanza: zona, urgenza, scopo ed età.',
    'Neu': 'Nuovo',
    'Suchbegriff eingeben': 'Inserisci termine',
    'Suche': 'Cerca',
    'Kategorie': 'Categoria',
    'Typ': 'Tipo',
    'Distanz': 'Distanza',
    'Alle': 'Tutti',
    'Biete': 'Offro',
    'Filter löschen': 'Elimina filtro',
    'Keine passenden Anliegen. Filter anpassen oder ein neues Anliegen erfassen.': 'Nessuna richiesta corrispondente. Modifica il filtro o crea una nuova richiesta.',
    'Profil': 'Profilo',
    'Rolle': 'Ruolo',
    'Konto': 'Account',
    'Sprache': 'Lingua',
    'Erscheinungsbild': 'Aspetto',
    'Profil gespeichert.': 'Profilo salvato.',
    'Verifizierung beantragen': 'Richiedi verifica',
    'Verifizierungsmethode': 'Metodo di verifica',
    'Gemeinderegister / Einwohnerkontrolle': 'Registro comunale / controllo abitanti',
    'Notiz': 'Nota',
    'Ausweisfoto': 'Foto documento',
    'Standortwechsel beantragen': 'Richiedi cambio luogo',
    'Meine Daten exportieren': 'Esporta i miei dati',
    'Konto löschen': 'Elimina account',
    'Abmelden': 'Esci',
    'Benachrichtigungen aktivieren': 'Attiva notifiche',
    'Benachrichtigungen blockiert': 'Notifiche bloccate',
    'Anleitung': 'Guida',
    'Prüfen': 'Controlla',
    'Test senden': 'Invia test',
    'Push prüfen': 'Controlla push',
    'Chats': 'Chat',
    'Privater Direkt-Chat': 'Chat diretto privato',
    'Nachricht': 'Messaggio',
    'Nachricht schreiben': 'Scrivi un messaggio',
    'Senden': 'Invia',
    'Termin': 'Appuntamento',
    'Chat melden': 'Segnala chat',
    'Öffnen': 'Apri',
    'Stumm': 'Silenzia',
    'Papierkorb': 'Cestino',
    'Wiederherstellen': 'Ripristina',
    'Endgültig löschen': 'Elimina definitivamente',
    'Admin · Schnellzugriff': 'Admin · Accesso rapido',
    'Alarm erstellen': 'Crea allarme',
    'Code erstellen': 'Crea codice',
    'Moderation': 'Moderazione',
    'Offene Anträge': 'Richieste aperte',
    'Einladungscodes': 'Codici invito',
    'Admin-Auswertungen': 'Statistiche admin',
    'Alle registrierten Nutzer': 'Tutti gli utenti registrati',
    'Aktive Konten': 'Account attivi',
    'Archiv': 'Archivio',
    'Suchen': 'Cerca',
    'Sortierung': 'Ordinamento',
    'Systempflege': 'Manutenzione sistema',
    'Kategorie-Priorität': 'Priorità categoria',
    'Datenschutz': 'Privacy',
    'Nutzungsbedingungen': 'Condizioni d’uso',
    'Impressum': 'Colophon',
    'Speichern': 'Salva',
    'Filter speichern': 'Salva filtro',
    'Gespeicherten Filter laden': 'Carica filtro salvato',
    'Sprache gespeichert.': 'Lingua salvata.',
    'Filter am Schwarzen Brett gespeichert. Passende neue Anliegen können Push auslösen.': 'Filtro della bacheca di quartiere salvato. Le nuove richieste corrispondenti possono attivare una notifica.',
    'Gespeicherter Filter am Schwarzen Brett geladen.': 'Filtro salvato della bacheca caricato.',
    'Gespeicherter Filter am Schwarzen Brett gelöscht.': 'Filtro salvato della bacheca eliminato.',
    'Wegleitung': 'Guida',
    'Wegleitung anzeigen': 'Mostra guida',
    'Überspringen': 'Salta',
    'Zurück': 'Indietro',
    'Weiter': 'Avanti',
    'Wegleitung abschliessen': 'Termina guida',
    'Installation starten': 'Avvia installazione',
    'Benachrichtigungen erlauben': 'Consenti notifiche',
    'Das digitale Schwarze Brett': 'La bacheca di quartiere digitale',
    'Nachrichten bleiben im 1:1-Chat': 'I messaggi restano nella chat privata',
    'Konto erstellen': 'Crea account',
    'Anmelden': 'Accedi',
    'Kontotyp': 'Tipo di account',
    'Privatperson': 'Privato',
    'Firma': 'Azienda',
    'Gemeinde': 'Comune',
    'Abteilung / Funktion': 'Ufficio / funzione',
    'Offizielle Webseite (optional)': 'Sito ufficiale (facoltativo)',
    'Gemeinde freigeben': 'Approva il comune',
    'Wartet auf Freigabe': 'In attesa di approvazione',
    'Dein Gemeindekonto wird geprüft.': 'Il tuo account comunale è in verifica.'
  }
};

function currentLocale() {
  const stored = state.locale || localStorage.getItem('quartinaut-locale') || '';
  if (['de', 'fr', 'it'].includes(stored)) return stored;
  const browser = String(navigator.language || 'de').slice(0, 2).toLowerCase();
  return ['de', 'fr', 'it'].includes(browser) ? browser : 'de';
}

function localeOptionsHtml(selected = currentLocale()) {
  return Object.entries(I18N_LABELS)
    .map(([code, label]) => `<option value="${code}" ${code === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`)
    .join('');
}

function setLocale(locale = 'de') {
  const safe = ['de', 'fr', 'it'].includes(locale) ? locale : 'de';
  state.locale = safe;
  localStorage.setItem('quartinaut-locale', safe);
  document.documentElement.lang = safe;
  saveState();
}

const V46_I18N={
 fr:{'Globale Suche':'Recherche globale','Suchbegriff':'Terme recherché','Beiträge':'Publications','Angebote':'Offres','Vereine':'Associations','Personen':'Personnes','Anlässe':'Événements','Gemeinde':'Commune','Nur meine Gemeinde':'Uniquement ma commune','Alle':'Tous','Mitteilungen':'Notifications','Ungelesen':'Non lus','Ausleihen':'Prêts','Weitere':'Autres','Meine Favoriten':'Mes favoris','Favoriten':'Favoris','Suchanfragen':'Recherches enregistrées','Entwürfe':'Brouillons','Meine Entwürfe':'Mes brouillons','Entwürfe verwalten':'Gérer les brouillons','Entwürfe öffnen':'Ouvrir les brouillons','Weiterbearbeiten':'Continuer','Verwerfen':'Supprimer','Nur Fotos':'Photos uniquement','Meine Gemeinde':'Ma commune','Seit letztem Besuch':'Depuis ma dernière visite','Alle Favoriten öffnen':'Voir tous les favoris','Suchen':'Rechercher','Suche':'Recherche','Karte':'Carte','Quartierkarte':'Carte du quartier','Vereinsprofil':'Profil de l’association','Merken':'Enregistrer','Entfernen':'Supprimer','Öffnen':'Ouvrir','Übergabe & Rückgabe im Kalender':'Remise et retour dans le calendrier','Kalenderdatei herunterladen':'Télécharger un calendrier'},
 it:{'Globale Suche':'Ricerca globale','Suchbegriff':'Termine di ricerca','Beiträge':'Pubblicazioni','Angebote':'Offerte','Vereine':'Associazioni','Personen':'Persone','Anlässe':'Eventi','Gemeinde':'Comune','Nur meine Gemeinde':'Solo il mio comune','Alle':'Tutti','Mitteilungen':'Notifiche','Ungelesen':'Non letti','Ausleihen':'Prestiti','Weitere':'Altro','Meine Favoriten':'I miei preferiti','Favoriten':'Preferiti','Suchanfragen':'Ricerche salvate','Entwürfe':'Bozze','Meine Entwürfe':'Le mie bozze','Entwürfe verwalten':'Gestisci le bozze','Entwürfe öffnen':'Apri le bozze','Weiterbearbeiten':'Continua','Verwerfen':'Elimina','Nur Fotos':'Solo foto','Meine Gemeinde':'Il mio comune','Seit letztem Besuch':'Dall’ultima visita','Alle Favoriten öffnen':'Vedi i preferiti','Suchen':'Cerca','Suche':'Ricerca','Karte':'Mappa','Quartierkarte':'Mappa del quartiere','Vereinsprofil':'Profilo dell’associazione','Merken':'Salva','Entfernen':'Rimuovi','Öffnen':'Apri','Übergabe & Rückgabe im Kalender':'Consegna e restituzione nel calendario','Kalenderdatei herunterladen':'Scarica evento calendario'}
};
function translateText(value) {
  const locale = currentLocale();
  if (locale === 'de') return value;
  const dictionary = I18N_TEXT[locale] || {};
  const raw = String(value || '');
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  const translated = V46_I18N[locale]?.[trimmed] || dictionary[trimmed];
  if (!translated) return raw;
  return raw.replace(trimmed, translated);
}

function applyI18n(root = document) {
  const locale = currentLocale();
  document.documentElement.lang = locale;
  if (locale === 'de') return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    node.nodeValue = translateText(node.nodeValue);
  });
  root.querySelectorAll?.('[placeholder], [title], [aria-label]').forEach((el) => {
    ['placeholder', 'title', 'aria-label'].forEach((attr) => {
      if (el.hasAttribute(attr)) el.setAttribute(attr, translateText(el.getAttribute(attr)));
    });
  });
}

function dynamicTextTranslateButton(kind, id, label = 'Übersetzen') {
  return `<button class="ghost-button small translate-button" type="button" data-action="translate-dynamic" data-translate-kind="${escapeHtml(kind)}" data-translate-id="${escapeHtml(id)}">${iconSvg('translate')} ${escapeHtml(label)}</button>`;
}

function isEditCardOpen(cardId = '') {
  return editCards.has(cardId);
}

function setEditCardOpen(cardId = '', open = true) {
  if (!cardId) return;
  if (open) editCards.add(cardId);
  else editCards.delete(cardId);
  render();
  if (open) {
    requestAnimationFrame(() => {
      const escaped = cssEscape(cardId);
      document.querySelector(`[data-edit-card="${escaped}"] input, [data-edit-card="${escaped}"] select, [data-edit-card="${escaped}"] textarea, [data-edit-card="${escaped}"] button`)?.focus();
    });
  }
}

function editCardHeader(title, cardId, editing = isEditCardOpen(cardId)) {
  return `
    <div class="request-head edit-card-head">
      <h2>${escapeHtml(title)}</h2>
      <button class="icon-button small" type="button" data-action="toggle-edit-card" data-edit-card-id="${escapeHtml(cardId)}" aria-label="${escapeHtml(title)} bearbeiten" aria-expanded="${editing ? 'true' : 'false'}" title="${editing ? 'Bearbeitung schliessen' : 'Bearbeiten'}">
        ${iconSvg('edit')}
      </button>
    </div>
  `;
}

function dynamicTextForTranslation(kind = '', id = '') {
  if (kind === 'request') {
    const req = state.requests.find(item => item.id === id);
    if (!req) return null;
    return {
      title: req.title || 'Anliegen',
      text: [req.title, req.text].filter(Boolean).join('\n\n'),
      source: 'Eintrag am Schwarzen Brett'
    };
  }
  if (kind === 'chat-message') {
    const msg = state.chatMessages.find(item => item.id === id);
    if (!msg) return null;
    return {
      title: 'Chat-Nachricht',
      text: msg.text || '',
      source: 'Privater Chat'
    };
  }
  return null;
}

function translateTargetLanguage() {
  const locale = currentLocale();
  return ['de', 'fr', 'it'].includes(locale) ? locale : 'de';
}

function googleTranslateUrl(text = '') {
  const target = translateTargetLanguage();
  return `https://translate.google.com/?sl=auto&tl=${encodeURIComponent(target)}&text=${encodeURIComponent(text.slice(0, 5000))}&op=translate`;
}

function openDynamicTranslateModal(kind = '', id = '') {
  const item = dynamicTextForTranslation(kind, id);
  if (!item || !item.text.trim()) {
    toast('Kein übersetzbarer Text gefunden.');
    return;
  }
  openModal('Text übersetzen', `
    <section class="form-grid">
      <div class="card compact soft">
        <strong>${escapeHtml(item.source)}</strong>
        <p class="help">Dieser Text wird nicht automatisch an Drittanbieter gesendet. Erst mit „Extern übersetzen“ öffnest du Google Translate in einem neuen Tab.</p>
      </div>
      <label>Originaltext
        <textarea readonly rows="8">${escapeHtml(item.text)}</textarea>
      </label>
      <div class="row-actions">
        <a class="primary-button" href="${escapeHtml(googleTranslateUrl(item.text))}" target="_blank" rel="noopener noreferrer">${iconSvg('translate')} Extern übersetzen</a>
        <button class="secondary-button" type="button" data-action="copy-translate-text">${iconSvg('check')} Text kopieren</button>
      </div>
    </section>
  `, (modal) => {
    modal.querySelector('[data-action="copy-translate-text"]')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(item.text)
        .then(() => toast('Text kopiert.'))
        .catch(() => toast('Kopieren nicht möglich.'));
    });
  });
}

function fmtTime(iso) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' });
}

function relative(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.max(1, Math.round(diff / 60000));
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  return `vor ${Math.round(h / 24)} Tg.`;
}

function expiryLabel(iso) {
  if (!iso) return '';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'läuft ab';
  const h = Math.round(diff / 3600000);
  if (h < 1) return 'läuft in <1 Std. ab';
  if (h < 24) return `läuft in ${h} Std. ab`;
  return `läuft in ${Math.round(h / 24)} Tg. ab`;
}

function toast(message) {
  const node = byId('toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => node.classList.remove('show'), 2600);
}

function setRoute(route) {
  if (!VALID_ROUTES.includes(route)) route = 'home';
  if (['bulletin','hub'].includes(state.route) && !['bulletin','hub'].includes(route)) v46PrefsUpdate({bulletinLastSeenAt:nowIso()});
  if (route !== 'profile') dashboardEditing = false;
  state.route = route;
  saveState();
  render();
  if (['hub','search','map','saved'].includes(route) && !hubState.loaded && !hubState.loading) void loadHub();
  if (route === 'search' && authState.user && !v47SearchState.loading && !v47SearchState.rows.length) void v47LoadSearch(0);
  byId('main')?.focus();
}

function isInstalledPwa() {
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
}

function isRegularBrowserMode() {
  return !isInstalledPwa();
}

function notificationPermissionState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

function openNotificationBlockedHelpModal() {
  const isAndroid = /android/i.test(navigator.userAgent || '');
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  const platformHint = isAndroid
    ? `
      <li>Chrome öffnen und auf <strong>quartinaut.web.app</strong> gehen.</li>
      <li>Auf das Schloss-Symbol oder die Seiteninfos tippen.</li>
      <li><strong>Website-Einstellungen → Benachrichtigungen → Zulassen</strong>.</li>
      <li>Seite neu laden und in Quartinaut auf <strong>„Benachrichtigungen aktivieren“</strong> tippen.</li>
    `
    : isIOS
      ? `
      <li>Safari/Browser-Einstellungen öffnen.</li>
      <li>Benachrichtigungen für den Browser und die Website erlauben.</li>
      <li>Quartinaut neu öffnen und erneut auf <strong>„Benachrichtigungen aktivieren“</strong> tippen.</li>
    `
      : `
      <li>Browser-Menü öffnen (⋮ oder ≡).</li>
      <li><strong>Einstellungen → Datenschutz/Sicherheit → Website-Einstellungen → Benachrichtigungen</strong>.</li>
      <li><strong>quartinaut.web.app</strong> auf <strong>Zulassen</strong> stellen.</li>
      <li>Seite neu laden und in Quartinaut auf <strong>„Benachrichtigungen aktivieren“</strong> tippen.</li>
    `;
  openModal('Benachrichtigungen sind blockiert', `
    <section class="form-grid legal-copy">
      <p>Der Browser blockiert Benachrichtigungen aktuell. Solange der Status auf „Blockiert“ steht, kann Quartinaut die Freigabe nicht erneut selbst öffnen.</p>
      <ol class="help-list">
        ${platformHint}
      </ol>
      <div class="row-actions legal-shortcuts">
        <button class="secondary-button small" type="button" data-action="notification-retry-enable">Erneut aktivieren</button>
      </div>
    </section>
  `, (modal) => {
    modal.querySelector('[data-action="notification-retry-enable"]')?.addEventListener('click', () => runAsyncAction(enableNotifications));
  });
}

function openNotificationPermissionNudge(context = 'browser') {
  if (notificationPermissionState() !== 'default') return;
  notificationNudgeShownInSession = true;
  const browserHint = context === 'install'
    ? 'Die App wurde installiert. Aktiviere Benachrichtigungen, damit Alarme direkt auf deinem Gerät erscheinen.'
    : 'Du nutzt Quartinaut im Browser. Aktiviere Benachrichtigungen, damit lokale Alarme direkt angezeigt werden.';
  openModal('Benachrichtigungen freigeben?', `
    <section class="form-grid legal-copy">
      <p>${escapeHtml(browserHint)}</p>
      <div class="row-actions legal-shortcuts">
        <button class="secondary-button small" type="button" data-prompt-notifications="allow">Ja, aktivieren</button>
        <button class="ghost-button small" type="button" data-prompt-notifications="later">Später</button>
      </div>
    </section>
  `, (modal, close) => {
    modal.querySelector('[data-prompt-notifications="allow"]')?.addEventListener('click', () => {
      runAsyncAction(async () => {
        await enableNotifications();
        close();
      });
    });
    modal.querySelector('[data-prompt-notifications="later"]')?.addEventListener('click', () => close());
  });
}

function maybeShowBrowserNotificationNudge() {
  if (notificationNudgeShownInSession) return;
  if (!authState.ready) return;
  if (!isRegularBrowserMode()) return;
  if (notificationPermissionState() !== 'default') return;
  openNotificationPermissionNudge('browser');
}

function renderNotificationPermissionBanner() {
  const banner = byId('permissionBanner');
  if (!banner) return;
  const blocked = notificationPermissionState() === 'denied';
  if (!blocked) localStorage.removeItem(NOTIFICATION_BANNER_DISMISSED_KEY);
  const dismissed = localStorage.getItem(NOTIFICATION_BANNER_DISMISSED_KEY) === '1';
  const show = blocked
    && Boolean(authState.user)
    && !isAccountPendingApproval()
    && isRegularBrowserMode()
    && ['alarme', 'profile'].includes(state.route)
    && !dismissed;
  document.body.classList.toggle('has-permission-banner', show);
  if (!show) {
    banner.hidden = true;
    banner.innerHTML = '';
    return;
  }
  banner.hidden = false;
  banner.innerHTML = `
    <section class="permission-banner-card" role="alert" aria-live="assertive">
      <div class="permission-banner-copy">
        <strong>${iconSvg('bell')} Benachrichtigungen blockiert</strong>
        <span>In den Website-Einstellungen auf „Zulassen“ stellen.</span>
      </div>
      <div class="permission-banner-actions">
        <button class="ghost-button small" type="button" data-action="notification-help">${iconSvg('help')} Anleitung</button>
        <button class="secondary-button small" type="button" data-action="notification-check">${iconSvg('check')} Prüfen</button>
        <button class="icon-button permission-banner-dismiss" type="button" data-action="notification-dismiss" aria-label="Hinweis ausblenden">×</button>
      </div>
    </section>
  `;
  banner.querySelector('[data-action="notification-help"]')?.addEventListener('click', () => openNotificationBlockedHelpModal());
  banner.querySelector('[data-action="notification-check"]')?.addEventListener('click', () => {
    if (notificationPermissionState() === 'granted') {
      runAsyncAction(enableNotifications);
      return;
    }
    renderNotificationPermissionBanner();
    toast('Benachrichtigungen sind weiterhin blockiert.');
  });
  banner.querySelector('[data-action="notification-dismiss"]')?.addEventListener('click', () => {
    localStorage.setItem(NOTIFICATION_BANNER_DISMISSED_KEY, '1');
    renderNotificationPermissionBanner();
  });
}

async function resolveNotificationRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  if (messagingWorkerRegistration) return messagingWorkerRegistration;

  const fcmScoped = await navigator.serviceWorker.getRegistration('/firebase-cloud-messaging-push-scope/').catch(error => reportBackgroundError('FCM-Service-Worker prüfen', error));
  if (fcmScoped) return fcmScoped;

  const anyRegistration = await navigator.serviceWorker.getRegistration().catch(error => reportBackgroundError('Service-Worker prüfen', error));
  if (anyRegistration) return anyRegistration;

  return navigator.serviceWorker.ready.catch(error => reportBackgroundError('Service-Worker bereitstellen', error));
}

async function showSystemNotification(title, body, extra = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  const options = {
    body,
    icon: APP_ICON_192,
    badge: APP_ICON_192,
    tag: 'quartinaut-local-notification',
    renotify: true,
    ...extra
  };
  const registration = await resolveNotificationRegistration();
  if (registration?.showNotification) {
    await registration.showNotification(title, options);
    return true;
  }
  new Notification(title, options);
  return true;
}

async function tryShowSystemNotification(title, body, extra = {}) {
  try {
    return { shown: await showSystemNotification(title, body, extra), error: '' };
  } catch (error) {
    return {
      shown: false,
      error: error?.message || String(error || 'Unbekannter Fehler')
    };
  }
}

function percentage(value, total) {
  if (!total) return 0;
  return Math.round((Number(value) / Number(total)) * 1000) / 10;
}

function baseMunicipalityName(areaLabel = '') {
  return String(areaLabel || '').split(' (')[0].trim();
}

function normalizeAreaKey(areaLabel = '') {
  return String(areaLabel || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function categoryPriority(area = state.profile.area) {
  const areaName = baseMunicipalityName(area);
  const record = state.areaCategoryPriority.find(item => String(item.areaName) === areaName);
  return record?.priority || [];
}

function cantonCodeFromArea(areaLabel = '') {
  const match = String(areaLabel || '').match(/\(([^)]+)\)\s*$/);
  return match?.[1] ? String(match[1]).trim().toUpperCase() : '';
}

function cantonCodeForLocation(locationLike = {}) {
  if (typeof locationLike === 'string') return cantonCodeFromArea(locationLike);
  const normalizedLocation = sanitizeLocation(locationLike);
  if (normalizedLocation?.cantonCode) return String(normalizedLocation.cantonCode).toUpperCase();
  if (locationLike?.cantonCode) return String(locationLike.cantonCode).trim().toUpperCase();
  return cantonCodeFromArea(locationLike?.area || '');
}

function userCantonCode(user = {}) {
  const normalizedLocation = sanitizeLocation(user.location);
  if (normalizedLocation?.cantonCode) return String(normalizedLocation.cantonCode).toUpperCase();
  return cantonCodeFromArea(user.area);
}

function registeredUsersForStats() {
  const users = isFirebaseMode()
    ? (Array.isArray(state.registeredUsers) ? state.registeredUsers : [])
    : Object.values(loadLocalUsers()).map((entry) => ({ ...entry }));
  return users.filter(user => !isArchivedUser(user));
}

function emptyCantonCounts() {
  const dynamicCodes = cantons().map(canton => String(canton.code || '').toUpperCase()).filter(Boolean);
  const allCodes = [...new Set([...SWISS_CANTON_CODES, ...dynamicCodes])];
  return Object.fromEntries(allCodes.map(code => [code, 0]));
}

function sanitizeCantonCounts(raw = {}) {
  const normalized = emptyCantonCounts();
  for (const [code, value] of Object.entries(raw || {})) {
    const key = String(code || '').trim().toUpperCase();
    if (!key) continue;
    const count = Number(value || 0);
    normalized[key] = Number.isFinite(count) && count > 0 ? Math.round(count) : 0;
  }
  return normalized;
}

function cantonRegistrationCounts() {
  if (isFirebaseMode() && !isAdminRole()) {
    return sanitizeCantonCounts(state.publicStats?.cantonCounts || {});
  }
  const counts = emptyCantonCounts();
  for (const user of registeredUsersForStats()) {
    const code = userCantonCode(user);
    if (!code) continue;
    if (!(code in counts)) counts[code] = 0;
    counts[code] += 1;
  }
  return counts;
}

function totalRegisteredUsersFromCounts(counts = {}) {
  return Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
}

function swissMapFillColor(count, maxCount) {
  if (count <= 0) return '#dfe4e1';
  const intensity = maxCount > 0 ? Math.max(0, Math.min(1, count / maxCount)) : 1;
  if (intensity <= 0.2) return '#bddfc6';
  if (intensity <= 0.45) return '#8ec9a4';
  if (intensity <= 0.7) return '#5da77e';
  return '#2f6f4f';
}

async function loadSwissMapSvgTemplate() {
  if (swissMapSvgTemplate) return swissMapSvgTemplate;
  if (swissMapSvgPromise) return swissMapSvgPromise;
  swissMapSvgPromise = fetch('./assets/icons/quartinaut-logo.svg', { cache: 'force-cache' })
    .then((response) => {
      if (!response.ok) throw new Error('SVG konnte nicht geladen werden');
      return response.text();
    })
    .then((svgText) => {
      const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
      const source = doc.querySelector('svg');
      if (!source) throw new Error('Kein SVG gefunden');
      const ns = 'http://www.w3.org/2000/svg';
      const clean = document.createElementNS(ns, 'svg');
      const viewBox = source.getAttribute('viewBox') || '0 0 1024 1024';
      clean.setAttribute('viewBox', viewBox);
      clean.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      clean.classList.add('swiss-map-svg');
      const mapLayer = document.createElementNS(ns, 'g');
      mapLayer.setAttribute('class', 'canton-layer');
      for (const code of SWISS_CANTON_CODES) {
        const path = source.querySelector(`#${code}`);
        if (!path) continue;
        const clone = path.cloneNode(true);
        clone.removeAttribute('style');
        mapLayer.appendChild(clone);
      }
      clean.appendChild(mapLayer);
      swissMapSvgTemplate = clean;
      return clean;
    })
    .catch(error => reportBackgroundError('Schweizer Karte laden', error))
    .finally(() => {
      swissMapSvgPromise = null;
    });
  return swissMapSvgPromise;
}

async function hydrateSwissMapVisual() {
  const host = document.querySelector('[data-swiss-map]');
  if (!host) return;
  const counts = cantonRegistrationCounts();
  const cacheKey = JSON.stringify(SWISS_CANTON_CODES.map(code => [code, Number(counts[code] || 0)]));
  if (swissMapRenderedCache && swissMapRenderedCacheKey === cacheKey) {
    host.innerHTML = '';
    host.appendChild(swissMapRenderedCache.cloneNode(true));
    return;
  }

  const template = await loadSwissMapSvgTemplate();
  if (!host.isConnected) return;
  if (!template) {
    host.innerHTML = '<p class="help">Karte konnte nicht geladen werden.</p>';
    return;
  }

  const svg = template.cloneNode(true);
  const maxCount = Math.max(0, ...Object.values(counts).map((value) => Number(value || 0)));
  const nameByCode = new Map(cantons().map(canton => [String(canton.code || '').toUpperCase(), String(canton.name || canton.code || '')]));
  const activeCodes = [];
  const labelLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  labelLayer.setAttribute('class', 'canton-label-layer');

  for (const code of SWISS_CANTON_CODES) {
    const path = svg.querySelector(`#${code}`);
    if (!path) continue;
    const count = Number(counts[code] || 0);
    if (count > 0) activeCodes.push(code);
    path.classList.add('canton-shape');
    path.style.fill = swissMapFillColor(count, maxCount);
    path.style.stroke = 'rgba(4, 9, 7, 0.72)';
    path.style.strokeWidth = '0.95';
    path.style.vectorEffect = 'non-scaling-stroke';
    path.setAttribute('data-code', code);
    path.setAttribute('data-count', String(count));

    path.querySelector('title')?.remove();
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${nameByCode.get(code) || code} (${code}): ${count}`;
    path.appendChild(title);

    let box = null;
    try {
      box = path.getBBox();
    } catch {
      box = null;
    }
    if (!box || !Number.isFinite(box.width) || !Number.isFinite(box.height) || box.width < 10 || box.height < 10) continue;
    const cx = box.x + (box.width / 2);
    const cy = box.y + (box.height / 2);

    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    marker.setAttribute('x', String(cx - 15));
    marker.setAttribute('y', String(cy - 13));
    marker.setAttribute('width', '30');
    marker.setAttribute('height', '26');
    marker.setAttribute('rx', '7');
    marker.setAttribute('class', `canton-label-badge ${count > 0 ? 'active' : 'inactive'}`);
    labelLayer.appendChild(marker);

    const codeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    codeText.setAttribute('x', String(cx));
    codeText.setAttribute('y', String(cy - 1));
    codeText.setAttribute('class', 'canton-label-code');
    codeText.textContent = code;
    labelLayer.appendChild(codeText);

    const countText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    countText.setAttribute('x', String(cx));
    countText.setAttribute('y', String(cy + 9));
    countText.setAttribute('class', 'canton-label-count');
    countText.textContent = String(count);
    labelLayer.appendChild(countText);
  }

  if (host) host.dataset.activeCantons = activeCodes.join(',');
  svg.appendChild(labelLayer);
  swissMapRenderedCacheKey = cacheKey;
  swissMapRenderedCache = svg.cloneNode(true);
  host.innerHTML = '';
  host.appendChild(svg);
}

function scheduleSwissMapHydration() {
  if (!document.querySelector('[data-swiss-map]')) return;
  const token = ++swissMapHydrationId;
  const run = () => {
    if (token !== swissMapHydrationId) return;
    void hydrateSwissMapVisual();
  };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 700 });
  } else {
    window.setTimeout(run, 0);
  }
}

function orderedCategories(area = state.profile.area) {
  const priority = categoryPriority(area);
  if (!priority.length) return CATEGORIES;
  const fallback = CATEGORIES.filter(cat => !priority.includes(cat));
  return [...priority, ...fallback];
}

function recurringBadge(req) {
  return req.recurringMode === 'woechentlich' ? '<span class="badge info">Wöchentlich</span>' : '';
}

function escalationScore(req) {
  const level = req.escalationLevel || 'keine';
  if (level === 'P0') return 40;
  if (level === 'P1') return 25;
  if (level === 'P2') return 12;
  return 0;
}

function median(values) {
  const numbers = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b);
  if (!numbers.length) return 0;
  const mid = Math.floor(numbers.length / 2);
  if (numbers.length % 2) return numbers[mid];
  return Math.round((numbers[mid - 1] + numbers[mid]) / 2);
}

function formatDurationMinutes(minutes) {
  if (!minutes || minutes < 1) return '< 1 Min.';
  if (minutes < 60) return `${Math.round(minutes)} Min.`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} Std.`;
  return `${(hours / 24).toFixed(1)} Tage`;
}

function relevantScore(req) {
  let score = 0;
  if (req.area === state.profile.area) score += 50;
  if (req.area === 'Gemeindeweit') score += 12;
  if (req.urgency === 'Heute') score += 25;
  if (req.urgency === 'Morgen') score += 12;
  if (req.type === 'Suche') score += 8;
  if (requestChats(req.id).length) score -= 6;
  const distance = requestDistanceKm(req);
  if (distance !== null) score += Math.max(0, 18 - distance);
  score += escalationScore(req);
  score -= Math.min(20, Math.floor((Date.now() - new Date(req.createdAt).getTime()) / 3600000));
  return score;
}

function requestMatches(req) {
  const q = state.filter.q.trim().toLowerCase();
  const categoryOk = state.filter.category === 'Alle' || req.category === state.filter.category;
  const typeOk = state.filter.type === 'Alle' || req.type === state.filter.type;
  const distanceOk = requestIsReachable(req, parseDistanceFilterKm(state.filter.distanceKm));
  const queryOk = !q || [req.title, req.text, req.area, req.category, req.author, req.authorName, req.companyName].some(v => String(v).toLowerCase().includes(q));
  return req.status === 'offen' && categoryOk && typeOk && distanceOk && queryOk;
}

function requestStatusLabel(status = 'offen') {
  if (status === 'wartet_freigabe') return 'In Prüfung';
  if (status === 'abgelehnt') return 'Abgelehnt';
  if (status === 'erledigt') return 'Erledigt';
  if (status === 'archiviert') return 'Archiviert';
  if (status === 'abgelaufen') return 'Abgelaufen';
  return 'Freigegeben';
}

function requestStatusBadge(req = {}) {
  const status = req.status || 'offen';
  const cls = status === 'offen'
    ? 'done'
    : status === 'abgelehnt'
      ? 'danger'
      : status === 'wartet_freigabe'
        ? 'warn'
        : 'info';
  return `<span class="badge ${cls}">${escapeHtml(requestStatusLabel(status))}</span>`;
}

function pendingPublicationRequests() {
  return state.requests
    .filter(req => req.status === 'wartet_freigabe')
    .sort((a, b) => new Date(normalizeStoredDate(b.submittedAt || b.createdAt) || 0) - new Date(normalizeStoredDate(a.submittedAt || a.createdAt) || 0));
}

function ownRequests() {
  const uidValue = authState.user?.uid || '';
  return state.requests.filter(req => requestOwnerUid(req) === uidValue);
}

function ownOpenRequests() {
  return ownRequests().filter(req => req.status === 'offen');
}

function ownPendingRequests() {
  return ownRequests().filter(req => req.status === 'wartet_freigabe');
}

function ownRejectedRequests() {
  return ownRequests().filter(req => req.status === 'abgelehnt');
}

function ownOpenProcessRequests() {
  const uidValue = authState.user?.uid || '';
  const location = state.locationChangeRequests.filter(req => req.uid === uidValue && req.status === 'offen');
  const verification = state.verificationRequests.filter(req => req.uid === uidValue && ['offen', 'zurückgestellt'].includes(req.status));
  const changes = state.changeRequests.filter(req => req.uid === uidValue && ['offen', 'in_pruefung'].includes(req.status));
  return [...location, ...verification, ...changes];
}

function canManageOfficialNotices() {
  return isAdminRole()
    || (
      state.profile.accountType === 'municipality'
      && state.profile.municipalityStatus === 'verified'
      && state.profile.verified
    );
}

function visibleAlerts() {
  if (isAdminRole()) return state.alerts;
  return state.alerts.filter((alert) => {
    const sameCanton = !alert.cantonCode || alert.cantonCode === currentCantonCode();
    if (!sameCanton) return false;
    if (alert.scopeLevel === 'canton') return true;
    return Boolean(alert.areaKey && alert.areaKey === currentAreaKey());
  });
}

function visibleOfficialNotices() {
  const now = Date.now();
  return state.officialNotices
    .filter(notice => {
      if (!canManageOfficialNotices()) {
        const sameCanton = !notice.cantonCode || notice.cantonCode === currentCantonCode();
        const sameMunicipality = notice.areaKey && notice.areaKey === currentAreaKey();
        if (!sameCanton) return false;
        if (notice.scopeLevel !== 'canton' && !sameMunicipality) return false;
      }
      if (notice.status !== 'online' && !canManageOfficialNotices()) return false;
      if (notice.validFrom && new Date(notice.validFrom).getTime() > now) return canManageOfficialNotices();
      if (notice.validUntil && new Date(notice.validUntil).getTime() < now) return canManageOfficialNotices();
      return true;
    })
    .sort((a, b) => Number(b.priority === 'wichtig') - Number(a.priority === 'wichtig') || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function requestQualityMessages(form) {
  const data = Object.fromEntries(new FormData(form));
  const title = String(data.title || '').trim();
  const text = String(data.text || '').trim();
  const messages = [];
  if (title.length > 0 && title.length < 8) messages.push('Titel ist sehr kurz. Besser: konkrete Aufgabe oder Angebot nennen.');
  if (text.length > 0 && text.length < 45) messages.push('Beschreibung ist knapp. Ergänze Ortsteil, Zeitfenster und was genau benötigt wird.');
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text) || /(\+?\d[\d\s().-]{7,}\d)/.test(text)) {
    messages.push('Private Kontaktdaten besser nicht öffentlich posten. Antworten laufen über den privaten Chat.');
  }
  if (!String(data.urgency || '').trim()) messages.push('Dringlichkeit hilft bei der Sortierung.');
  if (String(data.escalationLevel || 'keine') !== 'keine') messages.push('Eskalationsstufen nur verwenden, wenn wirklich ein Risiko oder Zeitdruck besteht.');
  return messages;
}

function normalizeBulletinFilter(filter = {}) {
  const category = ['Alle', ...orderedCategories()].includes(filter.category) ? filter.category : 'Alle';
  const type = ['Alle', 'Suche', 'Biete'].includes(filter.type) ? filter.type : 'Alle';
  const distanceKm = DISTANCE_FILTER_VALUES.includes(String(filter.distanceKm || 'Alle')) ? String(filter.distanceKm || 'Alle') : 'Alle';
  return {
    q: String(filter.q || '').slice(0, 80),
    category,
    type,
    distanceKm,
    areaKey: normalizeAreaKey(filter.areaKey || currentAreaKey()),
    cantonCode: String(filter.cantonCode || currentCantonCode() || '').toUpperCase()
  };
}

function normalizeChoiceArray(value, allowed = []) {
  const values = Array.isArray(value) ? value : [];
  return [...new Set(values.map(String).filter(item => allowed.includes(item)))];
}

function normalizeNotificationKeywordRule(rule = {}, index = 0) {
  const term = String(rule.term || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  return {
    id: String(rule.id || `keyword_${index + 1}`).slice(0, 80),
    term,
    sources: normalizeChoiceArray(rule.sources, NOTIFICATION_SOURCES),
    categories: normalizeChoiceArray(rule.categories, [...CATEGORIES, ...OFFICIAL_NOTICE_CATEGORIES]),
    scope: rule.scope === 'canton' ? 'canton' : 'municipality',
    enabled: rule.enabled !== false
  };
}

function defaultNotificationPreferences(overrides = {}) {
  const profileNotifications = Boolean(state?.profile?.notifications);
  return {
    uid: authState?.user?.uid || '',
    tenantId: 'quartinaut',
    enabled: Boolean(overrides.enabled ?? profileNotifications),
    area: state?.profile?.area || '',
    areaKey: currentAreaKey(),
    cantonCode: currentCantonCode(),
    criticalAlerts: true,
    alerts: {
      enabled: true,
      severities: ['warn', 'info']
    },
    officialNotices: {
      enabled: true,
      priorities: ['wichtig'],
      categories: []
    },
    bulletin: {
      enabled: false,
      types: [],
      categories: []
    },
    chats: {
      enabled: true
    },
    keywordRules: [],
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '07:00',
      timezone: 'Europe/Zurich'
    },
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...overrides
  };
}

function normalizeNotificationPreferences(value = {}) {
  const base = defaultNotificationPreferences(value);
  const alerts = value.alerts && typeof value.alerts === 'object' ? value.alerts : {};
  const officialNotices = value.officialNotices && typeof value.officialNotices === 'object' ? value.officialNotices : {};
  const bulletin = value.bulletin && typeof value.bulletin === 'object' ? value.bulletin : {};
  const chats = value.chats && typeof value.chats === 'object' ? value.chats : {};
  const quietHours = value.quietHours && typeof value.quietHours === 'object' ? value.quietHours : {};
  const keywordRules = (Array.isArray(value.keywordRules) ? value.keywordRules : [])
    .slice(0, MAX_NOTIFICATION_KEYWORD_RULES)
    .map(normalizeNotificationKeywordRule)
    .filter(rule => rule.term && rule.sources.length);
  return {
    ...base,
    uid: String(value.uid || authState?.user?.uid || ''),
    tenantId: 'quartinaut',
    enabled: Boolean(value.enabled ?? base.enabled),
    area: state?.profile?.area || String(value.area || ''),
    areaKey: currentAreaKey() || normalizeAreaKey(value.areaKey || value.area || ''),
    cantonCode: currentCantonCode() || String(value.cantonCode || '').toUpperCase(),
    criticalAlerts: true,
    alerts: {
      enabled: alerts.enabled !== false,
      severities: normalizeChoiceArray(alerts.severities ?? ['warn', 'info'], ['warn', 'info'])
    },
    officialNotices: {
      enabled: officialNotices.enabled !== false,
      priorities: normalizeChoiceArray(officialNotices.priorities ?? ['wichtig'], ['wichtig', 'info']),
      categories: normalizeChoiceArray(officialNotices.categories, OFFICIAL_NOTICE_CATEGORIES)
    },
    bulletin: {
      enabled: Boolean(bulletin.enabled),
      types: normalizeChoiceArray(bulletin.types, ['Suche', 'Biete']),
      categories: normalizeChoiceArray(bulletin.categories, CATEGORIES)
    },
    chats: {
      enabled: chats.enabled !== false
    },
    keywordRules,
    quietHours: {
      enabled: Boolean(quietHours.enabled),
      start: /^\d{2}:\d{2}$/.test(String(quietHours.start || '')) ? String(quietHours.start) : '22:00',
      end: /^\d{2}:\d{2}$/.test(String(quietHours.end || '')) ? String(quietHours.end) : '07:00',
      timezone: 'Europe/Zurich'
    },
    createdAt: normalizeStoredDate(value.createdAt) || base.createdAt,
    updatedAt: normalizeStoredDate(value.updatedAt) || base.updatedAt
  };
}

function currentNotificationPreferences() {
  return normalizeNotificationPreferences(state.notificationPreferences || {});
}

function ownSavedBulletinFilter() {
  const uidValue = authState.user?.uid || '';
  return state.bulletinFilters.find(item => item.uid === uidValue) || null;
}

async function saveCurrentBulletinFilter() {
  if (!authState.user) throw new Error('Anmeldung erforderlich.');
  const current = ownSavedBulletinFilter();
  const now = nowIso();
  const payload = {
    id: `filter_${authState.user.uid}`,
    uid: authState.user.uid,
    email: authState.user.email || '',
    area: state.profile.area || '',
    areaKey: currentAreaKey(),
    cantonCode: currentCantonCode(),
    tenantId: 'quartinaut',
    notifications: true,
    filter: normalizeBulletinFilter(state.filter),
    createdAt: current?.createdAt || now,
    updatedAt: now
  };
  state.bulletinFilters = mergeById([...state.bulletinFilters, payload]).map(item => ({
    ...item,
    filter: normalizeBulletinFilter(item.filter || item)
  }));
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.bulletinFilters, payload.id, payload, true);
  }
  const prefs = currentNotificationPreferences();
  const convertedKeyword = payload.filter.q
    ? normalizeNotificationKeywordRule({
        id: 'legacy_bulletin_filter',
        term: payload.filter.q,
        sources: ['requests'],
        categories: payload.filter.category === 'Alle' ? [] : [payload.filter.category],
        scope: 'municipality',
        enabled: true
      })
    : null;
  const keywordRules = [
    ...prefs.keywordRules.filter(rule => rule.id !== 'legacy_bulletin_filter'),
    ...(convertedKeyword ? [convertedKeyword] : [])
  ].slice(0, MAX_NOTIFICATION_KEYWORD_RULES);
  await persistNotificationPreferences({
    ...prefs,
    bulletin: {
      enabled: true,
      types: payload.filter.type === 'Alle' ? ['Suche', 'Biete'] : [payload.filter.type],
      categories: payload.filter.category === 'Alle' ? [] : [payload.filter.category]
    },
    keywordRules
  }, { notify: false });
  saveState();
  render();
  toast('Filter am Schwarzen Brett gespeichert. Passende neue Anliegen können Push auslösen.');
}

function loadSavedBulletinFilter() {
  const saved = ownSavedBulletinFilter();
  if (!saved) {
    toast('Noch kein Filter am Schwarzen Brett gespeichert.');
    return;
  }
  state.filter = { ...state.filter, ...normalizeBulletinFilter(saved.filter || saved) };
  saveState();
  render();
  toast('Gespeicherter Filter am Schwarzen Brett geladen.');
}

async function deleteSavedBulletinFilter() {
  const saved = ownSavedBulletinFilter();
  if (!saved) {
    toast('Noch kein Filter am Schwarzen Brett gespeichert.');
    return;
  }
  state.bulletinFilters = state.bulletinFilters.filter(item => item.id !== saved.id);
  if (isFirebaseMode()) {
    const { db, doc, deleteDoc } = firebaseStoreApi;
    await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.bulletinFilters, saved.id));
  }
  const prefs = currentNotificationPreferences();
  await persistNotificationPreferences({
    ...prefs,
    bulletin: { ...prefs.bulletin, enabled: false },
    keywordRules: prefs.keywordRules.filter(rule => rule.id !== 'legacy_bulletin_filter')
  }, { notify: false });
  saveState();
  render();
  toast('Gespeicherter Filter am Schwarzen Brett gelöscht.');
}

function sortByLocalRelevance(a, b) {
  return relevantScore(b) - relevantScore(a);
}

function addChange(text) {
  state.changelog.unshift({ at: nowIso(), text });
  state.changelog = state.changelog.slice(0, 12);
}

async function writeAuditLog(action, target = {}, detail = '') {
  const payload = {
    id: uid('audit'),
    action,
    targetUid: target.uid || '',
    targetEmail: target.email || '',
    targetLabel: target.label || target.displayName || target.email || '',
    detail,
    actorUid: authState.user?.uid || '',
    actorEmail: authState.user?.email || '',
    actorLabel: profileName(),
    area: state.profile.area || '',
    createdAt: nowIso()
  };
  state.auditLog.unshift(payload);
  state.auditLog = state.auditLog.slice(0, 80);
  if (isFirebaseMode() && isAdminRole()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.auditLog, payload.id, payload, false).catch(error => reportBackgroundError('Audit-Log schreiben', error));
  }
  saveState();
}

function stopRealtimeSubscriptions() {
  if (typeof chatsUnsubscribe === 'function') chatsUnsubscribe();
  if (typeof chatMessagesUnsubscribe === 'function') chatMessagesUnsubscribe();
  if (typeof activeChatUnsubscribe === 'function') activeChatUnsubscribe();
  if (typeof contentUnsubscribe === 'function') contentUnsubscribe();
  chatsUnsubscribe = null;
  chatMessagesUnsubscribe = null;
  activeChatUnsubscribe = null;
  contentUnsubscribe = null;
}

function updateNavBadges() {
  const chatButton = document.querySelector('[data-route="chats"]');
  if (!chatButton) return;
  const count = unreadChatCount();
  if (count > 0) chatButton.dataset.badge = String(Math.min(count, 99));
  else delete chatButton.dataset.badge;
}

function scopedContentQuery(collectionName, scope = {}) {
  const { db, collection, query, where, orderBy } = firebaseStoreApi;
  const constraints = [];
  if (scope.status) constraints.push(where('status', '==', scope.status));
  if (scope.cantonCode) constraints.push(where('cantonCode', '==', scope.cantonCode));
  else if (scope.areaKey) constraints.push(where('areaKey', '==', scope.areaKey));
  constraints.push(orderBy('createdAt', 'desc'));
  return query(collection(db, collectionName), ...constraints);
}

function ownContentQuery(collectionName, uidValue) {
  const { db, collection, query, where, orderBy } = firebaseStoreApi;
  return query(collection(db, collectionName), where('uid', '==', uidValue), orderBy('createdAt', 'desc'));
}

function refreshContentRoute() {
  saveState();
  if (document.querySelector('.modal-backdrop')) return;
  if (['home', 'bulletin', 'alarme', 'profile'].includes(state.route)) scheduleRender();
}

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  const frame = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 16));
  frame(() => {
    renderQueued = false;
    render();
  });
}

function startScopedContentRealtime(expectedUid = authState.user?.uid) {
  if (!isFirebaseMode() || !expectedUid || !firebaseStoreApi?.onSnapshot || isAccountPendingApproval()) return;
  if (typeof contentUnsubscribe === 'function') contentUnsubscribe();
  const { onSnapshot } = firebaseStoreApi;
  const admin = isAdminRole();
  const scope = admin ? {} : { cantonCode: currentCantonCode(), areaKey: currentAreaKey() };
  if (!admin && !scope.cantonCode && !scope.areaKey) return;
  const unsubscribers = [];

  if (admin) {
    unsubscribers.push(onSnapshot(
      scopedContentQuery(FIRESTORE_COLLECTIONS.requests, scope),
      snapshot => {
        if (authState.user?.uid !== expectedUid) return;
        state.requests = mapFirestoreDocs(snapshot).map(normalizeRequestDoc);
        refreshContentRoute();
      },
      error => reportBackgroundError('Anliegen live laden', error, { notify: false, fallback: 'Lokale Anliegen konnten nicht live geladen werden.', collection: FIRESTORE_COLLECTIONS.requests })
    ));
  } else {
    unsubscribers.push(onSnapshot(
      scopedContentQuery(FIRESTORE_COLLECTIONS.requests, { ...scope, status: 'offen' }),
      snapshot => {
        if (authState.user?.uid !== expectedUid) return;
        const ownExisting = state.requests.filter(item => requestOwnerUid(item) === expectedUid && item.status !== 'offen');
        state.requests = mergeById([...mapFirestoreDocs(snapshot).map(normalizeRequestDoc), ...ownExisting]);
        refreshContentRoute();
      },
      error => reportBackgroundError('Anliegen live laden', error, { notify: false, fallback: 'Lokale Anliegen konnten nicht live geladen werden.', collection: FIRESTORE_COLLECTIONS.requests })
    ));
    unsubscribers.push(onSnapshot(
      ownContentQuery(FIRESTORE_COLLECTIONS.requests, expectedUid),
      snapshot => {
        if (authState.user?.uid !== expectedUid) return;
        const publicExisting = state.requests.filter(item => requestOwnerUid(item) !== expectedUid);
        state.requests = mergeById([...publicExisting, ...mapFirestoreDocs(snapshot).map(normalizeRequestDoc)]);
        refreshContentRoute();
      },
      error => reportBackgroundError('Eigene Anliegen live laden', error, { notify: false, fallback: 'Eigene Anliegen konnten nicht live geladen werden.', collection: FIRESTORE_COLLECTIONS.requests })
    ));
  }

  unsubscribers.push(onSnapshot(
    scopedContentQuery(FIRESTORE_COLLECTIONS.alerts, scope),
    snapshot => {
      if (authState.user?.uid !== expectedUid) return;
      state.alerts = mapFirestoreDocs(snapshot).map(normalizeAlertDoc);
      pruneExpired();
      refreshContentRoute();
    },
    error => reportBackgroundError('Alarme live laden', error, { notify: false, fallback: 'Lokale Alarme konnten nicht live geladen werden.', collection: FIRESTORE_COLLECTIONS.alerts })
  ));

  unsubscribers.push(onSnapshot(
    scopedContentQuery(FIRESTORE_COLLECTIONS.officialNotices, admin ? scope : { ...scope, status: 'online' }),
    snapshot => {
      if (authState.user?.uid !== expectedUid) return;
      state.officialNotices = mapFirestoreDocs(snapshot).map(normalizeOfficialNoticeDoc);
      refreshContentRoute();
    },
    error => reportBackgroundError('Gemeinde-Hinweise live laden', error, { notify: false, fallback: 'Offizielle Hinweise konnten nicht live geladen werden.', collection: FIRESTORE_COLLECTIONS.officialNotices })
  ));

  contentUnsubscribe = () => unsubscribers.forEach(unsubscribe => {
    if (typeof unsubscribe === 'function') unsubscribe();
  });
}

function startUserChatRealtime(expectedUid = authState.user?.uid) {
  if (!isFirebaseMode() || !expectedUid || !firebaseStoreApi?.onSnapshot || isAccountPendingApproval()) return;
  if (typeof chatsUnsubscribe === 'function') chatsUnsubscribe();
  if (typeof chatMessagesUnsubscribe === 'function') chatMessagesUnsubscribe();
  const { db, collection, query, where, orderBy, onSnapshot } = firebaseStoreApi;
  const chatUnsubscribers = [];

  function mergeRealtimeChats(snapshot) {
    if (authState.user?.uid !== expectedUid) return;
    const remoteChats = mapFirestoreDocs(snapshot).map(normalizeChatDoc);
    const remoteIds = new Set(remoteChats.map(chat => chat.id));
    const messageBackedChats = state.chats.filter(chat => !remoteIds.has(chat.id));
    state.chats = [...remoteChats, ...messageBackedChats]
      .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
    saveState();
    updateNavBadges();
    if (!document.querySelector('.modal-backdrop')) scheduleRender();
  }

  const participantChatQuery = query(
    collection(db, FIRESTORE_COLLECTIONS.chats),
    where('participants', 'array-contains', expectedUid),
    orderBy('lastMessageAt', 'desc')
  );
  chatUnsubscribers.push(onSnapshot(participantChatQuery, mergeRealtimeChats, error => reportBackgroundError('Chatliste live laden', error, { notify: false, fallback: 'Private Chats konnten nicht live geladen werden.', collection: FIRESTORE_COLLECTIONS.chats })));
  chatsUnsubscribe = () => chatUnsubscribers.forEach(unsubscribe => {
    if (typeof unsubscribe === 'function') unsubscribe();
  });
  chatMessagesUnsubscribe = null;
}

// ─── Quartinaut 2.1: Gemeindeleben, Aktivitäten und vertrauenswürdige Bewertungen ───
// Neue Daten werden ausschliesslich von geprüften Cloud Functions geschrieben.
const communityBackend = { eventsReady:false, reviewsReady:false, error:'' };
const INBOX_READ_KEY = 'quartinaut-community-inbox-read-v1:';
function communityReadKey() { return INBOX_READ_KEY + String(authState.user?.uid || 'guest'); }
function getInboxReads() {
  try { return JSON.parse(localStorage.getItem(communityReadKey()) || '{}') || {}; } catch {return {};}
}
function readInboxItem(key) {
  if (!authState.user || !key) return;
  const reads = getInboxReads(); reads[String(key)] = nowIso();
  try {localStorage.setItem(communityReadKey(),JSON.stringify(reads));} catch {}
}
function isInboxItemRead(key) {
  const entry = inboxEntries().find(item => item.key === key);
  if (entry && v47Sync) return v47Sync.isRead(entry);
  // Legacy local state is displayed only in offline/local mode; no unchecked
  // earlier read marker may suppress a new content version in Firebase mode.
  return !isFirebaseMode() && Boolean(getInboxReads()[key]);
}
function communityDate(value) {
  try {return new Intl.DateTimeFormat('de-CH',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Zurich'}).format(new Date(value));}
  catch {return 'Datum nicht verfügbar';}
}
async function callQuartinaut(name, payload = {}) {
  if (!isFirebaseMode() || !firebaseFunctionsApi?.httpsCallable || !firebaseFunctionsApi?.functions) throw new Error('Firebase-Verbindung ist nicht bereit.');
  const fn = firebaseFunctionsApi.httpsCallable(firebaseFunctionsApi.functions, name);
  const result = await fn(payload);
  return result?.data || {};
}
async function loadCommunityFeatures() {
  if (!authState.user) return;
  const expectedUid = authState.user.uid, expectedEpoch = accountEpoch;
  if (!isFirebaseMode()) {
    communityBackend.error = 'Veranstaltungen und Bewertungen benötigen Firebase.';
    communityBackend.eventsReady = false; communityBackend.reviewsReady = false;
    render(); return;
  }
  const authorUids=[...new Set((state.requests||[]).map(req=>req.uid||req.authorId).filter(Boolean))].slice(0,30);
  const [eventsResult, trustResult, publicResult] = await Promise.allSettled([
    callQuartinaut('quartinautEvents',{action:'list'}),
    callQuartinaut('quartinautReviews',{action:'mine'}),
    callQuartinaut('quartinautReviews',{action:'summaries',uids:authorUids})
  ]);
  if (!currentAccountEpoch(expectedUid, expectedEpoch)) return;
  state.publicTrust=publicResult.status==='fulfilled' ? (publicResult.value?.summaries||{}) : {};
  if (eventsResult.status === 'fulfilled') {
    state.communityEvents = Array.isArray(eventsResult.value?.events) ? eventsResult.value.events.slice(0,160) : [];
    communityBackend.eventsReady = true;
  } else {
    state.communityEvents=[];
    communityBackend.eventsReady=false;
  }
  if (trustResult.status === 'fulfilled') {
    state.communityTrust={count:Number(trustResult.value?.summary?.count||0),average:Number(trustResult.value?.summary?.average||0)};
    state.eligibleReviews=Array.isArray(trustResult.value?.eligible) ? trustResult.value.eligible.slice(0,20) : [];
    communityBackend.reviewsReady=true;
  } else {
    state.eligibleReviews=[];
    communityBackend.reviewsReady=false;
  }
  communityBackend.error=communityBackend.eventsReady&&communityBackend.reviewsReady?'':
    'Einige neuen Funktionen benötigen die Quartinaut-2.1-Cloud-Functions. Bestehende Chats und Beiträge bleiben verfügbar.';
  saveState();
  if(authState.user) render();
}
function localCommunityEvents() {
  const areaKey=currentAreaKey(), canton=currentCantonCode(), own=authState.user?.uid;
  return (state.communityEvents||[]).filter(e => e &&
    (e.uid===own || e.status==='published' && (e.areaKey===areaKey || e.cantonCode===canton)));
}
function upcomingCommunityEvents() {
  return localCommunityEvents().filter(e=>e.status==='published' && Date.parse(e.endsAt||e.startsAt)>=Date.now()-3600000)
    .sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt));
}
function renderMyQuartierPanel() {
  const events=upcomingCommunityEvents();
  const requests=(state.requests||[]).filter(r=>r.status==='offen' && r.areaKey===currentAreaKey());
  return `<section class="v21-quartier-panel v461-quartier-panel" aria-label="Mein Quartier">
    <div class="v2-section-heading"><div><span class="v2-kicker">Aus deiner Umgebung</span><h2>Mein Quartier</h2></div></div>
    <div class="v21-summary-grid v461-summary-grid">
      <button data-community-route="bulletin" class="v21-summary-tile"><strong>${requests.length}</strong><span>Offene Anliegen</span></button>
      <button data-community-route="events" class="v21-summary-tile"><strong>${events.length}</strong><span>Kommende Anlässe</span></button>
    </div>
    ${events.length ? `<p class="v461-next-event"><strong>Nächster Anlass:</strong> ${escapeHtml(events[0].title)} <small>${communityDate(events[0].startsAt)}</small></p>` : ''}
  </section>`;
}

function inboxEntries() {
  const items=[];
  for(const chat of (state.chats||[]).filter(c=>isChatVisibleForUser(c)&&chatHasUnread(c))) {
    items.push({key:'chat:'+chat.id,type:'chat',title:'Neue Nachricht von '+chatPeerLabel(chat),detail:chat.requestTitle||'Privates Gespräch',at:chat.lastMessageAt,route:'chats'});
  }
  for(const alert of visibleAlerts().filter(a=>!hasSeenAlert(a.id))) {
    items.push({key:'alert:'+alert.id,title:'Gemeinde-Alarm: '+(alert.title||'Wichtige Meldung'),detail:String(alert.text||'').slice(0,160),at:alert.createdAt,route:'alarme'});
  }
  for(const notice of (state.officialNotices||[]).filter(n=>n.status==='online')) {
    items.push({key:'notice:'+notice.id,title:'Gemeindemitteilung: '+notice.title,detail:String(notice.text||'').slice(0,150),at:notice.createdAt,route:'home'});
  }
  for(const e of localCommunityEvents().filter(e=> e.status==='published' && Date.parse(e.startsAt)>Date.now()-86400000*2)) {
    items.push({key:'event:'+e.id,title:'Veranstaltung: '+e.title,detail:communityDate(e.startsAt)+' · '+(e.venue||e.area||''),at:e.createdAt||e.startsAt,route:'events'});
  }
  for(const req of ownRequests().filter(r=>['wartet_freigabe','abgelehnt','erledigt'].includes(r.status))) {
    items.push({key:'request:'+req.id+':'+req.status,title:'Dein Anliegen: '+(req.title||'Ohne Titel'),detail:requestStatusLabel(req.status),at:req.updatedAt||req.createdAt,route:'home'});
  }
  // Only known, already authorised hub entries. No cross-user message queries.
  for(const thread of hubState.threads||[]){
    if(!thread?.id)continue;
    items.push({key:'hubmsg:'+thread.id,type:'reservation',title:'Quartier+-Anfrage: '+(thread.itemTitle||'Nachricht'),detail:String(thread.lastMessage||'').slice(0,150),at:thread.updatedAt||thread.lastMessageAt,route:'hub'});
  }
  for(const item of hubState.items||[]){
    if(item?.kind!=='lend'||item.ownerUid!==authState.user?.uid||!['reserved','borrowed'].includes(item.availability))continue;
    items.push({key:'loan:'+item.id+':'+item.availability,type:'reservation',title:item.availability==='reserved'?'Leihbörse: Reservierung':'Leihbörse: ausgeliehen',detail:String(item.title||'').slice(0,100),at:item.updatedAt||item.createdAt,route:'hub'});
  }
  return items.sort((a,b)=>Date.parse(b.at||0)-Date.parse(a.at||0)).slice(0,100);
}
function isUnreadCommunityEntry(item) {
  if(item.key.startsWith('chat:') || item.key.startsWith('alert:')) return true;
  return v47Sync ? !v47Sync.isRead(item) : !isInboxItemRead(item.key);
}
function inboxUnreadCount() {return inboxEntries().filter(isUnreadCommunityEntry).length;}
async function openInboxItem(key, route) {
  const item = inboxEntries().find(x => x.key === key);
  if (!item) {toast('Die Mitteilung ist nicht mehr verfügbar.');return;}
  const [prefix, id] = key.split(':');
  // Chat read receipts and explicit alarm acknowledgements remain untouched.
  if(prefix === 'alert') {setRoute('alarme');return;}
  if(prefix === 'chat') {
    if(isFirebaseMode()) await syncStateFromFirestore();
    const chat=state.chats.find(x=>x.id===id);
    if(!chat)throw new Error('Chat gelöscht oder kein Zugriff mehr.');
    chatModalForChat(await ensureChatDocument(chat));return;
  }
  if(prefix === 'hubmsg') {await openHubThread(id); /* Existing thread receipts remain authoritative until the source collection is verified. */ return;}
  const kind = prefix === 'loan' ? 'hub' : prefix;
  if(!isFirebaseMode()) {setRoute(route||'home');readInboxItem(key);return;}
  const expectedUid=authState.user?.uid, expectedEpoch=accountEpoch;
  await v47OpenTarget(kind,id);
  if(!currentAccountEpoch(expectedUid,expectedEpoch))return;
  v47Sync?.markRead(item);
  render();
}
function renderInbox() {
  const all=inboxEntries();const kind=v46InboxFilter();const items=all.filter(x=>kind==='all'||(kind==='unread'&&isUnreadCommunityEntry(x))||(kind==='chat'&&x.key.startsWith('chat:'))||(kind==='alert'&&x.key.startsWith('alert:'))||(kind==='reservation'&&(x.key.startsWith('hubmsg:')||x.key.startsWith('loan:')))||(kind==='other'&&!/^(chat|alert|hubmsg|loan):/.test(x.key)));
  return `<section class="v2-page-header"><span class="v2-kicker">Alles im Blick</span><h1>Mitteilungen</h1>
    <p>Private Nachrichten, Gemeindeinformationen und neue Veranstaltungen an einem Ort.</p>
    <button class="secondary-button small" data-community-action="reload">Jetzt aktualisieren</button></section>
    <nav class="v46-filters" aria-label="Mitteilungen filtern">${[['all','Alle'],['unread','Ungelesen'],['chat','Chats'],['alert','Alarme'],['reservation','Ausleihen'],['other','Weitere']].map(([id,label])=>`<button type="button" data-v46-inbox="${id}" class="${kind===id?'active':''}" aria-pressed="${kind===id}">${label}</button>`).join('')}</nav>
    <p class="v46-muted">${all.filter(isUnreadCommunityEntry).length} ungelesene Einträge · Gelesen erst nach erfolgreichem Öffnen</p>
    <section class="v21-inbox-list">${items.length?items.map(item=>`<article class="card v21-inbox-entry ${isUnreadCommunityEntry(item)?'v21-unread':''}">
      <div><h3>${escapeHtml(item.title||'Mitteilung')}</h3><small>${communityDate(item.at)}</small><p>${escapeHtml(item.detail||'')}</p></div>
      <div class="row-actions"><button class="secondary-button small" data-community-action="open-inbox" data-key="${escapeHtml(item.key)}" data-route="${escapeHtml(item.route)}">Öffnen</button>
      </div>
    </article>`).join(''):'<div class="empty">Noch keine neuen Mitteilungen.</div>'}</section>`;
}
function communityEventCard(e) {
  const own=e.uid===authState.user?.uid;
  const isPending=e.status==='pending', canDecide=isAdminRole() && isPending;
  return `<article class="card v21-event-card"><div class="badges"><span class="badge">${escapeHtml(e.category||'Quartier')}</span>
   ${own&&e.status!=='published'?`<span class="badge warn">${escapeHtml(e.status==='pending'?'Wartet auf Freigabe':e.status)}</span>`:''}
   </div><h3>${escapeHtml(e.title)}</h3><p class="v21-event-time">${communityDate(e.startsAt)}</p>
   <p>${escapeHtml(e.description||'')}</p><p class="v2-caption">📍 ${escapeHtml(e.venue||e.area||'Gemeinde')}</p>
   ${canDecide?`<div class="row-actions"><button class="secondary-button small" data-community-action="review-event" data-id="${escapeHtml(e.id)}" data-decision="approve">Freigeben</button>
   <button class="ghost-button small" data-community-action="review-event" data-id="${escapeHtml(e.id)}" data-decision="reject">Ablehnen</button></div>`:''}
  </article>`;
}
function renderCommunityEvents() {
  const own=authState.user?.uid,upcoming=upcomingCommunityEvents();
  const submitted=localCommunityEvents().filter(e=>e.uid===own&&e.status!=='published');
  const pending=isAdminRole()? (state.communityEvents||[]).filter(e=>e.status==='pending') : [];
  return `<section class="v2-page-header"><span class="v2-kicker">Gemeinsam unterwegs</span><h1>Veranstaltungen</h1>
    <p>Vereine, Nachbarn und Gemeinden teilen Anlässe aus deiner Umgebung. Neue Einträge werden vor der Veröffentlichung geprüft.</p>
    <div class="row-actions"><button class="primary-button" data-community-action="new-event" ${communityBackend.eventsReady?'':'disabled'}>+ Veranstaltung einreichen</button>
    <button class="ghost-button small" data-community-action="reload">Aktualisieren</button></div>
    ${!communityBackend.eventsReady?`<p class="form-error">${escapeHtml(communityBackend.error||'Die Veranstaltungsverwaltung wird noch eingerichtet.')}</p>`:''}</section>
    <section class="v21-event-section"><h2>Demnächst in deiner Nähe</h2><div class="v21-event-grid">${upcoming.length?upcoming.map(communityEventCard).join(''):'<div class="empty">Aktuell keine veröffentlichten Anlässe vorhanden.</div>'}</div></section>
    ${submitted.length?`<section class="v21-event-section"><h2>Meine Einreichungen</h2><div class="v21-event-grid">${submitted.map(communityEventCard).join('')}</div></section>`:''}
    ${pending.length?`<section class="v21-event-section"><h2>Veranstaltungen freigeben (${pending.length})</h2><div class="v21-event-grid">${pending.map(communityEventCard).join('')}</div></section>`:''}`;
}
function openCommunityEventModal() {
  if(!communityBackend.eventsReady) {toast('Veranstaltungen werden nach der Backend-Einrichtung freigeschaltet.');return;}
  openModal('Veranstaltung vorschlagen',`<form class="form-grid" id="v21EventForm">
    <p class="help">Für öffentliche Anlässe im Quartier. Bitte keine privaten Telefonnummern oder Adressen von Dritten veröffentlichen.</p>
    <label>Titel<input name="title" minlength="5" maxlength="100" required placeholder="z. B. Quartierflohmarkt"></label>
    <label>Kategorie<select name="category"><option>Nachbarschaft</option><option>Verein</option><option>Kultur</option><option>Sport</option><option>Gemeinde</option><option>Familie</option></select></label>
    <label>Datum und Beginn<input type="datetime-local" name="startsLocal" required></label>
    <label>Ende (optional)<input type="datetime-local" name="endsLocal"></label>
    <label>Treffpunkt / Veranstaltungsort<input name="venue" maxlength="120" required placeholder="Öffentlicher Ort oder Treffpunkt"></label>
    <label>Beschreibung<textarea name="description" maxlength="600" minlength="15" required placeholder="Was erwartet die Besucherinnen und Besucher?"></textarea></label>
    <p class="help">Der Eintrag wird zuerst geprüft. Deine Gemeinde wird automatisch aus deinem Profil übernommen.</p>
    <button class="primary-button" type="submit">Zur Freigabe einreichen</button>
  </form>`,(modal,close)=>{
    modal.querySelector('#v21EventForm')?.addEventListener('submit',event=>{
      event.preventDefault(); const form=event.currentTarget; const button=form.querySelector('button[type=submit]');button.disabled=true;
      const data=Object.fromEntries(new FormData(form).entries());
      runAsyncAction(async()=>{
        try {await callQuartinaut('quartinautEvents',{action:'create',event:data});close();await loadCommunityFeatures();setRoute('events');toast('Veranstaltung wurde zur Prüfung eingereicht.');}
        finally {button.disabled=false;}
      });
    });
  });
}
async function decideCommunityEvent(id,decision) {
  if(!isAdminRole()) throw new Error('Die Freigabe benötigt einen Admin-Claim.');
  if(!['approve','reject'].includes(decision))return;
  await callQuartinaut('quartinautEvents',{action:'decide',id,decision});
  await loadCommunityFeatures();toast(decision==='approve'?'Veranstaltung freigegeben.':'Veranstaltung abgelehnt.');
}
function renderCommunityTrustPanel() {
  const stats=state.communityTrust||{count:0,average:0},eligible=(state.eligibleReviews||[]);
  return `<section class="card v21-trust-card"><div class="v2-section-heading"><div><span class="v2-kicker">Vertrauen im Quartier</span><h2>Mein Vertrauensprofil</h2></div>${trustBadge(state.profile,{detail:true})}</div>
    <p>Die bisherige Identitätsprüfung bleibt unverändert. Freiwillige Bewertungen sind nur nach einer tatsächlich abgeschlossenen Hilfe möglich.</p>
    <div class="v21-trust-stats"><div><strong>${stats.count>0?`${Number(stats.average||0).toFixed(1)} / 5`:'–'}</strong><small>${stats.count} geprüfte Bewertung(en)</small></div>
      <div><strong>${ownRequests().filter(req=>req.status==='erledigt').length}</strong><small>Eigene erledigte Anliegen</small></div></div>
    ${eligible.length ? `<h3>Abgeschlossene Hilfen bewerten</h3><div class="v21-review-list">${eligible.map(item=>`<div class="v21-review-row"><div><strong>${escapeHtml(item.title||'Nachbarschaftshilfe')}</strong><small>${escapeHtml(item.peerName||'Andere Person')}</small></div><button class="secondary-button small" data-community-action="review-help" data-id="${escapeHtml(item.chatId)}">Bewerten</button></div>`).join('')}</div>` : '<p class="v2-caption">Zurzeit keine abgeschlossene Hilfe zur Bewertung vorhanden.</p>'}
    ${!communityBackend.reviewsReady?`<p class="form-error">${escapeHtml(communityBackend.error||'Bewertungen werden noch eingerichtet.')}</p>`:''}
    <p class="v2-caption">Bewertungen sind keine Identitätsprüfung. Persönliche Daten werden nicht im Bewertungstext benötigt.</p>
  </section>`;
}
function openCommunityReviewModal(chatId) {
  const target=(state.eligibleReviews||[]).find(item=>item.chatId===chatId);
  if(!target) {toast('Diese Hilfe kann aktuell nicht bewertet werden.');return;}
  openModal('Abgeschlossene Hilfe bewerten',`<form class="form-grid" id="v21ReviewForm">
    <p><strong>${escapeHtml(target.title||'Nachbarschaftshilfe')}</strong> · ${escapeHtml(target.peerName||'Andere Person')}</p>
    <label>Wie war deine Erfahrung?<select name="rating" required><option value="">Bewertung wählen</option><option value="5">★★★★★ – Sehr gut</option><option value="4">★★★★☆ – Gut</option><option value="3">★★★☆☆ – In Ordnung</option><option value="2">★★☆☆☆ – Verbesserungswürdig</option><option value="1">★☆☆☆☆ – Schlecht</option></select></label>
    <label>Kommentar (freiwillig)<textarea maxlength="240" name="comment" placeholder="Ohne Telefonnummern oder andere persönliche Daten"></textarea></label>
    <p class="help">Pro abgeschlossenem Gespräch ist eine Bewertung möglich. Nach dem Absenden kann sie nicht mehr verändert werden.</p>
    <button type="submit" class="primary-button">Bewertung abgeben</button></form>`,(modal,close)=>{
      modal.querySelector('#v21ReviewForm')?.addEventListener('submit',event=>{
        event.preventDefault(); const form=event.currentTarget;const button=form.querySelector('button[type=submit]');button.disabled=true;
        const data=Object.fromEntries(new FormData(form).entries());
        runAsyncAction(async()=>{try{
          await callQuartinaut('quartinautReviews',{action:'submit',chatId,rating:Number(data.rating),comment:String(data.comment||'')});
          close();await loadCommunityFeatures();toast('Danke! Deine Bewertung wurde gespeichert.');
        }finally {button.disabled=false;}});
      });
    });
}
// ─── Ende Quartinaut 2.1 ───

// ─── Quartinaut 3.0: zwölf Zusatzangebote im neuen «Quartier+»-Bereich ───
const hubState={items:[],joins:[],threads:[],rsvps:[],eventRows:[],settings:null,stats:null,loaded:false,loading:false,error:'',section:'all',search:'',activeThread:'',messages:[]};
const HUB_KINDS=new Set(['lend','market','lost','group','issue','calendar','project']);
const hubLabel=id=>HUB_MODULES.find(x=>x.id===id)?.title||id;
function hubSettings(){
  return hubState.settings||{homeView:loadHome(authState.user?.uid),topics:['chats','alerts','help'],digest:'off',quietHours:false};
}
function hubHomeSelector({ compact = false } = {}){
 const value=loadHome(authState.user?.uid);
 return `<section class="v3-home-settings card">${compact ? '' : `<div><strong>Meine Startseite</strong><p class="v3-subtext">Wähle, welchen Bereich du nach der Anmeldung zuerst sehen möchtest.</p></div>`}
   <label for="v3HomeSelect">Startansicht wählen</label><select id="v3HomeSelect" data-v3-home>${HOME_OPTIONS.map(o=>`<option value="${o.value}" ${value===o.value?'selected':''}>${escapeHtml(o.title)}</option>`).join('')}</select>
   <p class="v3-subtext">Die Auswahl wird auf diesem Gerät sofort übernommen und nach Möglichkeit mit deinem Profil synchronisiert.</p></section>`;
}
function hubBottomTile(){
  return `<section class="v461-hub-cta" aria-label="Weitere Quartierfunktionen">
    <div><strong>Noch mehr in Quartier+</strong><p>Fundbüro, Gemeindeangebote und weitere Möglichkeiten entdecken.</p></div>
    <button class="secondary-button small" type="button" data-v3-open="all">Alle Funktionen <span aria-hidden="true">→</span></button>
  </section>`;
}

async function loadHub(force=false){
 if(!authState.user||hubState.loading)return;
 if(hubState.loaded&&!force)return;
 hubState.loading=true;hubState.error='';
 const expectedUid=authState.user.uid, expectedEpoch=accountEpoch;
 if(state.route==='hub')render();
 const results=await Promise.allSettled([
  callQuartinaut('quartinautHub',{action:'list'}),
  callQuartinaut('quartinautHub',{action:'members.mine'}),
  callQuartinaut('quartinautHub',{action:'messages.list'}),
  callQuartinaut('quartinautHub',{action:'settings.get'}),
  callQuartinaut('quartinautEventPlus',{action:'mine'})
 ]);
 if(!currentAccountEpoch(expectedUid,expectedEpoch))return;
 const result=(n,fallback)=>results[n].status==='fulfilled'?results[n].value:fallback;
 hubState.items=result(0,{items:[]}).items||[];
 hubState.joins=result(1,{ids:[]}).ids||[];
 hubState.threads=result(2,{threads:[]}).threads||[];
 hubState.settings=result(3,{settings:null}).settings||hubSettings();
 hubState.rsvps=result(4,{ids:[]}).ids||[];
 if(results[3].status==='fulfilled'&&results[3].value.configured===true&&hubState.settings.homeView){
   saveHome(expectedUid,hubState.settings.homeView);
 }else{
   // Kein Cloud-Profil vorhanden: die bereits lokal gewählte Startseite behalten.
   hubState.settings={...hubState.settings,homeView:loadHome(expectedUid)};
 }
 hubState.error=results[0].status==='rejected' ? 'Quartier+ benötigt die neuen Cloud Functions. Die übrigen Funktionen bleiben erhalten.' : '';
 hubState.loaded=results[0].status==='fulfilled';hubState.loading=false;
 if(['hub','profile','search','map','saved'].includes(state.route))render();
}
async function hubAction(action,payload={},success='Gespeichert.'){
 const result=await callQuartinaut('quartinautHub',{action,...payload});
 hubState.loaded=false;await loadHub(true);toast(success);return result;
}
function hubSectionButton(module){return `<button type="button" data-v3-open="${escapeHtml(module.id)}" class="v3-hub-module"><span class="v3-hub-symbol" aria-hidden="true">${module.icon}</span><strong>${escapeHtml(module.title)}</strong><small>${escapeHtml(module.description)}</small><span class="v3-hub-arrow" aria-hidden="true">→</span></button>`;}
function hubItemCard(item){
 const isMine=item.ownerUid===authState.user?.uid,joined=hubState.joins.includes(item.id);
 const isOwnerOrModerator=isMine||item.isModerator;
 const status=item.status==='published'?'Aktiv':item.status==='pending'?'Wartet auf Freigabe':item.status==='submitted'?'Eingereicht':item.status;
 const price=(item.priceChf!==null && item.priceChf!==undefined && ['lend','market'].includes(item.kind))?` · CHF ${Number(item.priceChf).toFixed(2)}`:'';
 let actions='';
 if(item.status==='published'){
  if(['group','project'].includes(item.kind)&&!isMine) actions+=`<button class="secondary-button small" data-v3-item-action="${joined?'leave':'join'}" data-id="${escapeHtml(item.id)}">${joined?'Teilnahme beenden':'Mitmachen'}</button>`;
  if(['market','lost','lend'].includes(item.kind)&&!isMine){
   if(item.availability==='available')actions+=`<button class="secondary-button small" data-v3-item-action="reserve" data-id="${escapeHtml(item.id)}">${item.kind==='lend'?'Ausleihe anfragen':'Reservieren'}</button>`;
   else if(item.reservedByMe&&item.availability==='reserved')actions+=`<button class="ghost-button small" data-v3-item-action="release" data-id="${escapeHtml(item.id)}">Reservierung lösen</button>`;
  }
  if(item.kind==='group'&&(isMine||joined))actions+=`<button class="ghost-button small" data-v3-group="${escapeHtml(item.id)}">Gruppenbeiträge</button>`;
  if(isMine&&['market','lost'].includes(item.kind)&&item.availability!=='completed')actions+=`<button class="ghost-button small" data-v3-item-action="complete" data-id="${escapeHtml(item.id)}">Als erledigt markieren</button>`;
  if(!isMine&&item.kind!=='calendar')actions+=`<button class="ghost-button small" data-v3-contact="${escapeHtml(item.id)}">Nachricht</button>`;
  if(item.kind==='group')actions+=`<button class="ghost-button small" type="button" data-v46-group-profile="${escapeHtml(item.id)}">Vereinsprofil</button>`;
  if(item.status==='published' && item.kind!=='issue')actions+=`<button class="ghost-button small" type="button" data-v46-hide-post="hub" data-id="${escapeHtml(item.id)}">Nur bei mir ausblenden</button>`;
  if(item.kind==='group'&&item.status==='published')actions+=`<button class="ghost-button small" type="button" data-v46-fav="groups" data-value="${escapeHtml(item.id)}">${v46Favorites().groups.includes(item.id)?'★ Verein gemerkt':'☆ Verein merken'}</button>`;
  if(item.kind==='lend')actions+=`<button class="ghost-button small" type="button" data-v46-loan-reminder="${escapeHtml(item.id)}">Übergabe & Rückgabe im Kalender</button>`;
  if(isMine&&item.kind==='lend'&&item.availability==='reserved')actions+=`<button class="secondary-button small" data-v3-item-action="received" data-id="${escapeHtml(item.id)}">Übergabe bestätigen</button>`;
  if(isMine&&item.kind==='lend'&&item.availability==='borrowed')actions+=`<button class="secondary-button small" data-v3-item-action="returned" data-id="${escapeHtml(item.id)}">Rückgabe bestätigen</button>`;
  if(['calendar','project'].includes(item.kind)&&item.startsAt)actions+=`<button class="ghost-button small" data-v3-calendar="${escapeHtml(item.id)}">In Kalender übernehmen</button>`;
 }
 if(item.isModerator&&item.status==='pending') actions+=`<button class="secondary-button small" data-v3-item-action="approve" data-id="${escapeHtml(item.id)}">Freigeben</button><button class="ghost-button small" data-v3-item-action="reject" data-id="${escapeHtml(item.id)}">Ablehnen</button>`;
 if(item.kind==='issue'&&item.isModerator&&item.status!=='resolved') actions+=`<button class="secondary-button small" data-v3-item-action="issue.status" data-id="${escapeHtml(item.id)}" data-status="${item.status==='submitted'?'in_review':'resolved'}">${item.status==='submitted'?'In Bearbeitung':'Als erledigt markieren'}</button>`;
 return `<article class="v3-listing-card v44-post" data-hub-post-id="${escapeHtml(item.id)}">
 ${v44PostHead(isMine?profileName():'Quartiermitglied',item.area,communityDate(item.createdAt),hubLabel(item.kind))}
 <div class="v44-post-body"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></div>
 ${postPhotoGallery(item.photoPaths)}
 <div class="v44-post-meta"><span>${escapeHtml(item.category)}</span><span class="badge ${item.status==='published'?'offer':'warn'}">${escapeHtml(status)}</span>${price?`<span>${escapeHtml(price.replace(/^ · /,''))}</span>`:''}</div>
 ${item.status==='published'&&item.kind!=='issue'?v44FeedActions('hub',item.id):''}
 <div class="v44-post-contact">${actions?`<div class="row-actions">${actions}</div>`:''}
 ${(item.kind==='lend'||item.kind==='group'||item.adminNote)?`<details class="v44-more"><summary>Weitere Informationen</summary>
 ${item.kind==='lend'?`<p class="v3-meta">Verfügbarkeit: ${escapeHtml(({available:'Verfügbar',reserved:'Reserviert',borrowed:'Ausgeliehen'})[item.availability]||item.availability)}</p>`:''}
 ${['project','group'].includes(item.kind)?`<p class="v3-meta">${item.memberCount||0} Teilnehmende${item.capacity?' / '+item.capacity+' Plätze':''}</p>`:''}
 ${item.adminNote&&item.isMine?`<p class="v3-meta">Verwaltung: ${escapeHtml(item.adminNote)}</p>`:''}
 </details>`:''}</div></article>`;
}
function hubList(kind){
 const items=filterFeed(hubState.items.filter(item=>!v46IsHidden('hub',item.id)&&item.kind===kind && (!hubState.search || [item.title,item.description,item.category].join(' ').toLocaleLowerCase('de-CH').includes(hubState.search.toLocaleLowerCase('de-CH')))),{kind:v46FeedFilter(),area:state.profile.area,lastSeenAt:v46LastSeenAt(),savedKeys:v46SavedPostKeys()}).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
 const desc={lend:'Leihen statt kaufen – Reservierung und Rückgabe dokumentieren.',market:'Lokaler Verkauf, Tausch oder Verschenken. Keine integrierte Bezahlung.',lost:'Nur ungefähre Fundorte angeben; offizielle Fundstellen bleiben zuständig.',group:'Öffentliche Gruppen und Vereine aus deiner Region.',project:'Nachbarschaftsaktionen organisieren und als Helfer anmelden.',issue:'Meldungen sind nur für dich und berechtigte Gemeinde-Verantwortliche sichtbar.',calendar:'Offizielle Termine werden ausschliesslich von berechtigten Gemeindekonten eingetragen.'};
 const canNew=kind!=='calendar'||state.profile.role==='admin'||(state.profile.role==='area_admin'&&state.profile.accountType==='municipality'&&state.profile.municipalityStatus==='verified');
 return `<div class="v3-hub-content"><div class="v3-hub-content-head"><h2>${escapeHtml(hubLabel(kind))}</h2>${canNew?`<button class="primary-button small" data-v3-create="${kind}" ${hubState.loaded?'':'disabled'}>+ Eintrag erstellen</button>`:''}</div>
 <p class="v3-subtext">${desc[kind]}</p>
 <form class="v3-search-form" data-v3-search><label>Einträge durchsuchen<input type="search" name="q" value="${escapeHtml(hubState.search)}" placeholder="Titel, Kategorie oder Beschreibung"></label><button type="submit" class="secondary-button small">Suchen</button></form>
 ${kind==='issue'?'<p class="v3-safety-note">Nur wenn deine Gemeinde Quartinaut offiziell nutzt, wird eine zuständige Stelle diese Meldung bearbeiten. Ansonsten ist die Meldung lediglich im System hinterlegt.</p>':''}
 <div class="v3-listing-grid">${items.length?items.map(hubItemCard).join(''):'<div class="empty">Hier gibt es noch keine Einträge. Starte mit dem ersten Beitrag.</div>'}</div></div>`;
}
function hubMatch(){
 const prefs=readPreferences(authState.user?.uid);
 const matches=matchingItems(hubState.items,{interests:prefs.categories,areaKey:currentAreaKey(),uid:authState.user?.uid}).slice(0,12);
 const requests=matchHelpRequests(state.requests||[],{uid:authState.user?.uid,categories:prefs.categories,area:state.profile.area}).slice(0,3);
 return `<div class="v3-hub-content"><h2>Passend für dich</h2><p class="v3-subtext">Vorschläge nach Gemeinde und Interessen, ohne automatische Standortverfolgung.</p>
 ${requests.length?`<h3>Nachbarschaftshilfe</h3>${requests.map(req=>`<article class="v3-listing-card"><strong>${escapeHtml(req.title)}</strong><p>${escapeHtml(req.category||'')}</p><button class="secondary-button small" data-route="bulletin">Zum Schwarzen Brett</button></article>`).join('')}`:''}
 <h3>Weitere Quartierangebote</h3><div class="v3-listing-grid">${matches.length?matches.map(hubItemCard).join(''):'<div class="empty">Keine passenden Angebote. Lege Interessen im Profil fest oder prüfe später erneut.</div>'}</div></div>`;
}
function hubDigest(){
 const p=hubSettings(),recent=hubState.items.filter(item=>item.status==='published'&&Date.parse(item.createdAt)>Date.now()-7*86400000);
 const selected=p.topics||[];
 const matched=recent.filter(item=>({lend:'lending',market:'market',calendar:'municipality',group:'groups',project:'groups',lost:'municipality'})[item.kind]===undefined||selected.includes(({lend:'lending',market:'market',calendar:'municipality',group:'groups',project:'groups',lost:'municipality'})[item.kind])).slice(0,12);
 return `<div class="v3-hub-content"><h2>Meine Benachrichtigungen</h2><p class="v3-subtext">Bestimme, was dich interessiert. Die Zusammenfassung ist hier in Quartinaut sichtbar; automatische E-Mail- oder Push-Zustellung muss separat eingerichtet werden.</p>
 <form class="v3-form" id="v3DigestForm"><fieldset><legend>Themen</legend><div class="v3-check-grid">${NOTIFY_TOPICS.map(([id,label])=>`<label><input name="topics" type="checkbox" value="${id}" ${selected.includes(id)?'checked':''}> ${escapeHtml(label)}</label>`).join('')}</div></fieldset>
 <label>Zusammenfassung anzeigen<select name="digest"><option value="off" ${p.digest==='off'?'selected':''}>Keine Übersicht</option><option value="daily" ${p.digest==='daily'?'selected':''}>Tägliche Übersicht</option><option value="weekly" ${p.digest==='weekly'?'selected':''}>Wöchentliche Übersicht</option></select></label>
 <label><input type="checkbox" name="quietHours" ${p.quietHours?'checked':''}> Ruhezeit bevorzugen</label><button class="primary-button" type="submit">Einstellungen speichern</button></form>
 <h3>Neue Inhalte der letzten 7 Tage</h3>${matched.length?`<div class="v3-listing-grid">${matched.slice(0,5).map(hubItemCard).join('')}</div>`:'<p class="empty">Keine neuen Quartierangebote in den gewählten Themen.</p>'}</div>`;
}
function hubRsvp(){
 const events=upcomingCommunityEvents();
 return `<div class="v3-hub-content"><h2>Veranstaltungen & Zusagen</h2><p class="v3-subtext">Veranstaltungen aus Version 2.1 bleiben bestehen. Sage hier für einen Anlass zu oder ab.</p>
 <div class="v3-listing-grid">${events.length?events.map(e=>`<article class="v3-listing-card"><strong>${escapeHtml(e.title)}</strong><p>${communityDate(e.startsAt)} · ${escapeHtml(e.venue)}</p><div class="row-actions"><button class="secondary-button small" data-v3-rsvp="${hubState.rsvps.includes(e.id)?'cancel':'rsvp'}" data-id="${escapeHtml(e.id)}">${hubState.rsvps.includes(e.id)?'Teilnahme absagen':'Teilnahme zusagen'}</button>${e.uid===authState.user.uid?`<button class="ghost-button small" data-v3-capacity="${escapeHtml(e.id)}">Plätze festlegen</button>`:''}</div></article>`).join(''):'<div class="empty">Aktuell keine öffentlichen Anlässe.</div>'}</div><button class="ghost-button" data-route="events">Alle Veranstaltungen</button></div>`;
}
function hubDraft(){return `<div class="v3-hub-content"><h2>Textassistent</h2><p>Beschreibe kurz dein Anliegen. Quartinaut erstellt daraus zunächst lokal einen fertigen Textentwurf.</p>
 <form class="v3-form" id="v3DraftForm"><label>Meine Idee<textarea name="topic" rows="4" minlength="8" maxlength="500" required placeholder="Ich würde gerne meine Bohrmaschine am Wochenende verleihen …"></textarea></label>
 <label>Kategorie<select name="kind"><option value="help">Nachbarschaftshilfe</option><option value="lend">Leihbörse</option><option value="market">Marktplatz</option><option value="group">Verein / Gruppe</option><option value="project">Quartier-Projekt</option></select></label>
 <div class="row-actions"><button class="secondary-button" data-v3-draft="local" type="button">Lokale Vorlage erstellen</button></div>

 <label>Titel<input name="title" maxlength="100"></label><label>Beschreibung<textarea name="description" rows="5" maxlength="1200"></textarea></label><button class="primary-button" data-v3-draft-copy type="button">Text kopieren</button>
 <p class="v3-subtext">Die Textvorlage wird lokal erstellt; es werden keine Texte an KI-Dienste übertragen. Texte werden nie automatisch veröffentlicht.</p></form></div>`;}
function hubCalendar(){
 const rows=hubState.items.filter(i=>i.kind==='calendar'&&i.status==='published').sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt));
 const events=upcomingCommunityEvents();
 return `<div class="v3-hub-content"><h2>Gemeindekalender</h2><p class="v3-subtext">Öffentliche Termine der Gemeinde und Veranstaltungen aus Quartinaut. Erinnerung über den persönlichen Kalender möglich.</p>
 <div class="v3-listing-grid">${rows.map(hubItemCard).join('')}${events.slice(0,12).map(e=>`<article class="v3-listing-card"><strong>${escapeHtml(e.title)}</strong><p>${communityDate(e.startsAt)} · ${escapeHtml(e.venue)}</p><button class="ghost-button small" data-v3-calendar-event="${escapeHtml(e.id)}">In Kalender übernehmen</button></article>`).join('')||'<div class="empty">Noch keine Gemeinde-Termine vorhanden.</div>'}</div></div>`;
}
function hubStats(){
 if(!isAdminRole())return '<div class="v3-hub-content"><h2>Verwaltungs-Dashboard</h2><p class="v3-safety-note">Nur für freigeschaltete Verwaltungsrollen verfügbar. Die Rolle wird auf dem Server geprüft.</p></div>';
 const stat=hubState.stats?.counts;
 return `<div class="v3-hub-content"><h2>Verwaltungs-Dashboard</h2><p class="v3-subtext">Serverseitige Übersicht für deinen zugewiesenen Verwaltungsbereich.</p>
 <button class="secondary-button small" data-v3-stats="reload">Statistik laden</button>${stat?`<div class="v3-stats-grid"><article><strong>${stat.items}</strong><small>Quartier+-Einträge</small></article><article><strong>${stat.users}</strong><small>Konten im Gebiet (bis 500)</small></article></div>
 <h3>Einträge nach Funktion</h3>${Object.entries(stat.kinds||{}).map(([k,v])=>`<p>${escapeHtml(hubLabel(k))}: <strong>${v}</strong></p>`).join('')}${hubState.stats.limited?'<p class="v3-safety-note">Die Übersicht ist bei 500 Dokumenten begrenzt und keine vollständige Gesamtauswertung.</p>':''}`:''}</div>`;
}
function hubThreads(){
 return `<section class="v3-hub-content"><h2>Quartier+-Nachrichten</h2><p class="v3-subtext">Separate private Kontaktanfragen zu Leihbörse, Markt, Gruppen und Projekten.</p>
 ${hubState.threads.length?hubState.threads.map(t=>`<article class="v3-listing-card"><strong>${escapeHtml(t.itemTitle||'Privates Gespräch')}</strong><p>${escapeHtml(t.lastMessage||'')}</p><button class="secondary-button small" data-v3-thread="${escapeHtml(t.id)}">Gespräch öffnen</button></article>`).join(''):'<p class="empty">Noch keine Kontaktanfragen.</p>'}</section>`;
}
function renderQuartierPlus(){
 const section=hubState.section||'all',selected=HUB_MODULES.find(m=>m.id===section);
 const contents={match:hubMatch,digest:hubDigest,rsvp:hubRsvp,draft:hubDraft,calendar:hubCalendar,stats:hubStats};
 let content=selected?(contents[section]?.()||(HUB_KINDS.has(section)?hubList(section):'')):
   `<section class="v4-hub-group"><h2>Teilen & Handeln</h2><p>Alles, was man gemeinsam besser nutzen kann.</p><div class="v3-hub-grid">${['lend','market','lost'].map(id=>hubSectionButton(HUB_MODULES.find(m=>m.id===id))).join('')}</div></section>
    <section class="v4-hub-group"><h2>Gemeinschaft</h2><p>Menschen treffen und zusammen etwas bewegen.</p><div class="v3-hub-grid">${['group','rsvp','project'].map(id=>hubSectionButton(HUB_MODULES.find(m=>m.id===id))).join('')}</div></section>
    <section class="v4-hub-group"><h2>Meine Gemeinde</h2><p>Lokale Termine, Anliegen und Verwaltung.</p><div class="v3-hub-grid">${['calendar','issue','stats'].map(id=>hubSectionButton(HUB_MODULES.find(m=>m.id===id))).join('')}</div></section>
    <section class="v4-hub-group"><h2>Für mich</h2><p>Passende Angebote und persönliche Einstellungen.</p><div class="v3-hub-grid">${['match','digest','draft'].map(id=>hubSectionButton(HUB_MODULES.find(m=>m.id===id))).join('')}</div></section>
    ${hubThreads()}`;
 return `<section class="v3-hub-page"><header class="v3-hub-hero"><span class="v3-eyebrow">Quartinaut · Gemeindeplattform</span>
 <h1>${selected?escapeHtml(selected.title):'Quartier+'}</h1><p>${selected?escapeHtml(selected.description):'Alles für dein Quartier – übersichtlich nach Themen geordnet.'}</p>
 <div class="row-actions">${selected?'<button class="ghost-button small" data-v3-open="all">← Alle Funktionen</button>':''}<button class="ghost-button small" data-v3-reload ${hubState.loading?'disabled':''}>↻ Aktualisieren</button></div></header>
 ${hubState.loading?'<p class="v3-safety-note">Quartierangebote werden geladen …</p>':''}
 ${hubState.error?`<p class="v3-safety-note" role="alert">${escapeHtml(hubState.error)}</p>`:''}
 ${HUB_KINDS.has(section)?v46FilterControls():''}
 ${content}</section>`;
}
function openHubCreate(kind){
 if(!hubState.loaded){toast('Die Quartierfunktionen müssen erst verbunden werden.');return;}
 const meta=HUB_MODULES.find(m=>m.id===kind),cats=HUB_CATEGORIES[kind]||[];
 const price=['market','lend'].includes(kind),place=kind==='calendar'||kind==='project',capacity=['group','project'].includes(kind);
 openModal('Neuer Eintrag · '+(meta?.title||'Quartier+'),`<form class="form-grid" id="v3HubCreate">
 <p class="help">Neue öffentliche Angebote werden vor der Veröffentlichung geprüft. Kontaktaufnahme erfolgt privat.</p>
 <label>Titel<input name="title" required minlength="5" maxlength="100"></label>
 <label>Kategorie<select name="category">${cats.map(c=>`<option>${escapeHtml(c)}</option>`).join('')}</select></label>
 <label>Beschreibung<textarea name="description" required minlength="12" maxlength="1200"></textarea></label>
 ${postPhotoField()}
 ${price?'<label>Preis in CHF (0 = kostenlos)<input name="priceChf" type="number" min="0" max="100000" step="0.01" value="0"></label>':''}
 ${place?'<label>Datum / Beginn<input name="startsAt" type="datetime-local" required></label><label>Öffentlicher Treffpunkt<input name="venue" maxlength="120" placeholder="z. B. Dorfplatz"></label>':''}
 ${capacity?'<label>Maximale Teilnehmende (0 = offen)<input name="capacity" type="number" min="0" max="300" value="0"></label>':''}
 ${kind==='issue'?'<p class="help">Keine privaten Adressen oder personenbezogenen Informationen von Dritten veröffentlichen. Die Meldung wird nur intern sichtbar.</p>':''}
 <button class="primary-button" type="submit">${kind==='issue'?'Meldung erfassen':'Zur Prüfung einreichen'}</button></form>`,(modal,close)=>{
  modal.dataset.draftContext=kind;
  const hubForm=modal.querySelector('#v3HubCreate');
  const hubPhotos=mountPostPhotoPicker(hubForm,kind);
  hubForm?.addEventListener('input',()=>{if(hubForm.dataset.v47Sending!=='yes')delete hubForm.dataset.v47OpId;});
  hubForm?.addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;if(f.dataset.v47Sending==='yes')return;
   const btn=f.querySelector('button[type=submit]');btn.disabled=true;f.dataset.v47Sending='yes';
   f.dataset.v47OpId ||= makeOperationId('hubcreate');const opId=f.dataset.v47OpId;
   const item=Object.fromEntries(new FormData(f).entries());item.kind=kind;
   if(item.startsAt)item.startsAt=new Date(item.startsAt).toISOString();
   runAsyncAction(async()=>{try {
     const photos=await hubPhotos;await photos.ready;
     item.photoPaths=await uploadPostPhotos('community',opId,photos.selected);
     await hubAction('create',{item,opId},'Eintrag wurde gespeichert.');
     f.dataset.photoSaved='yes';close(true);
   }finally{btn.disabled=false;delete f.dataset.v47Sending;}});
  });
 });
}
async function openHubGroup(id){
 const result=await callQuartinaut('quartinautHub',{action:'group.posts',id});
 const group=hubState.items.find(i=>i.id===id);
 openModal('Gruppe · '+(group?.title||''),`<div class="v3-thread v44-group-feed">${(result.posts||[]).map(post=>`<article class="v3-thread-bubble v44-post">${v44PostHead(post.authorName||'Gruppenmitglied',group?.area||'',communityDate(post.createdAt),'Gruppenbeitrag')}<div class="v44-post-body"><p>${escapeHtml(post.message)}</p></div>${postPhotoGallery(post.photoPaths)}${v44FeedActions('group_post',post.id)}</article>`).join('')||'<p>Noch keine Beiträge. Starte das Gespräch.</p>'}</div>
  <form id="v3GroupPost" class="form-grid"><label>Neuer Beitrag<textarea name="message" required minlength="3" maxlength="500"></textarea></label>${postPhotoField()}<button class="primary-button" type="submit">Beitrag teilen</button></form>`,(modal,close)=>{
  queueMicrotask(()=>void v44LoadSocial());
  const groupForm=modal.querySelector('#v3GroupPost');
  const groupPhotos=mountPostPhotoPicker(groupForm,id);
  groupForm?.addEventListener('input',()=>{if(groupForm.dataset.v47Sending!=='yes')delete groupForm.dataset.v47OpId;});
  groupForm?.addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;if(f.dataset.v47Sending==='yes')return;
   f.dataset.v47Sending='yes';f.querySelector('button[type=submit]').disabled=true;
   f.dataset.v47OpId ||= makeOperationId('hubgroup');const opId=f.dataset.v47OpId;
   const message=new FormData(f).get('message');runAsyncAction(async()=>{try {
    const photos=await groupPhotos;await photos.ready;
    const photoPaths=await uploadPostPhotos('groups',opId,photos.selected);
    await callQuartinaut('quartinautHub',{action:'group.post',id,message,photoPaths,opId});
    f.dataset.photoSaved='yes';close(true);await openHubGroup(id);
   }finally{delete f.dataset.v47Sending;f.querySelector('button[type=submit]').disabled=false;}});
  });
 });
}
function openHubSeries(){
 openModal('Wiederkehrende Veranstaltung',`<form id="v3EventSeries" class="form-grid">
  <p class="help">Für wöchentliche oder monatliche Vereinstreffen. Maximal 12 Termine, jeweils mit Freigabeprüfung.</p>
  <label>Titel<input name="title" minlength="5" maxlength="100" required></label><label>Beschreibung<textarea name="description" minlength="15" maxlength="600" required></textarea></label>
  <label>Kategorie<select name="category"><option>Verein</option><option>Nachbarschaft</option><option>Kultur</option><option>Sport</option><option>Gemeinde</option><option>Familie</option></select></label>
  <label>Beginn<input type="datetime-local" name="startsAt" required></label><label>Öffentlicher Treffpunkt<input name="venue" maxlength="120" required></label>
  <label>Wiederholung<select name="interval"><option value="weekly">Wöchentlich</option><option value="monthly">Monatlich</option></select></label>
  <label>Anzahl Termine<input type="number" name="count" min="2" max="12" value="4" required></label><button class="primary-button" type="submit">Serie zur Prüfung einreichen</button></form>`,(modal,close)=>{
  modal.querySelector('#v3EventSeries')?.addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;const values=Object.fromEntries(new FormData(f).entries());values.count=Number(values.count);values.startsAt=new Date(values.startsAt).toISOString();runAsyncAction(async()=>{
    const result=await callQuartinaut('quartinautEventPlus',{action:'series',...values});close(true);await loadCommunityFeatures();toast(result.count+' Veranstaltungen zur Prüfung eingereicht.');
  });});
 });
}
function hubCalendarFile(item){
 const esc=s=>String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
 const dt=v=>new Date(v).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 const start=item.startsAt||dateNow(),end=item.endsAt||new Date(Date.parse(start)+3600000).toISOString();
 const data=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Quartinaut//Quartierkalender//DE','BEGIN:VEVENT','UID:'+esc(item.id)+'@quartinaut.web.app','DTSTAMP:'+dt(new Date().toISOString()),'DTSTART:'+dt(start),'DTEND:'+dt(end),'SUMMARY:'+esc(item.title),'DESCRIPTION:'+esc(item.description),'LOCATION:'+esc(item.venue),'END:VEVENT','END:VCALENDAR'].join('\r\n');
 const blob=new Blob([data],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='quartinaut-termin.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);
}
async function openHubThread(id){
 hubState.activeThread=id;
 const res=await callQuartinaut('quartinautHub',{action:'messages.thread',id});hubState.messages=res.messages||[];
 const thread=hubState.threads.find(t=>t.id===id);
 openModal('Nachrichten · '+(thread?.itemTitle||'Quartier+'),`<div class="v3-thread">${hubState.messages.map(m=>`<div class="v3-thread-bubble ${m.senderUid===authState.user?.uid?'mine':''}"><p>${escapeHtml(m.text)}</p><small>${communityDate(m.createdAt)}</small></div>`).join('')||'<p>Noch keine Nachrichten.</p>'}</div>
 <form id="v3ThreadReply" class="form-grid"><label>Antwort<textarea name="message" maxlength="500" minlength="2" required></textarea></label><button class="primary-button">Antwort senden</button></form>`,(modal,close)=>{
  modal.querySelector('#v3ThreadReply')?.addEventListener('input',event=>{if(event.currentTarget.dataset.v47Sending!=='yes')delete event.currentTarget.dataset.v47OpId;});
  modal.querySelector('#v3ThreadReply')?.addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;if(f.dataset.v47Sending==='yes')return;
   f.dataset.v47OpId ||= makeOperationId('hubreply');const opId=f.dataset.v47OpId;f.dataset.v47Sending='yes';f.querySelector('button').disabled=true;
   runAsyncAction(async()=>{try{
    await callQuartinaut('quartinautHub',{action:'messages.reply',id,message:new FormData(f).get('message'),opId});close();await loadHub(true);await openHubThread(id);
   }finally{delete f.dataset.v47Sending;f.querySelector('button').disabled=false;}});
  });
 });
}
function bindHubControls(){
 document.querySelectorAll('[data-v3-home]').forEach(select=>select.addEventListener('change',()=>{
  const value=saveHome(authState.user?.uid,select.value);hubState.settings={...hubSettings(),homeView:value};
  runAsyncAction(async()=>{try{await callQuartinaut('quartinautHub',{action:'settings.save',settings:hubSettings()});toast('Startseite gespeichert.');}catch{toast('Startseite auf diesem Gerät gespeichert. Cloud-Synchronisierung nicht möglich.');}});
 }));
 document.querySelectorAll('[data-v3-open]').forEach(btn=>btn.addEventListener('click',()=>{
  hubState.section=btn.dataset.v3Open||'all';hubState.search='';setRoute('hub');if(!hubState.loaded)void loadHub();
 }));
 document.querySelectorAll('[data-v3-reload]').forEach(btn=>btn.addEventListener('click',()=>void loadHub(true)));
 document.querySelectorAll('[data-v3-search]').forEach(form=>form.addEventListener('submit',event=>{event.preventDefault();hubState.search=String(new FormData(form).get('q')||'').slice(0,100);render();}));
 document.querySelectorAll('[data-v3-create]').forEach(btn=>btn.addEventListener('click',()=>openHubCreate(btn.dataset.v3Create)));
 document.querySelectorAll('[data-v3-item-action]').forEach(btn=>btn.addEventListener('click',()=>runAsyncAction(()=>hubAction(btn.dataset.v3ItemAction,{id:btn.dataset.id,status:btn.dataset.status},'Aktion erfolgreich.'))));
 document.querySelectorAll('[data-v3-contact]').forEach(btn=>btn.addEventListener('click',()=>{
  openModal('Private Anfrage',`<form id="v3ContactForm" class="form-grid"><label>Deine Nachricht<textarea name="message" required minlength="2" maxlength="500" placeholder="Hallo, ich hätte Interesse …"></textarea></label><button class="primary-button">Nachricht senden</button></form>`,(modal,close)=>{
   const contactForm=modal.querySelector('#v3ContactForm');
   contactForm.addEventListener('input',()=>{if(contactForm.dataset.v47Sending!=='yes')delete contactForm.dataset.v47OpId;});
   contactForm.addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;if(f.dataset.v47Sending==='yes')return;
    f.dataset.v47OpId ||= makeOperationId('hubsend');const opId=f.dataset.v47OpId;f.dataset.v47Sending='yes';f.querySelector('button').disabled=true;
    runAsyncAction(async()=>{try{await hubAction('messages.send',{id:btn.dataset.v3Contact,message:new FormData(f).get('message'),opId},'Nachricht gesendet.');close();}
     finally{delete f.dataset.v47Sending;f.querySelector('button').disabled=false;}});
   });
  });
 }));
 document.querySelectorAll('[data-v3-group]').forEach(btn=>btn.addEventListener('click',()=>runAsyncAction(()=>openHubGroup(btn.dataset.v3Group))));
 document.querySelectorAll('[data-v3-series]').forEach(btn=>btn.addEventListener('click',openHubSeries));
 document.querySelectorAll('[data-v3-thread]').forEach(btn=>btn.addEventListener('click',()=>runAsyncAction(()=>openHubThread(btn.dataset.v3Thread))));
 document.querySelectorAll('[data-v3-calendar]').forEach(btn=>btn.addEventListener('click',()=>{const item=hubState.items.find(i=>i.id===btn.dataset.v3Calendar);if(item)hubCalendarFile(item);}));
 document.querySelectorAll('[data-v3-calendar-event]').forEach(btn=>btn.addEventListener('click',()=>{const e=upcomingCommunityEvents().find(i=>i.id===btn.dataset.v3CalendarEvent);if(e)hubCalendarFile(e);}));
 document.querySelectorAll('[data-v3-rsvp]').forEach(btn=>btn.addEventListener('click',()=>runAsyncAction(async()=>{
  await callQuartinaut('quartinautEventPlus',{action:btn.dataset.v3Rsvp,id:btn.dataset.id});await loadHub(true);toast('Teilnahme aktualisiert.');
 })));
 document.querySelectorAll('[data-v3-capacity]').forEach(btn=>btn.addEventListener('click',()=>{
  const answer=window.prompt('Maximale Plätze (0 = unbegrenzt):','0');if(answer===null)return;
  runAsyncAction(async()=>{await callQuartinaut('quartinautEventPlus',{action:'capacity',id:btn.dataset.v3Capacity,capacity:Number(answer)});toast('Kapazität gespeichert.');});
 }));
 document.querySelectorAll('[data-v3-stats]').forEach(btn=>btn.addEventListener('click',()=>runAsyncAction(async()=>{
  hubState.stats=await callQuartinaut('quartinautHub',{action:'stats'});render();
 })));
 byId('v3DigestForm')?.addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;
  const settings={...hubSettings(),topics:[...f.querySelectorAll('[name=topics]:checked')].map(i=>i.value),digest:f.elements.digest.value,quietHours:f.elements.quietHours.checked};
  runAsyncAction(async()=>{const result=await callQuartinaut('quartinautHub',{action:'settings.save',settings});hubState.settings=result.settings;render();toast('Benachrichtigungswünsche gespeichert.');});
 });
 document.querySelectorAll('[data-v3-draft]').forEach(btn=>btn.addEventListener('click',()=>runAsyncAction(async()=>{
  const form=byId('v3DraftForm');if(!form)return;
  const topic=form.elements.topic.value,kind=form.elements.kind.value;
  if(topic.trim().length<8){toast('Bitte etwas ausführlicher beschreiben.');return;}
  let draft;
  draft=localDraft(topic,kind);
  form.elements.title.value=draft.title||'';form.elements.description.value=draft.description||'';
  toast('Entwurf erstellt – prüfe die Angaben vor der Veröffentlichung.');
 })));
 document.querySelectorAll('[data-v3-draft-copy]').forEach(btn=>btn.addEventListener('click',()=>{
  const form=byId('v3DraftForm');if(!form)return;const text=form.elements.title.value+'\n\n'+form.elements.description.value;
  if(navigator.clipboard?.writeText)runAsyncAction(()=>navigator.clipboard.writeText(text).then(()=>toast('Text kopiert.')));
 }));
}
// ─── Ende Quartinaut 3.0 ───

function render() {
  stopDashboardMasonry();
  const accountGated = Boolean(authState.user) && (isAccountDisabled() || isAccountPendingApproval());
  document.body.classList.toggle('is-authenticated', Boolean(authState.user));
  document.body.classList.toggle('is-auth-gated', !authState.user || accountGated);
  document.body.classList.remove('v2-simple-mode');
  const inboxShortcut = document.querySelector('.v21-inbox-shortcut');
  if(inboxShortcut) {
    inboxShortcut.hidden = !authState.user || accountGated;
    const n = inboxShortcut.querySelector('.v21-inbox-count');
    const count = authState.user ? inboxUnreadCount() : 0;
    if(n){n.hidden = count===0;n.textContent = count>99?'99+':String(count);}
  }
  const profileLink = document.querySelector('.v2-profile-link');
  if (profileLink) profileLink.hidden = !authState.user || accountGated;
  const logoutButton = byId('logoutButton');
  const helpButton = byId('helpButton');
  const headerAuthActions = byId('headerAuthActions');
  if (logoutButton) logoutButton.hidden = !authState.user && !authState.profileError;
  if (helpButton) helpButton.hidden = false;
  if (headerAuthActions) headerAuthActions.hidden = Boolean(authState.user || authState.profileError);
  if (!authState.ready) {
    byId('main').innerHTML = renderAuthLoading();
    renderNotificationPermissionBanner();
    applyI18n(document.body);
    return;
  }
  if (authState.profileError) {
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    byId('main').innerHTML = `
      <section class="auth-layout auth-loading-layout" aria-live="polite">
        <article class="auth-copy">
          <span class="eyebrow">Anmeldung bestätigt</span>
          <h1>Dein Profil konnte nicht geladen werden.</h1>
          <p>Deine Anmeldung wurde bestätigt, aber Quartinaut konnte dein Benutzerprofil noch nicht laden. Versuche zunächst, das Profil erneut zu laden.</p>
          <p class="form-error critical">${escapeHtml(authState.profileError)}</p>
          <button class="primary-button" id="retryFirebaseProfileButton" type="button">Profil erneut laden</button>
          <p class="muted">Falls der Fehler bestehen bleibt, sende der Quartinaut-Verwaltung die Fehlermeldung. Deine Kontodaten werden dadurch nicht gelöscht.</p>
        </article>
      </section>`;
    byId('retryFirebaseProfileButton')?.addEventListener('click', (event) => {
      event.currentTarget.disabled = true;
      if (firebaseProfileRetryHandler) void firebaseProfileRetryHandler();
    });
    renderNotificationPermissionBanner();
    applyI18n(document.body);
    return;
  }
  if (authState.verifyPending) {
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    byId('main').innerHTML = renderEmailVerificationGate();
    bindEmailVerificationGate();
    renderNotificationPermissionBanner();
    applyI18n(document.body);
    return;
  }
  if (!authState.user) {
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    byId('main').innerHTML = renderAuthGate();
    bindAuthGate();
    renderNotificationPermissionBanner();
    applyI18n(document.body);
    return;
  }
  if (isAccountDisabled()) {
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    byId('main').innerHTML = renderDisabledAccountGate();
    bindCurrentRoute();
    renderNotificationPermissionBanner();
    applyI18n(document.body);
    return;
  }
  if (isAccountPendingApproval()) {
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    byId('main').innerHTML = renderPendingAccountGate();
    bindCurrentRoute();
    renderNotificationPermissionBanner();
    applyI18n(document.body);
    return;
  }

  pruneExpired();
  void pruneExpiredChatTrash();
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.route === state.route));
  const main = byId('main');
  persistInlineDraft();
  const routes = { home: renderHome, bulletin: renderBulletin, chats: renderChats, alarme: renderAlarme, profile: renderProfile, events: renderCommunityEvents, inbox: renderInbox, hub: renderQuartierPlus, search: renderGlobalSearch, map: renderQuartierMap, saved: renderSavedCollection, drafts: renderDraftManager };
  main.innerHTML = routes[state.route]?.() || renderHome();
  restoreInlineDraft();
  bindCurrentRoute();
  updateNavBadges();
  renderNotificationPermissionBanner();
  maybeShowOnboardingTour();
  applyI18n(document.body);
  queueMicrotask(()=>void v44LoadSocial());
}


// Quartinaut 4.6 – gespeicherte Einstellungen und Suche nur im angemeldeten Kontext.
const v46SearchUi={q:'',type:'all',onlyArea:false,category:'',from:'',to:''};
function v46Uid(){return authState.user?.uid||'guest';}
function v46UserPrefs(){return readUserData(v46Uid(),'preferences',{});}
function v46PrefsUpdate(patch){const next={...v46UserPrefs(),...patch};writeUserData(v46Uid(),'preferences',next);return next;}
function v46FeedFilter(){const filter=v46UserPrefs().feedFilter;return V46_FILTERS.includes(filter)?filter:'all';}
function v46InboxFilter(){const filter=v46UserPrefs().inboxFilter;return V46_INBOX_TYPES.includes(filter)?filter:'all';}
function v46LastSeenAt(){return v46UserPrefs().bulletinLastSeenAt||'';}
function v46HiddenKeys(){return cleanCollection(readUserData(v46Uid(),'hiddenPosts',[]),200);}
function v46IsHidden(kind,id){return v46HiddenKeys().includes(`${kind}:${id}`);}
function v46SetHidden(kind,id,hidden){if(!['request','hub'].includes(kind)||!id)return;const key=`${kind}:${id}`;const keys=v46HiddenKeys().filter(k=>k!==key);if(hidden)keys.push(key);writeUserData(v46Uid(),'hiddenPosts',keys);toast(hidden?'Beitrag nur für dich ausgeblendet.':'Beitrag wieder eingeblendet.');render();}
function v46DiagnosticCount(){return (readUserData(v46Uid(),'localDiagnostics',[])||[]).length;}
// Error types only: no stack traces, IPs, input contents or messages are stored or transmitted.
function v46RecordError(type){const list=readUserData(v46Uid(),'localDiagnostics',[]);if(!Array.isArray(list))return;list.push({type:type==='promise'?'promise':'script',at:nowIso()});writeUserData(v46Uid(),'localDiagnostics',list.slice(-20));}
window.addEventListener('error',()=>v46RecordError('script'));
window.addEventListener('unhandledrejection',()=>v46RecordError('promise'));
function v46SavedPostKeys(){if(v47Sync)return v47Sync.favoriteList().filter(x=>['request','hub'].includes(x.kind)).map(x=>`${x.kind}:${x.value}`);try{return cleanCollection(JSON.parse(localStorage.getItem(v44Social.bookmarkPrefix+v46Uid())||'[]'),250);}catch{return [];}}
function v46FilterControls(){const current=v46FeedFilter();const labels=[['all','Alle'],['mine','Meine Gemeinde'],['photos','Nur Fotos'],['new','Seit letztem Besuch'],['saved','Favoriten']];return `<nav class="v46-filters" aria-label="Beiträge filtern">${labels.map(([id,label])=>`<button type="button" class="${current===id?'active':''}" data-v46-feed="${id}" aria-pressed="${current===id}">${label}</button>`).join('')}</nav>${current==='new'&&!v46LastSeenAt()?'<p class="v46-muted">Ab deinem nächsten Besuch werden neue Beiträge hier angezeigt.</p>':''}`;}
function v46Favorites(){if(v47Sync)return {people:v47Sync.favoriteList('people').map(x=>x.value),groups:v47Sync.favoriteList('groups').map(x=>x.value),searches:v47Sync.favoriteList('searches').map(x=>x.value)};const raw=readUserData(v46Uid(),'favorites',{});return {people:cleanCollection(raw.people),groups:cleanCollection(raw.groups),searches:cleanCollection(raw.searches,30)};}
function v46ToggleFavorite(kind,name){if(!['people','groups','searches'].includes(kind))return;const key=String(name||'').trim().slice(0,100);if(!key)return;if(v47Sync){const active=!v47Sync.isFavorite(kind,key);v47Sync.setFavorite(kind,key,active);toast(active?'Zu Favoriten hinzugefügt.':'Aus Favoriten entfernt.');render();return;}const f=v46Favorites();f[kind]=f[kind].includes(key)?f[kind].filter(x=>x!==key):[...f[kind],key].slice(-100);writeUserData(v46Uid(),'favorites',f);toast(f[kind].includes(key)?'Zu Favoriten hinzugefügt.':'Aus Favoriten entfernt.');render();}
function v46SearchData(){return publicSearchIndex({requests:state.requests.filter(x=>!v46IsHidden('request',x.id)),hubs:hubState.items.filter(x=>!v46IsHidden('hub',x.id)),events:localCommunityEvents(),notices:state.officialNotices});}
// Quartinaut 4.7: a callable search of the *whole* server-side derived index.
// Never misrepresent the previously loaded 250 documents as a full search.
async function v47LoadSearch(page = 0) {
  if(!isFirebaseMode() || !authState.user) {
    v47SearchState={...v47SearchState,rows:[],loading:false,error:'Die vollständige Suche benötigt eine Firebase-Anmeldung.'};render();return;
  }
  const generation=++v47SearchGeneration, uidBefore=authState.user.uid, epoch=accountEpoch;
  const cursor=page===0?null:v47SearchState.next;
  v47SearchState={...v47SearchState,loading:true,error:'',page,rows:page===0?[]:v47SearchState.rows};render();
  try {
    const result=await callQuartinaut('quartinautSearch',{
      query:v46SearchUi.q,type:v46SearchUi.type==='person'?'request':v46SearchUi.type,
      category:v46SearchUi.category,area:v46SearchUi.onlyArea?state.profile.area:'',
      from:v46SearchUi.from?`${v46SearchUi.from}T00:00:00`:null,
      to:v46SearchUi.to?`${v46SearchUi.to}T23:59:59`:null,cursor
    });
    if(generation!==v47SearchGeneration||!currentAccountEpoch(uidBefore,epoch))return;
    const history=page===0?[null] : [...v47SearchState.history];
    if(page>0)history[page]=cursor;
    v47SearchState={rows:Array.isArray(result.results)?result.results.slice(0,30):[],next:result.nextCursor||null,history,loading:false,error:'',page};
  } catch(error) {
    if(generation!==v47SearchGeneration||!currentAccountEpoch(uidBefore,epoch))return;
    v47SearchState={...v47SearchState,loading:false,error:actionErrorMessage(error,'Die vollständige Suche ist derzeit nicht erreichbar. Bitte erneut versuchen.')};
  }
  render();
}
function v47SearchReset(){v47SearchState={rows:[],cursor:null,history:[null],loading:false,error:'',page:0,next:null};void v47LoadSearch(0);}
function renderGlobalSearch(){
 const availableCategories=[...new Set([...CATEGORIES,...OFFICIAL_NOTICE_CATEGORIES,...Object.values(HUB_CATEGORIES).flat(),'Nachbarschaft','Verein','Kultur','Sport','Gemeinde','Familie'])].sort((a,b)=>a.localeCompare(b,'de-CH'));
 const st=v47SearchState, categories=[['all','Alle'],['request','Beiträge'],['hub','Angebote'],['group','Vereine'],['event','Anlässe'],['notice','Gemeinde']];
 return `<section class="v46-page v47-search" aria-label="Vollständige Suche">
 <header class="v2-page-header"><span class="v2-kicker">Firebase-Suchindex · sichtbare Inhalte</span><h1>Globale Suche</h1>
 <p>Durchsuche auch bisher ungeladene, freigegebene Beiträge, Angebote, Veranstaltungen und Gemeindemitteilungen. Keine privaten Chats oder Benutzerverzeichnisse.</p></header>
 <form id="v46SearchForm" class="v46-searchbox"><label for="v46SearchInput">Suchbegriffe (alle Wörter müssen vorkommen)</label>
 <div class="v46-searchline"><input id="v46SearchInput" name="q" type="search" maxlength="120" autocomplete="off" value="${escapeHtml(v46SearchUi.q)}" placeholder="Zum Beispiel Velo reparieren"><button class="primary-button" type="submit">Suchen</button></div></form>
 <nav class="v46-filters" aria-label="Suchkategorie">${categories.map(([v,label])=>`<button type="button" class="${v46SearchUi.type===v?'active':''}" data-v46-search-type="${v}" aria-pressed="${v46SearchUi.type===v}">${label}</button>`).join('')}</nav>
 <div class="v47-search-filters"><label>Gemeinde<label class="check-row"><input type="checkbox" id="v46OnlyArea" ${v46SearchUi.onlyArea?'checked':''}> Nur ${escapeHtml(state.profile.area||'meine Gemeinde')}</label></label>
 <label>Kategorie<select id="v47SearchCategory"><option value="">Alle Kategorien</option>${availableCategories.map(c=>`<option value="${escapeHtml(c)}" ${v46SearchUi.category===c?'selected':''}>${escapeHtml(c)}</option>`).join('')}</select></label>
 <label>Von<input id="v47SearchFrom" type="date" value="${escapeHtml(v46SearchUi.from)}"></label>
 <label>Bis<input id="v47SearchTo" type="date" value="${escapeHtml(v46SearchUi.to)}"></label></div>
 <p class="v46-muted" aria-live="polite">${st.loading?'Suche läuft …':st.error?`Suche nicht verfügbar: ${escapeHtml(st.error)}`:`Seite ${st.page+1} · ${st.rows.length} Treffer (maximal 30 je Seite)`}</p>
 ${st.error?'<button class="secondary-button" type="button" data-v47-search-retry>Erneut versuchen</button>':''}
 <div class="v46-results">${st.rows.map(r=>`<article class="card v46-result"><span class="badge">${escapeHtml(r.kind==='request'?'Beitrag':r.kind==='hub'?'Quartier+':r.kind==='event'?'Anlass':'Mitteilung')}</span><h3>${escapeHtml(r.title||'Eintrag')}</h3><p>${escapeHtml(String(r.detail||'').slice(0,240))}</p><small>${escapeHtml(r.area||'')}</small><div class="row-actions"><button class="secondary-button small" data-v47-open-target="${escapeHtml(r.kind)}" data-target-id="${escapeHtml(r.id)}">Beitrag öffnen</button>${['request','hub'].includes(r.kind)?`<button class="ghost-button small" data-v47-save-target="${escapeHtml(r.kind)}" data-target-id="${escapeHtml(r.id)}">${v47Sync?.isFavorite(r.kind,r.id)?'★ Gemerkt':'☆ Merken'}</button>`:''}</div></article>`).join('')||(!st.loading&&!st.error?'<p class="empty">Keine passenden, zugänglichen Treffer.</p>':'')}</div>
 <nav class="v47-pagination" aria-label="Suchseiten"><button class="ghost-button" type="button" data-v47-prev ${st.page===0||st.loading?'disabled':''}>Vorherige Seite</button><span>Seite ${st.page+1}</span><button class="secondary-button" type="button" data-v47-next ${!st.next||st.loading?'disabled':''}>Nächste 30</button></nav>
 </section>`;
}
async function v47OpenResolvedTarget(target) {
 if(!target || !['request','hub','event','notice','chat'].includes(target.kind))throw new Error('Dieses Ziel ist nicht mehr zugänglich.');
 if(target.kind==='chat'){
   let chat=state.chats.find(c=>c.id===target.id);
   if(!chat){await syncStateFromFirestore();chat=state.chats.find(c=>c.id===target.id);}
   if(!chat)throw new Error('Der Chat wurde gelöscht oder du hast keinen Zugriff mehr.');
   chatModalForChat(await ensureChatDocument(chat));return;
 }
 // A target returned by the checked Function already passed visibility checks.
 // Render the concrete document, not only its list overview.
 openModal(target.kind==='event'?'Veranstaltung':target.kind==='notice'?'Gemeindemitteilung':target.kind==='request'?'Beitrag':'Quartier+',
   `<article class="v47-target-detail"><h2>${escapeHtml(target.title)}</h2><p>${escapeHtml(target.detail||'Keine Beschreibung')}</p><small>${escapeHtml(target.area||'')} · ${escapeHtml(target.category||'')}</small></article>`);
}
async function v47OpenTarget(kind,id){
 if(!authState.user)throw new Error('Zum Öffnen bitte anmelden.');
 const uidBefore=authState.user.uid,epoch=accountEpoch;
 try{
   const result=await callQuartinaut('quartinautTarget',{kind,id});
   if(!currentAccountEpoch(uidBefore,epoch))return;
   await v47OpenResolvedTarget(result.target);
 }catch(error){
   const text=String(error?.code||'')+' '+String(error?.message||'');
   if(/not-found|permission-denied|nicht mehr zugänglich/.test(text)) throw new Error('Dieser Inhalt wurde gelöscht oder du hast keinen Zugriff mehr.');
   throw error;
 }
}
async function v47ApplyDeepLink(){
 const params=new URLSearchParams(location.search);
 const kind=params.get('targetType'),id=params.get('targetId');
 if(!kind||!id||!authState.user)return;
 const key=kind+':'+id;
 if(v47ActiveDeepLink===key)return;
 v47ActiveDeepLink=key;
 try{await v47OpenTarget(kind,id);}catch(error){toast(actionErrorMessage(error,'Inhalt gelöscht oder nicht mehr zugänglich.'));}
}
async function v47StartOwnerSync(uid){
 if(!isFirebaseMode()||!firebaseStoreApi?.db||authState.user?.uid!==uid)return;
 if(v47Sync?.uid===uid)return;
 v47Sync?.dispose();
 const {db,collection,onSnapshot}=firebaseStoreApi;
 const expectedEpoch=accountEpoch;
 try{
   const sync=createOwnerSync({uid,
     callable:callQuartinaut,
     subscribe:(owner,coll,handler)=>onSnapshot(collection(db,'communityUserSettings',owner,coll),snapshot=>{
       if(currentAccountEpoch(owner,expectedEpoch))handler(snapshot.docs.map(d=>({id:d.id,...d.data()})));
     },error=>console.warn('[Quartinaut] Konto-Synchronisierung nicht verfügbar',error?.code||error?.message)),
     onChange:()=>{if(currentAccountEpoch(uid,expectedEpoch))scheduleRender();},
     onError:error=>console.warn('[Quartinaut] Vorgang bleibt lokal zur Wiederholung gespeichert',error?.code||error?.message)
   });
   v47Sync=sync;
   sync.subscribeOwnerCollections();
   const existing=readUserData(uid,'favorites',{});
   const items=[...['people','groups','searches'].flatMap(kind=>(existing[kind]||[]).map(value=>({kind,value})))];
   try{for(const key of JSON.parse(localStorage.getItem(v44Social.bookmarkPrefix+uid)||'[]')){
     const i=String(key).indexOf(':');if(i>0)items.push({kind:key.slice(0,i),value:key.slice(i+1)});
   }}catch{}
   await sync.importLegacy(items);
   if(currentAccountEpoch(uid,expectedEpoch))await sync.flush();
 }catch(error){console.warn('[Quartinaut] Sync bleibt auf diesem Gerät verfügbar:',error?.message||error);}
}
window.addEventListener('online',()=>{v47Sync?.flush();if(state.route==='search'&&v47SearchState.error)void v47LoadSearch(0);});
function renderSavedCollection(){const f=v46Favorites(),keys=v46SavedPostKeys();const records=v46SearchData();const postCards=keys.map(key=>{const record=records.find(r=>['request','hub','group'].includes(r.type)&&key===(r.type==='request'?'request:':'hub:')+r.id);return record?(record.type==='request'?requestCard(record.item):hubItemCard(record.item)):`<article class="card v46-result"><p>Gespeicherter Beitrag (${escapeHtml(key)}) ist auf diesem Gerät nicht geladen.</p><button class="secondary-button small" data-v47-open-target="${escapeHtml(key.split(':')[0])}" data-target-id="${escapeHtml(key.split(':').slice(1).join(':'))}">Beitrag öffnen</button><button class="ghost-button small" data-v46-unbookmark="${escapeHtml(key)}">Aus Merkliste entfernen</button></article>`;});return `<section class="v46-page"><header class="v2-page-header"><h1>Meine Favoriten</h1><p>${v47Sync?'Mit deinem Konto synchronisiert – Änderungen werden auch offline vorgemerkt.':'Auf diesem Gerät gespeichert.'} Beiträge siehst du nur mit gültiger Berechtigung.</p></header><nav class="v46-shortcuts"><button type="button" data-route="search">🔎 Neue Suche</button><button type="button" data-route="drafts">✍️ Entwürfe</button></nav><h2>Beiträge (${keys.length})</h2><div class="v46-results">${postCards.join('')||'<p class="v46-muted">Noch keine Beiträge gemerkt.</p>'}</div><h2>Vereine</h2><div class="v46-fav-list">${f.groups.map(id=>{const x=hubState.items.find(i=>i.id===id&&i.kind==='group'&&i.status==='published');return `<div class="card v46-fav-row"><strong>${escapeHtml(x?.title||'Verein derzeit nicht geladen')}</strong><div><button class="ghost-button small" data-v46-fav="groups" data-value="${escapeHtml(id)}">Entfernen</button>${x?`<button class="secondary-button small" data-v46-group="${escapeHtml(id)}">Ansehen</button>`:''}</div></div>`;}).join('')||'<p class="v46-muted">Noch keine Vereine gespeichert.</p>'}</div><h2>Personen</h2><div class="v46-fav-list">${f.people.map(name=>`<div class="card v46-fav-row"><strong>${escapeHtml(name)}</strong><div><button class="ghost-button small" data-v46-fav="people" data-value="${escapeHtml(name)}">Entfernen</button><button class="secondary-button small" data-v46-person="${escapeHtml(name)}">Öffentliche Beiträge</button></div></div>`).join('')||'<p class="v46-muted">Noch keine Personen gemerkt.</p>'}</div><h2>Suchanfragen</h2><div class="v46-fav-list">${f.searches.map(q=>`<div class="card v46-fav-row"><strong>${escapeHtml(q)}</strong><div><button class="ghost-button small" data-v46-fav="searches" data-value="${escapeHtml(q)}">Entfernen</button><button class="secondary-button small" data-v46-search="${escapeHtml(q)}">Suchen</button></div></div>`).join('')||'<p class="v46-muted">Noch keine Suchanfragen gespeichert.</p>'}</div><h2>Ausgeblendete Beiträge</h2><p class="v46-muted">Das Ausblenden wirkt nur auf diesem Gerät und ist keine Sperrung anderer Personen.</p><div class="v46-fav-list">${v46HiddenKeys().map(k=>{const [kind,...rest]=k.split(':');return `<div class="card v46-fav-row"><span>${escapeHtml(k)}</span><button class="ghost-button small" data-v46-unhide="${escapeHtml(kind)}" data-id="${escapeHtml(rest.join(':'))}">Wieder anzeigen</button></div>`;}).join('')||'<p class="v46-muted">Keine ausgeblendeten Beiträge.</p>'}</div></section>`;}
function renderDraftManager(){const drafts=safeDrafts(localStorage,v46Uid());return `<section class="v46-page"><header class="v2-page-header"><h1>Meine Entwürfe</h1><p>Automatisch gespeicherte Texte bleiben 72 Stunden auf diesem Gerät erhalten. Sie werden niemals ohne dein Zutun veröffentlicht.</p></header><p class="v46-muted">Fotoentwürfe werden im lokalen Gerätespeicher verwaltet und beim Öffnen des Editors wiederhergestellt.</p><div class="v46-fav-list">${drafts.map(x=>`<article class="card v46-fav-row"><div><strong>${escapeHtml(x.title)}</strong><small>${communityDate(new Date(x.saved).toISOString())} · ${escapeHtml(x.form)}</small></div><div class="row-actions"><button type="button" class="secondary-button small" data-v46-edit-draft="${escapeHtml(x.context)}">Weiterbearbeiten</button><button type="button" class="ghost-button small" data-v46-discard-draft="${escapeHtml(x.key)}">Verwerfen</button></div></article>`).join('')||'<div class="empty">Keine Textentwürfe auf diesem Gerät vorhanden.</div>'}</div><div class="row-actions"><button type="button" class="primary-button" data-action="new-request">Neues Anliegen erstellen</button><button type="button" class="secondary-button" data-route="hub">Quartier+ öffnen</button></div></section>`;}
function renderQuartierMap(){const all=[...state.requests.filter(x=>x.status==='offen'),...hubState.items.filter(x=>x.status==='published' && x.kind!=='issue'),...localCommunityEvents().filter(x=>x.status==='published')];const pins=all.map(safeMapPoint).filter(Boolean).slice(0,100);const selected=pins.find(p=>p.id===v46MapSelection)||pins[0];return `<section class="v46-page"><header class="v2-page-header"><h1>Quartierkarte</h1><p>Es werden nur veröffentlichte Einträge mit ausdrücklich hinterlegten Koordinaten gezeigt. Keine privaten Wohnadressen oder Standortabfragen.</p></header>${pins.length?`<div class="v46-map-wrap"><div class="v46-map" role="group" aria-label="Schematische Karte der Schweiz">${pins.map(p=>`<button type="button" class="v46-map-pin ${selected?.id===p.id?'active':''}" style="--pin-x:${((p.lng-5.9)/(10.6-5.9)*100).toFixed(2)}%;--pin-y:${((47.9-p.lat)/(47.9-45.8)*100).toFixed(2)}%" aria-label="${escapeHtml(p.title)}" data-v46-map-pin="${escapeHtml(p.id)}">●</button>`).join('')}<span class="v46-map-credit">Schematische Darstellung, keine amtliche Karte</span></div><div class="card v46-map-detail"><h2>${escapeHtml(selected.title||'Eintrag')}</h2><p>${escapeHtml(selected.area||'Schweiz')}</p><p>Koordinaten: ${selected.lat.toFixed(4)}, ${selected.lng.toFixed(4)}</p><button class="secondary-button" type="button" data-v46-osm="${escapeHtml(selected.id)}">In OpenStreetMap öffnen</button><p class="v46-muted">Beim Öffnen wird die Position an OpenStreetMap übertragen.</p></div></div>`:'<div class="card"><p>Aktuell sind keine freigegebenen Beiträge mit geeigneten Kartenkoordinaten geladen. Die App zeigt bewusst keine aus Ortsnamen geschätzten oder privaten Standorte.</p><button type="button" class="secondary-button" data-route="search">Einträge ohne Karte durchsuchen</button></div>'}</section>`;}
let v46MapSelection='';
function v46GroupProfile(id){
 const g=hubState.items.find(x=>x.id===id && x.kind==='group' && x.status==='published');if(!g){toast('Verein nicht verfügbar.');return;}
 const fav=v46Favorites().groups.includes(id);
 const isMember=hubState.joins.includes(id) || g.ownerUid===authState.user?.uid;
 openModal('Verein / Gruppe',`<section class="v46-club-profile"><h2>${escapeHtml(g.title)}</h2><p>${escapeHtml(g.description||'')}</p><p><strong>Ort:</strong> ${escapeHtml(g.area||'Deine Gemeinde')}</p><p><strong>Kategorie:</strong> ${escapeHtml(g.category||'Verein')}</p><p><strong>Mitglieder/Teilnehmende:</strong> ${escapeHtml(g.memberCount||0)}${g.capacity?' von '+escapeHtml(g.capacity):''}</p><p class="v46-muted">Dieses Profil zeigt freigegebene Vereinsinformationen. Verifizierungsstatus nur aus einer serverseitig geprüften Gemeindebestätigung ableiten.</p><div class="row-actions"><button type="button" class="secondary-button" id="v46ClubMembership" ${g.ownerUid===authState.user?.uid?'disabled':''}>${g.ownerUid===authState.user?.uid?'Eigene Gruppe':isMember?'Teilnahme beenden':'Teilnehmen'}</button><button type="button" class="ghost-button" id="v46ClubFavorite">${fav?'★ Gemerkt':'☆ Merken'}</button></div></section>`,(modal,close)=>{
   modal.querySelector('#v46ClubFavorite')?.addEventListener('click',()=>{v46ToggleFavorite('groups',id);close();});
   modal.querySelector('#v46ClubMembership')?.addEventListener('click',()=>runAsyncAction(async()=>{await hubAction(isMember?'leave':'join',{id},'Teilnahme aktualisiert.');close();}));
 });
}
function v46LoanReminder(id){
 const x=hubState.items.find(item=>item.id===id && item.kind==='lend' && item.status==='published');if(!x)return;
 openModal('Ausleih-Erinnerung',`<form id="v46LoanReminderForm" class="form-grid"><p>Abholung und Rückgabe werden als Kalenderdatei auf deinem Gerät erstellt. Dies ist <strong>keine bestätigte Buchung</strong>; vereinbare die Termine privat mit der anderen Person.</p><label>Abholung<input name="pickup" type="datetime-local" required></label><label>Rückgabe<input name="return" type="datetime-local" required></label><label>Notiz (optional)<textarea name="note" maxlength="250" placeholder="Vereinbarter Treffpunkt ohne sensible Angaben"></textarea></label><button class="primary-button" type="submit">Kalenderdatei herunterladen</button></form>`,(modal,close)=>{
  modal.querySelector('#v46LoanReminderForm')?.addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget;const pickup=new Date(f.elements.pickup.value),returned=new Date(f.elements.return.value);if(!Number.isFinite(pickup.getTime())||!Number.isFinite(returned.getTime())||returned<=pickup){toast('Rückgabe muss nach Abholung liegen.');return;}const esc=str=>String(str||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');const time=date=>date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');const name=esc(x.title),lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Quartinaut//Leihboerse//DE','BEGIN:VEVENT','UID:loan-'+encodeURIComponent(id)+'@quartinaut.web.app','DTSTAMP:'+time(new Date()),'DTSTART:'+time(pickup),'DTEND:'+time(returned),'SUMMARY:Quartinaut Ausleihe: '+name,'DESCRIPTION:'+esc(f.elements.note.value),'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Rueckgabe der Ausleihe pruefen','TRIGGER:-PT1H','END:VALARM','END:VEVENT','END:VCALENDAR'];const data=lines.join('\r\n');const url=URL.createObjectURL(new Blob([data],{type:'text/calendar;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='quartinaut-ausleihe.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);close();toast('Kalendereintrag erstellt.');});
 });
}
function bindV46Features(){
 document.querySelectorAll('[data-v46-feed]').forEach(b=>b.addEventListener('click',()=>{v46PrefsUpdate({feedFilter:b.dataset.v46Feed});render();}));
 document.querySelectorAll('[data-v46-inbox]').forEach(b=>b.addEventListener('click',()=>{v46PrefsUpdate({inboxFilter:b.dataset.v46Inbox});render();}));
 // No bulk read action: content is marked only after successful target resolution.
 byId('v46SearchForm')?.addEventListener('submit',event=>{event.preventDefault();v46SearchUi.q=String(new FormData(event.currentTarget).get('q')||'').trim().slice(0,120);v47SearchReset();});
 document.querySelectorAll('[data-v46-search-type]').forEach(b=>b.addEventListener('click',()=>{v46SearchUi.type=b.dataset.v46SearchType;v47SearchReset();}));
 byId('v46OnlyArea')?.addEventListener('change',e=>{v46SearchUi.onlyArea=e.target.checked;v47SearchReset();});
 byId('v47SearchCategory')?.addEventListener('change',e=>{v46SearchUi.category=e.target.value;v47SearchReset();});
 byId('v47SearchFrom')?.addEventListener('change',e=>{v46SearchUi.from=e.target.value;v47SearchReset();});
 byId('v47SearchTo')?.addEventListener('change',e=>{v46SearchUi.to=e.target.value;v47SearchReset();});
 document.querySelector('[data-v47-search-retry]')?.addEventListener('click',()=>v47LoadSearch(0));
 document.querySelector('[data-v47-next]')?.addEventListener('click',()=>v47LoadSearch(v47SearchState.page+1));
 document.querySelector('[data-v47-prev]')?.addEventListener('click',()=>{v47SearchState.next=v47SearchState.history[Math.max(0,v47SearchState.page-1)]||null;v47LoadSearch(Math.max(0,v47SearchState.page-1));});
 document.querySelectorAll('[data-v47-open-target]')?.forEach(b=>b.addEventListener('click',()=>runAsyncAction(()=>v47OpenTarget(b.dataset.v47OpenTarget,b.dataset.targetId))));
 document.querySelectorAll('[data-v47-save-target]')?.forEach(b=>b.addEventListener('click',()=>{if(v47Sync){v47Sync.setFavorite(b.dataset.v47SaveTarget,b.dataset.targetId,!v47Sync.isFavorite(b.dataset.v47SaveTarget,b.dataset.targetId));render();}}));
 document.querySelectorAll('[data-v46-fav]').forEach(b=>b.addEventListener('click',()=>v46ToggleFavorite(b.dataset.v46Fav,b.dataset.value)));
 document.querySelectorAll('[data-v46-search]').forEach(b=>b.addEventListener('click',()=>{v46SearchUi.q=b.dataset.v46Search;v46SearchUi.type='all';setRoute('search');v47SearchReset();}));
 document.querySelectorAll('[data-v46-person]').forEach(b=>b.addEventListener('click',()=>{v46SearchUi.q=b.dataset.v46Person;v46SearchUi.type='request';setRoute('search');v47SearchReset();}));
 document.querySelectorAll('[data-v46-group]').forEach(b=>b.addEventListener('click',()=>{hubState.section='group';hubState.search=hubState.items.find(x=>x.id===b.dataset.v46Group)?.title||'';setRoute('hub');}));
 document.querySelectorAll('[data-v46-unbookmark]').forEach(b=>b.addEventListener('click',()=>{const [kind,...parts]=b.dataset.v46Unbookmark.split(':');v44ToggleSaved(kind,parts.join(':'));render();}));
 document.querySelectorAll('[data-v46-hide-post]').forEach(b=>b.addEventListener('click',()=>v46SetHidden(b.dataset.v46HidePost,b.dataset.id,true)));
 document.querySelectorAll('[data-v46-unhide]').forEach(b=>b.addEventListener('click',()=>v46SetHidden(b.dataset.v46Unhide,b.dataset.id,false)));
 document.querySelectorAll('[data-v46-clear-errors]').forEach(b=>b.addEventListener('click',()=>{writeUserData(v46Uid(),'localDiagnostics',[]);render();toast('Gerätefehler zurückgesetzt.');}));
 document.querySelectorAll('[data-v46-discard-draft]').forEach(b=>b.addEventListener('click',()=>{if(!b.dataset.v46DiscardDraft.startsWith('quartinaut-draft-v42:'+v46Uid()+':'))return;if(!confirm('Diesen Textentwurf auf diesem Gerät verwerfen?'))return;localStorage.removeItem(b.dataset.v46DiscardDraft);render();}));
 document.querySelectorAll('[data-v46-edit-draft]').forEach(b=>b.addEventListener('click',()=>{const [form,context]=String(b.dataset.v46EditDraft).split(':');if(form==='requestForm')newRequestModal();else if(form==='v3HubCreate'&&HUB_KINDS.has(context)){hubState.section=context;openHubCreate(context);}else if(form==='v3DraftForm'){hubState.section='draft';setRoute('hub');}else toast('Öffne den ursprünglichen Bereich, um diesen Entwurf fortzusetzen.');}));
 document.querySelectorAll('[data-v46-loan-reminder]').forEach(b=>b.addEventListener('click',()=>v46LoanReminder(b.dataset.v46LoanReminder)));
 document.querySelectorAll('[data-v46-group-profile]').forEach(b=>b.addEventListener('click',()=>v46GroupProfile(b.dataset.v46GroupProfile)));
 document.querySelectorAll('[data-v46-map-pin]').forEach(b=>b.addEventListener('click',()=>{v46MapSelection=b.dataset.v46MapPin;render();}));
 document.querySelectorAll('[data-v46-osm]').forEach(b=>b.addEventListener('click',()=>{const all=[...state.requests.filter(x=>x.status==='offen'),...hubState.items.filter(x=>x.status==='published'&&x.kind!=='issue'),...localCommunityEvents().filter(x=>x.status==='published')];const point=all.map(safeMapPoint).find(p=>p?.id===b.dataset.v46Osm);if(!point)return;window.open(`https://www.openstreetmap.org/?mlat=${encodeURIComponent(point.lat)}&mlon=${encodeURIComponent(point.lng)}#map=15/${encodeURIComponent(point.lat)}/${encodeURIComponent(point.lng)}`,'_blank','noopener,noreferrer');}));
}

function renderAuthLoading() {
  return `
    <section class="auth-layout auth-loading-layout">
      <article class="auth-copy auth-loading-copy">
        <span class="eyebrow">Quartinaut</span>
        <h1>Quartierzugang wird geprüft.</h1>
        <p>Wir laden Anmeldung, Standortauswahl und Sicherheitsstatus. Bei langsamer Verbindung bleibt die App ruhig bedienbar.</p>
        <div class="auth-principles">
          <span>Datensparsam</span>
          <span>Gemeindebezogen</span>
          <span>Geschützt</span>
        </div>
      </article>
      <article class="card auth-card auth-loading-card" aria-live="polite">
        <div class="loading-orbit" aria-hidden="true"></div>
        <div>
          <span class="eyebrow">Anmeldung</span>
          <h1>Wird vorbereitet</h1>
          <p>Bitte kurz warten.</p>
        </div>
        <div class="loading-lines" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </article>
    </section>
  `;
}

function renderDisabledAccountGate() {
  return `
    <section class="auth-layout">
      <article class="card auth-card">
        <span class="eyebrow">Quartinaut · Konto deaktiviert</span>
        <h1>Dieses Konto ist aktuell deaktiviert.</h1>
        <p>Ein Admin hat den Zugang eingeschränkt. Du kannst dich abmelden oder den Support kontaktieren, falls du eine Prüfung möchtest.</p>
        <div class="row-actions" style="margin-top:16px;">
          <button class="primary-button" data-action="logout">Abmelden</button>
          <button class="ghost-button" data-action="open-legal" data-legal="imprint">Kontakt</button>
        </div>
      </article>
    </section>
  `;
}

function renderPendingAccountGate() {
  const rejected = state.profile.municipalityStatus === 'rejected';
  return `
    <section class="auth-layout">
      <article class="card auth-card pending-account-card">
        <span class="eyebrow">Quartinaut · Gemeindekonto</span>
        <h1>${rejected ? 'Die Freigabe wurde abgelehnt.' : 'Dein Gemeindekonto wird geprüft.'}</h1>
        <p>${rejected
          ? 'Bitte kontaktiere den Support, falls Angaben korrigiert oder erneut geprüft werden sollen.'
          : 'Gemeindekonten werden vor der Nutzung manuell geprüft. Nach der Freigabe ist der Zugang auf die gewählte Gemeinde beschränkt.'}</p>
        <div class="card compact soft" style="margin-top:16px;">
          <strong>${escapeHtml(state.profile.municipalityName || state.profile.area || 'Gewählte Gemeinde')}</strong>
          <p>${escapeHtml(state.profile.municipalityDepartment || 'Abteilung/Funktion nicht angegeben')}${state.profile.municipalityWebsite ? ` · ${escapeHtml(state.profile.municipalityWebsite)}` : ''}</p>
          <div class="badges" style="margin-top:10px;">
            ${accountStatusBadge(state.profile.accountStatus)}
            ${trustBadge(state.profile, { detail: true })}
          </div>
        </div>
        <div class="row-actions" style="margin-top:16px;">
          <button class="primary-button" data-action="logout">Abmelden</button>
          <button class="ghost-button" data-action="open-legal" data-legal="imprint">Support kontaktieren</button>
        </div>
      </article>
    </section>
  `;
}

function renderEmailVerificationGate() {
  return `<section class="auth-layout"><article class="card auth-card v452-verify" aria-live="polite">
    <span class="v452-mail-mark" aria-hidden="true">✉</span>
    <h1>Bitte E-Mail-Adresse bestätigen</h1>
    <p>Wir haben einen Bestätigungslink an <strong>${escapeHtml(authState.verifyPending?.email || '')}</strong> geschickt.</p>
    <p>Öffne den Link in deiner E-Mail. Danach kannst du dein Quartinaut-Konto verwenden.</p>
    ${emailAuthNotice?`<p class="help" role="status">${escapeHtml(emailAuthNotice)}</p>`:''}
    <div class="form-grid"><button type="button" class="primary-button" id="checkEmailVerification">E-Mail geprüft</button>
    <button type="button" class="ghost-button" id="resendEmailVerification">Bestätigungs-E-Mail erneut senden</button>
    <button type="button" class="ghost-button" id="switchEmailAccount">Anderes Konto verwenden</button></div>
  </article></section>`;
}
function bindEmailVerificationGate() {
  byId('checkEmailVerification')?.addEventListener('click',()=>runAsyncAction(checkFirebaseEmailVerification));
  byId('resendEmailVerification')?.addEventListener('click',()=>runAsyncAction(resendFirebaseEmailVerification));
  byId('switchEmailAccount')?.addEventListener('click',()=>runAsyncAction(signOutCurrentUser));
}

function renderAuthGate() {
  const isRegister = authMode === 'register';
  const picker = locationOptions(state.profile.location);
  const firebaseGate = authState.mode === 'firebase';
  const accountTypeFields = `
            <label>Kontotyp
              <select name="accountType" id="accountTypeSelect">
                <option value="resident">Privatperson</option>
                <option value="company">Firma</option>
                <option value="municipality">Gemeinde</option>
              </select>
            </label>
            <div class="form-grid two account-type-details" id="companyRegistrationFields" hidden>
              <label>Firmenname
                <input name="companyName" maxlength="80" placeholder="z. B. Muster AG" />
              </label>
              <label>Tätigkeit / Suche
                <input name="companyPurpose" maxlength="120" placeholder="z. B. Mitarbeitende, Lehrstellen, lokale Dienste" />
              </label>
            </div>
            <div class="form-grid account-type-details" id="municipalityRegistrationFields" hidden>
              <p class="help">Die unten gewählte Gemeinde wird fest mit dem Konto verbunden. Das Konto bleibt bis zur manuellen Admin-Freigabe gesperrt.</p>
              <div class="form-grid two">
                <label>Abteilung / Funktion
                  <input name="municipalityDepartment" maxlength="100" placeholder="z. B. Einwohnerdienste" />
                </label>
                <label>Offizielle Webseite (optional)
                  <input name="municipalityWebsite" type="url" maxlength="180" placeholder="https://www.gemeinde.ch" />
                </label>
              </div>
            </div>
  `;
  const firebaseBody = `
        <form id="authForm" class="form-grid v452-auth-form" style="margin-top:16px;">
          ${isRegister ? `
            <label>Name <input name="displayName" autocomplete="name" required maxlength="60" placeholder="Vorname Nachname"></label>
            ${accountTypeFields}
            <div class="form-grid two">
              <label>Kanton ${picker.cantonSelect}</label>
              <label>Gemeinde / Ort ${picker.municipalitySelect}</label>
            </div>
            <label>Einladungscode <input name="inviteCode" autocomplete="off" placeholder="${DEFAULT_INVITE_CODE}"></label>
            <p class="help">Bei E-Mail-Registrierung wird zuerst deine E-Mail-Adresse bestätigt. Name und Gemeinde werden danach im Profil gespeichert.</p>
          ` : '<p class="help">Du kannst dich mit Google oder mit E-Mail und Passwort anmelden.</p>'}
          <div class="v452-email-fields">
            <label>E-Mail-Adresse
              <input id="firebaseEmailInput" name="email" type="email" inputmode="email" autocomplete="email" placeholder="name@beispiel.ch" ${isRegister && !authState.needsProfileCompletion ? 'required' : ''}>
            </label>
            ${authState.needsProfileCompletion ? `<p class="help">Deine E-Mail ist bereits bestätigt. Bitte Name und Gemeinde vervollständigen, um dein Profil zu aktivieren.</p>` : `
              <label>Passwort
                <input name="password" type="password" minlength="${isRegister?10:1}" autocomplete="${isRegister?'new-password':'current-password'}" placeholder="${isRegister?'Mindestens 10 Zeichen':'Passwort'}">
              </label>
              ${isRegister?`<label>Passwort wiederholen
                <input name="passwordConfirm" type="password" minlength="10" autocomplete="new-password" placeholder="Passwort bestätigen">
              </label>`:''}
            `}
            <button class="primary-button" type="submit" name="authProvider" value="email" data-auth-provider="email">${authState.needsProfileCompletion ? 'Profil fertigstellen' : isRegister ? 'Mit E-Mail registrieren' : 'Mit E-Mail anmelden'}</button>
            ${!isRegister?'<button type="button" class="ghost-button small" id="resetEmailPassword">Passwort vergessen?</button>':''}
          </div>
          <div class="v452-auth-divider" aria-hidden="true"><span>oder</span></div>
          <button type="submit" name="authProvider" value="google" data-auth-provider="google" class="ghost-button v452-google-button" formnovalidate>${isRegister ? 'Mit Google registrieren' : 'Mit Google anmelden'}</button>
          ${emailAuthNotice?`<p class="help" role="status">${escapeHtml(emailAuthNotice)}</p>`:''}
          ${authState.error ? `<p class="form-error">${escapeHtml(authState.error)}</p>` : ''}
          <p id="authError" class="form-error" role="alert"></p>
        </form>
  `;
  const localBody = `
        <form id="authForm" class="form-grid" style="margin-top:16px;">
          ${isRegister ? `
            <label>Name
              <input name="displayName" autocomplete="name" required maxlength="60" placeholder="Vorname Nachname" />
            </label>
            ${accountTypeFields}
          ` : ''}
          <label>E-Mail
            <input name="email" type="text" inputmode="email" autocomplete="email" required placeholder="name@example.ch" />
          </label>
          <label>Passwort
            <input name="password" type="password" autocomplete="${isRegister ? 'new-password' : 'current-password'}" required minlength="8" placeholder="Mindestens 8 Zeichen" />
          </label>
          ${isRegister ? `
            <div class="form-grid two">
              <label>Kanton
                ${picker.cantonSelect}
              </label>
              <label>Gemeinde / Ort
                ${picker.municipalitySelect}
              </label>
            </div>
            <label>Einladungscode
              <input name="inviteCode" autocomplete="off" placeholder="${DEFAULT_INVITE_CODE}" />
            </label>
            <p class="help">Name und Standort werden nach der Registrierung fixiert. Änderungen laufen später nur über begründete Anträge an die Administration.</p>
          ` : `
            <div class="card compact soft">
              <strong>Noch kein Konto?</strong>
              <p>Bitte zuerst "Konto erstellen" wählen und danach mit denselben Zugangsdaten anmelden.</p>
              <button class="ghost-button small" type="button" data-auth-mode="register" style="margin-top:10px;">Zur Registrierung</button>
            </div>
          `}
          <p class="help">Lokaler Entwicklungsmodus ohne Firebase-Verbindung. Diese Konten sind nicht mit der Cloud verbunden.</p>
          ${authState.error ? `<p class="form-error">${escapeHtml(authState.error)}</p>` : ''}
          <p id="authError" class="form-error" role="alert"></p>
          <button class="primary-button" type="submit">${isRegister ? 'Konto erstellen' : 'Anmelden'}</button>
        </form>
  `;
  return `
    <section class="auth-layout">
      <article class="auth-copy">
        <span class="eyebrow">Quartinaut · Pflichtanmeldung</span>
        <h1>Lokale Hilfe erst nach Anmeldung.</h1>
        <p>Quartinaut ist als datensparsame Quartier-PWA mit hohen Datenschutzstandards ausgelegt. Sensible Funktionen wie das Schwarze Brett, Alarme und Direktvermittlung sind erst nach erfolgreichem Login zugänglich.</p>
        <div class="auth-principles">
          <span>Keine Feeds</span>
          <span>Keine Likes</span>
          <span>Verifizierte Alarme</span>
          <span>Ephemere Vermittlung</span>
        </div>
      </article>

      <article class="card auth-card">
        <div class="segmented auth-mode-switch" role="tablist" aria-label="Auth-Modus">
          <button data-auth-mode="login" class="${!isRegister ? 'active' : ''}" type="button">Anmelden</button>
          <button data-auth-mode="register" class="${isRegister ? 'active' : ''}" type="button">Konto erstellen</button>
        </div>
        ${firebaseGate ? firebaseBody : localBody}
      </article>
    </section>
  `;
}

function hasSeenAlert(alertId) {
  return state.alertReads.some(read => read.alertId === alertId && read.uid === authState.user?.uid);
}

function alertReadCount(alertId) {
  return state.alertReads.filter(read => read.alertId === alertId).length;
}

function requestById(id) {
  return state.requests.find(req => req.id === id);
}

function isChatForOpenRequest(chat) {
  const req = requestById(chat.requestId);
  return !req || req.status === 'offen';
}

function activePrivateChats() {
  return state.chats
    .filter(chat => isChatVisibleForUser(chat))
    .filter(isChatForOpenRequest)
    .sort((a, b) => new Date(b.lastMessageAt || b.createdAt || 0) - new Date(a.lastMessageAt || a.createdAt || 0));
}

function chatResponseMinutes(chat) {
  const req = requestById(chat.requestId);
  if (!req) return null;
  const firstReplyAt = new Date(chat.createdAt || chat.lastMessageAt || 0).getTime();
  const created = new Date(req.createdAt).getTime();
  if (!firstReplyAt || !created) return null;
  return (firstReplyAt - created) / 60000;
}

function adminAnalytics() {
  const all = state.requests;
  const closed = all.filter(req => req.status === 'erledigt');
  const responseTimes = state.chats.map(chatResponseMinutes).filter(v => Number.isFinite(v) && v >= 0);
  const alerts = state.alerts;
  const reach = alerts.map(alert => alertReadCount(alert.id));
  const avgReach = reach.length ? reach.reduce((sum, value) => sum + value, 0) / reach.length : 0;
  const deliveries = state.pushDeliveries;
  const requested = deliveries.reduce((sum, item) => sum + Number(item.requested || 0), 0);
  const successful = deliveries.reduce((sum, item) => sum + Number(item.successCount || 0), 0);
  return {
    totalRequests: all.length,
    closedRequests: closed.length,
    completionRate: percentage(closed.length, all.length),
    medianResponseMinutes: median(responseTimes),
    activeEscalations: all.filter(req => req.status === 'offen' && ['P0', 'P1'].includes(req.escalationLevel)).length,
    alertCount: alerts.length,
    alertReachAvg: Math.round(avgReach * 10) / 10,
    pushSuccessRate: percentage(successful, requested),
    pushRequested: requested
  };
}

function communityDashboardStats() {
  const area = state.profile.area;
  const areaRequests = state.requests.filter(req => req.area === area);
  const openAreaRequests = areaRequests.filter(req => req.status === 'offen');
  const activeAreaChats = state.chats.filter(chat => isChatVisibleForUser(chat)).filter(chat => {
    const req = requestById(chat.requestId);
    return !req || req.area === area;
  });
  const users = state.registeredUsers || [];
  const localUsers = users.filter(user => adminUserLocationLabel(user) === area);
  const companies = users.filter(user => user.accountType === 'company');
  const verifiedCompanies = companies.filter(user => user.companyStatus === 'verified');
  const verifiedUsers = users.filter(user => user.verified || user.companyStatus === 'verified' || ['admin', 'area_admin'].includes(user.role));
  const categoryCounts = CATEGORIES.map(category => ({
    category,
    count: openAreaRequests.filter(req => req.category === category).length
  })).filter(item => item.count > 0).sort((a, b) => b.count - a.count).slice(0, 5);
  return {
    area,
    localUsers: localUsers.length,
    totalUsers: users.length,
    verifiedUsers: verifiedUsers.length,
    companies: companies.length,
    verifiedCompanies: verifiedCompanies.length,
    openAreaRequests: openAreaRequests.length,
    activeAreaChats: activeAreaChats.length,
    categoryCounts
  };
}

function renderCommunityDashboardCard() {
  const stats = communityDashboardStats();
  const categories = stats.categoryCounts.length
    ? stats.categoryCounts.map(item => `<span class="status-pill"><strong>${escapeHtml(formatNumber(item.count))}</strong> ${escapeHtml(item.category)}</span>`).join('')
    : '<span class="status-pill">Keine offenen Kategorien</span>';
  return `
    <article class="card">
      <h2>Gemeinde-Dashboard</h2>
      <p class="section-description">${escapeHtml(stats.area || 'Aktuelles Gebiet')} · operative Übersicht für Registrierung, Firmen, Vermittlung und Vertrauen.</p>
      <div class="grid two" style="margin-top:12px;">
        <div class="card compact soft"><strong>Nutzer im Gebiet</strong><p>${escapeHtml(formatNumber(stats.localUsers))}</p></div>
        <div class="card compact soft"><strong>Vertrauensprofile</strong><p>${escapeHtml(formatNumber(stats.verifiedUsers))}/${escapeHtml(formatNumber(stats.totalUsers))}</p></div>
        <div class="card compact soft"><strong>Firmen geprüft</strong><p>${escapeHtml(formatNumber(stats.verifiedCompanies))}/${escapeHtml(formatNumber(stats.companies))}</p></div>
        <div class="card compact soft"><strong>Aktive Chats</strong><p>${escapeHtml(formatNumber(stats.activeAreaChats))}</p></div>
        <div class="card compact soft"><strong>Offene Anliegen</strong><p>${escapeHtml(formatNumber(stats.openAreaRequests))}</p></div>
        <div class="card compact soft"><strong>Push-Status</strong><p>${escapeHtml(formatNumber(state.deviceTokens.filter(token => token.active !== false).length))} Geräte</p></div>
      </div>
      <div class="admin-user-stats" style="margin-top:12px;">${categories}</div>
    </article>
  `;
}

function renderCompanyAreaCard() {
  const companyRequests = state.requests
    .filter(req => req.status === 'offen' && (req.category === 'Firmen / Arbeit' || req.authorAccountType === 'company'))
    .sort(sortByLocalRelevance)
    .slice(0, 4);
  const companies = state.registeredUsers.filter(user => user.accountType === 'company');
  const verifiedCompanies = companies.filter(user => user.companyStatus === 'verified');
  return `
    <article class="card">
      <h2>Firmenbereich</h2>
      <p class="section-description">Lokale Firmen, Arbeit, Lehrstellen, kurzfristige Einsätze und Dienstleistungen klar getrennt vom privaten Hilfebereich.</p>
      <div class="badges" style="margin-bottom:12px;">
        ${isAdminRole() ? `<span class="badge info">${escapeHtml(formatNumber(companies.length))} Firmenkonten</span><span class="badge official">${escapeHtml(formatNumber(verifiedCompanies.length))} geprüft</span>` : '<span class="badge info">Kategorie Firmen / Arbeit</span>'}
      </div>
      <div class="list">
        ${companyRequests.length ? companyRequests.map(req => `
          <section class="card compact soft">
            <strong>${escapeHtml(req.title)}</strong>
            <p>${escapeHtml(requestAuthorLabel(req))} · ${escapeHtml(req.area)}</p>
            <div class="badges" style="margin-top:8px;">
              ${trustBadge(profileFromRequest(req), { detail: true })}
            ${Number(state.publicTrust?.[requestOwnerUid(req)]?.count||0)>0?`<span class="badge v21-rating-badge" title="Bewertungen abgeschlossener Hilfen">★ ${escapeHtml(Number(state.publicTrust[requestOwnerUid(req)].average).toFixed(1))} (${Number(state.publicTrust[requestOwnerUid(req)].count)})</span>`:''}
              <span class="badge">${escapeHtml(req.type)}</span>
            </div>
            <button class="ghost-button small" data-action="open-chat" data-id="${escapeHtml(req.id)}" style="margin-top:10px;">Kontakt</button>
          </section>
        `).join('') : '<div class="empty">Noch keine Firmen-/Arbeits-Einträge.</div>'}
      </div>
    </article>
  `;
}

function legacyPublicReplyRequests() {
  return state.requests.filter(req => Array.isArray(req.replies) && req.replies.length > 0);
}

function renderAdminMaintenanceCard() {
  const legacyCount = legacyPublicReplyRequests().length;
  return `
    <article class="card">
      <h2>Systempflege</h2>
      <p class="section-description">Bereinigt Altlasten aus der früheren öffentlichen Chat-Struktur. Neue Chats laufen bereits privat über 1:1-Threads.</p>
      <div class="metric"><strong>${legacyCount}</strong><span>Anliegen mit alten öffentlichen Antworten</span></div>
      <div class="row-actions" style="margin-top:12px;">
        <button class="secondary-button" data-action="cleanup-legacy-replies" ${legacyCount ? '' : 'disabled'}>Alt-Chats bereinigen</button>
        <button class="ghost-button" data-action="sync-now">Status aktualisieren</button>
      </div>
    </article>
  `;
}

function renderCantonLiveMap() {
  const counts = cantonRegistrationCounts();
  const fromPublicStats = isFirebaseMode() && !isAdminRole();
  const activeCantons = Object.values(counts).filter(value => Number(value || 0) > 0).length;
  const totalUsers = totalRegisteredUsersFromCounts(counts);
  const updatedAt = state.publicStats?.updatedAt ? fmtTime(state.publicStats.updatedAt) : '';
  const sourceHint = fromPublicStats
    ? `Öffentliche Aggregation${updatedAt ? ` · Stand ${updatedAt}` : ''}`
    : (isFirebaseMode() ? (isAdminRole() ? 'Admin-Detailansicht' : 'Lokale Ansicht') : 'Lokale Daten');
  return `
    <article class="card">
      <h2>Live-Kantonskarte</h2>
      <p class="help">Kürzel und Zähler stehen direkt in der Karte. Grau = keine Registrierung, Grün = aktive Registrierungen. Gesamt: ${escapeHtml(formatNumber(totalUsers))}, aktive Kantone: ${escapeHtml(formatNumber(activeCantons))}. ${escapeHtml(sourceHint)}</p>
      <section class="swiss-map-canvas" data-swiss-map aria-label="Live-Karte Schweiz"></section>
    </article>
  `;
}

function renderAdminMetricsCard() {
  const analytics = adminAnalytics();
  const vapidStatus = FIREBASE_VAPID_KEY ? 'gesetzt' : 'fehlt';
  return `
    <article class="card">
      <h2>Admin-Auswertungen</h2>
      <div class="grid two" style="margin-top:12px;">
        <div class="card compact soft"><strong>Antwortzeit (Median)</strong><p>${formatDurationMinutes(analytics.medianResponseMinutes)}</p></div>
        <div class="card compact soft"><strong>Abschlussquote</strong><p>${analytics.completionRate}% (${analytics.closedRequests}/${analytics.totalRequests})</p></div>
        <div class="card compact soft"><strong>Alarm-Reichweite Ø</strong><p>${analytics.alertReachAvg} gelesen pro Alarm</p></div>
        <div class="card compact soft"><strong>Eskalationen offen</strong><p>${analytics.activeEscalations}</p></div>
        <div class="card compact soft"><strong>FCM Zustellung</strong><p>${analytics.pushSuccessRate}% bei ${analytics.pushRequested} Tokens</p></div>
        <div class="card compact soft"><strong>FCM VAPID</strong><p>${vapidStatus}</p></div>
      </div>
    </article>
  `;
}

function renderAreaPriorityCard() {
  const currentArea = baseMunicipalityName(state.profile.area);
  const currentPriority = categoryPriority(state.profile.area);
  return `
    <article class="card">
      <h2>Kategorie-Priorität</h2>
      <p class="help">Steuert die Reihenfolge der Kategorien für ${escapeHtml(currentArea || 'deine Gemeinde')}.</p>
      <form id="areaPriorityForm" class="form-grid" style="margin-top:12px;">
        <label>Prioritäten (Komma-getrennt)
          <input name="priorityRaw" value="${escapeHtml(currentPriority.join(', '))}" placeholder="z. B. Notfall, Gesundheit, Seniorenhilfe" />
        </label>
        <button class="secondary-button" type="submit">Priorität speichern</button>
      </form>
    </article>
  `;
}

function dashboardDefaults(isAdmin = isAdminRole()) {
  const base = ['kennzahlen', 'kantonskarte', 'firmen'];
  const resident = ['erststart', 'so-funktionierts'];
  const admin = ['einladungscodes', 'community-dashboard', 'admin-metriken', 'wartung', 'prioritaeten'];
  return isAdmin ? [...base, ...admin] : [...base, ...resident];
}

function sanitizeDashboardLayout(layout = {}) {
  return {
    version: Number(layout.version || 0),
    order: Array.isArray(layout.order) ? layout.order.filter(Boolean).map(String) : [],
    hidden: Array.isArray(layout.hidden) ? layout.hidden.filter(Boolean).map(String) : [],
    collapsed: Array.isArray(layout.collapsed) ? layout.collapsed.filter(Boolean).map(String) : []
  };
}

function normalizeOnboardingState(value = {}) {
  const checklist = value?.checklist && typeof value.checklist === 'object' ? value.checklist : {};
  return {
    version: Number(value?.version || 0),
    completed: Boolean(value?.completed),
    completedAt: normalizeStoredDate(value?.completedAt) || '',
    skipped: Boolean(value?.skipped),
    checklist: {
      profileChecked: Boolean(checklist.profileChecked),
      locationChecked: Boolean(checklist.locationChecked),
      notificationsChecked: Boolean(checklist.notificationsChecked),
      installHintSeen: Boolean(checklist.installHintSeen),
      firstRequestHintSeen: Boolean(checklist.firstRequestHintSeen),
      verificationHintSeen: Boolean(checklist.verificationHintSeen)
    }
  };
}

function dashboardEditMode() {
  return state.route === 'profile' && dashboardEditing;
}

function setDashboardEditMode(editing) {
  dashboardEditing = Boolean(editing);
  render();
}

function dashboardLayoutPayload() {
  return sanitizeDashboardLayout(state.dashboard || {});
}

function dashboardStateFor(tileIds = [], isAdmin = isAdminRole()) {
  const defaults = dashboardDefaults(isAdmin).filter(id => tileIds.includes(id));
  const current = state.dashboard || {};
  const migrated = Number(current.version || 0) < 2;
  const order = migrated ? [] : (Array.isArray(current.order) ? current.order.filter(id => tileIds.includes(id)) : []);
  const hidden = Array.isArray(current.hidden) ? current.hidden.filter(id => tileIds.includes(id)) : [];
  const collapsed = migrated
    ? seed.dashboard.collapsed.filter(id => tileIds.includes(id))
    : (Array.isArray(current.collapsed) ? current.collapsed.filter(id => tileIds.includes(id)) : []);
  const mergedOrder = [...order, ...defaults.filter(id => !order.includes(id)), ...tileIds.filter(id => !order.includes(id) && !defaults.includes(id))];
  state.dashboard = { ...current, version: 2, order: mergedOrder, hidden, collapsed };
  delete state.dashboard.editing;
  return state.dashboard;
}

function dashboardTileShell(tile, index, total, collapsedSet = new Set()) {
  const editing = dashboardEditMode();
  const collapsed = collapsedSet.has(tile.id);
  return `
    <div class="dashboard-tile ${tile.span === 'full' ? 'span-full' : tile.span === 'wide' ? 'span-wide' : ''} ${editing ? 'is-editable' : ''} ${collapsed ? 'is-collapsed' : ''}" data-dashboard-tile="${escapeHtml(tile.id)}" draggable="${editing ? 'true' : 'false'}">
      ${collapsed ? `
        <button class="dashboard-collapsed-summary" type="button" data-action="dashboard-toggle-collapse" data-tile="${escapeHtml(tile.id)}" aria-expanded="false">
          <span>${escapeHtml(tile.label)}</span>
          <span>${iconSvg('chevronDown')} Aufklappen</span>
        </button>
      ` : `<div class="dashboard-tile-content">${tile.html}</div>`}
    </div>
  `;
}

function renderDashboardLayoutSettings() {
  const admin = isAdminRole();
  const labels = {kennzahlen:'Kennzahlen',kantonskarte:'Live-Kantonskarte',firmen:'Firmen / Arbeit',erststart:'Erste Schritte','so-funktionierts':'So funktioniert Quartinaut',einladungscodes:'Einladungscodes','community-dashboard':'Gemeinde-Auswertung','admin-metriken':'Admin-Auswertungen',wartung:'Wartung',prioritaeten:'Prioritäten'};
  const ids = dashboardDefaults(admin);
  const ui = dashboardStateFor(ids, admin);
  const hidden = new Set(ui.hidden), collapsed = new Set(ui.collapsed);
  const visible = ui.order.filter(id => !hidden.has(id));
  return `<section class="dashboard-settings-layout" aria-label="Startseite anpassen">
    <h3>Startseiten-Kacheln</h3><p class="help">Reihenfolge und Sichtbarkeit hier anpassen und anschliessend speichern.</p>
    <div class="form-grid">${ui.order.map(id => {
      const index = visible.indexOf(id), isHidden = hidden.has(id);
      return `<div class="card compact soft" data-dashboard-setting="${escapeHtml(id)}"><strong>${escapeHtml(labels[id] || id)}</strong>
        <p class="help">${isHidden?'Ausgeblendet':collapsed.has(id)?'Eingeklappt':'Sichtbar'}</p>
        <div class="row-actions">
          <button class="icon-button small" type="button" data-action="dashboard-move" data-tile="${escapeHtml(id)}" data-dir="-1" aria-label="${escapeHtml(labels[id])} nach oben" ${isHidden||index===0?'disabled':''}>↑</button>
          <button class="icon-button small" type="button" data-action="dashboard-move" data-tile="${escapeHtml(id)}" data-dir="1" aria-label="${escapeHtml(labels[id])} nach unten" ${isHidden||index===visible.length-1?'disabled':''}>↓</button>
          <button class="ghost-button small" type="button" data-action="${isHidden?'dashboard-show':'dashboard-hide'}" data-tile="${escapeHtml(id)}">${isHidden?'Einblenden':'Ausblenden'}</button>
          <button class="ghost-button small" type="button" data-action="dashboard-toggle-collapse" data-tile="${escapeHtml(id)}" aria-pressed="${collapsed.has(id)}">${collapsed.has(id)?'Aufgeklappt anzeigen':'Eingeklappt anzeigen'}</button>
        </div></div>`;
    }).join('')}</div><div class="row-actions" style="margin-top:12px;">
      <button class="primary-button small" type="button" data-action="dashboard-save">Speichern</button>
      <button class="ghost-button small" type="button" data-action="dashboard-reset">Zurücksetzen</button>
    </div></section>`;
}

function renderDashboard(allTiles = [], isAdmin = isAdminRole()) {
  const allowedTiles = allTiles.filter(tile => {
    if (tile.adminOnly && !isAdmin) return false;
    if (tile.residentOnly && isAdmin) return false;
    return Boolean(tile.html);
  });
  const tileIds = allowedTiles.map(tile => tile.id);
  const ui = dashboardStateFor(tileIds, isAdmin);
  const tilesById = new Map(allowedTiles.map(tile => [tile.id, tile]));
  const hiddenSet = new Set(ui.hidden);
  const collapsedSet = new Set(ui.collapsed);
  const orderedTiles = ui.order.map(id => tilesById.get(id)).filter(Boolean);
  const visibleTiles = orderedTiles.filter(tile => !hiddenSet.has(tile.id));
  const hiddenTiles = orderedTiles.filter(tile => hiddenSet.has(tile.id));
  const editing = dashboardEditMode();
  return `
    <section class="dashboard-grid" aria-label="Startseiten-Kacheln">
      ${visibleTiles.map((tile, index) => dashboardTileShell(tile, index, visibleTiles.length, collapsedSet)).join('')}
    </section>

  `;
}

function moveDashboardTile(tileId, direction) {
  const ui = state.dashboard || { order: [], hidden: [] };
  const visible = ui.order.filter(id => !(ui.hidden || []).includes(id));
  const index = visible.indexOf(tileId);
  if (index < 0) return;
  const target = Math.max(0, Math.min(visible.length - 1, index + direction));
  if (target === index) return;
  visible.splice(index, 1);
  visible.splice(target, 0, tileId);
  const hidden = ui.order.filter(id => (ui.hidden || []).includes(id));
  state.dashboard.order = [...visible, ...hidden];
  saveState();
  render();
}

function dropDashboardTile(sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return;
  const ui = state.dashboard || { order: [], hidden: [] };
  const order = ui.order.slice();
  const from = order.indexOf(sourceId);
  const to = order.indexOf(targetId);
  if (from < 0 || to < 0) return;
  order.splice(from, 1);
  order.splice(to, 0, sourceId);
  state.dashboard.order = order;
  saveState();
  render();
}

function setDashboardTileHidden(tileId, hidden) {
  const ui = state.dashboard || { order: [], hidden: [] };
  const hiddenSet = new Set(ui.hidden || []);
  if (hidden) hiddenSet.add(tileId);
  else hiddenSet.delete(tileId);
  state.dashboard.hidden = [...hiddenSet];
  saveState();
  render();
}

async function setDashboardTileCollapsed(tileId, collapsed) {
  const ui = state.dashboard || { order: [], hidden: [], collapsed: [] };
  const collapsedSet = new Set(ui.collapsed || []);
  if (collapsed) collapsedSet.add(tileId);
  else collapsedSet.delete(tileId);
  state.dashboard.collapsed = [...collapsedSet];
  const dashboard = dashboardLayoutPayload();
  saveState();
  if (authState.user) syncCurrentUser({ dashboard });
  render();
  if (isFirebaseMode()) {
    await updateFirebaseProfile({ dashboard });
  }
  toast(collapsed ? 'Kachel eingeklappt und gespeichert.' : 'Kachel aufgeklappt und gespeichert.');
}

function stopDashboardMasonry() {
  // Das Dashboard nutzt ein stabiles CSS-Grid. Keine laufenden Layout-Beobachter.
}

function layoutDashboardMasonry() {
  // Rückwärtskompatibler No-op für bestehende Aufrufer.
}

function scheduleDashboardMasonry() {
  // CSS übernimmt die responsive Anordnung ohne JavaScript-Neuberechnung.
}

function startDashboardMasonry() {
  stopDashboardMasonry();
}

function resetDashboardLayout() {
  state.dashboard = structuredClone(seed.dashboard);
  dashboardEditing = true;
  saveState();
  render();
  toast('Startseite zurückgesetzt.');
}

async function saveDashboardLayout() {
  const dashboard = dashboardLayoutPayload();
  dashboardEditing = false;
  document.querySelectorAll('.dashboard-controls, .dashboard-hidden, .dashboard-tile-toolbar').forEach(node => {
    node.hidden = true;
  });
  document.querySelectorAll('.dashboard-tile').forEach(node => {
    node.classList.remove('is-editable', 'is-dragging', 'drop-target');
    node.setAttribute('draggable', 'false');
  });
  saveState();
  render();
  if (authState.user) syncCurrentUser({ dashboard });
  if (isFirebaseMode()) {
    await updateFirebaseProfile({ dashboard });
  }
  toast('Startseite gespeichert.');
}

function renderMyProceduresCard({ detailed = false } = {}) {
  const pending = ownPendingRequests();
  const rejected = ownRejectedRequests();
  const openOwn = ownOpenRequests();
  const processes = ownOpenProcessRequests();
  const unread = unreadChatCount();
  const compactItems = [
    ['In Prüfung', pending.length, 'Beiträge warten auf Admin-Freigabe'],
    ['Abgelehnt', rejected.length, 'Beiträge können überarbeitet werden'],
    ['Online', openOwn.length, 'freigegebene eigene Beiträge'],
    ['Chats', activePrivateChats().length, `${unread} ungelesen`],
    ['Anträge', processes.length, 'Verifizierung, Name oder Standort']
  ];
  const pendingList = [...pending, ...rejected].slice(0, detailed ? 8 : 3);
  return `
    <article class="card my-process-card">
      <div class="request-head">
        <div>
          <h2>Meine Vorgänge</h2>
          <p>Deine Beiträge, Chats und offenen Anträge an einem Ort.</p>
        </div>
        <button class="ghost-button small" data-route="profile">Details</button>
      </div>
      <div class="process-grid" style="margin-top:14px;">
        ${compactItems.map(([label, value, help]) => `
          <div class="readonly-field">
            <strong>${escapeHtml(value)}</strong>
            <span>${escapeHtml(label)}</span>
            <small>${escapeHtml(help)}</small>
          </div>
        `).join('')}
      </div>
      ${detailed && pendingList.length ? `
        <div class="list" style="margin-top:14px;">
          ${pendingList.map(req => `
            <section class="card compact soft request-card request-kind-${requestToneClass(req)}">
              <div class="badges">${requestStatusBadge(req)}<span class="badge">${escapeHtml(req.category || 'Anliegen')}</span></div>
              <strong>${escapeHtml(req.title || 'Ohne Titel')}</strong>
              ${req.rejectionReason ? `<p class="help">${escapeHtml(req.rejectionReason)}</p>` : '<p class="help">Dieser Beitrag ist noch nicht öffentlich sichtbar.</p>'}
              <div class="row-actions" style="margin-top:10px;">
                <button class="ghost-button small" data-action="edit-request" data-id="${escapeHtml(req.id)}">Überarbeiten</button>
              </div>
            </section>
          `).join('')}
        </div>
      ` : `
        <p class="help" style="margin-top:12px;">
          ${pending.length || rejected.length
            ? `${pending.length} in Prüfung${rejected.length ? `, ${rejected.length} abgelehnt` : ''}.`
            : 'Keine Beiträge in Prüfung oder Überarbeitung.'}
          ${detailed ? '' : ' Details im Profil.'}
        </p>
      `}
    </article>
  `;
}

function renderOnboardingChecklistCard() {
  const onboarding = normalizeOnboardingState(state.onboarding);
  const checklist = onboarding.checklist || {};
  const steps = [
    { key: 'profileChecked', label: 'Profil geprüft', done: checklist.profileChecked, action: 'mark' },
    { key: 'locationChecked', label: 'Gemeinde/Standort verstanden', done: checklist.locationChecked, action: 'mark' },
    { key: 'notificationsChecked', label: 'Benachrichtigungen geprüft', done: checklist.notificationsChecked || notificationPermissionState() === 'granted', action: 'notifications' },
    { key: 'installHintSeen', label: 'Installation angeschaut', done: checklist.installHintSeen || isInstalledPwa(), action: 'install' },
    { key: 'firstRequestHintSeen', label: 'Schwarzes Brett verstanden', done: checklist.firstRequestHintSeen || ownRequests().length > 0, action: 'bulletin' },
    { key: 'verificationHintSeen', label: 'Verifizierung geprüft', done: checklist.verificationHintSeen || state.profile.verified || state.profile.verificationStatus === 'pending', action: 'verification' }
  ];
  const done = steps.filter(step => step.done).length;
  return `
    <article class="card onboarding-checklist-card">
      <div class="request-head">
        <div>
          <h2>Erste Schritte</h2>
          <p>Kurze Wegleitung für die App: Schwarzes Brett, Installation und Vertrauen.</p>
        </div>
        <span class="status-pill">${done}/${steps.length}</span>
      </div>
      <div class="list" style="margin-top:14px;">
        ${steps.map(step => `
          <section class="check-row compact-check">
            <span class="check-dot ${step.done ? 'done' : ''}">${step.done ? '✓' : ''}</span>
            <span><strong>${escapeHtml(step.label)}</strong><small>${step.key === 'firstRequestHintSeen' ? '„Brett“ bedeutet lokales Schwarzes Brett für Hilfe, Suche, Angebote und Hinweise.' : ''}</small></span>
            <button class="ghost-button small" data-action="onboarding-checklist" data-step="${escapeHtml(step.key)}" data-step-action="${escapeHtml(step.action)}">${step.done ? 'Erledigt' : 'Öffnen'}</button>
          </section>
        `).join('')}
      </div>
      <button class="secondary-button small" data-action="reopen-onboarding" style="margin-top:14px;">${iconSvg('help')} Wegleitung anzeigen</button>
    </article>
  `;
}

function renderOfficialNoticeCard(notice, { compact = false } = {}) {
  const priorityBadge = notice.priority === 'wichtig'
    ? '<span class="badge warn">Wichtig</span>'
    : '<span class="badge info">Info</span>';
  const statusBadge = canManageOfficialNotices() && notice.status !== 'online'
    ? `<span class="badge">${escapeHtml(notice.status)}</span>`
    : '';
  const validUntil = notice.validUntil ? `<small>Gültig bis ${escapeHtml(formatDate(notice.validUntil))}</small>` : '';
  return `
    <section class="card compact official-notice-card">
      <div class="badges">${priorityBadge}<span class="badge official">Gemeinde-Hinweis</span><span class="badge">${escapeHtml(notice.category || 'Allgemein')}</span>${statusBadge}</div>
      <h3 style="margin-top:8px;">${escapeHtml(notice.title)}</h3>
      <p>${escapeHtml(notice.text)}</p>
      <div class="alert-meta"><span>${escapeHtml(notice.createdByLabel || 'Gemeinde')}</span><span>·</span><span>${escapeHtml(fmtTime(notice.createdAt))}</span>${validUntil ? `<span>·</span>${validUntil}` : ''}</div>
      ${canManageOfficialNotices() && !compact ? `
        <div class="row-actions" style="margin-top:12px;">
          <button class="success-button small" data-action="publish-notice" data-id="${escapeHtml(notice.id)}" ${notice.status === 'online' ? 'disabled' : ''}>Online stellen</button>
          <button class="ghost-button small" data-action="archive-notice" data-id="${escapeHtml(notice.id)}">Archivieren</button>
        </div>
      ` : ''}
    </section>
  `;
}

function renderOfficialNoticesCard() {
  const notices = visibleOfficialNotices();
  const manage = canManageOfficialNotices();
  return `
    <article class="card official-notices-card" id="officialNoticesCard" tabindex="-1">
      <div class="request-head">
        <div>
          <h2>Offizielle Gemeinde-Hinweise</h2>
          <p>Normale amtliche oder organisatorische Informationen, getrennt von dringenden Alarmen.</p>
        </div>
        ${manage ? `<button class="secondary-button small" data-action="new-official-notice">${iconSvg('edit')} Hinweis erstellen</button>` : ''}
      </div>
      <div class="list" style="margin-top:14px;">
        ${notices.length ? notices.slice(0, 4).map(notice => renderOfficialNoticeCard(notice, { compact: !manage })).join('') : '<div class="empty">Keine aktuellen Gemeinde-Hinweise.</div>'}
      </div>
    </article>
  `;
}

function requestApprovalCard(req) {
  return `
    <section class="card compact request-card request-kind-${requestToneClass(req)}">
      <div class="badges">${requestStatusBadge(req)}<span class="badge">${escapeHtml(req.type || 'Anliegen')}</span><span class="badge">${escapeHtml(req.area || '')}</span>${trustBadge(profileFromRequest(req), { detail: true })}</div>
      <h3 style="margin-top:8px;">${escapeHtml(req.title || 'Ohne Titel')}</h3>
      <p>${escapeHtml(req.text || '')}</p>
      <p class="help">Eingereicht von ${escapeHtml(requestAuthorLabel(req))} · ${escapeHtml(fmtTime(req.submittedAt || req.createdAt))}</p>
      <div class="row-actions" style="margin-top:12px;">
        <button class="success-button small" data-action="approve-request-publication" data-id="${escapeHtml(req.id)}">Freigeben</button>
        <button class="ghost-button small" data-action="revise-request-publication" data-id="${escapeHtml(req.id)}">Überarbeitung</button>
        <button class="danger-button small" data-action="reject-request-publication" data-id="${escapeHtml(req.id)}">Ablehnen</button>
        <button class="ghost-button small" data-action="edit-request" data-id="${escapeHtml(req.id)}">Bearbeiten</button>
      </div>
    </section>
  `;
}

function homePrioritySignal() {
  const now = Date.now();
  const alerts = visibleAlerts()
    .filter(alert => !alert.validUntil || new Date(alert.validUntil).getTime() >= now)
    .sort((a, b) => {
      const rank = { critical: 3, warn: 2, info: 1 };
      return (rank[b.severity] || 0) - (rank[a.severity] || 0) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  const critical = alerts.find(alert => alert.severity === 'critical');
  if (critical) return { kind: 'critical', label: 'Kritischer Alarm', title: critical.title, text: critical.text, route: 'alarme' };
  const importantNotice = visibleOfficialNotices().find(notice => notice.priority === 'wichtig' && notice.status === 'online');
  if (importantNotice) return { kind: 'important', label: 'Wichtiger Gemeinde-Hinweis', title: importantNotice.title, text: importantNotice.text, action: 'focus-official-notices' };
  const warning = alerts.find(alert => alert.severity === 'warn');
  if (warning) return { kind: 'warning', label: 'Aktuelle Gemeindemeldung', title: warning.title, text: warning.text, route: 'alarme' };
  return null;
}

function renderHomePriorityStrip() {
  const signal = homePrioritySignal();
  if (!signal) return '';
  const action = signal.route
    ? `<button class="ghost-button small" data-route="${escapeHtml(signal.route)}">Öffnen</button>`
    : `<button class="ghost-button small" data-action="${escapeHtml(signal.action)}">Öffnen</button>`;
  return `
    <section class="home-priority-strip ${escapeHtml(signal.kind)}" aria-label="${escapeHtml(signal.label)}">
      <span class="home-priority-icon">${iconSvg('alert')}</span>
      <div><small>${escapeHtml(signal.label)}</small><strong>${escapeHtml(signal.title)}</strong><p>${escapeHtml(signal.text)}</p></div>
      ${action}
    </section>
  `;
}

function renderRelevantHomeCard(requests = []) {
  return `
    <article class="card home-relevant-card">
      <div class="request-head">
        <div><h2>Relevante Anliegen</h2><p>Passende Gesuche und Angebote aus deinem Gebiet.</p></div>
        <button class="ghost-button small" data-route="bulletin">Alle anzeigen</button>
      </div>
      <div class="home-request-list">
        ${requests.length ? requests.map(req => `
          <section class="home-request-row request-kind-${requestToneClass(req)}">
            <div class="badges"><span class="badge ${req.type === 'Biete' ? 'offer' : ''}">${escapeHtml(req.type || 'Anliegen')}</span><span class="badge">${escapeHtml(req.category || 'Allgemein')}</span>${trustBadge(profileFromRequest(req), { detail: true })}</div>
            <h3>${escapeHtml(req.title || 'Ohne Titel')}</h3>
            <p>${escapeHtml(req.text || '')}</p>
            ${postPhotoGallery(req.photoPaths)}
            <small>${escapeHtml(req.area || '')} · ${escapeHtml(fmtTime(req.createdAt))}</small>
          </section>
        `).join('') : '<div class="empty compact-empty">Noch keine offenen Anliegen. Erfasse das erste Gesuch oder Angebot.</div>'}
      </div>
    </article>
  `;
}

function renderAdminWorkQueueCard(publicationQueue, openModeration, pendingApprovals) {
  return `
    <article class="card admin-work-queue">
      <div class="request-head">
        <div><h2>Admin-Aufgaben</h2><p>Freigaben und Prüfungen an einem Ort.</p></div>
        <div class="row-actions compact-actions">
          <button class="primary-button small" data-action="new-alert">Alarm</button>
          <button class="secondary-button small" data-action="new-official-notice">Gemeinde-Hinweis</button>
        </div>
      </div>
      <div class="admin-task-stats">
        <div><strong>${formatNumber(publicationQueue.length)}</strong><span>Beitragsfreigaben</span></div>
        <div><strong>${formatNumber(openModeration.length)}</strong><span>Moderationsfälle</span></div>
        <div><strong>${formatNumber(pendingApprovals)}</strong><span>offene Anträge</span></div>
        <div><strong>${formatNumber(unreadChatCount())}</strong><span>ungelesene Chats</span></div>
      </div>
      ${publicationQueue.length ? `<div class="admin-approval-preview">${publicationQueue.slice(0, 3).map(req => `
        <section class="admin-approval-row">
          <div><div class="badges">${requestStatusBadge(req)}<span class="badge">${escapeHtml(req.type || 'Anliegen')}</span></div><strong>${escapeHtml(req.title || 'Ohne Titel')}</strong><small>${escapeHtml(requestAuthorLabel(req))} · ${escapeHtml(req.area || '')}</small></div>
          <div class="row-actions compact-actions"><button class="success-button small" data-action="approve-request-publication" data-id="${escapeHtml(req.id)}">Freigeben</button><button class="ghost-button small" data-action="edit-request" data-id="${escapeHtml(req.id)}">Prüfen</button></div>
        </section>
      `).join('')}</div>` : '<p class="help admin-queue-empty">Aktuell wartet kein Beitrag auf Freigabe.</p>'}
      <div class="row-actions compact-actions admin-queue-links">
        <button class="ghost-button small" data-route="profile">Anträge und Nutzer</button>
        <button class="ghost-button small" data-route="alarme">Alarme verwalten</button>
      </div>
    </article>
  `;
}

function renderV2Journey() {
  const own = state.requests.filter(req => requestOwnerUid(req) === authState.user?.uid)
    .sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0,3);
  if (!own.length) return '';
  return `<article class="card v2-journey" aria-label="Deine Anliegen">
    <div class="v2-section-heading"><div><span class="v2-kicker">Dein Überblick</span><h2>Meine Anliegen</h2></div><button class="ghost-button small" data-route="bulletin">Zum Brett</button></div>
    <div class="v2-journey-items">${own.map(req => {
      const progress=requestJourney(req,state.chats);
      return `<div class="v2-journey-item"><div><strong>${escapeHtml(req.title || 'Ohne Titel')}</strong><small>${escapeHtml(progress.detail)}</small></div><span class="v2-status-tag">${escapeHtml(progress.label)}</span></div>`;
    }).join('')}</div>
  </article>`;
}
function renderV2Matches() {
  const prefs=readPreferences(authState.user?.uid);
  const matches=matchHelpRequests(state.requests, {
    uid:authState.user?.uid, categories:prefs.categories, area:state.profile.area,
    score: relevantScore
  }).filter(req => requestIsReachable(req, parseDistanceFilterKm(state.filter.distanceKm)));
  const filtered=prefs.categories.length ? matches.filter(req => prefs.categories.includes(req.category)) : matches;
  const shown=filtered.slice(0,3);
  return `<article class="card v2-matching" aria-label="Passende Hilfegesuche">
    <div class="v2-section-heading"><div><span class="v2-kicker">Für dich ausgewählt</span><h2>Hier kannst du helfen</h2></div><button class="ghost-button small" data-route="bulletin">Alle ansehen</button></div>
    ${prefs.categories.length ? `<p class="v2-caption">Interessen: ${prefs.categories.map(escapeHtml).join(' · ')}</p>` : '<p class="v2-caption">Aktuelle Hilfegesuche aus deiner Umgebung. Wähle im Profil Interessen für passendere Vorschläge.</p>'}
    <div class="v2-match-list">${shown.length ? shown.map(req => `<div class="v2-match-item"><span class="v2-mini-icon" aria-hidden="true">♡</span><div><strong>${escapeHtml(req.title)}</strong><small>${escapeHtml(req.category)} · ${escapeHtml(req.area || '')}</small></div><button class="secondary-button small" data-action="open-chat" data-id="${escapeHtml(req.id)}">Helfen</button></div>`).join('') : '<p class="empty">Noch keine passenden Hilfegesuche. Schaue später wieder vorbei oder ändere deine Interessen.</p>'}</div>
  </article>`;
}
// Quartinaut 4.6.2 – Dashboard-Foto ist rein lokal und pro angemeldetem Konto getrennt.
function v462DashboardUid(){return authState.user?.uid || 'guest';}
function v462HasDashboardPhoto(){return Boolean(readDashboardPhoto(v462DashboardUid()));}
function v462ApplyDashboardPhoto(){
  const hero=document.querySelector('#main .v2-hero');
  if (!hero) return;
  const photo=readDashboardPhoto(v462DashboardUid());
  hero.classList.toggle('v462-has-photo',Boolean(photo));
  if(photo) hero.style.setProperty('--v462-dashboard-photo',`url("${photo}")`);
  else hero.style.removeProperty('--v462-dashboard-photo');
}
function v462BindDashboardBackground(){
  v462ApplyDashboardPhoto();
  const settings=document.querySelector('.v462-background-setting');
  if(!settings)return;
  settings.querySelectorAll('[data-v462-choose-background]').forEach(button=>button.addEventListener('click',()=>{
    settings.querySelector('[data-v462-background-file]')?.click();
  }));
  settings.querySelectorAll('[data-v462-background-file]').forEach(input=>input.addEventListener('change',()=>{
    const file=input.files?.[0];
    if(!file)return;
    runAsyncAction(async()=>{
      const uidBefore=v462DashboardUid();
      await openDashboardPhotoEditor(file,{
        expectedUid:uidBefore,currentUid:v462DashboardUid,
        onSave:async jpeg=>{
          if(v462DashboardUid()!==uidBefore)throw new Error('Das Konto wurde gewechselt.');
          try{saveDashboardPhoto(uidBefore,jpeg);}catch(error){throw new Error(error?.name==='QuotaExceededError'?'Gerätespeicher voll. Bitte Speicherplatz freigeben.':error.message);}
          toast('Dein Dashboard-Hintergrund wurde gespeichert.');render();
        }
      });
    });
    input.value='';
  }));
  settings.querySelectorAll('[data-v462-reset-background]').forEach(button=>button.addEventListener('click',()=>{
    try{clearDashboardPhoto(v462DashboardUid());toast('Standardhintergrund wiederhergestellt.');render();}
    catch{toast('Das Bild konnte nicht entfernt werden.');}
  }));
}

function renderHome() {
  const isAdmin=isAdminRole();
  const open=state.requests.filter(r => r.status==='offen' && !v46IsHidden('request',r.id));
  const latest=open.slice().sort(sortByLocalRelevance).slice(0,3);
  const publicationQueue=pendingPublicationRequests();
  const openModeration=state.moderation.filter(item => (item.status || 'offen')==='offen');
  const pendingApprovals=state.locationChangeRequests.filter(r=>r.status==='offen').length
    + state.verificationRequests.filter(r=>['offen','zurückgestellt'].includes(r.status)).length
    + state.changeRequests.filter(r=>['offen','in_pruefung'].includes(r.status)).length;
  const extraHelp = renderV2Journey() + (open.length ? renderV2Matches() : '');
  const dashboardTiles=[
        {id:'kennzahlen',label:'Kennzahlen',span:'full',html:`<section class="grid four">${metricCard(open.length,'offene Anliegen')}${metricCard(activePrivateChats().length,'aktive Vermittlungen')}${metricCard(visibleAlerts().length,'aktive Alarme')}${metricCard(state.archive.length,'archiviert')}</section>`},
    {id:'erststart',label:'Erste Schritte',residentOnly:true,html:renderOnboardingChecklistCard()},
    {id:'kantonskarte',label:'Live-Kantonskarte',html:renderCantonLiveMap()},
    {id:'firmen',label:'Firmen / Arbeit',html:renderCompanyAreaCard()},
    {id:'so-funktionierts',label:'So funktioniert Quartinaut',residentOnly:true,html:`<article class="card"><h2>So funktioniert Quartinaut</h2><p>Hilfe suchen, anbieten und über private Chats organisieren. Offizielle Alarme stammen von geprüften Verantwortlichen.</p><button class="secondary-button" data-action="reopen-onboarding">Kurze Einführung öffnen</button></article>`},
    {id:'einladungscodes',label:'Einladungscodes',adminOnly:true,html:`<article class="card"><h2>Einladungscodes</h2><div class="table-wrap">${inviteTable()}</div></article>`},
    {id:'community-dashboard',label:'Gemeinde-Auswertung',adminOnly:true,html:renderCommunityDashboardCard()},
    {id:'admin-metriken',label:'Admin-Auswertungen',adminOnly:true,html:renderAdminMetricsCard()},
    {id:'wartung',label:'Wartung',adminOnly:true,html:renderAdminMaintenanceCard()},
    {id:'prioritaeten',label:'Prioritäten',adminOnly:true,html:renderAreaPriorityCard()}
  ];
  return `
    <section class="v2-hero" aria-label="Nachbarschaft">
      <div class="v2-hero-top">
        <span class="v2-location-chip">${iconSvg('location')} ${escapeHtml(state.profile.area || 'Dein Quartier')}</span>
      </div>

      <span class="v4-welcome">GRÜEZI IN DEINER GEMEINDE</span>
      <h1>Gemeinsam mehr<br>erreichen.</h1>
      <p>Deine Gemeinde. Deine Nachbarn. Alles an einem Ort.</p>
      <button type="button" class="v4-hero-search" data-route="search">⌕ &nbsp; Beiträge, Vereine, Anlässe suchen <span>→</span></button>
      <div class="v2-action-grid">
        <button class="v2-action-card v2-action-primary" data-action="new-need"><span aria-hidden="true">✋</span><strong>Hilfe suchen</strong><small>Ich brauche Unterstützung</small></button>
        <button class="v2-action-card v2-action-secondary" data-action="new-offer"><span aria-hidden="true">♡</span><strong>Hilfe anbieten</strong><small>Ich möchte helfen</small></button>
      </div>
    </section>
    <section class="v4-quick-links" aria-label="Entdecke dein Quartier">
      <button data-v3-open="lend" class="v4-quick-link"><span>🧰</span><strong>Leihbörse</strong><small>Ausleihen & teilen</small></button>
      <button data-v3-open="market" class="v4-quick-link"><span>🛍️</span><strong>Marktplatz</strong><small>Kaufen & verschenken</small></button>
      <button data-v3-open="group" class="v4-quick-link"><span>👥</span><strong>Vereine</strong><small>Gemeinsam aktiv</small></button>
      <button data-route="events" class="v4-quick-link"><span>📅</span><strong>Veranstaltungen</strong><small>Was ist los?</small></button>
    </section>
    <nav class="v461-quick-access" aria-label="Weitere Schnellzugriffe">
      <button type="button" data-route="inbox">🔔 Mitteilungen${inboxUnreadCount()?` <span class="v461-unread">${inboxUnreadCount()}</span>`:''}</button>
      <button type="button" data-route="saved">♡ Favoriten</button>
      <button type="button" data-route="map">📍 Karte</button>
    </nav>
    ${renderHomePriorityStrip()}
    ${renderMyQuartierPanel()}
    <section class="v4-section-title"><h2>Aktuelles aus deiner Nähe</h2><button data-route="bulletin" class="ghost-button small">Alle Beiträge →</button></section>
    <section class="v2-home-grid">${renderRelevantHomeCard(latest)}${renderOfficialNoticesCard()}</section>
    ${extraHelp ? `<details class="v4-home-options v461-help-details"><summary>Weitere Hilfe & eigene Anliegen</summary>${extraHelp}</details>` : ''}
    ${isAdmin ? `<section class="v2-admin-important">${renderAdminWorkQueueCard(publicationQueue,openModeration,pendingApprovals)}</section>` : ''}
    <details class="v2-extras" ${dashboardEditMode()?'open':''}>
      <summary>Weitere Bereiche und ${isAdmin?'Verwaltung':'Auswertungen'} <span>▾</span></summary>
      ${renderDashboard(dashboardTiles,isAdmin)}
    </details>
    ${hubBottomTile()}`;
}

function metricCard(value, label, sub = '') {
  return `<article class="card metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span>${sub ? `<small>${sub}</small>` : ''}</article>`;
}

function renderBulletin() {
  const requests=filterFeed(state.requests.filter(r=>requestMatches(r) && !v46IsHidden('request',r.id)),{kind:v46FeedFilter(),area:state.profile.area,lastSeenAt:v46LastSeenAt(),savedKeys:v46SavedPostKeys()}).sort(sortByLocalRelevance);
  const savedFilter=ownSavedBulletinFilter();
  const selectedDistance=String(state.filter.distanceKm || 'Alle');
  const activeFilters=state.filter.category!=='Alle' || selectedDistance!=='Alle';
  const types=['Alle','Suche','Biete'];
  const cats=['Alle',...orderedCategories()];
  return `<section class="v2-page-header">
     <span class="v2-kicker">Dein Quartier entdecken</span><h1>Schwarzes Brett</h1>
     <p>Hilfe suchen, Unterstützung anbieten und direkt miteinander sprechen.</p>
     <div class="v2-inline-actions"><button class="primary-button" data-action="new-need">${iconSvg('need')} Hilfe suchen</button><button class="secondary-button" data-action="new-offer">${iconSvg('offer')} Hilfe anbieten</button></div>
   </section>
   <section class="v21-board-shortcuts"><button class="secondary-button small" data-community-route="events">📅 Veranstaltungen</button><button class="ghost-button small" data-community-route="inbox">🔔 Mitteilungen</button></section>
   ${v46FilterControls()}
   <section class="v2-board-panel">
    <label class="v2-search-label" for="filterQ">Suche nach Stichworten</label>
    <div class="v2-search-row"><span aria-hidden="true">⌕</span><input id="filterQ" type="search" value="${escapeHtml(state.filter.q)}" placeholder="Was suchst du?" autocomplete="off" /></div>
    <div class="v2-type-pills" aria-label="Angebote oder Gesuche filtern">${types.map(type=>`<button class="v2-pill ${type===state.filter.type?'active':''}" data-action="v2-type" data-value="${escapeHtml(type)}" aria-pressed="${type===state.filter.type}">${escapeHtml(type==='Alle'?'Alles':type==='Suche'?'Gesuche':'Angebote')}</button>`).join('')}</div>
    <div class="v2-category-chips" aria-label="Kategorie wählen">${cats.map(cat=>`<button class="v2-chip ${cat===state.filter.category?'active':''}" data-action="v2-category" data-value="${escapeHtml(cat)}" aria-pressed="${cat===state.filter.category}">${escapeHtml(cat)}</button>`).join('')}</div>
    <details class="v2-filter-drawer" ${activeFilters?'open':''}><summary>Weitere Filter und Benachrichtigungen</summary>
      <div class="v2-filter-content"><div class="filters">
        <label>Kategorie <select id="filterCategory">${cats.map(cat=>`<option ${cat===state.filter.category?'selected':''}>${escapeHtml(cat)}</option>`).join('')}</select></label>
        <label>Typ <select id="filterType">${types.map(type=>`<option ${type===state.filter.type?'selected':''}>${escapeHtml(type)}</option>`).join('')}</select></label>
        <label>Distanz <select id="filterDistance">${DISTANCE_FILTER_VALUES.map(value=>`<option value="${value}" ${value===selectedDistance?'selected':''}>${value==='Alle'?'Alle':`bis ${value} km`}</option>`).join('')}</select></label>
      </div><div class="row-actions compact-actions"><button class="secondary-button small" data-action="save-bulletin-filter">${iconSvg('bell')} Filter speichern</button>
        <button class="ghost-button small" data-action="load-bulletin-filter" ${savedFilter?'':'disabled'}>Gespeicherten Filter laden</button>
        ${savedFilter?'<button class="ghost-button small" data-action="delete-bulletin-filter">Filter löschen</button>':''}</div>
      <p class="help">Gespeicherte Filter können – bei aktiviertem Push – passende neue Anliegen melden. Distanzfilter benötigen eine Standortfreigabe.</p></div>
    </details>
   </section>
   <section class="v2-board-results"><div class="v2-section-heading"><div><h2>Aktuelle Beiträge</h2><p>${requests.length} passende Anliegen</p></div><button class="ghost-button small" data-action="new-request">+ Neu</button></div>
     <div class="v2-request-grid">${requests.length?requests.map(requestCard).join(''):'<div class="empty">Noch keine passenden Einträge. Passe den Filter an oder erstelle ein neues Anliegen.</div>'}</div>
   </section>`;
}

function renderAlarme() {
  const isAdmin = isAdminRole();
  const alerts = visibleAlerts().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const unread = alerts.filter(alert => !hasSeenAlert(alert.id)).length;
  const pushTokensInArea = state.deviceTokens.filter(token => token.area === state.profile.area && token.active !== false).length;
  return `
    <section class="page-title">
      <h1>Lokale Alarme</h1>
      <p>Nur verifizierte Gemeinde-Meldungen: Strassensperrung, Wasserunterbruch, wichtige Hinweise. Keine Diskussion, keine Werbung.</p>
      <div class="badges">
        <span class="badge">${unread} ungelesen</span>
        ${isAdmin ? `<span class="badge info">Push-Targets im Gebiet: ${pushTokensInArea}</span>` : ''}
      </div>
      <div class="row-actions">
        ${isAdmin ? '<button class="primary-button" data-action="new-alert">Alarm erstellen</button>' : ''}
        <button class="${isAdmin ? 'secondary-button' : 'primary-button'}" data-action="enable-notifications">${iconSvg('bell')} Benachrichtigungen aktivieren</button>
        <button class="ghost-button" data-action="test-notification">${iconSvg('check')} Test senden</button>
        <button class="ghost-button" data-action="push-diagnostics">${iconSvg('help')} Push prüfen</button>
      </div>
    </section>

    <section class="list" style="margin-top:4px;">
      ${alerts.length ? alerts.map(alertCard).join('') : '<div class="empty">Aktuell keine aktiven Alarme.</div>'}
    </section>
  `;
}

function chatInboxCard(chat, options = {}) {
  const trashView = options.view === 'trash';
  const unread = chatHasUnread(chat);
  const muted = isChatMuted(chat);
  const preview = chat.lastMessagePreview || 'Noch keine Nachricht.';
  const trashBadge = trashView ? `<span class="badge warn">${escapeHtml(chatTrashLabel(chat))}</span>` : '';
  const actions = trashView
    ? `
          <button class="secondary-button small" data-action="restore-chat" data-chat-id="${escapeHtml(chat.id)}">${iconSvg('restore')} Wiederherstellen</button>
          <button class="ghost-button small" data-action="purge-chat" data-chat-id="${escapeHtml(chat.id)}">${iconSvg('trash')} Endgültig löschen</button>
        `
    : `
          <button class="secondary-button small" data-action="open-private-chat" data-chat-id="${escapeHtml(chat.id)}">${iconSvg('chat')} Öffnen</button>
          <button class="ghost-button small" data-action="toggle-chat-mute" data-chat-id="${escapeHtml(chat.id)}">${iconSvg(muted ? 'bell' : 'bellOff')} ${muted ? 'Aktivieren' : 'Stumm'}</button>
          <button class="ghost-button small" data-action="trash-chat" data-chat-id="${escapeHtml(chat.id)}">${iconSvg('trash')} Papierkorb</button>
        `;
  return `
    <article class="card chat-inbox-card ${unread ? 'unread' : ''}">
      <div class="chat-inbox-main">
        <div>
          <div class="badges">
            ${unread ? '<span class="badge warn">neu</span>' : ''}
            ${trashBadge}
            ${!trashView ? (muted ? '<span class="badge">stumm</span>' : '<span class="badge info">Push aktiv</span>') : ''}
            <span class="badge">privat</span>
          </div>
          <h3>${escapeHtml(chatPeerLabel(chat))}</h3>
          <p>${escapeHtml(chat.requestTitle || 'Direktvermittlung')}</p>
          <small>${escapeHtml(preview)}${chat.lastMessageAt ? ` · ${escapeHtml(fmtTime(chat.lastMessageAt))}` : ''}</small>
        </div>
        <div class="row-actions chat-inbox-actions">
          ${actions}
        </div>
      </div>
    </article>
  `;
}

function renderChats() {
  const activeChats = state.chats
    .filter(chat => isChatVisibleForUser(chat))
    .sort((a, b) => Number(chatHasUnread(b)) - Number(chatHasUnread(a)) || new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
  const trashChats = state.chats
    .filter(chat => isChatInTrashForUser(chat))
    .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
  const view = state.chatView === 'trash' ? 'trash' : 'active';
  const chats = view === 'trash' ? trashChats : activeChats;
  const unread = unreadChatCount();
  const emptyText = view === 'trash'
    ? 'Der Papierkorb ist leer. Gelöschte Chats bleiben hier 30 Tage sichtbar.'
    : 'Noch keine privaten Chats. Öffne am Schwarzen Brett ein Anliegen und schreibe die erstellende Person an.';
  return `
    <section class="page-section">
      <div class="section-header">
        <div>
          <span class="eyebrow">Private Direktvermittlung</span>
          <h1>Chats</h1>
          <p class="section-description">Private 1:1-Unterhaltungen zu Hilfe-Angeboten und Gesuchen. Nur die zwei Teilnehmer können den Verlauf lesen.</p>
        </div>
        <div class="row-actions">
          <span class="status-pill"><strong>${formatNumber(unread)}</strong> ungelesen</span>
          <button class="ghost-button" data-action="enable-notifications">${iconSvg('bell')} Push aktivieren</button>
        </div>
      </div>
      <div class="segmented chat-view-tabs" role="tablist" aria-label="Chat-Ansicht">
        <button class="${view === 'active' ? 'active' : ''}" type="button" data-action="set-chat-view" data-chat-view="active">${iconSvg('chat')} Aktiv (${formatNumber(activeChats.length)})</button>
        <button class="${view === 'trash' ? 'active' : ''}" type="button" data-action="set-chat-view" data-chat-view="trash">${iconSvg('trash')} Papierkorb (${formatNumber(trashChats.length)})</button>
      </div>
      ${view === 'trash' ? `<p class="help">Chats im Papierkorb werden nach ${CHAT_TRASH_RETENTION_DAYS} Tagen automatisch aus deiner Ansicht entfernt. Beim Gegenüber bleiben sie erhalten, bis diese Person ebenfalls löscht.</p>` : ''}
      <div class="list chat-inbox-list">
        ${chats.length ? chats.map(chat => chatInboxCard(chat, { view })).join('') : `<div class="empty">${emptyText}</div>`}
      </div>
    </section>
  `;
}

function optionsForMultiSelect(values = [], selected = []) {
  const selectedSet = new Set(selected);
  return values.map(value => `<option value="${escapeHtml(value)}" ${selectedSet.has(value) ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('');
}

function notificationKeywordRuleCard(rule) {
  const sourceLabels = {
    alerts: 'Alarme',
    officialNotices: 'Gemeinde-Hinweise',
    requests: 'Schwarzes Brett'
  };
  const sourceText = rule.sources.map(source => sourceLabels[source] || source).join(', ');
  const categoryText = rule.categories.length ? rule.categories.join(', ') : 'alle Kategorien';
  const scopeText = rule.scope === 'canton' ? 'ganzer Kanton' : 'eigene Gemeinde';
  return `
    <section class="notification-keyword-rule ${rule.enabled ? '' : 'is-disabled'}">
      <div>
        <strong>${escapeHtml(rule.term)}</strong>
        <p>${escapeHtml(sourceText)} · ${escapeHtml(categoryText)} · ${escapeHtml(scopeText)}</p>
      </div>
      <div class="row-actions compact-actions">
        <button class="ghost-button small" type="button" data-action="toggle-notification-keyword" data-id="${escapeHtml(rule.id)}">${rule.enabled ? 'Pausieren' : 'Aktivieren'}</button>
        <button class="ghost-button small" type="button" data-action="edit-notification-keyword" data-id="${escapeHtml(rule.id)}">Bearbeiten</button>
        <button class="danger-button small" type="button" data-action="delete-notification-keyword" data-id="${escapeHtml(rule.id)}">Löschen</button>
      </div>
    </section>
  `;
}

function renderNotificationPreferencesCard({ inline = false } = {}) {
  const prefs = currentNotificationPreferences();
  const permission = notificationPermissionState();
  const statusLabel = permission === 'granted'
    ? (prefs.enabled ? 'Push aktiv' : 'Push pausiert')
    : permission === 'denied' ? 'Im Browser blockiert' : 'Noch nicht freigegeben';
  const editing = inline || isEditCardOpen('profile-notifications');
  const activeKeywords = prefs.keywordRules.filter(rule => rule.enabled).length;
  return `
    <article class="card notification-preferences-card ${inline ? 'v453-notifications-inline' : ''}" data-edit-card="profile-notifications">
      ${inline ? `<p class="v453-status-help">Push-Status: <strong>${escapeHtml(statusLabel)}</strong></p>` : `<div class="request-head edit-card-head">
        <div><h2>Benachrichtigungen</h2><p>Bestimme selbst, welche lokalen Inhalte auf deinem Gerät erscheinen.</p></div>
        <div class="row-actions compact-actions">
          <span class="status-pill ${prefs.enabled && permission === 'granted' ? 'is-positive' : ''}">${escapeHtml(statusLabel)}</span>
          <button class="icon-button small" type="button" data-action="toggle-edit-card" data-edit-card-id="profile-notifications" aria-label="Benachrichtigungen bearbeiten" aria-expanded="${editing ? 'true' : 'false'}" title="${editing ? 'Bearbeitung schliessen' : 'Bearbeiten'}">${iconSvg('edit')}</button>
        </div></div>`}
      ${editing ? `<form id="notificationPreferencesForm" class="notification-preferences-form">
        <section class="notification-setting-group notification-master-setting">
          <label class="check-row">
            <input type="checkbox" name="enabled" ${prefs.enabled ? 'checked' : ''} />
            <span><strong>Push-Benachrichtigungen</strong><small>Hauptschalter für dieses Konto. Die Browserfreigabe bleibt zusätzlich erforderlich.</small></span>
          </label>
          <div class="notification-lock-note">${iconSvg('alert')} <span><strong>Kritische P0-Alarme</strong> werden bei aktivem Push immer zugestellt.</span></div>
        </section>

        <div class="notification-settings-grid">
          <section class="notification-setting-group">
            <h3>Gemeinde-Alarme</h3>
            <label class="check-row"><input type="checkbox" name="alertsEnabled" ${prefs.alerts.enabled ? 'checked' : ''} /><span><strong>Normale Alarme</strong><small>P1/P2-Meldungen der Gemeinde.</small></span></label>
            <label class="check-row"><input type="checkbox" name="alertSeverity" value="warn" ${prefs.alerts.severities.includes('warn') ? 'checked' : ''} /><span><strong>Wichtige Meldungen</strong><small>P1, aber kein akuter Notfall.</small></span></label>
            <label class="check-row"><input type="checkbox" name="alertSeverity" value="info" ${prefs.alerts.severities.includes('info') ? 'checked' : ''} /><span><strong>Informationen</strong><small>P2, allgemeine Alarmkanal-Hinweise.</small></span></label>
          </section>

          <section class="notification-setting-group">
            <h3>Gemeinde-Hinweise</h3>
            <label class="check-row"><input type="checkbox" name="noticesEnabled" ${prefs.officialNotices.enabled ? 'checked' : ''} /><span><strong>Offizielle Hinweise</strong><small>Amtliche und organisatorische Mitteilungen.</small></span></label>
            <label class="check-row"><input type="checkbox" name="noticePriority" value="wichtig" ${prefs.officialNotices.priorities.includes('wichtig') ? 'checked' : ''} /><span><strong>Wichtig</strong><small>Hinweise mit erhöhter Relevanz.</small></span></label>
            <label class="check-row"><input type="checkbox" name="noticePriority" value="info" ${prefs.officialNotices.priorities.includes('info') ? 'checked' : ''} /><span><strong>Information</strong><small>Normale Gemeindeinformationen.</small></span></label>
            <label>Kategorien
              <select name="noticeCategories" multiple size="5" aria-describedby="noticeCategoryHelp">${optionsForMultiSelect(OFFICIAL_NOTICE_CATEGORIES, prefs.officialNotices.categories)}</select>
            </label>
            <small id="noticeCategoryHelp" class="help">Keine Auswahl bedeutet: alle Kategorien der gewählten Priorität.</small>
          </section>

          <section class="notification-setting-group">
            <h3>Schwarzes Brett</h3>
            <label class="check-row"><input type="checkbox" name="bulletinEnabled" ${prefs.bulletin.enabled ? 'checked' : ''} /><span><strong>Bewohner- und Firmenbeiträge</strong><small>Benachrichtigung nach Typ und Kategorie.</small></span></label>
            <label class="check-row"><input type="checkbox" name="bulletinType" value="Suche" ${prefs.bulletin.types.includes('Suche') ? 'checked' : ''} /><span><strong>Gesuche</strong><small>Beiträge vom Typ „Ich brauche Hilfe“.</small></span></label>
            <label class="check-row"><input type="checkbox" name="bulletinType" value="Biete" ${prefs.bulletin.types.includes('Biete') ? 'checked' : ''} /><span><strong>Angebote</strong><small>Beiträge vom Typ „Ich biete Hilfe“.</small></span></label>
            <label>Kategorien
              <select name="bulletinCategories" multiple size="5" aria-describedby="bulletinCategoryHelp">${optionsForMultiSelect(CATEGORIES, prefs.bulletin.categories)}</select>
            </label>
            <small id="bulletinCategoryHelp" class="help">Ohne Kategorieauswahl gelten alle Kategorien des gewählten Typs.</small>
          </section>

          <section class="notification-setting-group">
            <h3>Chats und Ruhezeit</h3>
            <label class="check-row"><input type="checkbox" name="chatsEnabled" ${prefs.chats.enabled ? 'checked' : ''} /><span><strong>Private Nachrichten</strong><small>Einzelne Chats können weiterhin separat stummgeschaltet werden.</small></span></label>
            <label class="check-row"><input type="checkbox" name="quietEnabled" ${prefs.quietHours.enabled ? 'checked' : ''} /><span><strong>Ruhezeit verwenden</strong><small>Normale Pushmeldungen werden in dieser Zeit zurückgehalten.</small></span></label>
            <div class="form-grid two">
              <label>Von<input type="time" name="quietStart" value="${escapeHtml(prefs.quietHours.start)}" /></label>
              <label>Bis<input type="time" name="quietEnd" value="${escapeHtml(prefs.quietHours.end)}" /></label>
            </div>
          </section>
        </div>

        <section class="notification-keywords-section">
          <div class="request-head">
            <div><h3>Persönliche Stichwörter</h3><p>Wort oder Wortgruppe mit Quelle, Kategorie und Gebiet kombinieren.</p></div>
            <button class="secondary-button small" type="button" data-action="add-notification-keyword" ${prefs.keywordRules.length >= MAX_NOTIFICATION_KEYWORD_RULES ? 'disabled' : ''}>${iconSvg('edit')} Stichwort hinzufügen</button>
          </div>
          <div class="notification-keyword-list">
            ${prefs.keywordRules.length ? prefs.keywordRules.map(notificationKeywordRuleCard).join('') : '<div class="empty compact-empty">Noch keine persönlichen Stichwörter.</div>'}
          </div>
          <p class="help">${prefs.keywordRules.length}/${MAX_NOTIFICATION_KEYWORD_RULES} Regeln. Stichwortregeln können auch dann auslösen, wenn die allgemeine Kategorie nicht gewählt ist.</p>
        </section>

        <div class="row-actions notification-save-actions">
          <button class="primary-button" type="submit">Einstellungen speichern</button>
          <button class="ghost-button" type="button" data-action="test-notification">Push testen</button>
          <button class="ghost-button" type="button" data-action="push-diagnostics">Diagnose</button>
        </div>
      </form>` : `
        <div class="notification-summary-grid">
          <div><strong>${prefs.criticalAlerts ? 'Aktiv' : 'Aus'}</strong><span>Kritische Alarme</span></div>
          <div><strong>${prefs.officialNotices.priorities.includes('info') ? 'Wichtig + Info' : prefs.officialNotices.priorities.includes('wichtig') ? 'Wichtig' : 'Aus'}</strong><span>Gemeinde-Hinweise</span></div>
          <div><strong>${prefs.bulletin.enabled || activeKeywords ? 'Aktiv' : 'Aus'}</strong><span>Schwarzes Brett</span></div>
          <div><strong>${activeKeywords}</strong><span>Stichwortregeln</span></div>
        </div>
        <p class="help notification-summary-help">Mit dem Stift öffnest du Quellen, Kategorien, Stichwörter und Ruhezeiten.</p>
      `}
    </article>
  `;
}

async function persistNotificationPreferences(value, { notify = true } = {}) {
  const previous = currentNotificationPreferences();
  const prefs = normalizeNotificationPreferences({
    ...previous,
    ...value,
    uid: authState.user?.uid || previous.uid,
    area: state.profile.area,
    areaKey: currentAreaKey(),
    cantonCode: currentCantonCode(),
    createdAt: previous.createdAt || nowIso(),
    updatedAt: nowIso()
  });
  state.notificationPreferences = prefs;
  state.profile.notifications = prefs.enabled;
  syncCurrentUser({ notifications: prefs.enabled });
  saveState();
  if (isFirebaseMode() && authState.user) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.notificationPreferences, authState.user.uid, prefs, true);
    await updateFirebaseProfile({ notifications: prefs.enabled });
  }
  if (notify) toast('Benachrichtigungseinstellungen gespeichert.');
  return prefs;
}

async function saveNotificationPreferencesForm(form) {
  if (!form) return;
  const data = new FormData(form);
  const enabled = data.has('enabled');
  if (enabled && notificationPermissionState() !== 'granted') {
    await enableNotifications();
    if (notificationPermissionState() !== 'granted') throw new Error('Push kann erst nach der Browserfreigabe aktiviert werden.');
  }
  const current = currentNotificationPreferences();
  await persistNotificationPreferences({
    ...current,
    enabled,
    alerts: {
      enabled: data.has('alertsEnabled'),
      severities: data.getAll('alertSeverity').map(String)
    },
    officialNotices: {
      enabled: data.has('noticesEnabled'),
      priorities: data.getAll('noticePriority').map(String),
      categories: data.getAll('noticeCategories').map(String)
    },
    bulletin: {
      enabled: data.has('bulletinEnabled'),
      types: data.getAll('bulletinType').map(String),
      categories: data.getAll('bulletinCategories').map(String)
    },
    chats: { enabled: data.has('chatsEnabled') },
    quietHours: {
      enabled: data.has('quietEnabled'),
      start: String(data.get('quietStart') || '22:00'),
      end: String(data.get('quietEnd') || '07:00'),
      timezone: 'Europe/Zurich'
    }
  });
  if (enabled && isFirebaseMode()) await registerPushToken();
  editCards.delete('profile-notifications');
  render();
}

function openNotificationKeywordModal(ruleId = '') {
  const prefs = currentNotificationPreferences();
  const existing = prefs.keywordRules.find(rule => rule.id === ruleId) || null;
  if (!existing && prefs.keywordRules.length >= MAX_NOTIFICATION_KEYWORD_RULES) {
    toast(`Maximal ${MAX_NOTIFICATION_KEYWORD_RULES} Stichwortregeln möglich.`);
    return;
  }
  const rule = existing || normalizeNotificationKeywordRule({
    id: uid('keyword'),
    sources: ['requests'],
    scope: 'municipality',
    enabled: true
  });
  const allCategories = [...new Set([...CATEGORIES, ...OFFICIAL_NOTICE_CATEGORIES])];
  openModal(existing ? 'Stichwort bearbeiten' : 'Stichwort hinzufügen', `
    <form id="notificationKeywordForm" class="form-grid">
      <label>Wort oder Wortgruppe
        <input name="term" required minlength="2" maxlength="60" value="${escapeHtml(rule.term)}" placeholder="z. B. Lehrstelle oder Stromunterbruch" />
      </label>
      <fieldset class="choice-fieldset">
        <legend>Quellen</legend>
        <label class="check-row"><input type="checkbox" name="source" value="requests" ${rule.sources.includes('requests') ? 'checked' : ''} /><span><strong>Schwarzes Brett</strong><small>Beiträge von Bewohnern und Firmen.</small></span></label>
        <label class="check-row"><input type="checkbox" name="source" value="officialNotices" ${rule.sources.includes('officialNotices') ? 'checked' : ''} /><span><strong>Gemeinde-Hinweise</strong><small>Offizielle organisatorische Informationen.</small></span></label>
        <label class="check-row"><input type="checkbox" name="source" value="alerts" ${rule.sources.includes('alerts') ? 'checked' : ''} /><span><strong>Alarme</strong><small>Gemeinde-Alarme und Sicherheitsmeldungen.</small></span></label>
      </fieldset>
      <div class="form-grid two">
        <label>Kategorie
          <select name="category">
            <option value="">Alle Kategorien</option>
            ${allCategories.map(category => `<option value="${escapeHtml(category)}" ${rule.categories.includes(category) ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}
          </select>
        </label>
        <label>Gebiet
          <select name="scope">
            <option value="municipality" ${rule.scope === 'municipality' ? 'selected' : ''}>Eigene Gemeinde</option>
            <option value="canton" ${rule.scope === 'canton' ? 'selected' : ''}>Ganzer Kanton</option>
          </select>
        </label>
      </div>
      <label class="check-row"><input type="checkbox" name="enabled" ${rule.enabled ? 'checked' : ''} /><span><strong>Regel aktiv</strong><small>Kann später jederzeit pausiert werden.</small></span></label>
      <p class="form-error" id="notificationKeywordError" role="alert"></p>
      <button class="primary-button" type="submit">Stichwort speichern</button>
    </form>
  `, (modal, close) => {
    modal.querySelector('#notificationKeywordForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      runAsyncAction(async () => {
        const data = new FormData(form);
        const sources = data.getAll('source').map(String);
        const term = String(data.get('term') || '').trim().replace(/\s+/g, ' ');
        const errorNode = modal.querySelector('#notificationKeywordError');
        if (term.length < 2) {
          if (errorNode) errorNode.textContent = 'Bitte mindestens zwei Zeichen eingeben.';
          return;
        }
        if (!sources.length) {
          if (errorNode) errorNode.textContent = 'Bitte mindestens eine Quelle auswählen.';
          return;
        }
        const category = String(data.get('category') || '');
        const nextRule = normalizeNotificationKeywordRule({
          ...rule,
          term,
          sources,
          categories: category ? [category] : [],
          scope: String(data.get('scope') || 'municipality'),
          enabled: data.has('enabled')
        });
        const duplicate = prefs.keywordRules.some(item => item.id !== nextRule.id && item.term.toLocaleLowerCase('de-CH') === nextRule.term.toLocaleLowerCase('de-CH'));
        if (duplicate) {
          if (errorNode) errorNode.textContent = 'Dieses Stichwort existiert bereits.';
          return;
        }
        const keywordRules = existing
          ? prefs.keywordRules.map(item => item.id === nextRule.id ? nextRule : item)
          : [...prefs.keywordRules, nextRule];
        await persistNotificationPreferences({ ...prefs, keywordRules });
        close();
        render();
      });
    });
  });
}

async function toggleNotificationKeyword(ruleId) {
  const prefs = currentNotificationPreferences();
  const keywordRules = prefs.keywordRules.map(rule => rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule);
  await persistNotificationPreferences({ ...prefs, keywordRules });
  render();
}

async function deleteNotificationKeyword(ruleId) {
  const prefs = currentNotificationPreferences();
  const rule = prefs.keywordRules.find(item => item.id === ruleId);
  if (!rule) return;
  if (!window.confirm(`Stichwort „${rule.term}“ löschen?`)) return;
  await persistNotificationPreferences({ ...prefs, keywordRules: prefs.keywordRules.filter(item => item.id !== ruleId) });
  render();
}

function inviteTable() {
  return `<table><thead><tr><th>Code</th><th>Gebiet</th><th>Rolle</th><th>Status</th></tr></thead><tbody>${state.inviteCodes.map(inv => `<tr><td><strong>${escapeHtml(inv.code)}</strong></td><td>${escapeHtml(inv.area)}</td><td>${escapeHtml(inv.role)}</td><td>${escapeHtml(inv.status)}</td></tr>`).join('')}</tbody></table>`;
}

function renderV2Preferences({ compact = false } = {}) {
  const prefs=readPreferences(authState.user?.uid);
  const categories=orderedCategories();
  return `<section class="card v2-preferences" aria-label="Meine Quartinaut-Einstellungen">
    ${compact ? '' : `<div class="v2-section-heading"><div><span class="v2-kicker">Dein Quartinaut</span><h2>Meine Interessen</h2></div><span class="v2-status-tag">Nur auf diesem Gerät</span></div>`}
    <p>Wähle, wobei du gerne helfen möchtest. Passende Hilfegesuche erscheinen auf deiner Startseite.</p>
    <div class="v2-category-chips">${categories.map(cat=>`<button class="v2-chip ${prefs.categories.includes(cat)?'active':''}" data-action="v2-interest" data-value="${escapeHtml(cat)}" aria-pressed="${prefs.categories.includes(cat)}">${escapeHtml(cat)}</button>`).join('')}</div>

    <p class="help">Deine Interessen werden derzeit nur auf diesem Gerät gespeichert.</p>
  </section>`;
}

// Nur lokale Darstellungseinstellungen – keine Änderung an Benutzerrollen oder Firestore-Daten.
const v41ProfileOpenDetails=new Set();
function openSingleSettingsPanel(panel) {
  if (!panel?.classList.contains('v41-setting')) return;
  v41ProfileOpenDetails.clear();
  document.querySelectorAll('.v41-setting').forEach(item => {
    if (item !== panel && item.open) item.open = false;
  });
  if (panel.open) v41ProfileOpenDetails.add(panel.id);
}
function bindV41Settings(){
  document.querySelectorAll('.v41-setting').forEach(el=>el.addEventListener('toggle',()=>{
    if (el.open) openSingleSettingsPanel(el);
    else v41ProfileOpenDetails.delete(el.id);
  }));
  // Older saved states might have multiple panels. Normalise without losing the current selection.
  const opened=[...document.querySelectorAll('.v41-setting[open]')];
  if(opened.length>1)openSingleSettingsPanel(opened[opened.length-1]);
  document.querySelectorAll('[data-v41-open]').forEach(btn=>btn.addEventListener('click',()=>{
    const target=document.getElementById(btn.dataset.v41Open);
    if(target){target.open=true;openSingleSettingsPanel(target);target.scrollIntoView({behavior:'smooth',block:'center'});}
  }));
  document.querySelector('[data-v41-theme]')?.addEventListener('change',e=>setThemeChoice(e.target.value,{notify:true}));
  document.querySelectorAll('[data-v41-hub-kind]').forEach(btn=>btn.addEventListener('click',()=>{
    hubState.section=btn.dataset.v41HubKind;hubState.search='';setRoute('hub');
    if(!hubState.loaded&&!hubState.loading)void loadHub();
  }));
}

function renderProfile() {
  const isAdmin = isAdminRole();
  const activeTitle = profileTitle();
  const titleSuffix = activeTitle ? ` · ${activeTitle}` : '';
  const verificationText = state.profile.verified
    ? 'Verifiziert'
    : state.profile.verificationStatus === 'pending'
      ? 'Verifizierung beantragt'
      : 'Nicht verifiziert';
  const ownLocationRequest = state.locationChangeRequests.find(req => req.uid === authState.user?.uid && req.status === 'offen');
  const ownVerificationRequest = state.verificationRequests.find(req => req.uid === authState.user?.uid && ['offen', 'zurückgestellt'].includes(req.status));
  const ownNameChangeRequest = state.changeRequests.find(req => req.uid === authState.user?.uid && req.type === 'name_change' && ['offen', 'in_pruefung'].includes(req.status));
  const ownChangeRequest = state.changeRequests.find(req => req.uid === authState.user?.uid && req.type !== 'name_change' && ['offen', 'in_pruefung'].includes(req.status));
  const ownTokenCount = state.deviceTokens.filter(token => token.uid === authState.user?.uid && token.active !== false).length;
  const openLocationRequests = state.locationChangeRequests.filter(req => req.status === 'offen');
  const openVerificationRequests = state.verificationRequests.filter(req => ['offen', 'zurückgestellt'].includes(req.status));
  const archivedVerificationRequests = state.verificationRequests.filter(req => ['bestätigt', 'bestaetigt', 'abgelehnt'].includes(req.status)).sort((a, b) => new Date(normalizeStoredDate(b.decidedAt) || 0) - new Date(normalizeStoredDate(a.decidedAt) || 0));
  const openChangeRequests = state.changeRequests.filter(req => ['offen', 'in_pruefung'].includes(req.status));
  const identityEditing = isEditCardOpen('profile-identity');
  const accountEditing = isEditCardOpen('profile-account');
  return `
    <section class="v41-profile-hero" aria-label="Profilübersicht">
      <span class="v41-eyebrow">DEIN QUARTINAUT</span>
      <h1>Einstellungen &amp; Profil</h1>
      <p>Persönlich, übersichtlich und sicher.</p>
      <div class="v41-user-card">
        <span class="v41-avatar" aria-hidden="true">${escapeHtml(state.profile.initials || initialsFromName(profileName()))}</span>
        <span class="v41-user-information"><strong>${escapeHtml(profileName())} ${verifiedMark()}</strong><small>${escapeHtml(locationLabel())} · ${escapeHtml(roleLabel())}</small><span>${trustBadge(state.profile)}</span></span>
        <button class="v41-profile-edit" type="button" data-v41-open="v41-identity" aria-label="Profildaten und Sicherheit öffnen">${iconSvg('edit')}<span>Bearbeiten</span></button>
      </div>
    </section>

    <div class="v41-settings-page v453-settings-page">
      <p class="v453-settings-lead">Alles Wichtige an einem Ort. Öffne einen Bereich, um deine Einstellungen zu ändern.</p>
      <h2 class="v41-group-label">Personalisierung</h2>
      <div class="v41-setting-group">
        <details class="v41-setting" id="v41-start" ${v41ProfileOpenDetails.has('v41-start')?'open':''}><summary><span class="v41-setting-icon v41-green">${iconSvg('home')}</span><span class="v41-setting-text"><strong>Meine Startseite</strong><small>Startansicht und Kacheln anpassen</small></span><span class="v41-chevron" aria-hidden="true">›</span></summary><div class="v41-setting-content">
    ${hubHomeSelector({ compact: true })}
    ${renderDashboardLayoutSettings()}
</div></details>
        <details class="v41-setting" id="v41-appearance" ${v41ProfileOpenDetails.has('v41-appearance')?'open':''}><summary><span class="v41-setting-icon v41-purple">${iconSvg('sun')}</span><span class="v41-setting-text"><strong>Darstellung & Bedienung</strong><small>Design, Sprache und Hintergrundbild</small></span><span class="v41-chevron" aria-hidden="true">›</span></summary><div class="v41-setting-content">
      <div class="v41-design-picker">
        <label for="v41ThemeSelect">Darstellung</label>
        <select id="v41ThemeSelect" data-v41-theme>
          <option value="system" ${storedThemeChoice()==='system'?'selected':''}>Automatisch</option>
          <option value="light" ${storedThemeChoice()==='light'?'selected':''}>Grün</option>
          <option value="dark" ${storedThemeChoice()==='dark'?'selected':''}>Dunkel</option>
          <option value="white" ${storedThemeChoice()==='white'?'selected':''}>Hell</option>
          <option value="amoled" ${storedThemeChoice()==='amoled'?'selected':''}>Schwarz</option>
        </select>
        <label for="localeChoiceSelect">Sprache</label>
        <select name="localeChoice" id="localeChoiceSelect">${localeOptionsHtml()}</select>

        <div class="v462-background-setting">
          <strong>Dashboard-Hintergrund</strong>
          <small>Wähle dein eigenes Foto für den oberen Bereich der Startseite. Das Bild bleibt nur auf diesem Gerät gespeichert.</small>
          <div class="v462-background-actions">
            <button class="secondary-button" type="button" data-v462-choose-background>🖼️ Foto auswählen</button>
            <button class="ghost-button" type="button" data-v462-reset-background ${v462HasDashboardPhoto()?'':'disabled'}>Standard wiederherstellen</button>
          </div>
          <input type="file" class="v462-file-input" accept="image/jpeg,image/png,image/webp" data-v462-background-file aria-label="Eigenes Dashboard-Hintergrundbild hochladen" hidden>
        </div>
      </div>
</div></details>
        <details class="v41-setting" id="v41-interests" ${v41ProfileOpenDetails.has('v41-interests')?'open':''}><summary><span class="v41-setting-icon v41-purple">${iconSvg('offer')}</span><span class="v41-setting-text"><strong>Interessen & Kategorien</strong><small>Hilfethemen und passende Angebote</small></span><span class="v41-chevron" aria-hidden="true">›</span></summary><div class="v41-setting-content">
    ${renderV2Preferences({ compact: true })}
</div></details>
      </div>

      <h2 class="v41-group-label">Mitteilungen</h2>
      <div class="v41-setting-group">
        <details class="v41-setting" id="v41-notifications" ${v41ProfileOpenDetails.has('v41-notifications')?'open':''}><summary><span class="v41-setting-icon v41-orange">${iconSvg('bell')}</span><span class="v41-setting-text"><strong>Benachrichtigungen</strong><small>Push, Stichwörter und wichtige Meldungen</small></span><span class="v41-chevron" aria-hidden="true">›</span></summary><div class="v41-setting-content">
    <section>
      <p class="v453-status-help">Aktive Push-Geräte: <strong>${ownTokenCount}</strong></p>
      ${renderNotificationPreferencesCard({ inline: true })}
    </section>
</div></details>
      </div>

      <h2 class="v41-group-label">Mein Konto</h2>
      <div class="v41-setting-group">
        <details class="v41-setting" id="v41-identity" ${v41ProfileOpenDetails.has('v41-identity')?'open':''}><summary><span class="v41-setting-icon v41-blue">${iconSvg('profile')}</span><span class="v41-setting-text"><strong>Profil & Kontodaten</strong><small>Name, Titel und Standort</small></span><span class="v41-chevron" aria-hidden="true">›</span></summary><div class="v41-setting-content">
    <section class="grid two">
      <article class="card" data-edit-card="profile-identity">
        ${editCardHeader('Lokale Identität', 'profile-identity', identityEditing)}
        ${identityEditing ? `
          <form id="profileForm" class="form-grid" style="margin-top:14px;">
            <div class="readonly-field"><strong>Registrierter Name</strong><span>${escapeHtml(state.profile.name)}</span></div>
            <div class="readonly-field"><strong>Kürzel</strong><span>${escapeHtml(state.profile.initials)}</span></div>
            <p class="help">Der Name kann nicht direkt geändert werden. Bitte stelle bei Bedarf einen Antrag mit Begründung.</p>
            <button class="ghost-button" type="button" data-action="request-name-change" ${ownNameChangeRequest ? 'disabled' : ''}>Namensänderung beantragen</button>
            <label class="check-row" style="grid-template-columns:auto 1fr;">
              <input type="checkbox" name="titleVisible" ${state.profile.titleVisible !== false ? 'checked' : ''} />
              <span><strong>Titel beim Namen anzeigen</strong><small>Schaltet Rollen-/Verifizierungslabel im Profilnamen ein oder aus.</small></span>
            </label>
            <label>Titeltyp
              <select name="titlePreset">
                ${titlePresetOptions()}
              </select>
            </label>
            <div class="row-actions">
              <button class="secondary-button" type="submit">Speichern</button>
              <button class="ghost-button" type="button" data-action="cancel-edit-card" data-edit-card-id="profile-identity">Abbrechen</button>
            </div>
          </form>
        ` : `
          <div class="list" style="margin-top:14px;">
            <div class="readonly-field"><strong>Registrierter Name</strong><span>${escapeHtml(state.profile.name)}</span></div>
            <div class="readonly-field"><strong>Kürzel</strong><span>${escapeHtml(state.profile.initials)}</span></div>
            <div class="readonly-field"><strong>Standort</strong><span>${escapeHtml(locationLabel())}</span></div>
            <div class="readonly-field"><strong>Rolle</strong><span>${escapeHtml(roleLabel())}</span></div>
            <div class="readonly-field"><strong>Sichtbarer Titel</strong><span>${escapeHtml(activeTitle || 'ausgeblendet')}</span></div>
            ${state.profile.accountType === 'company' ? `
              <div class="readonly-field"><strong>Firma</strong><span>${escapeHtml(companyNameForProfile() || 'Firma ohne Namen')}</span></div>
              <div class="readonly-field"><strong>Firmenstatus</strong><span>${escapeHtml(companyStatusLabel(state.profile.companyStatus) || 'Firma')}</span></div>
            ` : ''}
            ${state.profile.accountType === 'municipality' ? `
              <div class="readonly-field"><strong>Gemeinde</strong><span>${escapeHtml(state.profile.municipalityName || state.profile.area)}</span></div>
              <div class="readonly-field"><strong>Abteilung / Funktion</strong><span>${escapeHtml(state.profile.municipalityDepartment || '-')}</span></div>
              <div class="readonly-field"><strong>Gemeindestatus</strong><span>${escapeHtml(state.profile.municipalityStatus === 'verified' ? 'geprüft' : state.profile.municipalityStatus === 'rejected' ? 'abgelehnt' : 'in Prüfung')}</span></div>
            ` : ''}
          </div>
        `}
      </article>

      <article class="card">
        <h2>Standort & Zugang</h2>
        <p>Standortwechsel werden erst nach administrativer Bestätigung aktiv.</p>
        <div class="row-actions" style="margin-top:14px;">
          <button class="secondary-button" data-action="request-location-change" ${ownLocationRequest ? 'disabled' : ''}>Standortwechsel beantragen</button>
          <button class="ghost-button" data-action="passkey-check">${state.profile.passkeyReady ? 'Passkey aktiv ✓' : 'Passkey einrichten'}</button>
        </div>
        <div class="list" style="margin-top:14px;">
          <div class="card compact soft"><strong>Konto</strong><p>${escapeHtml(accountTypeLabel())} · ${escapeHtml(accountStatusLabel())}</p></div>
          ${ownLocationRequest ? `<div class="card compact soft"><strong>Offener Standortantrag</strong><p>${escapeHtml(ownLocationRequest.targetLabel)}</p></div>` : ''}
          ${ownNameChangeRequest ? `<div class="card compact soft"><strong>Offener Namensantrag</strong><p>${escapeHtml(ownNameChangeRequest.requestedName || ownNameChangeRequest.title)} · ${escapeHtml(ownNameChangeRequest.status)}</p></div>` : ''}
          ${ownChangeRequest ? `<div class="card compact soft"><strong>Änderungsanfrage</strong><p>${escapeHtml(ownChangeRequest.title)} · ${escapeHtml(ownChangeRequest.status)}</p></div>` : ''}
        </div>

      </article>
    </section>

</div></details>
        <details class="v41-setting" id="v41-trust" ${v41ProfileOpenDetails.has('v41-trust')?'open':''}><summary><span class="v41-setting-icon v41-amber">${iconSvg('check')}</span><span class="v41-setting-text"><strong>Verifizierung & Vertrauen</strong><small>Sicherer Austausch mit deinen Nachbarn</small></span><span class="v41-chevron" aria-hidden="true">›</span></summary><div class="v41-setting-content">
    <div class="v453-verify-row">
      <div><strong>Identitätsprüfung</strong><p class="help">Status: ${escapeHtml(verificationText)}${ownVerificationRequest ? ` · Antrag ${escapeHtml(ownVerificationRequest.status)}` : ''}</p></div>
      <button class="secondary-button" type="button" data-action="request-verification" ${state.profile.verified || ownVerificationRequest ? 'disabled' : ''}>${state.profile.verified ? 'Bereits verifiziert' : ownVerificationRequest ? 'Antrag in Prüfung' : 'Verifizierung beantragen'}</button>
    </div>
    ${renderCommunityTrustPanel()}
</div></details>
        <details class="v41-setting" id="v453-privacy" ${v41ProfileOpenDetails.has('v453-privacy')?'open':''}><summary><span class="v41-setting-icon v41-coral">${iconSvg('alert')}</span><span class="v41-setting-text"><strong>Datenschutz & Konto</strong><small>Datenauskunft, Abmelden und Konto löschen</small></span><span class="v41-chevron" aria-hidden="true">›</span></summary><div class="v41-setting-content">
    <p class="v453-intro">Du kannst dich abmelden, eigene Daten exportieren oder dein Konto verwalten. Löschfunktionen sind zusätzlich geschützt.</p>
    <div class="card compact soft"><strong>Fehlerdiagnose auf diesem Gerät</strong><p class="help">${v46DiagnosticCount()} anonyme Fehlertypen lokal gezählt. Keine Fehlermeldungen oder Formularinhalte gespeichert oder an einen Server gesendet.</p><button class="ghost-button small" type="button" data-v46-clear-errors>Lokale Diagnose löschen</button></div>
    <button class="ghost-button" type="button" data-action="logout">Abmelden</button>
            <div class="card compact soft" data-edit-card="profile-account" style="margin-top:14px;">
          ${editCardHeader('Kontoverwaltung', 'profile-account', accountEditing)}
          ${accountEditing ? `
            <div class="danger-zone" style="margin-top:12px;">
              <strong>Kontoverwaltung aktiv</strong>
              <p class="help">Exportiert deine personenbezogenen Daten als JSON oder löscht/anonymisiert dein Konto und deine eigenen Inhalte.</p>
              <div class="row-actions" style="margin-top:10px;">
                <button class="ghost-button small" data-action="export-own-data">Daten exportieren</button>
                <button class="danger-button small" data-action="delete-own-account">Konto löschen</button>
                <button class="ghost-button small" type="button" data-action="cancel-edit-card" data-edit-card-id="profile-account">Abbrechen</button>
              </div>
              <p class="help" style="margin-top:10px;">„Lokale Daten zurücksetzen“ leert nur diesen Browser. Dein Konto bleibt bestehen.</p>
              <button class="danger-button small" data-action="reset-local-data" style="margin-top:10px;">Lokale Daten zurücksetzen</button>
            </div>
          ` : '<p class="help" style="margin-top:10px;">Export, Kontolöschung und lokales Zurücksetzen sind geschützt eingeklappt.</p>'}
        </div>
</div></details>
      </div>

      <h2 class="v41-group-label">Meine Inhalte</h2>
      <div class="v41-setting-group">
        <details class="v41-setting" id="v41-activity" ${v41ProfileOpenDetails.has('v41-activity')?'open':''}><summary><span class="v41-setting-icon v41-blue">${iconSvg('bulletin')}</span><span class="v41-setting-text"><strong>Meine Beiträge</strong><small>Eigene Anliegen, Status und offene Schritte</small></span><span class="v41-chevron" aria-hidden="true">›</span></summary><div class="v41-setting-content">
    <section class="grid two">
      ${renderMyProceduresCard({ detailed: true })}
    </section>
</div></details>
        <details class="v41-setting" id="v44-saved" ${v41ProfileOpenDetails.has('v44-saved')?'open':''}><summary><span class="v41-setting-icon v41-coral">${iconSvg('bookmark')}</span><span class="v41-setting-text"><strong>Gespeichert</strong><small>Deine Merkliste</small></span><span class="v41-chevron" aria-hidden="true">›</span></summary><div class="v41-setting-content">${v44SavedPanel()}<div class="row-actions"><button class="secondary-button small" type="button" data-route="saved">Alle Favoriten öffnen</button></div></div></details>
        <details class="v41-setting" id="v46-drafts"><summary><span class="v41-setting-icon v41-purple">✍️</span><span class="v41-setting-text"><strong>Entwürfe verwalten</strong><small>Offline gespeicherte Texte auf diesem Gerät</small></span><span class="v41-chevron" aria-hidden="true">›</span></summary><div class="v41-setting-content"><button class="secondary-button" type="button" data-route="drafts">Entwürfe öffnen</button></div></details>
      </div>
    </div>
    <p class="v41-profile-footer">Quartinaut 4.6.2 · Deine Gemeinde. Deine Nachbarn.</p>

    ${isAdmin ? `
      <div class="v41-settings-page v453-admin-settings"><h2 class="v41-group-label">Administration</h2><div class="v41-setting-group">
      <details class="v41-setting v2-admin-panel" id="v453-admin" ${v41ProfileOpenDetails.has('v453-admin')?'open':''}><summary>Administration und Prüfungen <span class="v41-chevron" aria-hidden="true">›</span></summary><div class="v41-setting-content">
      <section class="grid two">
        <article class="card">
          <h2>Standortanträge</h2>
          <div class="list" style="margin-top:14px;">${openLocationRequests.length ? openLocationRequests.map(locationRequestCard).join('') : '<div class="empty">Keine offenen Standortanträge.</div>'}</div>
        </article>
        <article class="card">
          <h2>Verifizierungsanträge</h2>
          <div class="list" style="margin-top:14px;">${openVerificationRequests.length ? openVerificationRequests.map(verificationRequestCard).join('') : '<div class="empty">Keine offenen Verifizierungsanträge.</div>'}</div>
        </article>
      </section>
      <section class="card">
        <h2>Verifizierungsverlauf</h2>
        <div class="list" style="margin-top:14px;">${archivedVerificationRequests.length ? archivedVerificationRequests.slice(0, 12).map(verificationArchiveCard).join('') : '<div class="empty">Noch keine erledigten Verifizierungsanträge.</div>'}</div>
      </section>
      <section class="card">
        <h2>Änderungsanfragen</h2>
        <div class="list" style="margin-top:14px;">${openChangeRequests.length ? openChangeRequests.map(changeRequestCard).join('') : '<div class="empty">Keine offenen Änderungsanfragen.</div>'}</div>
      </section>
      ${renderAdminUsersOverview()}
      ${renderAdminRoleCard()}
      ${renderAdminAuditLog()}
      </div></details></div></div>
    ` : ''}
  `;
}

function locationRequestCard(req) {
  return `
    <section class="card compact">
      <strong>${escapeHtml(req.displayName)}</strong>
      <p>${escapeHtml(req.currentLabel)} → ${escapeHtml(req.targetLabel)}</p>
      <p class="help">${escapeHtml(req.reason || 'Kein Grund angegeben.')}</p>
      <div class="row-actions" style="margin-top:12px;">
        <button class="success-button" data-action="approve-location" data-id="${req.id}">Bestätigen</button>
        <button class="danger-button" data-action="reject-location" data-id="${req.id}">Ablehnen</button>
      </div>
    </section>
  `;
}

function verificationRequestCard(req) {
  const statusBadge = req.status === 'zurückgestellt' ? '<span class="badge warn">zurückgestellt</span>' : '<span class="badge">offen</span>';
  const hasPhoto = verificationPhotoAvailable(req);
  const localPhotoUrl = !isFirebaseMode() && req.idPhoto?.dataUrl ? req.idPhoto.dataUrl : '';
  const isCompanyRequest = req.accountType === 'company';
  const proofLabel = isCompanyRequest ? 'Personen-/Firmennachweis' : 'Ausweisfoto zur Namensprüfung';
  return `
    <section class="card compact">
      <strong>${escapeHtml(req.displayName)}</strong>
      <div class="badges" style="margin-top:6px;">${statusBadge}<span class="badge ${isCompanyRequest ? 'info' : ''}">${escapeHtml(isCompanyRequest ? 'Firma + verantwortliche Person' : 'Privatperson')}</span></div>
      <p>${escapeHtml(req.method)}</p>
      ${isCompanyRequest ? `<p class="help"><strong>Firma:</strong> ${escapeHtml(req.companyName || 'ohne Firmenname')} · Prüfung bestätigt primär die verantwortliche Person; Firmenfreigabe wird separat als Firmenstatus geführt.</p>` : ''}
      <p class="help">${escapeHtml(req.note || 'Keine Notiz angegeben.')}</p>
      <div class="readonly-field"><strong>Registrierter Name</strong><span>${escapeHtml(req.registeredName || req.displayName || '-')}</span></div>
      ${localPhotoUrl ? `
        <figure class="id-photo-preview">
          <img src="${escapeHtml(localPhotoUrl)}" alt="Ausweisfoto von ${escapeHtml(req.displayName)}" />
          <figcaption>${escapeHtml(proofLabel)}</figcaption>
        </figure>
      ` : hasPhoto ? `
        <div class="readonly-field">
          <strong>${escapeHtml(proofLabel)}</strong>
          <span>${escapeHtml(verificationPhotoMetaText(req))}</span>
        </div>
        <button class="ghost-button small" type="button" data-action="view-verification-photo" data-id="${escapeHtml(req.id)}">Foto geschützt laden</button>
        <p class="help">Das Foto liegt in Firebase Storage und wird erst beim Prüfen durch Admins geladen.</p>
      ` : '<p class="form-error">Nachweisfoto fehlt. Bitte Antrag zurückstellen und Nutzer/in erneut einreichen lassen.</p>'}
      <label>Freizugebender Titeltyp
        <select data-verification-title data-id="${escapeHtml(req.id)}">
          ${verificationTitleOptions(req.approvedTitlePreset || 'verified')}
        </select>
      </label>
      <p class="form-error" data-verification-error="${escapeHtml(req.id)}" role="alert"></p>
      <div class="row-actions" style="margin-top:12px;">
        <button class="success-button" data-action="approve-verification" data-id="${req.id}" ${hasPhoto ? '' : 'disabled'}>${isCompanyRequest ? 'Person/Firma freigeben' : 'Verifizieren'}</button>
        <button class="danger-button" data-action="reject-verification" data-id="${req.id}">Ablehnen</button>
        <button class="ghost-button" data-action="${req.status === 'zurückgestellt' ? 'resume-verification' : 'pause-verification'}" data-id="${req.id}">${req.status === 'zurückgestellt' ? 'Wieder öffnen' : 'Zurückstellen'}</button>
        <button class="ghost-button" data-action="edit-verification" data-id="${req.id}">Anpassen</button>
      </div>
    </section>
  `;
}

function verificationArchiveCard(req) {
  const approved = ['bestätigt', 'bestaetigt'].includes(req.status);
  return `
    <section class="card compact soft">
      <div class="badges">
        <span class="badge ${approved ? 'offer' : 'warn'}">${escapeHtml(approved ? 'bestätigt' : 'abgelehnt')}</span>
        <span class="badge">${escapeHtml(req.accountType === 'company' ? 'Firma' : 'Privatperson')}</span>
      </div>
      <strong>${escapeHtml(req.displayName || req.email || 'Antrag')}</strong>
      <p class="help">${escapeHtml(req.method || '-')} · Entscheid: ${escapeHtml(formatDate(req.decidedAt || req.updatedAt || req.createdAt))}</p>
      <p class="help">${approved ? 'Nachweisfoto wurde nach dem Entscheid aus dem Antrag entfernt.' : 'Abgelehnter Antrag bleibt als Verlauf sichtbar; Nachweisfoto wird nach dem Entscheid entfernt.'}</p>
    </section>
  `;
}

const LEGAL_CONTENT = {
  privacy: {
    title: 'Datenschutz',
    body: `
      <section class="form-grid legal-copy">
        <p>Quartinaut verarbeitet personenbezogene Daten zweckgebunden für Registrierung, Vermittlung von Hilfeanliegen, Alarmierung und Sicherheitsfunktionen.</p>
        <p><strong>Verarbeitete Daten:</strong> Google-Konto-ID, Anzeigename, Gemeinde/Kanton, Kontotyp (Privat/Firma), Firmenangaben, Rollen- und Verifizierungsstatus, Suche-/Biete-Verlauf, freiwillige Chatinhalte, optionale Push-Tokens und persönliche Benachrichtigungsfilter/Stichwörter, optionale ungefähre Distanzdaten, Audit-Log für Admin-Aktionen und Ausweisfoto bei Verifizierungsanträgen.</p>
        <p><strong>Zweck und Rechtsgrundlage:</strong> Betrieb der Plattform, Missbrauchsschutz, Zustellung verifizierter Alarme, administrative Freigaben. Daten werden nicht für Werbung genutzt.</p>
        <p><strong>Ausweisfotos:</strong> Verifizierungsfotos werden geschützt in Firebase Storage gespeichert; Firestore speichert nur technische Metadaten wie Pfad, Typ und Grösse. Zugriff erhalten nur berechtigte Admin-Rollen zur Prüfung.</p>
        <p><strong>Speicherfristen:</strong> Anliegen und Vermittlungen laufen nach TTL aus; administrative Anträge bleiben bis zur Bearbeitung gespeichert; Ausweisfotos werden nach dem Entscheid aus offenen Verifizierungsanträgen entfernt; technische Logs werden auf das notwendige Mass begrenzt.</p>
        <p><strong>Weitergabe:</strong> Keine kommerzielle Weitergabe. Zugriff erhalten nur berechtigte Rollen (z. B. Admin) im Rahmen des Betriebs.</p>
        <p><strong>Betroffenenrechte:</strong> Auskunft, Berichtigung, Löschung und Einschränkung können über den Betreiber angefordert werden.</p>
      </section>
    `
  },
  terms: {
    title: 'Nutzungsbedingungen',
    body: `
      <section class="form-grid legal-copy">
        <p>Quartinaut ist eine lokale Community-Plattform für nachbarschaftliche Hilfe und verifizierte Gemeindeinformationen.</p>
        <p><strong>Pflichtanmeldung:</strong> Die Nutzung setzt ein registriertes Konto mit gültigem Namen und Standort voraus. Namens- und Standortänderungen erfolgen nur per Antrag, Begründung und Admin-Freigabe. Firmenkonten müssen als solche registriert werden.</p>
        <p><strong>Firmen:</strong> Firmen dürfen lokale Arbeits-, Dienstleistungs- oder Mitarbeitersuchen nur klar erkennbar als Firmenkonto veröffentlichen. Missbrauch, Spam oder irreführende Angebote können eingeschränkt werden.</p>
        <p><strong>Verhaltensregeln:</strong> Keine Beleidigungen, keine Irreführung, keine unzulässigen Inhalte, keine gewerblichen Spamangebote. Verstösse können moderiert oder gesperrt werden.</p>
        <p><strong>Verantwortung für Beiträge:</strong> Jede Nutzerin und jeder Nutzer ist für eigene Inhalte, Angaben und Hilfsangebote selbst verantwortlich.</p>
        <p><strong>Haftung:</strong> Hilfeleistungen erfolgen eigenverantwortlich zwischen Nutzern. Der Betreiber übernimmt keine Gewähr für Richtigkeit, Vollständigkeit oder Rechtmässigkeit von nutzergenerierten Inhalten.</p>
        <p><strong>Beitragsfreigabe und Moderation:</strong> Öffentliche Gesuche und Angebote werden vor der Veröffentlichung administrativ freigegeben. Die Freigabe ist keine Gewähr für Richtigkeit oder Sicherheit; gemeldete oder auffällige Inhalte können zusätzlich geprüft, zurückgestellt oder entfernt werden.</p>
        <p><strong>Verfügbarkeit:</strong> Die Plattform wird mit angemessener Sorgfalt betrieben, es besteht jedoch kein Anspruch auf unterbruchsfreien Betrieb.</p>
        <p><strong>Änderungen:</strong> Funktionen und Regeln dürfen zur Sicherheit und Weiterentwicklung angepasst werden.</p>
      </section>
    `
  },
  imprint: {
    title: 'Impressum',
    body: `
      <section class="form-grid legal-copy">
        <p><strong>Betreiber:</strong> Irajet Ramadani</p>
        <p><strong>Adresse:</strong> Sandackerstrasse 7, 9245 Oberbüren SG, Schweiz</p>
        <p><strong>Telefon:</strong> +41 76 484 34 86</p>
        <p><strong>Verantwortlich für Inhalte:</strong> Irajet Ramadani (Betreiber)</p>
        <p><strong>Nutzerinhalte:</strong> Für Beiträge und Angaben in Hilfeanliegen/Chats sind die jeweiligen Nutzerinnen und Nutzer selbst verantwortlich.</p>
        <p><strong>Support / Datenschutz:</strong> irajet.ramadani@gmail.com</p>
        <p><strong>Hosting:</strong> Firebase Hosting (Google Cloud)</p>
        <p><strong>Hinweis:</strong> Kontaktanfragen zu Support und Datenschutz bitte per E-Mail senden.</p>
      </section>
    `
  }
};

function openLegalModal(section = 'privacy') {
  const legalSection = LEGAL_CONTENT[section] || LEGAL_CONTENT.privacy;
  openModal(legalSection.title, legalSection.body);
}

function changeRequestCard(req) {
  const isNameChange = req.type === 'name_change';
  return `
    <section class="card compact">
      <strong>${escapeHtml(req.displayName)}</strong>
      <p>${escapeHtml(req.title)}</p>
      ${isNameChange ? `<div class="readonly-field"><strong>Name</strong><span>${escapeHtml(req.currentName || '-')} → ${escapeHtml(req.requestedName || '-')}</span></div>` : ''}
      <p class="help">${escapeHtml(isNameChange ? (req.reason || req.description || 'Keine Begründung.') : (req.description || 'Keine Beschreibung.'))}</p>
      <div class="badges"><span class="badge">${escapeHtml(req.status || 'offen')}</span><span class="badge">${escapeHtml(req.scope || 'App')}</span></div>
      <div class="row-actions" style="margin-top:12px;">
        <button class="success-button" data-action="approve-change-request" data-id="${req.id}">Freigeben</button>
        <button class="ghost-button" data-action="review-change-request" data-id="${req.id}">In Prüfung</button>
        <button class="danger-button" data-action="reject-change-request" data-id="${req.id}">Ablehnen</button>
      </div>
    </section>
  `;
}

function adminUserLocationLabel(user = {}) {
  if (user.location) return locationLabel(user.location);
  return user.area || 'Kein Standort';
}

function adminUserVerificationLabel(user = {}) {
  if (user.verified) return user.verificationLabel || 'Verifiziert';
  if (user.verificationStatus === 'pending') return 'beantragt';
  if (user.verificationStatus === 'rejected') return 'abgelehnt';
  return 'nicht verifiziert';
}

function pushTokenCountForUser(uid = '') {
  if (!uid) return 0;
  return state.deviceTokens.filter(token => token.uid === uid && token.active !== false).length;
}

function requestStatsForUser(uid = '') {
  const items = state.requests.filter(req => req.uid === uid || req.authorId === uid);
  return {
    total: items.length,
    suche: items.filter(req => req.type === 'Suche').length,
    biete: items.filter(req => req.type === 'Biete').length,
    offen: items.filter(req => req.status === 'offen').length
  };
}

function appointmentStatsForUser(uid = '') {
  const items = state.chatMessages.filter(msg => msg.messageType === 'appointment' && Array.isArray(msg.participants) && msg.participants.includes(uid));
  return {
    total: items.length,
    accepted: items.filter(msg => msg.appointment?.status === 'accepted').length,
    declined: items.filter(msg => msg.appointment?.status === 'declined').length
  };
}

function companyStatusLabel(status = 'none') {
  if (status === 'verified') return 'Firma bestätigt';
  if (status === 'rejected') return 'Firma abgelehnt';
  if (status === 'pending') return 'Firma ungeprüft';
  return '';
}

function companyPostTypeLabel(type = '') {
  if (type === 'lehrstelle') return 'Lehrstelle';
  if (type === 'dienstleistung') return 'Dienstleistung';
  if (type === 'kurzfristig') return 'Kurzfristige Aushilfe';
  if (type === 'arbeit') return 'Mitarbeitende gesucht';
  return '';
}

function adminUsersUiState() {
  const defaults = structuredClone(seed.adminUsers);
  state.adminUsers = {
    ...defaults,
    ...(state.adminUsers || {})
  };
  state.adminUsers.page = Math.max(1, Number(state.adminUsers.page || 1));
  state.adminUsers.pageSize = [10, 20, 50, 100].includes(Number(state.adminUsers.pageSize)) ? Number(state.adminUsers.pageSize) : 20;
  state.adminUsers.view = state.adminUsers.view === 'archive' ? 'archive' : 'active';
  state.adminUsers.dir = state.adminUsers.dir === 'asc' ? 'asc' : 'desc';
  return state.adminUsers;
}

function archivedUserStatus(user = {}) {
  if ((user.accountStatus || '') === 'deleted' || (user.verificationStatus || '') === 'deleted' || user.deletedAt) return 'deleted';
  if ((user.accountStatus || 'active') === 'disabled') return 'disabled';
  return user.accountStatus || 'active';
}

function adminUserVerificationState(user = {}) {
  if (user.verified) return 'verified';
  const status = user.verificationStatus || 'none';
  if (['offen', 'pending', 'in_pruefung', 'zurückgestellt'].includes(status)) return 'pending';
  if (['abgelehnt', 'rejected'].includes(status)) return 'rejected';
  return 'none';
}

function adminUserSearchText(user = {}) {
  return [
    user.displayName,
    user.email,
    user.initials,
    user.companyName,
    user.companyPurpose,
    user.municipalityName,
    user.municipalityDepartment,
    roleLabel(user.role || 'resident'),
    accountTypeLabel(user.accountType || 'resident'),
    adminUserLocationLabel(user),
    user.uid
  ].filter(Boolean).join(' ').toLowerCase();
}

function adminUserMatchesFilters(user = {}, ui = adminUsersUiState()) {
  const archived = isArchivedUser(user);
  if (ui.view === 'archive' ? !archived : archived) return false;
  const status = archivedUserStatus(user);
  if (ui.status !== 'all' && status !== ui.status) return false;
  if (ui.role !== 'all' && (user.role || 'resident') !== ui.role) return false;
  if (ui.accountType !== 'all' && (user.accountType || 'resident') !== ui.accountType) return false;
  if (ui.verification !== 'all' && adminUserVerificationState(user) !== ui.verification) return false;
  if (ui.canton !== 'all' && userCantonCode(user) !== ui.canton) return false;
  const q = String(ui.q || '').trim().toLowerCase();
  return !q || adminUserSearchText(user).includes(q);
}

function adminUserSortValue(user = {}, field = 'updatedAt') {
  if (field === 'name') return String(user.displayName || user.email || '').toLowerCase();
  if (field === 'email') return String(user.email || '').toLowerCase();
  if (field === 'canton') return userCantonCode(user) || '';
  if (field === 'role') return user.role || 'resident';
  if (field === 'createdAt') return normalizeStoredDate(user.createdAt) || '';
  return normalizeStoredDate(user.updatedAt || user.createdAt) || '';
}

function sortAdminUsers(users = [], ui = adminUsersUiState()) {
  const direction = ui.dir === 'asc' ? 1 : -1;
  return users.slice().sort((a, b) => {
    const aValue = adminUserSortValue(a, ui.sort);
    const bValue = adminUserSortValue(b, ui.sort);
    const compared = String(aValue).localeCompare(String(bValue), 'de-CH', { numeric: true, sensitivity: 'base' });
    if (compared) return compared * direction;
    return String(a.displayName || a.email || '').localeCompare(String(b.displayName || b.email || ''), 'de-CH');
  });
}

function adminUsersOptions(options = [], selected = 'all') {
  return options.map(option => `<option value="${escapeHtml(option.value)}" ${option.value === selected ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('');
}

function renderAdminUsersOverview() {
  const ui = adminUsersUiState();
  const allUsers = state.registeredUsers.slice();
  const archivedUsers = allUsers.filter(isArchivedUser);
  const activeUsers = allUsers.filter(user => !isArchivedUser(user));
  // Für das aktuelle MVP wird die Adminliste clientseitig gefiltert; bei sehr grossen Gemeinden kann hier später Firestore-Pagination andocken.
  const filtered = sortAdminUsers(allUsers.filter(user => adminUserMatchesFilters(user, ui)), ui);
  const totalPages = Math.max(1, Math.ceil(filtered.length / ui.pageSize));
  ui.page = Math.min(ui.page, totalPages);
  const pageStart = (ui.page - 1) * ui.pageSize;
  const visibleUsers = filtered.slice(pageStart, pageStart + ui.pageSize);
  const adminCount = activeUsers.filter(user => ['admin', 'area_admin'].includes(user.role)).length;
  const verifiedCount = activeUsers.filter(user => user.verified).length;
  const pushCount = activeUsers.filter(user => pushTokenCountForUser(user.uid) > 0 || user.hasPushToken || user.notifications).length;
  const areaCount = new Set(activeUsers.map(adminUserLocationLabel).filter(Boolean)).size;
  const disabledCount = archivedUsers.filter(user => archivedUserStatus(user) === 'disabled').length;
  const deletedCount = archivedUsers.filter(user => archivedUserStatus(user) === 'deleted').length;
  const companyCount = activeUsers.filter(user => user.accountType === 'company').length;
  const municipalityCount = activeUsers.filter(user => user.accountType === 'municipality').length;
  const pendingMunicipalityCount = activeUsers.filter(user => user.accountType === 'municipality' && user.accountStatus === 'pending_verification').length;
  const cantonOptions = [{ value: 'all', label: 'Alle Kantone' }].concat(
    cantons().map(canton => ({ value: String(canton.code || '').toUpperCase(), label: `${canton.name} (${String(canton.code || '').toUpperCase()})` }))
  );
  const rows = visibleUsers.map((user) => {
    const title = profileTitle(user);
    const pushTokens = pushTokenCountForUser(user.uid);
    const stats = requestStatsForUser(user.uid);
    const appointmentStats = appointmentStatsForUser(user.uid);
    const updated = normalizeStoredDate(user.updatedAt || user.createdAt);
    const accountStatus = archivedUserStatus(user);
    const isDisabled = accountStatus === 'disabled';
    const isDeleted = accountStatus === 'deleted';
    const canToggle = !isDeleted && user.uid !== authState.user?.uid;
    const accountTypeBadge = user.accountType === 'company'
      ? `<span class="badge info">${escapeHtml(user.companyName || 'Firma')}</span>${user.companyStatus ? `<span class="badge">${escapeHtml(companyStatusLabel(user.companyStatus))}</span>` : ''}`
      : user.accountType === 'municipality'
        ? `<span class="badge official">${escapeHtml(user.municipalityName || adminUserLocationLabel(user) || 'Gemeinde')}</span><span class="badge">${escapeHtml(user.municipalityStatus === 'verified' ? 'geprüft' : user.municipalityStatus === 'rejected' ? 'abgelehnt' : 'in Prüfung')}</span>`
        : `<span class="badge">${escapeHtml(accountTypeLabel(user.accountType))}</span>`;
    const municipalityActions = user.accountType === 'municipality' && !isDeleted && user.municipalityStatus !== 'verified'
      ? `<button class="success-button small" data-action="review-municipality" data-approved="true" data-uid="${escapeHtml(user.uid)}">Gemeinde freigeben</button>
         <button class="ghost-button small" data-action="review-municipality" data-approved="false" data-uid="${escapeHtml(user.uid)}">Ablehnen</button>`
      : '';
    const actionCell = canToggle
      ? `<div class="row-actions">
          ${municipalityActions}
          <button class="${isDisabled ? 'success-button' : 'danger-button'} small" data-action="toggle-user-status" data-uid="${escapeHtml(user.uid)}">${isDisabled ? 'Aktivieren' : 'Deaktivieren'}</button>
          ${user.verified ? `<button class="ghost-button small" data-action="revoke-verification" data-uid="${escapeHtml(user.uid)}">Verifizierung widerrufen</button>` : ''}
        </div>`
      : `<span class="badge">${isDeleted ? 'Archiviert' : 'Eigenes Konto'}</span>`;
    return `
      <tr>
        <td>
          <span class="user-cell">
            <strong>${escapeHtml(user.displayName || user.email || 'Unbenannt')}</strong>
            <small>${escapeHtml(user.initials || initialsFromName(user.displayName || user.email || ''))}${title ? ` · ${escapeHtml(title)}` : ''}</small>
          </span>
        </td>
        <td>${escapeHtml(user.email || '-')}</td>
        <td>${escapeHtml(adminUserLocationLabel(user))}</td>
        <td><div class="badges">${trustBadge(user, { detail: true })}<span class="badge ${['admin', 'area_admin'].includes(user.role) ? 'official' : ''}">${escapeHtml(roleLabel(user.role || 'resident'))}</span></div>${user.adminScopeArea ? `<small>${escapeHtml(user.adminScopeArea)}</small>` : ''}</td>
        <td><div class="badges">${accountTypeBadge}${accountStatusBadge(accountStatus)}</div></td>
        <td><span class="badge ${user.verified ? 'official' : 'info'}">${escapeHtml(adminUserVerificationLabel(user))}</span></td>
        <td><button class="ghost-button small" data-action="user-history" data-uid="${escapeHtml(user.uid)}">${stats.total} Einträge</button><small>${stats.suche} Suche · ${stats.biete} Biete · ${appointmentStats.total} Termine${isDisabled ? ' · deaktiviert' : ''}</small></td>
        <td>${pushTokens ? `<span class="badge info">${pushTokens} Gerät${pushTokens > 1 ? 'e' : ''}</span>` : '<span class="badge">0</span>'}</td>
        <td>${updated ? escapeHtml(fmtTime(updated)) : '-'}</td>
        <td>${actionCell}</td>
      </tr>
    `;
  }).join('');

  return `
    <section class="card admin-users-card">
      <div class="request-head">
        <div>
          <h2>Alle registrierten Nutzer</h2>
          <p>Nur für Admins sichtbar. Aktive Konten und Archiv sind getrennt; Tokens werden nicht angezeigt, nur die Anzahl aktiver Push-Geräte.</p>
        </div>
        <button class="ghost-button small" data-action="sync-now" type="button">Aktualisieren</button>
      </div>
      <div class="segmented admin-users-tabs" role="tablist" aria-label="Nutzeransicht">
        <button class="${ui.view === 'active' ? 'active' : ''}" type="button" data-action="set-admin-users-view" data-admin-users-view="active">Aktiv (${formatNumber(activeUsers.length)})</button>
        <button class="${ui.view === 'archive' ? 'active' : ''}" type="button" data-action="set-admin-users-view" data-admin-users-view="archive">Archiv (${formatNumber(archivedUsers.length)})</button>
      </div>
      <div class="admin-user-stats" aria-label="Nutzerstatistik">
        <span class="status-pill"><strong>${escapeHtml(formatNumber(allUsers.length))}</strong> total</span>
        <span class="status-pill"><strong>${escapeHtml(formatNumber(activeUsers.length))}</strong> aktiv</span>
        <span class="status-pill"><strong>${escapeHtml(formatNumber(adminCount))}</strong> Admins</span>
        <span class="status-pill"><strong>${escapeHtml(formatNumber(verifiedCount))}</strong> verifiziert</span>
        <span class="status-pill"><strong>${escapeHtml(formatNumber(companyCount))}</strong> Firmen</span>
        <span class="status-pill"><strong>${escapeHtml(formatNumber(municipalityCount))}</strong> Gemeinden</span>
        <span class="status-pill"><strong>${escapeHtml(formatNumber(pendingMunicipalityCount))}</strong> Gemeindeprüfungen</span>
        <span class="status-pill"><strong>${escapeHtml(formatNumber(disabledCount))}</strong> deaktiviert</span>
        <span class="status-pill"><strong>${escapeHtml(formatNumber(deletedCount))}</strong> gelöscht</span>
        <span class="status-pill"><strong>${escapeHtml(formatNumber(pushCount))}</strong> mit Push</span>
        <span class="status-pill"><strong>${escapeHtml(formatNumber(areaCount))}</strong> Gebiete</span>
      </div>
      <div class="admin-users-controls" aria-label="Nutzer filtern">
        <label>
          Suche
          <input id="adminUserQ" type="search" value="${escapeHtml(ui.q)}" placeholder="Name, E-Mail, Firma, Gebiet">
        </label>
        <label>
          Status
          <select id="adminUserStatus">${adminUsersOptions([
            { value: 'all', label: 'Alle Status' },
            { value: 'active', label: 'Aktiv' },
            { value: 'disabled', label: 'Deaktiviert' },
            { value: 'deleted', label: 'Gelöscht' }
          ], ui.status)}</select>
        </label>
        <label>
          Rolle
          <select id="adminUserRole">${adminUsersOptions([
            { value: 'all', label: 'Alle Rollen' },
            { value: 'admin', label: 'Admin' },
            { value: 'area_admin', label: 'Gemeindeadmin' },
            { value: 'resident', label: 'Bewohner/in' }
          ], ui.role)}</select>
        </label>
        <label>
          Kontotyp
          <select id="adminUserAccountType">${adminUsersOptions([
            { value: 'all', label: 'Alle Typen' },
            { value: 'resident', label: 'Privatperson' },
            { value: 'company', label: 'Firma' },
            { value: 'municipality', label: 'Gemeinde' }
          ], ui.accountType)}</select>
        </label>
        <label>
          Verifizierung
          <select id="adminUserVerification">${adminUsersOptions([
            { value: 'all', label: 'Alle' },
            { value: 'verified', label: 'Verifiziert' },
            { value: 'pending', label: 'Offen/in Prüfung' },
            { value: 'rejected', label: 'Abgelehnt' },
            { value: 'none', label: 'Keine' }
          ], ui.verification)}</select>
        </label>
        <label>
          Kanton
          <select id="adminUserCanton">${adminUsersOptions(cantonOptions, ui.canton)}</select>
        </label>
        <label>
          Sortieren
          <select id="adminUserSort">${adminUsersOptions([
            { value: 'updatedAt', label: 'Aktualisiert' },
            { value: 'createdAt', label: 'Registriert' },
            { value: 'name', label: 'Name' },
            { value: 'email', label: 'E-Mail' },
            { value: 'canton', label: 'Kanton' },
            { value: 'role', label: 'Rolle' }
          ], ui.sort)}</select>
        </label>
        <label>
          Richtung
          <select id="adminUserDir">${adminUsersOptions([
            { value: 'desc', label: 'Absteigend' },
            { value: 'asc', label: 'Aufsteigend' }
          ], ui.dir)}</select>
        </label>
        <label>
          Pro Seite
          <select id="adminUserPageSize">${adminUsersOptions([
            { value: '10', label: '10' },
            { value: '20', label: '20' },
            { value: '50', label: '50' },
            { value: '100', label: '100' }
          ], String(ui.pageSize))}</select>
        </label>
      </div>
      <div class="request-head admin-users-pagination">
        <p class="help">${escapeHtml(formatNumber(filtered.length))} Treffer · Seite ${escapeHtml(formatNumber(ui.page))} von ${escapeHtml(formatNumber(totalPages))}</p>
        <div class="row-actions">
          <button class="ghost-button small" data-action="admin-users-page" data-page="${Math.max(1, ui.page - 1)}" ${ui.page <= 1 ? 'disabled' : ''}>Zurück</button>
          <button class="ghost-button small" data-action="admin-users-page" data-page="${Math.min(totalPages, ui.page + 1)}" ${ui.page >= totalPages ? 'disabled' : ''}>Weiter</button>
        </div>
      </div>
      <div class="table-wrap admin-users-table" style="margin-top:14px;">
        ${rows
          ? `<table>
              <thead><tr><th>Name</th><th>E-Mail</th><th>Gebiet</th><th>Rolle</th><th>Konto</th><th>Verifizierung</th><th>Verlauf</th><th>Push</th><th>Aktualisiert</th><th>Aktion</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>`
          : '<div class="empty">Noch keine registrierten Nutzer geladen.</div>'}
      </div>
    </section>
  `;
}

function userHistoryModal(uidValue) {
  const user = state.registeredUsers.find(item => item.uid === uidValue);
  if (!user) {
    toast('Nutzer nicht gefunden.');
    return;
  }
  const entries = state.requests
    .filter(req => req.uid === uidValue || req.authorId === uidValue)
    .sort((a, b) => new Date(normalizeStoredDate(b.createdAt) || 0) - new Date(normalizeStoredDate(a.createdAt) || 0));
  const disabledNote = user.accountStatus === 'disabled'
    ? '<p class="form-error">Dieses Konto ist deaktiviert. Der Verlauf bleibt zur Moderation sichtbar.</p>'
    : '';
  const rows = entries.map(req => `
    <tr>
      <td><span class="badge ${req.type === 'Suche' ? 'need' : 'offer'}">${escapeHtml(req.type)}</span></td>
      <td>${escapeHtml(req.category || '-')}</td>
      <td><strong>${escapeHtml(req.title || '-')}</strong><small>${escapeHtml(req.text || '')}</small></td>
      <td>${escapeHtml(req.status || 'offen')}</td>
      <td>${escapeHtml(req.area || '-')}</td>
      <td>${escapeHtml(fmtTime(req.createdAt))}</td>
    </tr>
  `).join('');
  openModal(`Verlauf: ${user.displayName || user.email || 'Nutzer/in'}`, `
    <section class="form-grid">
      <div class="badges">
        ${accountStatusBadge(user.accountStatus || 'active')}
        <span class="badge">${escapeHtml(accountTypeLabel(user.accountType))}</span>
        <span class="badge">${entries.length} Suche/Biete-Einträge</span>
      </div>
      ${disabledNote}
      <div class="table-wrap">
        ${entries.length ? `
          <table>
            <thead><tr><th>Typ</th><th>Kategorie</th><th>Eintrag</th><th>Status</th><th>Gebiet</th><th>Datum</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        ` : '<div class="empty">Noch keine Suche/Biete-Einträge.</div>'}
      </div>
    </section>
  `);
}

function renderAdminAuditLog() {
  const rows = state.auditLog.slice(0, 20).map(entry => `
    <tr>
      <td>${escapeHtml(fmtTime(entry.createdAt))}</td>
      <td><strong>${escapeHtml(entry.action)}</strong><small>${escapeHtml(entry.detail || '')}</small></td>
      <td>${escapeHtml(entry.targetLabel || entry.targetEmail || entry.targetUid || '-')}</td>
      <td>${escapeHtml(entry.actorLabel || entry.actorEmail || '-')}</td>
    </tr>
  `).join('');
  return `
    <section class="card">
      <h2>Audit-Log</h2>
      <p class="help">Admin-Aktionen wie Verifizierung, Namensänderung, Rollen und Deaktivierungen werden protokolliert.</p>
      <div class="table-wrap" style="margin-top:12px;">
        ${rows ? `
          <table>
            <thead><tr><th>Zeit</th><th>Aktion</th><th>Ziel</th><th>Admin</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        ` : '<div class="empty">Noch keine Audit-Einträge.</div>'}
      </div>
    </section>
  `;
}

function renderAdminRoleCard() {
  const editing = isEditCardOpen('admin-roles');
  return `
    <article class="card" data-edit-card="admin-roles">
      ${editCardHeader('Rollenverwaltung', 'admin-roles', editing)}
      ${editing ? `
        <form id="adminRoleForm" class="form-grid" style="margin-top:12px;">
          <label>E-Mail
            <input name="email" type="email" required placeholder="name@example.ch" />
          </label>
          <label>Rolle
            <select name="role">
              <option value="admin">Admin</option>
              <option value="area_admin">Gemeindeadmin</option>
              <option value="resident">Bewohner/in</option>
            </select>
          </label>
          <label>Admin-Gebiet (optional)
            <input name="adminScopeArea" maxlength="80" placeholder="${escapeHtml(locationLabel())}" />
          </label>
          <div class="row-actions">
            <button class="secondary-button" type="submit">Rolle speichern</button>
            <button class="ghost-button" type="button" data-action="cancel-edit-card" data-edit-card-id="admin-roles">Abbrechen</button>
          </div>
        </form>
      ` : `
        <div class="list" style="margin-top:12px;">
          <div class="readonly-field"><strong>Aktueller Admin</strong><span>${escapeHtml(profileName())}</span></div>
          <div class="readonly-field"><strong>Hinweis</strong><span>Rollenänderungen sind eingeklappt und nur per Bleistift sichtbar.</span></div>
        </div>
      `}
      <p class="help" style="margin-top:10px;">Rollen werden serverseitig als Firebase Custom Claims gesetzt. Das Profilfeld dient nur der Anzeige und Synchronisation.</p>
    </article>
  `;
}

function requestAuthorLabel(req) {
  if (req.type === 'Biete' && req.anonymousOffer) return 'Anonym';
  if (req.authorAccountType === 'company') return req.companyName || req.authorName || 'Firma';
  return req.author || 'ICH';
}

function chatMessageAuthorLabel(req, msg) {
  if (req.type === 'Biete' && req.anonymousOffer && msg?.uid === req.uid) return 'Anonym';
  return msg?.from || 'Nutzer/in';
}

function requestRadiusBadge(req) {
  const radiusKm = requestRadiusKm(req);
  if (!radiusKm) return '';
  return `<span class="badge info">Reichweite ≤ ${radiusKm} km</span>`;
}

function requestDistanceBadge(req) {
  const distance = requestDistanceKm(req);
  if (distance === null) return '';
  return `<span class="badge info">Distanz ~ ${escapeHtml(distance)} km</span>`;
}

function requestToneClass(req) {
  return req.type === 'Biete' ? 'offer' : 'need';
}

// Quartinaut 4.4 – Social-Feed-Ergänzungen; bestehende Requests/Quartier+-Dokumente bleiben unverändert.
const v44Social={summaries:new Map(),attempted:new Set(),running:false,bookmarkPrefix:'quartinaut-v44-saved:'};
function v44Key(kind,id){return `${kind}:${id}`;}
function v44Saved(kind,id){
  if(v47Sync)return v47Sync.isFavorite(kind,id);
  try{return JSON.parse(localStorage.getItem(v44Social.bookmarkPrefix+(authState.user?.uid||'guest'))||'[]').includes(v44Key(kind,id));}catch{return false;}
}
function v44SavedPanel(){
  const key=v44Social.bookmarkPrefix+(authState.user?.uid||'guest');let keys=v46SavedPostKeys();
  if(!v47Sync)try{keys=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(keys))keys=[];}catch{}
  const entries=keys.map(value=>{
    const [kind,...parts]=String(value).split(':'),id=parts.join(':');
    const item=kind==='request'?(state.requests||[]).find(x=>x.id===id):kind==='hub'?hubState.items.find(x=>x.id===id):null;
    return item?{kind,id,title:item.title||'Beitrag',area:item.area||'',item}:null;
  }).filter(Boolean);
  return `<section class="v44-saved-list">${entries.length?entries.map(x=>`<div class="v44-saved-entry"><div><strong>${escapeHtml(x.title)}</strong><small>${escapeHtml(x.area)} · ${x.kind==='request'?'Nachbarschaft':'Quartier+'}</small></div><button type="button" class="secondary-button small" data-v44-open-saved="${escapeHtml(x.kind)}" data-id="${escapeHtml(x.id)}">Ansehen</button></div>`).join(''):'<p class="help">Noch keine gespeicherten Beiträge. Nutze das Merken-Symbol unter einem Beitrag.</p>'}</section>`;
}
function v44ToggleSaved(kind,id){
  if(v47Sync){const active=!v47Sync.isFavorite(kind,id);v47Sync.setFavorite(kind,id,active);return active;}
  const key=v44Key(kind,id),storage=v44Social.bookmarkPrefix+(authState.user?.uid||'guest');
  let all=[];try{all=JSON.parse(localStorage.getItem(storage)||'[]');if(!Array.isArray(all))all=[];}catch{}
  all=all.includes(key)?all.filter(x=>x!==key):[...all.slice(-249),key];
  try{localStorage.setItem(storage,JSON.stringify(all));}catch{}
  return all.includes(key);
}
function v44Avatar(name){
  const letters=String(name||'Q').trim().split(/\s+/).map(x=>x[0]||'').slice(0,2).join('').toUpperCase();
  return `<span class="v44-avatar" aria-hidden="true">${escapeHtml(letters||'Q')}</span>`;
}
function v44FeedActions(kind,id){
  const key=v44Key(kind,id),summary=v44Social.summaries.get(key)||{},saved=v44Saved(kind,id);
  const likes=Number(summary.likes||0),comments=Number(summary.comments||0),liked=Boolean(summary.liked);
  return `<div class="v44-social-actions" data-social-kind="${escapeHtml(kind)}" data-social-id="${escapeHtml(id)}">
    <button type="button" data-v44-like aria-label="${liked?'Gefällt mir entfernen':'Gefällt mir'}" aria-pressed="${liked}">${iconSvg('heart')} <span>${likes?formatNumber(likes):'Gefällt mir'}</span></button>
    <button type="button" data-v44-comments aria-label="Kommentare anzeigen">${iconSvg('chat')} <span>${comments?formatNumber(comments):'Kommentieren'}</span></button>
    ${kind==='group_post'?'':`<button type="button" data-v44-save aria-label="${saved?'Merkliste entfernen':'Beitrag merken'}" aria-pressed="${saved}">${iconSvg('bookmark')}</button>
    <button type="button" data-v44-share aria-label="Beitrag teilen">${iconSvg('share')}</button>`}
  </div>`;
}
function v44PostHead(name,place,date,label){
  return `<header class="v44-post-head">${v44Avatar(name)}<div class="v44-post-author"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(place||'Deine Gemeinde')} · ${escapeHtml(date||'')}</small></div><span class="v44-post-tag">${escapeHtml(label||'Beitrag')}</span></header>`;
}
async function v44LoadSocial(){
  if(v44Social.running||!isFirebaseMode()||!authState.user)return;
  const visible=[...document.querySelectorAll('.v44-social-actions[data-social-kind][data-social-id]')];
  const toFetch=visible.map(el=>({kind:el.dataset.socialKind,id:el.dataset.socialId})).filter(x=>/^(request|hub|group_post)$/.test(x.kind)&&/^[a-zA-Z0-9_-]{5,150}$/.test(x.id)&&!v44Social.attempted.has(v44Key(x.kind,x.id))).slice(0,40);
  if(!toFetch.length)return;
  toFetch.forEach(x=>v44Social.attempted.add(v44Key(x.kind,x.id)));
  v44Social.running=true;
  try{
    const result=await callQuartinaut('quartinautSocial',{action:'summary',posts:toFetch});
    for(const [key,data] of Object.entries(result.summaries||{}))v44Social.summaries.set(key,data);
    document.querySelectorAll('.v44-social-actions').forEach(el=>v44RefreshSocial(el));
  }catch(error){console.warn('[Quartinaut] Social-Funktion nicht verfügbar.',error);}
  finally{v44Social.running=false;queueMicrotask(()=>void v44LoadSocial());}
}
function v44RefreshSocial(el){
  const kind=el.dataset.socialKind,id=el.dataset.socialId,summary=v44Social.summaries.get(v44Key(kind,id))||{};
  const like=el.querySelector('[data-v44-like]'),comment=el.querySelector('[data-v44-comments]'),save=el.querySelector('[data-v44-save]');
  if(like){like.setAttribute('aria-pressed',String(Boolean(summary.liked)));like.setAttribute('aria-label',summary.liked?'Gefällt mir entfernen':'Gefällt mir');const text=like.querySelector('span');if(text)text.textContent=summary.likes?formatNumber(summary.likes):'Gefällt mir';}
  if(comment){const text=comment.querySelector('span');if(text)text.textContent=summary.comments?formatNumber(summary.comments):'Kommentieren';}
  if(save){save.setAttribute('aria-pressed',String(v44Saved(kind,id)));save.setAttribute('aria-label',v44Saved(kind,id)?'Merkliste entfernen':'Beitrag merken');}
}
async function v44CommentsModal(kind,id){
  let renderComments=()=>{};
  openModal('Kommentare',`<section class="v44-comments" aria-label="Öffentliche Kommentare"><div data-v44-comment-list aria-live="polite">Kommentare werden geladen …</div>
    <form id="v44CommentForm" class="v44-comment-form"><label for="v44CommentText">Kommentar schreiben</label>
    <textarea id="v44CommentText" name="text" maxlength="400" minlength="2" required rows="2" placeholder="Freundlich bleiben – keine privaten Kontaktdaten."></textarea>
    <button class="primary-button" type="submit">Kommentar veröffentlichen</button></form><p class="help">Kommentare sind für Personen sichtbar, die diesen Beitrag sehen dürfen. Für private Absprachen nutze den Chat.</p></section>`,(modal,close)=>{
    const list=modal.querySelector('[data-v44-comment-list]');
    renderComments=async()=>{
      try{
        const response=await callQuartinaut('quartinautSocial',{action:'comments.list',kind,id});
        const rows=response.comments||[];
        list.innerHTML=rows.length?rows.map(c=>`<article class="v44-comment">${v44Avatar(c.authorName)}<div><div><strong>${escapeHtml(c.authorName||'Mitglied')}</strong> <small>${escapeHtml(relative(c.createdAt))}</small></div><p>${escapeHtml(c.text)}</p>${c.mine||c.moderator?`<button class="ghost-button small" data-v44-delete-comment="${escapeHtml(c.id)}">Entfernen</button>`:`<button class="ghost-button small" data-v44-report-comment="${escapeHtml(c.id)}">Melden</button>`}</div></article>`).join(''):'<p class="v44-empty-comments">Noch keine Kommentare. Starte das Gespräch.</p>';
      }catch(error){list.textContent='Kommentare konnten nicht geladen werden. Bitte später erneut versuchen.';}
    };
    modal.querySelector('#v44CommentForm').addEventListener('submit',async event=>{
      event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type=submit]');button.disabled=true;
      try{
        const text=form.elements.text.value.trim();if(text.length<2)return;
        const result=await callQuartinaut('quartinautSocial',{action:'comment.create',kind,id,text});
        v44Social.summaries.set(v44Key(kind,id),result.summary||{});
        document.querySelectorAll('.v44-social-actions').forEach(el=>v44RefreshSocial(el));
        form.reset();await renderComments();
      }catch(error){toast('Kommentar konnte nicht gespeichert werden: '+(error.message||'Bitte erneut versuchen.'));}
      finally{button.disabled=false;}
    });
    list.addEventListener('click',async event=>{
      const del=event.target.closest('[data-v44-delete-comment]');const report=event.target.closest('[data-v44-report-comment]');if(!del&&!report)return;
      const clicked=del||report;clicked.disabled=true;
      try{
        const result=await callQuartinaut('quartinautSocial',{action:del?'comment.delete':'comment.report',kind,id,commentId:del?.dataset.v44DeleteComment||report?.dataset.v44ReportComment});
        if(result.summary)v44Social.summaries.set(v44Key(kind,id),result.summary);
        document.querySelectorAll('.v44-social-actions').forEach(el=>v44RefreshSocial(el));
        toast(del?'Kommentar entfernt.':'Kommentar gemeldet.');await renderComments();
      }catch(error){toast(error.message||'Aktion fehlgeschlagen.');clicked.disabled=false;}
    });
    void renderComments();
  });
}
// Horizontale Touch-Gesten – vertikales Scrollen der PWA bleibt verfügbar.
document.addEventListener('pointerdown',event=>{
  const gallery=event.target.closest?.('[data-v44-carousel]');
  if(!gallery)return;
  gallery.dataset.touchStartX=String(event.clientX);gallery.dataset.touchStartY=String(event.clientY);
});
document.addEventListener('pointerup',event=>{
  const gallery=event.target.closest?.('[data-v44-carousel]');
  if(!gallery||!gallery.dataset.touchStartX)return;
  const dx=event.clientX-Number(gallery.dataset.touchStartX),dy=event.clientY-Number(gallery.dataset.touchStartY);
  delete gallery.dataset.touchStartX;delete gallery.dataset.touchStartY;
  if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.4)
    gallery.querySelector(dx<0?'[data-v44-carousel-step="1"]':'[data-v44-carousel-step="-1"]')?.click();
});

// Delegierte Events: funktionieren auch, wenn der Feed live neu gerendert wird.
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-v44-carousel-step], [data-v44-like], [data-v44-comments], [data-v44-save], [data-v44-share], [data-v44-open-saved]');
  if(!target)return;
  event.preventDefault();
  if(target.matches('[data-v44-open-saved]')){
    const kind=target.dataset.v44OpenSaved,id=target.dataset.id;
    if(kind==='request'){
      setRoute('bulletin');requestAnimationFrame(()=>document.querySelector(`[data-request-id="${cssEscape(id)}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}));
    }else{
      const item=hubState.items.find(x=>x.id===id);
      if(item){hubState.section=item.kind;setRoute('hub');requestAnimationFrame(()=>document.querySelector(`[data-hub-post-id="${cssEscape(id)}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}));}
      else toast('Bitte Quartier+ öffnen, um den Beitrag neu zu laden.');
    }return;
  }
  if(target.matches('[data-v44-carousel-step]')){
    const gallery=target.closest('[data-v44-carousel]'),slides=gallery?.querySelectorAll('.v44-carousel-slide');if(!gallery||!slides?.length)return;
    const next=(Number(gallery.dataset.current||0)+Number(target.dataset.v44CarouselStep)+slides.length)%slides.length;
    gallery.dataset.current=String(next);gallery.querySelector('.v44-carousel-track').style.transform=`translateX(-${next*100}%)`;
    const counter=gallery.querySelector('.v44-carousel-count');if(counter)counter.textContent=`${next+1} / ${slides.length}`;
    gallery.querySelectorAll('.v44-carousel-dots span').forEach((dot,i)=>dot.classList.toggle('active',i===next));return;
  }
  const bar=target.closest('.v44-social-actions'),kind=bar?.dataset.socialKind,id=bar?.dataset.socialId;
  if(!kind||!id)return;
  if(target.matches('[data-v44-save]')){const saved=v44ToggleSaved(kind,id);v44RefreshSocial(bar);toast(saved?'Beitrag gemerkt.':'Aus Merkliste entfernt.');return;}
  if(target.matches('[data-v44-share]')){
    const url=new URL(location.href);url.searchParams.set('route',kind==='request'?'bulletin':'hub');
    const info=`Quartinaut – Beitrag in deiner Gemeinde: ${url}`;
    try{if(navigator.share)await navigator.share({title:'Quartinaut',url:url.toString()});else if(navigator.clipboard){await navigator.clipboard.writeText(info);toast('Link kopiert.');}else toast('Bitte Browser-Link teilen.');}
    catch(error){if(error?.name!=='AbortError')toast('Teilen nicht verfügbar.');}return;
  }
  if(target.matches('[data-v44-comments]')){void v44CommentsModal(kind,id);return;}
  if(target.matches('[data-v44-like]')){
    target.disabled=true;
    try{const result=await callQuartinaut('quartinautSocial',{action:'like.toggle',kind,id});v44Social.summaries.set(v44Key(kind,id),result.summary||{});document.querySelectorAll('.v44-social-actions').forEach(el=>v44RefreshSocial(el));}
    catch(error){toast('Gefällt mir momentan nicht verfügbar.');}
    finally{target.disabled=false;}
  }
});
function requestCard(req) {
  const typeClass=requestToneClass(req),isPublic=(req.status||'offen')==='offen';
  const isAdmin=isAdminRole(),isOwner=requestOwnerUid(req)===authState.user?.uid;
  const canEdit=isOwner||isAdmin,canComplete=canEdit,ownerChats=isOwner?requestChats(req.id):[];
  const directChat=directChatForRequest(req);
  const chatLabel=isOwner?`Gespräche (${ownerChats.length})`:(directChat?'Chat fortsetzen':'Privat schreiben');
  const name=req.type==='Biete'&&req.anonymousOffer?'Anonym':req.authorName||requestAuthorLabel(req);
  const status=requestStatusBadge(req);
  return `<article class="card request-card request-kind-${typeClass} v44-post" data-request-id="${escapeHtml(req.id)}">
    ${v44PostHead(name,req.area,relative(req.createdAt),req.type==='Biete'?'Angebot':'Gesuch')}
    <div class="v44-post-body"><h3>${escapeHtml(req.title)}</h3><p>${escapeHtml(req.text)}</p></div>
    ${postPhotoGallery(req.photoPaths)}
    <div class="v44-post-meta"><span>${escapeHtml(req.category||'Nachbarschaft')}</span><span>${escapeHtml(req.urgency||'')}</span>${status}</div>
    ${isPublic?v44FeedActions('request',req.id):''}
    <div class="v44-post-contact">
      ${dynamicTextTranslateButton('request',req.id)}
      ${isPublic?`<button class="secondary-button" data-action="open-chat" data-id="${escapeHtml(req.id)}">${iconSvg('chat')} ${escapeHtml(chatLabel)}</button>`:''}
      <details class="v44-more"><summary>Weitere Optionen</summary><div class="v44-more-actions">
        ${trustBadge(profileFromRequest(req),{detail:true})}
        ${Number(state.publicTrust?.[requestOwnerUid(req)]?.count||0)>0?`<span class="badge v21-rating-badge">★ ${escapeHtml(Number(state.publicTrust[requestOwnerUid(req)].average).toFixed(1))}</span>`:''}
        ${requestRadiusBadge(req)}${requestDistanceBadge(req)}${recurringBadge(req)}
        ${req.expiresAt?`<span class="badge ttl">⏳ ${escapeHtml(expiryLabel(req.expiresAt))}</span>`:''}
        ${req.status==='abgelehnt'&&req.rejectionReason?`<span class="form-error">${escapeHtml(req.rejectionReason)}</span>`:''}
        ${canEdit?`<button class="ghost-button small" data-action="edit-request" data-id="${escapeHtml(req.id)}">Bearbeiten</button>`:''}
        ${canComplete&&isPublic?`<button class="success-button small" data-action="complete" data-id="${escapeHtml(req.id)}">Erledigt</button>`:''}
        ${isPublic?`<button class="ghost-button small" data-action="report" data-id="${escapeHtml(req.id)}">Melden</button>`:''}${isPublic?`<button class="ghost-button small" type="button" data-v46-hide-post="request" data-id="${escapeHtml(req.id)}">Nur bei mir ausblenden</button>`:''}
        ${isAdmin?`<button class="ghost-button small" data-action="raise-escalation" data-id="${escapeHtml(req.id)}">Eskalieren</button>`:''}
      </div></details>
    </div>
  </article>`;
}

const SEVERITY_META = {
  critical: { cls: 'critical', badge: 'need', label: 'P0 · Notfall' },
  warn: { cls: 'warn', badge: 'warn', label: 'P1 · Wichtig' },
  info: { cls: '', badge: 'info', label: 'P2 · Info' }
};

function alertCard(alert) {
  const meta = SEVERITY_META[alert.severity] || SEVERITY_META.info;
  const validNote = alert.validUntil ? `<span>·</span><span>gültig bis ${fmtTime(alert.validUntil)}</span>` : '';
  const approvedNote = alert.approvedBy ? `<span>·</span><span>freigegeben: ${escapeHtml(alert.approvedBy)}</span>` : '';
  const seen = hasSeenAlert(alert.id);
  const seenCount = alertReadCount(alert.id);
  const seenBadge = isAdminRole()
    ? `<span class="badge info">Gesehen: ${seenCount}</span>`
    : (seen ? '<span class="badge done">Gesehen</span>' : '');
  return `
    <article class="card alert-card ${meta.cls}">
      <div class="badges">
        <span class="badge official">✓ verifiziert</span>
        <span class="badge ${meta.badge}">${meta.label}</span>
        <span class="badge">${escapeHtml(alert.area)}</span>
        ${seenBadge}
      </div>
      <h3 style="margin-top:10px;">${escapeHtml(alert.title)}</h3>
      <p>${escapeHtml(alert.text)}</p>
      <div class="alert-meta"><span>${escapeHtml(alert.createdBy)}</span><span>·</span><span>${fmtTime(alert.createdAt)}</span><span>·</span><span>${escapeHtml(alert.channel || 'PWA')}</span>${validNote}${approvedNote}</div>
      <div class="row-actions" style="margin-top:12px;">
        <button class="ghost-button small" data-action="mark-alert-read" data-id="${alert.id}" ${seen ? 'disabled' : ''}>${seen ? 'Bestätigt' : 'Gesehen'}</button>
      </div>
    </article>
  `;
}

async function markAlertRead(alertId) {
  if (!authState.user) return;
  if (hasSeenAlert(alertId)) return;
  const payload = {
    id: `read_${alertId}_${authState.user.uid}`,
    alertId,
    uid: authState.user.uid,
    email: authState.user.email,
    displayName: profileName(),
    area: state.profile.area,
    readAt: nowIso(),
    createdAt: nowIso()
  };
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.alertReads, payload.id, payload, false);
    await syncStateFromFirestore();
  } else {
    state.alertReads.unshift(payload);
    saveState();
  }
  render();
  toast('Alarm als gelesen markiert.');
}

function threadCard(chat) {
  const req = requestById(chat.requestId) || {};
  const latestInfo = chat.lastMessageAt
    ? `${escapeHtml(chatPeerLabel(chat))} · ${fmtTime(chat.lastMessageAt)}`
    : 'noch keine Nachricht';
  const preview = chat.lastMessagePreview || 'Privater Chat wurde gestartet.';
  const ttlNote = req.expiresAt ? `<p class="help" style="margin-top:10px;">Anliegen ${escapeHtml(expiryLabel(req.expiresAt))} – danach wird automatisch archiviert.</p>` : '';
  return `
    <section class="direct-chat-card">
      <div class="direct-chat-head">
        <div class="request-title">
          <h3>${escapeHtml(chat.requestTitle || req.title || 'Privater Chat')}</h3>
          <small>${escapeHtml(req.area || 'Direktvermittlung')} · ${escapeHtml(req.category || 'P2P')}</small>
        </div>
        <div class="badges">
          <span class="badge info">Privat</span>
        </div>
      </div>
      <div class="chat-thread direct-chat-thread" style="margin-top:10px;">
        <div class="message"><span>${escapeHtml(preview)}</span><small>${escapeHtml(chatPeerLabel(chat))}</small></div>
      </div>
      <div class="direct-chat-meta">Letzte Aktivität: ${latestInfo}</div>
      ${ttlNote}
      <div class="row-actions" style="margin-top:12px;">
        <button class="secondary-button" data-action="open-private-chat" data-chat-id="${escapeHtml(chat.id)}">${iconSvg('chat')} Chat öffnen</button>
        ${req.id && req.uid === authState.user?.uid ? `<button class="danger-button" data-action="complete" data-id="${escapeHtml(req.id)}">Abschliessen</button>` : ''}
      </div>
    </section>
  `;
}

function moderationCard(item) {
  return `
    <section class="card compact">
      <div class="badges"><span class="badge warn">${escapeHtml(item.risk)}</span><span class="badge">${escapeHtml(item.area)}</span></div>
      <h3 style="margin-top:8px;">${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.detail)}</p>
      <div class="row-actions" style="margin-top:12px;">
        <button class="success-button" data-action="resolve-mod" data-id="${item.id}">Erledigen</button>
        <button class="danger-button" data-action="escalate-mod" data-id="${item.id}">Eskalieren</button>
      </div>
    </section>
  `;
}

let modalDepth = 0;
let modalAppRestore = null;

function modalFocusableElements(modal) {
  return Array.from(modal.querySelectorAll([
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(','))).filter(element => !element.hidden && element.getClientRects().length > 0);
}

function enterModalPageState() {
  const appShell = byId('app');
  if (modalDepth === 0) {
    modalAppRestore = appShell ? {
      ariaHidden: appShell.getAttribute('aria-hidden'),
      inert: 'inert' in appShell ? appShell.inert : null
    } : null;
    document.body.classList.add('modal-open');
    if (appShell) {
      appShell.setAttribute('aria-hidden', 'true');
      if ('inert' in appShell) appShell.inert = true;
    }
  }
  modalDepth += 1;
}

function leaveModalPageState() {
  modalDepth = Math.max(0, modalDepth - 1);
  if (modalDepth !== 0) return;
  const appShell = byId('app');
  document.body.classList.remove('modal-open');
  if (!appShell || !modalAppRestore) return;
  if (modalAppRestore.ariaHidden === null) appShell.removeAttribute('aria-hidden');
  else appShell.setAttribute('aria-hidden', modalAppRestore.ariaHidden);
  if ('inert' in appShell && modalAppRestore.inert !== null) appShell.inert = modalAppRestore.inert;
  modalAppRestore = null;
}

// Quartinaut 4.2 – Entwurfsicherung nur für neue Beiträge / öffentliche Einträge.
// Keine Passwörter, Dateien oder Administrationsdaten in localStorage ablegen.
const DRAFT_PREFIX='quartinaut-draft-v42:';
const DRAFT_TTL=72*60*60*1000;
const DRAFT_FORM_IDS=new Set(['requestForm','v3HubCreate','v3EventSeries','v3GroupPost','v3ContactForm','v3DraftForm']);
function draftKey(form,context='') {
  if(!form || !DRAFT_FORM_IDS.has(form.id) || !authState.user?.uid) return '';
  const suffix=form.id==='v3HubCreate'?(context||hubState.section||'all'):
    form.id==='v3GroupPost'?(context||hubState.activeGroup||''):
    form.id==='v3DraftForm'?'draft-assistant':context;
  return DRAFT_PREFIX+authState.user.uid+':'+form.id+':'+String(suffix).slice(0,80);
}
function draftValues(form) {
  return [...form.elements].filter(el=>el.name && !['password','file','hidden'].includes(el.type) && !el.disabled)
    .map(el=>({name:el.name,type:el.type,value:String(el.value||'').slice(0,2500),checked:!!el.checked}));
}
function saveFormDraft(form, key) {
  if(!key) return;
  try {
    const values=draftValues(form), payload={saved:Date.now(),values,step:Number(form.dataset.wizardStep||0)};
    if(form.id==='requestForm'){payload.v47OpId=form.dataset.v47OpId||'';payload.v47CreatedAt=form.dataset.v47CreatedAt||'';}
    const raw=JSON.stringify(payload);
    if(raw.length<24000)localStorage.setItem(key,raw);
    const hint=form.closest('.modal-backdrop')?.querySelector('.v42-draft-hint');
    if(hint)hint.textContent='Entwurf automatisch auf diesem Gerät gesichert';
  }catch(error){ console.warn('[Quartinaut] Entwurfsicherung nicht verfügbar',error); }
}
function restoreFormDraft(form,key) {
  if(!key)return false;
  try {
    const raw=localStorage.getItem(key);if(!raw)return false;
    const data=JSON.parse(raw);
    if(!data || Date.now()-Number(data.saved)>DRAFT_TTL){localStorage.removeItem(key);return false;}
    const all=[...form.elements];const consumed=new Set();
    for(const entry of data.values||[]){
      const target=all.find((el,index)=>!consumed.has(index)&&el.name===entry.name&&el.type===entry.type);
      if(!target)continue;
      consumed.add(all.indexOf(target));
      if(target.type==='checkbox'||target.type==='radio')target.checked=Boolean(entry.checked);
      else target.value=String(entry.value||'');
      target.dispatchEvent(new Event('change',{bubbles:false}));
    }
    if(form.id==='requestForm'){if(data.v47OpId)form.dataset.v47OpId=data.v47OpId;if(data.v47CreatedAt)form.dataset.v47CreatedAt=data.v47CreatedAt;form.dispatchEvent(new CustomEvent('quartinaut:draft-restored',{detail:{step:Number(data.step||0)}}));}
    return true;
  }catch(error){console.warn('[Quartinaut] Entwurf konnte nicht wiederhergestellt werden',error);return false;}
}
function clearFormDraft(key) {if(key)try{localStorage.removeItem(key)}catch{}}
function manageModalDraft(modal) {
  const form=modal.querySelector('form[id]');
  const key=draftKey(form,modal.dataset.draftContext||'');
  if(!key)return ()=>{};
  const hint=document.createElement('div');hint.className='v42-draft-footer';
  hint.innerHTML='<span class="v42-draft-hint" aria-live="polite">Eingaben werden automatisch auf diesem Gerät gespeichert</span><button class="ghost-button small v42-discard-draft" type="button">Entwurf verwerfen</button>';
  form.append(hint);
  const restored=restoreFormDraft(form,key);
  if(restored)hint.querySelector('.v42-draft-hint').textContent='Gespeicherten Entwurf wiederhergestellt';
  let timer=0;
  const write=()=>{clearTimeout(timer);timer=setTimeout(()=>saveFormDraft(form,key),180)};
  const saveOnHide=()=>{if(document.hidden)saveFormDraft(form,key)};
  const saveOnPageHide=()=>saveFormDraft(form,key);
  document.addEventListener('visibilitychange',saveOnHide);
  window.addEventListener('pagehide',saveOnPageHide);
  modal.addEventListener('modal:close',()=>{
    document.removeEventListener('visibilitychange',saveOnHide);
    window.removeEventListener('pagehide',saveOnPageHide);
  },{once:true});
  form.addEventListener('input',write);
  form.addEventListener('change',write);
  form.addEventListener('quartinaut:wizard-step',write);
  hint.querySelector('button').addEventListener('click',()=>{
    clearTimeout(timer);clearFormDraft(key);form.reset();
    form.dispatchEvent(new CustomEvent('quartinaut:draft-restored',{detail:{step:0}}));
    hint.querySelector('.v42-draft-hint').textContent='Entwurf verworfen';
  });
  return completed=>{
    clearTimeout(timer);
    if(completed)clearFormDraft(key);
    else if(form.isConnected)saveFormDraft(form,key);
  };
}
// Bei automatischem Neuzeichnen der Quartier+-Ansicht bleiben Texte erhalten.
function persistInlineDraft() {
  const form=byId('v3DraftForm');if(form)saveFormDraft(form,draftKey(form));
}
function restoreInlineDraft() {
  const form=byId('v3DraftForm');if(form)restoreFormDraft(form,draftKey(form));
}
document.addEventListener('input',event=>{
  const form=event.target.closest?.('#v3DraftForm');
  if(form)saveFormDraft(form,draftKey(form));
});

function openModal(title, bodyHtml, onReady) {
  const template = byId('modalTemplate');
  const modal = template.content.firstElementChild.cloneNode(true);
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const modalCard = modal.querySelector('.modal-card');
  modal.querySelector('#modalTitle').textContent = title;
  modal.querySelector('.modal-body').innerHTML = bodyHtml;
  modalCard?.setAttribute('tabindex', '-1');
  enterModalPageState();
  document.body.appendChild(modal);
  let closed = false;
  const onKeydown = (event) => {
    if (event.key === 'Escape') {
      // An active editor is never dismissed by an accidental Escape key.
      if (!modal.querySelector('form[id]')) close();
      event.preventDefault();
    }
    if (event.key !== 'Tab') return;
    const focusable = modalFocusableElements(modal);
    if (!focusable.length) {
      event.preventDefault();
      modalCard?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  let finishDraft=()=>{};
  const close = (completed=false) => {
    if (closed) return;
    finishDraft(Boolean(completed));
    closed = true;
    activeModalClosers.delete(close);
    window.removeEventListener('keydown', onKeydown);
    modal.dispatchEvent(new Event('modal:close'));
    modal.remove();
    leaveModalPageState();
    if (previousFocus?.isConnected) previousFocus.focus();
  };
  activeModalClosers.add(close);
  modal.querySelector('[data-close-modal]').addEventListener('click', close);
  // Tapping outside a form must never lose an unfinished entry.
  modal.addEventListener('click', (event) => { if (event.target === modal && !modal.querySelector('form[id]')) close(); });
  window.addEventListener('keydown', onKeydown);
  onReady?.(modal, close);
  finishDraft=manageModalDraft(modal);
  applyI18n(modal);
  const firstInput = modal.querySelector('input, textarea, select, button');
  (firstInput || modalCard)?.focus();
}

function requestLocationChangeModal() {
  const picker = locationOptions(state.profile.location);
  openModal('Standortwechsel beantragen', `
    <form id="locationChangeForm" class="form-grid">
      <div class="card compact soft"><strong>Aktueller Standort</strong><p>${escapeHtml(locationLabel())}</p></div>
      <div class="form-grid two">
        <label>Neuer Kanton
          ${picker.cantonSelect}
        </label>
        <label>Neue Gemeinde / neuer Ort
          ${picker.municipalitySelect}
        </label>
      </div>
      <label>Begründung
        <textarea name="reason" maxlength="260" required placeholder="Kurze Begründung für den Standortwechsel"></textarea>
      </label>
      <button class="primary-button" type="submit">Antrag senden</button>
    </form>
  `, (modal, close) => {
    bindLocationPicker(modal);
    modal.querySelector('#locationChangeForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = event.currentTarget.querySelector('button[type="submit"]');
      submit.disabled = true;
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const targetLocation = buildLocation(data.cantonBfsCode, data.municipalityBfsCode);
      if (!targetLocation) {
        toast('Bitte gültigen Standort wählen.');
        submit.disabled = false;
        return;
      }
      const payload = {
        id: uid('locreq'),
        uid: authState.user.uid,
        email: authState.user.email,
        displayName: profileName(),
        currentLocation: state.profile.location,
        currentLabel: locationLabel(),
        targetLocation,
        targetLabel: locationLabel(targetLocation),
        reason: data.reason,
        status: 'offen',
        createdAt: nowIso()
      };
      try {
        if (isFirebaseMode()) {
          await setFirebaseDoc(FIRESTORE_COLLECTIONS.locationChangeRequests, payload.id, payload, false);
          await syncStateFromFirestore();
        } else {
          state.locationChangeRequests.unshift(payload);
          saveState();
        }
        close();
        render();
        toast('Standortantrag gesendet.');
      } finally {
        submit.disabled = false;
      }
    });
  });
}

function requestNameChangeModal() {
  openModal('Namensänderung beantragen', `
    <form id="nameChangeForm" class="form-grid">
      <div class="readonly-field"><strong>Aktueller Name</strong><span>${escapeHtml(state.profile.name)}</span></div>
      <label>Neuer Name
        <input name="requestedName" required maxlength="60" autocomplete="name" placeholder="Vorname Nachname" />
      </label>
      <label>Begründung
        <textarea name="reason" required maxlength="320" placeholder="Warum soll der Name geändert werden?"></textarea>
      </label>
      <p class="help">Der Name wird erst nach Admin-Prüfung geändert. Für Identitätsbestätigungen kann zusätzlich eine Verifizierung mit Ausweisfoto beantragt werden.</p>
      <p id="nameChangeError" class="form-error" role="alert"></p>
      <button class="primary-button" type="submit">Antrag senden</button>
    </form>
  `, (modal, close) => {
    modal.querySelector('#nameChangeForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('button[type="submit"]');
      const errorNode = modal.querySelector('#nameChangeError');
      submit.disabled = true;
      if (errorNode) errorNode.textContent = '';
      const data = Object.fromEntries(new FormData(form));
      const requestedName = String(data.requestedName || '').trim();
      const reason = String(data.reason || '').trim();
      if (requestedName.length < 3 || !requestedName.includes(' ')) {
        const message = 'Bitte Vor- und Nachname angeben.';
        if (errorNode) errorNode.textContent = message;
        toast(message);
        submit.disabled = false;
        return;
      }
      const payload = {
        id: uid('namereq'),
        uid: authState.user.uid,
        email: authState.user.email,
        displayName: profileName(),
        type: 'name_change',
        title: `Namensänderung: ${state.profile.name} → ${requestedName}`,
        scope: 'Profil',
        currentName: state.profile.name,
        requestedName,
        reason,
        description: reason,
        status: 'offen',
        createdAt: nowIso()
      };
      try {
        if (isFirebaseMode()) {
          await setFirebaseDoc(FIRESTORE_COLLECTIONS.changeRequests, payload.id, payload, false);
          await syncStateFromFirestore().catch(error => reportBackgroundError('Nach Namensantrag synchronisieren', error));
        } else {
          state.changeRequests.unshift(payload);
          saveState();
        }
        close();
        render();
        toast('Namensänderung beantragt.');
      } catch (error) {
        const message = actionErrorMessage(error, 'Namensänderung konnte nicht beantragt werden.');
        if (errorNode) errorNode.textContent = message;
        toast(message);
      } finally {
        submit.disabled = false;
      }
    });
  });
}

function requestVerificationModal() {
  const isCompanyProfile = state.profile.accountType === 'company';
  openModal('Verifizierung beantragen', `
    <form id="verificationForm" class="form-grid">
      <div class="card compact soft">
        <strong>${isCompanyProfile ? 'Firmenkonto: verantwortliche Person prüfen' : 'Privatperson verifizieren'}</strong>
        <p class="help">${isCompanyProfile ? 'Der Nachweis bestätigt die verantwortliche Person. Die Firmenfreigabe wird separat als Firmenstatus gespeichert.' : 'Der Nachweis dient zur Namens- und Identitätsprüfung.'}</p>
      </div>
      <label>Verifizierungsmethode
        <select name="method">
          <option>Gemeinderegister / Einwohnerkontrolle</option>
          <option>Persönliche Prüfung durch Administration</option>
          <option>Bestätigung durch Quartierverein</option>
          ${isCompanyProfile ? '<option>Firmennachweis / UID- oder Handelsregister-Hinweis</option>' : ''}
        </select>
      </label>
      <label>Notiz
        <textarea name="note" maxlength="260" placeholder="Hinweis für die Administration"></textarea>
      </label>
      <label>${isCompanyProfile ? 'Nachweisfoto' : 'Ausweisfoto'}
        <input name="idPhoto" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required />
      </label>
      <p class="help">Das Foto wird geschützt in Firebase Storage gespeichert, nicht öffentlich angezeigt und erst nach dem gespeicherten Admin-Entscheid aus dem Antrag entfernt.</p>
      <p id="verificationPhotoHint" class="help">Grosse Fotos werden automatisch verkleinert und als JPG gespeichert.</p>
      <p id="verificationError" class="form-error" role="alert"></p>
      <button class="primary-button" type="submit">Verifizierung beantragen</button>
    </form>
  `, (modal, close) => {
    modal.querySelector('#verificationForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = event.currentTarget.querySelector('button[type="submit"]');
      const errorNode = modal.querySelector('#verificationError');
      const hintNode = modal.querySelector('#verificationPhotoHint');
      const previousStatus = state.profile.verificationStatus;
      const previousUserStatus = authState.user?.verificationStatus || previousStatus;
      submit.disabled = true;
      if (errorNode) errorNode.textContent = '';
      const data = Object.fromEntries(new FormData(form));
      try {
        const requestId = uid('verreq');
        if (hintNode) hintNode.textContent = 'Foto wird vorbereitet und automatisch verkleinert ...';
        const preparedPhoto = await prepareVerificationPhoto(form.elements.idPhoto?.files?.[0]);
        if (hintNode) hintNode.textContent = `Foto optimiert: ${formatFileSize(preparedPhoto.originalSize)} → ${formatFileSize(preparedPhoto.size)}. Antrag wird gesendet ...`;
        const idPhoto = await persistVerificationPhoto(requestId, preparedPhoto);
        state.profile.verificationStatus = 'pending';
        syncCurrentUser({ verificationStatus: 'pending' });
        const payload = {
          id: requestId,
          uid: authState.user.uid,
          email: authState.user.email,
          displayName: profileName(),
          registeredName: state.profile.name,
          accountType: state.profile.accountType || 'resident',
          companyName: companyNameForProfile(),
          proofType: state.profile.accountType === 'company' ? 'company_responsible_person' : 'personal_id',
          method: data.method,
          note: data.note,
          idPhoto,
          status: 'offen',
          createdAt: nowIso()
        };
        if (isFirebaseMode()) {
          await setFirebaseDoc(FIRESTORE_COLLECTIONS.verificationRequests, payload.id, payload, false);
          await syncStateFromFirestore().catch(error => reportBackgroundError('Nach Verifizierungsantrag synchronisieren', error));
        } else {
          state.verificationRequests.unshift(payload);
          saveState();
        }
        close();
        render();
        toast('Verifizierungsantrag gesendet.');
      } catch (error) {
        state.profile.verificationStatus = previousStatus || 'none';
        syncCurrentUser({ verificationStatus: previousUserStatus || 'none' });
        const message = actionErrorMessage(error, 'Verifizierungsantrag konnte nicht gesendet werden.');
        if (errorNode) errorNode.textContent = message;
        toast(message);
      } finally {
        submit.disabled = false;
      }
    });
  });
}

function editVerificationRequestModal(id) {
  const req = state.verificationRequests.find(item => item.id === id);
  if (!req) return;
  openModal('Verifizierungsantrag anpassen', `
    <form id="editVerificationForm" class="form-grid">
      <label>Verifizierungsmethode
        <select name="method">
          <option ${req.method === 'Gemeinderegister / Einwohnerkontrolle' ? 'selected' : ''}>Gemeinderegister / Einwohnerkontrolle</option>
          <option ${req.method === 'Persönliche Prüfung durch Administration' ? 'selected' : ''}>Persönliche Prüfung durch Administration</option>
          <option ${req.method === 'Bestätigung durch Quartierverein' ? 'selected' : ''}>Bestätigung durch Quartierverein</option>
        </select>
      </label>
      <label>Notiz
        <textarea name="note" maxlength="260">${escapeHtml(req.note || '')}</textarea>
      </label>
      <button class="primary-button" type="submit">Änderung speichern</button>
    </form>
  `, (modal, close) => {
    modal.querySelector('#editVerificationForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = event.currentTarget.querySelector('button[type="submit"]');
      submit.disabled = true;
      const data = Object.fromEntries(new FormData(event.currentTarget));
      req.method = String(data.method || req.method);
      req.note = String(data.note || '');
      try {
        if (isFirebaseMode()) {
          await setFirebaseDoc(FIRESTORE_COLLECTIONS.verificationRequests, req.id, {
            method: req.method,
            note: req.note,
            updatedAt: nowIso()
          }, true);
          await syncStateFromFirestore();
        } else {
          saveState();
        }
        close();
        render();
        toast('Verifizierungsantrag angepasst.');
      } finally {
        submit.disabled = false;
      }
    });
  });
}

function openHelpModal() {
  const canSubmit = Boolean(authState.user);
  openModal('Hilfe & Änderungsanfrage', `
    <section class="form-grid">
      <div class="card compact soft">
        <strong>So funktioniert Quartinaut</strong>
        <p>Quartinaut verbindet Nachbarschaftshilfe mit verifizierten Gemeinde-Infos. Am Schwarzen Brett findest du lokale Gesuche und Angebote; Antworten bleiben im privaten 1:1-Chat.</p>
        <button class="secondary-button small" type="button" data-action="reopen-onboarding" style="margin-top:10px;">${iconSvg('help')} Wegleitung anzeigen</button>
      </div>
      <div class="card compact soft">
        <strong>Änderungsanfrage</strong>
        <p>Teile Verbesserungen, Korrekturen oder neue Kategorien direkt mit der Administration. Du siehst den Status später im Profil.</p>
      </div>
      <div class="card compact soft">
        <strong>Rechtliches & Kontakt</strong>
        <div class="row-actions legal-shortcuts" style="margin-top:10px;">
          <button class="ghost-button small" type="button" data-help-legal="privacy">Datenschutz</button>
          <button class="ghost-button small" type="button" data-help-legal="terms">Nutzungsbedingungen</button>
          <button class="ghost-button small" type="button" data-help-legal="imprint">Impressum</button>
        </div>
      </div>
      ${canSubmit ? `
        <form id="changeRequestForm" class="form-grid">
          <label>Titel
            <input name="title" required maxlength="90" placeholder="z. B. Neue Kategorie für Seniorenhilfe" />
          </label>
          <label>Bereich
            <select name="scope">
              <option>App</option>
              <option>Schwarzes Brett</option>
              <option>Alarme</option>
              <option>Profil</option>
              <option>Moderation</option>
            </select>
          </label>
          <label>Beschreibung
            <textarea name="description" required maxlength="500" placeholder="Was soll geändert werden und warum?"></textarea>
          </label>
          <button class="primary-button" type="submit">Anfrage senden</button>
        </form>
      ` : '<p class="help">Bitte zuerst anmelden, um eine Änderungsanfrage zu senden.</p>'}
    </section>
  `, (modal, close) => {
    modal.querySelectorAll('[data-help-legal]').forEach((button) => {
      button.addEventListener('click', () => {
        const target = button.dataset.helpLegal || 'privacy';
        close();
        openLegalModal(target);
      });
    });
    modal.querySelector('[data-action="reopen-onboarding"]')?.addEventListener('click', () => {
      close();
      setTimeout(() => openOnboardingTour({ manual: true }), 0);
    });
    if (!canSubmit) return;
    modal.querySelector('#changeRequestForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = event.currentTarget.querySelector('button[type="submit"]');
      submit.disabled = true;
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const payload = {
        id: uid('chgreq'),
        uid: authState.user.uid,
        email: authState.user.email,
        displayName: profileName(),
        title: String(data.title || '').trim(),
        scope: String(data.scope || 'App'),
        description: String(data.description || '').trim(),
        status: 'offen',
        createdAt: nowIso()
      };
      try {
        if (isFirebaseMode()) {
          await setFirebaseDoc(FIRESTORE_COLLECTIONS.changeRequests, payload.id, payload, false);
          await syncStateFromFirestore();
        } else {
          state.changeRequests.unshift(payload);
          saveState();
        }
        close();
        render();
        toast('Änderungsanfrage gesendet.');
      } finally {
        submit.disabled = false;
      }
    });
  });
}

function onboardingWasSeen() {
  const profileState = normalizeOnboardingState(state.onboarding);
  if (profileState.version >= ONBOARDING_VERSION && (profileState.completed || profileState.skipped)) return true;
  const localState = parseJsonStorage(ONBOARDING_SEEN_KEY, null);
  return Number(localState?.version || 0) >= ONBOARDING_VERSION
    && Boolean(localState?.completed || localState?.skipped);
}

async function persistOnboardingResult({ skipped = false } = {}) {
  const current = normalizeOnboardingState(state.onboarding);
  const onboarding = {
    version: ONBOARDING_VERSION,
    completed: !skipped,
    completedAt: nowIso(),
    skipped: Boolean(skipped),
    checklist: current.checklist
  };
  state.onboarding = onboarding;
  localStorage.setItem(ONBOARDING_SEEN_KEY, JSON.stringify(onboarding));
  syncCurrentUser({ onboarding });
  saveState();
  if (isFirebaseMode()) {
    await updateFirebaseProfile({ onboarding }).catch(error => {
      reportBackgroundError('Wegleitung speichern', error, {
        notify: false,
        collection: FIRESTORE_COLLECTIONS.users
      });
    });
  }
}

async function updateOnboardingChecklist(stepKey, value = true) {
  const onboarding = normalizeOnboardingState(state.onboarding);
  onboarding.checklist = { ...onboarding.checklist, [stepKey]: Boolean(value) };
  state.onboarding = onboarding;
  localStorage.setItem(ONBOARDING_SEEN_KEY, JSON.stringify(onboarding));
  syncCurrentUser({ onboarding });
  saveState();
  if (isFirebaseMode()) {
    await updateFirebaseProfile({ onboarding }).catch(error => reportBackgroundError('Wegleitungs-Checkliste speichern', error, {
      notify: false,
      collection: FIRESTORE_COLLECTIONS.users
    }));
  }
}

async function handleOnboardingChecklistAction(stepKey, stepAction) {
  if (stepAction === 'notifications') {
    await enableNotifications().catch(error => reportBackgroundError('Benachrichtigungen aktivieren', error, { notify: true }));
  } else if (stepAction === 'install') {
    await promptQuartinautInstall();
  } else if (stepAction === 'bulletin') {
    await updateOnboardingChecklist(stepKey, true);
    setRoute('bulletin');
    return;
  } else if (stepAction === 'verification') {
    await updateOnboardingChecklist(stepKey, true);
    setRoute('profile');
    if (!state.profile.verified && state.profile.verificationStatus !== 'pending') setTimeout(() => requestVerificationModal(), 0);
    return;
  }
  await updateOnboardingChecklist(stepKey, true);
  render();
  toast('Schritt gespeichert.');
}

function installGuidance() {
  if (isInstalledPwa()) {
    return {
      title: 'Quartinaut ist bereits installiert',
      text: 'Du nutzt Quartinaut schon wie eine App. Du findest sie auf deinem Startbildschirm oder im App-Menü.',
      steps: []
    };
  }
  const userAgent = String(navigator.userAgent || '');
  const isIOS = /iphone|ipad|ipod/i.test(userAgent);
  const isAndroid = /android/i.test(userAgent);
  if (isIOS) {
    return {
      title: 'Auf iPhone oder iPad installieren',
      text: 'Öffne Quartinaut möglichst in Safari.',
      steps: ['Unten auf „Teilen“ tippen.', '„Zum Home-Bildschirm“ wählen.', 'Mit „Hinzufügen“ bestätigen.']
    };
  }
  if (isAndroid) {
    return {
      title: 'Auf Android installieren',
      text: 'Chrome oder Edge zeigt die Installation im Browsermenü an.',
      steps: ['Browsermenü (⋮) öffnen.', '„App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen.', 'Installation bestätigen.']
    };
  }
  return {
    title: 'Auf dem Computer installieren',
    text: 'In Chrome oder Edge findest du die Installation rechts in der Adresszeile oder im Browsermenü.',
    steps: ['Installationssymbol in der Adresszeile anklicken.', 'Alternativ das Browsermenü öffnen und „Quartinaut installieren“ wählen.', 'Installation bestätigen.']
  };
}

async function promptQuartinautInstall() {
  if (isInstalledPwa()) {
    toast('Quartinaut ist bereits installiert.');
    return;
  }
  if (!deferredInstallPrompt) {
    toast('Nutze die angezeigten Schritte deines Browsers.');
    return;
  }
  await deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  if (choice?.outcome === 'accepted') {
    deferredInstallPrompt = null;
    toast('Quartinaut wird installiert.');
  }
}

function openOnboardingTour({ manual = false } = {}) {
  const install = installGuidance();
  const steps = [
    {
      icon: 'home',
      eyebrow: 'Willkommen',
      title: 'Quartinaut gehört zu deinem Wohnort',
      body: `<p>Deine registrierte Gemeinde bleibt mit deinem Konto verbunden. So bleiben Gesuche, Angebote und Informationen lokal und übersichtlich.</p>`
    },
    {
      icon: 'need',
      eyebrow: 'Startseite',
      title: 'Hilfe suchen oder anbieten',
      body: `
        <p>Mit den grossen Schaltflächen erstellst du ein Gesuch oder ein Angebot. Du bestimmst Kategorie, Reichweite und Ablaufzeit. Neue Beiträge werden zuerst freigegeben, bevor sie öffentlich erscheinen.</p>
        <div class="onboarding-example">
          <span class="badge need">Ich brauche Hilfe</span>
          <span class="badge offer">Ich biete Hilfe</span>
        </div>`
    },
    {
      icon: 'bulletin',
      eyebrow: 'Schwarzes Brett',
      title: 'Das digitale Schwarze Brett',
      body: `<p>„Schwarzes Brett“ bedeutet die lokale Übersicht aller aktiven Gesuche und Angebote. Öffnest du einen Eintrag, kannst du die Person privat anschreiben.</p>`
    },
    {
      icon: 'chat',
      eyebrow: 'Privat und direkt',
      title: 'Nachrichten bleiben im 1:1-Chat',
      body: `<p>Ein Chat gehört immer zu einem konkreten Eintrag. Nur du und die andere Person können die Unterhaltung lesen. Unter „Chats“ findest du sie jederzeit wieder.</p>`
    },
    {
      icon: 'download',
      eyebrow: 'Installation',
      title: install.title,
      body: `
        <p>${escapeHtml(install.text)}</p>
        ${install.steps.length ? `<ol class="onboarding-steps">${install.steps.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ol>` : ''}
        ${!isInstalledPwa() ? `<button class="secondary-button" type="button" data-onboarding-install>${iconSvg('download')} Installation starten</button>` : '<span class="badge offer">Installiert</span>'}`
    },
    {
      icon: 'bell',
      eyebrow: 'Benachrichtigungen',
      title: 'Nur wichtige Hinweise erlauben',
      body: `
        <p>Benachrichtigungen informieren dich über private Nachrichten, passende Gesuche und lokale Alarme. Quartinaut fragt erst nach deiner Zustimmung.</p>
        <div class="onboarding-notification-state">
          <span class="badge ${notificationPermissionState() === 'granted' ? 'offer' : 'info'}">Status: ${escapeHtml(notificationPermissionState() === 'granted' ? 'aktiv' : notificationPermissionState() === 'denied' ? 'blockiert' : 'noch nicht entschieden')}</span>
        </div>
        <button class="secondary-button" type="button" data-onboarding-notifications>${iconSvg('bell')} ${notificationPermissionState() === 'granted' ? 'Benachrichtigungen sind aktiv' : 'Benachrichtigungen erlauben'}</button>`
    }
  ];
  let stepIndex = 0;
  let resultSaved = false;

  openModal('Wegleitung', '<section class="onboarding-tour" data-onboarding-host></section>', (modal, close) => {
    const host = modal.querySelector('[data-onboarding-host]');
    modal.classList.add('onboarding-modal');

    const finish = async (options = {}) => {
      if (!manual && !resultSaved) {
        resultSaved = true;
        await persistOnboardingResult(options);
      }
      close();
      if (options.route) setRoute(options.route);
    };

    const renderStep = () => {
      const step = steps[stepIndex];
      const isLast = stepIndex === steps.length - 1;
      host.innerHTML = `
        <div class="onboarding-progress" aria-label="Schritt ${stepIndex + 1} von ${steps.length}">
          <span>Schritt ${stepIndex + 1} von ${steps.length}</span>
          <div>${steps.map((_, index) => `<i class="${index <= stepIndex ? 'active' : ''}"></i>`).join('')}</div>
        </div>
        <article class="onboarding-content">
          <div class="onboarding-icon">${iconSvg(step.icon)}</div>
          <span class="eyebrow onboarding-eyebrow">${escapeHtml(step.eyebrow)}</span>
          <h3>${escapeHtml(step.title)}</h3>
          <div class="onboarding-copy">${step.body}</div>
        </article>
        <div class="onboarding-actions">
          <button class="ghost-button" type="button" data-onboarding-skip>${manual ? 'Schliessen' : 'Überspringen'}</button>
          <div class="onboarding-actions-main">
            <button class="ghost-button" type="button" data-onboarding-back ${stepIndex === 0 ? 'disabled' : ''}>Zurück</button>
            <button class="primary-button" type="button" data-onboarding-next>${isLast ? 'Wegleitung abschliessen' : 'Weiter'}</button>
          </div>
        </div>
      `;
      applyI18n(host);
      host.querySelector('[data-onboarding-back]')?.addEventListener('click', () => {
        stepIndex = Math.max(0, stepIndex - 1);
        renderStep();
      });
      host.querySelector('[data-onboarding-next]')?.addEventListener('click', () => {
        if (isLast) {
          void finish({ skipped: false, route: 'home' });
          return;
        }
        stepIndex += 1;
        renderStep();
      });
      host.querySelector('[data-onboarding-skip]')?.addEventListener('click', () => {
        void finish({ skipped: !manual });
      });
      host.querySelector('[data-onboarding-install]')?.addEventListener('click', () => {
        runAsyncAction(promptQuartinautInstall);
      });
      host.querySelector('[data-onboarding-notifications]')?.addEventListener('click', () => {
        runAsyncAction(async () => {
          await enableNotifications();
          renderStep();
        });
      });
    };

    modal.addEventListener('modal:close', () => {
      onboardingTourScheduled = false;
      if (!manual && !resultSaved) {
        resultSaved = true;
        void persistOnboardingResult({ skipped: true });
      }
    });
    renderStep();
  });
}

function maybeShowOnboardingTour() {
  if (!authState.user || onboardingTourScheduled || onboardingWasSeen() || isAccountPendingApproval()) return;
  onboardingTourScheduled = true;
  setTimeout(() => {
    if (!authState.user || document.querySelector('.modal-backdrop')) {
      onboardingTourScheduled = false;
      return;
    }
    openOnboardingTour();
  }, 450);
}

function newRequestModal(presetType) {
  const title = presetType === 'Biete' ? 'Hilfe anbieten' : presetType === 'Suche' ? 'Hilfe suchen' : 'Anliegen erfassen';
  const isCompanyAccount = state.profile.accountType === 'company';
  const defaultCategory = isCompanyAccount ? 'Firmen / Arbeit' : orderedCategories()[0];
  openModal(title, `
    <form id="requestForm" class="form-grid">
      <div class="form-grid two">
        <label>Typ
          <select name="type"><option ${presetType === 'Suche' ? 'selected' : ''}>Suche</option><option ${presetType === 'Biete' ? 'selected' : ''}>Biete</option></select>
        </label>
        <label>Kategorie
          <select name="category">${orderedCategories().map(cat => `<option ${cat === defaultCategory ? 'selected' : ''}>${cat}</option>`).join('')}</select>
        </label>
      </div>
      ${isCompanyAccount ? `
        <p class="help">Firmenkonto aktiv: Einträge werden als Firma gekennzeichnet. Nutze „Firmen / Arbeit“ für Mitarbeitende, Lehrstellen, lokale Dienste oder kurzfristige Arbeit.</p>
        <label>Firmen-Eintragstyp
          <select name="companyPostType">
            <option value="arbeit">Mitarbeitende gesucht</option>
            <option value="lehrstelle">Lehrstelle / Ausbildung</option>
            <option value="dienstleistung">Lokale Dienstleistung</option>
            <option value="kurzfristig">Kurzfristige Aushilfe</option>
          </select>
        </label>
      ` : ''}
      <label>Titel
        <input name="title" required maxlength="80" placeholder="Kurzer Titel" />
      </label>
      <label>Beschreibung
        <textarea name="text" required maxlength="380" placeholder="Kurz, konkret, ohne private Details."></textarea>
      </label>
      ${postPhotoField()}
      <div class="form-grid two">
        <div class="readonly-field"><strong>Gemeinde / Ort</strong><span>${escapeHtml(locationLabel())}</span></div>
        <label>Dringlichkeit
          <select name="urgency"><option>Heute</option><option>Morgen</option><option>Diese Woche</option><option>Nicht dringend</option></select>
        </label>
      </div>
      <div class="form-grid two">
        <label>Reichweite (km)
          <input name="radiusKm" type="number" min="1" max="120" step="1" value="${DEFAULT_REQUEST_RADIUS_KM}" />
        </label>
        <label>Eskalationsstufe
          <select name="escalationLevel">
            <option value="keine">Keine</option>
            <option value="P2">P2 · Beobachtung</option>
            <option value="P1">P1 · Wichtig</option>
            <option value="P0">P0 · Notfall</option>
          </select>
        </label>
      </div>
      <div class="form-grid two">
        <label>Wiederholung
          <select name="recurringMode">
            <option value="einmalig">Einmalig</option>
            <option value="woechentlich">Wöchentlich</option>
          </select>
        </label>
        <label class="check-row" style="grid-template-columns:auto 1fr;">
          <input type="checkbox" name="shareApproxLocation" ${state.profile.geoOptIn !== false ? 'checked' : ''} />
          <span><strong>Distanz-Freigabe aktivieren</strong><small>Speichert eine ungefähre Position für km-Filter und Reichweite.</small></span>
        </label>
      </div>
      <label class="check-row" id="anonymousOfferRow" hidden style="grid-template-columns:auto 1fr;">
        <input type="checkbox" name="anonymousOffer" />
        <span><strong>Anonym veröffentlichen</strong><small>Bei „Ich biete Hilfe“ wird dein Kürzel am Schwarzen Brett verborgen.</small></span>
      </label>
      <div id="requestQualityHints" class="card compact soft request-quality" aria-live="polite">
        <strong>Beitragsqualität</strong>
        <p class="help">Schreibe konkret, ohne Telefonnummer oder E-Mail. Antworten laufen geschützt im privaten 1:1-Chat.</p>
      </div>
      <p class="help">Neue Beiträge werden vor der Veröffentlichung kurz geprüft. So bleibt das Schwarze Brett vertrauenswürdig.</p>
      <button class="primary-button" type="submit">${isAdminRole() ? 'Direkt veröffentlichen' : 'Zur Freigabe einreichen'}</button>
    </form>
  `, (modal, close) => {
    const requestForm = modal.querySelector('#requestForm');
    mountRequestWizard(requestForm);
    const requestPhotos=mountPostPhotoPicker(requestForm,'new-request');
    const typeSelect = requestForm.querySelector('select[name="type"]');
    const anonymousOfferRow = requestForm.querySelector('#anonymousOfferRow');
    const anonymousOfferInput = requestForm.querySelector('input[name="anonymousOffer"]');
    const qualityNode = modal.querySelector('#requestQualityHints');

    function syncAnonymousToggle() {
      const isOffer = typeSelect.value === 'Biete';
      anonymousOfferRow.hidden = !isOffer;
      if (!isOffer) anonymousOfferInput.checked = false;
    }

    syncAnonymousToggle();
    typeSelect.addEventListener('change', syncAnonymousToggle);
    const syncQualityHints = () => {
      if (!qualityNode) return;
      const messages = requestQualityMessages(requestForm);
      qualityNode.innerHTML = `
        <strong>Beitragsqualität</strong>
        ${messages.length
          ? `<ul class="quality-list">${messages.map(message => `<li>${escapeHtml(message)}</li>`).join('')}</ul>`
          : '<p class="help">Sieht gut aus. Keine öffentlichen Kontaktdaten, genug Kontext und klare Dringlichkeit.</p>'}
      `;
    };
    requestForm.querySelectorAll('input, textarea, select').forEach(input => input.addEventListener('input', syncQualityHints));
    requestForm.querySelectorAll('select').forEach(input => input.addEventListener('change', syncQualityHints));
    syncQualityHints();

    requestForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = event.currentTarget.querySelector('button[type="submit"]');
      submit.disabled = true;
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const photoModel=await requestPhotos;await photoModel.ready;
      const type = String(data.type || 'Suche');
      const shareApproxLocation = Boolean(data.shareApproxLocation);
      const requestGeo = shareApproxLocation
        ? await ensureViewerGeo({ force: true, silent: true })
        : null;
      const radiusRaw = Number(data.radiusKm);
      const radiusKm = Number.isFinite(radiusRaw) ? Math.min(120, Math.max(1, Math.round(radiusRaw))) : DEFAULT_REQUEST_RADIUS_KM;
      const anonymousOffer = type === 'Biete' && Boolean(data.anonymousOffer);
      const requestArea = locationLabel();
      const publicationStatus = isAdminRole() ? 'offen' : 'wartet_freigabe';
      const ownerUid=authState.user?.uid, ownerEpoch=accountEpoch;
      requestForm.dataset.v47OpId ||= uid('req');
      requestForm.dataset.v47CreatedAt ||= nowIso();
      saveFormDraft(requestForm,draftKey(requestForm));
      const createdAt = requestForm.dataset.v47CreatedAt;
      const payload = {
        id: requestForm.dataset.v47OpId,
        tenantId: 'quartinaut',
        uid: authState.user.uid,
        authorId: authState.user.uid,
        type,
        category: String(data.category || 'Alltagshilfe'),
        title: String(data.title || '').trim(),
        text: String(data.text || '').trim(),
        urgency: String(data.urgency || 'Heute'),
        area: requestArea,
        areaKey: normalizeAreaKey(requestArea),
        cantonCode: currentCantonCode(),
        author: anonymousOffer ? 'Anonym' : (state.profile.initials || 'ICH'),
        authorName: profileName(),
        authorRole: authState.user.role || state.profile.role || 'resident',
        authorVerified: Boolean(state.profile.verified),
        authorVerificationStatus: state.profile.verificationStatus || 'none',
        authorVerificationLabel: state.profile.verificationLabel || '',
        authorAccountType: state.profile.accountType || 'resident',
        companyName: state.profile.accountType === 'company' ? companyNameForProfile() : '',
        companyStatus: state.profile.companyStatus || '',
        companyPostType: state.profile.accountType === 'company' ? String(data.companyPostType || 'arbeit') : '',
        municipalityName: state.profile.accountType === 'municipality' ? (state.profile.municipalityName || state.profile.area || '') : '',
        municipalityStatus: state.profile.municipalityStatus || '',
        anonymousOffer,
        radiusKm,
        geo: requestGeo,
        status: publicationStatus,
        submittedAt: createdAt,
        approvedAt: publicationStatus === 'offen' ? createdAt : '',
        approvedBy: publicationStatus === 'offen' ? profileName() : '',
        rejectedAt: '',
        rejectedBy: '',
        rejectionReason: '',
        resubmittedAt: '',
        reports: 0,
        escalationLevel: String(data.escalationLevel || 'keine'),
        recurringMode: String(data.recurringMode || 'einmalig'),
        createdAt,
        expiresAt: expiryForUrgency(data.urgency)
      };
      try {
        state.profile.geoOptIn = shareApproxLocation;
        if(photoModel.selected.length)payload.photoPaths=await uploadPostPhotos('requests',payload.id,photoModel.selected);
        if(!currentAccountEpoch(ownerUid,ownerEpoch))throw new Error('Konto gewechselt; der Entwurf bleibt erhalten.');
        if (isFirebaseMode()) {
          await setFirebaseDoc(FIRESTORE_COLLECTIONS.requests, payload.id, payload, false);
          if(!currentAccountEpoch(ownerUid,ownerEpoch))return;
          await syncStateFromFirestore();
          if(!currentAccountEpoch(ownerUid,ownerEpoch))return;
        } else {
          state.requests.unshift(payload);
          saveState();
        }
        addChange(`Neues Anliegen erstellt: ${data.title}`);
        requestForm.dataset.photoSaved='yes';
        close(true);
        setRoute(publicationStatus === 'offen' ? 'bulletin' : 'home');
        toast(publicationStatus === 'offen' ? 'Anliegen veröffentlicht.' : 'Anliegen zur Freigabe eingereicht.');
      } catch(error) {
        const message=actionErrorMessage(error,'Beitrag konnte nicht mit Fotos gespeichert werden.');
        postPhotoStatus(requestForm,message,true);
        toast(message);
      } finally {
        submit.disabled = false;
      }
    });
  });
}

function editRequestModal(id) {
  const req = state.requests.find(item => item.id === id);
  if (!req) return;
  const canEdit = isAdminRole() || requestOwnerUid(req) === authState.user?.uid;
  if (!canEdit) throw new Error('Du kannst nur eigene Inserate bearbeiten.');
  const isCompanyRequest = req.authorAccountType === 'company';
  openModal('Inserat bearbeiten', `
    <form id="editRequestForm" class="form-grid">
      <div class="form-grid two">
        <label>Typ
          <select name="type">
            <option ${req.type === 'Suche' ? 'selected' : ''}>Suche</option>
            <option ${req.type === 'Biete' ? 'selected' : ''}>Biete</option>
          </select>
        </label>
        <label>Kategorie
          <select name="category">${orderedCategories().map(cat => `<option ${cat === req.category ? 'selected' : ''}>${escapeHtml(cat)}</option>`).join('')}</select>
        </label>
      </div>
      ${isCompanyRequest ? `
        <label>Firmen-Eintragstyp
          <select name="companyPostType">
            <option value="arbeit" ${req.companyPostType === 'arbeit' ? 'selected' : ''}>Mitarbeitende gesucht</option>
            <option value="lehrstelle" ${req.companyPostType === 'lehrstelle' ? 'selected' : ''}>Lehrstelle / Ausbildung</option>
            <option value="dienstleistung" ${req.companyPostType === 'dienstleistung' ? 'selected' : ''}>Lokale Dienstleistung</option>
            <option value="kurzfristig" ${req.companyPostType === 'kurzfristig' ? 'selected' : ''}>Kurzfristige Aushilfe</option>
          </select>
        </label>
      ` : ''}
      <label>Titel
        <input name="title" required maxlength="80" value="${escapeHtml(req.title)}" />
      </label>
      <label>Beschreibung
        <textarea name="text" required maxlength="380">${escapeHtml(req.text)}</textarea>
      </label>
      ${postPhotoField()}
      <div class="form-grid two">
        <div class="readonly-field"><strong>Gemeinde / Ort</strong><span>${escapeHtml(req.area || locationLabel())}</span></div>
        <label>Dringlichkeit
          <select name="urgency">
            ${['Heute', 'Morgen', 'Diese Woche', 'Nicht dringend'].map(value => `<option ${value === req.urgency ? 'selected' : ''}>${value}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="form-grid two">
        <label>Reichweite (km)
          <input name="radiusKm" type="number" min="1" max="120" step="1" value="${escapeHtml(requestRadiusKm(req) || DEFAULT_REQUEST_RADIUS_KM)}" />
        </label>
        <label>Eskalationsstufe
          <select name="escalationLevel">
            <option value="keine" ${req.escalationLevel === 'keine' ? 'selected' : ''}>Keine</option>
            <option value="P2" ${req.escalationLevel === 'P2' ? 'selected' : ''}>P2 · Beobachtung</option>
            <option value="P1" ${req.escalationLevel === 'P1' ? 'selected' : ''}>P1 · Wichtig</option>
            <option value="P0" ${req.escalationLevel === 'P0' ? 'selected' : ''}>P0 · Notfall</option>
          </select>
        </label>
      </div>
      <div class="form-grid two">
        <label>Wiederholung
          <select name="recurringMode">
            <option value="einmalig" ${req.recurringMode !== 'woechentlich' ? 'selected' : ''}>Einmalig</option>
            <option value="woechentlich" ${req.recurringMode === 'woechentlich' ? 'selected' : ''}>Wöchentlich</option>
          </select>
        </label>
        <label class="check-row" id="editAnonymousOfferRow" style="grid-template-columns:auto 1fr;">
          <input type="checkbox" name="anonymousOffer" ${req.anonymousOffer ? 'checked' : ''} />
          <span><strong>Anonym veröffentlichen</strong><small>Nur für „Ich biete Hilfe“.</small></span>
        </label>
      </div>
      <p class="help">Standort und Ersteller bleiben fix. Änderungen sind nur am Inhalt, Status und Ablauf des Inserats möglich.</p>
      ${!isAdminRole() ? '<p class="help">Nach dem Speichern wird der Beitrag erneut geprüft, bevor er öffentlich sichtbar ist.</p>' : ''}
      <p id="editRequestError" class="form-error" role="alert"></p>
      <button class="primary-button" type="submit">Änderungen speichern</button>
    </form>
  `, (modal, close) => {
    const form = modal.querySelector('#editRequestForm');
    const editPhotos=mountPostPhotoPicker(form,req.id,req.photoPaths);
    const typeSelect = form.querySelector('select[name="type"]');
    const anonymousRow = form.querySelector('#editAnonymousOfferRow');
    const anonymousInput = form.querySelector('input[name="anonymousOffer"]');
    const syncAnonymous = () => {
      const isOffer = typeSelect.value === 'Biete';
      anonymousRow.hidden = !isOffer;
      if (!isOffer) anonymousInput.checked = false;
    };
    syncAnonymous();
    typeSelect.addEventListener('change', syncAnonymous);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      const errorNode = modal.querySelector('#editRequestError');
      submit.disabled = true;
      if (errorNode) errorNode.textContent = '';
      try {
        const data = Object.fromEntries(new FormData(form));
        const radiusRaw = Number(data.radiusKm);
        const radiusKm = Number.isFinite(radiusRaw) ? Math.min(120, Math.max(1, Math.round(radiusRaw))) : DEFAULT_REQUEST_RADIUS_KM;
        const type = String(data.type || req.type || 'Suche');
        const nextStatus = isAdminRole() ? (req.status || 'offen') : 'wartet_freigabe';
        const updates = {
          type,
          category: String(data.category || req.category || 'Alltagshilfe'),
          title: String(data.title || '').trim(),
          text: String(data.text || '').trim(),
          urgency: String(data.urgency || req.urgency || 'Heute'),
          radiusKm,
          escalationLevel: String(data.escalationLevel || 'keine'),
          recurringMode: String(data.recurringMode || 'einmalig'),
          anonymousOffer: type === 'Biete' && Boolean(data.anonymousOffer),
          author: type === 'Biete' && Boolean(data.anonymousOffer) ? 'Anonym' : (state.profile.initials || req.author || 'ICH'),
          status: nextStatus,
          resubmittedAt: !isAdminRole() ? nowIso() : (req.resubmittedAt || ''),
          rejectedAt: !isAdminRole() ? '' : (req.rejectedAt || ''),
          rejectedBy: !isAdminRole() ? '' : (req.rejectedBy || ''),
          rejectionReason: !isAdminRole() ? '' : (req.rejectionReason || ''),
          approvedAt: !isAdminRole() ? '' : (req.approvedAt || ''),
          approvedBy: !isAdminRole() ? '' : (req.approvedBy || ''),
          updatedAt: nowIso()
        };
        if (!updates.title || !updates.text) throw new Error('Titel und Beschreibung dürfen nicht leer sein.');
        const photoModel=await editPhotos;await photoModel.ready;
        const more=await uploadPostPhotos('requests',req.id+'-edit'+Date.now(),photoModel.selected);
        updates.photoPaths=[...photoModel.existing,...more];
        if (isCompanyRequest) updates.companyPostType = String(data.companyPostType || req.companyPostType || 'arbeit');
        const removedPhotoPaths=validPostPhotoPaths(req.photoPaths).filter(path=>!updates.photoPaths.includes(path));
        Object.assign(req, updates);
        if (isFirebaseMode()) {
          await setFirebaseDoc(FIRESTORE_COLLECTIONS.requests, req.id, updates, true);
          await syncStateFromFirestore();
          if(removedPhotoPaths.length)void removeOwnedPostPhotos(removedPhotoPaths);
        } else {
          saveState();
        }
        form.dataset.photoSaved='yes';
        close();
        render();
        toast(isAdminRole() ? 'Inserat aktualisiert.' : 'Inserat aktualisiert und erneut zur Freigabe eingereicht.');
      } catch (error) {
        const message = actionErrorMessage(error, 'Inserat konnte nicht gespeichert werden.');
        if (errorNode) errorNode.textContent = message;
        toast(message);
      } finally {
        submit.disabled = false;
      }
    });
  });
}

function safeDocPart(value = '') {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'x';
}

function requestOwnerUid(req = {}) {
  return req.uid || req.authorId || '';
}

function chatIdForRequest(req, peerUid) {
  const participants = [authState.user.uid, peerUid].sort();
  return `chat_${safeDocPart(req.id)}_${participants.map(safeDocPart).join('_')}`;
}

function peerLabelFromUid(uidValue) {
  if (uidValue === authState.user?.uid) return profileName();
  const user = state.registeredUsers.find(item => item.uid === uidValue);
  return user?.displayName || user?.companyName || user?.email || 'Nutzer/in';
}

function requestChats(reqId) {
  hydrateChatsFromMessages(state.chatMessages);
  return state.chats
    .filter(chat => chat.requestId === reqId && isChatVisibleForUser(chat))
    .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
}

function directChatForRequest(req = {}) {
  const ownerUid = requestOwnerUid(req);
  if (!ownerUid || !authState.user?.uid || ownerUid === authState.user.uid) return null;
  const chatId = chatIdForRequest(req, ownerUid);
  return state.chats.find(chat => chat.id === chatId) || null;
}

function chatMessagesFor(chatId) {
  return state.chatMessages
    .filter(msg => msg.chatId === chatId)
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
}

function chatReadAt(chat, uidValue = authState.user?.uid) {
  return normalizeStoredDate(chat?.readBy?.[uidValue]) || '';
}

function chatUserMap(chat, field) {
  return chat?.[field] && typeof chat[field] === 'object' && !Array.isArray(chat[field]) ? chat[field] : {};
}

function currentUserCanSeeChat(chat, uidValue = authState.user?.uid) {
  if (!chat || !uidValue) return false;
  return chat.participants?.includes(uidValue) || chat.requestOwnerUid === uidValue;
}

function chatTrashedAt(chat, uidValue = authState.user?.uid) {
  if (!uidValue) return '';
  return normalizeStoredDate(chatUserMap(chat, 'trashedBy')[uidValue]) || '';
}

function chatPurgedAt(chat, uidValue = authState.user?.uid) {
  if (!uidValue) return '';
  return normalizeStoredDate(chatUserMap(chat, 'purgedBy')[uidValue]) || '';
}

function isChatPurgedForUser(chat, uidValue = authState.user?.uid) {
  return Boolean(chatPurgedAt(chat, uidValue));
}

function isChatTrashedForUser(chat, uidValue = authState.user?.uid) {
  return Boolean(chatTrashedAt(chat, uidValue)) && !isChatPurgedForUser(chat, uidValue);
}

function isChatVisibleForUser(chat, uidValue = authState.user?.uid) {
  return currentUserCanSeeChat(chat, uidValue) && !isChatTrashedForUser(chat, uidValue) && !isChatPurgedForUser(chat, uidValue);
}

function isChatInTrashForUser(chat, uidValue = authState.user?.uid) {
  return currentUserCanSeeChat(chat, uidValue) && isChatTrashedForUser(chat, uidValue);
}

function chatTrashExpiresAt(chat, uidValue = authState.user?.uid) {
  const trashedAt = chatTrashedAt(chat, uidValue);
  if (!trashedAt) return '';
  const timestamp = new Date(trashedAt).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp + CHAT_TRASH_RETENTION_MS).toISOString() : '';
}

function chatTrashDaysLeft(chat, uidValue = authState.user?.uid) {
  const expiresAt = chatTrashExpiresAt(chat, uidValue);
  if (!expiresAt) return CHAT_TRASH_RETENTION_DAYS;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function chatTrashLabel(chat, uidValue = authState.user?.uid) {
  const days = chatTrashDaysLeft(chat, uidValue);
  if (days <= 0) return 'wird gelöscht';
  if (days === 1) return 'löscht morgen';
  return `löscht in ${days} Tg.`;
}

function chatHasUnread(chat, uidValue = authState.user?.uid) {
  if (!chat || !uidValue) return false;
  if (!isChatVisibleForUser(chat, uidValue)) return false;
  if (!chat.lastMessageAt || chat.lastSenderUid === uidValue) return false;
  const lastMessage = new Date(chat.lastMessageAt).getTime();
  const readAt = new Date(chatReadAt(chat, uidValue) || 0).getTime();
  return Number.isFinite(lastMessage) && lastMessage > (Number.isFinite(readAt) ? readAt : 0);
}

function unreadChatCount() {
  return state.chats.filter(chat => isChatVisibleForUser(chat) && chatHasUnread(chat)).length;
}

function upsertChatState(chat) {
  if (!chat?.id) return chat;
  const normalized = normalizeChatDoc(chat);
  state.chats = [
    normalized,
    ...state.chats.filter(item => item.id !== normalized.id)
  ].sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
  return normalized;
}

function upsertChatMessages(chatId, messages = []) {
  const incoming = messages
    .map(normalizeChatMessage)
    .filter(msg => msg.chatId === chatId && msg.id);
  const otherMessages = state.chatMessages.filter(msg => msg.chatId !== chatId);
  const chatMessages = new Map(
    state.chatMessages
      .filter(msg => msg.chatId === chatId && msg.id)
      .map(msg => [msg.id, msg])
  );
  incoming.forEach(msg => {
    chatMessages.set(msg.id, { ...(chatMessages.get(msg.id) || {}), ...msg });
  });
  state.chatMessages = [
    ...otherMessages,
    ...chatMessages.values()
  ].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  hydrateChatsFromMessages(incoming);
}

function upsertIncomingChatMessages(messages = []) {
  const grouped = new Map();
  messages
    .map(normalizeChatMessage)
    .filter(msg => msg.chatId && msg.id)
    .forEach(msg => {
      if (!grouped.has(msg.chatId)) grouped.set(msg.chatId, []);
      grouped.get(msg.chatId).push(msg);
    });
  grouped.forEach((items, chatId) => upsertChatMessages(chatId, items));
}

function chatFromMessage(msg = {}) {
  if (!msg.chatId) return null;
  const existing = state.chats.find(chat => chat.id === msg.chatId) || {};
  const req = requestById(msg.requestId) || {};
  const viewerOwnsRequest = msg.requestOwnerUid === authState.user?.uid;
  const rawParticipants = Array.isArray(msg.participants) ? msg.participants : [];
  let participants = normalizedChatParticipants({ participants: rawParticipants.length ? rawParticipants : existing.participants });
  if (viewerOwnsRequest && (participants.length !== 2 || !participants.includes(authState.user?.uid))) {
    participants = normalizedChatParticipants({ participants: [msg.senderUid, authState.user.uid] });
  }
  if (participants.length !== 2 || (!participants.includes(authState.user?.uid) && !viewerOwnsRequest)) return null;
  const participantLabels = {
    ...(existing.participantLabels || {}),
    ...(msg.participantLabels || {})
  };
  participants.forEach(uidValue => {
    if (!participantLabels[uidValue]) {
      participantLabels[uidValue] = uidValue === authState.user?.uid ? profileName() : peerLabelFromUid(uidValue);
    }
  });
  const existingTime = new Date(existing.lastMessageAt || existing.createdAt || 0).getTime();
  const messageTime = new Date(msg.createdAt || 0).getTime();
  const messageIsNewest = !Number.isFinite(existingTime) || Number.isFinite(messageTime) && messageTime >= existingTime;
  return normalizeChatDoc({
    ...existing,
    id: msg.chatId,
    requestId: existing.requestId || msg.requestId || req.id || '',
    requestTitle: existing.requestTitle || msg.requestTitle || req.title || 'Privater Chat',
    requestOwnerUid: existing.requestOwnerUid || msg.requestOwnerUid || requestOwnerUid(req) || '',
    participants,
    participantLabels,
    mutedBy: existing.mutedBy || [],
    readBy: existing.readBy || {},
    createdAt: existing.createdAt || msg.createdAt || nowIso(),
    lastMessageAt: messageIsNewest ? msg.createdAt : existing.lastMessageAt,
    lastMessagePreview: messageIsNewest ? (msg.text || existing.lastMessagePreview || '') : (existing.lastMessagePreview || ''),
    lastSenderUid: messageIsNewest ? (msg.senderUid || existing.lastSenderUid || '') : (existing.lastSenderUid || '')
  });
}

function hydrateChatsFromMessages(messages = []) {
  const latestByChat = new Map();
  messages
    .map(normalizeChatMessage)
    .filter(msg => msg.chatId && (msg.participants?.includes(authState.user?.uid) || msg.requestOwnerUid === authState.user?.uid))
    .forEach(msg => {
      const current = latestByChat.get(msg.chatId);
      if (!current || new Date(msg.createdAt || 0) > new Date(current.createdAt || 0)) {
        latestByChat.set(msg.chatId, msg);
      }
    });
  latestByChat.forEach(msg => {
    const chat = chatFromMessage(msg);
    if (chat) upsertChatState(chat);
  });
}

function isChatMuted(chat, uidValue = authState.user?.uid) {
  return Array.isArray(chat?.mutedBy) && chat.mutedBy.includes(uidValue);
}

function chatPeerUid(chat) {
  return (chat.participants || []).find(uidValue => uidValue !== authState.user?.uid) || '';
}

function normalizedChatParticipants(chat = {}) {
  return [...new Set((Array.isArray(chat.participants) ? chat.participants : []).filter(Boolean))].sort();
}

function chatPeerLabel(chat) {
  const peerUid = chatPeerUid(chat);
  return chat.participantLabels?.[peerUid] || peerLabelFromUid(peerUid);
}

function chatCreatePayload(chat, req = requestById(chat.requestId) || {}) {
  const normalizedParticipants = normalizedChatParticipants(chat);
  const participants = normalizedParticipants.length === 2
    ? normalizedParticipants
    : [authState.user?.uid, chatPeerUid(chat)].filter(Boolean).sort();
  return {
    id: chat.id,
    requestId: chat.requestId || req.id || '',
    requestTitle: chat.requestTitle || req.title || 'Direktvermittlung',
    requestOwnerUid: chat.requestOwnerUid || requestOwnerUid(req),
    participants,
    participantLabels: chat.participantLabels || {},
    mutedBy: Array.isArray(chat.mutedBy) ? chat.mutedBy : [],
    readBy: chat.readBy && typeof chat.readBy === 'object' ? chat.readBy : {},
    createdAt: chat.createdAt || nowIso(),
    lastMessageAt: chat.lastMessageAt || chat.createdAt || nowIso(),
    lastMessagePreview: chat.lastMessagePreview || '',
    lastSenderUid: chat.lastSenderUid || ''
  };
}

async function ensureChatDocument(chat) {
  if (!isFirebaseMode()) return chat;
  const { db, doc, getDoc } = firebaseStoreApi;
  const ref = doc(db, FIRESTORE_COLLECTIONS.chats, chat.id);
  try {
    const snapshot = await getDoc(ref);
    if (snapshot.exists()) {
      const normalized = normalizeChatDoc({ id: chat.id, ...snapshot.data() });
      const labels = { ...(normalized.participantLabels || {}) };
      let labelsChanged = false;
      for (const uidValue of normalized.participants) {
        if (!labels[uidValue]) {
          labels[uidValue] = uidValue === authState.user?.uid ? profileName() : peerLabelFromUid(uidValue);
          labelsChanged = true;
        }
      }
      normalized.participantLabels = labels;
      Object.assign(chat, normalized);
      upsertChatState(chat);
      if (labelsChanged) {
        await setFirebaseDoc(FIRESTORE_COLLECTIONS.chats, chat.id, { participantLabels: labels, updatedAt: nowIso() }, true).catch(error => reportBackgroundError('Chat-Teilnehmerlabels synchronisieren', error));
      }
      return chat;
    }
  } catch (error) {
    const raw = String(error?.code || error?.message || '');
    if (!raw.includes('permission-denied') && !raw.includes('Missing or insufficient permissions')) {
      throw error;
    }
    reportBackgroundError('Chat-Vorabprüfung überspringen', error);
  }

  const payload = { ...chatCreatePayload(chat), updatedAt: nowIso() };
  if (!payload.requestId || !payload.requestOwnerUid || payload.participants.length !== 2) {
    throw new Error('Chat konnte nicht vorbereitet werden. Bitte Anliegen neu öffnen.');
  }
  await setFirebaseDoc(FIRESTORE_COLLECTIONS.chats, chat.id, payload, true);
  Object.assign(chat, payload);
  upsertChatState(chat);
  saveState();
  return chat;
}

async function markChatThreadRead(chat) {
  if (!authState.user?.uid || !chat?.id) return;
  const readAt = nowIso();
  chat.readBy = { ...(chat.readBy || {}), [authState.user.uid]: readAt };
  const existing = state.chats.find(item => item.id === chat.id);
  if (existing) existing.readBy = { ...(existing.readBy || {}), [authState.user.uid]: readAt };
  saveState();
  updateNavBadges();
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.chats, chat.id, { readBy: { [authState.user.uid]: readAt }, updatedAt: readAt }, true).catch(error => reportBackgroundError('Chat-Lesestatus synchronisieren', error));
  }
}

async function toggleChatMute(chatId, options = {}) {
  const { rerender = true } = options;
  const chat = state.chats.find(item => item.id === chatId);
  if (!chat || !authState.user?.uid) return;
  const muted = isChatMuted(chat);
  const nextMutedBy = muted
    ? (chat.mutedBy || []).filter(uidValue => uidValue !== authState.user.uid)
    : [...new Set([...(chat.mutedBy || []), authState.user.uid])];
  chat.mutedBy = nextMutedBy;
  saveState();
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.chats, chat.id, { mutedBy: nextMutedBy, updatedAt: nowIso() }, true);
  }
  if (rerender) render();
  else updateNavBadges();
  toast(muted ? 'Chat-Benachrichtigungen aktiviert.' : 'Chat stumm geschaltet.');
}

function updateLocalChatUserVisibility(chatId, updates = {}, uidValue = authState.user?.uid) {
  const chat = state.chats.find(item => item.id === chatId);
  if (!chat || !uidValue) return null;
  chat.trashedBy = { ...(chat.trashedBy || {}) };
  chat.purgedBy = { ...(chat.purgedBy || {}) };
  if (Object.prototype.hasOwnProperty.call(updates, 'trashedAt')) {
    if (updates.trashedAt) chat.trashedBy[uidValue] = updates.trashedAt;
    else delete chat.trashedBy[uidValue];
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'purgedAt')) {
    if (updates.purgedAt) chat.purgedBy[uidValue] = updates.purgedAt;
    else delete chat.purgedBy[uidValue];
  }
  chat.updatedAt = nowIso();
  return chat;
}

async function updateFirebaseChatUserVisibility(chatId, updates = {}) {
  if (!isFirebaseMode() || !authState.user?.uid || !firebaseStoreApi) return;
  const { db, doc, updateDoc, deleteField } = firebaseStoreApi;
  const payload = { updatedAt: nowIso() };
  const uidValue = authState.user.uid;
  if (Object.prototype.hasOwnProperty.call(updates, 'trashedAt')) {
    payload[`trashedBy.${uidValue}`] = updates.trashedAt || deleteField();
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'purgedAt')) {
    payload[`purgedBy.${uidValue}`] = updates.purgedAt || deleteField();
  }
  await updateDoc(doc(db, FIRESTORE_COLLECTIONS.chats, chatId), payload);
}

function clearLocalChatTrashForParticipants(chat, participants = chat?.participants || []) {
  if (!chat) return;
  chat.trashedBy = { ...(chat.trashedBy || {}) };
  chat.purgedBy = { ...(chat.purgedBy || {}) };
  participants.filter(Boolean).forEach(uidValue => {
    delete chat.trashedBy[uidValue];
    delete chat.purgedBy[uidValue];
  });
}

async function clearFirebaseChatTrashForParticipants(chatId, participants = []) {
  if (!isFirebaseMode() || !firebaseStoreApi || !participants.length) return;
  const { db, doc, updateDoc, deleteField } = firebaseStoreApi;
  const payload = { updatedAt: nowIso() };
  participants.filter(Boolean).forEach(uidValue => {
    payload[`trashedBy.${uidValue}`] = deleteField();
    payload[`purgedBy.${uidValue}`] = deleteField();
  });
  await updateDoc(doc(db, FIRESTORE_COLLECTIONS.chats, chatId), payload);
}

async function moveChatToTrash(chatId, options = {}) {
  const { rerender = true } = options;
  if (!authState.user?.uid) return;
  const trashedAt = nowIso();
  const chat = updateLocalChatUserVisibility(chatId, { trashedAt, purgedAt: null });
  if (!chat) throw new Error('Chat nicht gefunden.');
  saveState();
  if (isFirebaseMode()) {
    await updateFirebaseChatUserVisibility(chatId, { trashedAt, purgedAt: null });
  }
  state.chatView = 'trash';
  saveState();
  if (rerender) render();
  toast('Chat in den Papierkorb verschoben.');
}

async function restoreChatFromTrash(chatId) {
  if (!authState.user?.uid) return;
  const chat = updateLocalChatUserVisibility(chatId, { trashedAt: null, purgedAt: null });
  if (!chat) throw new Error('Chat nicht gefunden.');
  saveState();
  if (isFirebaseMode()) {
    await updateFirebaseChatUserVisibility(chatId, { trashedAt: null, purgedAt: null });
  }
  state.chatView = 'active';
  saveState();
  render();
  toast('Chat wiederhergestellt.');
}

async function purgeChatForCurrentUser(chatId) {
  if (!authState.user?.uid) return;
  const purgedAt = nowIso();
  const chat = updateLocalChatUserVisibility(chatId, { trashedAt: null, purgedAt });
  if (!chat) throw new Error('Chat nicht gefunden.');
  saveState();
  if (isFirebaseMode()) {
    await updateFirebaseChatUserVisibility(chatId, { trashedAt: null, purgedAt });
  }
  render();
  toast('Chat endgültig aus deiner Ansicht entfernt.');
}

async function pruneExpiredChatTrash() {
  const uidValue = authState.user?.uid;
  if (!uidValue) return;
  const runKey = `${uidValue}:${new Date().toISOString().slice(0, 10)}`;
  if (chatTrashPruneKey === runKey) return;
  chatTrashPruneKey = runKey;
  const now = Date.now();
  const expiredChats = state.chats.filter(chat => {
    if (!isChatInTrashForUser(chat, uidValue)) return false;
    const expiresAt = chatTrashExpiresAt(chat, uidValue);
    return expiresAt && new Date(expiresAt).getTime() <= now;
  });
  if (!expiredChats.length) return;
  const purgedAt = nowIso();
  expiredChats.forEach(chat => updateLocalChatUserVisibility(chat.id, { trashedAt: null, purgedAt }, uidValue));
  saveState();
  if (isFirebaseMode()) {
    await Promise.all(expiredChats.map(chat => updateFirebaseChatUserVisibility(chat.id, { trashedAt: null, purgedAt }).catch(error => reportBackgroundError('Abgelaufenen Chat-Papierkorb bereinigen', error))));
  }
}

function upsertLocalChatMessage(message) {
  if (!message?.id || !message.chatId) return null;
  const normalized = normalizeChatMessage(message);
  state.chatMessages = [
    ...state.chatMessages.filter(msg => msg.id !== normalized.id),
    normalized
  ].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  return normalized;
}

function setLocalMessageDeliveryStatus(chatId, messageId, deliveryStatus) {
  const msg = state.chatMessages.find(item => item.id === messageId && item.chatId === chatId);
  if (!msg) return null;
  msg.deliveryStatus = deliveryStatus;
  return msg;
}

function refreshOpenChatThread(chat, options = {}) {
  const { scrollBottom = false } = options;
  const box = byId('chatThreadBox');
  if (!box || !chat?.id) return;
  box.innerHTML = renderChatMessages(chat);
  bindAppointmentActions(chat, box);
  bindChatRetryActions(chat, box);
  if (scrollBottom) box.scrollTop = box.scrollHeight;
}

function ownMessageStatusHtml(msg) {
  if (msg.readAt) return ` · gelesen ${escapeHtml(fmtTime(msg.readAt))}`;
  if (msg.deliveryStatus === 'pending') return ' · wird gesendet ...';
  if (msg.deliveryStatus === 'failed') {
    return ` · <button class="message-status-button" type="button" data-action="retry-chat-message" data-message-id="${escapeHtml(msg.id)}">fehlgeschlagen - erneut senden</button>`;
  }
  return ' · gesendet';
}

function renderChatMessages(chat, messages = chatMessagesFor(chat.id)) {
  if (!messages.length) {
    return '<div class="empty" style="min-height:120px;">Noch keine private Nachricht. Starte den Chat.</div>';
  }
  return messages
    .map((msg, index, list) => {
      const mine = msg.senderUid === authState.user?.uid;
      const label = mine ? 'Du' : (chat.participantLabels?.[msg.senderUid] || peerLabelFromUid(msg.senderUid));
      const readState = mine ? ownMessageStatusHtml(msg) : '';
      const previous = list[index - 1];
      const next = list[index + 1];
      const groupedBefore = previous?.senderUid === msg.senderUid && previous?.messageType === msg.messageType;
      const groupedAfter = next?.senderUid === msg.senderUid && next?.messageType === msg.messageType;
      const messageClass = [mine ? 'me' : '', groupedBefore ? 'grouped-before' : '', groupedAfter ? 'grouped-after' : ''].filter(Boolean).join(' ');
      if (msg.messageType === 'appointment') {
        return renderAppointmentMessage(chat, msg, mine, label, readState, messageClass);
      }
      return `<div class="message ${messageClass}"><span>${escapeHtml(msg.text)}</span><small>${escapeHtml(label)} · ${fmtTime(msg.createdAt)}${readState} · <button class="message-status-button" type="button" data-action="translate-dynamic" data-translate-kind="chat-message" data-translate-id="${escapeHtml(msg.id)}">übersetzen</button></small></div>`;
    })
    .join('');
}

function formatAppointmentDate(value = '') {
  if (!value) return 'Termin offen';
  try {
    return new Date(value).toLocaleString('de-CH', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(value);
  }
}

function appointmentStatusLabel(status = 'proposed') {
  if (status === 'accepted') return 'bestätigt';
  if (status === 'declined') return 'abgesagt';
  return 'vorgeschlagen';
}

function renderAppointmentMessage(chat, msg, mine, label, readState = '', messageClass = '') {
  const appointment = msg.appointment || {};
  const canDecide = !mine && appointment.status === 'proposed' && msg.recipientUid === authState.user?.uid;
  return `
    <div class="message appointment-message ${messageClass}">
      <strong>Termin ${escapeHtml(appointmentStatusLabel(appointment.status))}</strong>
      <span>${escapeHtml(formatAppointmentDate(appointment.startsAt))}</span>
      ${appointment.place ? `<span>Ort: ${escapeHtml(appointment.place)}</span>` : ''}
      ${appointment.note ? `<span>${escapeHtml(appointment.note)}</span>` : ''}
      <small>${escapeHtml(label)} · ${fmtTime(msg.createdAt)}${readState}</small>
      ${canDecide ? `
        <div class="row-actions appointment-actions">
          <button class="success-button small" data-action="appointment-decision" data-message-id="${escapeHtml(msg.id)}" data-status="accepted">Bestätigen</button>
          <button class="danger-button small" data-action="appointment-decision" data-message-id="${escapeHtml(msg.id)}" data-status="declined">Absagen</button>
        </div>
      ` : ''}
    </div>
  `;
}

async function getOrCreateDirectChat(req, peerUid) {
  if (!authState.user?.uid) throw new Error('Chat benötigt Anmeldung.');
  if (!peerUid) throw new Error('Kein Empfänger für diesen Chat gefunden.');
  if (peerUid === authState.user.uid) throw new Error('Eigene Anliegen zeigen Gespräche pro interessierter Person.');
  const chatId = chatIdForRequest(req, peerUid);
  const existing = state.chats.find(chat => chat.id === chatId);
  if (existing) {
    if (isChatTrashedForUser(existing) || isChatPurgedForUser(existing)) {
      updateLocalChatUserVisibility(existing.id, { trashedAt: null, purgedAt: null });
      saveState();
      if (isFirebaseMode()) await updateFirebaseChatUserVisibility(existing.id, { trashedAt: null, purgedAt: null });
    }
    return ensureChatDocument(existing);
  }
  const participants = [authState.user.uid, peerUid].sort();
  const participantLabels = {
    [authState.user.uid]: profileName(),
    [peerUid]: peerUid === requestOwnerUid(req) ? requestAuthorLabel(req) : peerLabelFromUid(peerUid)
  };
  const payload = {
    id: chatId,
    requestId: req.id,
    requestTitle: req.title,
    requestOwnerUid: requestOwnerUid(req),
    participants,
    participantLabels,
    mutedBy: [],
    readBy: { [authState.user.uid]: nowIso() },
    createdAt: nowIso(),
    lastMessageAt: nowIso(),
    lastMessagePreview: '',
    lastSenderUid: ''
  };
  if (isFirebaseMode()) {
    const ensured = await ensureChatDocument(payload);
    upsertChatState(ensured);
    saveState();
    return ensured;
  } else {
    upsertChatState(payload);
  }
  saveState();
  return payload;
}

async function persistOutgoingChatMessage(chat, message, options = {}) {
  const { failureText = 'Nachricht konnte nicht gespeichert werden.' } = options;
  const ownerUid=authState.user?.uid, ownerEpoch=accountEpoch;
  if(!currentAccountEpoch(ownerUid,ownerEpoch))throw new Error('Konto gewechselt; Nachricht nicht gesendet.');
  const sentMessage = { ...message, deliveryStatus: 'sent' };
  if (!isFirebaseMode()) {
    setLocalMessageDeliveryStatus(chat.id, message.id, 'sent');
    saveState();
    refreshOpenChatThread(chat, { scrollBottom: true });
    return sentMessage;
  }

  try {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.chatMessages, message.id, sentMessage, false);
    if(!currentAccountEpoch(ownerUid,ownerEpoch))return sentMessage;
  } catch (error) {
    if(!currentAccountEpoch(ownerUid,ownerEpoch))throw error;
    setLocalMessageDeliveryStatus(chat.id, message.id, 'failed');
    saveState();
    refreshOpenChatThread(chat, { scrollBottom: true });
    toast(failureText);
    throw error;
  }

  setLocalMessageDeliveryStatus(chat.id, message.id, 'sent');
  saveState();
  refreshOpenChatThread(chat, { scrollBottom: true });

  await setFirebaseDoc(FIRESTORE_COLLECTIONS.chats, chat.id, {
    lastMessageAt: chat.lastMessageAt,
    lastMessagePreview: chat.lastMessagePreview,
    lastSenderUid: chat.lastSenderUid,
    readBy: { [authState.user.uid]: message.createdAt },
    updatedAt: nowIso()
  }, true).catch(error => reportBackgroundError('Chat-Vorschau aktualisieren', error, { notify: true, fallback: 'Nachricht gesendet, Chat-Vorschau konnte aber nicht aktualisiert werden.' }));
  clearFirebaseChatTrashForParticipants(chat.id, chat.participants)
    .catch(error => reportBackgroundError('Chat-Papierkorbstatus zurücksetzen', error));

  return sentMessage;
}

async function retryChatMessage(chat, messageId) {
  const msg = state.chatMessages.find(item => item.id === messageId && item.chatId === chat.id);
  if (!msg) throw new Error('Nachricht nicht gefunden.');
  if (msg.senderUid !== authState.user?.uid) throw new Error('Nur eigene Nachrichten können erneut gesendet werden.');
  msg.deliveryStatus = 'pending';
  chat.lastMessageAt = msg.createdAt;
  chat.lastMessagePreview = String(msg.text || '').slice(0, 120);
  chat.lastSenderUid = authState.user.uid;
  chat.readBy = { ...(chat.readBy || {}), [authState.user.uid]: msg.createdAt };
  clearLocalChatTrashForParticipants(chat, chat.participants);
  upsertChatState(chat);
  saveState();
  refreshOpenChatThread(chat, { scrollBottom: true });
  await persistOutgoingChatMessage(chat, msg, { failureText: 'Nachricht konnte erneut nicht gesendet werden.' });
  updateNavBadges();
  toast('Nachricht erneut gesendet.');
}

async function sendChatMessage(chat, text, operationId = '') {
  const ownerUid=authState.user?.uid,ownerEpoch=accountEpoch;
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Bitte zuerst eine Nachricht eingeben.');
  const previous=operationId&&state.chatMessages.find(m=>m.id===operationId && m.chatId===chat.id);
  if(previous){await persistOutgoingChatMessage(chat,previous);return;}
  if (isFirebaseMode()) await ensureChatDocument(chat);
  if(!currentAccountEpoch(ownerUid,ownerEpoch))throw new Error('Konto gewechselt; Nachricht wird nicht gesendet.');
  chat.participants = normalizedChatParticipants(chat);
  const recipientUid = chatPeerUid(chat);
  if (!recipientUid || chat.participants.length !== 2) throw new Error('Chat konnte nicht eindeutig zugeordnet werden.');
  const message = {
    id: operationId || uid('msg'),
    chatId: chat.id,
    requestId: chat.requestId,
    requestTitle: chat.requestTitle || 'Privater Chat',
    requestOwnerUid: chat.requestOwnerUid || '',
    senderUid: ownerUid,
    recipientUid,
    participants: chat.participants.slice(),
    participantLabels: chat.participantLabels || {},
    text: trimmed,
    createdAt: nowIso(),
    readAt: '',
    deliveryStatus: 'pending'
  };
  chat.lastMessageAt = message.createdAt;
  chat.lastMessagePreview = trimmed.slice(0, 120);
  chat.lastSenderUid = authState.user.uid;
  chat.readBy = { ...(chat.readBy || {}), [authState.user.uid]: message.createdAt };
  clearLocalChatTrashForParticipants(chat, chat.participants);
  upsertChatState(chat);
  upsertLocalChatMessage(message);
  saveState();
  refreshOpenChatThread(chat, { scrollBottom: true });
  await persistOutgoingChatMessage(chat, message);
  updateNavBadges();
  addChange(`Private Nachricht gesendet: ${chat.requestTitle}`);
}

async function sendAppointmentProposal(chat, appointmentData = {}) {
  const startsAt = String(appointmentData.startsAt || '').trim();
  const place = String(appointmentData.place || '').trim();
  const note = String(appointmentData.note || '').trim();
  if (!startsAt) throw new Error('Bitte Datum und Uhrzeit auswählen.');
  if (new Date(startsAt).getTime() < Date.now() - 60000) throw new Error('Der Termin muss in der Zukunft liegen.');
  if (isFirebaseMode()) await ensureChatDocument(chat);
  chat.participants = normalizedChatParticipants(chat);
  const recipientUid = chatPeerUid(chat);
  if (!recipientUid || chat.participants.length !== 2) throw new Error('Chat konnte nicht eindeutig zugeordnet werden.');
  const text = `Termin vorgeschlagen: ${formatAppointmentDate(startsAt)}${place ? `, ${place}` : ''}`;
  const message = {
    id: uid('appt'),
    chatId: chat.id,
    requestId: chat.requestId,
    requestTitle: chat.requestTitle || 'Privater Chat',
    requestOwnerUid: chat.requestOwnerUid || '',
    senderUid: authState.user.uid,
    recipientUid,
    participants: chat.participants.slice(),
    participantLabels: chat.participantLabels || {},
    messageType: 'appointment',
    text,
    appointment: {
      startsAt,
      place,
      note,
      status: 'proposed',
      proposedByUid: authState.user.uid,
      createdAt: nowIso()
    },
    createdAt: nowIso(),
    readAt: '',
    deliveryStatus: 'pending'
  };
  chat.lastMessageAt = message.createdAt;
  chat.lastMessagePreview = text.slice(0, 120);
  chat.lastSenderUid = authState.user.uid;
  chat.readBy = { ...(chat.readBy || {}), [authState.user.uid]: message.createdAt };
  clearLocalChatTrashForParticipants(chat, chat.participants);
  upsertChatState(chat);
  upsertLocalChatMessage(message);
  saveState();
  refreshOpenChatThread(chat, { scrollBottom: true });
  await persistOutgoingChatMessage(chat, message, { failureText: 'Termin konnte nicht gesendet werden.' });
  updateNavBadges();
  addChange(`Termin vorgeschlagen: ${chat.requestTitle}`);
}

function appointmentProposalModal(chat) {
  openModal('Termin vorschlagen', `
    <form id="appointmentForm" class="form-grid">
      <div class="card compact soft">
        <strong>${escapeHtml(chat.requestTitle || 'Privater Chat')}</strong>
        <p>Der Termin wird nur im privaten 1:1-Chat vorgeschlagen.</p>
      </div>
      <label>Datum und Uhrzeit
        <input name="startsAt" type="datetime-local" required />
      </label>
      <label>Ort
        <input name="place" maxlength="100" placeholder="z. B. Eingang Gemeindehaus" />
      </label>
      <label>Notiz
        <textarea name="note" maxlength="260" placeholder="Kurze Zusatzinfo"></textarea>
      </label>
      <p id="appointmentError" class="form-error" role="alert"></p>
      <button class="primary-button" type="submit">Termin senden</button>
    </form>
  `, (modal, close) => {
    modal.querySelector('#appointmentForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('button[type="submit"]');
      const errorNode = modal.querySelector('#appointmentError');
      submit.disabled = true;
      if (errorNode) errorNode.textContent = '';
      try {
        await sendAppointmentProposal(chat, Object.fromEntries(new FormData(form)));
        close();
        toast('Termin vorgeschlagen.');
      } catch (error) {
        const message = actionErrorMessage(error, 'Termin konnte nicht gesendet werden.');
        if (errorNode) errorNode.textContent = message;
        toast(message);
      } finally {
        submit.disabled = false;
      }
    });
  });
}

async function decideAppointment(chat, messageId, status) {
  const msg = state.chatMessages.find(item => item.id === messageId && item.chatId === chat.id);
  if (!msg?.appointment) throw new Error('Termin nicht gefunden.');
  if (msg.recipientUid !== authState.user?.uid) throw new Error('Nur der Empfänger kann diesen Termin bestätigen oder absagen.');
  const nextStatus = status === 'accepted' ? 'accepted' : 'declined';
  const appointment = {
    ...msg.appointment,
    status: nextStatus,
    decidedAt: nowIso(),
    decidedByUid: authState.user.uid
  };
  msg.appointment = appointment;
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.chatMessages, msg.id, { appointment }, true)
      .catch(error => reportBackgroundError('Terminstatus synchronisieren', error, { notify: true, fallback: 'Terminstatus konnte nicht gespeichert werden.' }));
  } else {
    saveState();
  }
  await sendChatMessage(chat, nextStatus === 'accepted'
    ? `Termin bestätigt: ${formatAppointmentDate(appointment.startsAt)}`
    : `Termin abgesagt: ${formatAppointmentDate(appointment.startsAt)}`);
  toast(nextStatus === 'accepted' ? 'Termin bestätigt.' : 'Termin abgesagt.');
}

function bindAppointmentActions(chat, container) {
  container.querySelectorAll('[data-action="appointment-decision"]').forEach(button => {
    button.addEventListener('click', () => {
      button.disabled = true;
      runAsyncAction(() => decideAppointment(chat, button.dataset.messageId, button.dataset.status));
    });
  });
}

function bindChatRetryActions(chat, container) {
  container.querySelectorAll('[data-action="retry-chat-message"]').forEach(button => {
    button.addEventListener('click', () => {
      button.disabled = true;
      runAsyncAction(() => retryChatMessage(chat, button.dataset.messageId));
    });
  });
}

async function markChatMessagesRead(chat, messages = chatMessagesFor(chat.id)) {
  if (!authState.user?.uid) return;
  const unread = messages.filter(msg => msg.recipientUid === authState.user.uid && !msg.readAt && !readReceiptInFlight.has(msg.id));
  if (!unread.length) return;
  const readAt = nowIso();
  unread.forEach(msg => {
    msg.readAt = readAt;
    readReceiptInFlight.add(msg.id);
  });
  if (!isFirebaseMode()) {
    saveState();
    unread.forEach(msg => readReceiptInFlight.delete(msg.id));
    return;
  }
  await Promise.all(unread.slice(0, 20).map(msg =>
    setFirebaseDoc(FIRESTORE_COLLECTIONS.chatMessages, msg.id, { readAt }, true)
      .catch(error => reportBackgroundError('Chat-Nachricht lesen markieren', error))
  ));
  unread.forEach(msg => readReceiptInFlight.delete(msg.id));
}

function subscribeChatMessages(chat, chatThreadBox) {
  const expectedUid = authState.user?.uid, expectedEpoch = accountEpoch;
  if (!expectedUid || !chat.participants?.includes(expectedUid)) return;
  if (typeof activeChatUnsubscribe === 'function') activeChatUnsubscribe();
  activeChatUnsubscribe = null;
  activeChatPagination = null;
  if (!isFirebaseMode() || !firebaseStoreApi?.onSnapshot) {
    chatThreadBox.innerHTML = renderChatMessages(chat);
    bindAppointmentActions(chat, chatThreadBox);
    bindChatRetryActions(chat, chatThreadBox);
    return;
  }
  const { db, collection, query, orderBy, where, limit, startAfter, getDocs, onSnapshot } = firebaseStoreApi;
  let anySnapshotReceived = false;

  function renderThread({ scrollBottom = false } = {}) {
    if (!currentAccountEpoch(expectedUid, expectedEpoch) || !chatThreadBox.isConnected) return;
    const mergedMessages = chatMessagesFor(chat.id);
    const hasMore = activeChatPagination?.chatId === chat.id && activeChatPagination.hasMore;
    chatThreadBox.innerHTML = `
      ${hasMore ? '<button class="ghost-button small load-more-chat" data-action="load-more-chat">Ältere Nachrichten laden</button>' : ''}
      ${renderChatMessages(chat, mergedMessages)}
    `;
    bindAppointmentActions(chat, chatThreadBox);
    bindChatRetryActions(chat, chatThreadBox);
    chatThreadBox.querySelector('[data-action="load-more-chat"]')?.addEventListener('click', () => runAsyncAction(loadOlderMessages));
    if (scrollBottom) chatThreadBox.scrollTop = chatThreadBox.scrollHeight;
    void markChatMessagesRead(chat, mergedMessages);
  }

  function renderLiveMessages(snapshot) {
    if (!currentAccountEpoch(expectedUid, expectedEpoch) || !chatThreadBox.isConnected) return;
    anySnapshotReceived = true;
    activeChatPagination = {
      chatId: chat.id,
      oldestDoc: snapshot.docs[snapshot.docs.length - 1] || activeChatPagination?.oldestDoc || null,
      hasMore: snapshot.size >= 50
    };
    const messages = mapFirestoreDocs(snapshot)
      .map(normalizeChatMessage)
      .filter(msg => msg.chatId === chat.id && (msg.participants?.includes(authState.user?.uid) || msg.requestOwnerUid === authState.user?.uid));
    upsertChatMessages(chat.id, messages);
    renderThread({ scrollBottom: true });
  }

  function handleLiveError(error) {
    if (!currentAccountEpoch(expectedUid, expectedEpoch)) return;
    reportBackgroundError('Chat-Nachrichten live laden', error, { notify: false, fallback: 'Chat-Nachrichten konnten nicht live geladen werden.', collection: FIRESTORE_COLLECTIONS.chatMessages });
    if (!anySnapshotReceived && !chatMessagesFor(chat.id).length) {
      chatThreadBox.innerHTML = '<div class="empty" style="min-height:120px;">Private Nachrichten werden geladen. Falls nichts erscheint, bitte kurz erneut öffnen.</div>';
    }
  }

  async function loadOlderMessages() {
    if (!currentAccountEpoch(expectedUid, expectedEpoch)) return;
    if (!activeChatPagination?.oldestDoc || activeChatPagination.chatId !== chat.id) return;
    const olderQuery = query(
      collection(db, FIRESTORE_COLLECTIONS.chatMessages),
      where('chatId', '==', chat.id),
      orderBy('createdAt', 'desc'),
      startAfter(activeChatPagination.oldestDoc),
      limit(50)
    );
    const snapshot = await getDocs(olderQuery);
    if (!currentAccountEpoch(expectedUid, expectedEpoch) || !chatThreadBox.isConnected) return;
    const olderMessages = mapFirestoreDocs(snapshot)
      .map(normalizeChatMessage)
      .filter(msg => msg.chatId === chat.id && (msg.participants?.includes(authState.user?.uid) || msg.requestOwnerUid === authState.user?.uid));
    upsertChatMessages(chat.id, olderMessages);
    activeChatPagination = {
      chatId: chat.id,
      oldestDoc: snapshot.docs[snapshot.docs.length - 1] || activeChatPagination.oldestDoc,
      hasMore: snapshot.size >= 50
    };
    renderThread();
  }

  const messageQuery = query(
    collection(db, FIRESTORE_COLLECTIONS.chatMessages),
    where('chatId', '==', chat.id),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  const unsubscribe = onSnapshot(messageQuery, renderLiveMessages, handleLiveError);
  activeChatUnsubscribe = () => {
    if (typeof unsubscribe === 'function') unsubscribe();
    activeChatPagination = null;
  };
}

function reportChatModal(chat) {
  openModal('Privaten Chat melden', `
    <form id="chatReportForm" class="form-grid">
      <div class="card compact soft">
        <strong>${escapeHtml(chat.requestTitle || 'Privater Chat')}</strong>
        <p>Mit dem Melden gibst du Metadaten und deine Begründung an die Administration weiter. Der private Nachrichtenverlauf bleibt geschützt.</p>
      </div>
      <label>Grund
        <select name="reasonType">
          <option value="missbrauch">Missbrauch / Betrug</option>
          <option value="beleidigung">Beleidigung / Belästigung</option>
          <option value="sicherheit">Sicherheitsproblem</option>
          <option value="sonstiges">Sonstiges</option>
        </select>
      </label>
      <label>Begründung
        <textarea name="reason" required maxlength="420" placeholder="Kurz beschreiben, was geprüft werden soll"></textarea>
      </label>
      <p id="chatReportError" class="form-error" role="alert"></p>
      <button class="danger-button" type="submit">Chat melden</button>
    </form>
  `, (modal, close) => {
    modal.querySelector('#chatReportForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('button[type="submit"]');
      const errorNode = modal.querySelector('#chatReportError');
      const data = Object.fromEntries(new FormData(form));
      const reason = String(data.reason || '').trim();
      if (reason.length < 8) {
        const message = 'Bitte den Grund etwas genauer beschreiben.';
        if (errorNode) errorNode.textContent = message;
        toast(message);
        return;
      }
      submit.disabled = true;
      try {
        await reportChat(chat, String(data.reasonType || 'sonstiges'), reason);
        close();
        toast('Chat-Meldung an die Administration gesendet.');
      } catch (error) {
        const message = actionErrorMessage(error, 'Chat-Meldung konnte nicht gesendet werden.');
        if (errorNode) errorNode.textContent = message;
        toast(message);
      } finally {
        submit.disabled = false;
      }
    });
  });
}

async function reportChat(chat, reasonType, reason) {
  if (!authState.user?.uid) throw new Error('Bitte zuerst anmelden.');
  if (!chat.participants?.includes(authState.user.uid)) throw new Error('Du kannst nur eigene Chats melden.');
  const req = requestById(chat.requestId) || {};
  const payload = {
    id: uid('mod'),
    type: 'Privater Chat',
    requestId: chat.requestId || '',
    chatId: chat.id,
    title: `Privater Chat: ${chat.requestTitle || req.title || 'Direktvermittlung'}`,
    area: req.area || state.profile.area || '',
    risk: 'mittel',
    status: 'offen',
    detail: `Chat wurde von ${profileName()} gemeldet. Grund: ${reasonType}. Begründung: ${reason}`,
    reporterUid: authState.user.uid,
    reporterEmail: authState.user.email || '',
    reporterLabel: profileName(),
    reportedPeerUid: chatPeerUid(chat),
    lastMessageAt: chat.lastMessageAt || '',
    lastMessagePreview: chat.lastMessagePreview || '',
    createdAt: nowIso()
  };
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.moderation, payload.id, payload, false);
  } else {
    state.moderation.unshift(payload);
    saveState();
  }
  addChange(`Privater Chat gemeldet: ${chat.requestTitle || chat.id}`);
}

function chatModalForChat(chat) {
  void markChatThreadRead(chat);
  const muted = isChatMuted(chat);
  const hasMessages = chatMessagesFor(chat.id).length > 0 || Boolean(chat.lastMessagePreview);
  openModal(hasMessages ? 'Privater Direkt-Chat' : 'Privat anschreiben', `
    <section class="form-grid">
      <div class="card compact soft">
        <strong>${escapeHtml(chat.requestTitle || 'Anliegen')}</strong>
        <p>1:1 mit ${escapeHtml(chatPeerLabel(chat))}. Der Verlauf ist privat und wird live zugestellt.</p>
        <div class="badges" style="margin-top:8px;">
          <span class="badge">P2P</span>
          <span class="badge">privat</span>
          ${muted ? '<span class="badge">stumm</span>' : '<span class="badge info">Push aktiv</span>'}
        </div>
      </div>
      <div id="chatThreadBox" class="chat-thread">${renderChatMessages(chat)}</div>
      <form id="chatForm" class="form-grid">
        <label>Nachricht
          <textarea name="text" required maxlength="500" placeholder="${hasMessages ? 'Nachricht schreiben' : 'Kurze Nachricht zum Inserat schreiben'}"></textarea>
        </label>
        <p class="help">Workflow: Inserat öffnen, privat anschreiben, danach läuft alles hier im 1:1-Chat.</p>
        <p id="chatSendError" class="form-error" role="alert"></p>
        <div class="row-actions">
          <button class="primary-button" type="submit">Senden</button>
          <button class="secondary-button" type="button" data-action="propose-appointment">Termin</button>
          <button class="ghost-button" type="button" data-action="toggle-chat-mute" data-chat-id="${escapeHtml(chat.id)}">${iconSvg(muted ? 'bell' : 'bellOff')} ${muted ? 'Benachrichtigen' : 'Stumm'}</button>
          <button class="ghost-button" type="button" data-action="trash-current-chat">${iconSvg('trash')} Papierkorb</button>
          <button class="ghost-button" type="button" data-action="report-private-chat">Chat melden</button>
        </div>
      </form>
    </section>
  `, (modal, close) => {
    const chatForm = modal.querySelector('#chatForm');
    const chatThreadBox = modal.querySelector('#chatThreadBox');
    subscribeChatMessages(chat, chatThreadBox);
    modal.addEventListener('modal:close', () => {
      if (typeof activeChatUnsubscribe === 'function') activeChatUnsubscribe();
      activeChatUnsubscribe = null;
    });
    modal.querySelector('[data-action="report-private-chat"]')?.addEventListener('click', () => reportChatModal(chat));
    modal.querySelector('[data-action="propose-appointment"]')?.addEventListener('click', () => appointmentProposalModal(chat));
    modal.querySelector('[data-action="toggle-chat-mute"]')?.addEventListener('click', () => runAsyncAction(() => toggleChatMute(chat.id, { rerender: false })));
    modal.querySelector('[data-action="trash-current-chat"]')?.addEventListener('click', () => runAsyncAction(async () => {
      await moveChatToTrash(chat.id);
      close();
      setRoute('chats');
    }));
    chatForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = chatForm.querySelector('button[type="submit"]');
      const errorNode = modal.querySelector('#chatSendError');
      submit.disabled = true;
      if (errorNode) errorNode.textContent = '';
      try {
        const text = new FormData(chatForm).get('text');
        chatForm.dataset.v47MessageId ||= uid('msg');
        await sendChatMessage(chat, text, chatForm.dataset.v47MessageId);
        delete chatForm.dataset.v47MessageId;
        chatForm.reset();
        if (errorNode) errorNode.textContent = '';
        if (!isFirebaseMode()) {
          chatThreadBox.innerHTML = renderChatMessages(chat);
          bindAppointmentActions(chat, chatThreadBox);
          bindChatRetryActions(chat, chatThreadBox);
        }
        toast('Nachricht gesendet.');
      } catch (error) {
        const message = actionErrorMessage(error, 'Nachricht konnte nicht gesendet werden.');
        if (errorNode) errorNode.textContent = message;
        toast(message);
      } finally {
        submit.disabled = false;
      }
    });
  });
}

function chatListModal(req) {
  const chats = requestChats(req.id);
  openModal('Private Gespräche', `
    <section class="form-grid">
      <div class="card compact soft">
        <strong>${escapeHtml(req.title)}</strong>
        <p>Als Ersteller/in siehst du hier alle privaten 1:1-Gespräche zu diesem Inserat. Neue Chats erscheinen zusätzlich im Bereich „Chats“.</p>
      </div>
      <div class="list">
        ${chats.length ? chats.map(chat => `
          <section class="card compact ${chatHasUnread(chat) ? 'chat-inbox-card unread' : ''}">
            <div class="badges">${chatHasUnread(chat) ? '<span class="badge warn">neu</span>' : ''}<span class="badge">privat</span></div>
            <strong>${escapeHtml(chatPeerLabel(chat))}</strong>
            <p>${escapeHtml(chat.lastMessagePreview || 'Noch keine Nachricht.')}</p>
            <small>${escapeHtml(fmtTime(chat.lastMessageAt))}</small>
            <button class="secondary-button small" data-action="open-private-chat" data-chat-id="${escapeHtml(chat.id)}" style="margin-top:10px;">Chat öffnen</button>
          </section>
        `).join('') : '<div class="empty">Noch keine privaten Gespräche zu diesem Anliegen.</div>'}
      </div>
      <button class="ghost-button" data-route="chats" type="button">${iconSvg('chat')} Zum Chat-Bereich</button>
    </section>
  `, (modal, close) => {
    modal.querySelector('[data-route="chats"]')?.addEventListener('click', () => {
      close();
      setRoute('chats');
    });
    modal.querySelectorAll('[data-action="open-private-chat"]').forEach(button => {
      button.addEventListener('click', () => {
        const chat = state.chats.find(item => item.id === button.dataset.chatId);
        close();
        if (chat) runAsyncAction(async () => chatModalForChat(await ensureChatDocument(chat)));
      });
    });
  });
}

async function openChatForRequest(id) {
  const req = state.requests.find(item => item.id === id);
  if (!req) return;
  const ownerUid = requestOwnerUid(req);
  if (ownerUid === authState.user?.uid) {
    if (isFirebaseMode()) {
      await syncStateFromFirestore().catch(error => reportBackgroundError('Private Gespräche vorladen', error, { notify: true, fallback: 'Private Gespräche konnten nicht geladen werden.' }));
    }
    chatListModal(state.requests.find(item => item.id === id) || req);
    return;
  }
  const chat = await getOrCreateDirectChat(req, ownerUid);
  chatModalForChat(chat);
}

function chatModal(id) {
  runAsyncAction(() => openChatForRequest(id));
}

function replyModal(id) {
  chatModal(id);
}

async function decideRequestPublication(id, decision) {
  if (!isAdminRole()) throw new Error('Nur Admins können Beiträge freigeben.');
  const req = state.requests.find(item => item.id === id);
  if (!req) throw new Error('Beitrag nicht gefunden.');
  const now = nowIso();
  let update = {};
  if (decision === 'approve') {
    update = {
      status: 'offen',
      approvedAt: now,
      approvedBy: profileName(),
      rejectedAt: '',
      rejectedBy: '',
      rejectionReason: '',
      updatedAt: now
    };
  } else {
    const fallbackReason = decision === 'revise'
      ? 'Bitte Beitrag konkretisieren und erneut einreichen.'
      : 'Beitrag wurde nicht freigegeben.';
    const reason = window.prompt('Begründung für den Nutzer:', fallbackReason);
    if (reason === null) return;
    update = {
      status: 'abgelehnt',
      rejectedAt: now,
      rejectedBy: profileName(),
      rejectionReason: String(reason || fallbackReason).trim(),
      updatedAt: now
    };
  }
  Object.assign(req, update);
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.requests, req.id, update, true);
    await writeAuditLog('request_publication_decision', req, `${requestStatusLabel(update.status)}: ${req.title}`);
    await syncStateFromFirestore();
  } else {
    saveState();
  }
  render();
  toast(decision === 'approve' ? 'Beitrag freigegeben.' : 'Beitrag zur Überarbeitung zurückgegeben.');
}

function newOfficialNoticeModal() {
  if (!canManageOfficialNotices()) {
    toast('Nur Admins oder verifizierte Gemeinde-Konten können offizielle Hinweise erstellen.');
    return;
  }
  const fixedArea = locationLabel();
  const canChooseCantonScope = isAdminRole();
  openModal('Gemeinde-Hinweis erstellen', `
    <form id="officialNoticeForm" class="form-grid">
      <label>Titel
        <input name="title" required maxlength="100" placeholder="z. B. Öffnungszeiten Werkhof" />
      </label>
      <label>Hinweis
        <textarea name="text" required maxlength="700" placeholder="Sachlich, konkret und ohne Diskussion."></textarea>
      </label>
      <div class="form-grid three">
        <div class="readonly-field"><strong>Gebiet</strong><span>${escapeHtml(fixedArea)}</span></div>
        <label>Kategorie
          <select name="category">
            ${OFFICIAL_NOTICE_CATEGORIES.map(category => `<option>${escapeHtml(category)}</option>`).join('')}
          </select>
        </label>
        <label>Priorität
          <select name="priority">
            <option value="info">Info</option>
            <option value="wichtig">Wichtig</option>
          </select>
        </label>
      </div>
      <div class="form-grid two">
        ${canChooseCantonScope ? `
          <label>Reichweite
            <select name="scopeLevel">
              <option value="municipality">Nur eigene Gemeinde</option>
              <option value="canton">Ganzer Kanton ${escapeHtml(currentCantonCode())}</option>
            </select>
          </label>
        ` : '<input type="hidden" name="scopeLevel" value="municipality" />'}
        <label>Status
          <select name="status">
            <option value="online">Direkt online</option>
            <option value="entwurf">Entwurf</option>
          </select>
        </label>
        <label>Gültig bis
          <input name="validUntil" type="date" />
        </label>
      </div>
      <p class="help">Gemeinde-Hinweise sind nicht für Notfälle gedacht. Dringende Meldungen gehören zu „Lokale Alarme“.</p>
      <button class="primary-button" type="submit">Hinweis speichern</button>
    </form>
  `, (modal, close) => {
    modal.querySelector('#officialNoticeForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = event.currentTarget.querySelector('button[type="submit"]');
      submit.disabled = true;
      try {
        const data = Object.fromEntries(new FormData(event.currentTarget));
        const validUntil = data.validUntil ? new Date(`${data.validUntil}T23:59:59`).toISOString() : '';
        const payload = {
          id: uid('notice'),
          tenantId: 'quartinaut',
          uid: authState.user.uid,
          createdByUid: authState.user.uid,
          createdByLabel: state.profile.accountType === 'municipality'
            ? (state.profile.municipalityName || state.profile.area || 'Gemeinde')
            : 'Gemeinde',
          title: String(data.title || '').trim(),
          text: String(data.text || '').trim(),
          category: String(data.category || 'Allgemein'),
          priority: String(data.priority || 'info'),
          status: String(data.status || 'online'),
          area: fixedArea,
          areaKey: currentAreaKey(),
          cantonCode: currentCantonCode(),
          scopeLevel: data.scopeLevel === 'canton' && isAdminRole() ? 'canton' : 'municipality',
          validFrom: nowIso(),
          validUntil,
          createdAt: nowIso(),
          updatedAt: nowIso()
        };
        if (!payload.title || !payload.text) throw new Error('Titel und Hinweistext sind Pflicht.');
        state.officialNotices.unshift(normalizeOfficialNoticeDoc(payload));
        if (isFirebaseMode()) {
          await setFirebaseDoc(FIRESTORE_COLLECTIONS.officialNotices, payload.id, payload, false);
          await syncStateFromFirestore();
        } else {
          saveState();
        }
        close();
        render();
        toast(payload.status === 'online' ? 'Gemeinde-Hinweis veröffentlicht.' : 'Gemeinde-Hinweis als Entwurf gespeichert.');
      } finally {
        submit.disabled = false;
      }
    });
  });
}

async function updateOfficialNoticeStatus(id, status) {
  if (!canManageOfficialNotices()) throw new Error('Keine Berechtigung für Gemeinde-Hinweise.');
  const notice = state.officialNotices.find(item => item.id === id);
  if (!notice) throw new Error('Hinweis nicht gefunden.');
  const update = { status, updatedAt: nowIso() };
  Object.assign(notice, update);
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.officialNotices, id, update, true);
    await syncStateFromFirestore();
  } else {
    saveState();
  }
  render();
  toast(status === 'online' ? 'Hinweis online gestellt.' : 'Hinweis archiviert.');
}

function newAlertModal() {
  const fixedArea = locationLabel();
  openModal('Gemeinde-Alarm erstellen', `
    <form id="alertForm" class="form-grid">
      <label>Titel
        <input name="title" required maxlength="90" placeholder="Kurzer Titel" />
      </label>
      <label>Meldung
        <textarea name="text" required maxlength="460" placeholder="Faktisch, kurz, ohne Diskussion."></textarea>
      </label>
      <div class="form-grid three">
        <div class="readonly-field"><strong>Gebiet</strong><span>${escapeHtml(fixedArea)}</span></div>
        <label>Priorität
          <select name="severity" id="alertSeverity"><option value="info">P2 · Info</option><option value="warn">P1 · Wichtig</option><option value="critical">P0 · Notfall</option></select>
        </label>
        <label>Kanal
          <select name="channel"><option>Push + PWA</option><option>Push + E-Mail</option><option>Nur PWA</option></select>
        </label>
      </div>
      <div class="form-grid two">
        <label>Reichweite
          <select name="scopeLevel"><option value="municipality">Nur eigene Gemeinde</option><option value="canton">Ganzer Kanton ${escapeHtml(currentCantonCode())}</option></select>
        </label>
        <label>Gültig für
          <select name="validHours"><option value="4">4 Stunden</option><option value="6">6 Stunden</option><option value="12">12 Stunden</option><option value="24" selected>24 Stunden</option><option value="48">48 Stunden</option></select>
        </label>
        <label>Freigegeben durch
          <input name="approvedBy" maxlength="60" placeholder="z. B. Werkhof, Einsatzleitung" />
        </label>
      </div>
      <label class="check-row" id="approvalRow" hidden style="grid-template-columns:auto 1fr;">
        <input type="checkbox" name="approved" id="alertApproved" />
        <span><strong>Vier-Augen-Freigabe bestätigt</strong><small>Für P1/P0 zwingend: eine zweite berechtigte Person hat die Meldung geprüft.</small></span>
      </label>
      <p class="help">Verifizierte Meldungen sind strikt von privaten Gesuchen getrennt und werden nach Ablauf automatisch ausgeblendet.</p>
      <p id="alertError" class="form-error" role="alert"></p>
      <button class="primary-button" type="submit">Alarm veröffentlichen</button>
    </form>
  `, (modal, close) => {
    const severitySelect = modal.querySelector('#alertSeverity');
    const approvalRow = modal.querySelector('#approvalRow');
    const syncApproval = () => { approvalRow.hidden = severitySelect.value === 'info'; };
    severitySelect.addEventListener('change', syncApproval);
    syncApproval();
    modal.querySelector('#alertForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const errorNode = modal.querySelector('#alertError');
      const submit = event.currentTarget.querySelector('button[type="submit"]');
      submit.disabled = true;
      const needsApproval = data.severity !== 'info';
      if (needsApproval && !data.approved) {
        if (errorNode) errorNode.textContent = 'Für P1/P0 ist die Vier-Augen-Freigabe erforderlich.';
        submit.disabled = false;
        return;
      }
      const priority = data.severity === 'critical' ? 'P0' : data.severity === 'warn' ? 'P1' : 'P2';
      const payload = {
        id: uid('alert'),
        uid: authState.user.uid,
        title: data.title,
        text: data.text,
        area: fixedArea,
        areaKey: currentAreaKey(),
        cantonCode: currentCantonCode(),
        scopeLevel: data.scopeLevel === 'canton' ? 'canton' : 'municipality',
        severity: data.severity,
        priority,
        channel: data.channel,
        createdBy: isAdminRole() ? 'Gemeinde' : state.profile.initials,
        approvedBy: data.approvedBy || (needsApproval ? 'Vier-Augen-Freigabe' : ''),
        createdAt: nowIso(),
        validUntil: hoursFromNow(Number(data.validHours) || 24)
      };
      try {
        if (isFirebaseMode()) {
          await setFirebaseDoc(FIRESTORE_COLLECTIONS.alerts, payload.id, payload, false);
          await syncStateFromFirestore();
        } else {
          state.alerts.unshift(payload);
          saveState();
        }
        addChange(`Gemeinde-Alarm veröffentlicht (${priority}): ${data.title}`);
        close();
        render();
        toast('Alarm veröffentlicht.');
      } finally {
        submit.disabled = false;
      }
    });
  });
}

async function completeRequest(id) {
  const req = state.requests.find(item => item.id === id);
  if (!req) return;
  req.status = 'erledigt';
  req.closedAt = nowIso();
  state.archive.unshift({ id: req.id, title: req.title, closedAt: nowIso(), closedAtText: `abgeschlossen am ${new Date().toLocaleDateString('de-CH')} um ${new Date().toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}` });
  addChange(`Anliegen abgeschlossen: ${req.title}`);
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.requests, req.id, { status: req.status, closedAt: req.closedAt, updatedAt: nowIso() }, true);
  }

  if (req.recurringMode === 'woechentlich') {
    const { replies: _legacyReplies, ...baseRequest } = req;
    const followUpStatus = isAdminRole() ? 'offen' : 'wartet_freigabe';
    const followUpCreatedAt = nowIso();
    const followUp = {
      ...baseRequest,
      id: uid('req'),
      status: followUpStatus,
      reports: 0,
      createdAt: followUpCreatedAt,
      submittedAt: followUpCreatedAt,
      approvedAt: followUpStatus === 'offen' ? followUpCreatedAt : '',
      approvedBy: followUpStatus === 'offen' ? profileName() : '',
      rejectedAt: '',
      rejectedBy: '',
      rejectionReason: '',
      resubmittedAt: '',
      closedAt: '',
      expiresAt: expiryForUrgency(req.urgency),
      recurringParentId: req.recurringParentId || req.id
    };
    if (isFirebaseMode()) {
      await setFirebaseDoc(FIRESTORE_COLLECTIONS.requests, followUp.id, followUp, false);
    } else {
      state.requests.unshift(followUp);
    }
    addChange(`Wöchentliches Anliegen neu erstellt: ${followUp.title}`);
  }

  if (isFirebaseMode()) await syncStateFromFirestore();
  saveState();
  render();
  toast('Eintrag abgeschlossen und archiviert.');
}

async function reportRequest(id) {
  const req = state.requests.find(item => item.id === id);
  if (!req) return;
  req.reports = (req.reports || 0) + 1;
  const reportDetail = `Nutzer/in hat den Eintrag gemeldet. Anzahl Meldungen: ${req.reports}`;
  const riskLevel = req.escalationLevel && req.escalationLevel !== 'keine'
    ? req.escalationLevel
    : (req.category === 'Notfall' ? 'P1' : 'Prüfung');
  const existing = state.moderation.find(m => m.requestId === id && m.status === 'offen');
  if (existing) {
    existing.detail = reportDetail;
    existing.risk = riskLevel;
  } else {
    state.moderation.unshift({
      id: uid('mod'),
      requestId: id,
      type: 'Meldung',
      title: req.title,
      area: req.area,
      risk: riskLevel,
      status: 'offen',
      detail: reportDetail,
      reporterUid: authState.user?.uid || '',
      reporterEmail: authState.user?.email || '',
      reporterLabel: profileName(),
      createdAt: nowIso()
    });
  }
  if (isFirebaseMode()) {
    if (existing && !isAdminRole()) {
      state.moderation.unshift({
        id: uid('mod'),
        requestId: id,
        type: 'Meldung',
        title: req.title,
        area: req.area,
        risk: riskLevel,
        status: 'offen',
        detail: reportDetail,
        reporterUid: authState.user?.uid || '',
        reporterEmail: authState.user?.email || '',
        reporterLabel: profileName(),
        createdAt: nowIso()
      });
    }
    const canUpdateRequestReport = isAdminRole() || requestOwnerUid(req) === authState.user?.uid;
    if (canUpdateRequestReport) {
      await setFirebaseDoc(FIRESTORE_COLLECTIONS.requests, req.id, { reports: req.reports, updatedAt: nowIso() }, true);
    }
    if (existing && isAdminRole()) {
      await setFirebaseDoc(FIRESTORE_COLLECTIONS.moderation, existing.id, { detail: existing.detail, updatedAt: nowIso() }, true);
    } else {
      const newCase = state.moderation[0];
      await setFirebaseDoc(FIRESTORE_COLLECTIONS.moderation, newCase.id, newCase, false);
    }
    await syncStateFromFirestore();
  }
  addChange(`Eintrag zur Moderation gemeldet: ${req.title}`);
  saveState();
  render();
  toast('Meldung in Moderation gelegt.');
}

async function cleanupLegacyPublicReplies() {
  if (!isAdminRole()) throw new Error('Nur Admins können Alt-Chats bereinigen.');
  const targets = legacyPublicReplyRequests();
  if (!targets.length) {
    toast('Keine alten öffentlichen Antworten gefunden.');
    return;
  }
  if (!window.confirm(`${targets.length} Anliegen von alten öffentlichen Antworten bereinigen? Private 1:1-Chats bleiben unverändert.`)) return;
  const deleteField = firebaseStoreApi?.deleteField;
  let cleaned = 0;
  if (isFirebaseMode()) {
    await Promise.all(targets.map(async (req) => {
      const update = {
        legacyReplyCount: req.replies.length,
        legacyRepliesClearedAt: nowIso(),
        updatedAt: nowIso()
      };
      update.replies = typeof deleteField === 'function' ? deleteField() : [];
      await setFirebaseDoc(FIRESTORE_COLLECTIONS.requests, req.id, update, true);
      cleaned += 1;
    }));
    await writeAuditLog('legacy_replies_cleanup', { label: 'requests' }, `${cleaned} Anliegen bereinigt`);
    await syncStateFromFirestore();
  } else {
    targets.forEach((req) => {
      req.legacyReplyCount = req.replies.length;
      req.legacyRepliesClearedAt = nowIso();
      req.replies = [];
      cleaned += 1;
    });
    saveState();
  }
  render();
  toast(`${cleaned} alte öffentliche Chat-Verläufe bereinigt.`);
}

async function raiseRequestEscalation(id) {
  const req = state.requests.find(item => item.id === id);
  if (!req) return;
  const next = req.escalationLevel === 'keine'
    ? 'P2'
    : req.escalationLevel === 'P2'
      ? 'P1'
      : 'P0';
  req.escalationLevel = next;
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.requests, req.id, { escalationLevel: next, updatedAt: nowIso() }, true);
    await syncStateFromFirestore();
  }
  saveState();
  render();
  toast(`Eskalationsstufe auf ${next} gesetzt.`);
}

async function generateInvite() {
  const prefix = state.profile.area.slice(0, 3).toUpperCase().replace(/[^A-ZÄÖÜ]/g, 'QRT');
  const code = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
  const payload = { id: uid('inv'), code, area: state.profile.area, role: 'Bewohner/in', status: 'offen', createdAt: nowIso(), uid: authState.user.uid };
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.inviteCodes, payload.id, payload, false);
    await syncStateFromFirestore();
  } else {
    state.inviteCodes.unshift(payload);
  }
  addChange(`Einladungscode erzeugt: ${code}`);
  saveState();
  render();
  toast(`Einladungscode ${code} erstellt.`);
}

async function resolveModeration(id, escalated = false) {
  const item = state.moderation.find(m => m.id === id);
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.moderation, id, {
      status: escalated ? 'eskaliert' : 'erledigt',
      resolvedAt: nowIso(),
      resolvedBy: authState.user.uid,
      updatedAt: nowIso()
    }, true);
    await syncStateFromFirestore();
  } else {
    state.moderation = state.moderation.filter(m => m.id !== id);
  }
  addChange(`${escalated ? 'Moderationsfall eskaliert' : 'Moderationsfall erledigt'}: ${item?.title || id}`);
  saveState();
  render();
  toast(escalated ? 'Fall eskaliert.' : 'Fall erledigt.');
}

async function updateStoredUser(email, updates, uidValue = '') {
  if (isFirebaseMode() && uidValue) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.users, uidValue, { ...updates, updatedAt: nowIso() }, true);
  } else if (email) {
    const users = loadLocalUsers();
    if (users[email]) {
      users[email] = { ...users[email], ...updates };
      saveLocalUsers(users);
    }
  }
  if (authState.user?.uid === uidValue || authState.user?.email === email) {
    syncCurrentUser(updates);
    applyAuthenticatedUser(authState.user);
  }
}

async function toggleUserAccountStatus(uidValue) {
  const user = state.registeredUsers.find(item => item.uid === uidValue);
  if (!user) throw new Error('Nutzer nicht gefunden.');
  if (uidValue === authState.user?.uid) throw new Error('Du kannst dein eigenes Admin-Konto nicht deaktivieren.');
  if (archivedUserStatus(user) === 'deleted') throw new Error('Gelöschte Konten bleiben im Archiv und können nicht reaktiviert werden.');
  const current = user.accountStatus || 'active';
  const next = current === 'disabled' ? 'active' : 'disabled';
  const updates = {
    accountStatus: next,
    disabledAt: next === 'disabled' ? nowIso() : '',
    disabledBy: next === 'disabled' ? authState.user?.uid || '' : ''
  };
  await updateStoredUser(user.email, updates, uidValue);
  await writeAuditLog(next === 'disabled' ? 'Nutzer deaktiviert' : 'Nutzer aktiviert', { uid: uidValue, email: user.email, label: user.displayName || user.email }, `Status: ${accountStatusLabel(next)}`);
  if (isFirebaseMode()) await syncStateFromFirestore();
  saveState();
  render();
  toast(next === 'disabled' ? 'Nutzer deaktiviert.' : 'Nutzer aktiviert.');
}

async function reviewMunicipalityAccount(uidValue, approved) {
  const user = state.registeredUsers.find(item => item.uid === uidValue);
  if (!user || user.accountType !== 'municipality') throw new Error('Gemeindekonto nicht gefunden.');
  const actionLabel = approved ? 'freigeben' : 'ablehnen';
  if (!window.confirm(`${user.municipalityName || user.area || user.displayName || 'Dieses Gemeindekonto'} wirklich ${actionLabel}?`)) return;
  if (isFirebaseMode()) {
    if (!firebaseFunctionsApi?.httpsCallable || !firebaseFunctionsApi?.functions) {
      throw new Error('Die sichere Gemeinde-Freigabe ist momentan nicht verfügbar.');
    }
    const callable = firebaseFunctionsApi.httpsCallable(firebaseFunctionsApi.functions, 'reviewMunicipalityAccount');
    await callable({ uid: uidValue, approved: Boolean(approved) });
    await syncStateFromFirestore();
  } else {
    const updates = approved
      ? {
          role: 'resident',
          adminScopeArea: '',
          accountStatus: 'active',
          municipalityStatus: 'verified',
          verified: true,
          verificationStatus: 'verified',
          verificationLabel: 'Gemeinde',
          titlePreset: 'municipality',
          titleGrants: ['verified']
        }
      : {
          role: 'resident',
          adminScopeArea: '',
          accountStatus: 'pending_verification',
          municipalityStatus: 'rejected',
          verified: false,
          verificationStatus: 'rejected',
          verificationLabel: '',
          titlePreset: 'auto',
          titleGrants: []
        };
    await updateStoredUser(user.email, updates, uidValue);
    Object.assign(user, updates);
  }
  await writeAuditLog(
    approved ? 'Gemeindekonto freigegeben' : 'Gemeindekonto abgelehnt',
    { uid: uidValue, email: user.email, label: user.municipalityName || user.displayName || user.email },
    user.area || user.municipalityName || ''
  );
  saveState();
  render();
  toast(approved ? 'Gemeindekonto freigegeben.' : 'Gemeindekonto abgelehnt.');
}

async function revokeUserVerification(uidValue) {
  const user = state.registeredUsers.find(item => item.uid === uidValue);
  if (!user) throw new Error('Nutzer nicht gefunden.');
  if (!window.confirm(`Verifizierung von ${user.displayName || user.email || 'diesem Konto'} widerrufen? Der Nutzer kann danach erneut eine Prüfung beantragen.`)) return;
  const updates = {
    verified: false,
    verificationStatus: 'none',
    verificationLabel: '',
    titlePreset: 'auto',
    titleGrants: [],
    verificationRevokedAt: nowIso(),
    verificationRevokedBy: authState.user?.uid || '',
    ...(user.accountType === 'company' ? { companyStatus: 'pending' } : {}),
    ...(user.accountType === 'municipality'
      ? {
          municipalityStatus: 'pending',
          accountStatus: 'pending_verification',
          role: 'resident',
          adminScopeArea: ''
        }
      : {})
  };
  await updateStoredUser(user.email, updates, uidValue);
  await writeAuditLog('Verifizierung widerrufen', { uid: uidValue, email: user.email, label: user.displayName || user.email }, user.accountType === 'company' ? 'Firma wieder auf Prüfung gesetzt' : 'Profil nicht mehr verifiziert');
  if (isFirebaseMode()) await syncStateFromFirestore();
  saveState();
  render();
  toast('Verifizierung widerrufen.');
}

async function approveLocationRequest(id, approved) {
  const req = state.locationChangeRequests.find(item => item.id === id);
  if (!req) return;
  req.status = approved ? 'bestätigt' : 'abgelehnt';
  req.decidedAt = nowIso();
  req.decidedBy = authState.user.uid;
  if (approved) {
    const area = locationLabel(req.targetLocation);
    await updateStoredUser(req.email, { location: req.targetLocation, area }, req.uid);
    if (authState.user?.uid === req.uid) {
      state.profile.location = req.targetLocation;
      state.profile.area = area;
    }
  }
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.locationChangeRequests, req.id, {
      status: req.status,
      decidedAt: req.decidedAt,
      decidedBy: req.decidedBy
    }, true);
    await writeAuditLog(approved ? 'Standortwechsel bestätigt' : 'Standortwechsel abgelehnt', { uid: req.uid, email: req.email, label: req.displayName }, `${req.currentLabel} → ${req.targetLabel}`);
    await syncStateFromFirestore();
  }
  saveState();
  render();
  toast(approved ? 'Standortwechsel bestätigt.' : 'Standortwechsel abgelehnt.');
}

async function approveVerificationRequest(id, approved, approvedTitlePreset = 'verified') {
  const req = state.verificationRequests.find(item => item.id === id);
  if (!req) return;
  const targetUser = state.registeredUsers.find(user => user.uid === req.uid);
  const isCompanyTarget = req.accountType === 'company' || targetUser?.accountType === 'company';
  if (approved && !verificationPhotoAvailable(req)) throw new Error('Verifizierung benötigt ein Ausweisfoto.');
  const safeTitlePreset = ['verified', 'resident', 'registry', 'district'].includes(approvedTitlePreset) ? approvedTitlePreset : 'verified';
  const titleGrants = approved && ['registry', 'district'].includes(safeTitlePreset) ? [safeTitlePreset, 'verified'] : (approved ? ['verified'] : []);
  const decidedAt = nowIso();
  const decisionPayload = {
    status: approved ? 'bestätigt' : 'abgelehnt',
    decidedAt,
    decidedBy: authState.user?.uid || '',
    approvedTitlePreset: approved ? safeTitlePreset : '',
    approvedTitleLabel: approved ? titlePresetLabel(safeTitlePreset) : '',
    proofType: req.proofType || (isCompanyTarget ? 'company_responsible_person' : 'personal_id'),
    updatedAt: decidedAt
  };
  const updates = {
    verified: approved,
    verificationStatus: approved ? 'verified' : 'rejected',
    verificationLabel: approved ? titlePresetLabel(safeTitlePreset) : '',
    titlePreset: approved ? safeTitlePreset : 'auto',
    titleGrants,
    ...(isCompanyTarget ? { companyStatus: approved ? 'verified' : 'rejected' } : {})
  };
  if (isFirebaseMode()) {
    const { db, doc, writeBatch } = firebaseStoreApi;
    if (typeof writeBatch === 'function') {
      const batch = writeBatch(db);
      batch.set(doc(db, FIRESTORE_COLLECTIONS.users, req.uid), { ...updates, updatedAt: nowIso() }, { merge: true });
      batch.set(doc(db, FIRESTORE_COLLECTIONS.verificationRequests, req.id), decisionPayload, { merge: true });
      await batch.commit();
    } else {
      await updateStoredUser(req.email, updates, req.uid);
      await setFirebaseDoc(FIRESTORE_COLLECTIONS.verificationRequests, req.id, decisionPayload, true);
    }
    if (authState.user?.uid === req.uid) {
      syncCurrentUser(updates);
      applyAuthenticatedUser(authState.user);
    }
    await writeAuditLog(approved ? 'Profil verifiziert' : 'Verifizierung abgelehnt', { uid: req.uid, email: req.email, label: req.displayName }, approved ? `Titel: ${titlePresetLabel(safeTitlePreset)}` : 'abgelehnt')
      .catch(error => reportBackgroundError('Audit-Log Verifizierungsentscheid', error, { notify: false, collection: FIRESTORE_COLLECTIONS.auditLog }));
    try {
      await deleteVerificationPhoto(req);
      await setFirebaseDoc(FIRESTORE_COLLECTIONS.verificationRequests, req.id, { idPhoto: null, photoCleanupPending: false, photoDeletedAt: nowIso(), updatedAt: nowIso() }, true);
    } catch (error) {
      await setFirebaseDoc(FIRESTORE_COLLECTIONS.verificationRequests, req.id, { photoCleanupPending: true, photoCleanupError: String(error?.message || error || 'unbekannt'), updatedAt: nowIso() }, true).catch(() => {});
      reportBackgroundError('Verifizierungsfoto nach Entscheid löschen', error, { notify: false, collection: 'storage:verification-photos' });
    }
    await syncStateFromFirestore();
  } else {
    await updateStoredUser(req.email, updates, req.uid);
    Object.assign(req, decisionPayload, { idPhoto: null, photoDeletedAt: nowIso() });
  }
  if (authState.user?.uid === req.uid) {
    state.profile.verified = approved;
    state.profile.verificationStatus = updates.verificationStatus;
    state.profile.verificationLabel = updates.verificationLabel;
    state.profile.titlePreset = updates.titlePreset;
    state.profile.titleGrants = updates.titleGrants;
    if (isCompanyTarget) state.profile.companyStatus = updates.companyStatus;
  }
  saveState();
  render();
  toast(approved ? (isCompanyTarget ? 'Person/Firma freigegeben.' : 'Profil verifiziert.') : 'Verifizierung abgelehnt.');
}

function handleVerificationDecisionClick(button, approved) {
  runAsyncAction(async () => {
    const id = button.dataset.id || '';
    const card = button.closest('.card');
    const errorNode = card?.querySelector(`[data-verification-error="${cssEscape(id)}"]`);
    const titlePreset = card?.querySelector('[data-verification-title]')?.value || 'verified';
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = approved ? 'Wird geprüft ...' : 'Wird abgelehnt ...';
    if (errorNode) errorNode.textContent = '';
    try {
      await approveVerificationRequest(id, approved, titlePreset);
    } catch (error) {
      const message = actionErrorMessage(error, approved ? 'Verifizierung konnte nicht bestätigt werden.' : 'Verifizierung konnte nicht abgelehnt werden.');
      if (errorNode) errorNode.textContent = message;
      reportBackgroundError(approved ? 'Verifizierungsentscheid bestätigen' : 'Verifizierungsentscheid ablehnen', error, { notify: false, collection: FIRESTORE_COLLECTIONS.verificationRequests });
      toast(message);
    } finally {
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  });
}

async function setVerificationRequestQueueStatus(id, status) {
  const req = state.verificationRequests.find(item => item.id === id);
  if (!req) return;
  req.status = status;
  req.decidedAt = '';
  req.decidedBy = '';
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.verificationRequests, req.id, {
      status: req.status,
      decidedAt: req.decidedAt,
      decidedBy: req.decidedBy,
      updatedAt: nowIso()
    }, true);
    await syncStateFromFirestore();
  }
  saveState();
  render();
  toast(status === 'zurückgestellt' ? 'Verifizierungsantrag zurückgestellt.' : 'Verifizierungsantrag wieder geöffnet.');
}

async function updateChangeRequestStatus(id, status) {
  const req = state.changeRequests.find(item => item.id === id);
  if (!req) return;
  req.status = status;
  req.decidedAt = nowIso();
  req.decidedBy = authState.user?.uid || '';
  const updatePayload = {
    status: req.status,
    decidedAt: req.decidedAt,
    decidedBy: req.decidedBy,
    updatedAt: nowIso()
  };
  if (status === 'freigegeben' && req.type === 'name_change') {
    const requestedName = String(req.requestedName || '').trim();
    if (!requestedName) throw new Error('Namensantrag enthält keinen neuen Namen.');
    const updates = {
      displayName: requestedName,
      initials: initialsFromName(requestedName)
    };
    await updateStoredUser(req.email, updates, req.uid);
    req.appliedName = requestedName;
    updatePayload.appliedName = requestedName;
    if (authState.user?.uid === req.uid) {
      state.profile.name = requestedName;
      state.profile.initials = updates.initials;
    }
  }
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.changeRequests, req.id, updatePayload, true);
    await writeAuditLog(status === 'freigegeben' ? 'Änderung freigegeben' : status === 'abgelehnt' ? 'Änderung abgelehnt' : 'Änderung in Prüfung', { uid: req.uid, email: req.email, label: req.displayName }, req.type === 'name_change' ? `${req.currentName} → ${req.requestedName}` : req.title);
    await syncStateFromFirestore();
  }
  saveState();
  render();
  const map = { freigegeben: req.type === 'name_change' ? 'Namensänderung freigegeben.' : 'Anfrage freigegeben.', in_pruefung: 'Anfrage in Prüfung verschoben.', abgelehnt: 'Anfrage abgelehnt.' };
  toast(map[status] || 'Anfrage aktualisiert.');
}

function downloadJsonFile(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function localOwnDataExport() {
  const uidValue = authState.user?.uid || '';
  return {
    exportedAt: nowIso(),
    mode: 'local',
    profile: state.profile,
    requests: state.requests.filter(req => requestOwnerUid(req) === uidValue || req.uid === uidValue),
    chats: state.chats.filter(chat => Array.isArray(chat.participants) && chat.participants.includes(uidValue)),
    chatMessages: state.chatMessages.filter(msg => Array.isArray(msg.participants) && msg.participants.includes(uidValue)),
    alertsRead: state.alertReads.filter(item => item.uid === uidValue),
    deviceTokens: state.deviceTokens.filter(item => item.uid === uidValue),
    locationChangeRequests: state.locationChangeRequests.filter(item => item.uid === uidValue),
    verificationRequests: state.verificationRequests.filter(item => item.uid === uidValue).map(item => ({ ...item, idPhoto: item.idPhoto ? { ...item.idPhoto, dataUrl: undefined, downloadUrl: undefined } : null })),
    changeRequests: state.changeRequests.filter(item => item.uid === uidValue)
  };
}

async function exportOwnData() {
  let data = localOwnDataExport();
  if (isFirebaseMode() && firebaseFunctionsApi?.httpsCallable && firebaseFunctionsApi?.functions) {
    const callable = firebaseFunctionsApi.httpsCallable(firebaseFunctionsApi.functions, 'exportOwnData');
    const result = await callable({});
    data = result.data || data;
  }
  const safeDate = new Date().toISOString().slice(0, 10);
  downloadJsonFile(`quartinaut-datenexport-${safeDate}.json`, data);
  toast('Datenexport erstellt.');
}

async function deleteOwnAccountData() {
  const confirmed = window.confirm('Konto wirklich löschen? Dein Konto und der Zugang werden gelöscht/anonymisiert. Du kannst dich danach jederzeit neu registrieren, beginnst aber mit einem neuen, leeren Konto. Admins sehen nur einen Archivvermerk zur Missbrauchs- und Rechtsnachvollziehbarkeit. Dieser Schritt kann nicht rückgängig gemacht werden.');
  if (!confirmed) return;
  if (isFirebaseMode() && firebaseFunctionsApi?.httpsCallable && firebaseFunctionsApi?.functions) {
    const callable = firebaseFunctionsApi.httpsCallable(firebaseFunctionsApi.functions, 'deleteOwnAccountData');
    await callable({});
    toast('Konto gelöscht. Du wirst abgemeldet.');
    await firebaseAuthApi?.signOut(firebaseAuthApi.auth).catch(error => reportBackgroundError('Nach Konto-Löschung abmelden', error));
    localStorage.removeItem(USER_PREFS_PREFIX + (authState.user?.uid || ''));
    saveLocalSession(null);
    resetAccountSession('', 'firebase');
    authState.user = null;
    render();
    return;
  }
  localStorage.removeItem(LOCAL_STATE_PREFIX + (authState.user?.uid || ''));
  resetAccountSession('', 'local');
  authState.user = null;
  saveLocalSession(null);
  toast('Lokales Konto gelöscht.');
  render();
}

async function updateUserRoleByEmail(email, role, adminScopeArea = '') {
  if (!isAdminRole()) throw new Error('Für Rollenänderungen ist ein gültiger Administrator-Claim erforderlich.');
  const targetEmail = normalizeEmail(email);
  if (!targetEmail || !['admin', 'area_admin', 'resident'].includes(role)) throw new Error('E-Mail oder Rolle ungültig.');
  if (!isFirebaseMode()) throw new Error('Rollen lassen sich nur mit Firebase sicher ändern.');
  const { db, collection, query, where, limit, getDocs } = firebaseStoreApi;
  const users = await getDocs(query(collection(db,FIRESTORE_COLLECTIONS.users),where('email','==',targetEmail),limit(1)));
  if (users.empty) throw new Error('Kein Nutzer mit dieser E-Mail gefunden.');
  const target = users.docs[0];
  const result = await callQuartinaut('quartinautSetRole', {
    uid: target.id,
    role,
    adminScopeArea: role === 'area_admin' ? String(adminScopeArea||'').trim() : ''
  });
  if (!result?.ok) throw new Error('Die Rollenänderung wurde nicht bestätigt.');
  await syncStateFromFirestore();
  render();
  toast('Rolle wurde serverseitig aktualisiert. Die betroffene Person muss die Anmeldung ggf. erneuern.');
}

async function updateAreaCategoryPriority(rawValue) {
  const areaName = baseMunicipalityName(state.profile.area);
  if (!areaName) throw new Error('Bitte zuerst ein Gebiet auswählen.');
  const priority = String(rawValue || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .filter(value => CATEGORIES.includes(value));
  const payload = {
    id: `priority_${areaName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    areaName,
    areaLabel: state.profile.area,
    priority,
    updatedAt: nowIso(),
    updatedBy: authState.user?.uid || ''
  };
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.areaCategoryPriority, payload.id, payload, true);
    await syncStateFromFirestore();
  } else {
    state.areaCategoryPriority = state.areaCategoryPriority.filter(item => item.id !== payload.id);
    state.areaCategoryPriority.unshift(payload);
    saveState();
  }
  render();
  toast('Kategorie-Priorität gespeichert.');
}

async function enableNotifications() {
  if (!('Notification' in window)) {
    toast('Dieser Browser unterstützt keine Benachrichtigungen.');
    return;
  }
  const current = Notification.permission;
  const permission = current === 'default' ? await Notification.requestPermission() : current;
  localStorage.removeItem(NOTIFICATION_BANNER_DISMISSED_KEY);
  if (permission !== 'granted') {
    const blocked = permission === 'denied';
    toast(blocked ? 'Benachrichtigungen sind im Browser blockiert.' : 'Benachrichtigungen nicht aktiviert.');
    renderNotificationPermissionBanner();
    if (blocked) openNotificationBlockedHelpModal();
    return;
  }

  await persistNotificationPreferences({
    ...currentNotificationPreferences(),
    enabled: true
  }, { notify: false });
  let pushReady = false;
  if (isFirebaseMode()) {
    try {
      await registerPushToken();
      pushReady = true;
    } catch (error) {
      toast(`Push-Token konnte nicht gespeichert werden: ${error?.message || 'unbekannter Fehler'}`);
    }
  }
  saveState();

  const notificationResult = await tryShowSystemNotification(
    'Quartinaut ist bereit',
    pushReady
      ? 'Push ist aktiv. Welche Inhalte zugestellt werden, bestimmst du im Profil.'
      : 'Benachrichtigungen sind aktiv. Push wird beim nächsten Sync erneut versucht.',
    { tag: 'quartinaut-permission-ready', data: { route: 'alarme' } }
  );
  renderNotificationPermissionBanner();
  if (!notificationResult.shown) {
    toast('Benachrichtigung konnte lokal nicht angezeigt werden.');
    openModal('Benachrichtigung nicht sichtbar', `
      <section class="form-grid legal-copy">
        <p>Die Browser-Berechtigung ist aktiv, aber dein Betriebssystem oder Browser hat keine sichtbare Systemmeldung angezeigt.</p>
        <ul class="help-list">
          <li><strong>Browser:</strong> ${escapeHtml(notificationPermissionState())}</li>
          <li><strong>FCM-Token:</strong> ${pushReady ? 'gespeichert' : 'noch nicht bestätigt'}</li>
          <li><strong>Fehler:</strong> ${escapeHtml(notificationResult.error || 'keine technische Fehlermeldung')}</li>
        </ul>
        <p>Prüfe zusätzlich die Benachrichtigungen im Betriebssystem und ob „Nicht stören“ aktiv ist.</p>
      </section>
    `);
  }
}

async function sendNotificationTest() {
  if (!('Notification' in window)) {
    toast('Dieser Browser unterstützt keine Benachrichtigungen.');
    return;
  }
  if (Notification.permission !== 'granted') {
    await enableNotifications();
    if (Notification.permission !== 'granted') return;
  }
  let tokenError = '';
  let fcmTestQueued = false;
  let fcmTestError = '';
  if (isFirebaseMode() && authState.user) {
    try {
      const token = await registerPushToken();
      await queueFcmSelfTest(token);
      fcmTestQueued = true;
    } catch (error) {
      tokenError = error?.message || 'FCM-Token konnte nicht erneuert werden.';
      fcmTestError = tokenError;
    }
  }
  const stamp = new Date().toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const notificationResult = await tryShowSystemNotification(
    'Quartinaut Test',
    `Testmeldung um ${stamp}. Wenn du das siehst, ist dein Gerät korrekt eingerichtet.`,
    { tag: 'quartinaut-push-test', data: { route: 'alarme' } }
  );
  if (notificationResult.shown && !tokenError && (!isFirebaseMode() || fcmTestQueued)) {
    toast(fcmTestQueued ? 'Lokaler Test gesendet, FCM-Test ausgelöst.' : 'Testbenachrichtigung gesendet.');
    return;
  }
  toast(notificationResult.shown ? 'Lokaler Test gesendet, FCM bitte prüfen.' : 'Testbenachrichtigung nicht sichtbar.');
  openModal('Push-Test Ergebnis', `
    <section class="form-grid legal-copy">
      <p><strong>Lokaler Systemtest:</strong> ${notificationResult.shown ? 'ausgelöst' : 'nicht sichtbar'}</p>
      <p><strong>FCM-Token:</strong> ${tokenError ? `Fehler: ${escapeHtml(tokenError)}` : (currentPushToken ? 'gespeichert' : 'noch nicht im Speicher')}</p>
      <p><strong>FCM-Server-Test:</strong> ${fcmTestQueued ? 'ausgelöst' : (isFirebaseMode() ? `nicht ausgelöst${fcmTestError ? ` · ${escapeHtml(fcmTestError)}` : ''}` : 'nicht im lokalen Modus')}</p>
      <p><strong>Browser-Berechtigung:</strong> ${escapeHtml(notificationPermissionState())}</p>
      ${notificationResult.error ? `<p><strong>Systemmeldung-Fehler:</strong> ${escapeHtml(notificationResult.error)}</p>` : ''}
      <div class="card compact soft">
        <strong>Was sichtbar sein sollte</strong>
        <p>Bei erfolgreichem Test erscheint eine Systembenachrichtigung von Quartinaut ausserhalb der Seite. Wenn nur diese Meldung in der App erscheint, blockiert meist das Betriebssystem, der Browser oder der FCM-Token ist nicht gespeichert.</p>
      </div>
    </section>
  `);
}

async function openPushDiagnosticsModal() {
  const permission = ('Notification' in window) ? Notification.permission : 'unsupported';
  const registration = await resolveNotificationRegistration();
  const ownTokens = state.deviceTokens.filter(token => token.uid === authState.user?.uid && token.active !== false).length;
  const tokenVisible = currentPushToken ? `${currentPushToken.slice(0, 10)}…${currentPushToken.slice(-8)}` : 'noch nicht im Speicher';
  const latestDelivery = state.pushDeliveries[0];
  const latestChatDelivery = state.pushDeliveries.find(item => item.type === 'chat_message');
  const preferences = currentNotificationPreferences();
  const latestDeliveryLabel = latestDelivery
    ? `${latestDelivery.status || 'unbekannt'} · ${latestDelivery.successCount || 0}/${latestDelivery.requested || 0} erfolgreich`
    : 'noch kein Alarmversand protokolliert';
  const latestChatDeliveryLabel = latestChatDelivery
    ? `${latestChatDelivery.status || 'unbekannt'} · ${latestChatDelivery.successCount || 0}/${latestChatDelivery.requested || 0} erfolgreich`
    : (isAdminRole() ? 'noch keine Chat-Push-Zustellung protokolliert' : 'wird beim Empfänger über Chat-Nachrichten geprüft');
  const statusRows = [
    `<li><strong>Browser-Berechtigung:</strong> ${escapeHtml(permission)}</li>`,
    `<li><strong>Service Worker:</strong> ${registration ? 'bereit' : 'nicht bereit'}</li>`,
    `<li><strong>Firebase Modus:</strong> ${isFirebaseMode() ? 'aktiv' : 'lokal'}</li>`,
    `<li><strong>VAPID Key:</strong> ${FIREBASE_VAPID_KEY ? 'gesetzt' : 'fehlt'}</li>`,
    `<li><strong>Eigene Push-Tokens:</strong> ${escapeHtml(String(ownTokens))}</li>`,
    `<li><strong>Benachrichtigungsprofil:</strong> ${preferences.enabled ? 'aktiv' : 'pausiert'}</li>`,
    `<li><strong>Stichwortregeln:</strong> ${escapeHtml(String(preferences.keywordRules.filter(rule => rule.enabled).length))} aktiv</li>`,
    `<li><strong>Gemeinde-Hinweise:</strong> ${preferences.officialNotices.enabled ? escapeHtml(preferences.officialNotices.priorities.join(', ') || 'keine Priorität') : 'deaktiviert'}</li>`,
    `<li><strong>Aktueller Token (gekürzt):</strong> ${escapeHtml(tokenVisible)}</li>`,
    `<li><strong>Letzter FCM-Versand:</strong> ${escapeHtml(latestDeliveryLabel)}</li>`,
    `<li><strong>Letzter Chat-Push:</strong> ${escapeHtml(latestChatDeliveryLabel)}</li>`,
    `<li><strong>Chat-Push-Trigger:</strong> aktiv für neue private Nachrichten</li>`
  ].join('');
  openModal('Push-Diagnose', `
    <section class="form-grid legal-copy">
      <p>So prüfst du Schritt für Schritt, ob Push vollständig funktioniert.</p>
      <ul>${statusRows}</ul>
      <div class="card compact soft">
        <strong>Testablauf</strong>
        <p>1) „Benachrichtigungen aktivieren“ drücken, 2) „Test senden“ drücken, 3) mit einem zweiten Konto eine private Chat-Nachricht senden. Der Empfänger erhält die Systemmeldung, wenn sein Gerät Push erlaubt.</p>
      </div>
      <div class="row-actions legal-shortcuts">
        <button class="secondary-button small" type="button" data-action="enable-notifications">Berechtigung erneuern</button>
        <button class="ghost-button small" type="button" data-action="test-notification">Test senden</button>
      </div>
    </section>
  `, (modal) => {
    modal.querySelector('[data-action="enable-notifications"]')?.addEventListener('click', () => runAsyncAction(enableNotifications));
    modal.querySelector('[data-action="test-notification"]')?.addEventListener('click', () => runAsyncAction(sendNotificationTest));
  });
}

async function passkeyCheck() {
  if (!window.PublicKeyCredential || !navigator.credentials?.create || !window.crypto?.getRandomValues) {
    toast('WebAuthn wird auf diesem Gerät nicht unterstützt.');
    return;
  }
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Quartinaut' },
        user: { id: userId, name: state.profile.name, displayName: state.profile.name },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { userVerification: 'preferred' },
        timeout: 45000,
        attestation: 'none'
      }
    });
    state.profile.passkeyReady = true;
    if (isFirebaseMode()) await updateFirebaseProfile({ passkeyReady: true });
    addChange('Passkey erfolgreich gestartet.');
    saveState();
    render();
    toast('Passkey erfolgreich gestartet.');
  } catch {
    toast('Passkey abgebrochen oder nicht verfügbar.');
  }
}

function resetLocalData() {
  if (!window.confirm('Lokale Daten wirklich zurücksetzen? Schwarzes Brett, Alarme und Archiv dieses Browsers werden geleert.')) return;
  localStorage.removeItem(USER_PREFS_PREFIX + (authState.user?.uid || ''));
  if (authState.mode === 'local') localStorage.removeItem(LOCAL_STATE_PREFIX + (authState.user?.uid || ''));
  state = structuredClone(seed);
  state.route = 'home';
  if (authState.user) applyAuthenticatedUser(authState.user);
  if (isFirebaseMode()) {
    syncStateFromFirestore()
      .then(() => {
        saveState();
        render();
        toast('Lokale Cache-Daten zurückgesetzt.');
      })
      .catch(() => {
        saveState();
        render();
        toast('Lokale Daten zurückgesetzt.');
      });
    return;
  }
  saveState();
  render();
  toast('Lokale Daten zurückgesetzt.');
}

function runAsyncAction(action) {
  Promise.resolve()
    .then(action)
    .catch((error) => {
      console.error(error);
      toast(actionErrorMessage(error));
    });
}

function bindDashboardControls() {
  const tiles = [...document.querySelectorAll('[data-dashboard-tile]')];
  startDashboardMasonry();
  document.querySelectorAll('[data-action="dashboard-move"]').forEach(btn => btn.addEventListener('click', () => {
    moveDashboardTile(btn.dataset.tile, Number(btn.dataset.dir || 0));
  }));
  document.querySelectorAll('[data-action="dashboard-hide"]').forEach(btn => btn.addEventListener('click', () => {
    setDashboardTileHidden(btn.dataset.tile, true);
  }));
  document.querySelectorAll('[data-action="dashboard-show"]').forEach(btn => btn.addEventListener('click', () => {
    setDashboardTileHidden(btn.dataset.tile, false);
  }));
  document.querySelectorAll('[data-action="dashboard-toggle-collapse"]').forEach(btn => btn.addEventListener('click', () => {
    const tileId = btn.dataset.tile || '';
    const collapsed = !(state.dashboard.collapsed || []).includes(tileId);
    runAsyncAction(() => setDashboardTileCollapsed(tileId, collapsed));
  }));
  document.querySelectorAll('[data-action="dashboard-reset"]').forEach(btn => btn.addEventListener('click', resetDashboardLayout));
  document.querySelectorAll('[data-action="dashboard-save"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(saveDashboardLayout)));
  document.querySelectorAll('[data-action="dashboard-cancel-edit"]').forEach(btn => btn.addEventListener('click', () => setDashboardEditMode(false)));

  if (!dashboardEditMode()) return;

  tiles.forEach(tile => {
    tile.addEventListener('dragstart', (event) => {
      dashboardDragId = tile.dataset.dashboardTile || '';
      tile.classList.add('is-dragging');
      event.dataTransfer?.setData('text/plain', dashboardDragId);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });
    tile.addEventListener('dragend', () => {
      dashboardDragId = '';
      document.querySelectorAll('.dashboard-tile').forEach(item => item.classList.remove('is-dragging', 'drop-target'));
    });
    tile.addEventListener('dragover', (event) => {
      if (!dashboardDragId) return;
      event.preventDefault();
      tile.classList.add('drop-target');
    });
    tile.addEventListener('dragleave', () => tile.classList.remove('drop-target'));
    tile.addEventListener('drop', (event) => {
      event.preventDefault();
      const source = event.dataTransfer?.getData('text/plain') || dashboardDragId;
      dropDashboardTile(source, tile.dataset.dashboardTile || '');
    });
  });

  document.querySelectorAll('.tile-grip').forEach(grip => {
    grip.addEventListener('pointerdown', (event) => {
      const tile = grip.closest('[data-dashboard-tile]');
      if (!tile || event.pointerType === 'mouse') return;
      dashboardPointerDrag = { id: tile.dataset.dashboardTile || '', pointerId: event.pointerId };
      tile.classList.add('is-dragging');
      grip.setPointerCapture?.(event.pointerId);
    });
    grip.addEventListener('pointermove', (event) => {
      if (!dashboardPointerDrag || dashboardPointerDrag.pointerId !== event.pointerId) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-dashboard-tile]');
      document.querySelectorAll('.dashboard-tile').forEach(item => item.classList.toggle('drop-target', item === target && target.dataset.dashboardTile !== dashboardPointerDrag.id));
    });
    grip.addEventListener('pointerup', (event) => {
      if (!dashboardPointerDrag || dashboardPointerDrag.pointerId !== event.pointerId) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-dashboard-tile]');
      if (target) dropDashboardTile(dashboardPointerDrag.id, target.dataset.dashboardTile || '');
      dashboardPointerDrag = null;
      document.querySelectorAll('.dashboard-tile').forEach(item => item.classList.remove('is-dragging', 'drop-target'));
    });
    grip.addEventListener('pointercancel', () => {
      dashboardPointerDrag = null;
      document.querySelectorAll('.dashboard-tile').forEach(item => item.classList.remove('is-dragging', 'drop-target'));
    });
  });
}

function bindAuthGate() {
  bindLocationPicker();
  const accountTypeSelect = byId('accountTypeSelect');
  const companyFields = byId('companyRegistrationFields');
  const municipalityFields = byId('municipalityRegistrationFields');
  const syncAccountTypeFields = () => {
    if (!accountTypeSelect) return;
    if (companyFields) companyFields.hidden = accountTypeSelect.value !== 'company';
    if (municipalityFields) municipalityFields.hidden = accountTypeSelect.value !== 'municipality';
    companyFields?.querySelectorAll('input').forEach(input => {
      input.required = accountTypeSelect.value === 'company' && input.name === 'companyName';
    });
    municipalityFields?.querySelectorAll('input').forEach(input => {
      input.required = accountTypeSelect.value === 'municipality' && input.name === 'municipalityDepartment';
    });
  };
  accountTypeSelect?.addEventListener('change', syncAccountTypeFields);
  syncAccountTypeFields();
  document.querySelectorAll('[data-auth-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      authMode = btn.dataset.authMode;
      render();
    });
  });
  byId('authForm')?.addEventListener('submit', handleAuthSubmit);
  byId('resetEmailPassword')?.addEventListener('click',()=>runAsyncAction(resetFirebaseEmailPassword));
}

function bindCurrentRoute() {
  v462BindDashboardBackground();
  bindV41Settings();
  bindHubControls();
  bindV46Features();
  byId('main')?.querySelectorAll('[data-community-route]').forEach(btn=>btn.addEventListener('click',()=>setRoute(btn.dataset.communityRoute)));
  document.querySelectorAll('[data-community-action="new-event"]').forEach(btn=>btn.addEventListener('click',openCommunityEventModal));
  document.querySelectorAll('[data-community-action="review-event"]').forEach(btn=>btn.addEventListener('click',()=>runAsyncAction(()=>decideCommunityEvent(btn.dataset.id,btn.dataset.decision))));
  // Standalone mark-read buttons intentionally removed in version 4.7.
  document.querySelectorAll('[data-community-action="open-inbox"]').forEach(btn=>btn.addEventListener('click',()=>runAsyncAction(()=>openInboxItem(btn.dataset.key,btn.dataset.route))));
  document.querySelectorAll('[data-community-action="review-help"]').forEach(btn=>btn.addEventListener('click',()=>openCommunityReviewModal(btn.dataset.id)));
  document.querySelectorAll('[data-community-action="reload"]').forEach(btn=>btn.addEventListener('click',()=>runAsyncAction(loadCommunityFeatures)));

  document.querySelectorAll('[data-route]').forEach(el => {
    if (el.dataset.routeBound === 'true') return;
    el.dataset.routeBound = 'true';
    el.addEventListener('click', () => setRoute(el.dataset.route));
    el.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') setRoute(el.dataset.route); });
  });
  bindDashboardControls();
  document.querySelectorAll('[data-action="v2-interest"]').forEach(btn=>btn.addEventListener('click',()=>{
    const prefs=readPreferences(authState.user?.uid);
    const category=btn.dataset.value;
    const categories=prefs.categories.includes(category) ? prefs.categories.filter(v=>v!==category) : [...prefs.categories,category];
    updatePreferences(authState.user?.uid,{categories});render();
  }));
  document.querySelectorAll('[data-action="v2-type"]').forEach(btn=>btn.addEventListener('click',()=>{
    state.filter.type=btn.dataset.value;saveState();render();
  }));
  document.querySelectorAll('[data-action="v2-category"]').forEach(btn=>btn.addEventListener('click',()=>{
    state.filter.category=btn.dataset.value;saveState();render();
  }));
  document.querySelectorAll('[data-action="new-request"]').forEach(btn => {if(btn.dataset.actionBound==='true')return;btn.dataset.actionBound='true';btn.addEventListener('click', () => newRequestModal());});
  document.querySelectorAll('[data-action="new-need"]').forEach(btn => btn.addEventListener('click', () => newRequestModal('Suche')));
  document.querySelectorAll('[data-action="new-offer"]').forEach(btn => btn.addEventListener('click', () => newRequestModal('Biete')));
  document.querySelectorAll('[data-action="reply"]').forEach(btn => btn.addEventListener('click', () => chatModal(btn.dataset.id)));
  document.querySelectorAll('[data-action="open-chat"]').forEach(btn => btn.addEventListener('click', () => chatModal(btn.dataset.id)));
  document.querySelectorAll('[data-action="edit-request"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => editRequestModal(btn.dataset.id))));
  document.querySelectorAll('[data-action="open-private-chat"]').forEach(btn => btn.addEventListener('click', () => {
    runAsyncAction(async () => {
      const chat = state.chats.find(item => item.id === btn.dataset.chatId);
      if (!chat) throw new Error('Chat nicht gefunden. Bitte kurz aktualisieren.');
      chatModalForChat(await ensureChatDocument(chat));
    });
  }));
  document.querySelectorAll('[data-action="set-chat-view"]').forEach(btn => btn.addEventListener('click', () => {
    state.chatView = btn.dataset.chatView === 'trash' ? 'trash' : 'active';
    saveState();
    render();
  }));
  document.querySelectorAll('[data-action="toggle-chat-mute"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => toggleChatMute(btn.dataset.chatId))));
  document.querySelectorAll('[data-action="trash-chat"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => moveChatToTrash(btn.dataset.chatId))));
  document.querySelectorAll('[data-action="restore-chat"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => restoreChatFromTrash(btn.dataset.chatId))));
  document.querySelectorAll('[data-action="purge-chat"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => purgeChatForCurrentUser(btn.dataset.chatId))));
  document.querySelectorAll('[data-action="complete"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => completeRequest(btn.dataset.id))));
  document.querySelectorAll('[data-action="report"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => reportRequest(btn.dataset.id))));
  document.querySelectorAll('[data-action="raise-escalation"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => raiseRequestEscalation(btn.dataset.id))));
  document.querySelectorAll('[data-action="approve-request-publication"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => decideRequestPublication(btn.dataset.id, 'approve'))));
  document.querySelectorAll('[data-action="reject-request-publication"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => decideRequestPublication(btn.dataset.id, 'reject'))));
  document.querySelectorAll('[data-action="revise-request-publication"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => decideRequestPublication(btn.dataset.id, 'revise'))));
  document.querySelectorAll('[data-action="new-official-notice"]').forEach(btn => btn.addEventListener('click', newOfficialNoticeModal));
  document.querySelectorAll('[data-action="publish-notice"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => updateOfficialNoticeStatus(btn.dataset.id, 'online'))));
  document.querySelectorAll('[data-action="archive-notice"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => updateOfficialNoticeStatus(btn.dataset.id, 'archiviert'))));
  document.querySelectorAll('[data-action="onboarding-checklist"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => handleOnboardingChecklistAction(btn.dataset.step, btn.dataset.stepAction))));
  document.querySelectorAll('[data-action="reopen-onboarding"]').forEach(btn => btn.addEventListener('click', () => openOnboardingTour({ manual: true })));
  document.querySelectorAll('[data-action="focus-official-notices"]').forEach(btn => btn.addEventListener('click', () => {
    const target = byId('officialNoticesCard');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target?.focus({ preventScroll: true });
  }));
  document.querySelectorAll('[data-action="new-alert"]').forEach(btn => btn.addEventListener('click', newAlertModal));
  document.querySelectorAll('[data-action="generate-invite"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(generateInvite)));
  document.querySelectorAll('[data-action="cleanup-legacy-replies"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(cleanupLegacyPublicReplies)));
  document.querySelectorAll('[data-action="resolve-mod"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => resolveModeration(btn.dataset.id, false))));
  document.querySelectorAll('[data-action="escalate-mod"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => resolveModeration(btn.dataset.id, true))));
  document.querySelectorAll('[data-action="request-location-change"]').forEach(btn => btn.addEventListener('click', requestLocationChangeModal));
  document.querySelectorAll('[data-action="request-name-change"]').forEach(btn => btn.addEventListener('click', requestNameChangeModal));
  document.querySelectorAll('[data-action="request-verification"]').forEach(btn => btn.addEventListener('click', requestVerificationModal));
  document.querySelectorAll('[data-action="approve-location"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => approveLocationRequest(btn.dataset.id, true))));
  document.querySelectorAll('[data-action="reject-location"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => approveLocationRequest(btn.dataset.id, false))));
  document.querySelectorAll('[data-action="approve-verification"]').forEach(btn => btn.addEventListener('click', () => handleVerificationDecisionClick(btn, true)));
  document.querySelectorAll('[data-action="reject-verification"]').forEach(btn => btn.addEventListener('click', () => handleVerificationDecisionClick(btn, false)));
  document.querySelectorAll('[data-action="view-verification-photo"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => openVerificationPhotoModal(btn.dataset.id))));
  document.querySelectorAll('[data-action="pause-verification"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => setVerificationRequestQueueStatus(btn.dataset.id, 'zurückgestellt'))));
  document.querySelectorAll('[data-action="resume-verification"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => setVerificationRequestQueueStatus(btn.dataset.id, 'offen'))));
  document.querySelectorAll('[data-action="edit-verification"]').forEach(btn => btn.addEventListener('click', () => editVerificationRequestModal(btn.dataset.id)));
  document.querySelectorAll('[data-action="approve-change-request"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => updateChangeRequestStatus(btn.dataset.id, 'freigegeben'))));
  document.querySelectorAll('[data-action="review-change-request"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => updateChangeRequestStatus(btn.dataset.id, 'in_pruefung'))));
  document.querySelectorAll('[data-action="reject-change-request"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => updateChangeRequestStatus(btn.dataset.id, 'abgelehnt'))));
  document.querySelectorAll('[data-action="enable-notifications"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(enableNotifications)));
  document.querySelectorAll('[data-action="test-notification"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(sendNotificationTest)));
  document.querySelectorAll('[data-action="push-diagnostics"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(openPushDiagnosticsModal)));
  document.querySelectorAll('[data-action="add-notification-keyword"]').forEach(btn => btn.addEventListener('click', () => openNotificationKeywordModal()));
  document.querySelectorAll('[data-action="edit-notification-keyword"]').forEach(btn => btn.addEventListener('click', () => openNotificationKeywordModal(btn.dataset.id)));
  document.querySelectorAll('[data-action="toggle-notification-keyword"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => toggleNotificationKeyword(btn.dataset.id))));
  document.querySelectorAll('[data-action="delete-notification-keyword"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => deleteNotificationKeyword(btn.dataset.id))));
  document.querySelectorAll('[data-action="save-bulletin-filter"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(saveCurrentBulletinFilter)));
  document.querySelectorAll('[data-action="load-bulletin-filter"]').forEach(btn => btn.addEventListener('click', loadSavedBulletinFilter));
  document.querySelectorAll('[data-action="delete-bulletin-filter"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(deleteSavedBulletinFilter)));
  document.querySelectorAll('[data-action="translate-dynamic"]').forEach(btn => btn.addEventListener('click', () => {
    openDynamicTranslateModal(btn.dataset.translateKind || '', btn.dataset.translateId || '');
  }));
  document.querySelectorAll('[data-action="sync-now"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(async () => {
    await syncStateFromFirestore();
    render();
    toast('Nutzerdaten aktualisiert.');
  })));
  document.querySelectorAll('[data-action="mark-alert-read"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => markAlertRead(btn.dataset.id))));
  document.querySelectorAll('[data-action="passkey-check"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(passkeyCheck)));
  document.querySelectorAll('[data-action="export-own-data"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(exportOwnData)));
  document.querySelectorAll('[data-action="delete-own-account"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(deleteOwnAccountData)));
  document.querySelectorAll('[data-action="reset-local-data"]').forEach(btn => btn.addEventListener('click', resetLocalData));
  document.querySelectorAll('[data-action="toggle-edit-card"]').forEach(btn => btn.addEventListener('click', () => {
    const cardId = btn.dataset.editCardId || '';
    setEditCardOpen(cardId, !isEditCardOpen(cardId));
  }));
  document.querySelectorAll('[data-action="cancel-edit-card"]').forEach(btn => btn.addEventListener('click', () => {
    setEditCardOpen(btn.dataset.editCardId || '', false);
  }));
  document.querySelectorAll('[data-action="user-history"]').forEach(btn => btn.addEventListener('click', () => userHistoryModal(btn.dataset.uid)));
  document.querySelectorAll('[data-action="toggle-user-status"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => toggleUserAccountStatus(btn.dataset.uid))));
  document.querySelectorAll('[data-action="review-municipality"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => reviewMunicipalityAccount(btn.dataset.uid, btn.dataset.approved === 'true'))));
  document.querySelectorAll('[data-action="revoke-verification"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(() => revokeUserVerification(btn.dataset.uid))));
  document.querySelectorAll('[data-action="logout"]').forEach(btn => btn.addEventListener('click', () => runAsyncAction(signOutCurrentUser)));
  document.querySelectorAll('[data-action="set-admin-users-view"]').forEach(btn => btn.addEventListener('click', () => {
    const ui = adminUsersUiState();
    ui.view = btn.dataset.adminUsersView === 'archive' ? 'archive' : 'active';
    ui.page = 1;
    saveState();
    render();
  }));
  document.querySelectorAll('[data-action="admin-users-page"]').forEach(btn => btn.addEventListener('click', () => {
    const ui = adminUsersUiState();
    ui.page = Math.max(1, Number(btn.dataset.page || 1));
    saveState();
    render();
  }));

  const adminFilterBindings = [
    ['adminUserStatus', 'status', 'change'],
    ['adminUserRole', 'role', 'change'],
    ['adminUserAccountType', 'accountType', 'change'],
    ['adminUserVerification', 'verification', 'change'],
    ['adminUserCanton', 'canton', 'change'],
    ['adminUserSort', 'sort', 'change'],
    ['adminUserDir', 'dir', 'change'],
    ['adminUserPageSize', 'pageSize', 'change'],
    ['adminUserQ', 'q', 'input']
  ];
  adminFilterBindings.forEach(([id, key, eventName]) => {
    byId(id)?.addEventListener(eventName, (event) => {
      const ui = adminUsersUiState();
      ui[key] = key === 'pageSize' ? Number(event.target.value || 20) : event.target.value;
      ui.page = 1;
      saveState();
      render();
    });
  });

  const q = byId('filterQ');
  const category = byId('filterCategory');
  const type = byId('filterType');
  const distance = byId('filterDistance');
  q?.addEventListener('input', (event) => {
    const position=event.target.selectionStart;
    state.filter.q=event.target.value;saveState();
    const filtersOpen=Boolean(document.querySelector('.v2-filter-drawer')?.open);
    render();
    const input=byId('filterQ');
    if (input) {input.focus({preventScroll:true});try{input.setSelectionRange(position,position);}catch{}}
    const drawer=document.querySelector('.v2-filter-drawer'); if (drawer) drawer.open=filtersOpen;
  });
  category?.addEventListener('change', (event) => { state.filter.category = event.target.value; saveState(); render(); });
  type?.addEventListener('change', (event) => { state.filter.type = event.target.value; saveState(); render(); });
  distance?.addEventListener('change', (event) => {
    state.filter.distanceKm = event.target.value;
    saveState();
    if (parseDistanceFilterKm(state.filter.distanceKm) > 0) {
      void ensureViewerGeo({ silent: true }).then(() => render());
    }
    render();
  });
  byId('themeChoiceSelect')?.addEventListener('change', (event) => {
    setThemeChoice(event.target.value, { notify: true });
  });
  byId('localeChoiceSelect')?.addEventListener('change', (event) => {
    setLocale(event.target.value);
    syncCurrentUser({ locale: currentLocale() });
    if (isFirebaseMode()) {
      void updateFirebaseProfile({ locale: currentLocale() }).catch(error => reportBackgroundError('Sprache speichern', error, { notify: false, collection: FIRESTORE_COLLECTIONS.users }));
    }
    render();
    toast('Sprache gespeichert.');
  });

  const profileForm = byId('profileForm');
  profileForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const nextTitlePreset = normalizeTitlePresetForProfile(String(data.titlePreset || 'auto'), state.profile);
    state.profile = {
      ...state.profile,
      titleVisible: Boolean(data.titleVisible),
      titlePreset: nextTitlePreset
    };
    if (authState.user) {
      syncCurrentUser({
        titleVisible: state.profile.titleVisible,
        titlePreset: state.profile.titlePreset,
        locale: currentLocale()
      });
    }
    if (isFirebaseMode()) {
      await updateFirebaseProfile({
        titleVisible: state.profile.titleVisible,
        titlePreset: state.profile.titlePreset,
        locale: currentLocale()
      });
      await syncStateFromFirestore();
    }
    addChange(`Profil aktualisiert: ${state.profile.initials}`);
    editCards.delete('profile-identity');
    saveState();
    render();
    toast('Profil gespeichert.');
  });

  const notificationPreferencesForm = byId('notificationPreferencesForm');
  notificationPreferencesForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    runAsyncAction(() => saveNotificationPreferencesForm(form));
  });

  const adminRoleForm = byId('adminRoleForm');
  adminRoleForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    runAsyncAction(async () => {
      await updateUserRoleByEmail(String(data.email || ''), String(data.role || 'resident'), String(data.adminScopeArea || ''));
      editCards.delete('admin-roles');
      render();
    });
  });

  const areaPriorityForm = byId('areaPriorityForm');
  areaPriorityForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    runAsyncAction(() => updateAreaCategoryPriority(String(data.priorityRaw || '')));
  });

  scheduleSwissMapHydration();
}

byId('logoutButton')?.addEventListener('click', () => runAsyncAction(signOutCurrentUser));
byId('helpButton')?.addEventListener('click', () => openHelpModal());
document.querySelector('.v21-inbox-shortcut')?.addEventListener('click',()=>setRoute('inbox'));
byId('themeButton')?.addEventListener('click', cycleThemeChoice);
byId('headerRegisterButton')?.addEventListener('click', () => {
  authMode = 'register';
  render();
  byId('main')?.focus();
});
byId('headerLoginButton')?.addEventListener('click', () => {
  authMode = 'login';
  render();
  byId('main')?.focus();
});
document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const legalButton = event.target.closest('[data-action="open-legal"]');
  if (!legalButton) return;
  const section = legalButton.dataset.legal || 'privacy';
  openLegalModal(section);
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  toast('Quartinaut wurde installiert.');
  render();
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

window.addEventListener('online', render);
window.addEventListener('offline', render);
// Beim Zurückkehren in die App Ablaufzeiten (TTL) neu auswerten.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && authState.user) render();
});

window.addEventListener('load', () => { setupConnectivity(); void setupPwaUpdates(); });

applyTheme();
saveState();
render();
initAuth();
void initLocations()
  .then(() => {
    const editing=document.activeElement?.closest?.('#authForm');
    if (editing) {
      document.activeElement?.addEventListener('blur',()=>render(),{once:true});
    } else render();
  })
  .catch(() => {if(!document.activeElement?.closest?.('#authForm'))render();});
if (parseDistanceFilterKm(state.filter.distanceKm) > 0) {
  void ensureViewerGeo({ silent: true }).then(() => render());
}

// Quartinaut 4.0 – neue zentrale Auswahl; nutzt weiterhin die bestehenden Formulare.
document.addEventListener('click',event=>{
 if(!event.target.closest('[data-v4-create]'))return;
 event.preventDefault();
 openModal('Was möchtest du erstellen?',`<div class="v4-create-grid">
  <button type="button" data-v4-create-kind="need">🤝 <strong>Hilfe suchen</strong><small>Unterstützung anfragen</small></button>
  <button type="button" data-v4-create-kind="offer">💚 <strong>Hilfe anbieten</strong><small>Nachbarn unterstützen</small></button>
  <button type="button" data-v4-create-kind="lend">🧰 <strong>Etwas verleihen</strong><small>Leihbörse</small></button>
  <button type="button" data-v4-create-kind="market">🛍️ <strong>Etwas verkaufen</strong><small>Marktplatz</small></button>
  <button type="button" data-v4-create-kind="group">👥 <strong>Gruppe oder Verein</strong><small>Gemeinschaft</small></button>
  <button type="button" data-v4-create-kind="project">🌱 <strong>Quartierprojekt</strong><small>Freiwilligenaktion</small></button>
 </div>`,(modal,close)=>{
  modal.querySelectorAll('[data-v4-create-kind]').forEach(btn=>btn.addEventListener('click',()=>{
   const kind=btn.dataset.v4CreateKind;close();
   if(kind==='need'||kind==='offer'){
    setRoute('home');document.querySelector(`[data-action="${kind==='need'?'new-need':'new-offer'}"]`)?.click();
   }else{hubState.section=kind;setRoute('hub');if(!hubState.loaded)void loadHub();}
  }));
 });
});
