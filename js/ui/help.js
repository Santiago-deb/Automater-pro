// Modal de Ayuda: pestaña Tutorial (lanza el recorrido de tour.js) y pestaña
// Contacto (formulario que va a /api/contact: limita envíos por IP y lo reenvía por mail).
const $ = id => document.getElementById(id);

// Función serverless (api/contact.js): el destino del mail no está en la página.
const CONTACT_URL = '/api/contact';
const MAX_MESSAGE = 600;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const TYPE_NAMES = { afd: 'AFD', apd: 'APD (pila)', mt: 'Máquina de Turing' };

// Táctil = sin hover y puntero grueso (celular/tablet). Decide los textos del
// recorrido; el layout lo resuelve el CSS por ancho.
export const detectDevice = () =>
  matchMedia('(hover: none) and (pointer: coarse)').matches ? 'touch' : 'desktop';

const DEVICE_HINT = {
  desktop: 'Detectamos mouse y teclado. Puedes avanzar con las flechas y salir con Esc.',
  touch: 'Detectamos una pantalla táctil: el recorrido explica los gestos con el dedo.'
};

export const help = {
  bindHelp() {
    this.tourDevice = detectDevice();
    this.setTourDevice(this.tourDevice, true);

    $('btnHelp').addEventListener('click', () => this.openHelp());
    $('helpClose').addEventListener('click', () => this.closeHelp());
    $('helpModal').addEventListener('click', e => { if (e.target.id === 'helpModal') this.closeHelp(); });

    const tabs = [$('tabTour'), $('tabContact')];
    tabs.forEach(tab => tab.addEventListener('click', () => this.showHelpTab(tab.id)));
    // Flechas entre pestañas (patrón ARIA de tabs)
    $('helpModal').querySelector('.help-tabs').addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const next = tabs[(tabs.indexOf(document.activeElement) + 1) % 2];
      this.showHelpTab(next.id);
      next.focus();
    });

    document.querySelectorAll('.seg-btn').forEach(btn =>
      btn.addEventListener('click', () => this.setTourDevice(btn.dataset.device)));
    $('btnStartTour').addEventListener('click', () => {
      this.closeHelp();
      this.startTour(this.tourDevice);
    });

    $('contactMessage').addEventListener('input', () => this.updateCharCount());
    // Al corregir un campo se borra el error que lo marcaba
    $('contactForm').addEventListener('input', e => {
      if (e.target.getAttribute('aria-invalid')) { e.target.removeAttribute('aria-invalid'); $('contactError').textContent = ''; }
    });
    $('contactForm').addEventListener('submit', e => { e.preventDefault(); this.sendContact(); });
    $('contactAgain').addEventListener('click', () => this.resetContact());
  },

  openHelp() {
    this._helpReturnFocus = document.activeElement;
    $('helpModal').classList.add('show');
    const active = $('helpModal').querySelector('.help-tab.active');
    active.focus();
  },

  closeHelp() {
    if (!$('helpModal').classList.contains('show')) return;
    $('helpModal').classList.remove('show');
    this._helpReturnFocus?.focus?.();
  },

  showHelpTab(tabId) {
    ['tabTour', 'tabContact'].forEach(id => {
      const on = id === tabId;
      const tab = $(id);
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-selected', on);
      tab.tabIndex = on ? 0 : -1;
      $(tab.getAttribute('aria-controls')).hidden = !on;
    });
  },

  setTourDevice(device, detected = false) {
    this.tourDevice = device;
    document.querySelectorAll('.seg-btn').forEach(btn => {
      const on = btn.dataset.device === device;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-checked', on);
    });
    if (detected) $('deviceHint').textContent = DEVICE_HINT[device];
  },

  updateCharCount() {
    const n = $('contactMessage').value.length;
    const count = $('contactCount');
    count.textContent = `${n} / ${MAX_MESSAGE}`;
    count.classList.toggle('near', n >= MAX_MESSAGE * 0.9);
  },

  contactError(msg, field) {
    $('contactError').textContent = msg;
    if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
  },

  async sendContact() {
    const email = $('contactEmail');
    const reason = $('contactReason');
    const message = $('contactMessage');
    [email, reason, message].forEach(f => f.removeAttribute('aria-invalid'));
    $('contactError').textContent = '';

    if (!EMAIL_RE.test(email.value.trim())) return this.contactError('Escribe un correo válido para poder responderte.', email);
    if (!reason.value.trim()) return this.contactError('Indica el motivo del mensaje.', reason);
    if (message.value.trim().length < 10) return this.contactError('El mensaje es muy corto: cuéntame un poco más (mínimo 10 caracteres).', message);

    const form = $('contactForm');
    const button = $('contactSubmit');
    button.disabled = true;
    button.textContent = 'Enviando…';

    const motivo = reason.value.trim();
    const payload = {
      email: email.value.trim(),
      motivo,
      mensaje: message.value.trim().slice(0, MAX_MESSAGE),
      automata: TYPE_NAMES[this.state.automatonType],
      dispositivo: `${detectDevice() === 'touch' ? 'Táctil' : 'Escritorio'} · ${innerWidth}×${innerHeight} · ${navigator.userAgent}`,
      _honey: form.elements._honey.value
    };

    try {
      const res = await fetch(CONTACT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      // Errores con explicación del servidor (límite alcanzado, datos inválidos): se muestran tal cual
      if (!res.ok || data.success !== true) {
        const field = { email, motivo: reason, mensaje: message }[data.field];
        return this.contactError(data.message || 'No se pudo enviar el mensaje. Vuelve a intentarlo más tarde.', field);
      }

      $('contactSentTo').textContent = payload.email;
      form.hidden = true;
      $('contactSent').hidden = false;
      form.reset();
      this.updateCharCount();
    } catch (err) {
      console.error('Contacto:', err);
      this.contactError('No se pudo enviar el mensaje. Revisa tu conexión y vuelve a intentarlo.');
    } finally {
      button.disabled = false;
      button.textContent = 'Enviar mensaje';
    }
  },

  resetContact() {
    $('contactSent').hidden = true;
    $('contactForm').hidden = false;
    $('contactEmail').focus();
  }
};
