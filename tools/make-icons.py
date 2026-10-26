#!/usr/bin/env python3
"""Generate the extension icons with no third-party dependencies.

Draws a near-black rounded tile with the OLX teal ring, supersampled 4x for
smooth edges, then writes RGBA PNGs straight from zlib.

    python3 tools/make-icons.py
"""

import os
import struct
import zlib

SIZES = (16, 32, 48, 128)
SS = 4  # supersampling factor

BG = (11, 11, 11)        # tile
ACCENT = (35, 229, 219)  # OLX teal
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icons")


def rounded_rect_alpha(x, y, size):
    """Coverage of a rounded square with radius ~22% of the canvas."""
    r = size * 0.22
    inset = size * 0.02
    x0, y0 = inset, inset
    x1, y1 = size - inset, size - inset
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
    return 1.0 if d <= r else 0.0


def ring_alpha(x, y, size):
    """Coverage of the 'O' ring."""
    c = size / 2.0
    radius = size * 0.30
    half_stroke = size * 0.075
    d = ((x - c) ** 2 + (y - c) ** 2) ** 0.5
    return 1.0 if abs(d - radius) <= half_stroke else 0.0


def render(size):
    rows = []
    inv = 1.0 / (SS * SS)
    for py in range(size):
        row = bytearray()
        for px in range(size):
            bg_cov = 0.0
            ring_cov = 0.0
            for sy in range(SS):
                for sx in range(SS):
                    x = px + (sx + 0.5) / SS
                    y = py + (sy + 0.5) / SS
                    bg_cov += rounded_rect_alpha(x, y, size)
                    ring_cov += ring_alpha(x, y, size)
            bg_cov *= inv
            ring_cov *= inv
            if ring_cov > 0:
                r, g, b = ACCENT
            else:
                r, g, b = BG
            a = max(bg_cov, ring_cov)
            row += bytes((r, g, b, int(round(255 * a))))
        rows.append(bytes(row))
    return rows


def write_png(path, size):
    rows = render(size)
    raw = b"".join(b"\x00" + row for row in rows)

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as fh:
        fh.write(png)


def main():
    os.makedirs(OUT, exist_ok=True)
    for size in SIZES:
        path = os.path.abspath(os.path.join(OUT, f"icon-{size}.png"))
        write_png(path, size)
        print(f"wrote {path} ({os.path.getsize(path)} bytes)")


if __name__ == "__main__":
    main()
