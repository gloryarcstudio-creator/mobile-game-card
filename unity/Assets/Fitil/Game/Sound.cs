// Музыка и звуки (js/audio.js). Музыка — готовые дорожки Resources/Audio/Music (их копирует
// tools/unity/export_assets.py из assets/m<N>/): вступление, потом петля, границы петли в loops.json.
// Петля склеивается без щелчка: два источника по очереди, каждый ставится в расписание звуковой карты.
// Звуки — Resources/Audio/Sfx/<имя>.ogg: те же синтезированные звуки веб-версии, записанные заранее
// (tools/unity/render_sfx.js). Громкость музыки и звуков хранится там же, где в веб-версии (last-ray-audio).
using System;
using System.Collections.Generic;
using Fitil.Core;
using Fitil.Platform;
using UnityEngine;

namespace Fitil.Game
{
    public sealed class Sound : MonoBehaviour
    {
        static Sound I;
        const string Key = "last-ray-audio";
        // громкость дорожек из файлов в веб-версии: шина файлов 0,7 × шина музыки 0,5 × общая 0,9
        const float MusicGain = 0.7f * 0.5f * 0.9f;
        // темы меню и дороги после боя продолжаются с того же места, бой каждый раз начинается сначала
        static readonly HashSet<string> Resume = new HashSet<string> { "title", "stage1", "stage2", "night" };

        float musicVol = 1, sfxVol = 1;
        Dictionary<string, Vector2> loops;
        readonly Dictionary<string, double> pos = new Dictionary<string, double>();
        readonly Dictionary<string, AudioClip> sfx = new Dictionary<string, AudioClip>();
        readonly List<Voice> voices = new List<Voice>();
        AudioSource oneShot;
        string current;

        public static float MusicVolume => I ? I.musicVol : 1;
        public static float SfxVolume => I ? I.sfxVol : 1;

        public static void Init(GameObject host)
        {
            if (I) return;
            I = host.AddComponent<Sound>();
            I.Load();
        }

        void Load()
        {
            oneShot = gameObject.AddComponent<AudioSource>();
            oneShot.playOnAwake = false;
            var json = SaveStore.Read(Key);
            if (json != null)
            {
                try
                {
                    var o = Json.Obj(Json.Parse(json));
                    musicVol = Mathf.Clamp01((float)Json.Num(Json.Get(o, "musicVol"), 1));
                    sfxVol = Mathf.Clamp01((float)Json.Num(Json.Get(o, "sfxVol"), 1));
                }
                catch (Exception) { /* испорченные настройки звука: громкость по умолчанию */ }
            }
            loops = new Dictionary<string, Vector2>();
            var lj = Resources.Load<TextAsset>("Audio/Music/loops");
            if (lj)
                foreach (var kv in Json.Obj(Json.Parse(lj.text)))
                {
                    var a = Json.Arr(kv.Value);
                    if (a != null && a.Count == 2) loops[kv.Key] = new Vector2((float)Json.Num(a[0]), (float)Json.Num(a[1]));
                }
        }

        // ================= звуки =================
        /// <summary>Звук по имени из js/audio.js. v — сила (удары), 1 — обычная.</summary>
        public static void Sfx(string name, float v = 1)
        {
            if (!I || I.sfxVol <= 0 || string.IsNullOrEmpty(name)) return;
            if (!I.sfx.TryGetValue(name, out var clip))
            {
                clip = Resources.Load<AudioClip>("Audio/Sfx/" + name);
                I.sfx[name] = clip;
            }
            if (clip) I.oneShot.PlayOneShot(clip, Mathf.Clamp(v, 0, 1.4f) * I.sfxVol);
        }

        // эффект боя (js/fx.js) и его звук
        static readonly Dictionary<string, string> FxSound = new Dictionary<string, string>
        {
            ["lantern"] = "lantern", ["bonk"] = "bonk", ["heavy"] = "thud", ["flour"] = "thud", ["slash"] = "slash", ["sparks"] = "sparks",
            ["fire"] = "fire", ["burnApply"] = "fire", ["snow"] = "snow", ["snowball"] = "snow", ["blizzard"] = "snow", ["avalanche"] = "snow",
            ["icicle"] = "ice", ["shatter"] = "ice", ["stamp"] = "stamp", ["letter"] = "paper+bonk@0.7", ["arrive"] = "paper+bonk@0.7",
            ["starfall"] = "star", ["beam"] = "beam", ["roots"] = "root", ["coin"] = "coin+bonk", ["confetti"] = "fair+bonk",
            ["crumbs"] = "crunch+bonk", ["ink"] = "splat", ["spikes"] = "thorns+bonk", ["weak"] = "weak", ["vuln"] = "crack",
            ["frost"] = "frost", ["sleep"] = "sleep", ["energy"] = "zap", ["aura"] = "aura", ["thorns"] = "thorns", ["gold"] = "coin",
            ["loot"] = "coin", ["triumph"] = "fair+coin", ["find"] = "sigil", ["deliver"] = "paper", ["sigil"] = "sigil", ["clock"] = "chime",
            ["mirror"] = "mirror", ["cards"] = "paper", ["ginger"] = "oven", ["sugar"] = "sugar", ["grind"] = "grind", ["rage"] = "growl",
            ["growl"] = "growl", ["bite"] = "bark+bite", ["price"] = "heartbeat", ["steam"] = "sip", ["wind"] = "wind", ["parcel"] = "paper",
        };

        public static void Fx(string kind)
        {
            if (kind == null || !FxSound.TryGetValue(kind, out var list)) return;
            foreach (var part in list.Split('+'))
            {
                var at = part.IndexOf('@');
                if (at < 0) Sfx(part);
                else Sfx(part.Substring(0, at), float.Parse(part.Substring(at + 1), System.Globalization.CultureInfo.InvariantCulture));
            }
        }

        // ================= музыка =================
        /// <summary>Сменить дорожку: прежняя тает, новая начинается (темы дороги — с того же места). null — тишина.</summary>
        public static void Music(string name)
        {
            if (!I || name == I.current) return;
            I.current = name;
            for (var i = 0; i < I.voices.Count; i++)
            {
                var v = I.voices[i];
                if (v.Fading) continue;
                if (Resume.Contains(v.Name)) I.pos[v.Name] = v.Where(AudioSettings.dspTime);
                v.FadeOut(name == null ? 1.2f : 0.6f);
            }
            if (name == null) return;
            var clip = Resources.Load<AudioClip>("Audio/Music/" + name);
            if (!clip) return;
            var loop = I.loops.TryGetValue(name, out var l) ? l : new Vector2(0, clip.length);
            var a = (double)loop.x;
            var b = Math.Min((double)loop.y, clip.length);
            if (!(a < b)) { a = 0; b = clip.length; }
            var off = Resume.Contains(name) && I.pos.TryGetValue(name, out var p) && p < b ? p : 0;
            I.voices.Add(new Voice(I.gameObject, name, clip, a, b, off, off > 0 ? 0.8f : 0.04f));
        }

        public static void SetVolume(string kind, float v)
        {
            if (!I) return;
            v = Mathf.Clamp01(v);
            if (kind == "music") I.musicVol = v; else I.sfxVol = v;
            SaveStore.Write(Key, Json.Write(new Dictionary<string, object> { ["musicVol"] = (double)I.musicVol, ["sfxVol"] = (double)I.sfxVol }));
        }

        void Update()
        {
            var now = AudioSettings.dspTime;
            for (var i = voices.Count - 1; i >= 0; i--)
                if (!voices[i].Tick(now, musicVol * MusicGain)) { voices[i].Dispose(); voices.RemoveAt(i); }
        }

        /// <summary>Дорожка: вступление и петля [A, B). Два источника по очереди: пока один доигрывает до B,
        /// второй уже стоит в расписании с A, поэтому шов не зависит от кадров.</summary>
        sealed class Voice
        {
            public readonly string Name;
            readonly AudioSource[] src = new AudioSource[2];
            readonly double a, b;
            readonly double t0, off;          // когда и с какого места дорожка началась
            double segEnd;                    // конец уже поставленного в расписание куска
            int next;                         // какой источник ставить следующим
            float gain, target = 1, rate;     // плавное появление и угасание
            public bool Fading;

            public Voice(GameObject host, string name, AudioClip clip, double a, double b, double off, float fadeIn)
            {
                Name = name;
                this.a = a;
                this.b = b;
                this.off = off;
                for (var i = 0; i < 2; i++)
                {
                    src[i] = host.AddComponent<AudioSource>();
                    src[i].clip = clip;
                    src[i].playOnAwake = false;
                    src[i].volume = 0;
                }
                t0 = AudioSettings.dspTime + 0.05;
                src[0].time = (float)off;
                src[0].PlayScheduled(t0);
                segEnd = t0 + (b - off);
                src[0].SetScheduledEndTime(segEnd);
                next = 1;
                rate = 1 / Mathf.Max(0.01f, fadeIn);
            }

            /// <summary>Место в файле, которое звучит в момент now.</summary>
            public double Where(double now)
            {
                var p = off + Math.Max(0, now - t0);
                return p < b ? p : a + ((p - a) % (b - a));
            }

            public void FadeOut(float s)
            {
                Fading = true;
                target = 0;
                rate = 1 / Mathf.Max(0.01f, s);
            }

            /// <summary>false — дорожка отзвучала.</summary>
            public bool Tick(double now, float vol)
            {
                // следующий круг петли ставится в расписание заранее, за две секунды до шва
                if (!Fading && segEnd - now < 2)
                {
                    var s = src[next];
                    s.time = (float)a;
                    s.PlayScheduled(segEnd);
                    s.SetScheduledEndTime(segEnd + (b - a));
                    segEnd += b - a;
                    next ^= 1;
                }
                gain = Mathf.MoveTowards(gain, target, rate * Time.unscaledDeltaTime);
                foreach (var s in src) s.volume = gain * vol;
                return !(Fading && gain <= 0.0001f);
            }

            public void Dispose()
            {
                foreach (var s in src) { if (s) { s.Stop(); UnityEngine.Object.Destroy(s); } }
            }
        }
    }
}
