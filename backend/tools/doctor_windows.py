from __future__ import annotations

import importlib.util
import shutil
import socket
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def check(label: str, ok: bool, detail: str = "") -> None:
    print(f"{'PASS' if ok else 'FAIL':4} | {label}{(' — ' + detail) if detail else ''}")

def main() -> int:
    print("PosePerfect AI Windows backend doctor")
    print(f"Python: {sys.version.split()[0]}")
    check("Python 3.12", sys.version_info[:2] == (3, 12))
    check("curl.exe", shutil.which("curl.exe") is not None)
    try:
        socket.gethostbyname("pypi.org"); pypi_ok=True
    except OSError:
        pypi_ok=False
    check("DNS pypi.org", pypi_ok)
    try:
        socket.gethostbyname("storage.googleapis.com"); model_ok=True
    except OSError:
        model_ok=False
    check("DNS storage.googleapis.com", model_ok)
    venv = ROOT / ".venv" / "Scripts" / "python.exe"
    check("virtual environment", venv.exists(), str(venv))
    if venv.exists():
        result = subprocess.run([str(venv), "-c", "import sys; print(sys.version)"], text=True, capture_output=True)
        check("venv executable", result.returncode == 0, result.stdout.strip())
    return 0 if all([sys.version_info[:2] == (3, 12), shutil.which("curl.exe") is not None, pypi_ok, model_ok]) else 1

if __name__ == '__main__':
    raise SystemExit(main())
