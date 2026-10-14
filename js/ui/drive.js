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
const TAG = "appProperties has { key='automater' and value='1' }";
const SESSION = 'automater:drive';

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

// BETA LOCAL: con ?demo en la URL se simula Google (ver drive-demo.js). Borrar antes de producción.
const DEMO = !CLIENT_ID && new URLSearchParams(location.search).has('demo');

async function requestToken(hint) {
  if (DEMO) await import('./drive-demo.js');
  else if (!CLIENT_ID) throw new Error('Falta configurar el Client ID de Google en js/ui/drive.js');
  await loadGIS();
  return new Promise((ok, fail) => {
    google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      hint,
      callback: r => (r.error ? fail(new Error(r.error_description || r.error)) : ok(r)),
      error_callback: e => fail(new Error(e.type === 'popup_closed' ? 'Se cerró la ventana de Google' : 'Google bloqueó la ventana de inicio de sesión'))
    }).requestAccessToken({ prompt: hint ? '' : 'select_account' });
  });
}

export const drive = {
  async driveLogin(hint) {
    const prev = session.get();
    const r = await requestToken(hint);
    const s = { token: r.access_token, exp: Date.now() + (r.expires_in - 60) * 1000 };
    session.set(s); // driveFetch lo necesita para pedir el usuario
    const { user } = await this.driveFetch(`${API}/about?fields=user(displayName,emailAddress)`);
    session.set({ ...s, user, folder: prev?.folder });
    return session.get();
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
    if (!s) return DEMO ? import('./drive-demo.js') : CLIENT_ID && loadGIS().catch(() => {});
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
