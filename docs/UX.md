# Principios de diseño aplicados

## Las 10 heurísticas de Nielsen

| # | Heurística | Cómo se aplica |
|---|---|---|
| 1 | Visibilidad del estado del sistema | Indicador de conexión en el encabezado ("Actualizado hace 2 min", "Sin conexión · 3 pendientes"); esqueletos de carga; botones con "cargando"; pasos numerados en formularios; marcador "En juego" con punto animado. |
| 2 | Coincidencia con el mundo real | Lenguaje de la cancha: *fecha*, *planilla*, *valla menos vencida*, *penales*, *vereda*. Fechas como "Hoy", "Mañana". Hora de Colombia. |
| 3 | Control y libertad | "Deshacer" al retirar jugadores; "Atrás/Corregir" en cada paso; los avisos se pueden cerrar; la bienvenida se salta. |
| 4 | Consistencia y estándares | Un solo sistema de botones, tarjetas y colores; azul = acción, verde = éxito/clasificado, ámbar = favorito/advertencia, rojo = error/en vivo. |
| 5 | Prevención de errores | Validación junto al campo; año de edición duplicado bloqueado; aviso si la planilla no coincide con el marcador; penales obligatorios en empate eliminatorio; borrar requiere dos toques; edición finalizada protegida en la base de datos. |
| 6 | Reconocer antes que recordar | La categoría elegida se recuerda entre pantallas; jugadores como botones con número y nombre; lista de canchas usadas antes. |
| 7 | Flexibilidad y eficiencia | Generación automática de calendario, grupos sorteados y siguiente ronda; agregar jugadores en serie (el foco vuelve al nombre); fecha editable directamente en la lista. |
| 8 | Diseño minimalista | Cada rol ve solo su menú; la planilla es opcional; avisos en un banner pequeño; columnas secundarias de la tabla se ocultan en celular. |
| 9 | Ayudar a recuperarse de errores | Mensajes en español claro con causa y acción (`src/lib/errors.ts`): 400, 401, 403, 404, 409, 429, 500, sin conexión y edición cerrada. Páginas 404 y de error con "Reintentar". |
| 10 | Ayuda y documentación | Textos de ayuda bajo cada campo; descripciones de cada formato de torneo y estado de edición; guía de instalación en "Más". |

## Formularios divididos

| Formulario | Pasos |
|---|---|
| Registrar partido | Marcador → Planilla (opcional) → Confirmar |
| Nueva edición | Datos → Categorías → Confirmar |
| Equipo | Datos → Escudo |
| Categoría | Inscribir → Grupos → Calendario → Fase final |

## Principios psicológicos

- **Ley de Fitts:** botones de marcador de 56 px; navegación inferior al alcance del pulgar.
- **Ley de Hick:** pocas opciones por pantalla; filtros como fichas.
- **Efecto de posición serial:** "Tu próximo partido" y "En juego" van arriba.
- **Gratificación inmediata:** la estrella de favorito se rellena con una pequeña animación.
- **Prueba social e identidad:** escudos, colores del equipo y la vereda; palmarés en la ficha.
- **Carga cognitiva:** datos derivados (tabla, goleadores, podio) se calculan solos, nadie los transcribe.
- **Movimiento reducido:** se respeta `prefers-reduced-motion`.

## Accesibilidad

- Contraste AA en modo claro y oscuro; foco visible.
- Etiquetas y `aria-*` en controles con solo icono; `aria-live` para avisos.
- Enlace "Saltar al contenido"; navegación completa por teclado.
