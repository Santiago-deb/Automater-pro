# 🤖 Automater Pro

**Automater Pro** es un verificador y simulador visual interactivo de Autómatas Finitos Deterministas (AFD), Autómatas de Pila Deterministas (APD) y Máquinas de Turing determinísticas de k cintas (MT). Diseñado con una interfaz moderna, intuitiva y completamente responsive, permite construir autómatas desde cero o cargar ejemplos predefinidos para ver su ejecución paso a paso.


## ✨ Características Principales

- **Tres modos**: AFD (Autómatas Finitos), APD (Autómatas de Pila) y MT (Máquinas de Turing).
- **Lienzo Interactivo (SVG)**: 
  - Agrega, mueve y conecta estados fácilmente.
  - Soporte para bucles y aristas bidireccionales sin superposiciones.
- **Configuración Completa**:
  - Definición del alfabeto de entrada (Σ) y alfabeto de pila (P).
  - Configuración de estado inicial y estados finales.
  - Símbolo inicial de pila (Z₀) para APDs.
- **Transiciones Avanzadas (APD)**:
  - Soporte para transiciones con ε (no consumen entrada).
  - Reemplazo de pila (apilar, desapilar o mantener el tope).
  - Detección de conflictos de determinismo.
  - Funcionalidad de Traductor (salida opcional por transición).
- **Simulación Paso a Paso**:
  - Animación visual del recorrido de la cadena por el autómata.
  - Visualización en tiempo real del estado de la **Pila** (tope, fondo y Z₀).
  - Trazado de la ruta de ejecución.
- **Máquinas de Turing (MT)**:
  - De 1 a 4 cintas; la entrada va en la cinta 1 y las demás arrancan en blanco (`B`).
  - Alfabeto de cinta C = Σ ∪ {B} ∪ auxiliares, movimientos `I` / `D` / `N`.
  - Rótulos con la notación de la cursada: `a,B/<a,D><X,D>`.
  - Animación de las cintas: la tira se desliza bajo la cabeza de lectura/escritura, la celda escrita destella y se muestra la configuración α₁ eᵢ α₂.
  - Detecta no determinismo, movimientos a izquierda de la celda de inicio y MT que no se detienen (corte a los 1000 pasos).
- **Menú Archivo** (botón *Archivo* del header):
  - Nuevo tablero, abrir y guardar el autómata como `.json`.
  - *Compartir…*: en el celular abre el menú del sistema para mandar el `.json` por cualquier app (en Chrome de Android va como `.txt`; *Abrir archivo* acepta los dos). Si el navegador no puede compartir archivos, lo descarga.
  - *Iniciar sesión con Google*: guarda los autómatas en una carpeta "Automater Pro" del Drive del usuario y los lista en *Mis autómatas*. Sin backend: login con Google Identity Services y API de Drive desde el navegador, con el permiso `drive.file` (la app solo ve los archivos que creó). El Client ID está en `js/ui/drive.js`; sus orígenes autorizados se configuran en Google Cloud (proyecto "Automater-Pro").
  - Exportar el diagrama como PNG (como se ve o con fondo blanco para imprimir).
  - Autoguardado en el navegador, separado por tipo: al volver a la página o cambiar de tipo, sigue lo último que había.
  - *Deshacer* en el aviso al limpiar, cargar el ejemplo o abrir un archivo.
- **Ayuda integrada** (botón *Ayuda* del header):
  - **Tutorial**: recorrido guiado por toda la página (tablero, herramientas, alfabetos, estados, transiciones y verificación). Detecta si se usa con mouse o con pantalla táctil y explica los gestos de cada uno; los textos se adaptan al tipo de autómata abierto.
  - **Contacto**: formulario (correo, motivo y mensaje de hasta 600 caracteres). Lo recibe la función serverless `api/contact.js`, que limita los envíos por IP (3 por hora y 10 por día, más un tope global de 60 por día) y lo reenvía por mail con [FormSubmit](https://formsubmit.co). El destino no aparece en el código de la página.
    - Para que el límite sea compartido entre instancias, conecta una base **Upstash Redis** al proyecto en Vercel (Storage → Upstash, plan gratis). Sin ella, el límite vive en la memoria de cada instancia.
    - Opcional: variable `FORMSUBMIT_TARGET` con el código aleatorio que da FormSubmit al activar el formulario, para no usar el correo.
- **100% Responsive**: Diseñado con un layout adaptable para funcionar perfectamente en computadoras de escritorio, tablets y teléfonos móviles.

## 🚀 Cómo usarlo

Está online en Vercel (se deploya solo con cada push a `main`). Para correrlo local no hace falta instalar nada, pero como usa ES modules hay que servirlo por HTTP (abrir `index.html` con doble clic no carga los módulos):

```bash
python3 -m http.server 8000   # y abrir http://localhost:8000
```

Con ese servidor el formulario de contacto no funciona (no corre `api/`); para probarlo hace falta `vercel dev` o un deploy de preview.

Tests del motor de simulación (sin dependencias): `node tests/engine.test.mjs`

### Guía rápida:
1. **Configurar Alfabetos**: En el panel lateral, define los símbolos de entrada (y de pila si es APD).
2. **Agregar Estados**: Selecciona la herramienta "+" en la barra izquierda y haz clic en el lienzo. El primer estado será el inicial.
3. **Marcar Finales**: Haz clic sobre un estado con la herramienta "+" para alternar si es estado final (doble círculo).
4. **Conectar**: Selecciona la herramienta de conexión (flecha), haz clic en el estado origen y luego en el destino. Se abrirá un modal para configurar la transición.
5. **Probar**: Escribe una cadena en el campo de verificación y presiona **Verificar** para ver la animación.

## 🗂️ Estructura del código

```
index.html            Solo el markup (HTML + SVG del lienzo y modales)
css/
  base.css            Variables de color, reset y body
  layout.css          Grilla de la app, header y botones
  canvas.css          Lienzo, toolbar, estados y aristas SVG
  panel.css           Panel lateral: listas, prueba, traza y pila
  modals.css          Modales y toast
  help.css            Modal de ayuda, contacto y recorrido guiado
  files.css           Menú Archivo y toast con Deshacer
  responsive.css      Breakpoints mobile
js/
  main.js             Punto de entrada: arma `App` y conecta los eventos
  state.js            Forma del estado global
  actions.js          Editar el autómata, verificar cadenas, cargar ejemplos
  engine/             Lógica pura, sin DOM (testeable con node)
    afd.js            simulateAFD()
    apd.js            simulateAPD(), findConflict(), apdLabel()
    mt.js             simulateMT(), findConflictMT(), mtLabel(), configuration()
    examples.js       Autómatas de ejemplo
    automata.js       Registro de tipos: simulate + label + example por tipo
  ui/
    interaction.js    Pan, zoom, arrastre y clics en el lienzo
    canvas.js         Dibujo SVG de estados y aristas
    panel.js          Listas, traza, pila visual, toasts
    modals.js         Modales para crear transiciones
    tape.js           Cintas animadas de la MT
    help.js           Modal de Ayuda y formulario de contacto
    tour.js           Recorrido guiado (pasos y posicionamiento)
    files.js          Menú Archivo: autoguardado, abrir/guardar/compartir .json, exportar PNG, deshacer
    drive.js          Login con Google y autómatas en Google Drive (Mis autómatas)
tests/engine.test.mjs Chequeos del motor
```

Para agregar un nuevo tipo de autómata (p. ej. AFND o ALA): un `simulateX()` en `js/engine/`, un ejemplo en `examples.js`, su entrada en `automata.js`, el color en `base.css` (`.tipo { --type: … }`) y su modal de transición en `ui/modals.js`.

## 🛠️ Tecnologías Utilizadas

- **HTML5**: Estructura semántica y SVG nativo para el lienzo gráfico.
- **CSS3**: Diseño con Grid, Flexbox, variables CSS (Custom Properties) y animaciones keyframes.
- **JavaScript (Vanilla JS, ES modules)**: Lógica de validación, manejo del DOM y animaciones sin frameworks ni build step.
- **Pointer Events API**: Para un manejo unificado de mouse y pantallas táctiles.

## 📚 Teoría de referencia

Este proyecto implementa las definiciones formales de la teoría de autómatas:
- **AFD**: $\delta: E \times A \to E$
- **APD**: $\delta: E \times (A \cup \{\varepsilon\}) \times P \to E \times P^*$
- **MT** (k cintas): $\delta: E \times C^k \to E \times (C \times \{I, D, N\})^k$, con $C = A \cup \{B\} \cup \text{Auxiliares}$. La cinta tiene celda de inicio y es infinita a derecha; acepta al llegar a un estado final y rechaza si se detiene (δ indefinida) en uno no final.
- Aceptación por **estado final** (no requiere pila vacía para APD).
- Validación estricta del determinismo (evita mezclar transiciones $\varepsilon$ y normales con el mismo tope de pila).

## 📄 Licencia

Este proyecto es de uso libre. Si te resulta útil para tus estudios o clases, ¡úsalo sin restricciones!

---
Hecho con 💚 para estudiantes de Sistemas.
```
