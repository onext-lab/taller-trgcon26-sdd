# Principios de diseño de interfaz

Criterios que `frontend-architect` aplica al diseñar pantallas y que la review comprueba. Son pocos a propósito: el
ATS es una herramienta interna para un único rol, el reclutador.

## Principios

1. **Claridad antes que estética.** HTML semántico y estilos mínimos; sin librería de componentes ni framework CSS.
2. **Accesible por defecto.** Cada control con etiqueta visible (`<label>`), foco visible, orden de tabulación lógico,
   contraste AA y mensajes de estado con `role="status"` o `role="alert"`. Testing Library y Playwright seleccionan
   por rol y por nombre accesible: si un test no encuentra un elemento por su rol, la pantalla tiene un problema.
3. **Estados explícitos.** Toda pantalla que carga datos contempla *cargando*, *vacío*, *error* y *con datos*.
4. **Errores útiles.** Los errores de validación se muestran junto al campo, con el `message` del envelope de la API;
   nunca un *stack trace* ni un código interno sin explicación.
5. **Datos personales con cuidado.** Los listados muestran lo justo (nombre y poco más); la ficha completa solo en el
   detalle. Ver [RGPD.md](../RGPD.md).
6. **Idioma.** Interfaz en castellano de España, con tildes; fechas en formato `dd/mm/aaaa`.

## Estructura de la web

- Una carpeta por feature en `apps/web/src/features/{candidates,jobs,applications}/` con sus pantallas, su cliente de
  API y sus tests.
- Componentes reutilizables (botón, campo de formulario, tabla, mensaje de estado) en `apps/web/src/components/`.
- Formularios controlados con validación en el cliente para la experiencia y **siempre** validación en la API.
