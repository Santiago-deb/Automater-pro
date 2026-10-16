// Google Drive: iniciar sesión con Google y guardar/abrir autómatas en una
// carpeta "Automater Pro" del Drive del usuario. Sin backend: el navegador habla
// directo con Google. Se pide solo el permiso drive.file, así que la app ve
// únicamente los archivos que ella misma creó (no el resto del Drive).
import { validAutomaton } from './files.js';

// OAuth Client ID de Google Cloud, tipo "Aplicación web" (es público, no es un secreto).
const CLIENT_ID = '966670316238-q883sd6gakuifo35jsom5otoqf0h5e3m.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TAG = "appProperties has { key='automater' and value='1' }";
const SESSION = 'automater:drive';
const STATE = 'automater:oauth-state';

const $ = id => document.getElementById(id);
const q = s => encodeURIComponent(s);

// ponytail: el token (dura 1 h) va en sessionStorage, así sobrevive a recargar la
// pestaña; al vencer se vuelve a pedir con un clic. Refresh tokens requieren backend.
const session = {
  get() { try { return JSON.parse(sessionStorage.getItem(SESSION)); } catch { return null; } },
  set(v) { try { v ? sessionStorage.setItem(SESSION, JSON.stringify(v)) : sessionStorage.removeItem(SESSION); } catch { /* sin sesión */ } }
};

let gisLoading;
function loadGIS() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gisLoading ??= new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = ok;
    s.onerror = () => { gisLoading = null; fail(new Error('No se pudo cargar el inicio de sesión de Google')); };
    document.head.append(s);
  });
  return gisLoading;
}

// Si el navegador no deja abrir la ventana, se inicia sesión saliendo a Google
// y volviendo (ver redirectLogin / driveResume).
class PopupBlocked extends Error {}

async function requestToken(hint) {
  if (!CLIENT_ID) throw new Error('Falta configurar el Client ID de Google en js/ui/drive.js');
  // La ventana tiene que abrirse cerca del clic: con el script ya precargado
  // (renderDrive) no se espera nada antes de abrirla.
  if (!window.google?.accounts?.oauth2) await loadGIS();
  return new Promise((ok, fail) => {
    google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      hint,
      callback: r => (r.error ? fail(new Error(r.error_description || r.error)) : ok(r)),
      error_callback: e => fail(e.type === 'popup_closed' ? new Error('Se cerró la ventana de Google')
        : e.type === 'popup_failed_to_open' ? new PopupBlocked()
        : new Error(`Google no pudo iniciar sesión (${e.type ?? 'error desconocido'})`))
    }).requestAccessToken({ prompt: hint ? '' : 'select_account' });
  });
}

// Inicio de sesión sin ventana emergente: la página va a Google y vuelve con el
// token en el fragmento (#access_token=…). El tablero se guarda antes de salir.
function redirectLogin(hint) {
  const state = crypto.randomUUID();
  try { sessionStorage.setItem(STATE, state); } catch { /* sin sessionStorage no se puede validar la vuelta */ }
  const params = new URLSearchParams({
    client_id: CLIENT_ID, redirect_uri: location.origin + location.pathname, response_type: 'token',
    scope: SCOPE, state, include_granted_scopes: 'true', ...(hint ? { login_hint: hint } : { prompt: 'select_account' })
  });
  location.assign(`${AUTH}?${params}`);
}

export const drive = {
  async driveLogin(hint) {
    const prev = session.get();
    let r;
    try {
      r = await requestToken(hint);
    } catch (e) {
      if (!(e instanceof PopupBlocked)) throw e;
      this.saveNow();
      redirectLogin(hint);
      return new Promise(() => {}); // la página se va a Google
    }
    return this.driveStart(r.access_token, r.expires_in, prev?.folder);
  },

  async driveStart(token, expiresIn, folder) {
    const s = { token, exp: Date.now() + (expiresIn - 60) * 1000 };
    session.set(s); // driveFetch lo necesita para pedir el usuario
    const { user } = await this.driveFetch(`${API}/about?fields=user(displayName,emailAddress)`);
    session.set({ ...s, user, folder });
    return session.get();
  },

  // Al cargar la página: si se vuelve de iniciar sesión en Google, toma el token
  // del fragmento de la URL (y lo borra de la barra de direcciones).
  async driveResume() {
    const p = new URLSearchParams(location.hash.slice(1));
    if (!p.has('access_token') && !p.has('error')) return;
    let expected = null;
    try { expected = sessionStorage.getItem(STATE); sessionStorage.removeItem(STATE); } catch { /* sin estado guardado */ }
    history.replaceState(null, '', location.pathname + location.search);
    if (!expected || p.get('state') !== expected) return;
    if (p.has('error')) return this.showToast(p.get('error') === 'access_denied' ? 'Cancelaste el inicio de sesión con Google' : `Google no pudo iniciar sesión (${p.get('error')})`, 'error');
    try {
      const s = await this.driveStart(p.get('access_token'), Number(p.get('expires_in')) || 3600, session.get()?.folder);
      this.showToast(`Sesión iniciada como ${s.user.emailAddress}`, 'success');
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  },

  driveLogout() {
    const s = session.get();
    if (s && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(s.token, () => {});
    session.set(null);
    this._driveFile = null;
    this.renderDrive();
    this.showToast('Sesión de Google cerrada', 'success');
  },

  async driveFetch(url, opts = {}) {
    let s = session.get();
    if (s && s.exp < Date.now()) s = await this.driveLogin(s.user?.emailAddress);
    if (!s) throw new Error('Inicia sesión con Google');
    const res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${s.token}`, ...opts.headers } });
    if (res.status === 401) { session.set(null); this.renderDrive(); throw new Error('La sesión de Google venció: vuelve a iniciarla'); }
    if (!res.ok) throw new Error(`Google Drive respondió con un error (${res.status})`);
    return res.status === 204 ? null : res.json();
  },

  // Carpeta "Automater Pro" en la raíz del Drive (se crea la primera vez)
  async driveFolder() {
    const s = session.get();
    if (s.folder) return s.folder;
    const found = await this.driveFetch(`${API}/files?fields=files(id)&q=${q(`mimeType='application/vnd.google-apps.folder' and ${TAG} and trashed=false`)}`);
    const folder = found.files[0] ?? await this.driveFetch(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Automater Pro', mimeType: 'application/vnd.google-apps.folder', appProperties: { automater: '1' } })
    });
    session.set({ ...session.get(), folder: folder.id });
    return folder.id;
  },

  async driveSave() {
    const current = this._driveFile;
    const name = prompt('Nombre del autómata en tu Drive:', current?.name ?? `Autómata ${this.state.automatonType.toUpperCase()}`)?.trim();
    if (!name) return;
    const json = JSON.stringify(this.serialize(), null, 2);
    const fields = 'id,name';
    let file;
    if (current && current.name === name) {
      // Mismo nombre que el abierto desde Drive: se sobrescribe ese archivo
      file = await this.driveFetch(`${UPLOAD}/${current.id}?uploadType=media&fields=${fields}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: json
      });
    } else {
      const meta = { name, mimeType: 'application/json', parents: [await this.driveFolder()],
        appProperties: { automater: '1', type: this.state.automatonType } };
      const body = new FormData();
      body.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
      body.append('file', new Blob([json], { type: 'application/json' }));
      file = await this.driveFetch(`${UPLOAD}?uploadType=multipart&fields=${fields}`, { method: 'POST', body });
    }
    this._driveFile = file;
    this.showToast(`"${file.name}" guardado en tu Drive`, 'success');
  },

  async driveOpen(file) {
    const data = await this.driveFetch(`${API}/files/${file.id}?alt=media`).catch(() => null);
    if (!validAutomaton(data)) return this.showToast('Ese archivo de Drive no es un autómata válido', 'error');
    this.remember();
    this.applyAutomaton(data);
    this._driveFile = { id: file.id, name: file.name };
    this.toastWithUndo(`Se abrió "${file.name}" de tu Drive`);
  },

  // Estado del bloque "Google Drive" del menú y lista "Mis autómatas"
  async renderDrive() {
    const s = session.get();
    $('driveLogin').hidden = !!s;
    $('driveUser').hidden = !s;
    // Se precarga el script de Google al abrir el menú: así el clic en "Iniciar
    // sesión" abre la ventana enseguida y el navegador no la bloquea.
    if (!s) return loadGIS().catch(() => {});
    $('driveUserName').textContent = s.user?.emailAddress ?? '';
    const list = $('driveList');
    list.replaceChildren(Object.assign(document.createElement('p'), { className: 'menu-note', textContent: 'Cargando…' }));
    try {
      // ponytail: los 30 más recientes; paginar si alguien junta más
      const { files } = await this.driveFetch(`${API}/files?pageSize=30&orderBy=modifiedTime desc` +
        `&fields=files(id,name,modifiedTime,appProperties)&q=${q(`${TAG} and mimeType='application/json' and trashed=false`)}`);
      if (!files.length) {
        list.firstChild.textContent = 'Todavía no guardaste autómatas en tu Drive.';
        return;
      }
      list.replaceChildren(...files.map(f => {
        const b = document.createElement('button');
        b.setAttribute('role', 'menuitem');
        b.textContent = f.name;
        const small = document.createElement('small');
        small.textContent = `${(f.appProperties?.type ?? '').toUpperCase()} · ${new Date(f.modifiedTime).toLocaleDateString('es-AR')}`;
        b.append(small);
        b.addEventListener('click', () => { this.closeFileMenu(); this.driveOpen(f); });
        return b;
      }));
    } catch (e) {
      list.firstChild.textContent = e.message;
    }
  }
};
