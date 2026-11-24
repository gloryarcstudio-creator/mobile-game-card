// Запуск игры. Сцена одна и пустая: всё создаётся кодом, поэтому проект можно собирать
// и проверять без ручной работы в редакторе. Этот файл — каркас: данные, язык, экран
// и безопасная зона. Экраны игры появляются по этапам плана переноса.
using System.Collections.Generic;
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

            LoadLanguage();
            BuildCanvas();
            ShowTitle();
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

            var canvasGo = new GameObject("Canvas", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
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
            Safe = Ui.Node("Safe", canvasGo.transform).Fill();
            Safe.gameObject.AddComponent<SafeArea>();
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
        public static string BgFor(Defs defs, int step)
        {
            if (defs.Stages.Count > 1 && defs.IsFinalStep(step)) return "bg/bg_final_house";
            var si = Mathf.Max(0, defs.StageOf(step));
            var g = defs.Stages[si];
            var t = g.Len > 1 ? (float)(step - g.Start) / (g.Len - 1) : 1;
            if (g.Scene == "outskirts" || si > 0) return t < 0.34f ? "bg/bg_stage2_outskirts_start" : t < 0.67f ? "bg/bg_stage2_outskirts_mid" : "bg/bg_stage2_outskirts_night";
            return t < 0.34f ? "bg/bg_stage1_town_day" : t < 0.67f ? "bg/bg_stage1_town_mid" : "bg/bg_stage1_town_sunset";
        }

        void Clear()
        {
            if (screen) Destroy(screen);
            screen = null;
            Ui.Clear(Back);
            Ui.Clear(Safe);
            for (var i = transform.childCount - 1; i >= 0; i--)
            {
                var c = transform.GetChild(i);
                if (c.GetComponent<CombatScreen>() || c.GetComponent<HeroSelect>()) Destroy(c.gameObject);
            }
        }

        /// <summary>Титульный экран: заставка, нарисованное название и «Новая игра».</summary>
        public void ShowTitle()
        {
            Clear();
            screen = new GameObject("Title");
            screen.transform.SetParent(transform, false);
            Background(Back, "bg/bg_title");

            var logo = Ui.Art("ui2/logo_" + Loc.Lang) ?? Ui.Art("ui2/logo_ru");
            if (logo)
            {
                var img = Ui.Img("logo", Safe, logo, Color.white);
                img.preserveAspect = true;
                img.rectTransform.At(new Vector2(0.5f, 1f), new Vector2(0, -110), new Vector2(360, 160));
            }
            else
            {
                var story = Json.Obj(Json.Get(Json.Obj(Data.Story["STORIES"]), "sunset"));
                var title = Ui.Label("title", Safe, Json.Str(Json.Get(story, "title"), "Последний луч"), 40, Ui.Gold, TextAnchor.MiddleCenter, true);
                title.rectTransform.At(new Vector2(0.5f, 1f), new Vector2(0, -90), new Vector2(380, 60));
            }

            var play = Ui.Btn("new", Safe, Loc.Tr("Новая игра"), ShowHeroes, 24);
            ((RectTransform)play.transform).At(new Vector2(0.5f, 0f), new Vector2(0, 150), new Vector2(240, 64));

            var ver = Ui.Label("version", Safe, "Unity " + Application.unityVersion + " · " + Loc.Lang, 12, new Color(1, 1, 1, 0.6f));
            ver.rectTransform.At(new Vector2(0.5f, 0f), new Vector2(0, 16), new Vector2(380, 20));
        }

        void ShowHeroes()
        {
            Clear();
            screen = HeroSelect.Show(Data, cls =>
            {
                Clear();
                new RunFlow(Defs, cls).Start();
            }, ShowTitle).gameObject;
        }

        void OnApplicationPause(bool paused) => AudioListener.pause = paused;
    }
}
