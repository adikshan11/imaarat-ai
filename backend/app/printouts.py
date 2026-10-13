"""Single-use, expiring serial numbers and QR codes for printed paper proposal forms."""

from __future__ import annotations

import os
import re
import time
from hashlib import sha256
from secrets import choice

import segno
from sqlalchemy import BigInteger, Column, MetaData, String, Table, delete, insert, select, update
from sqlalchemy.engine import Engine

from app import config
from app.db import get_engine

ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
BODY_LENGTH = 11
LOOKALIKES = str.maketrans({"O": "0", "I": "1", "L": "1", "U": "V"})
SERIAL_PATTERN = re.compile(r"([0-9A-Z]{4})[- ]?([0-9A-Z]{4})[- ]?([0-9A-Z]{4})")

REFUSALS = {
    "unknown": (422, "This serial was not issued by Imaarat. Print a fresh form from the Paper form page."),
    "used": (409, "This printout was already used. Print a fresh form from the Paper form page."),
    "expired": (410, "This printout has expired. Print a fresh form from the Paper form page."),
}

metadata = MetaData()
printouts = Table(
    "form_printouts",
    metadata,
    Column("serial", String, primary_key=True),
    Column("issued_at", BigInteger, nullable=False),
    Column("expires_at", BigInteger, nullable=False),
    Column("used_at", BigInteger),
    Column("issuer", String),
)
ready_engines: set[str] = set()


def engine() -> Engine:
    current = get_engine()
    if str(current.url) not in ready_engines:
        metadata.create_all(current)
        ready_engines.add(str(current.url))
    return current


def checksum(body: str) -> str:
    return ALPHABET[sum((position + 1) * ALPHABET.index(char) for position, char in enumerate(body)) % len(ALPHABET)]


def new_serial() -> str:
    body = "".join(choice(ALPHABET) for _ in range(BODY_LENGTH))
    return body + checksum(body)


def display(serial: str) -> str:
    return "-".join(serial[start : start + 4] for start in range(0, len(serial), 4))


def normalise(text: str | None) -> str | None:
    """The serial found in printed or scanned text, or None when none passes its check character."""
    for match in SERIAL_PATTERN.finditer((text or "").upper().translate(LOOKALIKES)):
        serial = "".join(match.groups())
        if checksum(serial[:BODY_LENGTH]) == serial[BODY_LENGTH]:
            return serial
    return None


def verify_url(serial: str) -> str:
    host = os.getenv("VERCEL_PROJECT_PRODUCTION_URL")
    base = os.getenv("PUBLIC_BASE_URL") or (f"https://{host}/api" if host else "http://localhost:8000")
    return f"{base}/paper/printouts/{serial}"


def qr_rows(serial: str) -> list[str]:
    code = segno.make(verify_url(serial), error="m", micro=False)
    return ["".join("1" if module else "0" for module in row) for row in code.matrix]


def issue(client: str | None) -> dict[str, object]:
    now = int(time.time())
    issuer = sha256(f"{now // 86400}:{client or 'unknown'}".encode()).hexdigest()[:16]
    serial = new_serial()
    with engine().begin() as conn:
        conn.execute(delete(printouts).where(printouts.c.expires_at < now - 86400))
        conn.execute(insert(printouts).values(serial=serial, issued_at=now, expires_at=now + config.PRINTOUT_SECONDS, issuer=issuer))
    return {"serial": serial, "display": display(serial), "expires_at": now + config.PRINTOUT_SECONDS, "qr": qr_rows(serial)}


def state(serial: str) -> str:
    """One of valid, used, expired or unknown."""
    with engine().connect() as conn:
        row = conn.execute(select(printouts.c.expires_at, printouts.c.used_at).where(printouts.c.serial == serial)).first()
    if row is None:
        return "unknown"
    if row.used_at is not None:
        return "used"
    return "expired" if row.expires_at <= time.time() else "valid"


def refusal(serial: str | None) -> tuple[int, str] | None:
    """The status code and message for a serial that cannot be used, or None when it can."""
    if serial is None:
        return 422, "No valid Imaarat serial was found on this page. Print the form from the Paper form page and photograph it with the serial and QR code in view."
    return REFUSALS.get(state(serial))


def consume(serial: str) -> bool:
    """Marks a valid printout used; False when another read got there first or it expired."""
    now = int(time.time())
    with engine().begin() as conn:
        result = conn.execute(update(printouts).where(printouts.c.serial == serial, printouts.c.used_at.is_(None), printouts.c.expires_at > now).values(used_at=now))
    return result.rowcount == 1
