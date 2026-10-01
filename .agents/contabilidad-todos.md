# Hoja de ruta: Contabilidad

## Objetivo y alcance acordado

Crear en Rumbo un espacio de **Contabilidad**, separado de «Mi Patrimonio» y accesible desde un selector en el appbar. Mantener la identidad visual y ofrecer una vista anual editable inspirada en la hoja de ejemplo.

- Entrada manual en Rumbo; no se incluye importación XLSX/CSV en esta primera versión.
- Cada ejercicio contiene importes, configuración salarial, reglas de presupuesto y sus categorías.
- Se pueden añadir y renombrar categorías desde el inicio.
- Importes mensuales editables; totales, subtotales y porcentajes derivados automáticamente.
- Reglas/porcentajes presupuestarios editables; los resultados calculados no se sobrescriben manualmente.
- Los datos nuevos se guardan por separado de `cartera.json`, en la carpeta configurada con `PATRIMONIO_DATOS`.
- Extraer el CSS inline a hojas externas reutilizables. La exportación web estática debe seguir siendo un único HTML autónomo.

## Fases

### 1. Definir datos, fórmulas y persistencia

- [ ] Diseñar el formato versionado por ejercicio para nómina, reglas de distribución, bloques/categorías, importes mensuales y metadatos de actualización.
- [ ] Guardar Contabilidad en un fichero independiente; no añadir campos a `cartera.json` ni cambiar `motor.py`.
- [ ] Añadir validación explícita para año, categoría, mes, importes, porcentajes y campos salariales; rechazar entradas inválidas con errores legibles.
- [ ] Definir guardado atómico y copias previas siguiendo las convenciones del almacenamiento existente, sin leer datos de `mis_datos/`.
- [ ] Documentar en este archivo cualquier cuestión de fórmula que no pueda determinarse con el ejemplo antes de codificarla.
- **Aceptación:** la carga/guardado de un ejercicio de ejemplo no modifica la cartera ni interfiere con sus copias; los importes soportan cero, vacío y valores negativos de ajuste/devolución.

### 2. Extraer CSS y componentes compartidos

- [ ] Extraer el `<style>` inline de `app/web/index.html` a ficheros bajo `app/web/` (tokens/temas, base y componentes; CSS específico por área cuando aporte claridad).
- [ ] Sustituir los atributos `style` estáticos de HTML por clases compartidas; reservar estilos inline en JavaScript únicamente para valores dinámicos que vienen de los datos (por ejemplo, colores de productos).
- [ ] Mantener idénticos los estilos, el tema claro/oscuro, los breakpoints y el aspecto de Mi Patrimonio durante la extracción.
- [ ] Compartir estilos de appbar, tarjetas, tablas, campos, botones, avisos y estados vacíos entre las dos áreas; evitar duplicar reglas.
- [ ] Actualizar `app/exportar.py` para incluir los CSS necesarios en el HTML generado y mantenerlo portable como archivo único.
- **Aceptación:** Mi Patrimonio conserva su presentación y el HTML exportado funciona sin depender de hojas externas.

### 3. Añadir almacenamiento y API de Contabilidad

- [ ] Implementar un módulo de dominio/almacenamiento propio para años, configuración anual, reglas, categorías e importes mensuales.
- [ ] Exponer endpoints independientes para consultar ejercicios, crear uno, consultar un ejercicio y guardar/eliminar datos o categorías.
- [ ] Aplicar validación en servidor y respuestas de error coherentes con el resto de la API.
- [ ] No persistir silenciosamente sobre la demo de patrimonio ni aceptar escrituras malformadas.
- **Aceptación:** se puede crear, leer, editar y borrar un ejercicio con almacenamiento temporal y la API de cartera responde igual que antes.

### 4. Añadir selector de áreas al appbar

- [ ] Hacer seleccionable el título junto al logo Rumbo para alternar entre «Mi Patrimonio» y «Contabilidad».
- [ ] Conservar el diseño del appbar; indicar el área activa y permitir operar el selector con teclado/lector de pantalla.
- [ ] Adaptar el selector a móvil, donde actualmente el texto de marca se oculta en pantallas estrechas.
- [ ] Mantener aislado el estado de navegación de cada área y restaurar el área seleccionada al recargar.
- **Aceptación:** cambiar de área no pierde cambios pendientes ni cambia los datos o la pestaña activa de la otra área.

### 5. Crear vista anual y edición de categorías

- [ ] Añadir selector de año, creación de nuevo ejercicio y un estado vacío claro cuando no hay datos.
- [ ] Presentar bloques del ejemplo: Nómina/cálculos, Ingresos, Gastos, Gastos de casa, Total/subtotal, presupuesto «Real» y Ahorros.
- [ ] Permitir edición de configuración salarial, importes por mes, reglas porcentuales y nombres/categorías.
- [ ] Permitir añadir/renombrar categorías con persistencia y validación; no borrar importes existentes al cambiar el nombre.
- [ ] Usar controles accesibles, navegación responsive y formato español de moneda/porcentaje.
- **Aceptación:** navegar por dos ejercicios no mezcla sus datos; se pueden editar categorías e importes y recuperarlos tras recargar.

### 6. Calcular resúmenes de mes y año

- [ ] Calcular totales mensuales y anuales para cada bloque, ingresos, gastos y ahorros.
- [ ] Calcular saldo/subtotal y porcentaje de ahorro con denominadores y signos definidos; representar devoluciones y ajustes según el signo introducido.
- [ ] Calcular importe objetivo por grupo a partir de porcentajes editables y compararlo con el gasto/ahorro real.
- [ ] Mostrar meses sin datos como vacíos y no como registros confirmados de 0; no calcular porcentajes con denominador cero.
- [ ] Hacer visibles las fórmulas y evitar contar dos veces las transferencias que aparezcan como ahorro.
- [ ] Especificar, contrastar con el ejemplo y probar las fórmulas salariales españolas; identificarlas como estimaciones configurables, no nómina oficial ni asesoramiento fiscal.
- **Aceptación:** subtotales y porcentajes coinciden con casos sintéticos calculados a mano, incluyendo año parcial, meses vacíos, ajustes negativos y devoluciones.

### 7. Documentar y conservar las superficies existentes

- [ ] Actualizar README y `.agents/architecture.md`, `.agents/workflows.md` y/o `.agents/conventions.md` si cambian las instrucciones o el mapa de módulos.
- [ ] Documentar ubicación, copia/restauración y versión del fichero independiente de Contabilidad.
- [ ] Revisar que la exportación estática sigue siendo autónoma y que no incluye los datos de Contabilidad salvo decisión explícita futura.
- **Aceptación:** las instrucciones coinciden con la implementación y no afirman soporte de importación Excel/CSV.

### 8. Validar sin datos personales

- [ ] Arrancar la aplicación con `PATRIMONIO_DATOS` apuntando a una carpeta temporal, `PATRIMONIO_NO_ABRIR=1` y puerto libre.
- [ ] Comprobar `/api/ping`, rutas de Contabilidad, creación/edición de dos ejercicios, validación y persistencia tras reinicio.
- [ ] Revisar la navegación de ambas áreas en escritorio y móvil, temas claro/oscuro y mensajes de error/estado vacío.
- [ ] Probar Mi Patrimonio y la exportación estática antes y después de extraer CSS.
- [ ] Confirmar que `mis_datos/` no se ha leído ni modificado y que no se añadieron datos reales o personales a Git.
- **Aceptación:** flujo manual completo con datos sintéticos; anotar cualquier limitación porque el repositorio no documenta suite de tests ni lint.

## Fórmulas y límites que requieren especial cuidado

- Los datos de nómina (bruto, prorrata, netos, retenciones y aportes del trabajador) dependen de circunstancias individuales. Las tasas y supuestos deben ser editables y las operaciones explicables.
- Antes de codificar el subtotal definitivo, establecer si las aportaciones de ahorro ya salen del saldo disponible o se muestran aparte. El ejemplo presenta el «REAL» y «AHORROS» con las mismas cifras; no sumar ambos bloques dos veces.
- Definir si una celda sin dato significa desconocido/no registrado y cómo se diferencia de un cero real.
- Año y mes deben validarse; categorías e importes de un ejercicio deben pertenecer únicamente a ese ejercicio.

## Orden y dependencias

1. Modelo, fórmulas y persistencia independiente.
2. Extracción CSS (puede avanzar en paralelo al backend) y ajuste del exportador.
3. API.
4. Selector de áreas.
5. Vista editable anual.
6. Cálculos y resúmenes.
7. Documentación.
8. Validación aislada de extremo a extremo.
