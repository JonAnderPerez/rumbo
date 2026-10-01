# Runtime, configuración y checks

## Lenguajes y dependencias

- Python `>=3.10` (`pyproject.toml`); `.python-version` fija `3.12` y Docker usa `python:3.12-slim`.
- `pyproject.toml` declara paquete `rumbo` versión `1.2.1`, `flask>=3.0` y `openpyxl>=3.1`. `requirements.txt` repite estas dependencias para instalaciones con pip; `uv.lock` fija versiones (Flask `3.1.3`, openpyxl `3.1.5` en el lock inspeccionado).
- `openpyxl` se importa dentro de la generación XLSX en `app/plantilla.py`; la app también ofrece plantilla CSV.
- Frontend: HTML/CSS/JavaScript nativo, sin dependencias JavaScript o proceso Node observados. Flask es servidor; Werkzeug llega como dependencia transitiva.
- La versión de ejecución usada por el comprobador remoto está en `app/VERSION` (`1.2.1`). El método de sincronización entre `app/VERSION` y `pyproject.toml` es `POR CONFIRMAR`.

## Variables de entorno observadas

| Variable | Uso y valor por defecto |
|---|---|
| `PATRIMONIO_DATOS` | Ruta alternativa a datos de usuario; si no se define, usa `<raíz>/mis_datos`. Adecuada para pruebas aisladas. |
| `PATRIMONIO_PUERTO` | Puerto base; predeterminado `8765`. `main()` busca hasta 10 puertos a partir de él. |
| `PATRIMONIO_NO_ABRIR` | Si está definida con valor no vacío, no abre el navegador automáticamente. |
| `TZ` | Compose establece `Europe/Madrid`; no se encontró lectura directa en Python. |

No hay plantilla `.env` ni documentación de secretos/variables de CI. No se observó clave API requerida para los proveedores, pero cuotas y condiciones de servicio no están documentadas aquí (`POR CONFIRMAR`).

## Dependencias externas de runtime

- Morningstar y Yahoo Finance: búsqueda y series de productos/precios.
- CoinGecko: búsqueda y cotización de criptomonedas.
- GitHub: lectura del archivo remoto `app/VERSION` para avisar de nuevas versiones.
- Internet no es requisito para usar el último dato guardado en todos los casos, pero búsqueda, precios nuevos y aviso de versión dependen de servicios externos; revisar manejo de cache/fallback antes de cambiarlo.

## Build, test, lint y run

- Run de desarrollo/usuario documentado: `uv run python -m app`.
- Lanzadores de usuario: `Iniciar.bat` y `Iniciar.command`; preparan entorno con `uv` o Python/pip.
- Run en contenedor, derivado de `Dockerfile` y `docker-compose.yml`: `docker compose up --build`.
- No hay script de build local independiente, ni configuración/command de test o lint, ni CI visible en el repositorio. No se puede indicar un comando real de tests o lint; estado exacto fuera del repo: `POR CONFIRMAR`.
- `README.md` y el código describen una prueba manual posible: ejecutar en puerto/datos temporales, consultar `http://127.0.0.1:<puerto>/api/ping` y validar la interfaz. La app realiza solicitudes externas durante sus cálculos.

## Despliegue y límites

El Compose publica el puerto 8765 y monta datos en `./mis_datos`; persistir y respaldar ese volumen es necesario para conservar la cartera. Aunque el README presenta la app como local, `servidor.py` construye su servidor con `0.0.0.0`. No suponer aislamiento de red ni añadir instrucciones de despliegue público sin confirmar controles de acceso y la intención de exposición.

Existe además exportación de HTML estático desde `/api/exportar-web`, con modo `ocultar=1`; ese archivo contiene datos ya calculados y debe tratarse como información sensible salvo que se haya generado intencionadamente en modo oculto.
