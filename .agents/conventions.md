# Convenciones observadas

Estas reglas describen el código actual; no se encontró un formatter/linter configurado.

## Python

- Los identificadores de funciones y variables suelen estar en español y usar `snake_case`: `guarda_producto`, `guarda_movimiento`, `rango_fechas`.
- Las constantes usan mayúsculas y guiones bajos: `CARTERA_VACIA`, `COPIAS_MAX`, `HORAS_PRECIOS`.
- Los módulos separan responsabilidades; importar desde módulos locales con import relativo, por ejemplo `from .motor import TIPOS, FUENTES, num_es`.
- Errores de validación se expresan con una excepción específica (`almacen.ErrorValidacion`) y listas de mensajes para presentar al usuario.
- Las funciones que actualizan la cartera reciben `cfg` y datos explícitos. El guardado ocurre a través de `almacen.guarda()` y mantiene copia previa y reemplazo atómico.
- Se usan docstrings para funciones no obvias y comentarios/separadores para delimitar fases. Mantén los mensajes de interfaz en español claro.
- Al recibir entradas externas, normalizar/validar antes de persistir. Ejemplo: `almacen.numero()` acumula mensajes y `guarda_producto()` comprueba tipo/fuente/moneda.

## JavaScript, HTML y CSS

- JavaScript moderno sin bundler: IIFE para aislar módulos, `"use strict"`, `const`/`let`, `async`/`await` y `fetch`.
- Los nombres frontend usan principalmente `camelCase` y claves acordes al JSON español; variables globales compartidas explícitamente en `window` (`window.DATOS`, `window.G`).
- `editor.js` y `app.js` aíslan utilidades/estado en closures; `graficos.js` publica una API concisa en `window.G`.
- Escapa texto interpolado en HTML cuando proceda; ejemplo actual `editor.js` define `esc()` y la usa en plantillas.
- Los gráficos son SVG propios; `index.html` carga CSS externos y `exportar.py` los inserta en línea para el HTML autónomo. Los temas se expresan mediante variables CSS y `data-tema`.
- Conserva carga ordenada de scripts en `index.html`: `datos.js`, `graficos.js`, `app.js`, `editor.js`, `contabilidad.js`.
- La vista anual está aislada en `contabilidad.js` y `contabilidad.css`; sus importes/porcentajes se presentan con formato español, pero se envían al servidor como números JSON.
- No persistir totales calculados. `contabilidad.calcula()` usa `Decimal` y sus resultados se devuelven como `resumen` desde la API; los cálculos de Patrimonio siguen en `motor.py`.

## Contratos de datos y API

- La UI y el backend comparten claves/categorías españolas. Comprueba el uso de cada clave en `almacen.py`, `motor.py`, `servidor.py` y frontend antes de renombrar.
- Respuestas de cambio usan `ok`, `errores`, `item`, `cartera` y/o `avisos`; errores de validación se devuelven con estado HTTP 400. La demo rechaza escrituras con 403.
- Las rutas de Contabilidad usan `ok`, `errores`, `ejercicio`, `categoria` y `resumen`. `resumen` es derivado y no pertenece al esquema versionado `contabilidad.json`.
- Importación debe conservar el flujo de vista previa/confirmación y evitar duplicados, como implementan `importar.preparar_*`, `vista_previa()` y `aplicar()`.
- Fechas persistentes se convierten a ISO mediante `date.isoformat()`; visualización en español se formatea en UI.

## Ejemplos del repositorio

```python
def fecha(valor, errores):
    try:
        f = dt.date.fromisoformat(str(valor or "")[:10])
    except ValueError:
        errores.append("Falta la fecha o no es válida.")
        return None
```

```javascript
async function api(metodo, url, cuerpo) {
  const r = await fetch(url, {
    method: metodo, headers: { "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
}
```

El segundo ejemplo representa el patrón de llamada de `editor.js`; si se modifica la utilidad real, conservar su manejo de errores y forma de respuesta.
