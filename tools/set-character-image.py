#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
set-character-image.py —— 把一张新角色图装进 assets/gptniang1.png

用法：
    python tools/set-character-image.py <新图路径>
    python tools/set-character-image.py               # 只体检当前图，不改任何文件

它做四件事（顺序固定）：
  1. 读入任意 Pillow 支持的格式（PNG / JPEG / WebP …）；
  2. 把它变成 **610×610 RGBA** —— 上游 setupHitTest 的命中画布就是这个尺寸：
        · 原图已是 610×610        → 像素原样搬运，不重采样（画面零损失）
        · 原图是别的正方尺寸       → LANCZOS 缩放
        · 原图不是 1:1            → 先按短边居中裁成正方形，再缩放到 610×610（不拉伸）
  3. **剥离全部元数据** —— 不写 exif / pnginfo，并要求输出块只有
     IHDR / sRGB / gAMA / pHYs / IDAT / IEND（无 tEXt / zTXt / iTXt / eXIf / caBX）；
  4. 覆盖前把旧图备份成 assets/gptniang1.png.bak-<时间戳>。

这一步是纯像素搬运 / 重采样，不碰任何代码；装完直接生效（产物读的是这个文件名）。
"""

import os
import shutil
import struct
import sys
import time

# Windows 控制台默认是 GBK，会既把中文打成乱码、又在 ✓/✗ 上抛 UnicodeEncodeError。
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from PIL import Image

TARGET_SIZE = 610
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(ROOT, 'assets', 'gptniang1.png')

# 允许出现在随包 PNG 里的块（其余一律视为脏数据）
ALLOWED = {'IHDR', 'sRGB', 'gAMA', 'pHYs', 'IDAT', 'IEND'}
FORBIDDEN = {'tEXt', 'zTXt', 'iTXt', 'eXIf', 'caBX'}


def png_chunks(path):
    """返回 PNG 的块名列表（含重复）。非 PNG 抛 ValueError。"""
    d = open(path, 'rb').read()
    if d[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('不是 PNG（缺 8 字节签名）')
    i, out = 8, []
    while i + 12 <= len(d):
        n = struct.unpack('>I', d[i:i + 4])[0]
        t = d[i + 4:i + 8].decode('latin1')
        out.append(t)
        i += 12 + n
        if t == 'IEND':
            break
    return out


def audit(path, label):
    """体检一张随包图：尺寸 / 模式 / 块清单。"""
    if not os.path.exists(path):
        print(f'  {label}: 不存在 —— {path}')
        return None
    im = Image.open(path)
    im.load()
    chunks = png_chunks(path)
    uniq = sorted(set(chunks))
    bad = [c for c in uniq if c in FORBIDDEN]
    extra = [c for c in uniq if c not in ALLOWED]
    print(f'  {label}: {im.size[0]}×{im.size[1]} {im.mode}, {os.path.getsize(path)} 字节')
    print(f'    块: {",".join(uniq)}')
    if bad:
        print(f'    ✗ 含禁止块: {",".join(bad)}')
    if extra:
        print(f'    ⚠ 非预期块: {",".join(extra)}')
    if not bad and not extra:
        print('    ✓ 干净')
    return im


def install(src):
    im = Image.open(src)
    im.load()
    print(f'源图: {src}')
    print(f'  {im.size[0]}×{im.size[1]} {im.mode}')

    # —— ① 变成 610×610 RGBA ——
    if im.size != (TARGET_SIZE, TARGET_SIZE):
        w, h = im.size
        side = min(w, h)
        if (w, h) != (side, side):
            left, top = (w - side) // 2, (h - side) // 2
            im = im.crop((left, top, left + side, top + side))
            print(f'  居中裁切 → {side}×{side}（去掉左右/上下多余部分，不拉伸）')
        im = im.resize((TARGET_SIZE, TARGET_SIZE), Image.LANCZOS)
        print(f'  LANCZOS 缩放 → {TARGET_SIZE}×{TARGET_SIZE}')
    else:
        print('  尺寸已达标，像素原样搬运（不重采样）')

    im = im.convert('RGBA')
    big = Image.new('RGBA', (TARGET_SIZE, TARGET_SIZE), (0, 0, 0, 0))
    big.paste(im, (0, 0))

    # —— ② 备份旧图 ——
    if os.path.exists(TARGET):
        bak = TARGET + '.bak-' + time.strftime('%Y%m%d-%H%M%S')
        shutil.copy2(TARGET, bak)
        print(f'  旧图已备份 → {os.path.basename(bak)}')

    # —— ③ 写盘：**不传 exif / pnginfo**，即不写入任何文本或 EXIF 块 ——
    os.makedirs(os.path.dirname(TARGET), exist_ok=True)
    big.save(TARGET, format='PNG', optimize=True)

    # —— ④ 复检 ——
    print('装好了，复检：')
    audit(TARGET, 'assets/gptniang1.png')


def main():
    if len(sys.argv) < 2:
        print('未给新图路径 —— 只体检当前角色图（不改任何文件）。')
        print(f'目标: {TARGET}')
        audit(TARGET, 'assets/gptniang1.png')
        print()
        print('要装新图: python tools/set-character-image.py <新图路径>')
        return 0
    src = sys.argv[1]
    if not os.path.exists(src):
        print(f'✗ 找不到源图: {src}')
        return 1
    install(src)
    return 0


if __name__ == '__main__':
    sys.exit(main())