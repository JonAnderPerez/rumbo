# -*- coding: utf-8 -*-
"""Validación y aplicación del JSON de importación de Contabilidad."""

import json
import math
import re
import unicodedata

from . import contabilidad

SECCIONES_IMPORTABLES = ("ingresos", "gastos", "casa", "ahorros")
ALIAS_CATEGORIAS = {
    ("casa", "seg vida seg hogar"): "Seguro de vida + hogar",
    ("ahorros", "crypto"): "Cripto",
    ("ahorros", "inversion intereses tr"): "Intereses de inversión",
}
_CAMPOS_PLAN = {"ejercicios", "advertencias"}
_CAMPOS_EJERCICIO = {"anio", "secciones", "nomina"}
_CAMPOS_NOMINA = {
    "bruto_anual", "porcentaje_irpf", "porcentajes_cotizacion", "meses_pagas_extra",
}
_CAMPOS_COTIZACION = {
    "contingencias_comunes", "desempleo", "formacion_profesional",
}


class ErrorImportacion(ValueError):
    def __init__(self, errores):
        self.errores = errores
        super().__init__("; ".join(errores))


def _normaliza(texto):
    texto = unicodedata.normalize("NFKD", str(texto or "").casefold())
    texto = "".join(caracter for caracter in texto if not unicodedata.combining(caracter))
    return " ".join(re.findall(r"[a-z0-9]+", texto))


def lee_json(contenido):
    if len(contenido) > 10 * 1024 * 1024:
        raise ErrorImportacion(["El JSON supera el límite de 10 MB."])
    try:
        texto = contenido.decode("utf-8-sig")
        texto = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", texto, flags=re.I)
        plan = json.loads(texto)
    except (UnicodeError, json.JSONDecodeError) as error:
        raise ErrorImportacion([
            "No he podido leer el JSON. Pega la respuesta completa de la IA, sin texto adicional."
        ]) from error
    return valida_plan(plan)


def valida_plan(plan):
    errores = []
    if not isinstance(plan, dict):
        raise ErrorImportacion(["El JSON debe contener un objeto con «ejercicios»."])
    if set(plan) - _CAMPOS_PLAN or not isinstance(plan.get("ejercicios"), list):
        raise ErrorImportacion([
            "El JSON debe incluir únicamente «ejercicios» y, opcionalmente, «advertencias»."
        ])
    resultado = {"ejercicios": [], "advertencias": []}
    avisos = plan.get("advertencias", [])
    if not isinstance(avisos, list) or any(not isinstance(aviso, str) for aviso in avisos):
        errores.append("«advertencias» debe ser una lista de textos.")
    else:
        resultado["advertencias"] = [aviso[:300] for aviso in avisos[:20]]

    anios_vistos = set()
    for indice, ejercicio in enumerate(plan["ejercicios"], start=1):
        ruta = f"ejercicios[{indice}]"
        if not isinstance(ejercicio, dict) or set(ejercicio) - _CAMPOS_EJERCICIO:
            errores.append(f"{ruta}: estructura no válida.")
            continue
        anio = ejercicio.get("anio")
        if type(anio) is not int or not 1950 <= anio <= 9999:
            errores.append(f"{ruta}.anio: debe ser un año entre 1950 y 9999.")
            continue
        if anio in anios_vistos:
            errores.append(f"El año {anio} aparece más de una vez.")
        anios_vistos.add(anio)
        secciones = ejercicio.get("secciones")
        if not isinstance(secciones, dict) or set(secciones) - set(SECCIONES_IMPORTABLES):
            errores.append(f"{ruta}.secciones: usa ingresos, gastos, casa y ahorros.")
            continue
        limpio = {"anio": anio, "secciones": {}}
        numero_categorias = 0
        for seccion, filas in secciones.items():
            if not isinstance(filas, list):
                errores.append(f"{ruta}.secciones.{seccion}: debe ser una lista.")
                continue
            limpio["secciones"][seccion] = []
            nombres_vistos = set()
            for numero_fila, fila in enumerate(filas, start=1):
                fila_ruta = f"{ruta}.secciones.{seccion}[{numero_fila}]"
                if not isinstance(fila, dict) or set(fila) != {"categoria", "meses"}:
                    errores.append(f"{fila_ruta}: incluye solo «categoria» y «meses».")
                    continue
                nombre = fila.get("categoria")
                if not isinstance(nombre, str) or not nombre.strip() or len(nombre.strip()) > 80:
                    errores.append(f"{fila_ruta}.categoria: debe tener entre 1 y 80 caracteres.")
                    continue
                clave_nombre = _normaliza(nombre)
                nombre_canonico = ALIAS_CATEGORIAS.get(
                    (seccion, clave_nombre), nombre.strip(),
                )
                clave_canonica = _normaliza(nombre_canonico)
                if clave_canonica in nombres_vistos:
                    errores.append(f"{fila_ruta}.categoria: la categoría está repetida.")
                nombres_vistos.add(clave_canonica)
                meses = fila.get("meses")
                if not isinstance(meses, list) or len(meses) != 12:
                    errores.append(f"{fila_ruta}.meses: debe contener exactamente 12 importes.")
                    continue
                valores = []
                for mes, valor in enumerate(meses, start=1):
                    if valor is None:
                        valores.append(None)
                    elif isinstance(valor, bool) or not isinstance(valor, (int, float)) \
                            or not math.isfinite(valor):
                        errores.append(f"{fila_ruta}.meses[{mes}]: usa un número o null.")
                    else:
                        valores.append(float(valor))
                limpio["secciones"][seccion].append({
                    "categoria": nombre.strip(), "meses": valores,
                })
                numero_categorias += 1
        if not numero_categorias:
            errores.append(f"{ruta}: no contiene categorías mensuales para importar.")
        if "nomina" in ejercicio:
            limpio["nomina"] = _valida_nomina(ejercicio["nomina"], ruta, errores)
        resultado["ejercicios"].append(limpio)
    if not resultado["ejercicios"]:
        errores.append("No hay ejercicios para importar.")
    if errores:
        raise ErrorImportacion(errores)
    return resultado


def _valida_nomina(nomina, ruta, errores):
    nomina_ruta = f"{ruta}.nomina"
    if not isinstance(nomina, dict) or set(nomina) - _CAMPOS_NOMINA:
        errores.append(f"{nomina_ruta}: estructura no válida.")
        return {}
    limpio = {}
    for campo in ("bruto_anual", "porcentaje_irpf"):
        if campo not in nomina:
            continue
        valor = nomina[campo]
        if isinstance(valor, bool) or not isinstance(valor, (int, float)) \
                or not math.isfinite(valor):
            errores.append(f"{nomina_ruta}.{campo}: usa un número.")
        elif campo == "bruto_anual" and valor < 0:
            errores.append(f"{nomina_ruta}.{campo}: no puede ser negativo.")
        elif campo == "porcentaje_irpf" and not 0 <= valor <= 100:
            errores.append(f"{nomina_ruta}.{campo}: debe estar entre 0 y 100.")
        else:
            limpio[campo] = float(valor)
    if "porcentajes_cotizacion" in nomina:
        porcentajes = nomina["porcentajes_cotizacion"]
        if not isinstance(porcentajes, dict) or set(porcentajes) - _CAMPOS_COTIZACION:
            errores.append(f"{nomina_ruta}.porcentajes_cotizacion: estructura no válida.")
        else:
            limpio["porcentajes_cotizacion"] = {}
            for campo, valor in porcentajes.items():
                if isinstance(valor, bool) or not isinstance(valor, (int, float)) \
                        or not math.isfinite(valor):
                    errores.append(f"{nomina_ruta}.porcentajes_cotizacion.{campo}: usa un número.")
                elif not 0 <= valor <= 100:
                    errores.append(
                        f"{nomina_ruta}.porcentajes_cotizacion.{campo}: debe estar entre 0 y 100."
                    )
                else:
                    limpio["porcentajes_cotizacion"][campo] = float(valor)
    if "meses_pagas_extra" in nomina:
        meses = nomina["meses_pagas_extra"]
        if not isinstance(meses, list) or any(
            type(mes) is not int or not 1 <= mes <= 12 for mes in meses
        ) or len(set(meses)) != len(meses):
            errores.append(f"{nomina_ruta}.meses_pagas_extra: indica meses únicos del 1 al 12.")
        else:
            limpio["meses_pagas_extra"] = sorted(meses)
    return limpio


def resumen(plan, documento):
    existentes = documento["ejercicios"]
    return [
        {
            "anio": ejercicio["anio"],
            "categorias": sum(len(filas) for filas in ejercicio["secciones"].values()),
            "existente": str(ejercicio["anio"]) in existentes,
            "incluyeNomina": bool(ejercicio.get("nomina")),
        }
        for ejercicio in plan["ejercicios"]
    ]


def aplica_plan(documento, plan):
    plan = valida_plan(plan)
    actualizados = []
    for datos in plan["ejercicios"]:
        clave_anio = str(datos["anio"])
        ejercicio = documento["ejercicios"].get(clave_anio)
        if ejercicio is None:
            ejercicio = contabilidad.crear_ejercicio(datos["anio"])
            documento["ejercicios"][clave_anio] = ejercicio
        for campo, valor in datos.get("nomina", {}).items():
            if campo == "porcentajes_cotizacion":
                ejercicio["nomina"][campo].update(valor)
            else:
                ejercicio["nomina"][campo] = valor
        for seccion, filas in datos["secciones"].items():
            categorias = ejercicio["secciones"][seccion]["categorias"]
            for fila in filas:
                nombre = ALIAS_CATEGORIAS.get(
                    (seccion, _normaliza(fila["categoria"])), fila["categoria"],
                )
                clave_nombre = _normaliza(nombre)
                categoria = next(
                    (item for item in categorias if _normaliza(item["nombre"]) == clave_nombre),
                    None,
                )
                if categoria is None:
                    categoria = {
                        "id": _id_categoria(nombre, categorias),
                        "nombre": nombre, "tipo": "manual",
                        "afecta_total": True, "valores": [None] * 12,
                    }
                    categorias.append(categoria)
                if categoria["tipo"] != "manual":
                    categoria["tipo"] = "manual"
                    categoria["valores"] = [None] * 12
                categoria["valores"] = fila["meses"]
        ejercicio["actualizado"] = contabilidad._ahora()
        actualizados.append(datos["anio"])
    return actualizados


def _id_categoria(nombre, categorias):
    nombre_ascii = unicodedata.normalize("NFKD", nombre.casefold())
    nombre_ascii = "".join(
        caracter for caracter in nombre_ascii if not unicodedata.combining(caracter)
    )
    sufijo = re.sub(r"[^a-z0-9]+", "_", nombre_ascii).strip("_") or "categoria"
    base = f"importada_{sufijo}"[:80].rstrip("_")
    usados = {categoria["id"] for categoria in categorias}
    ident = base
    contador = 2
    while ident in usados:
        ident = f"{base[:75]}_{contador}"
        contador += 1
    return ident
