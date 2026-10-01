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
  const estado = { anios: [], ejercicio: null, resumen: null, guardando: false };
  const selector = $("#ctAnio");
  const editor = $("#ctEditor");
  const botonGuardar = $("#ctGuardar");
  const aviso = $("#ctAviso");
  const mensaje = $("#ctEstado");
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
    selector.disabled = bloqueada || !estado.anios.length;
    $("#ctCrearForm").querySelectorAll("input, button")
      .forEach(campo => { campo.disabled = bloqueada; });
    editor.querySelectorAll("input, button")
      .forEach(campo => { campo.disabled = bloqueada; });
    botonGuardar.disabled = bloqueada || !estado.ejercicio || !window.CONTABILIDAD_SUCIO;
  }

  function celdaImporte(categoria, mes, seccion, resumen) {
    if (categoria.tipo !== "manual") {
      const valor = resumen.categorias[categoria.id].mensual[mes];
      return `<td class="ct-calculado" aria-label="Importe calculado: ${euros(valor)}">${euros(valor)}</td>`;
    }
    const valor = categoria.valores[mes] == null ? "" : formato(categoria.valores[mes]);
    return `<td><input class="ct-importe" type="text" inputmode="decimal"
      data-ct-section="${seccion}" data-ct-category="${limpio(categoria.id)}" data-ct-month="${mes}"
      value="${limpio(valor)}" aria-label="${limpio(categoria.nombre)}, ${meses[mes]}, euros"
      placeholder="—"></td>`;
  }

  function tablaSeccion(seccion, titulo, ejercicio, calculo) {
    const categorias = ejercicio.secciones[seccion].categorias;
    const nota = seccion === "ingresos"
      ? "La nómina bruta y neta son valores derivados; no se editan en esta tabla."
      : "Importes en euros; deja vacío un mes sin registrar.";
    const filas = categorias.map(categoria => `<tr>
      <td class="ct-nombre">
        <input type="text" data-ct-name="${seccion}" data-ct-category="${limpio(categoria.id)}"
          value="${limpio(categoria.nombre)}" aria-label="Nombre de categoría: ${limpio(categoria.nombre)}"
          maxlength="80">
      </td>
      ${meses.map((_, mes) => celdaImporte(categoria, mes, seccion, calculo)).join("")}
      <td class="ct-anual">${euros(calculo.categorias[categoria.id].anual)}</td>
    </tr>`).join("");
    const total = `<tr class="ct-total"><th scope="row">${
      seccion === "ingresos" ? "Total ingresos computables" : `Total ${titulo.toLowerCase()}`
    }</th>${calculo.total_mensual.map(valor => `<td>${euros(valor)}</td>`).join("")}
      <td class="ct-anual">${euros(calculo.total_anual)}</td></tr>`;
    return `<section class="tarjeta">
      <header><h2>${titulo}</h2><span class="subt">${nota}</span></header>
      <div class="ct-grid" role="region" aria-label="${titulo}, tabla mensual" tabindex="0">
        <table><thead><tr><th scope="col">Categoría</th>
          ${meses.map(mes => `<th scope="col">${mes}</th>`).join("")}<th scope="col">Total año</th>
        </tr></thead><tbody>${filas}${total}</tbody></table>
      </div>
      <form class="ct-anadir" data-ct-add="${seccion}">
        <label for="ctNueva-${seccion}">Añadir categoría a ${titulo.toLowerCase()}</label>
        <input id="ctNueva-${seccion}" name="nombre" type="text" maxlength="80" required
          placeholder="Nombre de categoría">
        <button class="btn" type="submit">Añadir categoría</button>
      </form>
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
    ].map(([etiqueta, valores, anual, tipo]) => `<tr><th scope="row">${etiqueta}</th>
      ${valores.map(valor => `<td>${tipo === "porcentaje" ? porcentaje(valor) : euros(valor)}</td>`).join("")}
      <td class="ct-anual">${tipo === "porcentaje" ? porcentaje(anual) : euros(anual)}</td></tr>`).join("");

    editor.innerHTML = `<div class="ct-editor">
      <section class="tarjeta">
        <header><h2>Nómina y configuración salarial</h2>
          <span class="subt">Estimaciones configurables; no representan una nómina oficial ni asesoramiento fiscal.</span>
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
      </section>
      <section class="tarjeta">
        <header><h2>Total y subtotal</h2>
          <span class="subt">Subtotal = ingresos computables − gastos personales − gastos de casa.</span>
        </header>
        <div class="ct-grid" role="region" aria-label="Resumen mensual y anual" tabindex="0">
          <table><thead><tr><th scope="col">Resumen</th>
            ${meses.map(mes => `<th scope="col">${mes}</th>`).join("")}<th scope="col">Total año</th>
          </tr></thead><tbody>${resumenFilas}</tbody></table>
        </div>
        <p class="ct-nota">Porcentaje de ahorro = subtotal ÷ ingresos computables × 100; no se calcula si los ingresos son cero. Los meses sin registros no se tratan como cero: para calcular un subtotal mensual deben existir datos de ingresos, gastos y gastos de casa. El subtotal anual y su tasa usan los mismos meses completos. «Real» y «Ahorros» se muestran aparte y no se restan de nuevo.</p>
      </section>
      ${secciones.map(([clave, titulo]) =>
        tablaSeccion(clave, titulo, ejercicio, resumen.secciones[clave])
      ).join("")}
    </div>`;
    editor.hidden = false;
  }

  function pintaSelector() {
    selector.innerHTML = estado.anios.length
      ? estado.anios.map(anio => `<option value="${anio}"${estado.ejercicio &&
        estado.ejercicio.anio === anio ? " selected" : ""}>${anio}</option>`).join("")
      : '<option value="">Sin ejercicios</option>';
    selector.disabled = !estado.anios.length;
    $("#ctVacio").hidden = estado.anios.length > 0;
    editor.hidden = !estado.ejercicio;
    botonGuardar.disabled = !estado.ejercicio || !window.CONTABILIDAD_SUCIO;
  }

  async function cargaAnios() {
    const datos = await api("GET", "api/contabilidad");
    estado.anios = datos.anios;
    pintaSelector();
    if (estado.anios.length) await cargaEjercicio(estado.anios[0]);
    else mensaje.textContent = "Crea un ejercicio para empezar.";
  }

  async function cargaEjercicio(anio) {
    const datos = await api("GET", `api/contabilidad/${anio}`);
    estado.ejercicio = datos.ejercicio;
    estado.resumen = datos.resumen;
    window.CONTABILIDAD_SUCIO = false;
    pintaSelector();
    pinta(estado.ejercicio);
    botonGuardar.disabled = true;
    limpiaError();
    mensaje.textContent = `Ejercicio ${anio}. Los meses vacíos aún no tienen datos registrados.`;
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
      window.CONTABILIDAD_SUCIO = false;
      pinta(estado.ejercicio);
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
  selector.addEventListener("change", async () => {
    const anterior = estado.ejercicio && estado.ejercicio.anio;
    const siguiente = Number(selector.value);
    if (window.CONTABILIDAD_SUCIO && !confirm("Hay cambios sin guardar. ¿Descartarlos y cambiar de ejercicio?")) {
      selector.value = String(anterior);
      return;
    }
    try {
      limpiaError();
      await cargaEjercicio(siguiente);
    } catch (error) {
      selector.value = anterior == null ? "" : String(anterior);
      muestraError(error);
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
      pinta(estado.ejercicio);
      mensaje.textContent = `Categoría «${datos.categoria.nombre}» añadida.`;
    } catch (error) {
      muestraError(error);
    } finally {
      bloqueaEdicion(false);
    }
  });

  $("#ctNuevoAnio").value = String(new Date().getFullYear());
  window.addEventListener("beforeunload", evento => {
    if (window.CONTABILIDAD_SUCIO) {
      evento.preventDefault();
      evento.returnValue = "";
    }
  });
  cargaAnios().catch(muestraError);
})();
