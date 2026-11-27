#!/usr/bin/env python3
"""Оформленные снимки для страницы в магазине: экран игры в золотой рамке, герой и заголовок.

  python3 -I tools/store/promo_shots.py SHOTS OUT [lang ...]

SHOTS — папка со снимками из ветки ci-screens (store/<lang>_<экран>.jpg, 1290×2580),
OUT — куда класть результат (OUT/<lang>/NN_<экран>.jpg, 1440×2560, ровно 9:16).
"""
import os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
FONTS = os.path.join(ROOT, 'unity', 'Assets', 'Fitil', 'Resources', 'Fonts')
W, H = 1440, 2560

# экран, фон, герой, сторона героя, заголовок и подпись по языкам
SHOTS = [
    ('11_fight', 'bg_stage1_town_mid', 'lamp', 'r', {
        'en': ('Outplay the Night', 'Enemies show their plans. Answer with cards'),
        'ru': ('Перехитри ночь', 'Враг показывает замысел. Ответь картами'),
        'uk': ('Перехитруй ніч', 'Ворог показує задум. Відповідай картами')}),
    ('01_heroes', 'bg_stage1_town_sunset', 'guard', 'l', {
        'en': ('Eight Heroes', 'Each with their own cards and story'),
        'ru': ('Восемь героев', 'У каждого свои карты и своя история'),
        'uk': ('Вісім героїв', 'У кожного свої карти і своя історія')}),
    ('10_map', 'bg_stage2_outskirts_start', 'courier', 'r', {
        'en': ('Choose Your Road', 'Battles, meetings and shops at every fork'),
        'ru': ('Выбери дорогу', 'Бои, встречи и лавки на каждой развилке'),
        'uk': ('Обери дорогу', 'Бої, зустрічі та крамниці на кожній розвилці')}),
    ('20_boss_fight', 'bg_stage2_outskirts_night', 'stoker', 'l', {
        'en': ('Face the Bosses', 'The masters of the night are waiting'),
        'ru': ('Одолей боссов', 'Хозяева ночи уже ждут'),
        'uk': ('Здолай босів', 'Господарі ночі вже чекають')}),
    ('19_reward', 'bg_stage1_town_day', 'baker', 'r', {
        'en': ('Build Your Deck', '113 cards and 71 talismans'),
        'ru': ('Собери колоду', '113 карт и 71 талисман'),
        'uk': ('Збери колоду', '113 карт і 71 талісман')}),
    ('15_event', 'bg_final_house', 'herbalist', 'l', {
        'en': ('Every Choice Counts', 'Each hero meets the road in their own way'),
        'ru': ('Каждый выбор важен', 'Каждый герой проходит путь по-своему'),
        'uk': ('Кожен вибір важить', 'Кожен герой проходить шлях по-своєму')}),
    ('16_shop', 'bg_stage2_outskirts_mid', 'grinder', 'r', {
        'en': ('Trade and Upgrade', 'Buy cards, sharpen them, drop the weak ones'),
        'ru': ('Торгуйся и улучшай', 'Покупай карты, точи их, убирай слабые'),
        'uk': ('Торгуй і покращуй', 'Купуй карти, гостри їх, прибирай слабкі')}),
    ('00_title', 'bg_title', 'shepherd', 'l', {
        'en': ('A Postal Fairy Tale', 'Deliver the last letter before the light goes out'),
        'ru': ('Почтовая сказка', 'Донеси последнее письмо, пока не погас свет'),
        'uk': ('Поштова казка', 'Донеси останній лист, доки не згасло світло')}),
]

GOLD, GOLD_DARK, CREAM, INK = (214, 170, 82), (92, 62, 22), (255, 240, 205), (14, 12, 28)


def fit(draw, text, path, size, width):
    while size > 40:
        f = ImageFont.truetype(path, size)
        if draw.textlength(text, font=f) <= width:
            return f
        size -= 4
    return ImageFont.truetype(path, size)


def build(shots_dir, out_dir, lang):
    os.makedirs(os.path.join(out_dir, lang), exist_ok=True)
    for n, (screen, bgname, hero, side, text) in enumerate(SHOTS, 1):
        src = Image.open(os.path.join(shots_dir, '%s_%s.jpg' % (lang, screen))).convert('RGB')
        x = (src.width - 1200) // 2
        shot = src.crop((x, 0, x + 1200, src.height))
        sw = 930
        sh = round(shot.height * sw / shot.width)
        shot = shot.resize((sw, sh), Image.LANCZOS)

        bg = Image.open(os.path.join(ROOT, 'assets', 'bg', bgname + '.webp')).convert('RGB')
        bg = bg.resize((W, round(bg.height * W / bg.width)), Image.LANCZOS).crop((0, 0, W, H))
        bg = ImageEnhance.Brightness(bg.filter(ImageFilter.GaussianBlur(14))).enhance(0.42)
        # низ темнее: там заголовок
        grad = Image.new('L', (1, H), 0)
        for y in range(H):
            grad.putpixel((0, y), int(255 * min(1, max(0, (y - 1500) / 800))))
        bg = Image.composite(Image.new('RGB', (W, H), INK), bg, grad.resize((W, H)))
        out = bg.convert('RGBA')

        left, top, b, r = (W - sw) // 2, 70, 12, 44
        # тень и рамка
        shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle((left - b, top - b + 18, left + sw + b, top + sh + b + 18), r + b, fill=(0, 0, 0, 190))
        out = Image.alpha_composite(out, shadow.filter(ImageFilter.GaussianBlur(26)))
        d = ImageDraw.Draw(out)
        d.rounded_rectangle((left - b - 4, top - b - 4, left + sw + b + 4, top + sh + b + 4), r + b + 4, fill=GOLD_DARK)
        d.rounded_rectangle((left - b, top - b, left + sw + b, top + sh + b), r + b, fill=GOLD)
        d.rounded_rectangle((left - 3, top - 3, left + sw + 3, top + sh + 3), r + 3, fill=GOLD_DARK)
        mask = Image.new('L', (sw, sh), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, sw - 1, sh - 1), r, fill=255)
        out.paste(shot, (left, top), mask)

        # герой у нижнего угла рамки
        h = Image.open(os.path.join(ROOT, 'assets', 'h', hero + '.webp')).convert('RGBA')
        hh = 760
        h = h.resize((round(h.width * hh / h.height), hh), Image.LANCZOS)
        hx = W - h.width + 40 if side == 'r' else -40
        hy = top + sh + 70 - hh
        hs = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        blk = Image.new('RGBA', h.size, (0, 0, 0, 255)); blk.putalpha(h.split()[3].point(lambda p: int(p * 0.75)))
        hs.paste(blk, (hx + (-14 if side == 'r' else 14), hy + 16), blk)
        out = Image.alpha_composite(out, hs.filter(ImageFilter.GaussianBlur(16)))
        out.paste(h, (hx, hy), h)

        # заголовок и подпись
        d = ImageDraw.Draw(out)
        title, sub = text[lang]
        cy = top + sh + 70
        tf = fit(d, title, os.path.join(FONTS, 'Kurale.ttf'), 168, W - 150)
        ty = cy + (H - cy) * 0.36
        d.text((W / 2, ty), title, font=tf, fill=CREAM, anchor='mm', stroke_width=10, stroke_fill=GOLD_DARK)
        d.text((W / 2, ty), title, font=tf, fill=CREAM, anchor='mm', stroke_width=3, stroke_fill=INK)
        sf = fit(d, sub, os.path.join(FONTS, 'Neucha.ttf'), 70, W - 330)
        sy = cy + (H - cy) * 0.74
        d.text((W / 2, sy), sub, font=sf, fill=(240, 214, 160), anchor='mm', stroke_width=3, stroke_fill=INK)
        tw = d.textlength(sub, font=sf)
        for sgn in (-1, 1):
            ox = W / 2 + sgn * (tw / 2 + 46)
            d.line((ox, sy, ox + sgn * 70, sy), fill=GOLD, width=5)
            d.ellipse((ox + sgn * 70 - 9, sy - 9, ox + sgn * 70 + 9, sy + 9), fill=GOLD)
        out.convert('RGB').save(os.path.join(out_dir, lang, '%02d_%s.jpg' % (n, screen.split('_', 1)[1])), quality=92)


if __name__ == '__main__':
    for lang in sys.argv[3:] or ['en', 'ru', 'uk']:
        build(sys.argv[1], sys.argv[2], lang)
