"""Underwriter profile: name and mobile number are required before reviewing; the photo is optional and re-encoded."""

from __future__ import annotations

import re
import time
import unicodedata

from fastapi import HTTPException
from sqlalchemy import select, update

from app import auth, config, images

BLOCKED = set('<>{}[]\\/@#$%^*=+|~`"')


def clean_name(value: object) -> str:
    name = " ".join(str(value or "").split())
    letters = sum(1 for char in name if char.isalpha())
    unsafe = any(char.isdigit() or char in BLOCKED or unicodedata.category(char)[0] == "C" for char in name)
    if not 2 <= len(name) <= 80 or letters < 2 or unsafe:
        raise HTTPException(422, "Enter your full name (2 to 80 letters, no digits or symbols)")
    return name


def clean_phone(value: object) -> str:
    phone = re.sub(r"[\s().-]", "", str(value or ""))
    if re.fullmatch(r"[6-9]\d{9}", phone):
        phone = "+91" + phone
    elif re.fullmatch(r"0[6-9]\d{9}", phone):
        phone = "+91" + phone[1:]
    if not re.fullmatch(r"\+[1-9]\d{7,14}", phone) or (phone.startswith("+91") and not re.fullmatch(r"\+91[6-9]\d{9}", phone)):
        raise HTTPException(422, "Enter a mobile number with its country code, for example +91 98765 43210")
    return phone


def clean_photo(data: bytes, content_type: str | None) -> bytes:
    return images.square_webp(data, content_type, images.PROFILE, config.PROFILE_PHOTO_SIDE)


def read(owner_id: str) -> dict:
    with auth.engine().connect() as conn:
        row = conn.execute(select(auth.profiles.c.full_name, auth.profiles.c.phone, auth.profiles.c.photo.is_not(None).label("has_photo")).where(auth.profiles.c.owner_id == owner_id)).first()
    if row is None:
        return {"full_name": None, "phone": None, "has_photo": False, "complete": False}
    return {"full_name": row.full_name, "phone": row.phone, "has_photo": bool(row.has_photo), "complete": bool(row.full_name and row.phone)}


def save(owner_id: str, full_name: object, phone: object, now: int | None = None) -> dict:
    values = {"full_name": clean_name(full_name), "phone": clean_phone(phone), "updated_at": auth.clock(now)}
    with auth.engine().begin() as conn:
        conn.execute(auth.upsert(conn)(auth.profiles).values(owner_id=owner_id, **values).on_conflict_do_update(index_elements=[auth.profiles.c.owner_id], set_=values))
    return read(owner_id)


def save_photo(owner_id: str, photo: bytes | None) -> dict:
    with auth.engine().begin() as conn:
        updated = conn.execute(update(auth.profiles).where(auth.profiles.c.owner_id == owner_id).values(photo=photo, updated_at=int(time.time()))).rowcount
    if not updated:
        raise HTTPException(409, "Save your name and mobile number first")
    return read(owner_id)


def photo(owner_id: str) -> bytes | None:
    with auth.engine().connect() as conn:
        return conn.execute(select(auth.profiles.c.photo).where(auth.profiles.c.owner_id == owner_id)).scalar()
