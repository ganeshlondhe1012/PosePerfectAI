from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_ROOT = ROOT.parent

def test_core_files_present():
    for rel in [
        "app/main.py", "app/analyzer.py", "app/pose_rules.py",
        "app/landmarks.py", "app/config.py", "run.py",
        "../App.tsx", "../src/services/api.ts", "../src/navigation/AppNavigator.tsx",
    ]:
        assert (ROOT / rel).resolve().exists(), rel

def test_generated_build_dirs_are_ignored_by_release_rules():
    # These directories are intentionally created by npm/setup at runtime.
    # The release must exclude/ignore them rather than failing after setup.
    gitignore_root = APP_ROOT / ".gitignore"
    gitignore_backend = APP_ROOT / "backend" / ".gitignore"

    root_text = gitignore_root.read_text(encoding="utf-8") if gitignore_root.exists() else ""
    backend_text = gitignore_backend.read_text(encoding="utf-8") if gitignore_backend.exists() else ""

    assert "node_modules/" in root_text
    assert "backend/.venv/" in root_text
    assert ".venv/" in backend_text
