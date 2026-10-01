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

- [x] Definir en esta hoja de ruta el contrato versionado por ejercicio, sus secciones, categorías, reglas y cálculos derivados.
- [x] Guardar Contabilidad en un fichero independiente; no añadir campos a `cartera.json` ni cambiar `motor.py`.
- [x] Añadir validación explícita para año, categoría, mes, importes, porcentajes y campos salariales; rechazar entradas inválidas con errores legibles.
- [x] Definir guardado atómico y copias previas siguiendo las convenciones del almacenamiento existente, sin leer datos de `mis_datos/`.
- **Aceptación:** la carga/guardado de un ejercicio de ejemplo no modifica la cartera ni interfiere con sus copias; los importes soportan cero, vacío y valores negativos de ajuste/devolución.

#### Contrato canónico de datos (v1)

El único origen persistente es `contabilidad.json`, dentro de `PATRIMONIO_DATOS`. El fichero contiene un mapa de ejercicios independientes. La forma canónica es:

```json
{
  "version": 1,
  "ejercicios": {
    "2026": {
      "anio": 2026,
      "creado": "2026-01-01T00:00:00+01:00",
      "actualizado": "2026-09-22T00:00:00+02:00",
      "nomina": {
        "bruto_anual": null,
        "porcentaje_irpf": 16.0,
        "porcentajes_cotizacion": {
          "contingencias_comunes": 4.82,
          "desempleo": 1.55,
          "formacion_profesional": 0.10
        },
        "meses_pagas_extra": [7, 12]
      },
      "presupuesto": {
        "base": "neto_regular",
        "reglas": [
          {"id": "esenciales", "nombre": "Gastos fijos esenciales", "porcentaje": 50.0, "categoria_real_id": "esenciales"},
          {"id": "estilo_vida", "nombre": "Estilo de vida", "porcentaje": 25.0, "categoria_real_id": "estilo_vida"},
          {"id": "caprichos", "nombre": "Caprichos", "porcentaje": 5.0, "categoria_real_id": "caprichos"},
          {"id": "emergencia_inversion", "nombre": "Fondo de emergencia e inversión", "porcentaje": 20.0, "categoria_real_id": "emergencia_inversion"}
        ]
      },
      "secciones": {
        "ingresos": {"categorias": []},
        "gastos": {"categorias": []},
        "casa": {"categorias": []},
        "real": {"categorias": []},
        "ahorros": {"categorias": []}
      }
    }
  }
}
```

Cada ejercicio dentro del ejemplo es un objeto completo; sus `secciones` se rellenan con las categorías que siguen. `creado` y `actualizado` son fechas ISO-8601 con zona horaria. La clave de cada elemento de `ejercicios` debe ser el mismo año decimal que `anio`. La versión pertenece al documento raíz, no a cada año.

Una categoría tiene ID estable (ASCII, minúsculas, guiones bajos), nombre visible y origen. Las categorías manuales llevan 12 importes ordenados de enero a diciembre:

```json
{
  "id": "ajustes_ingresos",
  "nombre": "Ajustes ingresos",
  "tipo": "manual",
  "afecta_total": true,
  "valores": [null, null, null, null, null, null, null, null, null, null, null, null]
}
```

- `tipo` admite `manual`, `nomina_bruta` y `nomina_neta`. Los dos últimos solo se permiten en `ingresos`, derivan de `nomina` y no guardan `valores`.
- `afecta_total` indica si una categoría manual de `ingresos` entra en el total de ingresos computables. Para `gastos`, `casa`, `real` y `ahorros` el total se obtiene de sus categorías manuales y no se guarda como una categoría adicional.
- `valores` debe tener exactamente 12 elementos. `null` significa mes aún no registrado; `0` significa que sí se registró y el importe fue cero. Las sumas omiten nulos, y el total de una fila/mes/año permanece nulo si no hay ningún importe registrado que sumar.
- Los importes se guardan como números JSON en euros, redondeados a céntimos; nunca como texto localizado. Las entradas manuales admiten negativos para representar ajustes/reversiones. El formato español (`1.234,56 €`) solo se aplica al mostrarlos.
- Renombrar una categoría conserva su ID y sus importes. Los IDs no se reutilizan. Los campos calculados (totales, subtotales, objetivos, porcentajes, nómina derivada) no se persisten.

#### Catálogo inicial de secciones

Estas son las categorías iniciales, no un conjunto cerrado: el usuario podrá añadir categorías manuales y cambiar sus nombres. Los IDs son internos y estables; no dependen del nombre mostrado.

| Clave | Categorías iniciales (nombre visible) | Regla de cómputo |
|---|---|---|
| `ingresos` | `Ingreso Bruto` (`nomina_bruta`), `Ingreso Neto` (`nomina_neta`), `Ajustes ingresos`, `Intereses`, `Gastos fijos devuelto`, `Estilo de vida devuelto`, `Caprichos devuelto` | Bruto es informativo y no suma al total. Neto, ajustes, intereses y devoluciones sí suman. |
| `gastos` | `Transporte y Gasolina`, `Alimentos`, `Vehículos`, `Entrenamiento y Salud`, `Vacaciones`, `Ocio`, `Hobbies`, `Dinero cajero`, `Otros` | Categorías manuales; suman a gastos personales. |
| `casa` | `Hipoteca`, `Agua`, `Luz`, `Gas`, `Internet + móvil`, `Seguro de vida + hogar`, `Comunidad`, `Impuestos`, `Muebles + otros` | Categorías manuales; suman a gastos de casa. |
| `real` | `Gastos fijos esenciales`, `Estilo de vida`, `Caprichos`, `Fondo de emergencia e inversión` | Importes reales mensuales de comparación con el presupuesto. IDs enlazados desde `presupuesto.reglas[].categoria_real_id`. |
| `ahorros` | `Jubilación EPSV`, `Inversión`, `Intereses de inversión`, `Activos físicos`, `Cripto`, `Fondo de emergencia` | Detalle informativo de ahorro; suma en su propio bloque, no se resta de nuevo al calcular el subtotal. |

IDs sugeridos correspondientes al catálogo: `ingreso_bruto`, `ingreso_neto`, `ajustes_ingresos`, `intereses`, `gastos_fijos_devuelto`, `estilo_vida_devuelto`, `caprichos_devuelto`; `transporte_gasolina`, `alimentos`, `vehiculos`, `entrenamiento_salud`, `vacaciones`, `ocio`, `hobbies`, `dinero_cajero`, `otros`; `hipoteca`, `agua`, `luz`, `gas`, `internet_movil`, `seguro_vida_hogar`, `comunidad`, `impuestos`, `muebles_otros`; `esenciales`, `estilo_vida`, `caprichos`, `emergencia_inversion`; `jubilacion_epsv`, `inversion`, `inversion_intereses`, `activos_fisicos`, `cripto`, `fondo_emergencia`.

Al crear un ejercicio no se copiarán importes del ejemplo de la conversación ni datos de una cartera real; solo la estructura, nombres y reglas porcentuales iniciales. Una categoría nueva se añade a una sección, con `tipo: "manual"` y 12 valores nulos. La primera versión permite crear y renombrar categorías; borrar categorías y reglas se deja para una fase posterior para evitar perder datos accidentalmente.

#### Nómina: entradas y cálculos

Entradas anuales editables en `nomina`:

- `bruto_anual`: importe bruto anual.
- `porcentaje_irpf`: tipo de retención porcentual.
- `porcentajes_cotizacion`: porcentajes de contingencias comunes, desempleo y formación profesional; son configurables y no constituyen una regla fiscal universal.
- `meses_pagas_extra`: lista de meses (1–12) en que se abona una paga extra; por defecto julio y diciembre. La cantidad de pagas extra se obtiene de la longitud de la lista.

Para el ejemplo con 2 pagas extra, el bruto anual se reparte entre 14 pagas. Para un ejercicio con `n` extras:

1. `bruto_por_paga = bruto_anual / (12 + n)`.
2. `prorrata_mensual = bruto_por_paga * n / 12`.
3. `base_cotizacion_mensual = bruto_por_paga + prorrata_mensual`.
4. `cotizacion_mensual = base_cotizacion_mensual * suma(porcentajes_cotizacion) / 100`.
5. `retencion_irpf_por_paga = bruto_por_paga * porcentaje_irpf / 100`.
6. `neto_regular = bruto_por_paga - cotizacion_mensual - retencion_irpf_por_paga`.
7. `neto_extra = bruto_por_paga - retencion_irpf_por_paga`; no se vuelve a descontar una cotización mensual de la paga extra.
8. `Ingreso Bruto` de un mes es `bruto_por_paga` más una paga extra si el mes está en `meses_pagas_extra`; `Ingreso Neto` se deriva análogamente de `neto_regular` y `neto_extra`.

Los cálculos operan en decimal, redondean cada importe visible a céntimos (ROUND_HALF_UP) y los totales anuales suman los 12 importes mensuales ya redondeados. Debido a ese redondeo, la suma visible puede diferir del bruto anual de entrada unos céntimos; mostrar la diferencia si la hay en vez de alterar silenciosamente una nómina. IRPF y cotizaciones son estimaciones configurables, no cálculo oficial de nómina, fiscalidad ni asesoramiento.

#### Reglas de presupuesto y fórmulas del panel

- `presupuesto.base` es `neto_regular`: el sueldo neto ordinario calculado para un mes sin paga extra. Las pagas extra no inflan el objetivo mensual habitual.
- Cada regla contiene un `id` estable, nombre editable, porcentaje entre 0 y 100 y `categoria_real_id` que referencia una categoría de `real`. En el perfil inicial son 4 reglas (50/25/5/20) y deben sumar 100 %; no se crearán totales editables.
- `objetivo_mensual = neto_regular * porcentaje / 100`; `objetivo_anual = objetivo_mensual * 12`. Se muestra también la desviación entre valor real y objetivo. Si `neto_regular` es cero o no existe, los objetivos son nulos.
- `total_ingresos_mes` es la suma de categorías `ingresos` con `afecta_total: true`; `Ingreso Bruto` queda fuera para no contar sueldo bruto y neto a la vez.
- `total_gastos_mes` suma `gastos`; `total_casa_mes` suma `casa`.
- `subtotal_mes = total_ingresos_mes - total_gastos_mes - total_casa_mes`.
- `porcentaje_ahorro_mes = subtotal_mes / total_ingresos_mes * 100`; es nulo si no hay ingresos computables o el denominador es cero.
- `real` compara asignación/presupuesto; `ahorros` detalla movimientos de ahorro. Ambos son vistas analíticas separadas: ni `real` ni `ahorros` se vuelven a restar del subtotal. Las devoluciones aparecen en las categorías de ingresos indicadas; los ajustes negativos conservan su signo.
- Totales anuales suman valores mensuales redondeados. Si los datos son parciales, las celdas vacías se ignoran; no se supone que un mes sin dato sea un cero real.

#### Persistencia, validación y copias que implementará esta fase

- Ruta: `PATRIMONIO_DATOS/contabilidad.json`; el valor por defecto sigue la carpeta local usada por la app. No crear archivos bajo `app/`, no mezclar con `cartera.json`, `estado.json`, el histórico de Patrimonio ni el demo.
- Guardado seguro: validar todo el documento antes de modificarlo; escribir temporal en la misma carpeta y sustituir atómicamente. Antes de reemplazar un fichero existente, guardar su versión íntegra en un directorio separado `PATRIMONIO_DATOS/copias_contabilidad/`; retener las últimas 20 copias automáticas de Contabilidad sin tocar las copias de Patrimonio.
- Validar `version == 1`; año entero entre 1950 y 9999, clave y campo `anio` coincidentes; fecha ISO con zona; claves de sección permitidas y completas; IDs y nombres no vacíos y únicos dentro de su ámbito; `tipo` permitido para sección; arrays de 12 valores solo para categorías manuales; importes numéricos finitos (nunca booleanos ni `NaN`/`Infinity`); tasas entre 0 y 100; meses de pagas extra enteros únicos entre 1 y 12; IDs de regla que referencian categorías reales existentes; y porcentajes de reglas que suman 100 % (tolerancia 0,01 puntos).
- Al detectar una versión futura o un documento inválido, fallar con un mensaje claro y no sobrescribirlo. No hay migraciones implantadas: una versión posterior requerirá una migración explícita sobre copia antes de escribir el nuevo formato.

#### Decisiones precisadas por la hoja de ejemplo

- La tabla de nómina representa una configuración de pagas extraordinarias en dos meses; no se conserva una cifra duplicada de bruto/neto como entrada editable.
- `Ingreso Bruto` es informativo; el subtotal usa el neto más ajustes, intereses y devoluciones.
- `REAL` y `AHORROS` no se suman entre ellos ni se descuentan del subtotal. `REAL` es comparación con el presupuesto, mientras `AHORROS` contiene el detalle del destino de ahorro.
- La hoja de ejemplo contiene diferencias de céntimos entre algunas cifras visibles y los totales anuales. La implementación usará las reglas de redondeo anteriores y comprobará el resultado con datos sintéticos antes de considerar cerrada la aceptación.

### 2. Extraer CSS y componentes compartidos

- [x] Extraer el `<style>` inline de `app/web/index.html` a ficheros bajo `app/web/` (tokens/temas, base y componentes; CSS específico por área cuando aporte claridad).
- [x] Sustituir los atributos `style` estáticos de HTML por clases compartidas; reservar estilos inline en JavaScript únicamente para valores dinámicos que vienen de los datos (por ejemplo, colores de productos).
- [x] Mantener idénticos los estilos, el tema claro/oscuro, los breakpoints y el aspecto de Mi Patrimonio durante la extracción.
- [x] Compartir estilos de appbar, tarjetas, tablas, campos, botones, avisos y estados vacíos entre las dos áreas; evitar duplicar reglas.
- [x] Actualizar `app/exportar.py` para incluir los CSS necesarios en el HTML generado y mantenerlo portable como archivo único.
- **Aceptación:** Mi Patrimonio conserva su presentación y el HTML exportado funciona sin depender de hojas externas.

### 3. Añadir almacenamiento y API de Contabilidad

- [x] Implementar un módulo de dominio/almacenamiento propio para años, configuración anual, reglas, categorías e importes mensuales.
- [x] Exponer endpoints independientes para consultar ejercicios, crear uno, consultar un ejercicio y guardar/eliminar datos o categorías.
- [x] Aplicar validación en servidor y respuestas de error coherentes con el resto de la API.
- [x] No persistir silenciosamente sobre la demo de patrimonio ni aceptar escrituras malformadas.
- **API implementada:** `GET/POST /api/contabilidad`, `GET/PUT/DELETE /api/contabilidad/<año>`, `POST /api/contabilidad/<año>/categorias/<seccion>` y `PATCH /api/contabilidad/<año>/categorias/<seccion>/<id>`. El PUT recibe el ejercicio completo; la eliminación se limita al ejercicio, no a categorías.
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
