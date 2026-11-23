"""Archive transportable à liste d'inclusion explicite, sans runtime ni secrets."""

import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parents[1]
TOP_LEVEL = ["app.py", "README.md", "ROADMAP.md", "pyproject.toml", ".gitignore",
             "requirements.txt", "requirements.lock", "requirements-graph.txt", "requirements-graph-cpu.lock", "requirements-test.txt"]
TOP_LEVEL.append("requirements-voice.txt")
DIRECTORIES = ["nukun", "tests", "docs", "configs", "artifacts", "reports", "scripts", "notebooks"]


def source_paths():
    paths = [ROOT / name for name in TOP_LEVEL]
    paths.extend([ROOT / ".streamlit" / "config.toml", ROOT / ".github" / "workflows" / "checks.yml", ROOT / "data" / "README.md"])
    for directory in DIRECTORIES:
        paths.extend(path for path in (ROOT / directory).rglob("*") if path.is_file()
                     and "__pycache__" not in path.parts and path.suffix in {".py", ".md", ".json", ".csv", ".ipynb", ".png"})
    return sorted({p for p in paths if p.is_file()}, key=lambda p: p.relative_to(ROOT).as_posix())


def main():
    output = ROOT / "dist"
    output.mkdir(exist_ok=True)
    files = source_paths()
    manifest = {"schema_version": 1, "files": [
        {"path": path.relative_to(ROOT).as_posix(), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
         "bytes": path.stat().st_size} for path in files]}
    archive_path = output / "nukun-akwe-source.zip"
    with ZipFile(archive_path, "w", compression=ZIP_DEFLATED) as archive:
        for path in files:
            info = ZipInfo("nukun-akwe/" + path.relative_to(ROOT).as_posix(), date_time=(2026, 11, 22, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            archive.writestr(info, path.read_bytes())
        info = ZipInfo("nukun-akwe/SOURCE_MANIFEST.json", date_time=(2026, 11, 22, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        archive.writestr(info, json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8"))
    digest = hashlib.sha256(archive_path.read_bytes()).hexdigest()
    (output / "SHA256SUMS").write_text(f"{digest}  {archive_path.name}\n", encoding="ascii")
    print(f"Archive : {archive_path} ({len(files)} fichiers, {archive_path.stat().st_size} octets)")
    print(f"SHA-256 : {digest}")


if __name__ == "__main__":
    main()
