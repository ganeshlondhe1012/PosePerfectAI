from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_setup_scripts_exist():
    assert (ROOT / "setup_windows.bat").exists()
    assert (ROOT / "tools" / "setup_backend.py").exists()
    assert not (ROOT / "tools" / "setup_windows.ps1").exists()
    assert not (ROOT / "tools" / "download_model.ps1").exists()


def test_start_backend_checks_environment_and_uses_python_runner():
    text = (ROOT / "start_windows.bat").read_text(encoding="utf-8").lower()
    assert ".venv\\scripts\\python.exe" in text
    assert "run.py" in text
    assert "models\\pose_landmarker_lite.task" in text
    assert ".ps1" not in text
