import os

import pytest

from scripts import serve


def test_entrypoint_prepares_volume_drops_root_and_executes_one_worker(tmp_path, monkeypatch):
    events = []
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "mounted"))
    monkeypatch.setenv("PORT", "9000")
    monkeypatch.setenv("RENDER_EXTERNAL_URL", "https://demo.example")
    monkeypatch.delenv("PUBLIC_ORIGIN", raising=False)
    monkeypatch.setattr(os, "geteuid", lambda: 0)
    monkeypatch.setattr(os, "chown", lambda *args: events.append("chown"))
    monkeypatch.setattr(os, "setgroups", lambda *args: events.append("groups"))
    monkeypatch.setattr(os, "setgid", lambda value: events.append(("gid", value)))
    monkeypatch.setattr(os, "setuid", lambda value: events.append(("uid", value)))
    monkeypatch.setattr(os, "umask", lambda value: None)

    def execute(program, args):
        assert events == ["chown", "groups", ("gid", 10001), ("uid", 10001)]
        assert args[args.index("--workers") + 1] == "1"
        assert args[args.index("--port") + 1] == "9000"
        assert os.environ["PUBLIC_ORIGIN"] == "https://demo.example"
        raise SystemExit(0)

    monkeypatch.setattr(os, "execv", execute)
    with pytest.raises(SystemExit) as exit_status:
        serve.main()
    assert exit_status.value.code == 0
