# -*- coding: utf-8 -*-
"""生成小程序视觉素材：首页/预约页/我的页 背景图 + 「我的」页功能图标。

说明：小程序 WXSS 的 background-image 不能引用本地文件（只能网络图或 base64），
所以背景统一用 <image> 绝对定位铺底，这里只负责产出图片文件。

重新生成：
  <venv python> tools/gen_assets.py
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG = os.path.join(ROOT, 'assets', 'bg')
IC = os.path.join(ROOT, 'assets', 'icons')
os.makedirs(BG, exist_ok=True)
os.makedirs(IC, exist_ok=True)

SS = 4  # 背景先在小画布上算（快），再放大，天然平滑


# ---------- 基础工具 ----------
def lerp(c1, c2, t):
    return tuple(int(round(c1[i] + (c2[i] - c1[i]) * t)) for i in range(3))


def ramp(colors, t):
    """colors: [(stop, (r,g,b)), ...] 多段渐变"""
    t = max(0.0, min(1.0, t))
    for i in range(len(colors) - 1):
        s0, c0 = colors[i]
        s1, c1 = colors[i + 1]
        if s0 <= t <= s1:
            return lerp(c0, c1, (t - s0) / (s1 - s0 or 1))
    return colors[-1][1]


def gradient(size, stops, diag=True):
    """线性渐变底图（小画布上生成后放大）"""
    w, h = size
    img = Image.new('RGB', (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = (x / (w - 1) + y / (h - 1)) / 2 if diag else y / (h - 1)
            px[x, y] = ramp(stops, t)
    return img


def glow(size, center, radius, color, peak=1.0, power=2.0):
    """径向光斑（RGBA）"""
    w, h = size
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = img.load()
    cx, cy = center
    for y in range(h):
        for x in range(w):
            d = math.hypot(x - cx, y - cy) / radius
            a = max(0.0, 1.0 - d) ** power
            px[x, y] = (color[0], color[1], color[2], int(255 * peak * a))
    return img


def streaks(size, polys, alpha=26, blur=26):
    """斜向光带：画多边形后高斯模糊，得到柔和的光感"""
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for p in polys:
        d.polygon(p, fill=(255, 255, 255, alpha))
    return layer.filter(ImageFilter.GaussianBlur(blur))


def dot_grid(size, step=28, r=2, alpha=16):
    """点阵纹理，增加科技感"""
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    w, h = size
    for y in range(0, h, step):
        for x in range(0, w, step):
            d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, alpha))
    return layer


def fade_bottom(size, strength=0.55, start=0.45):
    """底部压暗，保证白色文字可读"""
    w, h = size
    small = Image.new('RGBA', (8, 64), (0, 0, 0, 0))
    px = small.load()
    for y in range(64):
        t = y / 63
        a = 0.0 if t < start else (t - start) / (1 - start)
        v = int(255 * strength * a)
        for x in range(8):
            px[x, y] = (0, 0, 0, v)
    return small.resize((w, h), Image.BILINEAR)


def save_jpeg(img, path, quality=82):
    img.convert('RGB').save(path, 'JPEG', quality=quality, optimize=True)
    print('%-34s %6.1f KB' % (os.path.relpath(path, ROOT), os.path.getsize(path) / 1024))


# ---------- 背景 1：首页首屏（深色科技风） ----------
def bg_home():
    W, H = 750, 520
    s = (W // SS, H // SS)
    base = gradient(s, [(0.0, (14, 20, 32)), (0.55, (27, 38, 58)), (1.0, (45, 56, 78))])
    img = base.resize((W, H), Image.BICUBIC).convert('RGBA')

    g1 = glow(s, (s[0] * 0.74, s[1] * 0.10), s[0] * 0.78, (37, 99, 235), peak=0.62)
    img.alpha_composite(g1.resize((W, H), Image.BICUBIC))
    g2 = glow(s, (s[0] * 0.08, s[1] * 0.92), s[0] * 0.62, (224, 32, 32), peak=0.34)
    img.alpha_composite(g2.resize((W, H), Image.BICUBIC))
    g3 = glow(s, (s[0] * 0.95, s[1] * 0.85), s[0] * 0.45, (96, 165, 250), peak=0.30)
    img.alpha_composite(g3.resize((W, H), Image.BICUBIC))

    img.alpha_composite(
        streaks((W, H), [
            [(120, -60), (240, -60), (560, 580), (440, 580)],
            [(300, -60), (344, -60), (664, 580), (620, 580)],
        ], alpha=20, blur=30)
    )
    img.alpha_composite(dot_grid((W, H), step=30, r=2, alpha=14))
    img.alpha_composite(fade_bottom((W, H), strength=0.42, start=0.5))
    return img


# ---------- 背景 2：免费预约页（品牌蓝） ----------
def bg_lead():
    W, H = 750, 520
    s = (W // SS, H // SS)
    base = gradient(s, [(0.0, (34, 70, 199)), (0.5, (37, 99, 235)), (1.0, (18, 50, 138))])
    img = base.resize((W, H), Image.BICUBIC).convert('RGBA')

    g1 = glow(s, (s[0] * 0.18, s[1] * 0.14), s[0] * 0.70, (147, 197, 253), peak=0.42)
    img.alpha_composite(g1.resize((W, H), Image.BICUBIC))
    g2 = glow(s, (s[0] * 0.88, s[1] * 0.30), s[0] * 0.55, (59, 130, 246), peak=0.55)
    img.alpha_composite(g2.resize((W, H), Image.BICUBIC))
    g3 = glow(s, (s[0] * 0.55, s[1] * 1.0), s[0] * 0.65, (12, 30, 92), peak=0.55)
    img.alpha_composite(g3.resize((W, H), Image.BICUBIC))

    img.alpha_composite(
        streaks((W, H), [
            [(-40, 120), (-40, 200), (790, 470), (790, 390)],
            [(-40, 260), (-40, 300), (790, 560), (790, 520)],
        ], alpha=24, blur=34)
    )
    img.alpha_composite(dot_grid((W, H), step=26, r=2, alpha=18))
    img.alpha_composite(fade_bottom((W, H), strength=0.30, start=0.55))
    return img


# ---------- 背景 3：我的页头部（蓝紫） ----------
def bg_mine():
    W, H = 750, 440
    s = (W // SS, H // SS)
    base = gradient(s, [(0.0, (30, 58, 138)), (0.55, (37, 99, 235)), (1.0, (76, 46, 152))])
    img = base.resize((W, H), Image.BICUBIC).convert('RGBA')

    g1 = glow(s, (s[0] * 0.10, s[1] * 0.05), s[0] * 0.62, (191, 219, 254), peak=0.40)
    img.alpha_composite(g1.resize((W, H), Image.BICUBIC))
    g2 = glow(s, (s[0] * 0.92, s[1] * 0.55), s[0] * 0.60, (139, 92, 246), peak=0.50)
    img.alpha_composite(g2.resize((W, H), Image.BICUBIC))

    # 两道弧形装饰
    arc = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(arc)
    d.arc([-160, 60, 520, 700], start=200, end=340, fill=(255, 255, 255, 30), width=18)
    d.arc([120, -80, 900, 620], start=200, end=340, fill=(255, 255, 255, 20), width=10)
    img.alpha_composite(arc.filter(ImageFilter.GaussianBlur(6)))

    img.alpha_composite(dot_grid((W, H), step=30, r=2, alpha=16))
    img.alpha_composite(fade_bottom((W, H), strength=0.35, start=0.5))
    return img


# ---------- 「我的」页功能图标（白色线性，96px） ----------
ICON = 96
IC_SS = 4
W_ = 20


def _ico(fn, name):
    c = ICON * IC_SS
    img = Image.new('RGBA', (c, c), (0, 0, 0, 0))
    fn(ImageDraw.Draw(img), (255, 255, 255, 255))
    img = img.resize((ICON, ICON), Image.LANCZOS)
    p = os.path.join(IC, 'ic_%s.png' % name)
    img.save(p, 'PNG', optimize=True)
    print('%-34s %6.1f KB' % (os.path.relpath(p, ROOT), os.path.getsize(p) / 1024))


def ic_project(d, col):
    d.line([(128, 116), (128, 84), (256, 84), (256, 116)], fill=col, width=W_, joint='curve')
    d.rounded_rectangle([56, 116, 328, 300], radius=18, outline=col, width=W_)
    d.line([(192, 154), (192, 262)], fill=col, width=W_)


def ic_order(d, col):
    d.rounded_rectangle([56, 68, 328, 328], radius=28, outline=col, width=W_)
    d.rounded_rectangle([136, 40, 248, 100], radius=20, outline=col, width=W_)
    for y in (168, 224, 280):
        d.line([(110, y), (274, y)], fill=col, width=W_ - 2)


def ic_contract(d, col):
    d.polygon([(72, 52), (232, 52), (312, 132), (312, 336), (72, 336)], outline=col, width=W_)
    d.line([(232, 52), (232, 132), (312, 132)], fill=col, width=W_, joint='curve')
    for y in (192, 242, 292):
        d.line([(120, y), (262, y)], fill=col, width=W_ - 2)


def ic_ai(d, col):
    d.polygon([(176, 36), (206, 138), (300, 168), (206, 198), (176, 300), (146, 198), (52, 168), (146, 138)],
              fill=col)
    d.polygon([(300, 236), (322, 288), (374, 310), (322, 332), (300, 384), (278, 332), (226, 310), (278, 288)],
              fill=col)


def ic_realname(d, col):
    d.polygon([(192, 44), (312, 92), (312, 188), (192, 344), (72, 188), (72, 92)], outline=col, width=W_)
    d.line([(146, 190), (182, 228), (252, 152)], fill=col, width=W_, joint='curve')


def ic_service(d, col):
    d.rounded_rectangle([48, 92, 336, 268], radius=26, outline=col, width=W_)
    d.polygon([(48, 236), (128, 168), (336, 300), (48, 300)], fill=col)


def ic_consult(d, col):
    """客服：对话气泡 + 三个点"""
    d.rounded_rectangle([44, 72, 340, 268], radius=32, outline=col, width=W_)
    d.polygon([(112, 250), (112, 330), (196, 258)], fill=col)
    for cx in (128, 192, 256):
        d.ellipse([cx - 12, 146, cx + 12, 170], fill=col)


def ic_package(d, col):
    """服务套餐：立体箱子"""
    d.polygon([(192, 40), (332, 92), (332, 204), (192, 256), (52, 204), (52, 92)], outline=col, width=W_)
    d.line([(52, 92), (192, 148), (332, 92)], fill=col, width=W_, joint='curve')
    d.line([(192, 148), (192, 344)], fill=col, width=W_)


def ic_case(d, col):
    """成功案例：奖杯/案例文件夹"""
    # 奖杯杯身
    d.rounded_rectangle([112, 72, 272, 200], radius=20, outline=col, width=W_)
    # 两个耳朵
    d.arc([72, 72, 152, 152], start=90, end=270, fill=col, width=W_)
    d.arc([232, 72, 312, 152], start=270, end=90, fill=col, width=W_)
    # 底座
    d.rounded_rectangle([136, 200, 248, 240], radius=8, outline=col, width=W_)
    d.rounded_rectangle([104, 240, 280, 276], radius=10, outline=col, width=W_)
    # 杯内对勾
    d.line([(150, 138), (182, 172), (236, 118)], fill=col, width=W_, joint='curve')


if __name__ == '__main__':
    print('== 背景图 ==')
    save_jpeg(bg_home(), os.path.join(BG, 'hero_home.jpg'))
    save_jpeg(bg_lead(), os.path.join(BG, 'hero_lead.jpg'))
    save_jpeg(bg_mine(), os.path.join(BG, 'mine_header.jpg'))
    print('== 图标 ==')
    _ico(ic_project, 'project')
    _ico(ic_order, 'order')
    _ico(ic_contract, 'contract')
    _ico(ic_ai, 'ai')
    _ico(ic_realname, 'realname')
    _ico(ic_service, 'service')
    _ico(ic_consult, 'consult')
    _ico(ic_package, 'package')
    _ico(ic_case, 'case')
