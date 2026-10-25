"""CI-only checks against a real container; no model calls or deployment."""

import json
import re
import subprocess
import time
import urllib.request


def main():
    base = "http://127.0.0.1:8003"
    for attempt in range(30):
        try:
            with urllib.request.urlopen(base + "/api/ready", timeout=2) as response:
                assert response.status == 200
            break
        except (OSError, AssertionError):
            if attempt == 29:
                raise
            time.sleep(1)
    with urllib.request.urlopen(base + "/api/config") as response:
        config = json.load(response)
        assert config["app_mode"] == "public" and not config["admin_available"]
        assert "Secure" in response.headers["set-cookie"]
    payload = json.dumps({"mode": "recorded", "question": config["examples"][0]["question"]}).encode()
    request = urllib.request.Request(base + "/api/ask", data=payload,
                                    headers={"Content-Type": "application/json", "Origin": "https://sourcewell-ci.example"})
    with urllib.request.urlopen(request) as response:
        answer = json.load(response)
        assert answer["mode"] == "recorded" and answer["usage"] == [] and answer["sources"]
    with urllib.request.urlopen(base + "/preview/workspace.png") as response:
        assert response.headers["Content-Type"].startswith("image/png")
    status = subprocess.check_output(["docker", "exec", "sourcewell-ci", "cat", "/proc/1/status"], text=True)
    assert re.search(r"Uid:\s+10001\s+10001", status), "Application must drop root before serving"
    print("Container passed: persistent-volume startup, non-root application, secure cookies, readiness, assets, recorded answers.")


if __name__ == "__main__":
    main()
