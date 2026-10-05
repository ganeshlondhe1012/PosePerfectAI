from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_installer_uses_no_powershell_setup_path():
    setup = (ROOT / "setup_windows.bat").read_text(encoding="utf-8")
    assert "powershell" not in setup.lower()
    assert "setup_backend.py" in setup


def test_installer_bootstrap_is_valid_python_source():
    source = (ROOT / "tools" / "setup_backend.py").read_text(encoding="utf-8")
    compile(source, str(ROOT / "tools" / "setup_backend.py"), "exec")


def test_installer_model_and_server_scripts_have_no_ps1_dependency():
    start = (ROOT / "start_windows.bat").read_text(encoding="utf-8")
    assert ".ps1" not in start.lower()
    doctor = (ROOT / "doctor_windows.bat").read_text(encoding="utf-8")
    assert ".py" in doctor.lower()


def test_installer_does_not_validate_full_stack_after_first_stage():
    text = (ROOT / "tools" / "setup_backend.py").read_text(encoding="utf-8")
    assert "validate_imports(imports, name)" in text
    assert 'validate_imports(FULL_IMPORT_CHECKS, "Full backend")' in text
    assert "(" in text and "Server and protocol packages" in text


def test_installer_validates_stage_specific_imports():
    text = (ROOT / "tools" / "setup_backend.py").read_text(encoding="utf-8")
    assert '"FastAPI web stack"' in text
    assert '["import fastapi"]' in text
    assert 'validate_imports(imports, name)' in text
    assert 'validate_imports(FULL_IMPORT_CHECKS, "Full backend")' in text


def test_installer_stage_definitions_are_scoped():
    namespace = {"__file__": str(ROOT / "tools" / "setup_backend.py")}
    source = (ROOT / "tools" / "setup_backend.py").read_text(encoding="utf-8")
    prefix = source.split("def log(", 1)[0]
    exec(prefix, namespace)
    groups = namespace["GROUPS"]
    assert groups[0][0] == "FastAPI web stack"
    assert groups[0][2] == ["import fastapi"]
    assert "import uvicorn" in groups[1][2]
    assert "import mediapipe" in groups[2][2]
    assert "import pytest" in groups[3][2]
