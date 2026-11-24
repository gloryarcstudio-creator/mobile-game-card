// Экран боя (renderCombat, renderHand и анимации боя в game.js).
// Бой считается в Fitil.Core.Combat сразу целиком; экран проигрывает его события по очереди:
// всплывающие числа, удары, паузы. Полоски здоровья и защита берутся из снимка в каждом событии,
// поэтому меняются вместе с ударами, а не сразу после розыгрыша.
// Места частей экрана — как в веб-версии (экран 400×860): верх привязан к верху, рука и панель героя — к низу.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Fitil.Core;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Fitil.Game
{
    public sealed class CombatScreen : MonoBehaviour
    {
        public Combat C { get; private set; }
        Defs defs;
        Action<CombatEnd> done;
        bool busy;
        int evAt;
        int selected = -1;
        float speed = 0.85f;   // доля длительности пауз из боя (в веб-версии настройка «быстрые анимации»)

        RectTransform root, back, hand, fxLayer, intentRow, eStatus, hStatus;
        RectTransform enemyBox, heroBar;
        Image enemyImg, eFill, eTrail, hFill, hTrail, flash, vignette;
        Text eName, eHpText, hHpText, energyText, drawText, discText, stepText, toastText, sayText;
        GameObject eBlock, hBlock, toast, sayBubble;
        Text eBlockText, hBlockText;
        Image[] pips;
        Button endBtn;
        readonly List<CardView> cards = new List<CardView>();
        Vector2 enemyHome;
        float eTrailTarget = 1, hTrailTarget = 1;
        readonly System.Random uiRnd = new System.Random();

        public static CombatScreen Show(Defs defs, RunState run, string enemyId, string tier, CombatSetup setup, Action<CombatEnd> done)
        {
            var go = new GameObject("CombatScreen");
            go.transform.SetParent(Boot.Instance.transform, false);
            var s = go.AddComponent<CombatScreen>();
            s.defs = defs;
            s.done = done;
            s.C = new Combat(defs, run);
            s.tier = tier;
            s.Build(enemyId);
            s.C.Start(enemyId, tier, setup ?? new CombatSetup());
            s.StartCoroutine(s.Replay(true));
            return s;
        }

        void OnDestroy()
        {
            if (root) Destroy(root.gameObject);
            if (back) Destroy(back.gameObject);
        }

        // ================= построение =================
        void Build(string enemyId)
        {
            var boot = Boot.Instance;
            back = Ui.Node("combat back", boot.Back).Fill();
            Boot.Background(back, Boot.BgFor(defs, C.Run.Step));

            root = Ui.Node("combat", boot.Safe).Fill();
            // нажатие мимо карт снимает выбор
            Ui.Hit("tap", root, () => { if (!busy) Select(-1); }).GetComponent<RectTransform>().Fill();

            BuildTop();
            BuildEnemy(enemyId);
            BuildHeroBar();

            hStatus = Ui.Node("hstatus", root).Box(8, 530, 384, 24, 0);
            Row(hStatus, TextAnchor.MiddleLeft);

            hand = Ui.Node("hand", root).Box(0, 560, 400, 200, 0);

            fxLayer = Ui.Node("fx", root).Fill();
            flash = Ui.Img("flash", fxLayer, null, new Color(1, 0.85f, 0.5f, 0));
            flash.rectTransform.Fill();
            vignette = Ui.Img("hurt", fxLayer, null, new Color(0.8f, 0.05f, 0.05f, 0));
            vignette.rectTransform.Fill();

            toast = Ui.Round("toast", root, new Color32(14, 16, 28, 235)).gameObject;
            var tr = (RectTransform)toast.transform;
            tr.At(new Vector2(0.5f, 0.5f), new Vector2(0, 40), new Vector2(340, 56));
            toastText = Ui.Label("text", tr, "", 17, Ui.Paper).Shadow();
            toastText.rectTransform.Fill();
            toastText.rectTransform.offsetMin = new Vector2(12, 4);
            toastText.rectTransform.offsetMax = new Vector2(-12, -4);
            toast.SetActive(false);
        }

        void BuildTop()
        {
            var bar = Ui.Img("topbar", root, "ui2/topbar");
            bar.rectTransform.Box(3, 3, 394, 46);
            if (!bar.sprite) bar.color = new Color32(20, 24, 38, 220);
            else { bar.type = Image.Type.Sliced; bar.pixelsPerUnitMultiplier = 3.4f; }
            var relics = Ui.Node("relics", bar.transform);
            relics.Box(14, 8, 260, 30);
            var x = 0f;
            foreach (var id in C.Run.Relics)
            {
                var r = Ui.Img("r " + id, relics, "r2/" + id);
                r.preserveAspect = true;
                r.rectTransform.Box(x, 0, 30, 30);
                x += 32;
            }
            var max = defs.MaxSteps;
            stepText = Ui.Label("step", bar.transform, StepLabel(max), 16, Ui.Paper, TextAnchor.MiddleRight, true).Shadow();
            stepText.rectTransform.Box(200, 8, 180, 30);
        }

        string tier;
        string StepLabel(int max) => tier == "boss" ? Loc.Tr(defs.IsFinalStep(C.Run.Step) ? "Финал" : "Босс стадии") : Loc.Tr("Уровень {a}/{b}", ("a", C.Run.Step + 1), ("b", max));

        void BuildEnemy(string enemyId)
        {
            intentRow = Ui.Node("intent", root).Box(0, 66, 400, 42);
            Row(intentRow, TextAnchor.MiddleCenter, 10);

            enemyBox = Ui.Node("enemy", root).Box(75, 120, 250, 260);
            enemyHome = enemyBox.anchoredPosition;
            enemyImg = Ui.Img("art", enemyBox, "e/" + enemyId);
            enemyImg.preserveAspect = true;
            enemyImg.rectTransform.Fill();
            enemyImg.raycastTarget = true;
            // нажатие на врага разыгрывает выбранную карту
            var hit = enemyImg.gameObject.AddComponent<Button>();
            hit.transition = Selectable.Transition.None;
            hit.onClick.AddListener(() => { if (!busy && selected >= 0) Play(selected); });
            if (!enemyImg.sprite) enemyImg.color = new Color(0, 0, 0, 0);

            // реплика врага: светлая плашка слева над ним (.saybub)
            var bubble = Ui.Round("say", root, new Color32(250, 240, 214, 242));
            bubble.gameObject.AddComponent<UnityEngine.UI.Outline>().effectColor = new Color32(0xB8, 0x89, 0x3A, 0xFF);
            sayBubble = bubble.gameObject;
            var sb = bubble.rectTransform;
            sb.Box(8, 104, 196, 58);
            sayText = Ui.Label("text", sb, "", 14, Ui.Ink).Fit(8);
            sayText.rectTransform.Fill();
            sayText.rectTransform.offsetMin = new Vector2(10, 5);
            sayText.rectTransform.offsetMax = new Vector2(-10, -5);
            sayBubble.SetActive(false);

            var plate = Ui.Round("nameplate", root, new Color32(18, 20, 32, 170));
            plate.rectTransform.Box(107, 402, 186, 31);
            eName = Ui.Label("name", plate.transform, defs.Enemies[enemyId].Name, 18, Ui.Paper, TextAnchor.MiddleCenter, true).Shadow().Fit(10);
            eName.rectTransform.Fill();

            Bar(root, 50, 437, 300, 16, out eFill, out eTrail, out eHpText, 0, 1);

            eBlock = Badge(root, "eblk", 30, 426, out eBlockText, 1);

            eStatus = Ui.Node("estatus", root).Box(4, 459, 392, 22);
            Row(eStatus, TextAnchor.MiddleCenter);
        }

        void BuildHeroBar()
        {
            heroBar = Ui.Node("herobar", root).Box(0, 768, 400, 92, 0);
            var bg = Ui.Img("bg", heroBar, "ui2/herobar");
            bg.rectTransform.Fill();
            if (!bg.sprite) bg.color = new Color32(20, 24, 38, 235);

            var face = Ui.CircleArt("face", heroBar, Ui.Art("h/" + C.Run.Cls + "_face"));
            face.rectTransform.Box(9, 20, 65, 65);

            // Огоньки лампы
            var lamp = Ui.Node("flame", heroBar).Box(86, 8, 90, 23);
            pips = new Image[C.FlameMaxNow];
            for (var i = 0; i < pips.Length; i++)
            {
                var p = Ui.Img("pip", lamp, "i/flame_pip");
                p.preserveAspect = true;
                p.rectTransform.Box(i * 24, 0, 22, 22);
                pips[i] = p;
            }

            Bar(heroBar, 108, 50, 110, 19, out hFill, out hTrail, out hHpText, 0, 1);
            hBlock = Badge(heroBar, "hblk", 80, 42, out hBlockText, 1);

            var orb = Ui.Img("energy", heroBar, "ui2/round");
            orb.preserveAspect = true;
            orb.rectTransform.Box(232, 32, 50, 54);
            if (!orb.sprite) { orb.sprite = Ui.Circle; orb.color = new Color32(0x1F, 0x8D, 0x88, 0xFF); }
            energyText = Ui.Label("n", orb.transform, "", 24, Color.white, TextAnchor.MiddleCenter, true).Shadow(2f, 1f);
            energyText.rectTransform.Fill();

            var drawB = Ui.Round("draw", heroBar, new Color32(0x26, 0x2D, 0x45, 0xF0));
            drawB.rectTransform.Box(279, 4, 56, 18);
            drawText = Ui.Label("t", drawB.transform, "", 11, Ui.Paper).Shadow(1f);
            drawText.rectTransform.Fill();
            var discB = Ui.Round("disc", heroBar, new Color32(0x26, 0x2D, 0x45, 0xF0));
            discB.rectTransform.Box(339, 4, 54, 18);
            discText = Ui.Label("t", discB.transform, "", 11, Ui.Paper).Shadow(1f);
            discText.rectTransform.Fill();

            endBtn = Ui.Btn("end", heroBar, Loc.Tr("Конец<br>хода").Replace("<br>", "\n"), EndTurn, 15);
            ((RectTransform)endBtn.transform).Box(294, 32, 96, 50);
        }

        /// <summary>Полоска здоровья: тёмное ложе, светлый «след» убывающего здоровья, красная заливка и число.</summary>
        static void Bar(Transform parent, float x, float y, float w, float h, out Image fill, out Image trail, out Text text, float anchorY, int _)
        {
            var bed = Ui.Round("hp", parent, new Color32(0x2A, 0x1A, 0x20, 0xFF));
            bed.rectTransform.Box(x, y, w, h);
            bed.gameObject.AddComponent<UnityEngine.UI.Outline>().effectColor = Ui.Ink;
            trail = Ui.Round("trail", bed.transform, new Color32(0xFF, 0xD9, 0xA0, 0xFF));
            trail.rectTransform.Fill();
            fill = Ui.Round("fill", bed.transform, new Color32(0xD8, 0x3C, 0x34, 0xFF));
            fill.rectTransform.Fill();
            text = Ui.Label("n", bed.transform, "", Mathf.RoundToInt(h * 0.78f), Color.white, TextAnchor.MiddleCenter, true).Shadow(1f, 1f);
            text.rectTransform.Fill();
        }

        /// <summary>Значок защиты с числом рядом с полоской здоровья.</summary>
        static GameObject Badge(Transform parent, string name, float x, float y, out Text text, int _)
        {
            var img = Ui.Img(name, parent, "it/block");
            img.preserveAspect = true;
            img.rectTransform.Box(x, y, 34, 34);
            if (!img.sprite) { img.sprite = Ui.Circle; img.color = new Color32(0x4A, 0x6A, 0xA8, 0xFF); }
            text = Ui.Label("n", img.transform, "", 16, Color.white, TextAnchor.MiddleCenter, true).Shadow(1.5f, 1f);
            text.rectTransform.Fill();
            img.gameObject.SetActive(false);
            return img.gameObject;
        }

        static void Row(RectTransform rt, TextAnchor align, float gap = 4)
        {
            var h = rt.gameObject.AddComponent<HorizontalLayoutGroup>();
            h.childAlignment = align;
            h.spacing = gap;
            h.childControlWidth = true;
            h.childControlHeight = true;
            h.childForceExpandWidth = false;
            h.childForceExpandHeight = false;
        }

        /// <summary>Значок с подписью (статус, намерение): плашка, картинка слева, текст справа.</summary>
        static void Chip(Transform row, string icon, string text, Color color, int size = 13, float h = 22)
        {
            var plate = Ui.Round("chip", row, new Color32(20, 24, 38, 215));
            var lay = plate.gameObject.AddComponent<HorizontalLayoutGroup>();
            lay.padding = new RectOffset(4, 8, 1, 1);
            lay.spacing = 3;
            lay.childAlignment = TextAnchor.MiddleCenter;
            lay.childControlWidth = true;
            lay.childControlHeight = true;
            lay.childForceExpandWidth = false;
            var le = plate.gameObject.AddComponent<LayoutElement>();
            le.preferredHeight = h;
            if (icon != null)
            {
                var sp = Ui.Art(icon);
                if (sp)
                {
                    var im = Ui.Img("i", plate.transform, sp, Color.white);
                    im.preserveAspect = true;
                    var ie = im.gameObject.AddComponent<LayoutElement>();
                    ie.preferredWidth = ie.preferredHeight = h - 2;
                }
            }
            if (!string.IsNullOrEmpty(text))
            {
                var t = Ui.Label("t", plate.transform, text, size, color, TextAnchor.MiddleLeft, true).Shadow(1f);
                t.horizontalOverflow = HorizontalWrapMode.Overflow;
            }
        }

        // ================= отрисовка состояния =================
        void ApplySnap(CombatSnap s)
        {
            var ef = s.EMax > 0 ? Mathf.Clamp01((float)Math.Max(0, s.EHp) / s.EMax) : 0;
            SetFill(eFill, ef);
            eTrailTarget = ef;
            eHpText.text = $"{Math.Max(0, s.EHp)}/{s.EMax}";
            eBlock.SetActive(s.EBlock > 0);
            eBlockText.text = s.EBlock.ToString();

            var hf = s.MaxHp > 0 ? Mathf.Clamp01((float)Math.Max(0, s.Hp) / s.MaxHp) : 0;
            SetFill(hFill, hf);
            hTrailTarget = hf;
            hHpText.text = $"{Math.Max(0, s.Hp)}/{s.MaxHp}";
            hBlock.SetActive(s.Block > 0);
            hBlockText.text = s.Block.ToString();

            energyText.text = $"{s.Energy}<size=13>/{C.MaxEnergy}</size>";
            for (var i = 0; i < pips.Length; i++) pips[i].color = i < s.Flame ? Color.white : new Color(0.35f, 0.33f, 0.4f, 0.8f);
        }

        static void SetFill(Image img, float f)
        {
            var rt = img.rectTransform;
            rt.anchorMax = new Vector2(f, 1);
            img.enabled = f > 0.001f;
        }

        void Update()
        {
            StepTrail(eTrail, eTrailTarget);
            StepTrail(hTrail, hTrailTarget);
        }

        static void StepTrail(Image trail, float target)
        {
            if (!trail) return;
            var rt = trail.rectTransform;
            var cur = rt.anchorMax.x;
            // след догоняет заливку с задержкой, как .trail в style.css
            cur = cur > target ? Mathf.MoveTowards(cur, target, Time.deltaTime * 0.9f) : target;
            rt.anchorMax = new Vector2(cur, 1);
            trail.enabled = cur > 0.001f;
        }

        void RenderAll()
        {
            ApplySnap(C.Snap());
            RenderIntents();
            RenderEnemyStatus();
            RenderHeroStatus();
            RenderHand();
            drawText.text = Loc.Tr("Колода") + " " + Ui.Paint(C.Draw.Count.ToString(), Ui.GoldHi);
            discText.text = Loc.Tr("Сброс") + " " + Ui.Paint(C.Disc.Count.ToString(), Ui.GoldHi);
            if (!C.SaidHurt && C.Enemy.Hp > 0 && C.Enemy.Hp <= C.Enemy.Max / 2.0) { C.SaidHurt = true; Say("hurt"); }
        }

        void RenderIntents()
        {
            Ui.Clear(intentRow);
            if (C.Enemy.Hp <= 0 || C.End != CombatEnd.None) return;
            var add = 0;
            foreach (var it0 in C.CurrentIntents())
            {
                var it = it0;
                if (add != 0 && it.HasV && (it.K == "attack" || it.K == "boom" || it.K == "snuff" || it.K == "steal")) it = it.With(add);
                IntentChip(it);
                if (it.K == "buff") add += it.V;
            }
        }

        void IntentChip(IntentDef it)
        {
            string icon = "it/" + it.K, text;
            var col = Ui.Paper;
            switch (it.K)
            {
                case "attack": icon = it.Leech ? "it/leech" : "it/attack"; text = C.EnemyDmg(it.V) + (it.Hits > 0 ? "×" + it.Hits : ""); col = new Color32(0xFF, 0x9A, 0x8A, 0xFF); break;
                case "boom": case "snuff": case "steal": text = C.EnemyDmg(it.V).ToString(); col = new Color32(0xFF, 0x9A, 0x8A, 0xFF); break;
                case "sap": case "bury": text = "−" + it.V; col = Ui.Violet; break;
                case "mist": text = "≤" + it.V; col = Ui.Blue; break;
                case "frail": case "debuff": text = it.V.ToString(); col = Ui.Violet; break;
                case "block": text = it.V.ToString(); col = Ui.Blue; break;
                case "buff": text = "+" + it.V; col = Ui.Orange; break;
                case "curse": text = "×" + it.N; col = Ui.Violet; break;
                case "heal": text = "+" + it.V; col = Ui.Green; break;
                case "spikes": text = "+" + it.V; col = Ui.Blue; break;
                case "sleep": text = Loc.Tr("Спит"); col = new Color32(0xF4, 0xE6, 0xA8, 0xFF); break;
                default: text = it.V.ToString(); break;
            }
            Chip(intentRow, icon, text, col, 20, 38);
        }

        void RenderEnemyStatus()
        {
            Ui.Clear(eStatus);
            var e = C.Enemy;
            var ed = defs.Enemies[C.Id];
            if (e.Str != 0) Chip(eStatus, "st/enemy_strength", Loc.Tr("Сила {n}", ("n", e.Str)), Ui.Orange);
            if (e.Raged) Chip(eStatus, "st/enemy_strength", Loc.Tr("Ярость"), Ui.Red);
            if (e.Weak > 0) Chip(eStatus, "st/weak", Loc.Tr("Ослаблен {n}", ("n", e.Weak)), Ui.Violet);
            if (e.Vuln > 0) Chip(eStatus, "st/vulnerable", Loc.Tr("Уязвим {n}", ("n", e.Vuln)), Ui.Violet);
            if (e.Burn > 0) Chip(eStatus, "st/burn", Loc.Tr("Поджог {n}", ("n", e.Burn)), Ui.Orange);
            if (e.Thorns > 0) Chip(eStatus, "st/thorns", Loc.Tr("Колючки {n}", ("n", e.Thorns)), Ui.Paper);
            if (e.Nest > 0) Chip(eStatus, null, Loc.Tr("Матрёшка ×{n}", ("n", e.Nest)), Ui.Paper);
            if (ed.Boil > 0) Chip(eStatus, null, Loc.Tr("Кипит +{n}", ("n", e.Boil)), e.Boil > 0 ? Ui.Orange : Ui.Paper);
            if (ed.Tally > 0) Chip(eStatus, null, Loc.Tr("Ку-ку {a}/{b}", ("a", C.PlayedTurn % ed.Tally), ("b", ed.Tally)), Ui.Paper);
            if (ed.Plating) Chip(eStatus, null, Loc.Tr("Латы"), Ui.Paper);
            if (ed.Alarm > 0) Chip(eStatus, null, Loc.Tr("Колотушка +{n}", ("n", ed.Alarm)), Ui.Paper);
            if (e.Mist > 0) Chip(eStatus, null, Loc.Tr("Туман ≤{n}", ("n", e.Mist)), Ui.Blue);
            var bi = ed.Pattern.FindIndex(p => p.K == "boom");
            if (bi >= 0)
            {
                var L = ed.Pattern.Count;
                var left = ((bi - (e.Pi % L)) + L) % L + 1;
                Chip(eStatus, null, Loc.Tr("Фитиль {n}", ("n", left)), Ui.Orange);
            }
            if (e.Stun > 0) Chip(eStatus, "st/asleep", Loc.Tr("Спит"), Ui.Violet);
            if (C.Stolen > 0) Chip(eStatus, "st/steal", Loc.Tr("Украдено {n}", ("n", C.Stolen)), Ui.GoldHi);
        }

        void RenderHeroStatus()
        {
            Ui.Clear(hStatus);
            var res = C.Str + C.TmpStr;
            if (res != 0) Chip(hStatus, "st/resolve", Loc.Tr("Решимость {n}", ("n", res)), Ui.Orange);
            if (C.ThornsNow > 0) Chip(hStatus, "st/thorns", Loc.Tr("Шипы {n}", ("n", C.ThornsNow)), Ui.Blue);
            if (C.DogNow > 0) Chip(hStatus, "r2/dogfriend", C.DogNow.ToString(), Ui.Orange);
            if (C.Glazed) Chip(hStatus, "c/glaze", "", Ui.Paper);
            if (C.Paid > 0) Chip(hStatus, "st/price", Loc.Tr("Цена {n}", ("n", C.Paid)), Ui.Red);
            if (C.PWeak > 0) Chip(hStatus, "st/weak", Loc.Tr("Слабость {n}", ("n", C.PWeak)), Ui.Violet);
            if (C.Frail > 0) Chip(hStatus, "st/frail", Loc.Tr("Хрупкость {n}", ("n", C.Frail)), Ui.Violet);
            if (C.Deliveries.Count > 0) Chip(hStatus, "st/delivery", Loc.Tr("Доставка {n}", ("n", C.Deliveries.Count)), Ui.Paper);
            foreach (var kv in C.Charms) Chip(hStatus, "c/" + kv.Key, kv.Value.ToString(), Ui.Violet);
        }

        // ================= рука =================
        void RenderHand()
        {
            Ui.Clear(hand);
            cards.Clear();
            var n = C.Hand.Count;
            const float W = CardView.W, avail = 384;
            var step = n > 1 ? Mathf.Min(W + 4, (avail - W) / (n - 1)) : 0;
            var total = W + step * (n - 1);
            var x0 = (400 - total) / 2;
            for (var i = 0; i < n; i++)
            {
                var v = CardView.Make(hand, C.Hand[i], defs, C);
                var rt = v.Rect;
                rt.anchorMin = rt.anchorMax = new Vector2(0, 1);
                rt.pivot = new Vector2(0.5f, 0.5f);
                var rot = (i - (n - 1) / 2f) * 3.5f;
                var lift = Mathf.Abs(i - (n - 1) / 2f) * 5;
                var left = x0 + i * step;
                var hgt = W * CardView.Ratio;
                if (i == selected)
                {
                    left = Mathf.Clamp(left, 26, 400 - W - 26);
                    rt.anchoredPosition = new Vector2(left + W / 2, -(20 + hgt / 2) + 70);
                    rt.localScale = Vector3.one * 1.32f;
                    rt.localRotation = Quaternion.identity;
                }
                else
                {
                    rt.anchoredPosition = new Vector2(left + W / 2, -(20 + hgt / 2) - lift);
                    rt.localRotation = Quaternion.Euler(0, 0, -rot);
                }
                v.SetPlayable(C.CantPlay(C.Hand[i]) == null);
                var touch = v.gameObject.AddComponent<CardTouch>();
                touch.Screen = this;
                touch.Index = i;
                var catcher = v.gameObject.AddComponent<Image>();
                catcher.color = new Color(0, 0, 0, 0);
                cards.Add(v);
            }
            if (selected >= 0 && selected < cards.Count) cards[selected].transform.SetAsLastSibling();
        }

        public void Select(int i)
        {
            if (busy) return;
            selected = i >= 0 && i < C.Hand.Count && selected != i ? i : -1;
            RenderHand();
        }

        public void Tap(int i)
        {
            if (busy) return;
            if (selected == i) Play(i);
            else Select(i);
        }

        public void Play(int i)
        {
            if (busy || C.End != CombatEnd.None || i < 0 || i >= C.Hand.Count) return;
            selected = -1;
            C.PlayCard(i);
            StartCoroutine(Replay(false));
        }

        void EndTurn()
        {
            if (busy || C.End != CombatEnd.None) return;
            selected = -1;
            C.EndTurn();
            StartCoroutine(Replay(true));
        }

        /// <summary>Перетаскивание карты: вверх выше руки — розыгрыш, иначе карта возвращается.</summary>
        public void DragTo(int i, Vector2 delta, bool release)
        {
            if (busy || i < 0 || i >= cards.Count) return;
            var rt = cards[i].Rect;
            if (!release)
            {
                // карту не пересоздаём посреди перетаскивания: только поднимаем над остальными
                if (selected != i) { selected = i; rt.SetAsLastSibling(); rt.localScale = Vector3.one * 1.18f; }
                rt.anchoredPosition += delta;
                rt.localRotation = Quaternion.identity;
                return;
            }
            // рука начинается на 560-й точке; карта поднята над ней — играем
            if (rt.anchoredPosition.y > 60) Play(i);
            else RenderHand();
        }

        // ================= проигрывание событий =================
        IEnumerator Replay(bool deal)
        {
            busy = true;
            endBtn.interactable = false;
            var events = C.Events;
            var floats = new Dictionary<string, float>();
            while (evAt < events.Count)
            {
                var e = events[evAt++];
                ApplySnap(e.S);
                switch (e.Kind)
                {
                    case Ev.Wait:
                        yield return new WaitForSeconds(e.N / 1000f * speed);
                        break;
                    case Ev.Float:
                        Float(e.A, e.B, e.C, floats);
                        break;
                    case Ev.Toast:
                        ShowToast(e.B);
                        break;
                    case Ev.Render:
                        RenderIntents();
                        RenderEnemyStatus();
                        RenderHeroStatus();
                        break;
                    case Ev.EnemyAct:
                        if (e.A == "attack") yield return EnemyLunge();
                        else if (e.A == "hurt") StartCoroutine(Shake(enemyBox, enemyHome, 7, 0.22f, enemyImg));
                        else if (e.A == "death") StartCoroutine(Fade(enemyImg, 0.5f));
                        break;
                    case Ev.HeroMove:
                        if (e.A == "hurt") { StartCoroutine(Pulse(vignette, 0.28f, 0.35f)); StartCoroutine(Shake(heroBar, heroBar.anchoredPosition, 5, 0.2f, null)); }
                        break;
                    case Ev.Burst:
                        StartCoroutine(Pulse(flash, 0.45f, 0.4f));
                        break;
                    case Ev.Relic:
                        RelicPop(e.A, e.B == "enemy");
                        break;
                    case Ev.Say:
                        Say(e.A);
                        break;
                    case Ev.Fx:
                        if (e.B == "enemy") StartCoroutine(Tint(enemyImg, new Color(1f, 0.85f, 0.7f), 0.12f));
                        break;
                }
            }
            if (C.End == CombatEnd.Win) { Say("death"); StartCoroutine(Fade(enemyImg, 0.6f)); }
            RenderAll();
            if (deal) StartCoroutine(Deal());
            busy = false;
            endBtn.interactable = C.End == CombatEnd.None;
            if (C.End != CombatEnd.None)
            {
                busy = true;
                yield return new WaitForSeconds(0.9f);
                done?.Invoke(C.End);
            }
        }

        IEnumerator Deal()
        {
            var list = cards.ToList();
            var homes = list.Select(c => c.Rect.anchoredPosition).ToList();
            foreach (var c in list) c.Rect.anchoredPosition += new Vector2(0, -220);
            for (var i = 0; i < list.Count; i++) StartCoroutine(Slide(list[i].Rect, homes[i], 0.22f, i * 0.06f));
            yield break;
        }

        static IEnumerator Slide(RectTransform rt, Vector2 to, float dur, float delay)
        {
            if (delay > 0) yield return new WaitForSeconds(delay);
            if (!rt) yield break;
            var from = rt.anchoredPosition;
            for (var t = 0f; t < dur; t += Time.deltaTime)
            {
                if (!rt) yield break;
                var k = 1 - Mathf.Pow(1 - t / dur, 3);
                rt.anchoredPosition = Vector2.LerpUnclamped(from, to, k);
                yield return null;
            }
            if (rt) rt.anchoredPosition = to;
        }

        IEnumerator EnemyLunge()
        {
            var down = enemyHome + new Vector2(0, -34);
            yield return Slide(enemyBox, down, 0.12f, 0);
            yield return Slide(enemyBox, enemyHome, 0.18f, 0);
        }

        static IEnumerator Shake(RectTransform rt, Vector2 home, float amp, float dur, Image tint)
        {
            if (tint) tint.color = new Color(1f, 0.55f, 0.5f, tint.color.a);
            for (var t = 0f; t < dur; t += Time.deltaTime)
            {
                if (!rt) yield break;
                var k = 1 - t / dur;
                rt.anchoredPosition = home + new Vector2(Mathf.Sin(t * 70) * amp * k, 0);
                yield return null;
            }
            if (rt) rt.anchoredPosition = home;
            if (tint) tint.color = new Color(1, 1, 1, tint.color.a);
        }

        static IEnumerator Tint(Image img, Color c, float dur)
        {
            if (!img) yield break;
            var a = img.color.a;
            img.color = new Color(c.r, c.g, c.b, a);
            yield return new WaitForSeconds(dur);
            if (img) img.color = new Color(1, 1, 1, img.color.a);
        }

        static IEnumerator Pulse(Image img, float peak, float dur)
        {
            var c = img.color;
            for (var t = 0f; t < dur; t += Time.deltaTime)
            {
                var k = t < dur * 0.25f ? t / (dur * 0.25f) : 1 - (t - dur * 0.25f) / (dur * 0.75f);
                img.color = new Color(c.r, c.g, c.b, peak * k);
                yield return null;
            }
            img.color = new Color(c.r, c.g, c.b, 0);
        }

        static IEnumerator Fade(Image img, float dur)
        {
            if (!img) yield break;
            var c = img.color;
            for (var t = 0f; t < dur; t += Time.deltaTime)
            {
                if (!img) yield break;
                img.color = new Color(c.r, c.g, c.b, c.a * (1 - t / dur));
                yield return null;
            }
            if (img) img.color = new Color(c.r, c.g, c.b, 0);
        }

        static readonly Dictionary<string, Color> FloatColor = new Dictionary<string, Color>
        {
            ["dmgf"] = new Color32(0xFF, 0x5A, 0x4A, 0xFF),
            ["blockf"] = new Color32(0x9F, 0xC3, 0xFF, 0xFF),
            ["burnf"] = new Color32(0xFF, 0xB0, 0x60, 0xFF),
            ["healf"] = new Color32(0x8D, 0xFF, 0x9A, 0xFF),
            ["weakf"] = new Color32(0xE8, 0xD8, 0xFF, 0xFF),
        };

        /// <summary>Всплывающая надпись над врагом или героем (floatText в game.js).</summary>
        void Float(string target, string text, string cls, Dictionary<string, float> recent)
        {
            var key = target ?? "hero";
            var now = Time.time;
            var stack = recent.TryGetValue(key, out var at) && now - at < 0.35f;
            recent[key] = now;
            var baseCls = (cls ?? "").Split(' ')[0];
            var small = (cls ?? "").Contains("small");
            var col = FloatColor.TryGetValue(baseCls, out var c) ? c : Ui.Paper;
            var big = baseCls == "dmgf" && !small;
            var t = Ui.Label("float", fxLayer, text, big ? 34 : 19, col, TextAnchor.MiddleCenter, true).Outline(new Color(0, 0, 0, 0.9f), 1.6f);
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            var pos = key == "enemy" ? new Vector2(200, -250) : new Vector2(150, -(Boot.Instance.Safe.rect.height - 130));
            pos += new Vector2((float)(uiRnd.NextDouble() * 40 - 20), stack ? -26 : 0);
            t.rectTransform.anchorMin = t.rectTransform.anchorMax = new Vector2(0, 1);
            t.rectTransform.sizeDelta = new Vector2(300, 40);
            t.rectTransform.anchoredPosition = pos;
            StartCoroutine(Rise(t, 0.95f));
        }

        static IEnumerator Rise(Text t, float dur)
        {
            var rt = t.rectTransform;
            var from = rt.anchoredPosition;
            var c = t.color;
            for (var k = 0f; k < dur; k += Time.deltaTime)
            {
                if (!t) yield break;
                var p = k / dur;
                rt.anchoredPosition = from + new Vector2(0, 60 * (1 - (1 - p) * (1 - p)));
                rt.localScale = Vector3.one * (p < 0.12f ? 0.6f + p / 0.12f * 0.5f : 1.1f - Mathf.Min(0.1f, (p - 0.12f)));
                t.color = new Color(c.r, c.g, c.b, p < 0.7f ? 1 : 1 - (p - 0.7f) / 0.3f);
                yield return null;
            }
            if (t) Destroy(t.gameObject);
        }

        void RelicPop(string id, bool onEnemy)
        {
            var img = Ui.Img("relic " + id, fxLayer, "r2/" + id);
            if (!img.sprite) { Destroy(img.gameObject); return; }
            img.preserveAspect = true;
            var rt = img.rectTransform;
            rt.anchorMin = rt.anchorMax = new Vector2(0, 1);
            rt.sizeDelta = new Vector2(46, 46);
            rt.anchoredPosition = onEnemy ? new Vector2(300, -170) : new Vector2(42, -(Boot.Instance.Safe.rect.height - 120));
            StartCoroutine(RelicRise(img));
        }

        static IEnumerator RelicRise(Image img)
        {
            var rt = img.rectTransform;
            var from = rt.anchoredPosition;
            for (var t = 0f; t < 0.9f; t += Time.deltaTime)
            {
                if (!img) yield break;
                var p = t / 0.9f;
                rt.anchoredPosition = from + new Vector2(0, 30 * p);
                rt.localScale = Vector3.one * (p < 0.15f ? p / 0.15f * 1.2f : 1.2f - 0.2f * p);
                img.color = new Color(1, 1, 1, p < 0.6f ? 1 : 1 - (p - 0.6f) / 0.4f);
                yield return null;
            }
            if (img) Destroy(img.gameObject);
        }

        Coroutine toastCo;
        void ShowToast(string text)
        {
            if (string.IsNullOrEmpty(text)) return;
            toastText.text = text;
            toast.SetActive(true);
            toast.transform.SetAsLastSibling();
            if (toastCo != null) StopCoroutine(toastCo);
            toastCo = StartCoroutine(HideLater(toast, 1.6f));
        }

        static IEnumerator HideLater(GameObject go, float sec)
        {
            yield return new WaitForSeconds(sec);
            if (go) go.SetActive(false);
        }

        // ================= реплики врага (js/lore.js SAY) =================
        Coroutine sayCo;
        void Say(string kind)
        {
            var line = LineOf(C.Id, kind);
            if (string.IsNullOrEmpty(line)) return;
            sayText.text = line;
            sayBubble.SetActive(true);
            if (sayCo != null) StopCoroutine(sayCo);
            sayCo = StartCoroutine(HideLater(sayBubble, 2.6f));
        }

        string LineOf(string id, string kind)
        {
            try
            {
                var say = Json.Obj(Json.Get(defs.Data.Lore, "SAY"));
                var mine = Json.Obj(Json.Get(say, id));
                if (mine == null) return null;
                if (kind != null && kind.StartsWith("tie:")) kind = "start";
                var v = Json.Get(mine, kind ?? "start") ?? Json.Get(mine, "start");
                if (v is string s) return Loc.Tr(s);
                var arr = Json.Arr(v);
                if (arr != null && arr.Count > 0) return Loc.Tr((string)arr[uiRnd.Next(arr.Count)]);
            }
            catch (Exception) { /* реплика необязательна */ }
            return null;
        }
    }

    /// <summary>Нажатие и перетаскивание карты в руке.</summary>
    public sealed class CardTouch : MonoBehaviour, IPointerClickHandler, IBeginDragHandler, IDragHandler, IEndDragHandler
    {
        public CombatScreen Screen;
        public int Index;
        bool dragging;

        public void OnPointerClick(PointerEventData e)
        {
            if (dragging) return;
            Screen.Tap(Index);
        }

        public void OnBeginDrag(PointerEventData e) { dragging = true; }

        public void OnDrag(PointerEventData e)
        {
            var canvas = GetComponentInParent<Canvas>();
            var k = canvas ? canvas.scaleFactor : 1f;
            Screen.DragTo(Index, e.delta / k, false);
        }

        public void OnEndDrag(PointerEventData e)
        {
            dragging = false;
            Screen.DragTo(Index, Vector2.zero, true);
        }
    }
}
