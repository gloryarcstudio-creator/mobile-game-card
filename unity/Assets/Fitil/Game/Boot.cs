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
            Application.targetFrameRate = Mathf.Max(60, (int)Screen.currentResolution.refreshRateRatio.value);
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

        // Временный титульный экран каркаса: фон заставки, название и строка о версии.
        void ShowTitle()
        {
            var bg = Ui.Img("bg_title", Back, Ui.Art("bg/bg_title"), Color.white);
            bg.rectTransform.Fill();
            if (bg.sprite)
            {
                var fit = bg.gameObject.AddComponent<AspectRatioFitter>();
                fit.aspectMode = AspectRatioFitter.AspectMode.EnvelopeParent;
                fit.aspectRatio = (float)bg.sprite.texture.width / bg.sprite.texture.height;
            }
            else bg.color = Ui.Night;

            var story = Json.Obj(Json.Get(Json.Obj(Data.Story["STORIES"]), "sunset"));
            var title = Ui.Label("title", Safe, Json.Str(Json.Get(story, "title"), "Последний луч"), 40, Ui.Gold);
            title.fontStyle = FontStyle.Bold;
            title.rectTransform.At(new Vector2(0.5f, 1f), new Vector2(0, -90), new Vector2(380, 60));

            var note = Ui.Label("note", Safe, Loc.Tr("Новая игра"), 20, Ui.Gold);
            note.rectTransform.At(new Vector2(0.5f, 0f), new Vector2(0, 120), new Vector2(380, 40));

            var ver = Ui.Label("version", Safe, "Unity " + Application.unityVersion + " · " + Loc.Lang, 12, new Color(1, 1, 1, 0.6f));
            ver.rectTransform.At(new Vector2(0.5f, 0f), new Vector2(0, 16), new Vector2(380, 20));
        }

        void OnApplicationPause(bool paused) => AudioListener.pause = paused;
    }
}
