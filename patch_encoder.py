"""
Encode files into patch PNG images.
Creates PNG images with embedded file data and metadata.
"""

from pathlib import Path
from PIL import Image
import io
import argparse
import base64
import json
import zipfile


def _encode_metadata_blob(metadata: dict) -> str:
    """Encode JSON metadata as URL-safe base64 without padding."""
    raw = json.dumps(metadata, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _normalize_folder_path(folder_path: str) -> str:
    cleaned = str(folder_path or "").replace("\\", "/").strip()
    if not cleaned.startswith("/"):
        cleaned = "/" + cleaned
    return cleaned


def encode_file_to_patch(file_data: bytes, filename: str, folder_path: str, metadata: dict | None = None) -> bytes:
    """
    Encode a file into a patch PNG image.
    
    Args:
        file_data: Raw file bytes
        filename: Target filename
        folder_path: Target folder path (e.g., /Audio)
    
    Returns:
        PNG image bytes
    """
    folder_path = _normalize_folder_path(folder_path)
    meta = dict(metadata or {})
    # Preserve binary payload integrity on decode (especially zip bundles).
    meta.setdefault("data_size", len(file_data))

    header_str = f"n_{filename}-p_{folder_path}-meta_{_encode_metadata_blob(meta)}"
    header_bytes = header_str.encode('utf-8')
    
    # Combine: header + null byte + file data
    patch_data = header_bytes + b'\x00' + file_data
    
    # Calculate image dimensions
    # Each pixel = 3 bytes (RGB), so pixels needed = ceil(len(patch_data) / 3)
    pixel_count = (len(patch_data) + 2) // 3  # ceiling division
    width = max(1, int(pixel_count ** 0.5))  # sqrt
    height = (pixel_count + width - 1) // width  # ceiling division
    
    print(f"[PATCH_ENCODER] Encoding: filename={filename}, folder={folder_path}")
    print(f"[PATCH_ENCODER] Metadata: {meta}")
    print(f"[PATCH_ENCODER] Header: {len(header_bytes)} bytes, File: {len(file_data)} bytes, Total: {len(patch_data)} bytes")
    print(f"[PATCH_ENCODER] Image dimensions: {width}x{height}")
    
    # Create image data (RGBA)
    image_data = bytearray()
    byte_index = 0
    
    for _ in range(width * height):
        # RGB channels
        r = patch_data[byte_index] if byte_index < len(patch_data) else 0
        byte_index += 1
        g = patch_data[byte_index] if byte_index < len(patch_data) else 0
        byte_index += 1
        b = patch_data[byte_index] if byte_index < len(patch_data) else 0
        byte_index += 1
        a = 255  # Alpha (always opaque)
        
        image_data.extend([r, g, b, a])
    
    # Create PIL image and save as PNG
    img = Image.frombytes('RGBA', (width, height), bytes(image_data))
    
    # Save to bytes buffer with no compression to preserve pixel data
    output = io.BytesIO()
    img.save(output, format='PNG', compress_level=0)
    output.seek(0)
    
    print(f"[PATCH_ENCODER] PNG created: {len(output.getvalue())} bytes")
    return output.getvalue()


def encode_file_from_path(file_path: str, output_path: str, folder_path: str, metadata: dict | None = None) -> str:
    """
    Encode a file to a patch PNG image.
    
    Args:
        file_path: Path to file to encode
        output_path: Path to save patch PNG
        folder_path: Target folder path (e.g., /Audio)
    
    Returns:
        Path to created patch file
    """
    file_path_obj = Path(file_path)
    if not file_path_obj.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    
    # Read file
    with open(file_path_obj, 'rb') as f:
        file_data = f.read()
    
    # Encode to patch
    patch_png = encode_file_to_patch(file_data, file_path_obj.name, folder_path, metadata=metadata)
    
    # Write patch image
    with open(output_path, 'wb') as f:
        f.write(patch_png)
    
    print(f"✓ Created patch: {output_path}")
    return output_path


def _zip_folder_to_bytes(folder_path: Path) -> bytes:
    """Create a zip archive (in memory) from folder contents."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        root_parent = folder_path.parent
        for p in sorted(folder_path.rglob("*")):
            if p.is_dir():
                continue
            arcname = p.relative_to(root_parent).as_posix()
            zf.write(p, arcname=arcname)
    return buf.getvalue()


def encode_addon_folder_to_patch(addon_folder_path: str, output_path: str, addon_name: str | None = None) -> str:
    """
    Condense an addon folder into a single addon-bundle patch PNG.

    The payload is a zip archive, and metadata marks the patch as an addon bundle
    so the bot can replace/reload the addon safely.
    """
    addon_path = Path(addon_folder_path)
    if not addon_path.exists() or not addon_path.is_dir():
        raise FileNotFoundError(f"Addon folder not found: {addon_folder_path}")

    inferred_name = addon_name or addon_path.name
    if inferred_name.endswith(".addon"):
        inferred_name = inferred_name[:-6]
    inferred_name = inferred_name.strip()
    if not inferred_name:
        raise ValueError("Could not infer addon name")

    zip_bytes = _zip_folder_to_bytes(addon_path)
    metadata = {
        "mode": "addon_bundle",
        "addon_name": inferred_name,
        "archive": "zip",
    }

    # Filename is informational in addon_bundle mode; bot uses metadata.addon_name.
    bundle_filename = f"{inferred_name}.addon.zip"
    patch_png = encode_file_to_patch(zip_bytes, bundle_filename, "/addons", metadata=metadata)

    with open(output_path, "wb") as f:
        f.write(patch_png)

    print(f"✓ Created addon bundle patch: {output_path}")
    return output_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Encode files/folders into patch PNG images")
    mode_group = parser.add_mutually_exclusive_group(required=True)
    mode_group.add_argument("--file", help="Path to a single file to encode")
    mode_group.add_argument("--addon-folder", help="Path to an addon folder to encode as addon bundle")

    parser.add_argument("--folder", help="Target folder for single-file mode (e.g. /addons/game_modes.addon)")
    parser.add_argument("--output", help="Output patch image path")
    parser.add_argument("--addon-name", help="Override addon name for addon bundle mode")

    args = parser.parse_args()

    if args.file:
        if not args.folder:
            raise SystemExit("--folder is required with --file")
        src = Path(args.file)
        out = args.output or (src.stem + ".patch.png")
        encode_file_from_path(str(src), str(out), args.folder)
    else:
        addon_src = Path(args.addon_folder)
        out = args.output or (addon_src.name + ".bundle.patch.png")
        encode_addon_folder_to_patch(str(addon_src), str(out), addon_name=args.addon_name)
