from typing import Annotated

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

from app import auth, dev_console

router = APIRouter(prefix="/dev")
NO_STORE = {"Cache-Control": "no-store"}
ACTION = "open the dev console"


def owner_only(request: Request) -> None:
    auth.require_operator(request, change=False, action=ACTION)


@router.get("/overview")
def overview(request: Request):
    owner_only(request)
    return JSONResponse(dev_console.overview(), headers=NO_STORE)


@router.get("/architecture")
def architecture(request: Request):
    owner_only(request)
    return JSONResponse(dev_console.architecture(), headers=NO_STORE)


@router.get("/routes")
def routes(request: Request):
    owner_only(request)
    return JSONResponse(dev_console.routes(request.app), headers=NO_STORE)


@router.get("/ai-calls")
def ai_calls(request: Request):
    owner_only(request)
    return JSONResponse(dev_console.ai_calls(), headers=NO_STORE)


@router.get("/traces")
def traces(request: Request):
    owner_only(request)
    return JSONResponse(dev_console.traces(), headers=NO_STORE)


@router.get("/retrieval")
def retrieval(request: Request, q: Annotated[str, Query(min_length=2, max_length=300)]):
    owner_only(request)
    return JSONResponse(dev_console.retrieval(q.strip()), headers=NO_STORE)
