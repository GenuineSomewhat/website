"""
Encode files into patch PNG images.
Creates PNG images with embedded file data and metadata.
"""

from pathlib import Path
from PIL import Image
import io


def encode_file_to_patch(file_data: bytes, filename: str, folder_path: str) -> bytes:
    """
    Encode a file into a patch PNG image.
    
    Args:
        file_data: Raw file bytes
        filename: Target filename
        folder_path: Target folder path (e.g., /Audio)
    
    Returns:
        PNG image bytes
    """
    # Create header: n_<filename>-p_<folder_path>
    header_str = f"n_{filename}-p_{folder_path}"
    header_bytes = header_str.encode('utf-8')
    
    # Combine: header + null byte + file data
    patch_data = header_bytes + b'\x00' + file_data
    
    # Calculate image dimensions
    # Each pixel = 3 bytes (RGB), so pixels needed = ceil(len(patch_data) / 3)
    pixel_count = (len(patch_data) + 2) // 3  # ceiling division
    width = max(1, int(pixel_count ** 0.5))  # sqrt
    height = (pixel_count + width - 1) // width  # ceiling division
    
    print(f"[PATCH_ENCODER] Encoding: filename={filename}, folder={folder_path}")
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


def encode_file_from_path(file_path: str, output_path: str, folder_path: str) -> str:
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
    patch_png = encode_file_to_patch(file_data, file_path_obj.name, folder_path)
    
    # Write patch image
    with open(output_path, 'wb') as f:
        f.write(patch_png)
    
    print(f"✓ Created patch: {output_path}")
    return output_path


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python patch_encoder.py <file> <folder_path> [output.png]")
        print("Example: python patch_encoder.py helper.py /lib")
        print("Example: python patch_encoder.py song.mp3 /Audio my_patch.png")
        sys.exit(1)
    
    file_path = sys.argv[1]
    folder_path = sys.argv[2]
    output_path = sys.argv[3] if len(sys.argv) > 3 else Path(file_path).stem + ".patch.png"
    
    encode_file_from_path(file_path, output_path, folder_path)
