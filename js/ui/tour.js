// Recorrido guiado por la página: un foco recortado sobre cada parte de la UI y
// una tarjeta con la explicación. Los textos cambian según se use con mouse
// ('desktop') o con el dedo ('touch'); la ubicación de la tarjeta, según el ancho.

// Cada paso: `target` (selector o lista de selectores, null = centrado),
// `when(type)` opcional para pasos de un solo tipo, y `text` como string o
// función (device, type) → string.
const STEPS = [
  {
    target: null,
    title: 'Bienvenido a Automater Pro',
    text: d => d === 'touch'
      ? 'Aquí puedes dibujar autómatas y probarlos con cadenas. Toca Siguiente para avanzar; puedes salir cuando quieras con la ✕.'
      : 'Aquí puedes dibujar autómatas y probarlos con cadenas. Avanza con Siguiente o con las flechas del teclado; Esc sale del recorrido.'
  },
  {
    target: '.type-toggle',
    title: 'Elige el tipo de máquina',
    text: 'Autómata finito (AF, determinístico o no), autómata de pila (APD) o Máquina de Turing (MT). Cada tipo guarda su propio trabajo: si cambias y vuelves, sigue ahí.'
  },
  {
    target: '.canvas-area',
    title: 'Moverte por el tablero',
    text: d => d === 'touch'
      ? 'Arrastra un dedo sobre una zona vacía para desplazar el tablero (con la herramienta Seleccionar activa). Para acercar o alejar usa los botones de zoom.'
      : 'Gira la rueda del mouse para acercar o alejar desde donde apuntas. Para desplazar el tablero, mantén apretado el botón derecho y arrastra.'
  },
  {
    target: '.zoom-controls',
    title: 'Zoom y encuadre',
    text: d => (d === 'touch' ? 'Toca' : 'Usa') + ' la lupa con + o − para acercar o alejar. La casita encuadra todo el autómata en pantalla si te pierdes.'
  },
  {
    target: '.tool-btn[data-mode="select"]',
    title: 'Seleccionar y mover',
    text: d => d === 'touch'
      ? 'Con esta herramienta, toca un estado para seleccionarlo y arrástralo con el dedo para acomodarlo.'
      : 'Con esta herramienta, haz clic en un estado para seleccionarlo y arrástralo para acomodarlo.'
  },
  {
    target: '.tool-btn[data-mode="add"]',
    title: 'Agregar estados',
    text: d => {
      const tap = d === 'touch' ? 'Toca' : 'Haz clic en';
      return `${tap} un lugar vacío del tablero para crear un estado (q0, q1…). El primero que crees es el inicial. ${tap} un estado existente para marcarlo como final o desmarcarlo.`;
    }
  },
  {
    target: '.tool-btn[data-mode="connect"]',
    title: 'Crear transiciones',
    text: (d, type) => {
      const tap = d === 'touch' ? 'Toca' : 'Haz clic en';
      const what = {
        afd: 'el símbolo que se lee (si un estado tiene dos destinos con el mismo símbolo, queda un AFND)',
        apd: 'el símbolo de entrada (o ε), el tope de pila y con qué se reemplaza',
        mt: 'qué lee, qué escribe y hacia dónde se mueve cada cinta (I, D o N)'
      }[type];
      return `${tap} el estado de origen y después ${d === 'touch' ? '' : 'en '}el de destino (el mismo dos veces crea un bucle). Se abre una ventana para elegir ${what}.`;
    }
  },
  {
    target: '.tool-btn[data-mode="delete"]',
    title: 'Borrar',
    text: d => `${d === 'touch' ? 'Toca un estado o el' : 'Haz clic en un estado o en el'} rótulo de una transición para eliminarlo. Al borrar un estado se borran también sus transiciones.`
  },
  {
    target: '#alphabetSection',
    title: 'Alfabeto de entrada (Σ)',
    text: 'Escribe los símbolos separados por comas, por ejemplo: a, b. Son los que vas a poder elegir al crear transiciones.'
  },
  {
    target: '#stackSection',
    when: type => type === 'apd',
    title: 'Alfabeto de pila',
    text: 'P son los símbolos que puede tener la pila y Z₀ el que está en el fondo al arrancar. En las transiciones, ε significa no leer entrada o desapilar.'
  },
  {
    target: '#tapeSection',
    when: type => type === 'mt',
    title: 'Cintas',
    text: 'Agrega los símbolos auxiliares del alfabeto de cinta y elige cuántas cintas usa la máquina (de 1 a 4). B es el blanco. Si cambias la cantidad, se borran las transiciones hechas para otra.'
  },
  {
    target: '#statesSection',
    title: 'Estados',
    text: d => `Aquí están todos los estados. En cada uno, ▶ lo hace inicial, ◎ lo marca como final y el tacho lo elimina. ${d === 'touch' ? 'Desliza' : 'Desplaza'} el panel para ver el resto.`
  },
  {
    target: '#transSection',
    title: 'Transiciones (δ)',
    text: 'La lista de todas las transiciones con su rótulo. También puedes borrarlas desde aquí.'
  },
  {
    target: '#verifySection',
    title: 'Verificar una cadena',
    text: (d, type) => {
      const extra = { afd: '', apd: ' y cómo cambia la pila', mt: ' y las cintas moviéndose bajo el cabezal' }[type];
      const go = d === 'touch' ? 'toca Verificar' : 'presiona Verificar (o Enter)';
      return `Escribe la cadena y ${go}. Vas a ver el recorrido animado en el tablero, la traza paso a paso${extra}, y si se acepta o se rechaza.`;
    }
  },
  {
    target: '#btnTools',
    title: 'Herramientas para los TPs',
    text: 'Probar muchas cadenas de una vez, listar el lenguaje, sacar la definición formal y la tabla δ, pasar de AFND a AFD, minimizar, gramáticas y expresiones regulares, y dibujar un autómata a partir de su tabla.'
  },
  {
    target: '#btnFile',
    title: 'Archivo',
    text: 'Empezar de cero, cargar un ejemplo, abrir o guardar tu autómata, y exportar el diagrama como imagen (también con fondo blanco, para imprimir la entrega). Lo que haces se guarda solo en este navegador.'
  },
  {
    target: '#btnHelp',
    title: '¿Dudas o encontraste un error?',
    text: 'Desde Ayuda puedes repetir este recorrido o escribirme en la pestaña Contacto.'
  }
];

const PAD = 6;        // aire alrededor del elemento enfocado
const GAP = 14;       // distancia entre el foco y la tarjeta
const EDGE = 12;      // margen mínimo contra los bordes de la pantalla
const COMPACT = 640;  // por debajo de este ancho la tarjeta ocupa todo el ancho

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function unionRect(els) {
  const rects = els.map(el => el.getBoundingClientRect()).filter(r => r.width || r.height);
  if (!rects.length) return null;
  const left = Math.min(...rects.map(r => r.left));
  const top = Math.min(...rects.map(r => r.top));
  const right = Math.max(...rects.map(r => r.right));
  const bottom = Math.max(...rects.map(r => r.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

const visible = el => el && el.offsetParent !== null;

// Lleva el elemento a la vista dentro del panel (que tiene scroll propio).
// Solo el panel: scrollIntoView también correría el body, que tiene overflow oculto.
function scrollPanelTo(el) {
  const panel = el?.closest('.panel');
  if (!panel) return;
  const er = el.getBoundingClientRect();
  const pr = panel.getBoundingClientRect();
  if (er.top < pr.top || er.bottom > pr.bottom) panel.scrollTop += er.top - pr.top - 8;
}

function buildTourDOM() {
  const root = document.createElement('div');
  root.className = 'tour';
  root.innerHTML = `
    <div class="tour-spot"></div>
    <div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tourTitle" aria-describedby="tourText">
      <div class="tour-top">
        <ol class="tour-chain" aria-hidden="true"></ol>
        <button class="icon-btn tour-close" aria-label="Salir del tutorial">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <p class="tour-count" aria-live="polite"></p>
      <h4 id="tourTitle"></h4>
      <p id="tourText"></p>
      <div class="tour-actions">
        <button class="btn tour-prev">Anterior</button>
        <button class="btn btn-primary tour-next">Siguiente</button>
      </div>
    </div>`;
  document.body.appendChild(root);
  return root;
}

export const tour = {
  startTour(device) {
    if (this._tour) this.endTour();
    const type = this.state.automatonType;
    // Las herramientas/paneles se resetean para que lo enfocado sea lo que se explica
    if (this.state.mode !== 'select') this.setMode('select');

    const steps = STEPS.filter(s => !s.when || s.when(type));
    const root = buildTourDOM();
    const q = sel => root.querySelector(sel);

    const chain = q('.tour-chain');
    steps.forEach((_, i) => {
      const li = document.createElement('li');
      if (i === steps.length - 1) li.className = 'final';
      chain.appendChild(li);
    });

    this._tour = { root, steps, device, type, index: 0, card: q('.tour-card'), spot: q('.tour-spot') };
    if (reducedMotion()) root.classList.add('no-motion');

    q('.tour-close').addEventListener('click', () => this.endTour());
    q('.tour-prev').addEventListener('click', () => this.tourGo(-1));
    q('.tour-next').addEventListener('click', () => this.tourGo(1));
    // Un toque en el fondo no hace nada: el recorrido solo se cierra a propósito.

    this._tourKeys = e => {
      if (e.key === 'Escape') { e.stopPropagation(); this.endTour(); }
      else if (e.key === 'ArrowRight') this.tourGo(1);
      else if (e.key === 'ArrowLeft') this.tourGo(-1);
      else if (e.key === 'Tab') { // foco atrapado dentro de la tarjeta
        const focusables = [...this._tour.card.querySelectorAll('button:not([disabled])')];
        const i = focusables.indexOf(document.activeElement);
        const next = e.shiftKey ? (i <= 0 ? focusables.length - 1 : i - 1) : (i + 1) % focusables.length;
        e.preventDefault();
        focusables[next].focus();
      }
    };
    this._tourResize = () => this.placeTour();
    document.addEventListener('keydown', this._tourKeys, true);
    addEventListener('resize', this._tourResize);

    root.classList.add('intro');
    this.showTourStep();
    requestAnimationFrame(() => root.classList.remove('intro'));
  },

  tourGo(delta) {
    const t = this._tour;
    if (!t) return;
    const next = t.index + delta;
    if (next < 0) return;
    if (next >= t.steps.length) {
      this.endTour();
      this.showToast('Recorrido terminado. Puedes repetirlo desde Ayuda.', 'success');
      return;
    }
    t.index = next;
    this.showTourStep();
  },

  showTourStep() {
    const t = this._tour;
    const step = t.steps[t.index];
    const q = sel => t.root.querySelector(sel);
    const text = typeof step.text === 'function' ? step.text(t.device, t.type) : step.text;
    const last = t.index === t.steps.length - 1;

    q('#tourTitle').textContent = step.title;
    q('#tourText').textContent = text;
    q('.tour-count').textContent = `Paso ${t.index + 1} de ${t.steps.length}`;
    q('.tour-prev').disabled = t.index === 0;
    q('.tour-next').textContent = last ? 'Terminar' : 'Siguiente';
    [...q('.tour-chain').children].forEach((li, i) => {
      li.classList.toggle('done', i < t.index);
      li.classList.toggle('current', i === t.index);
    });

    const els = [].concat(step.target || []).map(sel => document.querySelector(sel)).filter(visible);
    scrollPanelTo(els[0]);
    t.els = els;

    t.card.classList.remove('enter');
    void t.card.offsetWidth; // reinicia la animación de entrada
    t.card.classList.add('enter');
    this.placeTour();
    q('.tour-next').focus({ preventScroll: true });
  },

  placeTour() {
    const t = this._tour;
    if (!t) return;
    const vw = innerWidth;
    const vh = innerHeight;
    const r = t.els.length ? unionRect(t.els) : null;
    const { spot, card } = t;

    if (r) {
      const left = clamp(r.left - PAD, 2, vw - 2);
      const top = clamp(r.top - PAD, 2, vh - 2);
      const right = clamp(r.right + PAD, 2, vw - 2);
      const bottom = clamp(r.bottom + PAD, 2, vh - 2);
      Object.assign(spot.style, { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` });
      spot.classList.remove('empty');
    } else {
      Object.assign(spot.style, { left: `${vw / 2}px`, top: `${vh / 2}px`, width: '0px', height: '0px' });
      spot.classList.add('empty');
    }

    const compact = vw <= COMPACT;
    card.classList.toggle('compact', compact);
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    let x, y;

    if (!r) {
      x = (vw - cw) / 2;
      y = (vh - ch) / 2;
    } else if (compact) {
      // Ancho completo, arriba o abajo del foco según dónde haya más lugar
      x = EDGE;
      const below = vh - r.bottom;
      y = below >= r.top
        ? clamp(r.bottom + PAD + GAP, EDGE, vh - ch - EDGE)
        : clamp(r.top - PAD - GAP - ch, EDGE, vh - ch - EDGE);
    } else {
      const cx = r.left + r.width / 2 - cw / 2;
      const cy = r.top + r.height / 2 - ch / 2;
      const options = [
        [cx, r.bottom + PAD + GAP],          // abajo
        [r.right + PAD + GAP, cy],           // derecha
        [r.left - PAD - GAP - cw, cy],       // izquierda
        [cx, r.top - PAD - GAP - ch]         // arriba
      ];
      const fits = ([ox, oy]) => ox >= EDGE && oy >= EDGE && ox + cw <= vw - EDGE && oy + ch <= vh - EDGE;
      // Primero sin correr la tarjeta; si nada entra, la corremos dentro de la pantalla
      const choice = options.find(fits) || options.map(([ox, oy]) => [
        clamp(ox, EDGE, vw - cw - EDGE), clamp(oy, EDGE, vh - ch - EDGE)
      ]).find(([ox, oy]) => ox + cw <= r.left - PAD || ox >= r.right + PAD || oy + ch <= r.top - PAD || oy >= r.bottom + PAD);
      [x, y] = choice || [(vw - cw) / 2, vh - ch - EDGE]; // foco gigante: abajo al centro
    }
    card.style.left = `${Math.round(x)}px`;
    card.style.top = `${Math.round(y)}px`;
  },

  endTour() {
    const t = this._tour;
    if (!t) return;
    document.removeEventListener('keydown', this._tourKeys, true);
    removeEventListener('resize', this._tourResize);
    t.root.remove();
    this._tour = null;
    document.getElementById('btnHelp').focus({ preventScroll: true });
  }
};
