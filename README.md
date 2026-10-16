# 🤖 Automater Pro

**Automater Pro** es un verificador y simulador visual interactivo de Autómatas Finitos Deterministas (AFD), Autómatas de Pila Deterministas (APD) y Máquinas de Turing determinísticas de k cintas (MT). Diseñado con una interfaz moderna, intuitiva y completamente responsive, permite construir autómatas desde cero o cargar ejemplos predefinidos para ver su ejecución paso a paso.


## ✨ Características Principales

- **Tres modos**: AF (Autómatas Finitos, determinísticos o no), APD (Autómatas de Pila) y MT (Máquinas de Turing).
- **AFND**: en el modo AF un estado puede tener varios destinos con el mismo símbolo; la simulación sigue todos los caminos a la vez y el panel indica si es AFD o AFND.
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
- **Herramientas para los TPs** (botón *Herramientas*):
  - **Varias cadenas**: prueba una lista de cadenas y muestra si se aceptan, dónde se detiene, la traducción (APD) o las cintas finales (MT). Con `+`/`-` adelante se compara contra lo esperado.
  - **Explorar el lenguaje**: lista todas las cadenas aceptadas hasta cierta longitud, para los ejercicios de "determine el lenguaje".
  - **Definición formal**: tupla y tabla δ con la notación de la cátedra (en MT, una fila por transición con lo leído, el nuevo símbolo y el movimiento de cada cinta), para copiar como texto o como tabla para Word / Docs. En AF revisa δ incompleta (con opción de agregar estado trampa) y estados inalcanzables.
  - **AFND → AFD**: construcción de subconjuntos con las tablas δND y δD y el cálculo de cada celda.
  - **Minimizar AFD**: inalcanzables, muertos y particiones Π0, Π1… con la tabla de grupos de cada paso, como en clase.
  - **Gramática regular**: AF → gramática lineal a derecha (algoritmo de la cátedra) con derivaciones, y gramática → AF.
  - **Expresión regular**: pertenencia de cadenas, lenguaje hasta longitud n y AF equivalente (Glushkov), con la notación `+ . * λ ∅`.
  - **Desde una tabla δ**: dibuja un AF, APD o MT a partir de su tabla (escrita como tabla o como δ(…) = (…)).
- **Archivo**: autoguardado por tipo en el navegador, guardar/abrir `.json`, importar `.MT` de MTSolution (también MT compuestas con sub-máquinas `@alias`: se eligen la MT y sus módulos juntos), exportar el diagrama como PNG (también con fondo blanco para imprimir) o SVG, y *Deshacer* después de limpiar o reemplazar el tablero.
- **Ayuda integrada** (botón *Ayuda* del header):
  - **Tutorial**: recorrido guiado por toda la página (tablero, herramientas, alfabetos, estados, transiciones y verificación). Detecta si se usa con mouse o con pantalla táctil y explica los gestos de cada uno; los textos se adaptan al tipo de autómata abierto.
  - **Contacto**: formulario (correo, motivo y mensaje de hasta 600 caracteres) que llega por mail vía [FormSubmit](https://formsubmit.co), sin backend.
- **100% Responsive**: Diseñado con un layout adaptable para funcionar perfectamente en computadoras de escritorio, tablets y teléfonos móviles.

## 🚀 Cómo usarlo

Está online en Vercel (se deploya solo con cada push a `main`). Para correrlo local no hace falta instalar nada, pero como usa ES modules hay que servirlo por HTTP (abrir `index.html` con doble clic no carga los módulos):

```bash
python3 -m http.server 8000   # y abrir http://localhost:8000
```

Tests (sin dependencias): `node tests/engine.test.mjs && node tests/tools.test.mjs`.

### Guía rápida:
1. **Configurar Alfabetos**: En el panel lateral, define los símbolos de entrada (y de pila si es APD).
2. **Agregar Estados**: Selecciona la herramienta "+" en la barra izquierda y haz clic en el lienzo. El primer estado será el inicial.
3. **Opciones de un estado**: doble clic (o doble toque) sobre un estado abre su menú: renombrar, hacer inicial, marcar o quitar final, nueva transición desde ahí y eliminar.
4. **Seleccionar varios** (PC): con la flecha o con "+", arrastra sobre un lugar vacío para encerrar estados y aristas, o usa Shift + clic para sumar o quitar. Lo seleccionado se mueve junto y `Supr` lo borra. Un clic en el fondo deselecciona todo.
5. **Deshacer y rehacer**: `Ctrl + Z` y `Ctrl + Shift + Z` (o `Ctrl + Y`), o las flechas de la barra izquierda.
6. **Conectar**: Selecciona la herramienta de conexión (flecha), haz clic en el estado origen y luego en el destino. Se abrirá un modal para configurar la transición.
7. **Probar**: Escribe una cadena en el campo de verificación y presiona **Verificar** para ver la animación.

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
  tools.css           Herramientas, menú Archivo y toast con acción
  responsive.css      Breakpoints mobile
js/
  main.js             Punto de entrada: arma `App` y conecta los eventos
  state.js            Forma del estado global
  actions.js          Editar el autómata, verificar cadenas, cargar ejemplos
  engine/             Lógica pura, sin DOM (testeable con node)
    afd.js            simulateAFD()
    af.js             AFND, subconjuntos, minimización, layout automático
    regular.js        AF ↔ gramática regular, derivaciones, expresiones regulares
    table.js          Definición formal, tabla δ y carga desde tabla (AF/APD/MT)
    apd.js            simulateAPD(), findConflict(), apdLabel()
    mt.js             simulateMT(), findConflictMT(), mtLabel(), configuration()
    examples.js       Autómatas de ejemplo
    automata.js       Registro de tipos: simulate + label + example por tipo
  ui/
    interaction.js    Pan, zoom, arrastre, clics y selección múltiple en el lienzo
    history.js        Deshacer / rehacer (historial por tipo)
    stateMenu.js      Menú de un estado (doble clic)
    canvas.js         Dibujo SVG de estados y aristas
    panel.js          Listas, traza, pila visual, toasts
    modals.js         Modales para crear transiciones
    tape.js           Cintas animadas de la MT
    help.js           Modal de Ayuda y formulario de contacto
    tour.js           Recorrido guiado (pasos y posicionamiento)
    tools.js          Modal de herramientas (una vista por herramienta)
    files.js          Autoguardado, guardar/abrir, exportar imagen
tests/                Chequeos del motor y de las herramientas
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
