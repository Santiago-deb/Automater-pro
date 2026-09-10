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

No requiere instalación ni dependencias. Simplemente:

1. Descarga el archivo `index.html`.
2. Ábrelo con tu navegador web preferido (Chrome, Firefox, Edge, Safari).
3. ¡Listo! Puedes empezar a crear tu autómata o cargar un ejemplo con el botón **"Ejemplo"**.

### Guía rápida:
1. **Configurar Alfabetos**: En el panel lateral, define los símbolos de entrada (y de pila si es APD).
2. **Agregar Estados**: Selecciona la herramienta "+" en la barra izquierda y haz clic en el lienzo. El primer estado será el inicial.
3. **Marcar Finales**: Haz clic sobre un estado con la herramienta "+" para alternar si es estado final (doble círculo).
4. **Conectar**: Selecciona la herramienta de conexión (flecha), haz clic en el estado origen y luego en el destino. Se abrirá un modal para configurar la transición.
5. **Probar**: Escribe una cadena en el campo de verificación y presiona **Verificar** para ver la animación.

## 🛠️ Tecnologías Utilizadas

- **HTML5**: Estructura semántica y SVG nativo para el lienzo gráfico.
- **CSS3**: Diseño con Grid, Flexbox, variables CSS (Custom Properties) y animaciones keyframes.
- **JavaScript (Vanilla JS)**: Lógica de validación, manejo del DOM y animaciones sin frameworks pesados.
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
