# 🤖 Automater Pro

**Automater Pro** es un verificador y simulador visual interactivo de Autómatas Finitos Deterministas (AFD) y Autómatas de Pila Deterministas (APD). Diseñado con una interfaz moderna, intuitiva y completamente responsive, permite construir autómatas desde cero o cargar ejemplos predefinidos para ver su ejecución paso a paso.


## ✨ Características Principales

- **Doble Modo**: Alternancia fluida entre simulación de AFD (Autómatas Finitos) y APD (Autómatas de Pila).
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
- **100% Responsive**: Diseñado con un layout adaptable para funcionar perfectamente en computadoras de escritorio, tablets y teléfonos móviles.

## 🚀 Cómo usarlo

Está online en Vercel (se deploya solo con cada push a `main`). Para correrlo local no hace falta instalar nada, pero como usa ES modules hay que servirlo por HTTP (abrir `index.html` con doble clic no carga los módulos):

```bash
python3 -m http.server 8000   # y abrir http://localhost:8000
```

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
  responsive.css      Breakpoints mobile
js/
  main.js             Punto de entrada: arma `App` y conecta los eventos
  state.js            Forma del estado global
  actions.js          Editar el autómata, verificar cadenas, cargar ejemplos
  engine/             Lógica pura, sin DOM (testeable con node)
    afd.js            simulateAFD()
    apd.js            simulateAPD(), findConflict(), apdLabel()
    examples.js       Autómatas de ejemplo
  ui/
    interaction.js    Pan, zoom, arrastre y clics en el lienzo
    canvas.js         Dibujo SVG de estados y aristas
    panel.js          Listas, traza, pila visual, toasts
    modals.js         Modales para crear transiciones
tests/engine.test.mjs Chequeos del motor
```

Para agregar un nuevo tipo de autómata (p. ej. AFND o Máquina de Turing): un `simulateX()` en `js/engine/`, un ejemplo en `examples.js`, y el caso en `verifyString()` de `actions.js`.

## 🛠️ Tecnologías Utilizadas

- **HTML5**: Estructura semántica y SVG nativo para el lienzo gráfico.
- **CSS3**: Diseño con Grid, Flexbox, variables CSS (Custom Properties) y animaciones keyframes.
- **JavaScript (Vanilla JS, ES modules)**: Lógica de validación, manejo del DOM y animaciones sin frameworks ni build step.
- **Pointer Events API**: Para un manejo unificado de mouse y pantallas táctiles.

## 📚 Teoría de referencia

Este proyecto implementa las definiciones formales de la teoría de autómatas:
- **AFD**: $\delta: E \times A \to E$
- **APD**: $\delta: E \times (A \cup \{\varepsilon\}) \times P \to E \times P^*$
- Aceptación por **estado final** (no requiere pila vacía para APD).
- Validación estricta del determinismo (evita mezclar transiciones $\varepsilon$ y normales con el mismo tope de pila).

## 📄 Licencia

Este proyecto es de uso libre. Si te resulta útil para tus estudios o clases, ¡úsalo sin restricciones!

---
Hecho con 💚 para estudiantes de Sistemas.
```
