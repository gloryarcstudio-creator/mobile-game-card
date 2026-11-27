// Запуск игры. Сцена одна и пустая: всё создаётся кодом, поэтому проект можно собирать
// и проверять без ручной работы в редакторе. Этот файл — каркас: данные, язык, экран
// и безопасная зона. Экраны игры появляются по этапам плана переноса.
using System.Collections.Generic;
using System.Linq;
using Fitil.Core;
using Fitil.Platform;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Fitil.Game
{
    public sealed class Boot : MonoBehaviour
    {
        /// <summary>Логический экран веб-версии: 400 точек в ширину, 860 в высоту.
        /// На высоких телефонах высота растёт, на планшетах — ширина (режим Expand).</summary>
        public static readonly Vector2 Logical = new Vector2(400, 860);

        public static Boot Instance { get; private set; }
        public GameData Data { get; private set; }
        public Defs Defs { get; private set; }
        GameObject screen;   // текущий экран (титул, выбор героя); бой живёт в RunFlow
        public RectTransform Back { get; private set; }  // фоны: весь экран, под вырезом камеры тоже
        public RectTransform Safe { get; private set; }  // кнопки и текст: только безопасная зона
        public RectTransform Top { get; private set; }   // окна поверх экрана и всплывающие сообщения
        RectTransform corner;                            // шестерёнка и меню в правом верхнем углу
        Button gearBtn, menuBtn;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Start0()
        {
            if (Instance) return;
            var go = new GameObject("Fitil");
            DontDestroyOnLoad(go);
            go.AddComponent<Boot>();
        }

        void Awake()
        {
            Instance = this;
#if FITIL_REFCHECK
            Application.targetFrameRate = 60; // проверка сборки без Unity 6: refreshRateRatio появился в 2022.2
#else
            Application.targetFrameRate = Mathf.Max(60, (int)Screen.currentResolution.refreshRateRatio.value);
#endif
            Screen.sleepTimeout = SleepTimeout.SystemSetting;
            Input.multiTouchEnabled = false; // одна карта за раз, как в веб-версии (щипок отключён)

            // на сервере у окна нет фокуса, а без фокуса игра на компьютере стоит на паузе
            if (Tour.Wanted) Application.runInBackground = true;
            Tour.Mark("awake");
            Application.lowMemory -= Ui.TrimMemory;
            Application.lowMemory += Ui.TrimMemory;
            LoadLanguage();
            Tour.Mark("language");
            Sound.Init(gameObject);
            Tour.Mark("sound");
            StoreScreen.Install();
            BuildCanvas();
            Tour.Mark("canvas");
            // при первом запуске — заставка, потом титул (при съёмке экранов заставка не нужна)
            if (Cinema.Has(Defs) && !Cinema.Seen && !Tour.Wanted) PlayCinema();
            else ShowTitle();
            Tour.Mark("title");
        }

        void LoadLanguage()
        {
            string saved = null;
            var settings = SaveStore.Read("lastray.settings");
            if (settings != null)
            {
                try { saved = Json.Str(Json.Get(Json.Obj(Json.Parse(settings)), "lang")); }
                catch { /* испорченные настройки: язык телефона */ }
            }
            if (Tour.Wanted && Tour.Lang != null) saved = Tour.Lang; // снимки для сверки делаются на заданном языке
            var lang = Loc.Detect(saved, SystemTwoLetter());
            Dictionary<string, string> strings = null;
            if (lang != "ru") strings = Loc.ParseStrings(Resources.Load<TextAsset>("Data/strings." + lang).text);
            Loc.Use(lang, strings);
            Data = GameData.Parse(lang, Resources.Load<TextAsset>("Data/data." + lang).text);
            Defs = Defs.From(Data);
            CardView.Texts = CardText.Parse(Resources.Load<TextAsset>("Data/cardtext." + lang).text);
            Store.Init(Data);
        }

        static string SystemTwoLetter()
        {
            switch (Application.systemLanguage)
            {
                case SystemLanguage.Russian: return "ru";
                case SystemLanguage.Ukrainian: return "uk";
                case SystemLanguage.Belarusian: return "ru";
                default: return "en";
            }
        }

        void BuildCanvas()
        {
            if (!Camera.main)
            {
                var cam = new GameObject("Camera").AddComponent<Camera>();
                cam.tag = "MainCamera";
                cam.orthographic = true;
                cam.clearFlags = CameraClearFlags.SolidColor;
                cam.backgroundColor = Ui.Night;
                DontDestroyOnLoad(cam.gameObject);
            }
            if (!FindAnyObjectByType<EventSystem>())
            {
                var es = new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
                DontDestroyOnLoad(es);
            }

            var canvasGo = new GameObject("Canvas", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(TapGuard));
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.pixelPerfect = false;
            var scaler = canvasGo.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = Logical;
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.Expand;
            scaler.referencePixelsPerUnit = 100;

            Back = Ui.Node("Back", canvasGo.transform).Fill();
            Ui.Node("Snow", canvasGo.transform).Fill().gameObject.AddComponent<Snow>();   // снегопад над фонами, под экраном
            Safe = Stage("Safe", canvasGo.transform);
            corner = Stage("Corner", canvasGo.transform);
            Top = Stage("Top", canvasGo.transform);

            // #gear и #menu: настройки и пауза забега (вне забега — справочник)
            gearBtn = CornerButton("gear", () => Menus.ShowSettings());
            menuBtn = CornerButton("menu", () => { if (RunFlow.Current != null) Menus.ShowPause(); else Menus.ShowGlossary(); });
        }

        /// <summary>Слой экрана: колонка шириной 400 посреди безопасной зоны, как #app в веб-версии.
        /// На экране шире 400:860 (9:16, планшет) вёрстка стоит по центру, а не прижата к левому краю; фон идёт во всю ширину.</summary>
        static RectTransform Stage(string name, Transform canvas)
        {
            var area = Ui.Node(name + " area", canvas).Fill();
            area.gameObject.AddComponent<SafeArea>();
            var col = Ui.Node(name, area);
            col.anchorMin = new Vector2(0.5f, 0);
            col.anchorMax = new Vector2(0.5f, 1);
            col.pivot = new Vector2(0.5f, 0.5f);
            col.sizeDelta = new Vector2(Logical.x, 0);
            col.anchoredPosition = Vector2.zero;
            return col;
        }

        Button CornerButton(string icon, System.Action onClick)
        {
            var ring = Ui.Img(icon, corner, Ui.Circle, new Color(0.08f, 0.09f, 0.15f, 0.75f));
            ring.raycastTarget = true;   // Ui.Img по умолчанию не ловит нажатия: без этого кнопка молчит
            ring.Outline(Ui.Gold, 2f);
            ring.rectTransform.anchorMin = ring.rectTransform.anchorMax = new Vector2(1, 1);
            ring.rectTransform.pivot = new Vector2(1, 1);
            ring.rectTransform.sizeDelta = new Vector2(38, 38);
            var pic = Ui.Img("icon", ring.transform, "i/" + icon);
            pic.preserveAspect = true;
            pic.rectTransform.Fill();
            pic.rectTransform.offsetMin = new Vector2(3, 3);
            pic.rectTransform.offsetMax = new Vector2(-3, -3);
            if (!pic.sprite) Ui.Label("t", pic.transform, icon == "gear" ? "⚙" : "≡", 22, Ui.Gold).rectTransform.Fill();
            var b = ring.gameObject.AddComponent<Button>();
            b.targetGraphic = ring;
            b.onClick.AddListener(() => { Sound.Sfx("click"); onClick(); });
            return b;
        }

        /// <summary>Где стоят шестерёнка и меню (#gear, #menu): title — меню скрыто, шестерёнка выше;
        /// combat — чуть выше обычного; end — меню скрыто; run и heroes — обычное место.</summary>
        public void Corner(string mode)
        {
            if (!gearBtn) return;
            // как в веб-версии: в забеге и в бою под верхней панелью (84 и 128), на титуле 6, на выборе героя, вступлении и финалах 12
            var gy = mode == "title" ? 6 : mode == "heroes" || mode == "end" ? 12 : 84;
            ((RectTransform)gearBtn.transform).anchoredPosition = new Vector2(-8, -gy);
            ((RectTransform)menuBtn.transform).anchoredPosition = new Vector2(-8, -(gy + 44));
            menuBtn.gameObject.SetActive(mode != "title" && mode != "end" && mode != "heroes");
        }

        /// <summary>Сменился язык: тексты читаются заново, экран открывается на новом языке
        /// (забег — с сохранения, как перезагрузка страницы в веб-версии), потом after.</summary>
        public void Relaunch(System.Action after)
        {
            var inRun = RunFlow.Current != null;
            RunFlow.Current?.Quit(false);
            Clear();
            LoadLanguage();
            var save = inRun ? RunFlow.LoadSave(Defs) : null;
            if (save != null) RunFlow.Continue(Defs, save);
            else ShowTitle();
            after?.Invoke();
        }

        /// <summary>Фон на весь экран, с обрезкой по краям без искажения (background-size: cover).</summary>
        public static Image Background(RectTransform parent, string art)
        {
            var bg = Ui.Img("bg", parent, Ui.Art(art), Color.white);
            bg.rectTransform.Fill();
            if (bg.sprite)
            {
                var fit = bg.gameObject.AddComponent<AspectRatioFitter>();
                fit.aspectMode = AspectRatioFitter.AspectMode.EnvelopeParent;
                fit.aspectRatio = (float)bg.sprite.texture.width / bg.sprite.texture.height;
            }
            else bg.color = Ui.Night;
            return bg;
        }

        /// <summary>Нарисованный фон шага забега (setBg в game.js): город днём, вечером и на закате,
        /// окраина в начале, в середине и ночью, в финале — дом.</summary>
        /// <summary>Линия снега на картинке фона в точках макета (FEET в js/paint.js): сюда встают ноги.</summary>
        public static float FeetOf(string art)
        {
            switch (art)
            {
                case "bg/bg_stage2_outskirts_start": return 660;
                case "bg/bg_stage2_outskirts_mid": return 670;
                case "bg/bg_stage2_outskirts_night": return 685;
                case "bg/bg_final_house": return 650;
                case "bg/bg_title": return 726;
                case "bg/scene_talk": return 700;
                case "bg/scene_meet": return 715;
                case "bg/scene_shop": return 515;
                case "bg/scene_campfire": return 700;
                default: return 690;
            }
        }

        public static string BgFor(Defs defs, int step)
        {
            if (defs.Stages.Count > 1 && defs.IsFinalStep(step)) return "bg/bg_final_house";
            var si = Mathf.Max(0, defs.StageOf(step));
            var g = defs.Stages[si];
            var t = g.Len > 1 ? (float)(step - g.Start) / (g.Len - 1) : 1;
            if (g.Scene == "outskirts" || si > 0) return t < 0.34f ? "bg/bg_stage2_outskirts_start" : t < 0.67f ? "bg/bg_stage2_outskirts_mid" : "bg/bg_stage2_outskirts_night";
            return t < 0.34f ? "bg/bg_stage1_town_day" : t < 0.67f ? "bg/bg_stage1_town_mid" : "bg/bg_stage1_town_sunset";
        }

        internal void Clear()
        {
            if (screen) Destroy(screen);
            screen = null;
            Ui.Clear(Back);
            Ui.Clear(Safe);
            Ui.Clear(Top);
            for (var i = transform.childCount - 1; i >= 0; i--)
            {
                var c = transform.GetChild(i);
                if (c.GetComponent<CombatScreen>() || c.GetComponent<HeroSelect>()) Destroy(c.gameObject);
            }
        }

        /// <summary>Титульный экран: заставка, нарисованное название и «Новая игра».</summary>
        public void ShowTitle()
        {
            RunFlow.Drop();
            Clear();
            Corner("title");
            Hud.ToastTop = 430;
            screen = new GameObject("Title");
            screen.transform.SetParent(transform, false);
            Sound.Music("title");

            var logo = Ui.Art("ui2/logo_" + Loc.Lang) ?? Ui.Art("ui2/logo_ru");
            if (logo)
            {
                var img = Ui.Img("logo", Safe, logo, Color.white);
                img.preserveAspect = true;
                img.rectTransform.At(new Vector2(0.5f, 1f), new Vector2(0, -114), new Vector2(360, 150));
            }
            else
            {
                var story = Json.Obj(Json.Get(Json.Obj(Data.Story["STORIES"]), "sunset"));
                var title = Ui.Label("title", Safe, Json.Str(Json.Get(story, "title"), "Последний луч"), 40, Ui.Gold, TextAnchor.MiddleCenter, true);
                title.rectTransform.At(new Vector2(0.5f, 1f), new Vector2(0, -90), new Vector2(380, 60));
            }

            // «Продолжить» с героем, сложностью, уровнем и здоровьем сохранённого забега
            var save = RunFlow.LoadSave(Defs);
            var feet = TitleHero(save != null ? save.Run.Cls : Settings.Cls, save != null);
            // камера фона опускается герою под ноги: снег с картинки встаёт под сапоги (726 — FEET.bg_title в js/paint.js)
            if (feet) GroundBg.Make(Back, "bg/bg_title", FeetOf("bg/bg_title"), feet);
            else Background(Back, "bg/bg_title");
            if (save != null)
            {
                var r = save.Run;
                var hero = Data.Classes.TryGetValue(r.Cls, out var h) ? h.Name : r.Cls;
                var diff = Data.Difficulties[Mathf.Clamp(r.Diff, 0, Data.Difficulties.Count - 1)].Name;
                var info = hero + " · " + diff + "\n" + Loc.Tr("ур. {n}", ("n", r.Step + 1)) + " · " + r.Hp + "/" + r.MaxHp + " HP";
                var cont = Ui.Push(Safe, Loc.Tr("Продолжить") + "\n<size=13>" + info + "</size>", () => { Clear(); RunFlow.Continue(Defs, save); }, false, 24, 260, 84);
                ((RectTransform)cont.transform).At(new Vector2(0.5f, 0f), new Vector2(0, 420), new Vector2(270, 84));
            }
            // без сохранения «Новая игра» — главная красная кнопка (.btn.big 270×62), с сохранением главная «Продолжить»
            var play = save != null ? Ui.Push(Safe, Loc.Tr("Новая игра"), () => AskNewGame(save), true, 20, 220, 54) : Ui.Push(Safe, Loc.Tr("Новая игра"), () => { Sound.Sfx("click"); ShowHeroes(); }, false, 28, 270, 62);
            ((RectTransform)play.transform).At(new Vector2(0.5f, 0f), new Vector2(0, save != null ? 340 : 348), save != null ? new Vector2(220, 54) : new Vector2(270, 62));

            // достижения, база знаний и статистика: значок, название и счёт под ним (.achbtn)
            var ach = Progress.List;
            MenuRow("medal", Loc.Tr("Достижения"), Loc.Tr("{a} из {b}", ("a", ach.Count(Progress.Done)), ("b", ach.Count)), 280, () => Progress.ShowAchievements(ShowTitle), Progress.HasNew);
            MenuRow("bookmark", Loc.Tr("База знаний"), Loc.Tr("{a} из {b}", ("a", Progress.CodexCount), ("b", Progress.CodexTotal)), 218, () => Progress.ShowCodex(ShowTitle));
            MenuRow("ribbon", Loc.Tr("Магазин"), Loc.Tr("Герои и режим без рекламы"), 95, () => StoreScreen.Show(ShowTitle));
            MenuRow("hourglass", Loc.Tr("Статистика"), Progress.Stat("runs") > 0 ? Loc.Tr("Забегов: {a} · доставлено писем: {b}", ("a", Progress.Stat("runs")), ("b", Progress.Stat("wins"))) : Loc.Tr("Итоги твоих забегов"), 156, () => Progress.ShowStats(ShowTitle));
            var gloss = Ui.Push(Safe, Loc.Tr("Справочник"), () => Menus.ShowGlossary(ShowTitle), true, 17, 128, 42);
            ((RectTransform)gloss.transform).At(new Vector2(0.5f, 0f), new Vector2(-70, 36), new Vector2(130, 44));
            var sets = Ui.Push(Safe, Loc.Tr("Настройки"), () => Menus.ShowSettings(ShowTitle), true, 17, 128, 42);
            ((RectTransform)sets.transform).At(new Vector2(0.5f, 0f), new Vector2(70, 36), new Vector2(130, 44));
            if (save != null)
            {
                var hint = Ui.Label("savehint", Safe, Loc.Tr("Прогресс сохраняется после каждого уровня"), 12, new Color(1, 1, 1, 0.55f));
                hint.rectTransform.At(new Vector2(0.5f, 0f), new Vector2(0, 474), new Vector2(380, 18));
            }

            var ver = Ui.Label("version", Safe, "Unity " + Application.unityVersion + " · " + Loc.Lang, 11, new Color(1, 1, 1, 0.45f));
            ver.fontSize = 9;
            ver.rectTransform.At(new Vector2(0.5f, 0f), new Vector2(0, 6), new Vector2(380, 12));
        }

        // ================= кнопка «Назад» на Android =================
        bool tourAsked;
        int frames;

        void Update()
        {
            if (Input.GetKeyDown(KeyCode.Escape)) GoBack();
            // F9 в редакторе и в пробной сборке: снимки всех экранов в папку Screens (Tour.cs)
            if (Input.GetKeyDown(KeyCode.F9) && (Application.isEditor || Debug.isDebugBuild)) Tour.Start();
            // запуск с ключом -tour (снимки в GitHub): обход начинается сам, по окончании игра закрывается
            if (!tourAsked && Tour.Wanted)
            {
                if (frames++ == 0) Tour.Mark("first update");
                if (Time.realtimeSinceStartup > 4f || frames > 240) { tourAsked = true; Tour.Mark("start, frame " + frames); Tour.Start(); }
            }
        }

        /// <summary>Системная «Назад» (и Esc в редакторе) делает то же, что кнопка закрытия на экране: закрывает подсказку,
        /// верхнее окно («✕», «Назад», «Закрыть», «Отмена»), в забеге открывает паузу, на титуле выходит из игры.</summary>
        void GoBack()
        {
            if (Tip.Close()) return;
            for (var i = Top.childCount - 1; i >= 0; i--)
            {
                var c = Top.GetChild(i);
                if (!c.gameObject.activeInHierarchy) continue;
                if (c.name == "guard") return;                       // идёт переход: касания и «Назад» ждут
                if (c.name != "overlay" && c.name != "cinema") continue; // плашки сообщений и крупный показ не окна
                PressBack(c);                                         // окно без кнопки закрытия ждёт ответа игрока
                return;
            }
            if (RunFlow.Current != null) { Menus.ShowPause(); return; }
            if (PressBack(Safe)) return;                              // выбор героя, вступление
            if (screen && screen.name == "Title" && Application.platform == RuntimePlatform.Android) Application.Quit();
        }

        static bool PressBack(Transform root)
        {
            var words = new[] { "✕", Loc.Tr("Назад"), Loc.Tr("Закрыть"), Loc.Tr("Отмена"), Loc.Tr("Пропустить") };
            var buttons = root.GetComponentsInChildren<Button>(false);
            // крестик, нарисованный на рамке окна, — кнопка без текста с именем close
            foreach (var b in buttons)
                if (b.interactable && b.name == "close") { b.onClick.Invoke(); return true; }
            foreach (var w in words)
                foreach (var b in buttons)
                {
                    if (!b.interactable) continue;
                    foreach (var t in b.GetComponentsInChildren<Text>(false))
                        if (t.text == w) { b.onClick.Invoke(); return true; }
                }
            return false;
        }

        /// <summary>Герой на титуле (.title-hero): тот, кто идёт в сохранённом забеге, или выбранный в прошлый раз.
        /// Стоит между названием и кнопками, под ногами мягкая тень, чуть покачивается. С сохранением — поменьше.</summary>
        RectTransform TitleHero(string cls, bool small)
        {
            var art = Ui.Art("h/" + cls) ?? Ui.Art("h/lamp");
            if (!art) return null;
            float w = small ? 170 : 230, h = small ? 200 : 272, top = small ? 176 : 196;
            var box = Ui.Node("title hero", Safe);
            box.anchorMin = box.anchorMax = new Vector2(0.5f, 1);
            box.pivot = new Vector2(0.5f, 0);
            box.sizeDelta = new Vector2(w, h);
            box.anchoredPosition = new Vector2(0, -(top + h));
            var shade = Ui.Img("shade", box, Ui.Circle, new Color(0.086f, 0.055f, 0.2f, 0.5f));
            shade.rectTransform.At(new Vector2(0.5f, 0), new Vector2(0, 4), new Vector2(w * 0.72f, 20));
            var img = Ui.Img("hero", box, art, Color.white);
            img.preserveAspect = true;
            img.rectTransform.Fill();
            box.gameObject.AddComponent<HeroSway>();
            box.SetAsFirstSibling();   // кнопки и название — поверх героя
            // неподвижная метка линии ног: сама фигура поднимается и покачивается, фон за ней ходить не должен
            var mark = Ui.Node("feet", Safe);
            mark.anchorMin = mark.anchorMax = new Vector2(0.5f, 1);
            mark.pivot = new Vector2(0.5f, 0);
            mark.sizeDelta = new Vector2(w, 1);
            mark.anchoredPosition = new Vector2(0, -(top + h) + 6);
            mark.SetAsFirstSibling();
            return mark;
        }

        /// <summary>Заставка (первый запуск или «Посмотреть заставку» в настройках), потом титул.</summary>
        public void PlayCinema()
        {
            RunFlow.Drop();
            Clear();
            Corner("end");
            Cinema.Play(Defs, ShowTitle);
        }

        /// <summary>Страница вступления перед новым забегом (goIntro): картинка, название, рассказ и три правила.</summary>
        internal void ShowIntro(string cls, System.Action start)
        {
            Clear();
            Corner("heroes");
            screen = new GameObject("Intro");
            screen.transform.SetParent(transform, false);
            Background(Back, BgFor(Defs, 0));
            var col = Ui.Node("intro", Safe).Box(0, 84, 400, 760);
            col.Column(26, TextAnchor.UpperCenter);
            var page = Ui.Node("page", col);
            page.Column(9, TextAnchor.UpperCenter, 27, 27, 14, 20);
            // название стоит над картинкой (#app.skin .page h1 { order: -1 })
            Ui.Label("title", page, Defs.StoryStr("title") ?? "", 30, new Color32(0x5A, 0x2A, 0x26, 0xFF), TextAnchor.MiddleCenter, true).Pref(250);
            page.Pref(372);
            Ui.Frame(page, "ui2/parch", 0.47f, 4.7f, 35.7f, 4.7f, 8.5f);
            var brown = new Color32(0x5A, 0x2A, 0x26, 0xFF);
            // на картинке вступления нарисована Ива: другим героям вместо неё — сам герой
            var pic = cls == "lamp" ? Ui.Art("pic/story_intro") : null;
            var art = Ui.Node("art", page);
            art.Pref(318, 220);
            art.gameObject.AddComponent<RectMask2D>();
            var img = Ui.Img("pic", art, pic ? pic : Ui.Art("h/" + cls), Color.white);
            img.rectTransform.Fill();
            if (pic)
            {
                var fit = img.gameObject.AddComponent<AspectRatioFitter>();
                fit.aspectMode = AspectRatioFitter.AspectMode.EnvelopeParent;
                fit.aspectRatio = (float)pic.texture.width / pic.texture.height;
            }
            else img.preserveAspect = true;
            var story = Ui.Label("story", page, Defs.StoryHero("intro", cls) ?? "", 17, Ui.Ink, TextAnchor.UpperLeft);
            story.lineSpacing = 1.05f;
            story.Pref(318);
            var rules = new List<string>
            {
                Loc.Tr("<b>Огонёк.</b> Каждый даёт атакам +{b} урона. На {m} Огоньках лампа бьёт врага на {d}.", ("b", Balance.FlameBonus), ("m", Balance.FlameMax), ("d", Balance.BurstDmg)),
                Loc.Tr("<b>Меню</b> в углу: пауза, справочник и выход. Прогресс сохраняется сам."),
            };
            var path = Json.Str(Json.Get(Json.Obj(Json.Get(Json.Obj(Json.Get(Data.Raw, "storyText")), Defs.StoryId)), "pathRule"));
            if (path != null) rules.Add(path.Replace("{total}", Defs.MaxSteps.ToString()));
            foreach (var r in rules) Ui.Label("rule", page, "•  " + r, 15, Ui.Ink, TextAnchor.UpperLeft).Pref(318);
            Ui.Push(col, Loc.Tr("В путь"), () => { Sound.Sfx("click"); start(); }, false, 30, 178, 68);
        }

        /// <summary>Строка меню на титуле: значок, название и мелкая строка под ним; точка — есть новое.</summary>
        void MenuRow(string icon, string title, string sub, float y, System.Action onClick, bool dot = false)
        {
            var b = Ui.Push(Safe, "", () => { Sound.Sfx("click"); onClick(); }, true, 20, 270, 50);
            var rt = (RectTransform)b.transform;
            rt.At(new Vector2(0.5f, 0f), new Vector2(0, y), new Vector2(270, 50));
            var label = b.GetComponentInChildren<Text>();
            Ui.TwoLines(label, title, sub, 85, 14);
            var ic = Ui.Img("icon", rt, "r2/" + icon);
            ic.preserveAspect = true;
            ic.rectTransform.At(new Vector2(0, 0.5f), new Vector2(56, 0), new Vector2(38, 38));
            if (dot)
            {
                var d = Ui.Img("newdot", rt, Ui.Circle, Ui.Red);
                d.rectTransform.At(new Vector2(1, 1), new Vector2(-8, -8), new Vector2(12, 12));
            }
        }

        /// <summary>Новая игра поверх сохранения: сначала спросить, ведь сохранённый забег пропадёт.</summary>
        void AskNewGame(SaveFile save)
        {
            var layer = Overlay.Open(out var root);
            var col = Ui.Node("ask", root).Box(26, 250, 348, 320);
            col.Column(14, TextAnchor.MiddleCenter, 24, 24, 50, 30);
            Ui.Frame(col, "ui2/panel", 0.494f, 2, 49, 2, 10);
            Ui.Label("title", col, Loc.Tr("Начать заново?"), 26, new Color32(0xFF, 0xE2, 0xA0, 0xFF), TextAnchor.MiddleCenter, true).Shadow(2f).Pref(290, 36);
            Ui.Label("hint", col, Loc.Tr("Сохранённый забег на уровне {n} из {total} будет потерян.", ("n", save.Run.Step + 1), ("total", Defs.MaxSteps)), 17, Ui.Paper).Pref(290);
            Ui.Push(col, Loc.Tr("Начать заново"), () => { Destroy(layer); ShowHeroes(); }, false, 20, 220, 52);
            Ui.Push(col, Loc.Tr("Отмена"), () => Destroy(layer), true, 18, 160, 46);
        }

        public void ShowHeroes()
        {
            Clear();
            Corner("heroes");
            screen = HeroSelect.Show(Data, Defs, Settings.Cls, Settings.Diff, (cls, diff) =>
            {
                Settings.Cls = cls;
                Settings.Diff = diff;
                Clear();
                // страница вступления перед первым шагом; в настройках её можно пропускать
                if (Settings.SkipIntro) new RunFlow(Defs, cls, diff).Start();
                else ShowIntro(cls, () => { Clear(); new RunFlow(Defs, cls, diff).Start(); });
            }, ShowTitle).gameObject;
        }

        void OnApplicationPause(bool paused)
        {
            AudioListener.pause = paused;
            if (paused) { RunFlow.Current?.SaveNow(); Progress.Flush(); }
        }

        void OnApplicationQuit()
        {
            RunFlow.Current?.SaveNow();
            Progress.Flush();
        }
    }
}

namespace Fitil.Game
{
    /// <summary>Герой на титуле поднимается на место и тихо покачивается (rise и herosway в css/style.css).</summary>
    public sealed class HeroSway : MonoBehaviour
    {
        RectTransform rt;
        CanvasGroup cg;
        Vector2 home;
        float age;

        void Awake()
        {
            rt = (RectTransform)transform;
            cg = gameObject.AddComponent<CanvasGroup>();
            cg.blocksRaycasts = false;
            cg.alpha = 0;
        }

        void Start() => home = rt.anchoredPosition;

        void Update()
        {
            age += Time.unscaledDeltaTime;
            // rise: 0,6 с после короткой задержки
            var k = Mathf.Clamp01((age - 0.1f) / 0.6f);
            var e = 1 - (1 - k) * (1 - k);
            cg.alpha = e;
            rt.anchoredPosition = home + new Vector2(0, -40 * (1 - e));
            // herosway: ±0,6° за 5,2 с вокруг ступней
            var sway = age > 0.7f ? Mathf.Cos((age - 0.7f) / 5.2f * Mathf.PI * 2) : 1f;
            rt.localRotation = Quaternion.Euler(0, 0, 0.6f * sway);
        }
    }
}
