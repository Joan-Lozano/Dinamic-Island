# Dinamic Island

Isla dinámica para Windows, inspirada en el notch de macOS. Se ancla en el centro superior de la pantalla,
se expande al pasar el ratón (o al cambiar de canción) y muestra:

- **Multimedia**: Spotify y cualquier reproductor del navegador (Chrome, Edge, Firefox, Brave…), con carátula,
  título, artista, barra de progreso con *seek*, anterior / pausa / siguiente.
  Usa las sesiones multimedia de Windows (SMTC) a través de un puente PowerShell (`src/media/smtc.ps1`).
- **Monitor de recursos**: CPU, RAM, GPU (solo NVIDIA), disco y red ↑/↓. Solo se muestrea mientras esa página está visible.
- **Batería** (anillo verde al cargar), **fecha y hora**.

Cambia de página con las flechas `‹ ›`, los puntos o el scroll horizontal. Fuera de la isla los clics pasan a las ventanas de debajo.
Icono en la bandeja: mostrar/ocultar, *iniciar con Windows*, salir.

## Uso

```bash
npm install
npm start          # Windows: usa SMTC real
npm run start:mock # reproductor simulado (también se activa solo fuera de Windows)
npm run dist       # instalador NSIS en dist/
```

Requiere Windows 10 1809+ con Windows PowerShell 5.1 (incluido por defecto).

## Estructura

| Ruta | Función |
|---|---|
| `src/main.js` | Ventana transparente *always-on-top*, bandeja, IPC |
| `src/media/windows.js`, `smtc.ps1` | Puente SMTC (JSON por stdout/stdin) |
| `src/media/mock.js` | Reproductor simulado para desarrollo |
| `src/system.js` | CPU/RAM/GPU/disco/red |
| `src/renderer/` | UI de la isla |
| `scripts/ui-smoke.js` | Prueba de UI con Playwright (capturas) |

## Notas

- El puente SMTC y la ventana nativa no se han podido ejecutar en Windows en el entorno de desarrollo (Linux); la UI sí está verificada con capturas.
- Si Windows bloquea scripts, el puente ya se lanza con `-ExecutionPolicy Bypass`.
