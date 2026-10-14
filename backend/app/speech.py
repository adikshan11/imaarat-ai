"""Server-side speech for Saathi: Sarvam turns a reply into audio so every device can hear it, whatever voices it has installed."""

from __future__ import annotations

import base64
import json
import urllib.error
import urllib.request

from app import budget, config

URL = "https://api.sarvam.ai/text-to-speech"
MODEL = "bulbul:v3"
MAX_CHARS = 700
VOICE_LANGUAGES = {
    "en": "en-IN",
    "hi": "hi-IN",
    "bn": "bn-IN",
    "gu": "gu-IN",
    "kn": "kn-IN",
    "ml": "ml-IN",
    "mr": "mr-IN",
    "or": "od-IN",
    "pa": "pa-IN",
    "ta": "ta-IN",
    "te": "te-IN",
    "mai": "hi-IN",
    "doi": "hi-IN",
    "gom": "hi-IN",
    "bho": "hi-IN",
    "hne": "hi-IN",
    "sa": "hi-IN",
    "ne": "hi-IN",
    "brx": "hi-IN",
    "as": "bn-IN",
    "tcy": "kn-IN",
}


class SpeechUnavailable(Exception):
    """No key, a language without a server voice, or Sarvam failed."""


class SpeechLimit(Exception):
    """The daily speech allowance for this visitor or for everyone is used up."""


def available(language: str) -> bool:
    return bool(config.SARVAM_API_KEY) and language in VOICE_LANGUAGES


def synthesize(text: str, language: str, address: str | None) -> bytes:
    """MP3 audio for one reply; raises SpeechUnavailable or SpeechLimit."""
    if not available(language):
        raise SpeechUnavailable
    if not budget.allow(f"speech-{budget.client_scope(address)}", config.SPEECH_CLIENT_DAILY) or not budget.allow("speech", config.SPEECH_DAILY):
        raise SpeechLimit
    body = json.dumps({"text": text[:MAX_CHARS], "language_code": VOICE_LANGUAGES[language], "model": MODEL, "output_audio_codec": "mp3"}).encode()
    request = urllib.request.Request(URL, data=body, headers={"api-subscription-key": config.SARVAM_API_KEY, "Content-Type": "application/json"})  # noqa: S310
    try:
        with urllib.request.urlopen(request, timeout=config.SPEECH_SECONDS) as response:  # noqa: S310
            audio = json.load(response)["audios"][0]
        return base64.b64decode(audio)
    except (urllib.error.URLError, TimeoutError, KeyError, IndexError, ValueError) as error:
        print(f"[speech] status=failed reason={type(error).__name__}")
        raise SpeechUnavailable from error
