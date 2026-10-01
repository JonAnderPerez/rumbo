# Guía para agentes

Rumbo es un panel local de patrimonio: un servidor Flask calcula métricas financieras y sirve una interfaz web sin framework JavaScript. La cartera se guarda como JSON local; la app consulta servicios externos para precios y puede exportar un panel HTML estático.

## Comandos esenciales

| Tarea | Comando/evidencia |
|---|---|
| Ejecutar (documentado) | `uv run python -m app` |
| Lanzar en Windows/macOS | `Iniciar.bat` / `Iniciar.command` |
| Ejecutar con Docker Compose | `docker compose up --build` (desarrollo con recarga: `docker compose watch`) |
| Tests / lint | No hay suite ni comandos configurados en el repositorio (`POR CONFIRMAR` si se han definido fuera de él). |

No hay un comando de build local independiente. Para validar cambios, usa una carpeta de datos temporal (`PATRIMONIO_DATOS`) y un puerto libre (`PATRIMONIO_PUERTO`); no apuntes pruebas a una cartera personal.

## Mapa del repositorio

- `app/servidor.py`: servidor Flask, rutas API, ciclo de vida.
- `app/motor.py`: precios, series y métricas del panel.
- `app/almacen.py`: validación y persistencia JSON, copias automáticas.
- `app/buscar.py`: consultas de productos/precios a proveedores externos.
- `app/importar.py`, `app/plantilla.py`: importación y plantillas CSV/XLSX.
- `app/exportar.py`: exportación a un HTML estático autónomo.
- `app/web/`: HTML/CSS integrado, JavaScript del panel, editor y gráficos SVG.
- `demo/cartera.json`: datos de demostración; `mis_datos/` se crea en ejecución y contiene datos personales.
- `Dockerfile`, `docker-compose.yml`: imagen y ejecución en contenedor.
- `README.md`: instalación y uso para usuarios.

## Convenciones y flujo

- Python usa módulos/funciones en español con `snake_case`; la interfaz y las claves JSON también contienen nombres en español. Conserva el vocabulario y los nombres de campos establecidos.
- Mantén los cálculos en `motor.py`, las validaciones/cambios de cartera en `almacen.py` y las rutas HTTP en `servidor.py`. Conecta cambios de interfaz con sus rutas existentes.
- Los cambios persistentes pasan por validación y guardado con copia previa; las importaciones tienen vista previa antes de confirmar.
- Antes de alterar el formato de `cartera.json`, comprueba el impacto en datos existentes y copias. No se encontró infraestructura formal de migraciones: documentar la estrategia adoptada y marcar lo desconocido como `POR CONFIRMAR`.
- Más detalle y ejemplos: [arquitectura](.agents/architecture.md), [convenciones](.agents/conventions.md), [flujos](.agents/workflows.md), [runtime y entorno](.agents/runtime.md).

## Testing

- No se encontraron archivos de tests, configuración de test/lint ni CI. No inventes comandos de test.
- Para cambios que afectan al comportamiento, haz una comprobación manual aislada con datos temporales: arranca la app, comprueba `/api/ping` y recorre la función afectada en el navegador.
- Para cálculos/importación, cubre también fechas, datos incompletos y validación; no uses ni compartas extractos financieros reales.
- Si añades una suite o automatización, documenta el comando y el alcance en esta guía.

## Qué no hacer

- No leer, copiar, subir, sobrescribir ni incluir en commits `mis_datos/`, sus exportaciones/copias, ni datos personales. Está excluida de Git; verifica antes de preparar cambios.
- No editar archivos generados o de usuario para simular datos de prueba. Usa una ruta temporal con `PATRIMONIO_DATOS`.
- No cambiar `uv.lock` salvo que cambien dependencias; no añadir Node ni librerías frontend por defecto (README describe JS/CSS sin dependencias externas).
- No afirmar que la app está aislada de red sin revisar el bind actual: `servidor.py` crea el servidor en `0.0.0.0`, aunque el README describe uso local.
- No tocar lanzadores, manifiestos de despliegue o formato de datos sin revisar su impacto en Windows, macOS, Docker y usuarios existentes.
- Nunca inventar configuración, CI, migraciones o release; indicar `POR CONFIRMAR`.

## Checklist de finalización

- [ ] Cambio limitado al alcance; documentación y datos reales del usuario quedan intactos.
- [ ] Contratos entre rutas, almacenamiento, motor y frontend siguen alineados.
- [ ] Se revisó la compatibilidad del JSON existente y el manejo de errores.
- [ ] Se ejecutaron las comprobaciones disponibles; cualquier test/lint inexistente se indica, no se simula.
- [ ] Se actualizaron instrucciones afectadas y no se incluyeron datos privados ni secretos.
