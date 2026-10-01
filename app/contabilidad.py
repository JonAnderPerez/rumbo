# -*- coding: utf-8 -*-
"""Modelo y persistencia independiente de los ejercicios de Contabilidad."""

import copy
import datetime as dt
import json
import math
import os
import re
import shutil
import tempfile
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

VERSION = 1
ARCHIVO = "contabilidad.json"
CARPETA_COPIAS = "copias_contabilidad"
COPIAS_MAX = 20
SECCIONES = ("ingresos", "gastos", "casa", "real", "ahorros")
PORCENTAJES_COTIZACION = (
    "contingencias_comunes", "desempleo", "formacion_profesional",
)
_ID = re.compile(r"[a-z][a-z0-9_]*\Z", re.ASCII)
_CAMPOS_RAIZ = {"version", "ejercicios"}
_CAMPOS_EJERCICIO = {
    "anio", "creado", "actualizado", "nomina", "presupuesto", "secciones",
}


class ErrorValidacion(Exception):
    """Error de contrato de datos con mensajes aptos para mostrar al usuario."""

    def __init__(self, errores):
        self.errores = errores
        super().__init__("; ".join(errores))


def _ahora():
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


def documento_vacio():
    return {"version": VERSION, "ejercicios": {}}


def crear_ejercicio(anio):
    """Crea la estructura inicial vacía de un ejercicio, sin importes reales."""
    errores = []
    if isinstance(anio, bool) or not isinstance(anio, int) or not 1950 <= anio <= 9999:
        errores.append("El año debe ser un entero entre 1950 y 9999.")
        raise ErrorValidacion(errores)

    ahora = _ahora()
    ingresos = [
        ("ingreso_bruto", "Ingreso Bruto", "nomina_bruta", False),
        ("ingreso_neto", "Ingreso Neto", "nomina_neta", True),
        ("ajustes_ingresos", "Ajustes ingresos", "manual", True),
        ("intereses", "Intereses", "manual", True),
        ("gastos_fijos_devuelto", "Gastos fijos devuelto", "manual", True),
        ("estilo_vida_devuelto", "Estilo de vida devuelto", "manual", True),
        ("caprichos_devuelto", "Caprichos devuelto", "manual", True),
    ]
    gastos = [
        ("transporte_gasolina", "Transporte y Gasolina"),
        ("alimentos", "Alimentos"),
        ("vehiculos", "Vehículos"),
        ("entrenamiento_salud", "Entrenamiento y Salud"),
        ("vacaciones", "Vacaciones"),
        ("ocio", "Ocio"),
        ("hobbies", "Hobbies"),
        ("dinero_cajero", "Dinero cajero"),
        ("otros", "Otros"),
    ]
    casa = [
        ("hipoteca", "Hipoteca"), ("agua", "Agua"), ("luz", "Luz"),
        ("gas", "Gas"), ("internet_movil", "Internet + móvil"),
        ("seguro_vida_hogar", "Seguro de vida + hogar"),
        ("comunidad", "Comunidad"), ("impuestos", "Impuestos"),
        ("muebles_otros", "Muebles + otros"),
    ]
    real = [
        ("esenciales", "Gastos fijos esenciales"),
        ("estilo_vida", "Estilo de vida"),
        ("caprichos", "Caprichos"),
        ("emergencia_inversion", "Fondo de emergencia e inversión"),
    ]
    ahorros = [
        ("jubilacion_epsv", "Jubilación EPSV"),
        ("inversion", "Inversión"),
        ("inversion_intereses", "Intereses de inversión"),
        ("activos_fisicos", "Activos físicos"),
        ("cripto", "Cripto"),
        ("fondo_emergencia", "Fondo de emergencia"),
    ]

    categorias = {}
    for seccion, filas in (
        ("ingresos", ingresos),
        ("gastos", gastos),
        ("casa", casa),
        ("real", real),
        ("ahorros", ahorros),
    ):
        if seccion == "ingresos":
            categorias[seccion] = [
                _categoria(cid, nombre, tipo, afecta_total)
                for cid, nombre, tipo, afecta_total in filas
            ]
        else:
            categorias[seccion] = [
                _categoria(cid, nombre, "manual", True) for cid, nombre in filas
            ]

    ejercicio = {
        "anio": anio,
        "creado": ahora,
        "actualizado": ahora,
        "nomina": {
            "bruto_anual": None,
            "porcentaje_irpf": 16.0,
            "porcentajes_cotizacion": {
                "contingencias_comunes": 4.82,
                "desempleo": 1.55,
                "formacion_profesional": 0.10,
            },
            "meses_pagas_extra": [7, 12],
        },
        "presupuesto": {
            "base": "neto_regular",
            "reglas": [
                {"id": "esenciales", "nombre": "Gastos fijos esenciales",
                 "porcentaje": 50.0, "categoria_real_id": "esenciales"},
                {"id": "estilo_vida", "nombre": "Estilo de vida",
                 "porcentaje": 25.0, "categoria_real_id": "estilo_vida"},
                {"id": "caprichos", "nombre": "Caprichos",
                 "porcentaje": 5.0, "categoria_real_id": "caprichos"},
                {"id": "emergencia_inversion", "nombre": "Fondo de emergencia e inversión",
                 "porcentaje": 20.0, "categoria_real_id": "emergencia_inversion"},
            ],
        },
        "secciones": {
            clave: {"categorias": categorias[clave]} for clave in SECCIONES
        },
    }
    return ejercicio


def _categoria(identificador, nombre, tipo, afecta_total):
    categoria = {
        "id": identificador,
        "nombre": nombre,
        "tipo": tipo,
        "afecta_total": afecta_total,
    }
    if tipo == "manual":
        categoria["valores"] = [None] * 12
    return categoria


def valida_documento(documento):
    """Valida el documento completo y devuelve su copia canónica."""
    errores = []
    if not isinstance(documento, dict):
        raise ErrorValidacion(["El documento de Contabilidad debe ser un objeto JSON."])
    _campos(documento, _CAMPOS_RAIZ, "documento", errores)
    if type(documento.get("version")) is not int or documento.get("version") != VERSION:
        errores.append(f"La versión de Contabilidad debe ser {VERSION}.")
    ejercicios = documento.get("ejercicios")
    if not isinstance(ejercicios, dict):
        errores.append("«ejercicios» debe ser un objeto con años como claves.")
        ejercicios = {}

    limpio = {"version": VERSION, "ejercicios": {}}
    for clave, ejercicio in ejercicios.items():
        ruta = f"ejercicios.{clave}"
        if not isinstance(clave, str) or not re.fullmatch(r"\d{4}", clave):
            errores.append(f"{ruta}: la clave debe ser un año de cuatro cifras.")
            continue
        if not isinstance(ejercicio, dict):
            errores.append(f"{ruta}: el ejercicio debe ser un objeto.")
            continue
        limpio["ejercicios"][clave] = _valida_ejercicio(
            clave, ejercicio, ruta, errores
        )
    if errores:
        raise ErrorValidacion(errores)
    return limpio


def _valida_ejercicio(clave, ejercicio, ruta, errores):
    _campos(ejercicio, _CAMPOS_EJERCICIO, ruta, errores)
    resultado = copy.deepcopy(ejercicio)
    if not isinstance(resultado.get("nomina"), dict):
        resultado["nomina"] = {}
    if not isinstance(resultado.get("presupuesto"), dict):
        resultado["presupuesto"] = {}
    if not isinstance(resultado["presupuesto"].get("reglas"), list):
        resultado["presupuesto"]["reglas"] = []
    if not isinstance(resultado.get("secciones"), dict):
        resultado["secciones"] = {}
    for seccion in SECCIONES:
        bloque = resultado["secciones"].get(seccion)
        if not isinstance(bloque, dict):
            bloque = {}
            resultado["secciones"][seccion] = bloque
        if not isinstance(bloque.get("categorias"), list):
            bloque["categorias"] = []

    anio = ejercicio.get("anio")
    if isinstance(anio, bool) or not isinstance(anio, int) or not 1950 <= anio <= 9999:
        errores.append(f"{ruta}.anio: debe ser un entero entre 1950 y 9999.")
    elif str(anio) != clave:
        errores.append(f"{ruta}: la clave y el campo anio deben coincidir.")

    for campo in ("creado", "actualizado"):
        if not _fecha_con_zona(ejercicio.get(campo)):
            errores.append(f"{ruta}.{campo}: debe ser una fecha ISO-8601 con zona horaria.")

    nomina = ejercicio.get("nomina")
    if not isinstance(nomina, dict):
        errores.append(f"{ruta}.nomina: debe ser un objeto.")
        nomina = {}
    _campos(nomina, {
        "bruto_anual", "porcentaje_irpf", "porcentajes_cotizacion",
        "meses_pagas_extra",
    }, f"{ruta}.nomina", errores)
    bruto = nomina.get("bruto_anual")
    if bruto is not None:
        resultado_bruto = _numero(bruto, f"{ruta}.nomina.bruto_anual",
                                  errores, minimo=0, importe=True)
        resultado.setdefault("nomina", {})["bruto_anual"] = resultado_bruto
    _numero(nomina.get("porcentaje_irpf"),
            f"{ruta}.nomina.porcentaje_irpf", errores, minimo=0, maximo=100)

    cotizaciones = nomina.get("porcentajes_cotizacion")
    if not isinstance(cotizaciones, dict):
        errores.append(f"{ruta}.nomina.porcentajes_cotizacion: debe ser un objeto.")
    else:
        _campos(cotizaciones, set(PORCENTAJES_COTIZACION),
                f"{ruta}.nomina.porcentajes_cotizacion", errores)
        for campo in PORCENTAJES_COTIZACION:
            _numero(cotizaciones.get(campo),
                    f"{ruta}.nomina.porcentajes_cotizacion.{campo}",
                    errores, minimo=0, maximo=100)

    meses = nomina.get("meses_pagas_extra")
    if not isinstance(meses, list):
        errores.append(f"{ruta}.nomina.meses_pagas_extra: debe ser una lista.")
    else:
        vistos = set()
        for mes in meses:
            if isinstance(mes, bool) or not isinstance(mes, int) or not 1 <= mes <= 12:
                errores.append(
                    f"{ruta}.nomina.meses_pagas_extra: cada mes debe ser un entero entre 1 y 12."
                )
                continue
            if mes in vistos:
                errores.append(f"{ruta}.nomina.meses_pagas_extra: el mes {mes} está repetido.")
            vistos.add(mes)

    presupuesto = ejercicio.get("presupuesto")
    ids_reales = set()
    if not isinstance(presupuesto, dict):
        errores.append(f"{ruta}.presupuesto: debe ser un objeto.")
        presupuesto = {}
    _campos(presupuesto, {"base", "reglas"}, f"{ruta}.presupuesto", errores)
    if presupuesto.get("base") != "neto_regular":
        errores.append(f"{ruta}.presupuesto.base: debe ser «neto_regular».")

    secciones = ejercicio.get("secciones")
    if not isinstance(secciones, dict):
        errores.append(f"{ruta}.secciones: debe ser un objeto.")
        secciones = {}
    _campos(secciones, set(SECCIONES), f"{ruta}.secciones", errores)
    for seccion in SECCIONES:
        bloque = secciones.get(seccion)
        if not isinstance(bloque, dict):
            errores.append(f"{ruta}.secciones.{seccion}: debe ser un objeto.")
            continue
        _campos(bloque, {"categorias"}, f"{ruta}.secciones.{seccion}", errores)
        categorias = bloque.get("categorias")
        if not isinstance(categorias, list):
            errores.append(f"{ruta}.secciones.{seccion}.categorias: debe ser una lista.")
            continue
        ids, nombres = set(), set()
        for indice, categoria in enumerate(categorias):
            cat_ruta = f"{ruta}.secciones.{seccion}.categorias[{indice}]"
            categoria_limpia = resultado["secciones"][seccion]["categorias"][indice]
            id_categoria = _valida_categoria(
                categoria, categoria_limpia, seccion, cat_ruta, errores
            )
            if id_categoria is not None:
                if id_categoria in ids:
                    errores.append(f"{cat_ruta}.id: el ID está repetido en la sección.")
                ids.add(id_categoria)
            if isinstance(categoria, dict) and isinstance(categoria.get("nombre"), str):
                nombre = categoria["nombre"].strip().casefold()
                if nombre in nombres:
                    errores.append(f"{cat_ruta}.nombre: el nombre está repetido en la sección.")
                nombres.add(nombre)
            if seccion == "real" and id_categoria is not None:
                ids_reales.add(id_categoria)

    reglas = presupuesto.get("reglas")
    if not isinstance(reglas, list) or not reglas:
        errores.append(f"{ruta}.presupuesto.reglas: debe contener al menos una regla.")
    else:
        ids, nombres = set(), set()
        porcentajes = []
        for indice, regla in enumerate(reglas):
            regla_ruta = f"{ruta}.presupuesto.reglas[{indice}]"
            if not isinstance(regla, dict):
                errores.append(f"{regla_ruta}: debe ser un objeto.")
                continue
            regla_limpia = resultado["presupuesto"]["reglas"][indice]
            _campos(regla, {"id", "nombre", "porcentaje", "categoria_real_id"},
                    regla_ruta, errores)
            rid = _valida_id(regla.get("id"), f"{regla_ruta}.id", errores)
            nombre = _valida_nombre(regla.get("nombre"), f"{regla_ruta}.nombre", errores)
            if nombre is not None:
                regla_limpia["nombre"] = nombre
            if rid is not None:
                if rid in ids:
                    errores.append(f"{regla_ruta}.id: el ID está repetido.")
                ids.add(rid)
            if nombre is not None:
                if nombre.casefold() in nombres:
                    errores.append(f"{regla_ruta}.nombre: el nombre está repetido.")
                nombres.add(nombre.casefold())
            porcentaje = _numero(
                regla.get("porcentaje"), f"{regla_ruta}.porcentaje",
                errores, minimo=0, maximo=100,
            )
            if porcentaje is not None:
                porcentajes.append(Decimal(str(porcentaje)))
            categoria_id = regla.get("categoria_real_id")
            if not isinstance(categoria_id, str) or categoria_id not in ids_reales:
                errores.append(
                    f"{regla_ruta}.categoria_real_id: debe referenciar una categoría de «real»."
                )
        if len(porcentajes) == len(reglas) and abs(sum(porcentajes) - Decimal(100)) > Decimal("0.01"):
            errores.append(f"{ruta}.presupuesto.reglas: los porcentajes deben sumar 100 %.")
    return resultado


def _valida_categoria(categoria, categoria_limpia, seccion, ruta, errores):
    if not isinstance(categoria, dict):
        errores.append(f"{ruta}: debe ser un objeto.")
        return None
    tipo = categoria.get("tipo")
    campos = {"id", "nombre", "tipo", "afecta_total"}
    if tipo == "manual":
        campos.add("valores")
    _campos(categoria, campos, ruta, errores)
    ident = _valida_id(categoria.get("id"), f"{ruta}.id", errores)
    nombre = _valida_nombre(categoria.get("nombre"), f"{ruta}.nombre", errores)
    if nombre is not None:
        categoria_limpia["nombre"] = nombre
    if not isinstance(categoria.get("afecta_total"), bool):
        errores.append(f"{ruta}.afecta_total: debe ser booleano.")
    if seccion == "ingresos":
        if tipo not in ("manual", "nomina_bruta", "nomina_neta"):
            errores.append(f"{ruta}.tipo: tipo de categoría de ingresos no válido.")
        elif tipo == "nomina_bruta" and categoria.get("afecta_total") is not False:
            errores.append(f"{ruta}.afecta_total: la nómina bruta es informativa y no suma.")
        elif tipo == "nomina_neta" and categoria.get("afecta_total") is not True:
            errores.append(f"{ruta}.afecta_total: la nómina neta debe sumar a ingresos.")
    elif tipo != "manual":
        errores.append(f"{ruta}.tipo: solo se permiten categorías manuales en «{seccion}».")

    if tipo == "manual":
        valores = categoria.get("valores")
        if not isinstance(valores, list) or len(valores) != 12:
            errores.append(f"{ruta}.valores: debe contener exactamente 12 importes.")
        else:
            normalizados = []
            for mes, valor in enumerate(valores, start=1):
                if valor is None:
                    normalizados.append(None)
                else:
                    normalizados.append(_numero(
                        valor, f"{ruta}.valores[{mes}]",
                        errores, importe=True,
                    ))
            categoria_limpia["valores"] = normalizados
    return ident


def _valida_id(valor, ruta, errores):
    if not isinstance(valor, str) or not _ID.fullmatch(valor):
        errores.append(f"{ruta}: usa un ID ASCII en minúsculas con guiones bajos.")
        return None
    return valor


def _valida_nombre(valor, ruta, errores):
    if not isinstance(valor, str) or not valor.strip():
        errores.append(f"{ruta}: no puede estar vacío.")
        return None
    return valor.strip()


def _campos(objeto, esperados, ruta, errores):
    for campo in sorted(set(objeto) - esperados):
        errores.append(f"{ruta}.{campo}: campo no reconocido.")
    for campo in sorted(esperados - set(objeto)):
        errores.append(f"{ruta}.{campo}: falta el campo obligatorio.")


def _fecha_con_zona(valor):
    if not isinstance(valor, str):
        return False
    try:
        fecha = dt.datetime.fromisoformat(valor.replace("Z", "+00:00"))
    except ValueError:
        return False
    return fecha.tzinfo is not None and fecha.utcoffset() is not None


def _numero(valor, ruta, errores, minimo=None, maximo=None, importe=False):
    if isinstance(valor, bool) or not isinstance(valor, (int, float)):
        errores.append(f"{ruta}: debe ser un número JSON finito.")
        return None
    if isinstance(valor, float) and not math.isfinite(valor):
        errores.append(f"{ruta}: debe ser un número JSON finito.")
        return None
    try:
        numero = Decimal(str(valor))
        if not numero.is_finite():
            raise InvalidOperation
        if minimo is not None and numero < Decimal(str(minimo)):
            errores.append(f"{ruta}: no puede ser menor que {minimo}.")
        if maximo is not None and numero > Decimal(str(maximo)):
            errores.append(f"{ruta}: no puede ser mayor que {maximo}.")
        if importe:
            numero = numero.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        resultado = float(numero)
        if not math.isfinite(resultado):
            raise InvalidOperation
        return resultado
    except (InvalidOperation, OverflowError):
        errores.append(f"{ruta}: el número no es válido.")
        return None


def carga(carpeta_datos):
    """Carga y valida el fichero; si no existe, devuelve un documento vacío."""
    ruta = os.path.join(os.fspath(carpeta_datos), ARCHIVO)
    try:
        with open(ruta, "r", encoding="utf-8") as archivo:
            documento = json.load(archivo)
    except FileNotFoundError:
        return documento_vacio()
    except (json.JSONDecodeError, UnicodeError) as error:
        raise ErrorValidacion([
            f"{ARCHIVO} no contiene JSON válido y no se ha sobrescrito: {error}."
        ]) from error
    return valida_documento(documento)


def guarda(carpeta_datos, documento):
    """Valida, guarda copia previa separada y reemplaza el JSON atómicamente."""
    limpio = valida_documento(documento)
    carpeta = os.fspath(carpeta_datos)
    os.makedirs(carpeta, exist_ok=True)
    ruta = os.path.join(carpeta, ARCHIVO)
    if os.path.exists(ruta):
        carga(carpeta)
    descriptor, temporal = tempfile.mkstemp(
        prefix=".contabilidad-", suffix=".tmp", dir=carpeta,
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as archivo:
            json.dump(limpio, archivo, ensure_ascii=False, indent=1, allow_nan=False)
            archivo.flush()
            os.fsync(archivo.fileno())
        if os.path.exists(ruta):
            carpeta_copias = os.path.join(carpeta, CARPETA_COPIAS)
            os.makedirs(carpeta_copias, exist_ok=True)
            sello = dt.datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            shutil.copy2(ruta, os.path.join(carpeta_copias, f"auto_{sello}.json"))
        os.replace(temporal, ruta)
        _limpia_copias(carpeta)
    finally:
        if os.path.exists(temporal):
            os.remove(temporal)
    return limpio


def _limpia_copias(carpeta):
    ruta = os.path.join(carpeta, CARPETA_COPIAS)
    if not os.path.isdir(ruta):
        return
    copias = sorted(
        nombre for nombre in os.listdir(ruta)
        if nombre.startswith("auto_") and nombre.endswith(".json")
    )
    for nombre in copias[:-COPIAS_MAX]:
        os.remove(os.path.join(ruta, nombre))
