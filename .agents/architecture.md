# Arquitectura

## Vista general

Rumbo combina una app Python con servidor Flask y un frontend servido como archivos estáticos. `python -m app` entra por `app/__main__.py`, que llama a `servidor.main()`. Flask sirve `app/web/`, expone rutas de API, y el frontend obtiene el cálculo serializado a través de `/datos.js`.

El almacenamiento principal es un JSON de cartera (`mis_datos/cartera.json`). Cuando no existe, el servidor presenta `demo/cartera.json` en modo demostración. El motor calcula métricas y persiste cachés/resúmenes bajo la carpeta de datos. Las escrituras de cartera se validan y guardan con copias automáticas mediante `almacen.py`.

## Componentes y responsabilidades

| Componente | Responsabilidad observada |
|---|---|
| `app/__main__.py` | Punto de entrada `python -m app`. |
| `app/servidor.py` | Flask, rutas de interfaz/API, selección demo/propia, lock de escritura/cálculo, exportación y arranque. |
| `app/almacen.py` | Esquema/validación de productos, movimientos y valoraciones; JSON atómico y copias limitadas a 20. |
| `app/contabilidad.py` | Esquema versionado por ejercicio, validación, persistencia independiente y cálculos derivados de Contabilidad con copias limitadas a 20. |
| `app/motor.py` | Descarga/lectura de precios, series históricas, valoración y métricas (TIR, rentabilidad, comparación). |
| `app/buscar.py` | Búsqueda por identificador/nombre y comprobación de precios de candidatos. |
| `app/importar.py` | Lectura/preparación/vista previa/aplicación de CSV MyInvestor, tabla genérica y texto CSV. |
| `app/plantilla.py` | Generación de plantillas CSV y XLSX. |
| `app/exportar.py` | Empaqueta HTML, estilos CSS y scripts inline junto con datos calculados en una página estática. |
| `app/web/index.html` | Estructura y carga las hojas CSS compartidas antes de los scripts del frontend. |
| `app/web/app.js` | Panel de Patrimonio, selector de áreas, navegación y visualización. |
| `app/web/contabilidad.js` | Selector de ejercicios, edición anual, presentación de resúmenes y llamadas a la API de Contabilidad. |
| `app/web/contabilidad.css` | Estilos responsive específicos de la vista anual de Contabilidad. |
| `app/web/editor.js` | Edición de productos/movimientos/saldos e importación. |
| `app/web/graficos.js` | Gráficos SVG propios sin librería de gráficos externa. |

## Otros archivos de soporte

- `app/prompt_ia.txt`: prompt de importación que se entrega desde `/api/prompt`.
- `app/VERSION`: versión que usa el aviso de actualización.
- `docs/capturas/` y `docs/logo/`: imágenes de README y marca.
- `demo/cartera.json`: cartera demostrativa; `LICENSE`: licencia MIT.
- `pyproject.toml`, `uv.lock`, `requirements.txt`, `.python-version`: requisitos y resolución del runtime.
- `Iniciar.bat`, `Iniciar.command`: lanzadores para Windows y macOS.

## Flujo de datos

1. El servidor selecciona cartera propia o demo. En el arranque `motor.construir()` calcula datos; los precios se descargan según antigüedad/cache y después se sirven como `window.DATOS` por `/datos.js`.
2. `app.js` representa el panel y `editor.js` solicita la configuración por `/api/cartera`. El navegador no accede al JSON directamente.
3. Crear/editar/borrar datos entra por `/api/<coleccion>` o `/api/<coleccion>/<ident>`. `cambia()` bloquea operaciones concurrentes, ejecuta las funciones de `almacen`, guarda una copia/cartera y recalcula.
4. Importar tiene dos pasos: `/api/importar/previsualizar` genera plan e informe sobre una copia; `/api/importar/confirmar` aplica el plan. La plantilla la sirven `/api/plantilla.csv` y `/api/plantilla.xlsx`.
5. Contabilidad se sirve por `/api/contabilidad`: la API entrega el ejercicio persistente y un `resumen` calculado por `contabilidad.calcula()`. Este resultado de lectura no se guarda en el JSON.
6. `/api/exportar-web` entrega un HTML de solo lectura centrado en Mi Patrimonio. La opción de ocultar importes escala datos antes de incrustarlos y omite campos absolutos; la vista y los datos de Contabilidad quedan fuera.

## Datos persistentes

`almacen.CARTERA_VACIA` define un ejemplo del objeto: `version`, `titular`, listas `productos`, `movimientos`, `valoraciones`, `comparador`, `hitos` y `objetivo`. El archivo demo aporta un ejemplo completo y puede evolucionar independientemente del archivo privado.

Contabilidad tiene un contrato independiente en `app/contabilidad.py`: `contabilidad.json` tiene `version: 1` en la raíz y un mapa de ejercicios por año; se guarda en `PATRIMONIO_DATOS` (por defecto `mis_datos`), nunca dentro de `cartera.json`. Sus copias automáticas previas se guardan en `copias_contabilidad/`, separadas de las de Patrimonio, con un máximo de 20. La carga devuelve un documento vacío si el fichero aún no existe; los guardados validan todo el documento y usan reemplazo atómico. Las versiones desconocidas o los datos inválidos se rechazan y no se sobrescriben. No hay migrador ni restauración de estas copias desde la interfaz: la recuperación es manual con la app cerrada, reemplazando `contabilidad.json` por la copia completa elegida.

Los campos derivados de nómina, totales, subtotales, objetivos y desviaciones se calculan al responder la API; no forman parte del contrato persistente. Importes mensuales nulos significan «sin registrar» y el cero es un dato explícito. La suma anual ignora meses nulos. Para el subtotal, el mes solo necesita ingresos registrados; los gastos personales o de casa sin registrar se tratan como cero. El subtotal y la tasa anual consideran solo los meses con ingresos registrados. Los bloques «Real» y «Ahorros» no se descuentan otra vez.

La interfaz carga `tokens.css`, `base.css`, `componentes.css` y `contabilidad.css`. `exportar.py` inserta las hojas necesarias dentro del HTML estático y elimina selector y panel de Contabilidad para mantener la exportación autónoma y limitada a Patrimonio.

`servidor.py` también usa `estado.json`, `calculado_<modo>.json`, `historico.json`, caché de precios y `copias/` dentro de la carpeta de datos. El contenido exacto y las claves internas de caché no son contrato público (`POR CONFIRMAR` antes de depender de ellas).

No se encontró un framework o historial formal de migraciones. La versión `version: 1` del objeto no prueba por sí sola que exista migrador; compatibilidad/migración de datos anteriores debe decidirse explícitamente y preservar las copias.

## Interfaces y dependencias externas

- Flask ofrece API JSON y archivos del frontend; no se encontró autenticación de usuario.
- El código de búsqueda consulta Yahoo Finance, Morningstar y CoinGecko. `motor.py` usa proveedores de series/precios y conversión; revisar allí endpoints y campos antes de modificarlos.
- `servidor.py` comprueba una vez al día `app/VERSION` remoto en GitHub.
- La configuración observada de `main()` pasa `0.0.0.0` a `make_server`; Compose publica el puerto 8765. El README advierte que la interfaz puede ser accesible desde la red y que no debe exponerse a Internet sin autenticación, HTTPS y control de acceso.
- El detalle de autenticación, TLS, proxy inverso y un despliegue remoto seguro no está especificado (`POR CONFIRMAR`).
