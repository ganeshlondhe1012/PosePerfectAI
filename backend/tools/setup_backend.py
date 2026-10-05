from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
VENV_PYTHON = ROOT / ".venv" / "Scripts" / "python.exe"
REQ = ROOT / "requirements.txt"
MODEL_DIR = ROOT / "models"
MODEL_PATH = MODEL_DIR / "pose_landmarker_lite.task"
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"

GROUPS: list[tuple[str, list[str], list[str]]] = [
    (
        "FastAPI web stack",
        ["fastapi==0.116.1"],
        ["import fastapi"],
    ),
    (
        "Server and protocol packages",
        [
            "uvicorn==0.35.0",
            "websockets==17.2",
            "python-multipart==0.0.20",
            "python-dotenv==1.1.1",
        ],
        ["import uvicorn", "import websockets", "import multipart", "import dotenv"],
    ),
    (
        "Image and MediaPipe runtime",
        [
            "numpy==2.2.6",
            "Pillow==12.3.0",
            "mediapipe==1.0.1",
            "opencv-contrib-python==4.12.0.88",
        ],
        ["import numpy", "import PIL", "import mediapipe", "import cv2"],
    ),
    (
        "Test tools",
        ["pytest==8.4.1", "httpx==0.28.1"],
        ["import pytest", "import httpx"],
    ),
]

FULL_IMPORT_CHECKS = [
    "import fastapi",
    "import uvicorn",
    "import websockets",
    "import multipart",
    "import dotenv",
    "import numpy",
    "import PIL",
    "import mediapipe",
    "import cv2",
    "import pytest",
    "import httpx",
]


def log(message: str) -> None:
    print(f"[PosePerfect] {message}", flush=True)


def run_capture(args: list[str], *, retries: int = 3, timeout: int = 1800) -> tuple[bool, str]:
    last_output = ""
    env = os.environ.copy()
    env["PIP_DISABLE_PIP_VERSION_CHECK"] = "1"
    env["PYTHONUNBUFFERED"] = "1"
    for attempt in range(1, retries + 1):
        log(f"Command attempt {attempt}/{retries}: {' '.join(args)}")
        try:
            completed = subprocess.run(
                args,
                cwd=ROOT,
                env=env,
                text=True,
                timeout=timeout,
            )
        except KeyboardInterrupt:
            log("The child command was interrupted; automatically retrying...")
            time.sleep(2)
            continue
        except subprocess.TimeoutExpired:
            last_output = "The command timed out."
            log("The child command timed out; automatically retrying...")
            time.sleep(2)
            continue
        except OSError as exc:
            return False, str(exc)
        if completed.returncode == 0:
            return True, ""
        last_output = f"Command exited with code {completed.returncode}."
        log(f"Command returned {completed.returncode}; retrying...")
        time.sleep(2 * attempt)
    return False, last_output


def pip_install(packages: Iterable[str]) -> bool:
    args = [
        str(VENV_PYTHON),
        "-m",
        "pip",
        "install",
        "--disable-pip-version-check",
        "--no-input",
        "--prefer-binary",
        "--only-binary=:all:",
        "--retries",
        "8",
        "--timeout",
        "180",
        *packages,
    ]
    ok, _ = run_capture(args, retries=4, timeout=1800)
    return ok


def validate_imports(imports: Iterable[str], label: str) -> bool:
    code = "; ".join(imports) + "; print(\"IMPORTS_OK\")"
    ok, _ = run_capture([str(VENV_PYTHON), "-c", code], retries=2, timeout=120)
    if not ok:
        print(f"[PosePerfect] {label} import validation failed.")
        return False
    log(f"{label} import validation: OK")
    return True


def pip_check() -> bool:
    ok, output = run_capture([str(VENV_PYTHON), "-m", "pip", "check"], retries=2, timeout=120)
    if not ok:
        print(output[-6000:])
        return False
    log("pip check: OK")
    return True


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download_model() -> bool:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    if MODEL_PATH.exists() and MODEL_PATH.stat().st_size > 1_000_000:
        log(f"MediaPipe model already present: {MODEL_PATH.name}")
        return True

    curl = shutil.which("curl.exe") or shutil.which("curl")
    if not curl:
        print("[PosePerfect] Windows curl.exe was not found. Install/update Windows 10/11 or add curl to PATH.")
        return False

    part = MODEL_PATH.with_suffix(".task.part")
    for attempt in range(1, 5):
        log(f"Downloading MediaPipe pose model (attempt {attempt}/4)")
        args = [
            curl,
            "--fail",
            "--location",
            "--retry",
            "8",
            "--retry-all-errors",
            "--retry-delay",
            "2",
            "--connect-timeout",
            "30",
            "--max-time",
            "1800",
            "-C",
            "-",
            "-o",
            str(part),
            MODEL_URL,
        ]
        try:
            completed = subprocess.run(args, cwd=ROOT, text=True, capture_output=True, timeout=1900)
        except KeyboardInterrupt:
            log("Model download was interrupted; automatically retrying...")
            time.sleep(2)
            continue
        except Exception as exc:
            log(f"Model downloader failed: {exc}")
            continue
        if completed.returncode == 0 and part.exists() and part.stat().st_size > 1_000_000:
            part.replace(MODEL_PATH)
            log(f"MediaPipe model ready: {MODEL_PATH.name} ({MODEL_PATH.stat().st_size / 1024 / 1024:.1f} MB)")
            return True
        if completed.stderr:
            log(completed.stderr[-500:])
        time.sleep(2 * attempt)
    print("[PosePerfect] Could not download the MediaPipe model. Rerun setup to resume.")
    return False


def main() -> int:
    print("=" * 60)
    print("PosePerfect AI — Python Windows bootstrap v10")
    print("=" * 60)
    log(f"Python: {sys.version.split()[0]}")
    log(f"Root: {ROOT}")
    log("PowerShell is not used by the installer.")
    log("Child install/download interruptions are automatically retried.")

    if not VENV_PYTHON.exists():
        print(f"[PosePerfect] Missing virtual environment: {VENV_PYTHON}")
        return 1

    for index, (name, packages, imports) in enumerate(GROUPS, start=1):
        log(f"Stage {index}/{len(GROUPS)} — {name}")
        if not pip_install(packages):
            print(f"[PosePerfect] Stage {index} failed after automatic retries.")
            return 1
        if not validate_imports(imports, name):
            print(f"[PosePerfect] Stage {index} validation failed.")
            return 1

    if not validate_imports(FULL_IMPORT_CHECKS, "Full backend"):
        return 1
    if not pip_check():
        return 1
    if not download_model():
        return 1

    log("All backend setup checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
