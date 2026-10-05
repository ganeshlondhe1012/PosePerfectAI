from __future__ import annotations

import shutil
import time
import urllib.error
import urllib.request
from pathlib import Path

from .config import MODEL_URLS, settings


def ensure_model() -> Path:
    model_name = settings.pose_model if settings.pose_model in MODEL_URLS else "lite"
    target = settings.model_path
    if target.exists() and target.stat().st_size > 1_000_000:
        return target

    target.parent.mkdir(parents=True, exist_ok=True)
    url = MODEL_URLS[model_name]
    tmp = target.with_suffix(".download")
    last_error: Exception | None = None

    for attempt in range(1, 4):
        try:
            print(f"[PosePerfect] Downloading MediaPipe {model_name} model (attempt {attempt}/3)...", flush=True)
            request = urllib.request.Request(url, headers={"User-Agent": "PosePerfectAI/1.0"})
            with urllib.request.urlopen(request, timeout=180) as response, tmp.open("wb") as output:
                shutil.copyfileobj(response, output, length=1024 * 1024)
            size = tmp.stat().st_size
            if size < 1_000_000:
                raise RuntimeError(f"Downloaded model is only {size} bytes and appears incomplete.")
            tmp.replace(target)
            print(f"[PosePerfect] Model ready: {target} ({size / 1024 / 1024:.1f} MB)", flush=True)
            return target
        except KeyboardInterrupt:
            raise RuntimeError("Model download was interrupted. Rerun setup_windows.bat to resume.")
        except Exception as exc:
            last_error = exc
            if tmp.exists():
                tmp.unlink(missing_ok=True)
            if attempt < 3:
                time.sleep(2 * attempt)

    raise RuntimeError(
        "Could not download the MediaPipe pose model after 3 attempts. "
        "Check internet/VPN/proxy/firewall access to storage.googleapis.com. "
        f"Details: {last_error}"
    ) from last_error
