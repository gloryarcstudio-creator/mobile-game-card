// Окна поверх экрана: настройки, пауза забега, справочник, сброс прогресса (showSettings, showPause,
// showGlossary, askReset в game.js). Панель — нарисованная рамка ui2/panel с крестиком в правом верхнем углу.
using System;
using System.Collections.Generic;
using Fitil.Core;
using Fitil.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace Fitil.Game
{
    public static class Menus
    {
        static GameObject open;   // открытое окно: новое заменяет прежнее

        static readonly Color Title = new Color32(0xFF, 0xE2, 0xA0, 0xFF);
        static readonly Color Soft = new Color32(0xC9, 0xC0, 0xD8, 0xFF);
        static readonly Color Line = new Color32(0x6C, 0x5A, 0x8C, 0xFF);

        public static void Close()
        {
            if (open) UnityEngine.Object.Destroy(open);
            open = null;
        }

        /// <summary>Новое окно во весь экран на месте прежнего (достижения, статистика, база знаний).</summary>
        public static GameObject Window(out RectTransform layer)
        {
            Close();
            open = Overlay.Open(out layer);
            return open;
        }

        /// <summary>Панель .settings: тёмная рамка ui2/panel, заголовок, крестик. Высота — по содержимому.</summary>
        static RectTransform Panel(string title, float top, Action onClose, out RectTransform layer, int padBottom = 30, float height = 0, float left = 24, float width = 352, float scale = 0.494f)
        {
            Close();
            open = Overlay.Open(out layer);
            var col = Ui.Node("panel", layer).Box(left, top, width, height > 0 ? height : 100);
            col.Column(0, TextAnchor.UpperCenter, 24, 24, 16, padBottom);
            // высота по содержимому; заданная высота — для окна с прокруткой (справочник)
            if (height <= 0) col.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            var frame = Ui.Frame(col, "ui2/panel", scale, 4 * scale, 100 * scale, 4 * scale, 20 * scale);
            if (!frame.sprite) frame.color = new Color32(0x22, 0x1C, 0x30, 0xF5);
            var t = Ui.Label("title", col, title, 26, Title, TextAnchor.MiddleCenter, true).Shadow(2f);
            t.Pref(216, 34);
            // крестик нарисован на рамке: нажатие ловится прямо на нём
            var x = Ui.Hit("close", col, () => { Sound.Sfx("click"); onClose(); });
            x.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;
            var xr = (RectTransform)x.transform;
            xr.anchorMin = xr.anchorMax = new Vector2(1, 1);
            xr.pivot = new Vector2(0.5f, 0.5f);
            xr.sizeDelta = new Vector2(44, 44);
            xr.anchoredPosition = new Vector2(-30, -30);
            if (!frame.sprite) Ui.Label("x", xr, "✕", 24, Ui.Paper).rectTransform.Fill();
            return col;
        }

        static void Sep(RectTransform col)
        {
            var box = Ui.Node("sline", col);
            box.Pref(300, 26);
            var l = Ui.Img("line", box, null, new Color(Line.r, Line.g, Line.b, 0.8f));
            l.rectTransform.anchorMin = new Vector2(0, 0.5f);
            l.rectTransform.anchorMax = new Vector2(1, 0.5f);
            l.rectTransform.sizeDelta = new Vector2(0, 2);
        }

        // ================= настройки =================
        /// <summary>Настройки. back — куда вернуться по крестику (null — просто закрыть).</summary>
        public static void ShowSettings(Action back = null)
        {
            var col = Panel(Loc.Tr("Настройки"), 162, () => { if (back != null) back(); else Close(); }, out _);

            // четыре круглых кнопки: достижения, справочник, статистика, сброс
            var icons = Ui.Node("sicons", col);
            icons.Line(0, TextAnchor.MiddleCenter);
            icons.Pref(304, 86);
            Icon(icons, "medal", Loc.Tr("Достижения"), () => Progress.ShowAchievements(() => ShowSettings(back)));
            Icon(icons, "magnifier", Loc.Tr("Справочник"), () => ShowGlossary(() => ShowSettings(back)));
            Icon(icons, "hourglass", Loc.Tr("Статистика"), () => Progress.ShowStats(() => ShowSettings(back)));
            Icon(icons, "sootbroom", Loc.Tr("Сбросить"), () => AskReset(back));
            Sep(col);

            Volume(col, "sfx", Loc.Tr("Звуки"), "horn", Sound.SfxVolume);
            Volume(col, "music", Loc.Tr("Музыка"), "musicbox", Sound.MusicVolume);
            Sep(col);

            // язык: названия языков на них самих; смена языка перезапускает экран
            var langs = new[] { ("en", "English"), ("ru", "Русский"), ("uk", "Українська") };
            // название строки сверху, три языка под ним во всю ширину: в одну строку «Українська» не помещалась
            Ui.Label("label", col, Loc.Tr("Язык"), 15, Ui.Paper, TextAnchor.MiddleLeft, true).Pref(304, 22);
            var row = Ui.Node("trow", col);
            row.Line(4, TextAnchor.MiddleLeft);
            row.Pref(304, 30);
            foreach (var (k, name) in langs)
            {
                var key = k;
                Radio(row, name, Loc.Lang == key, 99, () =>
                {
                    if (Loc.Lang == key) return;
                    Settings.Lang = key;
                    Boot.Instance.Relaunch(() => ShowSettings());
                });
            }

            Toggle(col, Loc.Tr("Вступление"), Loc.Tr("Показывать"), Loc.Tr("Пропускать"), !Settings.SkipIntro, v => Settings.SkipIntro = !v, back);
            Toggle(col, Loc.Tr("Анимации"), Loc.Tr("Обычные"), Loc.Tr("Быстрые"), !Settings.Fast, v => Settings.Fast = !v, back);
            Toggle(col, Loc.Tr("Снегопад"), Loc.Tr("Идёт"), Loc.Tr("Нет"), Settings.Snow, v => Settings.Snow = v, back);
            Toggle(col, Loc.Tr("Розыгрыш карты"), Loc.Tr("В 2 касания"), Loc.Tr("В 1 касание"), !Settings.OneTap, v => Settings.OneTap = !v, back);
            Toggle(col, Loc.Tr("Реплики врагов"), Loc.Tr("Показывать"), Loc.Tr("Скрывать"), Settings.Lines, v => Settings.Lines = v, back);
            Sep(col);
            // заставку можно пересмотреть, пока не идёт забег
            if (RunFlow.Current == null && Cinema.Has(Boot.Instance.Defs))
            {
                var link = Ui.Hit("cinema", col, () => { Sound.Sfx("click"); Close(); Boot.Instance.PlayCinema(); });
                link.Pref(304, 30);
                Link(link, Loc.Tr("Посмотреть заставку"));
            }
            // Европа: игрок вправе передумать насчёт рекламы по интересам — окно Google открывается отсюда
            if (Store.Ads != null && Store.Ads.PrivacyOptions)
            {
                var link = Ui.Hit("privacy", col, () => { Sound.Sfx("click"); Store.Ads.ShowPrivacyOptions(null); });
                link.Pref(304, 30);
                Link(link, Loc.Tr("Согласие на рекламу"));
            }
            // политика конфиденциальности студии: раздел этой игры на сайте
            {
                var link = Ui.Hit("policy", col, () => { Sound.Sfx("click"); Application.OpenURL(PolicyUrl); });
                link.Pref(304, 30);
                Link(link, Loc.Tr("Политика конфиденциальности"));
            }
            var foot = Ui.Label("sfoot", col, Loc.Tr("Версия {v}", ("v", Application.version)), 12, new Color(1, 1, 1, 0.6f), TextAnchor.MiddleLeft);
            foot.Pref(304, 18);
        }

        public const string PolicyUrl = "https://protekgames.com/privacy/#last-ray";

        // подчёркнутая ссылка шрифтом заголовков (.slink)
        static void Link(Component link, string text)
        {
            var t = Ui.Label("t", link.transform, text, 14, Ui.GoldHi, TextAnchor.MiddleCenter, true);
            t.rectTransform.Fill();
            var u = Ui.Img("u", link.transform, (Sprite)null, Ui.GoldHi);
            u.rectTransform.anchorMin = u.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
            u.rectTransform.sizeDelta = new Vector2(t.preferredWidth, 1);
            u.rectTransform.anchoredPosition = new Vector2(0, -9);
        }

        static void Icon(RectTransform parent, string art, string label, Action onClick)
        {
            var box = Ui.Node("icon", parent);
            box.Pref(76, 86);
            box.Column(1, TextAnchor.UpperCenter);
            var ring = Ui.Img("round", box, "ui2/round");
            if (!ring.sprite) { ring.sprite = Ui.Circle; ring.color = new Color32(0x3A, 0x2E, 0x48, 0xFF); }
            ring.raycastTarget = true;
            ring.Pref(56, 62);
            var pic = Ui.Img("pic", ring.transform, "r2/" + art);
            pic.preserveAspect = true;
            pic.rectTransform.Fill();
            pic.rectTransform.offsetMin = new Vector2(9, 8);
            pic.rectTransform.offsetMax = new Vector2(-9, -14);
            Ui.Label("label", box, label, 13, Ui.GoldHi).Fit(9).Pref(76, 20);
            var b = box.gameObject.AddComponent<Button>();
            b.targetGraphic = ring;
            b.onClick.AddListener(() => { Sound.Sfx("click"); onClick(); });
        }

        static void Volume(RectTransform col, string kind, string label, string art, float v)
        {
            var row = Ui.Node("srow", col);
            row.Line(8, TextAnchor.MiddleLeft);
            row.Pref(304, 44);
            var ico = Ui.Img("ico", row, "r2/" + art);
            ico.preserveAspect = true;
            ico.Pref(36, 36);
            Ui.Label("label", row, label, 17, Ui.Paper, TextAnchor.MiddleLeft, true).Pref(70, 30);
            var val = Ui.Label("val", row, "", 15, Ui.GoldHi, TextAnchor.MiddleRight, true);
            var s = Slider(row, 150);
            val.transform.SetAsLastSibling();
            val.Pref(32, 30);
            s.value = Mathf.Round(v * 20);
            val.text = Mathf.RoundToInt(s.value * 5).ToString();
            s.onValueChanged.AddListener(x =>
            {
                val.text = Mathf.RoundToInt(x * 5).ToString();
                Sound.SetVolume(kind, x / 20f);
            });
            // звук-образец, чтобы услышать громкость
            if (kind == "sfx")
            {
                var up = s.gameObject.AddComponent<PointerUp>();
                up.Up = () => Sound.Sfx("coin");
            }
        }

        static Slider Slider(RectTransform parent, float w)
        {
            var rt = Ui.Node("slider", parent);
            rt.Pref(w, 32);
            // невидимая площадка на всю строку ползунка: по ней ловится нажатие и перетаскивание
            var hit = rt.gameObject.AddComponent<Image>();
            hit.color = new Color(0, 0, 0, 0);
            var s = rt.gameObject.AddComponent<Slider>();
            var track = Ui.Round("track", rt, new Color32(0x1A, 0x15, 0x20, 0xFF));
            track.rectTransform.anchorMin = new Vector2(0, 0.5f);
            track.rectTransform.anchorMax = new Vector2(1, 0.5f);
            track.rectTransform.sizeDelta = new Vector2(0, 10);
            track.Outline(new Color32(0x8A, 0x7A, 0xA8, 0xFF), 1f);
            var area = Ui.Node("fill area", rt);
            area.anchorMin = new Vector2(0, 0.5f);
            area.anchorMax = new Vector2(1, 0.5f);
            area.sizeDelta = new Vector2(0, 10);
            var fill = Ui.Round("fill", area, Ui.Gold);
            fill.rectTransform.sizeDelta = Vector2.zero;
            var harea = Ui.Node("handle area", rt);
            harea.Fill();
            harea.offsetMin = new Vector2(10, 0);
            harea.offsetMax = new Vector2(-10, 0);
            var handle = Ui.Round("handle", harea, new Color32(0xC9, 0xCC, 0xD8, 0xFF));
            // Slider сам растягивает ручку на всю высоту строки (32): sizeDelta по высоте — добавка к ней, а не размер
            handle.rectTransform.sizeDelta = new Vector2(20, -2);
            handle.raycastTarget = true;
            handle.Outline(Ui.Ink, 1.5f);
            s.fillRect = fill.rectTransform;
            s.handleRect = handle.rectTransform;
            s.targetGraphic = handle;
            s.direction = UnityEngine.UI.Slider.Direction.LeftToRight;
            s.minValue = 0;
            s.maxValue = 20;
            s.wholeNumbers = true;
            return s;
        }

        static RectTransform Row(RectTransform col, string label)
        {
            var row = Ui.Node("trow", col);
            row.Line(6, TextAnchor.MiddleLeft);
            // длинная подпись («Розыгрыш карты») встаёт в две строки, как в веб-версии, а не мельчает
            var l = Ui.Label("label", row, label, 15, Ui.Paper, TextAnchor.MiddleLeft, true);
            var two = l.preferredWidth > 96 && label.Contains(" ");
            l.lineSpacing = 0.9f;
            l.Fit(11).Pref(96, two ? 44 : 30);
            row.Pref(304, two ? 46 : 34);
            return row;
        }

        static void Toggle(RectTransform col, string label, string a, string b, bool first, Action<bool> set, Action back)
        {
            var row = Row(col, label);
            Radio(row, a, first, 100, () => { set(true); ShowSettings(back); });
            Radio(row, b, !first, 100, () => { set(false); ShowSettings(back); });
        }

        static void Radio(RectTransform row, string text, bool on, float w, Action pick)
        {
            var box = Ui.Node("radio", row);
            box.Line(5, TextAnchor.MiddleLeft);
            box.Pref(w > 0 ? w : 66, 30);
            var ring = Ui.Img("ring", box, Ui.Circle, on ? Ui.Gold : new Color32(0x8A, 0x7A, 0xA8, 0xFF));
            ring.Pref(20, 20);
            var inner = Ui.Img("in", ring.transform, Ui.Circle, new Color32(0x1A, 0x15, 0x20, 0xFF));
            inner.rectTransform.Fill();
            inner.rectTransform.offsetMin = new Vector2(2, 2);
            inner.rectTransform.offsetMax = new Vector2(-2, -2);
            if (on)
            {
                var dot = Ui.Img("dot", inner.transform, Ui.Circle, Ui.GoldHi);
                dot.rectTransform.Fill();
                dot.rectTransform.offsetMin = new Vector2(3, 3);
                dot.rectTransform.offsetMax = new Vector2(-3, -3);
            }
            var t = Ui.Label("text", box, text, 14, on ? Ui.GoldHi : Soft, TextAnchor.MiddleLeft);
            t.Fit(9);
            t.Pref(w > 0 ? w - 25 : 41, 28);
            var hit = box.gameObject.AddComponent<Image>();
            hit.color = new Color(0, 0, 0, 0);
            var btn = box.gameObject.AddComponent<Button>();
            btn.targetGraphic = hit;
            btn.onClick.AddListener(() => { Sound.Sfx("click"); pick(); });
        }

        // ================= пауза =================
        /// <summary>Пауза во время забега: справочник, настройки и выход в главное меню.</summary>
        public static void ShowPause()
        {
            var flow = RunFlow.Current;
            if (flow == null) { ShowGlossary(); return; }
            var col = Panel(Loc.Tr("Пауза"), 230, Close, out _, 44);
            // отступы как у окна паузы в веб-версии: между подписями шире, чем между кнопками
            col.GetComponent<VerticalLayoutGroup>().spacing = 11;
            col.GetComponent<VerticalLayoutGroup>().padding.bottom = 47;
            Ui.Label("who", col, flow.Hero.Name + " · " + flow.DiffName, 14, new Color(1, 1, 1, 0.8f)).Pref(270, 30);
            Ui.Label("hint", col, Loc.Tr(flow.InFight
                ? "Прогресс сохранён до начала этого боя. Если выйти, бой начнётся заново."
                : "Прогресс сохранён. Можно выйти и вернуться позже."), 14, new Color(1, 1, 1, 0.8f)).Pref(270);
            Ui.Node("gap", col).Pref(1, 0);
            Ui.Push(col, Loc.Tr("Вернуться в игру"), Close, false, 20, 260, 52);
            Ui.Push(col, Loc.Tr("Справочник"), () => ShowGlossary(ShowPause), true, 18, 260, 48);
            Ui.Push(col, Loc.Tr("Настройки"), () => ShowSettings(ShowPause), true, 18, 260, 48);
            Ui.Push(col, Loc.Tr("Главное меню"), () =>
            {
                if (flow.FightBusy) { Hud.Toast(Loc.Tr("Дождись конца хода")); return; }
                Close();
                flow.Quit();
            }, true, 18, 260, 48);
        }

        // ================= справочник =================
        /// <summary>Справочник: ключевые слова игры и их пояснения.</summary>
        public static void ShowGlossary(Action back = null)
        {
            // то же окно в рамке, что и настройки, во всю высоту экрана; закрывается крестиком
            var col = Panel(Loc.Tr("Справочник"), 62, () => { if (back != null) back(); else Close(); }, out _, 58, 792, 9, 382, 0.53f);
            var list = ScrollList(col, 318);
            var gl = Json.Arr(Json.Get(Boot.Instance.Data.Raw, "gloss"));
            if (gl != null)
                foreach (var item in gl)
                {
                    var pair = Json.Arr(item);
                    if (pair == null || pair.Count < 2) continue;
                    Ui.Label("dt", list, Json.Str(pair[0]), 17, Ui.GoldHi, TextAnchor.LowerLeft, true).Pref(306, 31);
                    var dd = Ui.Label("dd", list, Json.Str(pair[1]), 15, Ui.Paper, TextAnchor.UpperLeft);
                    dd.LineHeight(1.2f);
                    dd.Pref(306);
                }
        }

        /// <summary>Прокручиваемый столбик во всю оставшуюся высоту: возвращает узел для строк.</summary>
        public static RectTransform ScrollList(RectTransform parent, float w)
        {
            var view = Ui.Node("scroll", parent);
            var le = view.Pref(w, 100);
            le.flexibleHeight = 1;
            view.gameObject.AddComponent<RectMask2D>();
            var hit = view.gameObject.AddComponent<Image>();
            hit.color = new Color(0, 0, 0, 0);
            var content = Ui.Node("content", view);
            content.anchorMin = new Vector2(0, 1);
            content.anchorMax = new Vector2(1, 1);
            content.pivot = new Vector2(0.5f, 1);
            content.sizeDelta = Vector2.zero;
            content.Column(4, TextAnchor.UpperLeft, 6, 6, 4, 12);
            content.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            var sr = view.gameObject.AddComponent<ScrollRect>();
            sr.content = content;
            sr.horizontal = false;
            sr.vertical = true;
            sr.movementType = ScrollRect.MovementType.Elastic;
            sr.scrollSensitivity = 30;
            sr.viewport = view;
            return content;
        }

        // ================= сброс =================
        static void AskReset(Action back)
        {
            var col = Panel(Loc.Tr("Сбросить прогресс?"), 230, () => ShowSettings(back), out _, 44);
            col.GetComponent<VerticalLayoutGroup>().spacing = 11;
            Ui.Label("hint", col, Loc.Tr("Сохранённый забег, статистика и достижения будут удалены. Настройки и покупки останутся."), 14, new Color(1, 1, 1, 0.8f)).Pref(270);
            Ui.Push(col, Loc.Tr("Сбросить"), () =>
            {
                var flow = RunFlow.Current;
                if (flow != null && flow.FightBusy) { Hud.Toast(Loc.Tr("Дождись конца хода")); return; }
                Close();
                if (flow != null) flow.Quit(false);
                RunFlow.ClearSave(Boot.Instance.Defs);
                Progress.Reset();
                Boot.Instance.ShowTitle();
                Hud.Toast(Loc.Tr("Прогресс сброшен"));
            }, false, 20, 260, 52);
            Ui.Push(col, Loc.Tr("Отмена"), () => ShowSettings(back), true, 18, 260, 48);
        }
    }

    /// <summary>Отпускание пальца над элементом (звук-образец громкости).</summary>
    public sealed class PointerUp : MonoBehaviour, UnityEngine.EventSystems.IPointerUpHandler
    {
        public Action Up;
        public void OnPointerUp(UnityEngine.EventSystems.PointerEventData e) => Up?.Invoke();
    }
}
