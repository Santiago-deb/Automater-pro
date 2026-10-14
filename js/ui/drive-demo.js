// BETA LOCAL: simula el login de Google y la API de Drive en el navegador
// (archivos en localStorage) para probar la interfaz sin un Client ID real.
// Se carga solo con ?demo en la URL. Borrar este archivo antes de producción.
const KEY = 'automater:drive-demo';
const db = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? []; } catch { return []; } };
const save = files => localStorage.setItem(KEY, JSON.stringify(files));
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

window.google ??= { accounts: { oauth2: {
  initTokenClient: c => ({ requestAccessToken: () => setTimeout(() => c.callback({ access_token: 'demo', expires_in: 3600 }), 300) }),
  revoke: (t, cb) => cb()
} } };

const realFetch = window.fetch.bind(window);
window.fetch = async (url, o = {}) => {
  if (!String(url).includes('googleapis.com')) return realFetch(url, o);
  const u = new URL(url);
  const id = u.pathname.split('/').pop();
  const files = db();
  if (u.pathname.endsWith('/about')) return json({ user: { displayName: 'Usuario demo', emailAddress: 'demo@gmail.com' } });
  if (u.pathname === '/drive/v3/files' && o.method === 'POST') {
    const f = { id: crypto.randomUUID(), ...JSON.parse(o.body), modifiedTime: new Date().toISOString() };
    save([...files, f]);
    return json(f);
  }
  if (u.pathname === '/drive/v3/files') {
    const folders = u.searchParams.get('q').includes('folder');
    return json({ files: files.filter(f => folders === f.mimeType.includes('folder')).sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime)) });
  }
  if (u.pathname === '/upload/drive/v3/files') {
    const f = { id: crypto.randomUUID(), ...JSON.parse(await o.body.get('metadata').text()), content: await o.body.get('file').text(), modifiedTime: new Date().toISOString() };
    save([...files, f]);
    return json({ id: f.id, name: f.name });
  }
  const f = files.find(x => x.id === id);
  if (!f) return json({}, 404);
  if (u.pathname.startsWith('/upload/')) {
    Object.assign(f, { content: o.body, modifiedTime: new Date().toISOString() });
    save(files);
    return json({ id: f.id, name: f.name });
  }
  if (u.searchParams.get('alt') === 'media') return new Response(f.content);
  return json({}, 404);
};
