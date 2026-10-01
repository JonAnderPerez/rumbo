# Flujos de trabajo

## Añadir o cambiar una funcionalidad

1. Localiza la capa propietaria: cálculo (`motor.py`), persistencia/validación (`almacen.py`), integración de precios (`buscar.py`), endpoint (`servidor.py`) o presentación (`app/web/`).
2. Sigue un cambio completo entre UI, API, validación, almacenamiento y recálculo. No dupliques reglas de dominio en JavaScript si son necesarias para proteger los datos persistidos.
3. Conserva mensajes en castellano y contratos JSON existentes. Para entradas del usuario, conserva errores explícitos; para importación, la vista previa antes de confirmar.
4. Actualiza README o `.agents/` solo si el cambio altera instrucciones/arquitectura.
5. No hay suite automatizada documentada. Haz una prueba manual con ruta `PATRIMONIO_DATOS` temporal, `PATRIMONIO_NO_ABRIR=1` y un puerto libre; arranca `uv run python -m app`, comprueba `/api/ping` y recorre el camino afectado. La descarga de precios puede requerir Internet.

## Cambiar el modelo de cartera

- La persistencia viva y valores por defecto están en `app/almacen.py`; usa `demo/cartera.json` como muestra separada y verifica campos consumidos por `motor.py`, `servidor.py`, import/export y `app/web/`.
- `CARTERA_VACIA` y `demo/cartera.json` tienen sus propios objetos; no asumir que se actualizan automáticamente al añadir una clave.
- No se encontró infraestructura de migraciones ni una política para versiones posteriores a `version: 1`. Antes de introducir cambios incompatibles, definir explícitamente migración/backward compatibility, preservar backup, y señalar cualquier decisión no documentada como `POR CONFIRMAR`.
- No probar una transformación sobre `mis_datos/` real. Usa una copia temporal creada explícitamente y comprueba que se pueda cargar y guardar.

## Importar datos

La ruta normal es CSV MyInvestor o la plantilla CSV/XLSX; el backend prepara un plan y muestra vista previa antes de aplicarlo. Mantén el control de duplicados, errores por fila, confirmación y guardado centralizado. Nunca incluir en ejemplos extractos con nombre, DNI, IBAN o números de cuenta.

## Ejecutar localmente

- Recomendado/documentado: `uv run python -m app`.
- En Windows/macOS para usuarios: `Iniciar.bat` o `Iniciar.command`.
- La app puede consultar precios externos y abrir navegador por defecto. Para comprobaciones no interactivas existe `PATRIMONIO_NO_ABRIR`.
- El puerto base predeterminado es 8765; `servidor.main()` prueba puertos consecutivos hasta 10 intentos.

## Contenedor y publicación

- El Dockerfile usa `python:3.12-slim`, instala `requirements.txt` y ejecuta `python -m app`.
- Compose define `rumbo`, publica `8765:8765`, monta `./mis_datos:/app/mis_datos` y fija `TZ=Europe/Madrid`. Arranque local derivado de esos archivos: `docker compose up --build`; detener con `Ctrl-C`.
- Antes de desplegar, mantener `mis_datos` en un volumen persistente respaldado. El servidor actual se enlaza a `0.0.0.0`, por lo que no exponerlo a Internet sin resolver autenticación, HTTPS y control de acceso (`POR CONFIRMAR`).
- README describe una vía distinta para publicar un panel de solo lectura: exportar desde la app a HTML (con importes opcionalmente ocultos) y subir el archivo a un servicio estático. Confirmar el destino y la privacidad antes de compartir.
- No se encontró CI/CD ni proceso automatizado de release/deploy (`POR CONFIRMAR`).
