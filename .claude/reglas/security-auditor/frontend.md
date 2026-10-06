# `security-auditor` · reglas de ámbito FRONTEND

**Aplica si el diff toca** `apps/web/` o cualquier `.tsx`/`.html` que se sirva al navegador.

Están separadas del prompt del agente para no pagarlas en cada invocación cuando el diff no toca frontend. El agente está obligado a leer este fichero cuando aplica, y a parar si no puede.

Estado de partida (paso-0): `apps/web` es una sola página que llama a `/api/health`. No hay `dangerouslySetInnerHTML`, ni `localStorage`, ni variables `VITE_*`, ni `postMessage`. Cualquier aparición es **nueva** y se revisa.

---

### F1 · XSS: `dangerouslySetInnerHTML` / `innerHTML` con datos de la API o del usuario

- **OWASP:** A03:2021 Injection (XSS).
- **Regla:** uso de `dangerouslySetInnerHTML` en JSX, o asignación a `.innerHTML`/`.outerHTML`, con datos que vienen de la API o de lo que escribe la persona (resumen del candidato, notas, nombre de la oferta, CSV importado). React escapa por defecto; el riesgo es desactivarlo.
- **Patrones (grep):** `dangerouslySetInnerHTML` · `\.innerHTML\s*=` · `\.outerHTML\s*=` · `insertAdjacentHTML`
- **Dónde:** `apps/web/src/**/*.{ts,tsx}` · `apps/web/index.html`
- **Severidad:** crítico.
- **Falsos positivos:** cadenas estáticas sin interpolación. Si se necesita HTML enriquecido, la alternativa es renderizar texto plano o sanear con una librería justificada en `DECISIONS.md`.

### F2 · URLs peligrosas en `href`/`src`

- **OWASP:** A03:2021 Injection (XSS).
- **Regla:** `href` o `src` con un valor de la API o del usuario sin validar el esquema (`javascript:`, `data:`, `vbscript:`). Ejemplo típico: un enlace al perfil público del candidato o a la web de la empresa.
- **Patrones (grep):** `href=\{` · `src=\{` · `window\.open\(`
- **Dónde:** `apps/web/src/**/*.tsx`
- **Severidad:** alto si el valor viene de la API o del usuario; bajo si es una constante.
- **Falsos positivos:** rutas internas construidas con literales (`/jobs/${id}` con `id` numérico).

### F3 · Secretos en variables `VITE_*` o en el bundle

- **OWASP:** A05:2021 Security Misconfiguration / A07 Identification and Authentication Failures.
- **Regla:** cualquier `import.meta.env.VITE_*` que contenga un secreto (token, API key, password). Vite compila esas variables literalmente en el JS que descarga el navegador: son públicas.
- **Patrones (grep):** `import\.meta\.env\.VITE_` · `VITE_[A-Z_]*(TOKEN|SECRET|KEY|PASSWORD|CREDENTIAL)`
- **Dónde:** `apps/web/src/**/*.{ts,tsx}` · `apps/web/vite.config.ts`
- **Severidad:** crítico.
- **Falsos positivos:** URLs base o flags públicos (`VITE_API_BASE_URL`). Recuerda: el ATS usa rutas relativas `/api` y el proxy de Vite, así que en principio no necesita ninguna.

### F4 · Datos personales o tokens en `localStorage`, `sessionStorage` o la URL

- **OWASP:** A04:2021 Insecure Design / A01 Broken Access Control.
- **Regla:** (a) persistir datos de candidatos (email, teléfono, CV, notas) o cualquier token en `localStorage`/`sessionStorage`, accesibles por cualquier script de la página; (b) poner datos personales en la query string (quedan en el historial, en los logs del servidor y en el `Referer`).
- **Patrones (grep):** `localStorage\.` · `sessionStorage\.` · `searchParams\.set\(` · `location\.search` · `navigate\(.*\?`
- **Dónde:** `apps/web/src/**/*.{ts,tsx}`
- **Severidad:** medio (alto si es un token o un dato sensible).
- **Falsos positivos:** preferencias de interfaz sin datos personales (filtro seleccionado, columna ordenada). Los filtros de búsqueda en la URL son aceptables si no llevan email ni teléfono. Cruza con `datos-personales-auditor` para la parte de minimización; aquí solo cuenta la exposición técnica.

### F5 · Open redirect y reverse tabnabbing

- **OWASP:** A01:2021 Broken Access Control.
- **Regla:** (a) `window.location`/`window.open` con un destino que viene de un parámetro o de la API sin validar; (b) `target="_blank"` sin `rel="noopener noreferrer"`.
- **Patrones (grep):** `window\.location\.(href|assign|replace)` · `location\.(href|assign|replace)\s*=` · `window\.open\(` · `target="_blank"` · `target=\{'_blank'\}`
- **Dónde:** `apps/web/src/**/*.tsx`
- **Severidad:** bajo (medio si el destino viene de input sin validar).
- **Falsos positivos:** destinos estáticos (`'/'`) o `location.reload()`.

### F6 · Errores de la API mostrados en crudo

- **OWASP:** A05:2021 Security Misconfiguration.
- **Regla:** mostrar al usuario el cuerpo completo de un error o un `error.stack` (p. ej., `JSON.stringify(error)` en pantalla). Lo correcto es traducir el `code` del envelope `{ error: { code, message } }` a un mensaje para la persona.
- **Patrones (grep):** `JSON\.stringify\(.*err` · `\.stack` · `console\.(log|error)\(.*response`
- **Dónde:** `apps/web/src/**/*.{ts,tsx}`
- **Severidad:** bajo (medio si se muestran datos personales de otro registro).
