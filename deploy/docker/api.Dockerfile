FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

COPY requirements.txt requirements-qdrant.txt ./
RUN pip install -r requirements.txt -r requirements-qdrant.txt

COPY api ./api
COPY backend ./backend
RUN useradd --create-home --uid 10001 imaarat && chown -R imaarat /app/backend/data
USER imaarat

EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --retries=10 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/status', timeout=4)"
CMD ["uvicorn", "api.index:app", "--host", "0.0.0.0", "--port", "8000"]
