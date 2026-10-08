"""One policy for every uploaded image: allowed types, size and pixel limits, decoding and re-encoding."""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from app import config

FORMATS = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}
SUFFIXES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


@dataclass(frozen=True)
class ImageRule:
    label: str
    max_bytes: int


PROFILE = ImageRule("profile photo", config.PROFILE_PHOTO_BYTES)
FORM = ImageRule("form photo", config.FORM_PHOTO_BYTES)
PROPERTY = ImageRule("property photo", config.PROPERTY_PHOTO_BYTES)


def megabytes(size: int) -> str:
    return f"{size / 1_000_000:g} MB"


def limits() -> dict:
    return {"types": list(FORMATS), "max_pixels": config.IMAGE_MAX_PIXELS, **{rule.label.replace(" ", "_"): rule.max_bytes for rule in (PROFILE, FORM, PROPERTY)}}


def decode(data: bytes, content_type: str | None, rule: ImageRule) -> Image.Image:
    if content_type not in FORMATS:
        raise HTTPException(415, f"Upload the {rule.label} as JPEG, PNG or WebP")
    if len(data) > rule.max_bytes:
        raise HTTPException(413, f"The {rule.label} is larger than {megabytes(rule.max_bytes)}")
    try:
        image = Image.open(BytesIO(data))
        if image.format != FORMATS[content_type] or image.width * image.height > config.IMAGE_MAX_PIXELS:
            raise HTTPException(415, f"The {rule.label} is not a valid {content_type.split('/')[1].upper()} image")
        image.load()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as error:
        raise HTTPException(415, f"The {rule.label} could not be read") from error
    return image


async def receive(upload: UploadFile, rule: ImageRule) -> bytes:
    data = await upload.read(rule.max_bytes + 1)
    decode(data, upload.content_type, rule)
    return data


def square_webp(data: bytes, content_type: str | None, rule: ImageRule, side: int) -> bytes:
    square = ImageOps.fit(ImageOps.exif_transpose(decode(data, content_type, rule)).convert("RGB"), (side, side))
    output = BytesIO()
    square.save(output, "WEBP", quality=82)
    return output.getvalue()
