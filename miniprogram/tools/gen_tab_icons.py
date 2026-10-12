# -*- coding: utf-8 -*-
"""生成小程序底部 tabBar 图标（81x81 PNG，正常态灰色 / 选中态品牌蓝）。
矢量思路：在 4x 画布(324)上绘制后降采样，得到平滑抗锯齿边缘。
重新生成：python tools/gen_tab_icons.py
"""
import os
from PIL import Image, ImageDraw

SIZE = 81          # 最终尺寸
SS = 4             # 超采样倍数
C = SIZE * SS      # 324

GRAY = (154, 161, 172, 255)     # 未选中 #9AA1AC
BLUE = (37, 99, 235, 255)       # 选中   #2563EB
W = 20                          # 线宽（324 画布上）

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'tab')
os.makedirs(OUT, exist_ok=True)


def canvas():
    img = Image.new('RGBA', (C, C), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def home(d, col):
    # 屋顶
    d.line([(58, 152), (162, 68), (266, 152)], fill=col, width=W, joint='curve')
    # 屋身
    d.rounded_rectangle([86, 140, 238, 258], radius=14, outline=col, width=W)
    # 门
    d.rounded_rectangle([136, 188, 188, 258], radius=8, fill=col)


def service(d, col):
    box = [(66, 66, 150, 150), (174, 66, 258, 150), (66, 174, 150, 258), (174, 174, 258, 258)]
    for b in box:
        d.rounded_rectangle(b, radius=22, outline=col, width=W)


def case(d, col):
    d.rounded_rectangle([54, 86, 270, 238], radius=20, outline=col, width=W)
    d.ellipse([100, 118, 134, 152], fill=col)          # 太阳
    d.line([(70, 216), (132, 152), (176, 208), (206, 176), (256, 216)], fill=col, width=W, joint='curve')


def project(d, col):
    d.line([(124, 112), (124, 82), (200, 82), (200, 112)], fill=col, width=W, joint='curve')  # 提手
    d.rounded_rectangle([52, 112, 272, 246], radius=16, outline=col, width=W)                 # 包身
    d.line([(162, 146), (162, 212)], fill=col, width=W)                                        # 分隔


def mine(d, col):
    d.ellipse([118, 72, 206, 160], outline=col, width=W)                 # 头
    d.arc([56, 152, 268, 264], start=180, end=360, fill=col, width=W)    # 肩（上半弧）


ICONS = {'home': home, 'service': service, 'case': case, 'project': project, 'mine': mine}


def build(name, fn, col, suffix):
    img, d = canvas()
    fn(d, col)
    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    path = os.path.join(OUT, '%s%s.png' % (name, suffix))
    img.save(path, 'PNG', optimize=True)
    return path, os.path.getsize(path)


if __name__ == '__main__':
    print('输出目录：', OUT)
    for name, fn in ICONS.items():
        p1, s1 = build(name, fn, GRAY, '')
        p2, s2 = build(name, fn, BLUE, '_on')
        print('%-16s %5d B      %-20s %5d B' % (os.path.basename(p1), s1, os.path.basename(p2), s2))

    # 拼一张预览图，方便人工确认
    sheet = Image.new('RGBA', (SIZE * 5 + 40, SIZE * 2 + 60), (245, 247, 250, 255))
    for i, name in enumerate(ICONS):
        sheet.paste(Image.open(os.path.join(OUT, name + '.png')).convert('RGBA'), (10 + i * (SIZE + 5), 30), Image.open(os.path.join(OUT, name + '.png')))
        sheet.paste(Image.open(os.path.join(OUT, name + '_on.png')).convert('RGBA'), (10 + i * (SIZE + 5), 30 + SIZE + 10), Image.open(os.path.join(OUT, name + '_on.png')))
    sheet.save(os.path.join(OUT, '_preview.png'))
    print('预览图：', os.path.join(OUT, '_preview.png'))
