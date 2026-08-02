"""Lector de correo IMAP para Gmail.

Busca correos sin leer con Excel adjunto que encajen con los filtros de la
automatización. Los filtros de remitente/asunto/nombre de adjunto son
opcionales; el que de verdad decide es el contenido: si el Excel no tiene
tabla de viajes, el correo no sirve (eso lo comprueba el worker al parsearlo).

Los correos NO se marcan como leídos aquí. El worker llama a `mark_seen()`
solo cuando el procesado ha ido bien; si falla, el correo sigue sin leer y se
reintenta en el siguiente poll en vez de perderse en silencio.
"""

import email
import imaplib
import logging
import re
from datetime import datetime
from email.header import decode_header
from typing import Iterable, Optional

logger = logging.getLogger(__name__)

_EXCEL_EXTS = (".xlsx", ".xlsm", ".xls")
_IMAP_HOST = "imap.gmail.com"
_IMAP_PORT = 993


def _decode_str(raw) -> str:
    """Decodifica una cabecera de email que puede venir codificada."""
    if raw is None:
        return ""
    partes = []
    for data, charset in decode_header(raw):
        if isinstance(data, bytes):
            partes.append(data.decode(charset or "utf-8", errors="replace"))
        else:
            partes.append(data)
    return " ".join(partes)


def _connect(imap_email: str, app_password: str) -> imaplib.IMAP4_SSL:
    conn = imaplib.IMAP4_SSL(_IMAP_HOST, _IMAP_PORT)
    conn.login(imap_email, app_password)
    return conn


def test_imap_connection(imap_email: str, app_password: str) -> dict:
    """Prueba la conexión IMAP. Devuelve {ok, message, mailbox_count}."""
    try:
        conn = _connect(imap_email, app_password)
        status, data = conn.select("INBOX", readonly=True)
        count = int(data[0]) if status == "OK" else 0
        conn.logout()
        return {
            "ok": True,
            "message": f"Conexión correcta. {count} mensajes en la bandeja.",
            "mailbox_count": count,
        }
    except imaplib.IMAP4.error as e:
        return {"ok": False, "message": f"Error de autenticación: {e}", "mailbox_count": 0}
    except Exception as e:
        return {"ok": False, "message": f"Error de conexión: {e}", "mailbox_count": 0}


def _search_criteria(sender_filter: Optional[str], subject_filter: Optional[str],
                     solo_no_leidos: bool = True) -> str:
    criterios = ["UNSEEN"] if solo_no_leidos else ["ALL"]
    if sender_filter:
        criterios.append(f'FROM "{sender_filter}"')
    if subject_filter:
        criterios.append(f'SUBJECT "{subject_filter}"')
    return "(" + " ".join(criterios) + ")"


def _excel_attachments(msg: email.message.Message,
                       attachment_filter: Optional[str] = None) -> list[tuple[str, bytes]]:
    """Adjuntos Excel del mensaje, filtrados por nombre si procede.

    El filtro es "el nombre contiene X" y no una coincidencia exacta: el
    fichero suele llamarse distinto cada mes ("viajes agosto.xlsx"), así que
    exigir el nombre completo obligaría a reconfigurar constantemente.
    """
    encontrados = []
    patron = (attachment_filter or "").strip().lower()
    for parte in msg.walk():
        disposicion = str(parte.get("Content-Disposition") or "")
        if "attachment" not in disposicion:
            continue
        nombre = parte.get_filename()
        if not nombre:
            continue
        nombre = _decode_str(nombre)
        if not nombre.lower().endswith(_EXCEL_EXTS):
            continue
        if patron and patron not in nombre.lower():
            continue
        contenido = parte.get_payload(decode=True)
        if contenido:
            encontrados.append((nombre, contenido))
    return encontrados


def _fecha_mensaje(msg: email.message.Message) -> Optional[datetime]:
    cabecera = msg.get("Date")
    if not cabecera:
        return None
    try:
        from email.utils import parsedate_to_datetime
        return parsedate_to_datetime(cabecera)
    except Exception:
        return None


def _uid_de(conn: imaplib.IMAP4_SSL, msg_id: bytes) -> str:
    """UID persistente del mensaje (el nº de secuencia cambia entre sesiones)."""
    try:
        status, resp = conn.fetch(msg_id, "(UID)")
        if status == "OK" and resp and resp[0]:
            m = re.search(r"UID\s+(\d+)", resp[0].decode(errors="replace"))
            if m:
                return m.group(1)
    except Exception:
        pass
    return msg_id.decode()


def fetch_excel_emails(
    imap_email: str,
    app_password: str,
    sender_filter: Optional[str] = None,
    subject_filter: Optional[str] = None,
    attachment_filter: Optional[str] = None,
    skip_uids: Optional[Iterable[str]] = None,
    limite: int = 20,
) -> list[dict]:
    """Correos sin leer con Excel adjunto que encajen con los filtros.

    Devuelve [{uid, from, subject, date, attachments: [(nombre, bytes)]}].
    No modifica el estado de leído de ningún mensaje.
    """
    ya_vistos = set(skip_uids or ())
    resultados = []
    conn = None
    try:
        conn = _connect(imap_email, app_password)
        # readonly: al leer con PEEK y sin escribir flags, Gmail no marca nada
        conn.select("INBOX", readonly=True)

        status, ids = conn.search(None, _search_criteria(sender_filter, subject_filter))
        if status != "OK" or not ids or not ids[0]:
            return resultados

        for msg_id in ids[0].split()[-limite:]:
            uid = _uid_de(conn, msg_id)
            if uid in ya_vistos:
                continue

            status2, datos = conn.fetch(msg_id, "(BODY.PEEK[])")
            if status2 != "OK" or not datos or not datos[0]:
                continue

            msg = email.message_from_bytes(datos[0][1])
            adjuntos = _excel_attachments(msg, attachment_filter)
            if not adjuntos:
                continue

            resultados.append({
                "uid": uid,
                "from": _decode_str(msg.get("From")),
                "subject": _decode_str(msg.get("Subject")),
                "date": _fecha_mensaje(msg),
                "attachments": adjuntos,
            })

        return resultados

    except Exception as e:
        logger.error("email_reader: %s", e)
        raise
    finally:
        if conn:
            try:
                conn.close()
                conn.logout()
            except Exception:
                pass


def mark_seen(imap_email: str, app_password: str, uid: str) -> bool:
    """Marca un mensaje como leído. Se llama solo tras procesarlo con éxito."""
    conn = None
    try:
        conn = _connect(imap_email, app_password)
        conn.select("INBOX")
        conn.uid("STORE", uid, "+FLAGS", "(\\Seen)")
        return True
    except Exception as e:
        logger.error("email_reader: no se pudo marcar como leído el UID %s — %s", uid, e)
        return False
    finally:
        if conn:
            try:
                conn.close()
                conn.logout()
            except Exception:
                pass


def preview_filters(
    imap_email: str,
    app_password: str,
    sender_filter: Optional[str] = None,
    subject_filter: Optional[str] = None,
    attachment_filter: Optional[str] = None,
    limite: int = 15,
) -> list[dict]:
    """Prueba los filtros sobre los últimos correos y explica qué pasaría.

    Sirve para el botón "Probar filtros": configurar a ciegas qué correos
    entran y cuáles no es de las cosas más frustrantes que hay.
    Mira también los ya leídos, para poder probar con correos antiguos.
    """
    salida = []
    conn = None
    try:
        conn = _connect(imap_email, app_password)
        conn.select("INBOX", readonly=True)

        status, ids = conn.search(None, _search_criteria(sender_filter, subject_filter, False))
        if status != "OK" or not ids or not ids[0]:
            return salida

        for msg_id in ids[0].split()[-limite:]:
            status2, datos = conn.fetch(msg_id, "(BODY.PEEK[HEADER])")
            if status2 != "OK" or not datos or not datos[0]:
                continue
            cabeceras = email.message_from_bytes(datos[0][1])

            status3, cuerpo = conn.fetch(msg_id, "(BODY.PEEK[])")
            msg = email.message_from_bytes(cuerpo[0][1]) if status3 == "OK" and cuerpo and cuerpo[0] else None

            todos_excel = _excel_attachments(msg) if msg else []
            con_filtro = _excel_attachments(msg, attachment_filter) if msg else []

            if con_filtro:
                motivo = "Entra: " + ", ".join(n for n, _ in con_filtro)
            elif todos_excel:
                motivo = "Descartado: el nombre del adjunto no coincide (" + \
                         ", ".join(n for n, _ in todos_excel) + ")"
            else:
                motivo = "Descartado: sin Excel adjunto"

            salida.append({
                "from": _decode_str(cabeceras.get("From")),
                "subject": _decode_str(cabeceras.get("Subject")),
                "date": _fecha_mensaje(cabeceras),
                "matches": bool(con_filtro),
                "reason": motivo,
            })

        salida.reverse()   # el más reciente primero
        return salida
    except Exception as e:
        logger.error("email_reader: error probando filtros — %s", e)
        raise
    finally:
        if conn:
            try:
                conn.close()
                conn.logout()
            except Exception:
                pass
