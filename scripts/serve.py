"""Container entry point: prepare mounted data permissions, drop root, serve one process."""

import os
import sys
from pathlib import Path


def main():
    os.umask(0o077)
    directory = Path(os.environ.get("DATA_DIR", "/app/data")).resolve()
    if directory in {Path("/"), Path("/app"), Path("/etc"), Path("/home")}:
        raise SystemExit("DATA_DIR must be a dedicated application data directory")
    directory.mkdir(parents=True, exist_ok=True)
    if os.geteuid() == 0:
        os.chown(directory, 10001, 10001)
        os.setgroups([])
        os.setgid(10001)
        os.setuid(10001)
    if not os.access(directory, os.W_OK):
        raise SystemExit("DATA_DIR is not writable by the application user")
    if not os.environ.get("PUBLIC_ORIGIN") and os.environ.get("RENDER_EXTERNAL_URL"):
        os.environ["PUBLIC_ORIGIN"] = os.environ["RENDER_EXTERNAL_URL"]
    port = int(os.environ.get("PORT", "8000"))
    if not 1 <= port <= 65535:
        raise SystemExit("PORT must be between 1 and 65535")
    os.execv(
        sys.executable,
        [
            sys.executable,
            "-m",
            "uvicorn",
            "backend.main:create_app",
            "--factory",
            "--host",
            "0.0.0.0",
            "--port",
            str(port),
            "--workers",
            "1",
            "--no-access-log",
            "--proxy-headers",
            "--forwarded-allow-ips",
            os.environ.get("FORWARDED_ALLOW_IPS", "127.0.0.1"),
        ],
    )


if __name__ == "__main__":
    main()
