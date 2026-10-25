FROM node:24-bookworm-slim AS web
WORKDIR /app/frontend
RUN npm install --global pnpm@11.25.0
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build

FROM python:3.12-slim AS app
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DATA_DIR=/app/data
COPY --from=ghcr.io/astral-sh/uv:0.13.5 /uv /usr/local/bin/uv
COPY pyproject.toml uv.lock ./
COPY backend/ ./backend/
RUN uv sync --frozen --no-dev
COPY fixtures/ ./fixtures/
COPY evaluation/ ./evaluation/
COPY scripts/ ./scripts/
COPY --from=web /app/frontend/dist ./frontend/dist
RUN useradd --create-home --uid 10001 sourcewell && mkdir /app/data && chown sourcewell:sourcewell /app/data
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD ["/app/.venv/bin/python", "-c", "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PORT','8000')+'/api/ready',timeout=4)"]
CMD ["/app/.venv/bin/python", "-m", "scripts.serve"]
