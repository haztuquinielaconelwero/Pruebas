# ========================================
# Quinielas El Wero. Librerias para que funcione perfectamente
# ========================================
from fastapi import FastAPI, HTTPException, Query, File, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from typing import List, Optional, Dict
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
import json as json_module
import uvicorn
import socket
import os
import csv
import io
import psycopg2
from psycopg2.extras import RealDictCursor
from urllib.parse import urlparse

app = FastAPI(title="Quinielas El Wero API", version="0.3.0")
# ========================================
# CORS
# ========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ========================================
# Archivos estáticos
# ========================================
app.mount("/logos", StaticFiles(directory="logos"), name="logos")

@app.get("/styles.css")
async def get_styles():
    return FileResponse("styles.css", media_type="text/css")

@app.get("/script.js")
async def get_script():
    return FileResponse("script.js", media_type="application/javascript")

# ========================================
# Estados de la quiniela
# ========================================
ESTADO_PENDIENTE = "pendiente"
ESTADO_JUGANDO   = "jugando"
ESTADO_ESPERA    = "espera"
ESTADOS_VALIDOS  = {ESTADO_PENDIENTE, ESTADO_JUGANDO, ESTADO_ESPERA}
# ========================================
# Configuración — editar desde Railway Variables
# ========================================
JORNADA_ACTUAL     = os.getenv("JORNADA_ACTUAL", "Jornada 9")
ADMIN_SECRET       = os.getenv("ADMIN_SECRET", "wero2026")
MAX_DOBLES         = 4
MAX_TRIPLES        = 3
PRECIO_NORMAL      = 30
PRECIO_DESCUENTO   = 25
CANTIDAD_DESCUENTO = 10
# ========================================
# Base de datos PostgreSQL
# ========================================
DATABASE_URL = os.getenv("DATABASE_URL")

def get_db():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL no está configurada")
    return psycopg2.connect(DATABASE_URL)

def init_db():
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS quinielas (
                id             SERIAL PRIMARY KEY,
                nombre         TEXT NOT NULL,
                vendedor       TEXT NOT NULL,
                predictions    JSONB NOT NULL,
                estado         TEXT DEFAULT 'pendiente',
                folio          TEXT,
                jornada        TEXT,
                fecha_creacion TEXT,
                userId         TEXT
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS resultados (
                partido_id INTEGER  NOT NULL,
                jornada    TEXT     NOT NULL,
                resultado  TEXT,
                PRIMARY KEY (partido_id, jornada)
            )
        """)
        conn.commit()
        print("✅ Base de datos PostgreSQL inicializada")
    finally:
        conn.close()

init_db()
# ========================================
# Helpers para resultados (PostgreSQL, no memoria)
# ========================================
def get_resultados_db(jornada: str) -> list:
    conn = get_db()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            "SELECT partido_id, resultado FROM resultados WHERE jornada = %s",
            (jornada,)
        )
        rows = cursor.fetchall()
        resultado_list = [None] * 9
        for row in rows:
            resultado_list[row["partido_id"]] = row["resultado"]
        return resultado_list
    finally:
        conn.close()

def set_resultado_db(partido_id: int, resultado: Optional[str], jornada: str):
    conn = get_db()
    try:
        cursor = conn.cursor()
        if resultado is None or resultado == "None":
            cursor.execute(
                "DELETE FROM resultados WHERE partido_id = %s AND jornada = %s",
                (partido_id, jornada)
            )
        else:
            cursor.execute("""
                INSERT INTO resultados (partido_id, jornada, resultado)
                VALUES (%s, %s, %s)
                ON CONFLICT (partido_id, jornada)
                DO UPDATE SET resultado = EXCLUDED.resultado
            """, (partido_id, jornada, resultado))
        conn.commit()
    finally:
        conn.close()

# ========================================
# Partidos de la Jornada 9
# ========================================
partidos_jornada_9 = [
    {"id": 0, "local": "América",    "localLogo": "logos/america.png",
     "visitante": "Chivas",    "visitanteLogo": "logos/chivas.png",
     "horario": "Sábado 9 PM",   "televisora": "TUDN",       "televisionLogo": "logos/tudn.png"},
    {"id": 1, "local": "Cruz Azul", "localLogo": "logos/cruz azul.png",
     "visitante": "Pumas",     "visitanteLogo": "logos/pumas.png",
     "horario": "Sábado 7 PM",   "televisora": "Fox Sports", "televisionLogo": "logos/fox sports.png"},
    {"id": 2, "local": "Monterrey", "localLogo": "logos/monterrey.png",
     "visitante": "Tigres",    "visitanteLogo": "logos/tigres.png",
     "horario": "Domingo 6 PM",  "televisora": "TV Azteca",  "televisionLogo": "logos/tv azteca.png"},
    {"id": 3, "local": "Toluca",    "localLogo": "logos/toluca.png",
     "visitante": "Santos",    "visitanteLogo": "logos/santos.png",
     "horario": "Sábado 5 PM",   "televisora": "TUDN",       "televisionLogo": "logos/tudn.png"},
    {"id": 4, "local": "León",      "localLogo": "logos/leon.png",
     "visitante": "Pachuca",   "visitanteLogo": "logos/pachuca.png",
     "horario": "Viernes 9 PM",  "televisora": "Fox Sports", "televisionLogo": "logos/fox sports.png"},
    {"id": 5, "local": "Atlas",     "localLogo": "logos/atlas.png",
     "visitante": "Necaxa",    "visitanteLogo": "logos/necaxa.png",
     "horario": "Sábado 7 PM",   "televisora": "ESPN",       "televisionLogo": "logos/espn.png"},
    {"id": 6, "local": "Puebla",    "localLogo": "logos/puebla.png",
     "visitante": "Tijuana",   "visitanteLogo": "logos/tijuana.png",
     "horario": "Domingo 12 PM", "televisora": "TUDN",       "televisionLogo": "logos/tudn.png"},
    {"id": 7, "local": "Querétaro", "localLogo": "logos/queretaro.png",
     "visitante": "Mazatlán",  "visitanteLogo": "logos/mazatlan.png",
     "horario": "Sábado 5 PM",   "televisora": "Fox Sports", "televisionLogo": "logos/fox sports.png"},
    {"id": 8, "local": "San Luis",  "localLogo": "logos/san luis.png",
     "visitante": "Juárez",    "visitanteLogo": "logos/juarez.png",
     "horario": "Domingo 6 PM",  "televisora": "TV Azteca",  "televisionLogo": "logos/tv azteca.png"},
]
# ========================================
# Resultados Oficiales — ahora en PostgreSQL
# ========================================
@app.get("/api/resultados-oficiales")
async def obtener_resultados_oficiales(jornada: str = Query(default=JORNADA_ACTUAL)):
    resultados = get_resultados_db(jornada)
    return {
        "success": True,
        "jornada": jornada,
        "resultados": {str(i): resultados[i] for i in range(9)},
    }


@app.patch("/api/resultados-oficiales/{partido_id}")
async def actualizar_resultado_oficial(
    partido_id: int,
    resultado:  str = Query(...),
    jornada:    str = Query(default=JORNADA_ACTUAL)
):
    if partido_id < 0 or partido_id > 8:
        raise HTTPException(400, detail="partido_id debe estar entre 0 y 8")
    if resultado not in {"L", "E", "V", "None"}:
        raise HTTPException(400, detail="resultado debe ser L, E, V o None")

    set_resultado_db(partido_id, resultado if resultado != "None" else None, jornada)
    resultados = get_resultados_db(jornada)
    print(f"✅ Resultado actualizado — Partido {partido_id}: {resultado}")

    return {
        "success": True,
        "partido_id": partido_id,
        "resultado": resultados[partido_id],
        "resultados": {str(i): resultados[i] for i in range(9)},
    }


@app.post("/api/guardar-resultados")
async def guardar_todos_los_resultados(
    request: Request,
    jornada: str = Query(default=JORNADA_ACTUAL)
):
    try:
        body = await request.json()
        nuevos_resultados = body.get("resultados", {})

        for idx_str, resultado in nuevos_resultados.items():
            idx = int(idx_str)
            if 0 <= idx <= 8 and resultado in {"L", "E", "V"}:
                set_resultado_db(idx, resultado, jornada)
                print(f"✅ Partido {idx}: {resultado}")

        resultados = get_resultados_db(jornada)
        print(f"📊 Resultados actualizados: {resultados}")

        return {
            "success": True,
            "mensaje": "Resultados guardados exitosamente",
            "resultados": {str(i): resultados[i] for i in range(9)},
            "jornada": jornada,
        }
    except Exception as e:
        print(f"❌ Error al guardar resultados: {e}")
        raise HTTPException(500, detail=str(e))


# ========================================
# Límites por vendedor
# ========================================
LIMITES_VENDEDORES = {
    "Alexander":    (1,    100),
    "Alfonso":      (201,  260),
    "Arturo":       (271,  290),
    "Azael":        (301,  380),
    "Boosters":     (401,  440),
    "Checo":        (451,  650),
    "Choneke":      (651,  690),
    "Dani":         (701,  750),
    "Del Angel":    (751,  821),
    "El Leona":     (831,  850),
    "El Piojo":     (851,  890),
    "Energeticos":  (901,  970),
    "Enoc":         (975,  1000),
    "Ever":         (1001, 1025),
    "Fer":          (1031, 1100),
    "Figueroa":     (1101, 1140),
    "Gera":         (1151, 1200),
    "GioSoto":      (1201, 1280),
    "Guerrero":     (1291, 1320),
    "Javier Garcia":(1331, 1380),
    "JJ":           (1401, 1440),
    "Jose Luis":    (1451, 1490),
    "Juan de Dios": (1501, 1520),
    "Juanillo":     (1551, 1590),
    "Kany":         (1601, 1630),
    "Manu":         (1651, 1720),
    "Marchan":      (1721, 1750),
    "Marcos":       (1751, 1790),
    "Mazatan":      (1801, 1825),
    "Memo":         (1831, 1950),
    "Pantoja":      (1951, 1990),
    "Patty":        (2001, 2500),
    "PolloGol":     (2501, 2530),
    "Ranita":       (2531, 2600),
    "Rolando":      (2601, 2750),
    "Taliban":      (2751, 3000),
    "•":            (4001, 4100),
}
# ========================================
# PIN de vendedores
# ========================================
VENDEDOR_PINS = {nombre: "1234" for nombre in LIMITES_VENDEDORES.keys()}


def obtener_rango_vendedor(vendedor: str):
    return LIMITES_VENDEDORES.get(vendedor)


def obtener_limite_vendedor(vendedor: str) -> int:
    rango = obtener_rango_vendedor(vendedor)
    if not rango:
        return 0
    return rango[1] - rango[0] + 1


# ========================================
# Números de WhatsApp por vendedor
# ========================================
VENDEDOR_WHATSAPP = {nombre: "5218112345678" for nombre in LIMITES_VENDEDORES.keys()}
VENDEDOR_WHATSAPP["Mazatan"] = "5218812345678"


# ========================================
# Modelos
# ========================================
class QuinielaInput(BaseModel):
    nombre:      str                    = Field(..., min_length=1, max_length=30)
    vendedor:    str                    = Field(..., min_length=1, max_length=50)
    predictions: Dict[int, List[str]]
    userId:      Optional[str]          = None

    @field_validator("predictions")
    @classmethod
    def validate_predictions(cls, value):
        if not value:
            raise ValueError("No se recibieron predicciones")
        if len(value) != 9:
            raise ValueError(f"Se esperan 9 partidos, se recibieron {len(value)}")
        for match_id, picks in value.items():
            if not isinstance(match_id, int) or match_id < 0 or match_id > 8:
                raise ValueError(f"ID de partido inválido: {match_id}")
            if not isinstance(picks, list) or len(picks) == 0:
                raise ValueError(f"Partido {match_id}: debes seleccionar al menos una opción")
            if len(picks) > 3:
                raise ValueError(f"Partido {match_id}: no puedes seleccionar más de 3 opciones")
            for pick in picks:
                if pick not in {"L", "E", "V"}:
                    raise ValueError(f"Partido {match_id}: opción inválida '{pick}'")
        return value


class QuinielaGuardada(BaseModel):
    id:             int
    nombre:         str
    vendedor:       str
    predictions:    Dict[int, List[str]]
    estado:         str
    folio:          str
    jornada:        str
    fecha_creacion: str


class VerificarPinInput(BaseModel):
    vendedor: str = Field(..., min_length=1, max_length=50)
    pin:      str = Field(..., min_length=4, max_length=4)


class EnviarWhatsAppInput(BaseModel):
    vendedor: str = Field(..., min_length=1, max_length=50)
    mensaje:  str = Field(..., min_length=1)


# ========================================
# Endpoints base
# ========================================
@app.get("/")
async def root():
    return FileResponse("index.html")


@app.get("/api/stats")
async def get_stats(
    jornada: str = Query(default=JORNADA_ACTUAL),
    userId:  Optional[str] = None
):
    conn = get_db()
    try:
        cursor = conn.cursor()

        if userId:
            cursor.execute(
                "SELECT COUNT(*) FROM quinielas WHERE estado = %s AND jornada = %s AND userId = %s",
                (ESTADO_JUGANDO, jornada, userId)
            )
            jugando_count = cursor.fetchone()[0]

            cursor.execute(
                "SELECT COUNT(*) FROM quinielas WHERE estado IN (%s, %s) AND jornada = %s AND userId = %s",
                (ESTADO_PENDIENTE, ESTADO_ESPERA, jornada, userId)
            )
            no_jugando_count = cursor.fetchone()[0]
        else:
            cursor.execute(
                "SELECT COUNT(*) FROM quinielas WHERE estado = %s AND jornada = %s",
                (ESTADO_JUGANDO, jornada)
            )
            jugando_count = cursor.fetchone()[0]

            cursor.execute(
                "SELECT COUNT(*) FROM quinielas WHERE estado IN (%s, %s) AND jornada = %s",
                (ESTADO_PENDIENTE, ESTADO_ESPERA, jornada)
            )
            no_jugando_count = cursor.fetchone()[0]

        return {
            "success": True,
            "stats": {"jugando": jugando_count, "no_jugando": no_jugando_count},
            "jornada": jornada,
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "stats": {"jugando": 0, "no_jugando": 0},
            "jornada": jornada,
            "timestamp": datetime.now().isoformat(),
        }
    finally:
        conn.close()


@app.get("/jornada-actual")
async def get_jornada_actual():
    return {
        "numero": 9,
        "nombre": JORNADA_ACTUAL,
        "codigo_grupo": "J9",
        "link_grupo": "https://chat.whatsapp.com/H6liRqVFYC68DhRKnEFWKy",
        "inicio": "2026-02-16T00:01:00",
        "fin":    "2026-02-20T18:00:00",
    }


@app.get("/api/partidos")
async def get_partidos():
    return {"success": True, "jornada": JORNADA_ACTUAL, "partidos": partidos_jornada_9}


# ========================================
# Quinielas CRUD
# ========================================
@app.post("/api/quinielas", response_model=QuinielaGuardada)
async def crear_quiniela(data: QuinielaInput):
    rango = obtener_rango_vendedor(data.vendedor)
    if not rango:
        raise HTTPException(
            status_code=400,
            detail=f"Vendedor '{data.vendedor}' no existe en el sistema"
        )

    conn = get_db()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        predictions_json = json_module.dumps(data.predictions)
        fecha_creacion   = datetime.now().isoformat()

        cursor.execute("""
            INSERT INTO quinielas (nombre, vendedor, predictions, estado, jornada, fecha_creacion, userId)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            data.nombre.strip(),
            data.vendedor.strip(),
            predictions_json,
            ESTADO_PENDIENTE,
            JORNADA_ACTUAL,
            fecha_creacion,
            data.userId or "unknown",
        ))

        q_id = cursor.fetchone()["id"]
        conn.commit()
        print(f"✅ Quiniela guardada: {data.nombre} - ID: {q_id}")

        return QuinielaGuardada(
            id=q_id,
            nombre=data.nombre,
            vendedor=data.vendedor,
            predictions=data.predictions,
            estado=ESTADO_PENDIENTE,
            folio="",
            jornada=JORNADA_ACTUAL,
            fecha_creacion=fecha_creacion,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ Error al crear quiniela: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")
    finally:
        conn.close()


@app.get("/api/quinielas")
async def listar_quinielas(
    vendedor: Optional[str] = None,
    jornada:  str           = Query(default=JORNADA_ACTUAL),
    estado:   Optional[str] = None,
):
    conn = get_db()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        query  = "SELECT * FROM quinielas WHERE 1=1"
        params: list = []

        if vendedor:
            query += " AND vendedor = %s"
            params.append(vendedor)
        if jornada:
            query += " AND jornada = %s"
            params.append(jornada)
        if estado:
            query += " AND estado = %s"
            params.append(estado)

        cursor.execute(query, params)
        rows = cursor.fetchall()

        quinielas = [
            {
                "id":             row["id"],
                "nombre":         row["nombre"],
                "vendedor":       row["vendedor"],
                "predictions":    row["predictions"],
                "estado":         row["estado"],
                "folio":          row["folio"],
                "jornada":        row["jornada"],
                "fecha_creacion": row["fecha_creacion"],
            }
            for row in rows
        ]

        return {
            "success":  True,
            "count":    len(quinielas),
            "quinielas": quinielas,
            "filtros":  {"vendedor": vendedor, "jornada": jornada, "estado": estado},
        }
    except Exception as e:
        print(f"❌ Error listando quinielas: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.get("/api/quinielas/{quiniela_id}")
async def obtener_quiniela(quiniela_id: int):
    conn = get_db()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM quinielas WHERE id = %s", (quiniela_id,))
        row = cursor.fetchone()

        if not row:
            raise HTTPException(
                status_code=404,
                detail=f"Quiniela con ID {quiniela_id} no encontrada"
            )

        return {
            "success": True,
            "quiniela": {
                "id":             row["id"],
                "nombre":         row["nombre"],
                "vendedor":       row["vendedor"],
                "predictions":    row["predictions"],
                "estado":         row["estado"],
                "folio":          row["folio"],
                "jornada":        row["jornada"],
                "fecha_creacion": row["fecha_creacion"],
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error obteniendo quiniela {quiniela_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.delete("/api/quinielas/{quiniela_id}")
async def eliminar_quiniela(quiniela_id: int):
    conn = get_db()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT id FROM quinielas WHERE id = %s", (quiniela_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=404,
                detail=f"Quiniela con ID {quiniela_id} no encontrada"
            )

        cursor.execute("DELETE FROM quinielas WHERE id = %s", (quiniela_id,))
        conn.commit()
        print(f"🗑️ Quiniela eliminada: ID {quiniela_id}")

        return {"success": True, "message": f"Quiniela {quiniela_id} eliminada correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error eliminando quiniela {quiniela_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ========================================
# Confirmar / Rechazar
# ========================================
@app.patch("/api/quinielas/{quiniela_id}/confirmar")
async def confirmar_quiniela(quiniela_id: int):
    conn = get_db()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("SELECT * FROM quinielas WHERE id = %s", (quiniela_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(404, detail=f"Quiniela {quiniela_id} no encontrada")

        vendedor = row["vendedor"]
        jornada  = row["jornada"]
        rango    = obtener_rango_vendedor(vendedor)

        if not rango:
            raise HTTPException(400, detail=f"Vendedor '{vendedor}' no existe")

        inicio_rango, fin_rango = rango

        cursor.execute("""
            SELECT COUNT(*) AS total
            FROM quinielas
            WHERE vendedor = %s AND estado = %s AND jornada = %s
        """, (vendedor, ESTADO_JUGANDO, jornada))

        count_jugando = cursor.fetchone()["total"]
        limite_vendedor = fin_rango - inicio_rango + 1

        if count_jugando >= limite_vendedor:
            nuevo_estado = ESTADO_ESPERA
            nuevo_folio  = None
            mensaje = (
                f"Quiniela en espera. Vendedor {vendedor} llegó a su límite "
                f"({count_jugando}/{limite_vendedor})"
            )
            print(f"⚠️ {mensaje}")
        else:
            cursor.execute("""
                SELECT MAX(CAST(folio AS INTEGER)) AS ultimo
                FROM quinielas
                WHERE vendedor = %s
                  AND jornada  = %s
                  AND folio IS NOT NULL
                  AND folio ~ '^[0-9]+$'
            """, (vendedor, jornada))

            row_ultimo = cursor.fetchone()
            ultimo     = row_ultimo["ultimo"]
            nuevo_folio = (int(ultimo) + 1) if ultimo else inicio_rango

            if nuevo_folio > fin_rango:
                nuevo_estado = ESTADO_ESPERA
                nuevo_folio  = None
                mensaje = (
                    f"Quiniela en espera. Vendedor {vendedor} excede su rango "
                    f"({count_jugando}/{limite_vendedor})"
                )
                print(f"⚠️ {mensaje}")
            else:
                nuevo_estado = ESTADO_JUGANDO
                mensaje = f"Quiniela confirmada y jugando con folio {nuevo_folio}"
                print(
                    f"✅ Quiniela {quiniela_id} confirmada. "
                    f"Vendedor {vendedor} ({count_jugando + 1}/{limite_vendedor}), "
                    f"folio={nuevo_folio}"
                )

        if nuevo_folio is None:
            cursor.execute(
                "UPDATE quinielas SET estado = %s WHERE id = %s",
                (nuevo_estado, quiniela_id)
            )
        else:
            cursor.execute(
                "UPDATE quinielas SET estado = %s, folio = %s WHERE id = %s",
                (nuevo_estado, str(nuevo_folio), quiniela_id)
            )

        conn.commit()

        cursor.execute("SELECT * FROM quinielas WHERE id = %s", (quiniela_id,))
        row = cursor.fetchone()

        return {
            "success": True,
            "message": mensaje,
            "estado":  nuevo_estado,
            "quiniela": {
                "id":             row["id"],
                "nombre":         row["nombre"],
                "vendedor":       row["vendedor"],
                "predictions":    row["predictions"],
                "estado":         row["estado"],
                "folio":          row["folio"],
                "jornada":        row["jornada"],
                "fecha_creacion": row["fecha_creacion"],
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error confirmando quiniela {quiniela_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.delete("/api/quinielas/{quiniela_id}/rechazar")
async def rechazar_quiniela(quiniela_id: int):
    conn = get_db()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("SELECT id FROM quinielas WHERE id = %s", (quiniela_id,))
        if not cursor.fetchone():
            raise HTTPException(404, detail=f"Quiniela {quiniela_id} no encontrada")

        cursor.execute("DELETE FROM quinielas WHERE id = %s", (quiniela_id,))
        conn.commit()
        print(f"🗑️ Quiniela {quiniela_id} rechazada y eliminada")

        return {"success": True, "message": f"Quiniela {quiniela_id} rechazada"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error rechazando quiniela {quiniela_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ========================================
# Verificación PIN
# ========================================
@app.post("/api/verificar-pin")
async def verificar_pin(data: VerificarPinInput):
    try:
        pin_correcto = VENDEDOR_PINS.get(data.vendedor)

        if not pin_correcto:
            raise HTTPException(
                status_code=404,
                detail=f"Vendedor '{data.vendedor}' no encontrado"
            )

        if data.pin != pin_correcto:
            print(f"❌ PIN incorrecto para {data.vendedor}")
            raise HTTPException(status_code=403, detail="PIN incorrecto")

        print(f"✅ Acceso vendedor concedido: {data.vendedor}")

        return {
            "success":        True,
            "vendedor":       data.vendedor,
            "acceso_vendedor": True,
            "timestamp":      datetime.now().isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error verificando PIN: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


# ========================================
# Listas por estado
# ========================================
def _formatear_picks(predictions: dict) -> list:
    picks = []
    for i in range(9):
        pred = predictions.get(str(i), [])
        if isinstance(pred, list):
            picks.append(pred[0] if pred else "-")
        else:
            picks.append(pred or "-")
    return picks


@app.get("/api/vendedores")
async def listar_vendedores():
    vendedores = [
        {
            "nombre":      nombre,
            "rango_inicio": inicio,
            "rango_fin":    fin,
            "capacidad":    fin - inicio + 1,
        }
        for nombre, (inicio, fin) in LIMITES_VENDEDORES.items()
    ]
    return {"success": True, "total_vendedores": len(vendedores), "vendedores": vendedores}


@app.get("/api/pendientes")
async def obtener_pendientes(
    vendedor: str = Query(...),
    jornada:  str = Query(default=JORNADA_ACTUAL)
):
    if not vendedor:
        raise HTTPException(400, detail="Parámetro 'vendedor' requerido")

    conn = get_db()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT * FROM quinielas
            WHERE vendedor = %s AND estado = %s AND jornada = %s
            ORDER BY fecha_creacion ASC
        """, (vendedor, ESTADO_PENDIENTE, jornada))

        rows = cursor.fetchall()
        pendientes = [
            {
                "id":       row["id"],
                "nombre":   row["nombre"],
                "vendedor": row["vendedor"],
                "folio":    row["folio"],
                "picks":    _formatear_picks(row["predictions"]),
            }
            for row in rows
        ]

        print(f"📋 Pendientes de {vendedor} ({jornada}): {len(pendientes)}")

        return {
            "success":   True,
            "count":     len(pendientes),
            "vendedor":  vendedor,
            "pendientes": pendientes,
        }
    except Exception as e:
        print(f"❌ Error en pendientes: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.get("/api/espera")
async def obtener_espera(
    vendedor: str = Query(...),
    jornada:  str = Query(default=JORNADA_ACTUAL)
):
    if not vendedor:
        raise HTTPException(400, detail="Parámetro 'vendedor' requerido")

    conn = get_db()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT * FROM quinielas
            WHERE vendedor = %s AND estado = %s AND jornada = %s
            ORDER BY fecha_creacion ASC
        """, (vendedor, ESTADO_ESPERA, jornada))

        rows   = cursor.fetchall()
        espera = [
            {
                "id":       row["id"],
                "nombre":   row["nombre"],
                "vendedor": row["vendedor"],
                "folio":    row["folio"],
                "picks":    _formatear_picks(row["predictions"]),
            }
            for row in rows
        ]

        print(f"📋 En espera de {vendedor} ({jornada}): {len(espera)}")

        return {
            "success":  True,
            "count":    len(espera),
            "vendedor": vendedor,
            "espera":   espera,
        }
    except Exception as e:
        print(f"❌ Error en espera: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.get("/api/jugando")
async def obtener_jugando(
    vendedor: str = Query(...),
    jornada:  str = Query(default=JORNADA_ACTUAL)
):
    if not vendedor:
        raise HTTPException(400, detail="Parámetro 'vendedor' requerido")

    conn = get_db()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT * FROM quinielas
            WHERE vendedor = %s AND estado = %s AND jornada = %s
            ORDER BY fecha_creacion DESC
        """, (vendedor, ESTADO_JUGANDO, jornada))

        rows    = cursor.fetchall()
        jugando = [
            {
                "id":       row["id"],
                "nombre":   row["nombre"],
                "vendedor": row["vendedor"],
                "folio":    row["folio"],
                "picks":    _formatear_picks(row["predictions"]),
            }
            for row in rows
        ]

        print(f"📋 Jugando de {vendedor} ({jornada}): {len(jugando)}")

        return {
            "success":  True,
            "count":    len(jugando),
            "vendedor": vendedor,
            "jugando":  jugando,
        }
    except Exception as e:
        print(f"❌ Error en jugando: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.get("/api/lista-oficial")
async def obtener_lista_oficial(jornada: str = Query(default=JORNADA_ACTUAL)):
    conn = get_db()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT * FROM quinielas
            WHERE estado = %s AND jornada = %s
            ORDER BY vendedor, fecha_creacion ASC
        """, (ESTADO_JUGANDO, jornada))

        rows = cursor.fetchall()
        lista = [
            {
                "id":             row["id"],
                "nombre":         row["nombre"],
                "vendedor":       row["vendedor"],
                "folio":          row["folio"],
                "picks":          _formatear_picks(row["predictions"]),
                "fecha_creacion": row["fecha_creacion"],
            }
            for row in rows
        ]

        print(f"📋 Lista oficial ({jornada}): {len(lista)} quinielas")

        return {
            "success":   True,
            "count":     len(lista),
            "jornada":   jornada,
            "quinielas": lista,
        }
    except Exception as e:
        print(f"❌ Error en lista oficial: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.get("/lista")
async def get_lista():
    if not os.path.exists("listaoficial.html"):
        raise HTTPException(status_code=404, detail="Archivo listaoficial.html no encontrado")
    return FileResponse("listaoficial.html", media_type="text/html")


# ========================================
# Importación CSV
# ========================================
@app.post("/api/importar-quinielas-csv")
async def importar_quinielas_csv(
    file:   UploadFile = File(...),
    secret: str        = Query(...)
):
    if secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="No autorizado")

    try:
        contents = await file.read()
        decoded  = contents.decode("utf-8-sig")
        reader   = csv.DictReader(io.StringIO(decoded))

        conn = get_db()
        try:
            cursor    = conn.cursor(cursor_factory=RealDictCursor)
            importadas = 0
            errores    = []
            duplicados = []

            for row_num, row in enumerate(reader, start=2):
                try:
                    folio    = row.get("Folio",    "").strip()
                    nombre   = row.get("Nombre",   "").strip()
                    vendedor = row.get("Vendedor", "").strip()

                    if not folio or not nombre or not vendedor:
                        errores.append(f"Fila {row_num}: Faltan datos obligatorios")
                        continue

                    try:
                        int(folio)
                    except ValueError:
                        errores.append(f"Fila {row_num}: Folio '{folio}' no es número válido")
                        continue

                    cursor.execute(
                        "SELECT id, nombre, vendedor FROM quinielas WHERE folio = %s AND jornada = %s",
                        (folio, JORNADA_ACTUAL)
                    )
                    existente = cursor.fetchone()
                    if existente:
                        duplicados.append(
                            f"Fila {row_num}: Folio {folio} ya ocupado por '{existente['nombre']}'"
                        )
                        continue

                    picks       = []
                    picks_validos = True

                    for i in range(1, 10):
                        pick = row.get(f"P{i}", "").strip().upper()
                        if pick not in ["L", "E", "V"]:
                            errores.append(
                                f"Fila {row_num}: P{i} tiene valor inválido '{pick}'"
                            )
                            picks_validos = False
                            break
                        picks.append(pick)

                    if not picks_validos or len(picks) != 9:
                        continue

                    predictions_json = json_module.dumps(
                        {str(i): [pick] for i, pick in enumerate(picks)}
                    )

                    cursor.execute("""
                        INSERT INTO quinielas
                        (nombre, vendedor, predictions, estado, folio, jornada, fecha_creacion)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """, (
                        nombre, vendedor, predictions_json,
                        ESTADO_JUGANDO, folio, JORNADA_ACTUAL,
                        datetime.now().isoformat()
                    ))

                    importadas += 1
                    print(f"✅ Importada: Folio {folio} - {nombre} ({vendedor})")

                except Exception as e:
                    errores.append(f"Fila {row_num}: Error inesperado - {str(e)}")
                    continue

            conn.commit()
        finally:
            conn.close()

        print(f"\n📊 RESUMEN: ✅ {importadas} | ❌ {len(errores)} | 🔄 {len(duplicados)}")

        return {
            "success":          True,
            "importadas":       importadas,
            "errores":          errores,
            "duplicados":       duplicados,
            "total_procesadas": importadas + len(errores) + len(duplicados),
            "mensaje":          f"Importación completada. {importadas} quinielas agregadas.",
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ ERROR CRÍTICO: {e}")
        raise HTTPException(status_code=400, detail=f"Error al procesar archivo: {str(e)}")


@app.get("/api/plantilla-importar")
async def descargar_plantilla_importar():
    csv_content  = "Folio,Nombre,Vendedor,P1,P2,P3,P4,P5,P6,P7,P8,P9\n"
    csv_content += "1,Juan Pérez,MiVendedor,L,E,V,L,E,V,L,E,V\n"
    csv_content += "2,María López,MiVendedor,V,V,V,E,E,E,L,L,L\n"
    csv_content += "999,Pedro García,OtroVendedor,L,L,L,V,V,V,E,E,E\n"
    csv_content += "1500,Ana Sánchez,Cualquiera,E,E,E,L,L,L,V,V,V\n"

    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=plantilla_importar_libre.csv"},
    )


@app.post("/api/enviar-whatsapp")
async def enviar_whatsapp(data: EnviarWhatsAppInput):
    numero       = VENDEDOR_WHATSAPP.get(data.vendedor, "5218112345678")
    whatsapp_url = f"https://wa.me/{numero}?text={data.mensaje}"
    return {"url": whatsapp_url}

# ========================================
# Eliminar todas — protegido con ADMIN_SECRET
# ========================================
@app.delete("/api/eliminar-todas")
async def eliminar_todas_las_quinielas(
    secret:  str = Query(...),
    jornada: str = Query(default=JORNADA_ACTUAL)
):
    if secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="No autorizado")

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM quinielas WHERE jornada = %s",
            (jornada,)
        )
        eliminadas = cursor.rowcount

        cursor.execute(
            "DELETE FROM resultados WHERE jornada = %s",
            (jornada,)
        )

        conn.commit()
        print(f"🗑️ {eliminadas} quinielas eliminadas de {jornada}")

        return {
            "success":   True,
            "mensaje":   f"{eliminadas} quinielas eliminadas",
            "eliminadas": eliminadas,
            "jornada":   jornada,
        }
    except Exception as e:
        print(f"❌ Error eliminando quinielas: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
# ========================================
# Iniciar servidor
# ========================================
if __name__ == "__main__":
    port       = int(os.environ.get("PORT", 8000))
    is_railway = "RAILWAY_ENVIRONMENT" in os.environ

    if not is_railway:
        def get_local_ip():
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.connect(("8.8.8.8", 80))
                ip = s.getsockname()[0]
                s.close()
                return ip
            except Exception:
                return "127.0.0.1"

        local_ip = get_local_ip()
        print("=" * 60)
        print("🚀 Iniciando servidor Quinielas El Wero...")
        print("=" * 60)
        print(f"📍 Localhost:    http://localhost:{port}")
        print(f"📱 En tu red:    http://{local_ip}:{port}")
        print(f"📚 API Docs:     http://localhost:{port}/docs")
        print(f"🔑 Admin Secret: {ADMIN_SECRET}")
        print(f"📅 Jornada:      {JORNADA_ACTUAL}")
        print("=" * 60)
    else:
        print("=" * 60)
        print(f"🚀 Railway — Puerto {port} | Jornada: {JORNADA_ACTUAL}")
        print("=" * 60)

    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")