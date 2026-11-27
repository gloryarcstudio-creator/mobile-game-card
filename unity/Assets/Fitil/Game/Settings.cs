// Настройки игрока (SETTINGS в game.js), там же, где в веб-версии: lastray.settings.
// Поля, которых Unity не знает, при записи сохраняются как были.
using System;
using System.Collections.Generic;
using Fitil.Core;
using Fitil.Platform;

namespace Fitil.Game
{
    public static class Settings
    {
        public const string Key = "lastray.settings";
        static Dictionary<string, object> raw;

        /// <summary>Пропускать вступление.</summary>
        public static bool SkipIntro { get => Get("skipIntro", false); set => Set("skipIntro", value); }
        /// <summary>Быстрые анимации: паузы боя и движения вдвое короче.</summary>
        public static bool Fast { get => Get("fast", false); set => Set("fast", value); }
        /// <summary>Снегопад на экранах.</summary>
        public static bool Snow { get => Get("snow", true); set => Set("snow", value); }
        /// <summary>Карта разыгрывается с одного касания.</summary>
        public static bool OneTap { get => Get("oneTap", false); set => Set("oneTap", value); }
        /// <summary>Реплики врагов в бою.</summary>
        public static bool Lines { get => Get("lines", true); set => Set("lines", value); }

        /// <summary>Скорость нарисованных движений и эффектов.</summary>
        public static float AnimSpeed => Fast ? 2 : 1;

        static Dictionary<string, object> Raw
        {
            get
            {
                if (raw != null) return raw;
                try { raw = Json.Obj(Json.Parse(SaveStore.Read(Key) ?? "{}")); }
                catch (Exception) { raw = null; }
                if (raw == null) raw = new Dictionary<string, object>();
                return raw;
            }
        }

        /// <summary>Последний выбранный герой (картинка «h» у достижений, выбор героя).</summary>
        public static string Cls
        {
            get => Json.Str(Json.Get(Raw, "cls"), "lamp");
            set => SetRaw("cls", value);
        }

        /// <summary>Последняя выбранная сложность (0..4, по умолчанию «Обычный маршрут»).</summary>
        public static int Diff
        {
            get => Json.Int(Json.Get(Raw, "diff"), 1);
            set => SetRaw("diff", (double)value);
        }

        public static string Lang
        {
            get => Json.Str(Json.Get(Raw, "lang"));
            set => SetRaw("lang", value);
        }

        static bool Get(string key, bool def) => Raw.TryGetValue(key, out var v) && v is bool b ? b : def;
        static void Set(string key, bool v) => SetRaw(key, v);

        static void SetRaw(string key, object v)
        {
            Raw[key] = v;
            SaveStore.Write(Key, Json.Write(Raw));
        }
    }
}
