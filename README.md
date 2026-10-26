# Dinamic Island

Isla dinámica para Windows, inspirada en el notch de macOS. Se ancla en el centro superior de la pantalla,
se expande al pasar el ratón (o al cambiar de canción) y muestra:

- **Multimedia**: Spotify y cualquier reproductor del navegador (Chrome, Edge, Firefox, Brave…), con carátula,
  título, artista, barra de progreso con *seek*, anterior / pausa / siguiente.
  Usa las sesiones multimedia de Windows (SMTC) a través de un puente PowerShell (`src/media/smtc.ps1`).
- **Monitor de recursos**: CPU, RAM, GPU (solo NVIDIA), disco y red ↑/↓. Solo se muestrea mientras esa página está visible.
- **Notificaciones**: Telegram, WhatsApp, Outlook, Teams (y cualquier otra app). Al llegar una, la isla se expande con un aviso
  de ~5 s; un contador rojo marca las no leídas y la tercera página guarda las últimas. Clic en un aviso abre la app.
  Usa `UserNotificationListener` (`src/notifications/notifications.ps1`); hay que permitirlo en
  *Configuración › Privacidad y seguridad › Notificaciones* (la isla muestra un enlace si está bloqueado).
- **Batería** (anillo verde al cargar), **fecha y hora**.

Cambia de página con las flechas `‹ ›`, los puntos o el scroll horizontal. Fuera de la isla los clics pasan a las ventanas de debajo.
Icono en la bandeja: **Ajustes…** (también con doble clic), mostrar/ocultar, *iniciar con Windows*, salir.

## Panel de ajustes

- **Pantalla**: en qué monitor aparece la isla (con botón *Identificar pantallas*).
- **Apariencia**: tema oscuro / claro / automático (sigue a Windows) y color de acento.
- **Inicio**: iniciar con Windows, retraso de arranque (0–60 s) e iniciar oculta.
- **Notificaciones**: activarlas o no en la isla.

Los cambios se aplican al instante y se guardan en `%APPDATA%/dinamic-island/settings.json`. `npm start -- --settings` abre el panel al arrancar.

## Código abierto y firma de código

Licencia [MIT](LICENSE). Los instaladores publicados en [Releases](https://github.com/Joan-Lozano/Dinamic-Island/releases) se compilan en GitHub Actions a partir de este repositorio y se firman con SignPath.

### Code signing policy

Free code signing provided by [SignPath.io](https://about.signpath.io/), certificate by [SignPath Foundation](https://signpath.org/).

- **Autor, revisor y aprobador de las firmas:** [Joan-Lozano](https://github.com/Joan-Lozano). Cada versión requiere aprobación manual antes de firmarse.
- Solo se firman binarios compilados desde el código de este repositorio (los scripts de compilación y de CI están en `package.json` y `.github/workflows`). La versión firmada de cada release coincide con la etiqueta `vX.Y.Z`.

### Política de privacidad

Este programa no transfiere ninguna información a otros sistemas conectados en red. Todo lo que muestra (multimedia, notificaciones, recursos) se lee en local y los ajustes se guardan solo en tu equipo.

## Uso

```bash
npm install
npm start          # Windows: usa SMTC real
npm run start:mock # reproductor simulado (también se activa solo fuera de Windows)
npm run dist       # instalador NSIS en dist/DinamicIsland-Setup-<versión>.exe
npm run dist:dir   # solo la app desempaquetada (dist/win-unpacked), más rápido
```

Requiere Windows 10 1809+ con Windows PowerShell 5.1 (incluido por defecto).

## Estructura

| Ruta | Función |
|---|---|
| `src/main.js` | Ventana transparente *always-on-top*, bandeja, IPC |
| `src/media/windows.js`, `smtc.ps1` | Puente SMTC (JSON por stdout/stdin) |
| `src/media/mock.js` | Reproductor simulado para desarrollo |
| `src/notifications/` | Puente de notificaciones de Windows (+ simulado) |
| `src/system.js` | CPU/RAM/GPU/disco/red |
| `src/renderer/` | UI de la isla |
| `scripts/ui-smoke.js` | Prueba de UI con Playwright (capturas) |

## Notas

- Solo se ven las notificaciones que Windows llega a mostrar: con *No molestar*/asistente de concentración activo, o con el contenido
  oculto en la pantalla de bloqueo, pueden llegar sin texto. WhatsApp/Telegram **web** aparecen como la app del navegador.
- No se pueden responder mensajes desde la isla (Windows no lo expone); el clic abre la app.

- El puente SMTC y la ventana nativa no se han podido ejecutar en Windows en el entorno de desarrollo (Linux); la UI sí está verificada con capturas.
- Si Windows bloquea scripts, el puente ya se lanza con `-ExecutionPolicy Bypass`.
