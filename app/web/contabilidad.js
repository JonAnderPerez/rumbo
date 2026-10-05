/* ============================================================
   contabilidad.js · Edición anual independiente
   ============================================================ */
(function () {
  "use strict";

  const $ = s => document.querySelector(s);
  const raiz = $("#areaContabilidad");
  if (!raiz) return;

  const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const mesesCortos = ["ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic"];
  const categoriasRealCalculadas = new Set([
    "esenciales", "estilo_vida", "caprichos", "emergencia_inversion",
  ]);
  const secciones = [
    ["ingresos", "Ingresos"],
    ["gastos", "Gastos"],
    ["casa", "Gastos de casa"],
    ["real", "Presupuesto «Real»"],
    ["ahorros", "Ahorros"],
  ];
  const nombresCotizacion = {
    contingencias_comunes: "Contingencias comunes",
    desempleo: "Desempleo",
    formacion_profesional: "Formación profesional",
  };
  const estado = {
    anios: [], ejercicio: null, resumen: null, guardando: false,
    pestana: "resumen", vista: "comparativas", resumenesAnuales: new Map(),
  };
  const editor = $("#ctEditor");
  const contenedorAnioTabs = $("#ctAnioTabs");
  const contenedorPestanas = $("#ctTabs");
  const pestanas = [...contenedorPestanas.querySelectorAll("[data-ct-tab]")];
  const panelComparativas = $("#ctComparativas");
  const panelNuevo = $("#ctPanel-nuevo");
  const botonGuardar = $("#ctGuardar");
  const aviso = $("#ctAviso");
  const mensaje = $("#ctEstado");
  const formularioImportar = $("#ctImportarForm");
  const avisoImportar = $("#ctImportarAviso");
  const vistaImportar = $("#ctImportarVista");
  const botonImportar = $("#ctImportarConfirmar");
  const resumenImportar = $("#ctImportarResumen");
  const listaCategoriasImportar = $("#ctImportarCategorias");
  const listaAdvertenciasImportar = $("#ctImportarAdvertencias");
  const campoPrompt = $("#ctPromptIA");
  const campoJsonImportar = $("#ctJsonImportar");
  const archivoJsonImportar = $("#ctArchivoImportar");
  let planImportacion = null;
  let aniosExistentesImportacion = [];
  const limpio = valor => String(valor == null ? "" : valor).replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const formato = valor => valor == null ? "" : Number(valor).toLocaleString("es-ES", {
    maximumFractionDigits: 2,
  });
  const euros = valor => valor == null ? "—" : Number(valor).toLocaleString("es-ES", {
    style: "currency", currency: "EUR", maximumFractionDigits: 2,
  });
  const porcentaje = valor => valor == null ? "—" :
    `${Number(valor).toLocaleString("es-ES", { maximumFractionDigits: 2 })} %`;

  function claseIndicadorAnual(valor, tipo) {
    if (valor == null || !Number.isFinite(Number(valor))) return "";
    const numero = Number(valor);
    if (tipo === "porcentaje") {
      return numero >= 30 ? "ct-positivo" : numero >= 20 ? "ct-aviso" : "ct-negativo";
    }
    return numero < 0 ? "ct-negativo" : numero > 0 ? "ct-positivo" : "";
  }

  function claseRealPresupuesto(real, objetivo, esAhorro) {
    if (real == null || objetivo == null ||
        !Number.isFinite(Number(real)) || !Number.isFinite(Number(objetivo))) return "";
    const dentroDelObjetivo = esAhorro
      ? Number(real) >= Number(objetivo)
      : Number(real) <= Number(objetivo);
    return dentroDelObjetivo ? "ct-positivo" : "ct-negativo";
  }

  function muestraPestana(id) {
    const seleccionada = pestanas.find(pestana => pestana.dataset.ctTab === id);
    if (!seleccionada) return;
    estado.pestana = id;
    pestanas.forEach(pestana => {
      const activa = pestana === seleccionada;
      pestana.setAttribute("aria-selected", String(activa));
      pestana.tabIndex = activa ? 0 : -1;
    });
    editor.querySelectorAll("[data-ct-panel]").forEach(panel => {
      panel.hidden = panel.dataset.ctPanel !== id;
    });
    editor.hidden = estado.vista !== "ejercicio" || !estado.ejercicio;
    contenedorPestanas.hidden = estado.vista !== "ejercicio";
    programaGraficos();
  }

  pestanas.forEach((pestana, indice) => {
    pestana.addEventListener("click", () => muestraPestana(pestana.dataset.ctTab));
    pestana.addEventListener("keydown", evento => {
      let siguiente = indice;
      if (evento.key === "ArrowRight") siguiente = (indice + 1) % pestanas.length;
      else if (evento.key === "ArrowLeft") siguiente = (indice - 1 + pestanas.length) % pestanas.length;
      else if (evento.key === "Home") siguiente = 0;
      else if (evento.key === "End") siguiente = pestanas.length - 1;
      else return;
      evento.preventDefault();
      pestanas[siguiente].focus();
      muestraPestana(pestanas[siguiente].dataset.ctTab);
    });
  });

  async function api(metodo, url, cuerpo) {
    const respuesta = await fetch(url, {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    let datos = {};
    try { datos = await respuesta.json(); } catch (error) {
      throw new Error("El servidor devolvió una respuesta que no se puede leer.");
    }
    if (!respuesta.ok || datos.ok === false) {
      throw new Error((datos.errores || [datos.error || "No se pudo completar la operación."]).join("\n"));
    }
    return datos;
  }

  function muestraError(error) {
    aviso.textContent = error && error.message || "No se pudo completar la operación.";
    aviso.hidden = false;
    mensaje.textContent = "";
  }

  function limpiaError() {
    aviso.textContent = "";
    aviso.hidden = true;
  }

  function marcaSucia() {
    if (!estado.ejercicio) return;
    window.CONTABILIDAD_SUCIO = true;
    botonGuardar.disabled = false;
    mensaje.textContent = "Hay cambios sin guardar.";
  }

  function bloqueaEdicion(bloqueada) {
    $("#ctCrearForm").querySelectorAll("input, button")
      .forEach(campo => { campo.disabled = bloqueada; });
    editor.querySelectorAll("input, button")
      .forEach(campo => { campo.disabled = bloqueada; });
    botonGuardar.disabled = bloqueada || !estado.ejercicio || !window.CONTABILIDAD_SUCIO;
  }

  function celdaImporte(categoria, mes, seccion, resumen, reglaPresupuesto) {
    const calculada = categoria.tipo !== "manual" ||
      (seccion === "real" && categoriasRealCalculadas.has(categoria.id));
    if (calculada) {
      const valor = resumen.categorias[categoria.id].mensual[mes];
      const clase = reglaPresupuesto
        ? claseRealPresupuesto(valor, reglaPresupuesto.objetivo_mensual,
          reglaPresupuesto.categoria_real_id === "emergencia_inversion")
        : "";
      return `<td class="ct-calculado ${clase}" aria-label="Importe calculado: ${euros(valor)}">${euros(valor)}</td>`;
    }
    const valor = categoria.valores[mes] == null ? "" : formato(categoria.valores[mes]);
    return `<td><input class="ct-importe" type="text" inputmode="decimal"
      data-ct-section="${seccion}" data-ct-category="${limpio(categoria.id)}" data-ct-month="${mes}"
      value="${limpio(valor)}" aria-label="${limpio(categoria.nombre)}, ${meses[mes]}, euros"
      placeholder="—"></td>`;
  }

  function tablaSeccion(seccion, titulo, ejercicio, calculo, reglasPresupuesto) {
    const categorias = ejercicio.secciones[seccion].categorias;
    const nota = seccion === "ingresos"
      ? "La nómina bruta y neta se calculan desde la configuración salarial; los importes mensuales importados se guardan como datos manuales de ese ejercicio."
      : seccion === "real"
        ? "Las cuatro asignaciones iniciales se derivan de los gastos, devoluciones y ahorros; se muestran como solo lectura."
        : "Importes en euros; deja vacío un mes sin registrar.";
    const filas = categorias.map(categoria => {
      const regla = seccion === "real"
        ? reglasPresupuesto.find(item => item.categoria_real_id === categoria.id)
        : null;
      const esAhorro = regla?.categoria_real_id === "emergencia_inversion";
      const anual = calculo.categorias[categoria.id].anual;
      const claseAnual = regla
        ? claseRealPresupuesto(anual, regla.objetivo_anual, esAhorro) : "";
      return `<tr>
        <td class="ct-nombre">
          <input type="text" data-ct-name="${seccion}" data-ct-category="${limpio(categoria.id)}"
            value="${limpio(categoria.nombre)}" aria-label="Nombre de categoría: ${limpio(categoria.nombre)}"
            maxlength="80">
        </td>
        ${meses.map((_, mes) =>
          celdaImporte(categoria, mes, seccion, calculo, regla)
        ).join("")}
        <td class="ct-anual ${claseAnual}">${euros(anual)}</td>
      </tr>`;
    }).join("");
    const total = `<tr class="ct-total"><th scope="row">${
      seccion === "ingresos" ? "Total ingresos computables" : `Total ${titulo.toLowerCase()}`
    }</th>${calculo.total_mensual.map(valor => `<td>${euros(valor)}</td>`).join("")}
      <td class="ct-anual">${euros(calculo.total_anual)}</td></tr>`;
    const formularioAnadir = seccion === "real" ? "" : `<form class="ct-anadir" data-ct-add="${seccion}">
        <label for="ctNueva-${seccion}">Añadir categoría a ${titulo.toLowerCase()}</label>
        <input id="ctNueva-${seccion}" name="nombre" type="text" maxlength="80" required
          placeholder="Nombre de categoría">
        <button class="btn" type="submit">Añadir categoría</button>
      </form>`;
    return `<section class="tarjeta">
      <header><h2>${titulo}</h2><span class="subt">${nota}</span></header>
      <div class="ct-grid" role="region" aria-label="${titulo}, tabla mensual" tabindex="0">
        <table><thead><tr><th scope="col">Categoría</th>
          ${meses.map(mes => `<th scope="col">${mes}</th>`).join("")}<th scope="col">Total año</th>
        </tr></thead><tbody>${filas}${total}</tbody></table>
      </div>
      ${formularioAnadir}
    </section>`;
  }

  function entrada(etiqueta, valor, ruta, sufijo, atributos) {
    return `<label>${etiqueta}<span class="ct-unidad">
      <input type="text" inputmode="decimal" data-ct-path="${ruta}" value="${limpio(formato(valor))}"
        aria-label="${etiqueta}" ${atributos || ""}>${sufijo ? `<span>${sufijo}</span>` : ""}
    </span></label>`;
  }

  function pinta(ejercicio) {
    const nomina = ejercicio.nomina;
    const resumen = estado.resumen;
    const nominaImportada = ejercicio.secciones.ingresos.categorias.some(categoria =>
      ["ingreso_bruto", "ingreso_neto"].includes(categoria.id) && categoria.tipo === "manual"
    );
    const extras = meses.map((mes, indice) => `<label>
      <input type="checkbox" data-ct-paga="${indice + 1}"${nomina.meses_pagas_extra.includes(indice + 1) ? " checked" : ""}>
      ${mes}
    </label>`).join("");
    const reglas = ejercicio.presupuesto.reglas.map((regla, indice) => `
      <div class="ct-regla">
        <input type="text" data-ct-text-path="presupuesto.reglas[${indice}].nombre" value="${limpio(regla.nombre)}"
          maxlength="80" aria-label="Nombre de la regla ${indice + 1}">
        <span class="ct-porcentaje">
          <input type="text" inputmode="decimal" data-ct-path="presupuesto.reglas[${indice}].porcentaje"
            value="${limpio(formato(regla.porcentaje))}" aria-label="Porcentaje de ${limpio(regla.nombre)}">
          <span>%</span>
        </span>
        <span class="ct-regla-categoria subt">Real: ${limpio(
          ejercicio.secciones.real.categorias.find(c => c.id === regla.categoria_real_id)?.nombre || regla.categoria_real_id
        )}</span>
      </div>`).join("");

    const metricasNomina = [
      ["Bruto por paga", resumen.nomina.bruto_por_paga],
      ["Prorrata mensual", resumen.nomina.prorrata_mensual],
      ["Base de cotización mensual", resumen.nomina.base_cotizacion_mensual],
      ["Cotización mensual estimada", resumen.nomina.cotizacion_mensual],
      ["Retención IRPF por paga", resumen.nomina.retencion_irpf_por_paga],
      ["Neto regular", resumen.nomina.neto_regular],
      ["Neto de paga extra", resumen.nomina.neto_extra],
      ["Bruto anual visible", resumen.nomina.bruto_anual_visible],
      ["Diferencia frente al bruto anual", resumen.nomina.diferencia_bruto_anual],
    ].map(([etiqueta, valor]) => `<div><dt>${etiqueta}</dt><dd>${euros(valor)}</dd></div>`).join("");
    const presupuesto = resumen.presupuesto.reglas.map(regla => {
      const norma = ejercicio.presupuesto.reglas.find(item => item.id === regla.id);
      const categoria = ejercicio.secciones.real.categorias
        .find(item => item.id === regla.categoria_real_id);
      const celdas = meses.map((mes, indice) => `<td class="ct-presupuesto-mes">
        <span>Real: ${euros(regla.real_mensual[indice])}</span>
        <span>Objetivo: ${euros(regla.objetivo_mensual)}</span>
        <b>Desviación: ${euros(regla.desviacion_mensual[indice])}</b>
      </td>`).join("");
      return `<tr><th scope="row">${limpio(norma.nombre)}<small>${limpio(categoria.nombre)}</small></th>
        <td>${euros(regla.objetivo_mensual)}</td><td>${euros(regla.objetivo_anual)}</td>
        <td>${euros(regla.real_anual)}</td><td>${euros(regla.desviacion_anual)}</td>${celdas}</tr>`;
    }).join("");
    const resumenFilas = [
      ["Ingresos computables", resumen.secciones.ingresos.total_mensual,
        resumen.secciones.ingresos.total_anual, "dinero"],
      ["Gastos personales", resumen.secciones.gastos.total_mensual,
        resumen.secciones.gastos.total_anual, "dinero"],
      ["Gastos de casa", resumen.secciones.casa.total_mensual,
        resumen.secciones.casa.total_anual, "dinero"],
      ["Subtotal disponible", resumen.subtotal_mensual, resumen.subtotal_anual, "dinero"],
      ["Porcentaje de ahorro", resumen.porcentaje_ahorro_mensual,
        resumen.porcentaje_ahorro_anual, "porcentaje"],
    ].map(([etiqueta, valores, anual, tipo]) => {
      const usaColor = etiqueta === "Subtotal disponible" || tipo === "porcentaje";
      return `<tr><th scope="row">${etiqueta}</th>
      ${valores.map(valor => {
        const clase = usaColor
          ? claseIndicadorAnual(valor, tipo) : "";
        return `<td class="${clase}">${tipo === "porcentaje" ? porcentaje(valor) : euros(valor)}</td>`;
      }).join("")}
      <td class="ct-anual ${usaColor ? claseIndicadorAnual(anual, tipo) : ""}">
        ${tipo === "porcentaje" ? porcentaje(anual) : euros(anual)}</td></tr>`;
    }).join("");
    const colores = [G.css("--s1"), G.css("--s2"), G.css("--s3"), G.css("--s4")];
    const leyenda = elementos => `<ul class="ct-leyenda">${elementos.map(item =>
      `<li><span style="background:${item.color}"></span>${limpio(item.nombre)}</li>`
    ).join("")}</ul>`;
    const comparacionGraficos = resumen.presupuesto.reglas.map((regla, indice) => {
      const norma = ejercicio.presupuesto.reglas.find(item => item.id === regla.id);
      return `<figure class="ct-grafico-grupo">
        <figcaption>${limpio(norma.nombre)}</figcaption>
        <div class="ct-grafico" data-ct-grafico-regla="${limpio(regla.id)}"
          role="img" aria-label="Objetivo y gasto real mensual: ${limpio(norma.nombre)}"></div>
        ${leyenda([
          { nombre: "Objetivo", color: G.css("--tinta3") },
          { nombre: "Real", color: colores[indice % colores.length] },
        ])}
      </figure>`;
    }).join("");
    const tablas = Object.fromEntries(secciones.map(([clave, titulo]) =>
      [clave, tablaSeccion(
        clave, titulo, ejercicio, resumen.secciones[clave], resumen.presupuesto.reglas
      )]
    ));

    editor.innerHTML = `<div class="ct-editor">
      <section class="ct-panel" id="ctPanel-resumen" role="tabpanel" tabindex="0"
        aria-labelledby="ctTab-resumen" data-ct-panel="resumen">
        <section class="tarjeta">
          <header><h2>Total y subtotal</h2>
            <span class="subt">Subtotal = ingresos computables − gastos personales − gastos de casa.</span>
          </header>
          <div class="ct-grafico-resumen">
            <div class="ct-grafico" id="ctGrafTendencia" role="img"
              aria-label="Evolución mensual de ingresos, gastos personales, gastos de casa y subtotal"></div>
            ${leyenda([
              { nombre: "Ingresos", color: colores[0] },
              { nombre: "Gastos personales", color: colores[1] },
              { nombre: "Gastos de casa", color: colores[2] },
              { nombre: "Subtotal", color: colores[3] },
            ])}
          </div>
          <div class="ct-grid" role="region" aria-label="Resumen mensual y anual" tabindex="0">
            <table><thead><tr><th scope="col">Resumen</th>
              ${meses.map(mes => `<th scope="col">${mes}</th>`).join("")}<th scope="col">Total año</th>
            </tr></thead><tbody>${resumenFilas}</tbody></table>
          </div>
          <p class="ct-nota">Porcentaje de ahorro = subtotal ÷ ingresos computables × 100; no se calcula si los ingresos son cero. Los gastos de casa sin registro se consideran 0; los meses sin datos de ingresos o gastos personales no se tratan como cero. El subtotal anual y su tasa usan los mismos meses completos. «Real» y «Ahorros» se muestran aparte y no se restan de nuevo.</p>
        </section>
      </section>
      <section class="ct-panel" id="ctPanel-nomina" role="tabpanel" tabindex="0"
        aria-labelledby="ctTab-nomina" data-ct-panel="nomina" hidden>
        <section class="tarjeta">
          <header><h2>Nómina y configuración salarial</h2>
            <span class="subt">${nominaImportada
              ? "Las estimaciones usan esta configuración, pero no recalculan las filas de nómina importadas como datos mensuales."
              : "Estimaciones configurables; no representan una nómina oficial ni asesoramiento fiscal."}</span>
          </header>
          <div class="ct-nomina">
            ${entrada("Bruto anual", nomina.bruto_anual, "nomina.bruto_anual", "€", 'data-ct-vacio="si"')}
            ${entrada("Retención de IRPF", nomina.porcentaje_irpf, "nomina.porcentaje_irpf", "%")}
            ${Object.entries(nomina.porcentajes_cotizacion).map(([clave, valor]) =>
              entrada(nombresCotizacion[clave], valor, `nomina.porcentajes_cotizacion.${clave}`, "%")
            ).join("")}
          </div>
          <fieldset class="ct-pagas"><legend>Meses con paga extra</legend>${extras}</fieldset>
          <dl class="ct-metricas">${metricasNomina}</dl>
          <details class="ct-formulas"><summary>Cómo se estima la nómina</summary>
            <p>Bruto por paga = bruto anual ÷ (12 + pagas extra). La prorrata mensual es bruto por paga × pagas extra ÷ 12.</p>
            <p>Base de cotización = bruto por paga + prorrata. Cotización = base × suma de tasas configuradas. Retención = bruto por paga × IRPF.</p>
            <p>Neto regular = bruto por paga − cotización mensual − retención. Neto extra = bruto por paga − retención. Cada importe visible se redondea a céntimos.</p>
            <p>El bruto anual visible suma las mensualidades redondeadas; la diferencia frente a la entrada se muestra sin ajustar la nómina.</p>
          </details>
        </section>
      </section>
      <section class="ct-panel" id="ctPanel-ingresos" role="tabpanel" tabindex="0"
        aria-labelledby="ctTab-ingresos" data-ct-panel="ingresos" hidden>
        ${tablas.ingresos}
      </section>
      <section class="ct-panel" id="ctPanel-gastos" role="tabpanel" tabindex="0"
        aria-labelledby="ctTab-gastos" data-ct-panel="gastos" hidden>
        ${tablas.gastos}
        ${tablas.casa}
      </section>
      <section class="ct-panel" id="ctPanel-presupuesto" role="tabpanel" tabindex="0"
        aria-labelledby="ctTab-presupuesto" data-ct-panel="presupuesto" hidden>
        <section class="tarjeta">
          <header><h2>Reglas del presupuesto</h2>
            <span class="subt">Objetivo mensual = neto regular × porcentaje; objetivo anual = mensual × 12. Desviación = real − objetivo; un valor positivo supera el objetivo.</span>
          </header>
          <div class="ct-reglas">${reglas}</div>
          <div class="ct-grid ct-comparacion" role="region" aria-label="Comparación mensual y anual del presupuesto" tabindex="0">
            <table><thead><tr><th scope="col">Grupo</th><th scope="col">Objetivo/mes</th>
              <th scope="col">Objetivo/año</th><th scope="col">Real/año</th><th scope="col">Desviación/año</th>
              ${meses.map(mes => `<th scope="col">${mes}</th>`).join("")}
            </tr></thead><tbody>${presupuesto}</tbody></table>
          </div>
          <p class="ct-nota">«Real» se calcula desde los movimientos de origen: esenciales incluyen vivienda (sin muebles/otros), transporte, alimentos y vehículos; estilo de vida incluye salud, vacaciones, ocio, cajero, otros y muebles/otros; caprichos corresponde a hobbies; emergencia e inversión suma los ahorros. Las devoluciones restan del grupo asociado.</p>
          <div class="ct-graficos-presupuesto">${comparacionGraficos}</div>
        </section>
        ${tablas.real}
      </section>
      <section class="ct-panel" id="ctPanel-ahorros" role="tabpanel" tabindex="0"
        aria-labelledby="ctTab-ahorros" data-ct-panel="ahorros" hidden>
        ${tablas.ahorros}
      </section>
    </div>`;
    editor.hidden = false;
    muestraPestana(estado.pestana);
  }

  let temporizadorGraficos = null;
  function dibujaGraficos() {
    if (raiz.hidden || editor.hidden || !window.G) return;
    const resumen = estado.resumen;
    const ejercicio = estado.ejercicio;
    const tendencia = $("#ctGrafTendencia");
    const fechas = meses.map((_, indice) =>
      `${ejercicio.anio}-${String(indice + 1).padStart(2, "0")}-01`);
    const colores = [G.css("--s1"), G.css("--s2"), G.css("--s3"), G.css("--s4")];
    if (tendencia && tendencia.clientWidth > 0) {
      G.multiLinea(tendencia, {
        fechas,
        alto: 280,
        formatoY: G.fmtEurCorto,
        formatoValor: G.fmtEur,
        series: [
          { nombre: "Ingresos", valores: resumen.secciones.ingresos.total_mensual, color: colores[0] },
          { nombre: "Gastos personales", valores: resumen.secciones.gastos.total_mensual, color: colores[1] },
          { nombre: "Gastos de casa", valores: resumen.secciones.casa.total_mensual, color: colores[2] },
          { nombre: "Subtotal", valores: resumen.subtotal_mensual, color: colores[3], destacado: true },
        ],
      });
    }
    resumen.presupuesto.reglas.forEach((regla, indice) => {
      const grafico = [...editor.querySelectorAll("[data-ct-grafico-regla]")]
        .find(elemento => elemento.dataset.ctGraficoRegla === regla.id);
      if (!grafico || grafico.clientWidth === 0) return;
      const objetivo = regla.objetivo_mensual == null
        ? Array(12).fill(null)
        : Array(12).fill(regla.objetivo_mensual);
      if (![...objetivo, ...regla.real_mensual].some(valor => valor != null)) {
        grafico.innerHTML = '<p class="vacio">Sin datos suficientes para comparar.</p>';
        return;
      }
      G.barrasAgrupadas(grafico, {
        categorias: mesesCortos,
        alto: 190,
        formatoValor: G.fmtEur,
        formatoY: G.fmtEurCorto,
        series: [
          { nombre: "Objetivo", valores: objetivo, color: G.css("--tinta3") },
          { nombre: "Real", valores: regla.real_mensual, color: colores[indice % colores.length] },
        ],
      });
    });
  }

  function programaGraficos() {
    requestAnimationFrame(() => {
      dibujaGraficos();
      dibujaComparativas();
    });
  }

  function pintaSelector() {
    const conservarFoco = contenedorAnioTabs.contains(document.activeElement);
    const activa = estado.vista === "ejercicio" ? String(estado.ejercicio && estado.ejercicio.anio) : estado.vista;
    contenedorAnioTabs.innerHTML = [
      `<button class="ct-tab" id="ctTab-comparativas" type="button" role="tab"
        aria-selected="${estado.vista === "comparativas"}" aria-controls="ctComparativas"
        tabindex="${estado.vista === "comparativas" ? "0" : "-1"}" data-ct-view="comparativas">Comparativas</button>`,
      ...estado.anios.map(anio => `<button class="ct-tab" id="ctTab-anio-${anio}" type="button" role="tab"
        aria-selected="${activa === String(anio)}" aria-controls="ctEditor"
        tabindex="${activa === String(anio) ? "0" : "-1"}" data-ct-year="${anio}">${anio}</button>`),
      `<button class="ct-tab" id="ctTab-anadir" type="button" role="tab"
        aria-selected="${estado.vista === "nuevo"}" aria-controls="ctPanel-nuevo"
        tabindex="${estado.vista === "nuevo" ? "0" : "-1"}" data-ct-view="nuevo">+ Añadir año</button>`,
    ].join("");
    if (conservarFoco) contenedorAnioTabs.querySelector('[aria-selected="true"]').focus();
    panelComparativas.hidden = estado.vista !== "comparativas";
    panelNuevo.hidden = estado.vista !== "nuevo";
    contenedorPestanas.hidden = estado.vista !== "ejercicio";
    editor.hidden = estado.vista !== "ejercicio" || !estado.ejercicio;
    botonGuardar.disabled = estado.vista !== "ejercicio" || !estado.ejercicio || !window.CONTABILIDAD_SUCIO;
  }

  async function cargaAnios() {
    const datos = await api("GET", "api/contabilidad");
    estado.anios = datos.anios;
    pintaSelector();
    if (estado.anios.length) {
      await cargaComparativas();
    } else {
      $("#ctComparativasEstado").textContent = "Aún no hay ejercicios para comparar.";
      mensaje.textContent = "Crea un ejercicio para empezar.";
    }
  }

  async function cargaEjercicio(anio) {
    const datos = await api("GET", `api/contabilidad/${anio}`);
    estado.ejercicio = datos.ejercicio;
    estado.resumen = datos.resumen;
    estado.resumenesAnuales.set(anio, datos.resumen);
    estado.vista = "ejercicio";
    window.CONTABILIDAD_SUCIO = false;
    pintaSelector();
    pinta(estado.ejercicio);
    botonGuardar.disabled = true;
    limpiaError();
    mensaje.textContent = `Ejercicio ${anio}. Los meses vacíos aún no tienen datos registrados.`;
  }

  async function cargaComparativas() {
    $("#ctComparativasEstado").textContent = "Cargando comparativas…";
    const pendientes = estado.anios.filter(anio => !estado.resumenesAnuales.has(anio));
    const resultados = await Promise.all(pendientes.map(async anio => {
      const datos = await api("GET", `api/contabilidad/${anio}`);
      return [anio, datos.resumen];
    }));
    resultados.forEach(([anio, resumen]) => estado.resumenesAnuales.set(anio, resumen));
    pintaComparativas();
  }

  function datosComparativa(resumen) {
    const importe = valor => valor == null ? 0 : Number(valor);
    const ingresos = importe(resumen.secciones.ingresos.total_anual);
    const gastos = importe(resumen.secciones.gastos.total_anual);
    const casa = importe(resumen.secciones.casa.total_anual);
    const subtotal = ingresos - gastos - casa;
    return {
      ingresos,
      gastos,
      casa,
      subtotal,
      porcentajeAhorro: ingresos === 0 ? null : subtotal / ingresos * 100,
    };
  }

  function pintaComparativas() {
    const filas = estado.anios.map(anio => {
      const resumen = estado.resumenesAnuales.get(anio);
      if (!resumen) return "";
      const datos = datosComparativa(resumen);
      return `<tr><th scope="row">${anio}</th>
        <td>${euros(datos.ingresos)}</td>
        <td>${euros(datos.gastos)}</td>
        <td>${euros(datos.casa)}</td>
        <td>${euros(datos.subtotal)}</td>
        <td>${porcentaje(datos.porcentajeAhorro)}</td></tr>`;
    }).join("");
    $("#ctComparativasFilas").innerHTML = filas;
    $("#ctComparativasEstado").textContent = estado.anios.length
      ? `${estado.anios.length} ${estado.anios.length === 1 ? "ejercicio disponible" : "ejercicios disponibles"}.`
      : "Aún no hay ejercicios para comparar.";
    programaGraficos();
  }

  function dibujaComparativas() {
    if (estado.vista !== "comparativas" || !window.G) return;
    const anios = estado.anios.filter(anio => estado.resumenesAnuales.has(anio));
    const resumenes = anios.map(anio => estado.resumenesAnuales.get(anio));
    const datos = resumenes.map(datosComparativa);
    const colores = [G.css("--s1"), G.css("--s2"), G.css("--s3"), G.css("--s4")];
    const series = [
      ["Ingresos", "ingresos"],
      ["Gastos personales", "gastos"],
      ["Gastos de casa", "casa"],
      ["Subtotal disponible", "subtotal"],
    ].map(([nombre, campo], indice) => ({
      nombre, valores: datos.map(resumen => resumen[campo]), color: colores[indice],
    }));
    const importes = $("#ctGrafComparativaImportes");
    if (importes.clientWidth > 0) {
      G.barrasAgrupadas(importes, {
        categorias: anios.map(String), alto: 250, formatoValor: G.fmtEur,
        formatoY: G.fmtEurCorto, mostrarTotal: false, series,
      });
    }
    const ahorro = $("#ctGrafComparativaAhorro");
    if (ahorro.clientWidth > 0) {
      G.barrasAgrupadas(ahorro, {
        categorias: anios.map(String), alto: 250, formatoValor: porcentaje,
        formatoY: porcentaje, series: [{
          nombre: "Ahorro", valores: datos.map(resumen => resumen.porcentajeAhorro),
          color: colores[3],
        }],
      });
    }
    $("#ctLeyendaComparativaImportes").innerHTML = series.map(serie =>
      `<li><span style="background:${serie.color}"></span>${limpio(serie.nombre)}</li>`
    ).join("");
  }

  function parseaNumero(texto) {
    let limpioTexto = String(texto).trim().replace(/[€%\s]/g, "");
    if (!limpioTexto) return null;
    if (limpioTexto.includes(",")) {
      limpioTexto = limpioTexto.replace(/\./g, "").replace(",", ".");
    } else if (/^-?\d{1,3}(\.\d{3})+$/.test(limpioTexto)) {
      limpioTexto = limpioTexto.replace(/\./g, "");
    }
    if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(limpioTexto)) return NaN;
    const numero = Number(limpioTexto);
    return Number.isFinite(numero) ? numero : NaN;
  }

  function asignaRuta(objeto, ruta, valor) {
    const partes = ruta.replace(/\[(\d+)\]/g, ".$1").split(".");
    let actual = objeto;
    partes.slice(0, -1).forEach(parte => {
      actual = actual[parte];
    });
    actual[partes[partes.length - 1]] = valor;
  }

  function preparaEjercicio() {
    const candidato = JSON.parse(JSON.stringify(estado.ejercicio));
    const entradas = [...editor.querySelectorAll("[data-ct-path], .ct-importe")];
    for (const campo of entradas) {
      const numero = parseaNumero(campo.value);
      const vacioPermitido = campo.dataset.ctVacio === "si" ||
        campo.classList.contains("ct-importe");
      if (Number.isNaN(numero) || (numero === null && !vacioPermitido)) {
        campo.setCustomValidity("Introduce un número válido; usa coma para los decimales.");
        campo.reportValidity();
        campo.focus();
        return null;
      }
      campo.setCustomValidity("");
      if (campo.dataset.ctPath) {
        asignaRuta(candidato, campo.dataset.ctPath, numero);
      } else {
        const categoria = candidato.secciones[campo.dataset.ctSection].categorias
          .find(c => c.id === campo.dataset.ctCategory);
        categoria.valores[Number(campo.dataset.ctMonth)] = numero;
      }
    }
    editor.querySelectorAll("[data-ct-name]").forEach(campo => {
      const categoria = candidato.secciones[campo.dataset.ctName].categorias
        .find(c => c.id === campo.dataset.ctCategory);
      categoria.nombre = campo.value.trim();
    });
    editor.querySelectorAll("[data-ct-text-path]").forEach(campo => {
      asignaRuta(candidato, campo.dataset.ctTextPath, campo.value.trim());
    });
    candidato.nomina.meses_pagas_extra = [...editor.querySelectorAll("[data-ct-paga]:checked")]
      .map(campo => Number(campo.dataset.ctPaga));
    return candidato;
  }

  async function guarda() {
    if (!estado.ejercicio || estado.guardando) return false;
    const candidato = preparaEjercicio();
    if (!candidato) return false;
    estado.guardando = true;
    bloqueaEdicion(true);
    botonGuardar.textContent = "Guardando…";
    limpiaError();
    try {
      const datos = await api("PUT", `api/contabilidad/${candidato.anio}`, candidato);
      estado.ejercicio = datos.ejercicio;
      estado.resumen = datos.resumen;
      estado.resumenesAnuales.set(candidato.anio, datos.resumen);
      window.CONTABILIDAD_SUCIO = false;
      pinta(estado.ejercicio);
      pintaComparativas();
      mensaje.textContent = `Ejercicio ${candidato.anio} guardado.`;
      return true;
    } catch (error) {
      muestraError(error);
      botonGuardar.disabled = false;
      return false;
    } finally {
      estado.guardando = false;
      botonGuardar.textContent = "Guardar cambios";
      bloqueaEdicion(false);
    }
  }

  function idNuevo(seccion) {
    const base = `nueva_${seccion}_${Date.now()}`;
    const usados = new Set(estado.ejercicio.secciones[seccion].categorias.map(c => c.id));
    let id = base, sufijo = 2;
    while (usados.has(id)) id = `${base}_${sufijo++}`;
    return id;
  }

  botonGuardar.addEventListener("click", guarda);
  async function seleccionaVista(vista, anio) {
    if (anio != null) {
      if (estado.ejercicio && estado.ejercicio.anio === anio) {
        estado.vista = "ejercicio";
        pintaSelector();
        programaGraficos();
        return;
      }
      if (window.CONTABILIDAD_SUCIO &&
          !confirm("Hay cambios sin guardar. ¿Descartarlos y cambiar de ejercicio?")) return;
      if (window.CONTABILIDAD_SUCIO) window.CONTABILIDAD_SUCIO = false;
      try {
        limpiaError();
        await cargaEjercicio(anio);
      } catch (error) {
        muestraError(error);
      }
      return;
    }
    if (vista === "comparativas" && window.CONTABILIDAD_SUCIO) {
      if (!confirm("Hay cambios sin guardar. ¿Descartarlos y ver las comparativas?")) return;
      window.CONTABILIDAD_SUCIO = false;
    }
    estado.vista = vista;
    pintaSelector();
    if (vista === "comparativas") {
      try {
        limpiaError();
        await cargaComparativas();
      } catch (error) {
        $("#ctComparativasEstado").textContent = "No se pudieron cargar las comparativas.";
        muestraError(error);
      }
    } else {
      programaGraficos();
    }
  }

  contenedorAnioTabs.addEventListener("click", evento => {
    const tab = evento.target.closest("[role='tab']");
    if (!tab || !contenedorAnioTabs.contains(tab)) return;
    if (tab.dataset.ctYear) seleccionaVista("ejercicio", Number(tab.dataset.ctYear));
    else seleccionaVista(tab.dataset.ctView);
  });
  contenedorAnioTabs.addEventListener("keydown", evento => {
    const tabs = [...contenedorAnioTabs.querySelectorAll("[role='tab']")];
    const indice = tabs.indexOf(evento.target);
    if (indice < 0) return;
    let siguiente = indice;
    if (evento.key === "ArrowRight") siguiente = (indice + 1) % tabs.length;
    else if (evento.key === "ArrowLeft") siguiente = (indice - 1 + tabs.length) % tabs.length;
    else if (evento.key === "Home") siguiente = 0;
    else if (evento.key === "End") siguiente = tabs.length - 1;
    else return;
    evento.preventDefault();
    tabs[siguiente].focus();
    if (tabs[siguiente].dataset.ctYear) {
      seleccionaVista("ejercicio", Number(tabs[siguiente].dataset.ctYear));
    } else {
      seleccionaVista(tabs[siguiente].dataset.ctView);
    }
  });

  $("#ctCrearForm").addEventListener("submit", async evento => {
    evento.preventDefault();
    if (window.CONTABILIDAD_SUCIO && !await guarda()) return;
    const anio = Number($("#ctNuevoAnio").value);
    try {
      limpiaError();
      const datos = await api("POST", "api/contabilidad", { anio });
      estado.anios.push(datos.ejercicio.anio);
      estado.anios.sort((a, b) => b - a);
      await cargaEjercicio(datos.ejercicio.anio);
      $("#ctNuevoAnio").value = "";
    } catch (error) {
      muestraError(error);
    }
  });

  formularioImportar.addEventListener("submit", async evento => {
    evento.preventDefault();
    const archivo = archivoJsonImportar.files[0];
    const textoJson = campoJsonImportar.value.trim();
    planImportacion = null;
    aniosExistentesImportacion = [];
    vistaImportar.hidden = true;
    avisoImportar.hidden = true;
    if (!textoJson && !archivo) {
      avisoImportar.textContent = "Pega el JSON de la IA o selecciona un archivo .json.";
      avisoImportar.hidden = false;
      return;
    }
    formularioImportar.querySelectorAll("input, button, textarea")
      .forEach(campo => { campo.disabled = true; });
    const botonRevisar = formularioImportar.querySelector('button[type="submit"]');
    botonRevisar.textContent = "Revisando…";
    try {
      const contenido = textoJson || await archivo.text();
      const respuesta = await fetch("api/contabilidad/importar/previsualizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: contenido,
      });
      let datos = {};
      try { datos = await respuesta.json(); } catch (error) {
        throw new Error("El servidor devolvió una respuesta que no se puede leer.");
      }
      if (!respuesta.ok || datos.ok === false) {
        throw new Error((datos.errores || ["No se pudo revisar el JSON."]).join("\n"));
      }
      planImportacion = datos.plan;
      const aniosExistentes = datos.ejercicios.filter(ejercicio => ejercicio.existente)
        .map(ejercicio => ejercicio.anio);
      aniosExistentesImportacion = aniosExistentes;
      const etiquetas = datos.ejercicios.map(ejercicio =>
        `${ejercicio.anio}: ${ejercicio.categorias} categorías${ejercicio.incluyeNomina ? " y configuración de nómina" : ""}`
      );
      resumenImportar.textContent = `Se han encontrado ${etiquetas.join("; ")}.` +
        (aniosExistentes.length
          ? ` En los años existentes (${aniosExistentes.join(", ")}) se sustituirán los meses de las categorías importadas.`
          : " Se crearán los ejercicios que todavía no existan.");
      listaAdvertenciasImportar.replaceChildren();
      listaCategoriasImportar.replaceChildren();
      const nombresSeccion = {
        ingresos: "Ingresos", gastos: "Gastos", casa: "Gastos de casa", ahorros: "Ahorros",
      };
      planImportacion.ejercicios.forEach(ejercicio => {
        Object.entries(ejercicio.secciones).forEach(([seccion, filas]) => {
          const item = document.createElement("li");
          item.textContent = `${ejercicio.anio} · ${nombresSeccion[seccion]}: ` +
            filas.map(fila => fila.categoria).join(", ");
          listaCategoriasImportar.append(item);
        });
      });
      (datos.advertencias || []).forEach(texto => {
        const item = document.createElement("li");
        item.textContent = texto;
        listaAdvertenciasImportar.append(item);
      });
      botonImportar.textContent = aniosExistentes.length
        ? "Importar y sobrescribir categorías coincidentes"
        : "Importar y guardar";
      vistaImportar.hidden = false;
    } catch (error) {
      avisoImportar.textContent = error && error.message || "No se pudo revisar el archivo.";
      avisoImportar.hidden = false;
    } finally {
      formularioImportar.querySelectorAll("input, button, textarea")
        .forEach(campo => { campo.disabled = false; });
      botonRevisar.textContent = "Revisar JSON";
    }
  });

  botonImportar.addEventListener("click", async () => {
    if (!planImportacion) return;
    const aniosExistentes = aniosExistentesImportacion;
    if (aniosExistentes.length && !confirm(
      `Se sustituirán los importes mensuales de las categorías incluidas en ${aniosExistentes.join(", ")}. ` +
      "Las demás categorías se conservarán y se hará una copia de seguridad si ya hay datos. ¿Continuar?"
    )) return;
    if (window.CONTABILIDAD_SUCIO && !await guarda()) return;
    botonImportar.disabled = true;
    try {
      limpiaError();
      const datos = await api("POST", "api/contabilidad/importar", { plan: planImportacion });
      planImportacion = null;
      aniosExistentesImportacion = [];
      vistaImportar.hidden = true;
      estado.anios = datos.anios;
      estado.resumenesAnuales.clear();
      pintaSelector();
      await cargaEjercicio(datos.importados[0]);
      avisoImportar.textContent = `Importación completada para ${datos.importados.join(", ")}.`;
      avisoImportar.hidden = false;
      archivoJsonImportar.value = "";
      campoJsonImportar.value = "";
    } catch (error) {
      avisoImportar.textContent = error && error.message || "No se pudo importar el archivo.";
      avisoImportar.hidden = false;
    } finally {
      botonImportar.disabled = false;
    }
  });

  function invalidaVistaImportacion() {
    planImportacion = null;
    aniosExistentesImportacion = [];
    vistaImportar.hidden = true;
    avisoImportar.hidden = true;
  }
  archivoJsonImportar.addEventListener("change", invalidaVistaImportacion);
  campoJsonImportar.addEventListener("input", invalidaVistaImportacion);

  $("#ctCopiarPrompt").addEventListener("click", async () => {
    const estadoPrompt = $("#ctPromptEstado");
    try {
      await navigator.clipboard.writeText(campoPrompt.value);
      estadoPrompt.textContent = "Prompt copiado.";
    } catch (error) {
      campoPrompt.select();
      if (document.execCommand("copy")) {
        estadoPrompt.textContent = "Prompt copiado.";
      } else {
        estadoPrompt.textContent = "No se pudo copiar automáticamente; selecciona el texto y cópialo.";
      }
    }
  });

  editor.addEventListener("input", evento => {
    const campo = evento.target;
    if (campo.matches("[data-ct-path], [data-ct-text-path], [data-ct-name], .ct-importe")) {
      campo.setCustomValidity("");
      if (campo.dataset.ctName) {
        const nombre = campo.value.trim() || "Categoría sin nombre";
        campo.setAttribute("aria-label", `Nombre de categoría: ${nombre}`);
        editor.querySelectorAll(".ct-importe").forEach(importe => {
          if (importe.dataset.ctSection === campo.dataset.ctName &&
              importe.dataset.ctCategory === campo.dataset.ctCategory) {
            importe.setAttribute("aria-label", `${nombre}, ${meses[Number(importe.dataset.ctMonth)]}, euros`);
          }
        });
      }
      if (campo.dataset.ctTextPath) {
        const porcentaje = campo.closest(".ct-regla").querySelector("[data-ct-path]");
        porcentaje.setAttribute("aria-label", `Porcentaje de ${campo.value.trim()}`);
      }
      marcaSucia();
    }
  });
  editor.addEventListener("change", evento => {
    if (evento.target.matches("[data-ct-paga]")) marcaSucia();
  });
  editor.addEventListener("submit", async evento => {
    const formulario = evento.target.closest("[data-ct-add]");
    if (!formulario) return;
    evento.preventDefault();
    const nombre = formulario.elements.nombre.value.trim();
    if (!nombre) {
      formulario.elements.nombre.focus();
      return;
    }
    if (window.CONTABILIDAD_SUCIO && !await guarda()) return;
    const seccion = formulario.dataset.ctAdd;
    bloqueaEdicion(true);
    try {
      limpiaError();
      const datos = await api("POST",
        `api/contabilidad/${estado.ejercicio.anio}/categorias/${seccion}`,
        { id: idNuevo(seccion), nombre });
      estado.ejercicio = datos.ejercicio;
      estado.resumen = datos.resumen;
      estado.resumenesAnuales.set(estado.ejercicio.anio, datos.resumen);
      pinta(estado.ejercicio);
      pintaComparativas();
      mensaje.textContent = `Categoría «${datos.categoria.nombre}» añadida.`;
    } catch (error) {
      muestraError(error);
    } finally {
      bloqueaEdicion(false);
    }
  });

  $("#ctNuevoAnio").value = String(new Date().getFullYear());
  const observadorArea = new MutationObserver(programaGraficos);
  observadorArea.observe(raiz, { attributes: true, attributeFilter: ["hidden"] });
  window.addEventListener("resize", () => {
    clearTimeout(temporizadorGraficos);
    temporizadorGraficos = setTimeout(programaGraficos, 140);
  });
  window.addEventListener("beforeunload", evento => {
    if (window.CONTABILIDAD_SUCIO) {
      evento.preventDefault();
      evento.returnValue = "";
    }
  });
  cargaAnios().catch(muestraError);
})();
