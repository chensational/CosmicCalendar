#!/usr/bin/env python3
"""Refresh the compact near-real-time SDO/HMI photosphere quicklook."""

from __future__ import annotations

import hashlib
import io
import json
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.request import Request, urlopen

try:
    from PIL import Image
except ImportError as error:  # pragma: no cover - authoring/CI utility
    raise SystemExit("Pillow is required: python3 -m pip install Pillow") from error


SOURCE_PAGE = "https://sdo.gsfc.nasa.gov/data/"
SOURCE_ASSET = "https://sdo.gsfc.nasa.gov/assets/img/latest/latest_256_HMIIC.jpg"
OUTPUT_SIZE = 96
ROOT = Path(__file__).resolve().parents[1]
DATA_DIRECTORY = ROOT / "src" / "data"


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def iso_timestamp(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def main() -> None:
    request = Request(SOURCE_ASSET, headers={"User-Agent": "CosmicCalendar solar image updater"})
    with urlopen(request, timeout=60) as response:
        source = response.read()
        last_modified = response.headers.get("Last-Modified")
    if len(source) < 5_000 or source[:2] != b"\xff\xd8":
        raise RuntimeError(f"SDO response is not a plausible JPEG ({len(source)} bytes)")

    with Image.open(io.BytesIO(source)) as image:
        rgb = image.convert("RGB")
        luminance = rgb.convert("L")
        center_x = rgb.width // 2
        center_y = rgb.height // 2
        horizontal = [x for x in range(rgb.width) if luminance.getpixel((x, center_y)) > 36]
        vertical = [y for y in range(rgb.height) if luminance.getpixel((center_x, y)) > 36]
        if not horizontal or not vertical:
            raise RuntimeError("Could not locate the SDO solar disc")
        diameter = max(horizontal[-1] - horizontal[0] + 1, vertical[-1] - vertical[0] + 1)
        half = (diameter + 1) // 2
        cropped = rgb.crop((center_x - half, center_y - half, center_x + half, center_y + half))
        compact = cropped.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        compact.save(output, format="JPEG", quality=88, optimize=True)
        encoded = output.getvalue()

    observed_at = parsedate_to_datetime(last_modified) if last_modified else datetime.now(timezone.utc)
    fetched_at = datetime.now(timezone.utc)
    manifest = {
        "source": SOURCE_PAGE,
        "sourceAsset": SOURCE_ASSET,
        "instrument": "NASA Solar Dynamics Observatory / HMI",
        "product": "near-real-time full-disc continuum intensity quicklook",
        "observedAt": iso_timestamp(observed_at),
        "fetchedAt": iso_timestamp(fetched_at),
        "encoding": f"{OUTPUT_SIZE}×{OUTPUT_SIZE} disk crop, JPEG quality 88",
        "sourceByteLength": len(source),
        "sourceSha256": sha256(source),
        "byteLength": len(encoded),
        "sha256": sha256(encoded),
        "credit": "NASA/SDO and the HMI science team",
    }

    DATA_DIRECTORY.mkdir(parents=True, exist_ok=True)
    (DATA_DIRECTORY / "sun-hmi.jpg").write_bytes(encoded)
    (DATA_DIRECTORY / "sun-hmi.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
