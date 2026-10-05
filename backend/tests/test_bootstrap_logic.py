from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_v10_installer_is_plain_batch_plus_python():
    bat = (ROOT / "setup_windows.bat").read_text(encoding="utf-8").lower()
    py = (ROOT / "tools" / "setup_backend.py").read_text(encoding="utf-8")
    assert "powershell" not in bat
    assert "setup_backend.py" in bat
    compile(py, str(ROOT / "tools" / "setup_backend.py"), "exec")


def test_v10_bootstrap_retries_child_commands():
    text = (ROOT / "tools" / "setup_backend.py").read_text(encoding="utf-8")
    assert "KeyboardInterrupt" in text
    assert "retries=" in text
    assert "subprocess.run" in text


def test_v10_uses_pinned_runtime_groups():
    text = (ROOT / "tools" / "setup_backend.py").read_text(encoding="utf-8")
    for required in ("fastapi==0.116.1", "mediapipe==1.0.1", "opencv-contrib-python==4.12.0.88", "numpy==2.2.6"):
        assert required in text
