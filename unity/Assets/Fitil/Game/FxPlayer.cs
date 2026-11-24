// Нарисованные эффекты боя (P в js/fx.js): удары, огонь, снег, снаряды, лечение, награды.
// Ролики — Art/fx/<имя>.png (атлас кадров fs×fs по cols в ряд) и Art/fx/fx.json, их делает tools/unity/export_assets.py.
// Координаты как в вебе: логический экран, x слева, y сверху; точки целей берутся с настоящих рамок экрана.
// Play возвращает, через сколько секунд наступает удар (снаряд долетел): бой ждёт этого, как await FX.play.
using System;
using System.Collections;
using System.Collections.Generic;
using Fitil.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Fitil.Game
{
    public sealed class FxPlayer : MonoBehaviour
    {
        /// <summary>Точка цели: середина, величина, линия ног (у врага).</summary>
        public struct Spot
        {
            public float X, Y, W, H, Foot;   // Foot < 0 — нет
            public Spot(float x, float y, float w = 80, float h = 80, float foot = -1) { X = x; Y = y; W = w; H = h; Foot = foot; }
            public Vector2 P => new Vector2(X, Y);
        }

        static Dictionary<string, object> meta;
        static int fs = 200, cols = 5;
        static float baseLine = 0.92f;
        static readonly Dictionary<string, Texture2D> clips = new Dictionary<string, Texture2D>();
        static readonly Dictionary<string, int> frames = new Dictionary<string, int>();

        RectTransform layer;
        /// <summary>Рамки целей: enemy, hero, energy, lamp, hand.</summary>
        public readonly Dictionary<string, RectTransform> Targets = new Dictionary<string, RectTransform>();
        /// <summary>Встряска зоны врага (сила 1 — 6 точек).</summary>
        public Action<float> Shake;
        /// <summary>Окраска врага на время: burning, frosty, withered.</summary>
        public Action<string, float> Tint;
        /// <summary>2 — ускоренный бой: всё вдвое быстрее.</summary>
        public float Speed = 1;
        readonly System.Random rnd = new System.Random();

        public static FxPlayer On(RectTransform layer)
        {
            var p = layer.gameObject.AddComponent<FxPlayer>();
            p.layer = layer;
            Load();
            return p;
        }

        static void Load()
        {
            if (meta != null) return;
            var ta = Resources.Load<TextAsset>("Art/fx/fx");
            meta = ta ? Json.Obj(Json.Parse(ta.text)) : new Dictionary<string, object>();
            fs = Json.Int(Json.Get(meta, "fs"), 200);
            cols = Json.Int(Json.Get(meta, "cols"), 5);
            baseLine = 1 - (float)Json.Num(Json.Get(meta, "pad"), 0.08);
            var cl = Json.Obj(Json.Get(meta, "clips"));
            if (cl != null) foreach (var kv in cl) frames[kv.Key] = Json.Int(kv.Value, 1);
        }

        static Texture2D Clip(string name)
        {
            if (clips.TryGetValue(name, out var t) && t) return t;
            t = frames.ContainsKey(name) ? Resources.Load<Texture2D>("Art/fx/" + name) : null;
            if (t) t.wrapMode = TextureWrapMode.Clamp;
            clips[name] = t;
            return t;
        }

        float R(float a, float b) => a + (float)rnd.NextDouble() * (b - a);
        float K => 1 / Mathf.Max(0.1f, Speed);
        WaitForSeconds Wait(float ms) => new WaitForSeconds(ms / 1000f * K);

        // ================= точки =================
        Spot Anchor(string t)
        {
            if (t != null && Targets.TryGetValue(t, out var rt) && rt && rt.gameObject.activeInHierarchy)
            {
                var b = Rect(rt);
                if (t == "enemy") { b.Y += 6; b.Foot = b.Y + b.H / 2 - 16; }
                return b;
            }
            if (t == "hand") return new Spot(200, Height - 220, 300, 120);
            if (t == "enemy") return new Spot(200, 260, 240, 240, 370);
            return new Spot(200, 470, 200, 200);
        }

        float Height => layer ? layer.rect.height : 860;

        // рамка в координатах слоя: x слева, y сверху
        Spot Rect(RectTransform rt)
        {
            var c = new Vector3[4];
            rt.GetWorldCorners(c);
            var r = layer.rect;
            var a = layer.InverseTransformPoint(c[0]);
            var b = layer.InverseTransformPoint(c[2]);
            return new Spot((a.x + b.x) / 2 - r.xMin, r.yMax - (a.y + b.y) / 2, Mathf.Abs(b.x - a.x), Mathf.Abs(b.y - a.y));
        }

        static Spot Feet(Spot a) => new Spot(a.X, (a.Foot >= 0 ? a.Foot : a.Y + 60) + 8);
        static Spot At(float x, float y) => new Spot(x, y);
        static Spot Off(Spot a, float dx, float dy) => new Spot(a.X + dx, a.Y + dy, a.W, a.H, a.Foot);

        // ================= ролик =================
        sealed class Opt
        {
            public float Ay = -1, Dur, Delay, Dx, Dy, Rot;
            public bool Flip, FlipY, Loop;
            public Color Color = Color.white;
        }

        static int Natural(int n) => n >= 12 ? n * 42 : n * 68;   // длительность ролика, если не задана, мс

        /// <summary>Ролик name в точке at стороной w (put в fx.js). null — ролика нет.</summary>
        RectTransform Put(string name, Spot at, float w, Opt o = null)
        {
            o = o ?? new Opt();
            var sp = Sprite(name, w, o);
            if (!sp) return null;
            sp.anchoredPosition = new Vector2(at.X + o.Dx, -(at.Y + o.Dy));
            var n = frames.TryGetValue(name, out var f) ? f : 1;
            var life = (o.Delay + (o.Dur > 0 ? o.Dur : Natural(n)) + 120) / 1000f * K;
            Destroy(sp.gameObject, life);
            return sp;
        }

        /// <summary>Рисунок ролика: квадрат w×w, точка на середине (или на доле ay от верха), кадры смешиваются.</summary>
        RectTransform Sprite(string name, float w, Opt o)
        {
            var tex = Clip(name);
            if (!tex) return null;
            var go = new GameObject("fx " + name, typeof(RectTransform));
            var rt = (RectTransform)go.transform;
            rt.SetParent(layer, false);
            rt.anchorMin = rt.anchorMax = new Vector2(0, 1);
            rt.pivot = new Vector2(0.5f, o.Ay >= 0 ? 1 - o.Ay : 0.5f);
            rt.sizeDelta = new Vector2(w, w);
            var inner = Ui.Node("turn", rt);
            inner.Fill();
            inner.localRotation = Quaternion.Euler(0, 0, -o.Rot);
            inner.localScale = new Vector3(o.Flip ? -1 : 1, o.FlipY ? -1 : 1, 1);
            var a = Layer(inner, "a", tex);
            var b = Layer(inner, "b", tex);
            var n = frames.TryGetValue(name, out var f) ? f : 1;
            StartCoroutine(Run(a, b, tex, n, o));
            return rt;
        }

        static RawImage Layer(RectTransform parent, string name, Texture2D tex)
        {
            var r = new GameObject(name, typeof(RectTransform)).AddComponent<RawImage>();
            r.rectTransform.SetParent(parent, false);
            r.rectTransform.Fill();
            r.texture = tex;
            r.raycastTarget = false;
            r.enabled = false;
            return r;
        }

        static void Frame(RawImage r, Texture2D tex, int i, float alpha, Color c)
        {
            var col = i % cols;
            var row = i / cols;
            r.uvRect = new Rect(col * fs / (float)tex.width, 1 - (row + 1) * fs / (float)tex.height, fs / (float)tex.width, fs / (float)tex.height);
            r.color = new Color(c.r, c.g, c.b, alpha * c.a);
            r.enabled = alpha > 0.004f;
        }

        // один проигрыватель кадров: соседние кадры смешиваются, последний растворяется в пустоту
        IEnumerator Run(RawImage a, RawImage b, Texture2D tex, int n, Opt o)
        {
            if (n <= 1) { Frame(a, tex, 0, 1, o.Color); yield break; }
            var t0 = Time.time + o.Delay / 1000f * K;
            var dur = Mathf.Max(80, o.Dur > 0 ? o.Dur : Natural(n)) / 1000f * K;
            while (a)
            {
                var p = (Time.time - t0) / dur;
                if (p < 0) { yield return null; continue; }
                if (!o.Loop && p >= 1) { a.enabled = b.enabled = false; yield break; }
                var fl = (o.Loop ? p % 1 : p) * n;
                var i = Mathf.Min(n - 1, Mathf.FloorToInt(fl));
                // у коротких раскадровок соседние кадры — разные рисунки: кадр держится и лишь под конец переходит в следующий
                var k = n < 12 ? (o.Loop ? 0 : Mathf.Max(0, (fl - i - 0.5f) / 0.5f)) : fl - i;
                var j = o.Loop ? (i + 1) % n : i + 1;
                if (j < n && k > 0.02f)
                {
                    Frame(a, tex, i, 1, o.Color);
                    Frame(b, tex, j, k, o.Color);
                }
                else
                {
                    Frame(a, tex, i, j < n ? 1 : 1 - k, o.Color);
                    b.enabled = false;
                }
                yield return null;
            }
        }

        // ================= снаряд =================
        sealed class FlyOpt
        {
            public float Arc, Spin, R0, Linger = 160, Ox, Oy;
            public bool Aim;
        }

        /// <summary>Снаряд от одной точки к другой (fly в fx.js): дуга, поворот, остриём в цель.</summary>
        IEnumerator Fly(string clip, float w, Opt so, Spot from, Spot to, float ms, FlyOpt o)
        {
            var tx = to.X + o.Ox;
            var ty = to.Y + o.Oy;
            var dx = tx - from.X;
            var dy = ty - from.Y;
            var ang = o.Aim ? Mathf.Atan2(dy, dx) * Mathf.Rad2Deg : 0;
            var r0 = o.Aim ? ang : o.R0;
            var r1 = o.Aim ? ang : o.Spin;
            var sp = Sprite(clip, w, so);
            var dur = ms / 1000f * K;
            if (sp)
            {
                sp.anchoredPosition = new Vector2(from.X, -from.Y);
                Destroy(sp.gameObject, dur + o.Linger / 1000f);
                StartCoroutine(Move(sp, from, dx, dy, o.Arc, r0, r1, dur));
            }
            yield return new WaitForSeconds(dur);
        }

        static IEnumerator Move(RectTransform sp, Spot from, float dx, float dy, float arc, float r0, float r1, float dur)
        {
            for (var t = 0f; ; t += Time.deltaTime)
            {
                if (!sp) yield break;
                var p = Mathf.Clamp01(t / dur);
                // как @keyframes fxproj: две половины пути, у каждой своё смягчение (.4, .1, .7, 1)
                float x, y, r, s;
                if (p < 0.5f)
                {
                    var e = Ease(p / 0.5f);
                    x = dx * 0.5f * e; y = (dy * 0.5f - arc) * e; r = Mathf.Lerp(r0, (r0 + r1) / 2, e); s = Mathf.Lerp(0.7f, 1, e);
                }
                else
                {
                    var e = Ease((p - 0.5f) / 0.5f);
                    x = Mathf.Lerp(dx * 0.5f, dx, e); y = Mathf.Lerp(dy * 0.5f - arc, dy, e); r = Mathf.Lerp((r0 + r1) / 2, r1, e); s = 1;
                }
                sp.anchoredPosition = new Vector2(from.X + x, -(from.Y + y));
                sp.localRotation = Quaternion.Euler(0, 0, -r);
                sp.localScale = Vector3.one * s;
                if (p >= 1) yield break;
                yield return null;
            }
        }

        // cubic-bezier(.4, .1, .7, 1)
        static float Ease(float x)
        {
            const float x1 = 0.4f, y1 = 0.1f, x2 = 0.7f, y2 = 1f;
            float t = x;
            for (var i = 0; i < 8; i++)
            {
                var cx = Bez(t, x1, x2) - x;
                var d = BezD(t, x1, x2);
                if (Mathf.Abs(cx) < 1e-4f || Mathf.Abs(d) < 1e-6f) break;
                t = Mathf.Clamp01(t - cx / d);
            }
            return Bez(t, y1, y2);
        }

        static float Bez(float t, float a, float b) => 3 * a * (1 - t) * (1 - t) * t + 3 * b * (1 - t) * t * t + t * t * t;
        static float BezD(float t, float a, float b) => 3 * a * (1 - t) * (1 - t) + 6 * (b - a) * (1 - t) * t + 3 * (1 - b) * t * t;

        // ================= эффекты =================
        // через сколько миллисекунд наступает удар (await внутри P[kind]); у остальных — сразу
        static readonly Dictionary<string, int> HitMs = new Dictionary<string, int>
        {
            ["slash"] = 120, ["snowball"] = 300, ["blizzard"] = 200, ["avalanche"] = 300, ["icicle"] = 240, ["stamp"] = 120,
            ["letter"] = 320, ["arrive"] = 320, ["starfall"] = 400, ["beam"] = 260, ["roots"] = 260, ["coin"] = 300,
            ["flamelet"] = 300, ["deliver"] = 520, ["bite"] = 410,
        };

        /// <summary>Эффект kind над целью target (enemy, hero, c:<карта>, null). Возвращает секунды до удара.</summary>
        public float Play(string kind, string target)
        {
            if (string.IsNullOrEmpty(kind)) return 0;
            IEnumerator co;
            try { co = Effect(kind, target); }
            catch (Exception e) { Debug.LogWarning("fx " + kind + ": " + e.Message); co = null; }
            if (co == null) { Sound.Fx(kind); return 0; }
            StartCoroutine(Safe(co));
            return HitMs.TryGetValue(kind, out var ms) ? ms / 1000f * K : 0;
        }

        /// <summary>Эффект в точке экрана (x слева, y сверху), например над сундуком; foot — линия, на которой стоят ролики «на земле».</summary>
        public void PlayAt(string kind, float x, float y, float w = 80, float h = 80, float foot = -1)
        {
            var co = Effect(kind, null, new Spot(x, y, w, h, foot));
            if (co == null) { Sound.Fx(kind); return; }
            StartCoroutine(Safe(co));
        }

        // анимация не должна ломать бой
        IEnumerator Safe(IEnumerator co)
        {
            while (true)
            {
                object cur;
                try
                {
                    if (!co.MoveNext()) yield break;
                    cur = co.Current;
                }
                catch (Exception e) { Debug.LogWarning("fx: " + e.Message); yield break; }
                yield return cur;
            }
        }

        static Opt O(float dur = 0, float dx = 0, float dy = 0, float ay = -1, float delay = 0) => new Opt { Dur = dur, Dx = dx, Dy = dy, Ay = ay, Delay = delay };

        void Sfx(string n, float v = 1) => Sound.Sfx(n, v);
        void DoShake(float p) => Shake?.Invoke(p);
        void DoTint(string c, float ms) => Tint?.Invoke(c, ms / 1000f * K);

        IEnumerator Effect(string kind, string t, Spot? at = null)
        {
            Spot A(string def = null) => at ?? Anchor(t ?? def);
            switch (kind)
            {
                case "lantern": return One(() => { Put("lantern", A(), 220, O(600)); Sfx("lantern"); DoShake(0.6f); });
                case "bonk": return One(() => { Put("bonk", A(), 230, O(480, R(-14, 14), R(-24, 10))); Sfx("bonk"); DoShake(0.5f); });
                case "heavy": return One(() => { Put("heavy", A(), 280, O(640, 0, -10)); Sfx("thud"); DoShake(1.4f); });
                case "slash": return Slash(A());
                case "sparks": return One(() => { Put("sparks", A(), 280, O(640)); Sfx("sparks"); DoShake(0.4f); });
                case "fire": return One(() => Fire(A()));
                case "snow": return One(() => Snow(A()));
                case "snowball": return Snowball(A());
                case "blizzard": return Blizzard(A());
                case "avalanche": return Avalanche(A());
                case "icicle": return Icicle(A());
                case "shatter": return One(() => { DoTint("frosty", 700); Put("shatter", A(), 260, O(520)); Sfx("ice"); DoShake(0.5f); });
                case "stamp": return Stamp(A());
                case "letter": return Letter(A(), Anchor("hero"));
                case "arrive": return Letter(A(), At(430, 300));
                case "starfall": return Starfall(A());
                case "beam": return Then(() => { Put("beam", Feet(A()), 380, O(800, ay: baseLine)); Sfx("beam"); }, 260, () => DoShake(0.8f));
                case "roots": return Then(() => { Put("roots", Feet(A()), 250, O(900, ay: baseLine)); Sfx("root"); }, 260, () => DoShake(0.5f));
                case "coin": return Coin(A());
                case "flour": return One(() => { Put("flour", A(), 250, O(640, 0, 14)); Sfx("thud"); DoShake(1.4f); });
                case "confetti": return One(() => { Put("confetti", A(), 320, O(800)); Sfx("fair"); Sfx("bonk"); DoShake(0.5f); });
                case "crumbs": return One(() => { Put("crumbs", A(), 290, O(640)); Sfx("crunch"); Sfx("bonk"); DoShake(0.5f); });
                case "ink": return One(() => { Put("ink", A(), 200, O(640, 0, -14)); Sfx("splat"); });
                case "spikes": return One(() => { Put("spikes", A(), 270, O(600)); Sfx("thorns"); Sfx("bonk"); DoShake(0.5f); });
                case "flash": return One(() => { Put("flash", A(), 340, O(620)); DoShake(1.2f); });
                case "shield": return One(() => Put("shield", Anchor("hero"), 130, O(800, 22, -50)));
                case "heal": return One(() => Heal(A("hero")));
                case "heart": return One(() => { Put("heart", Anchor("hero"), 180, O(1000, 0, -50)); Heal(Anchor("hero")); });
                case "flamelet": return Flamelet();
                case "burnApply": return One(() => { DoTint("burning", 900); Put("burnApply", Feet(A("enemy")), 190, O(850, ay: baseLine)); Sfx("fire"); });
                case "weak": return One(() => { var a = A("enemy"); DoTint("withered", 900); Put("weak", Off(a, 0, -40), 190, O(800)); Sfx("weak"); });
                case "vuln": return One(() => { Put("vuln", A("enemy"), 200, O(760)); Sfx("crack"); });
                case "frost": return One(() => { DoTint("frosty", 1000); Put("frost", A("enemy"), 170, O(860, 0, -14)); Sfx("frost"); });
                case "sleep": return One(() => { var a = A("enemy"); Put("sleep", Off(a, 56, -84), 140, O(1200)); Sfx("sleep"); });
                case "energy": return One(() => { Put("energy", Anchor("energy"), 120, O(520)); Sfx("zap"); });
                case "aura": return One(() => { Put("aura", Anchor("hero"), 160, O(760, 10, -20)); Sfx("aura"); });
                case "thorns": return One(() => { Put("thorns", Anchor("hero"), 160, O(800, 0, -6)); Sfx("thorns"); });
                case "gold": return One(() => { var a = A("hero"); Put("gold", Off(a, 10, 34), 160, O(900, ay: baseLine)); Sfx("coin"); });
                case "loot": return One(() => { Put("gold", Feet(A("enemy")), 250, O(950, ay: baseLine)); Sfx("coin"); });
                case "find": return One(() => { var a = A(); Put("starfall", a, 280, O(900, 0, -46)); Put("sigil", a, 230, O(900)); Sfx("sigil"); });
                case "fanfare":
                    return One(() =>
                    {
                        Put("confetti", At(84, 160), 330, O(1000));
                        Put("confetti", At(316, 172), 330, O(1000, delay: 260));
                        Put("starfall", At(200, 250), 380, O(1100, delay: 420));
                    });
                case "triumph":
                    return One(() =>
                    {
                        var a = A("enemy");
                        Put("confetti", a, 390, O(1000, 0, -20));
                        Put("starfall", a, 320, O(950, 0, -50, delay: 140));
                        Put("gold", Feet(a), 280, O(1000, ay: baseLine));
                        Sfx("fair"); Sfx("coin"); DoShake(0.6f);
                    });
                case "deliver": return Deliver();
                case "sigil": return One(() => Sigil(t));
                case "clock": return One(() => { Put("clock", At(200, 480), 210, O(1000)); Sfx("chime"); });
                case "mirror": return One(() => { Put("mirror", At(200, 480), 320, O(700)); Sfx("mirror"); });
                case "cards": return One(() => { Put("cards", At(312, Height - 130), 190, O(620)); Sfx("paper"); });
                case "ginger": return One(() => { Put("ginger", At(200, 520), 160, O(720)); Sfx("oven"); });
                case "sugar": return One(() => { Put("sugar", At(200, Height - 220), 320, O(800)); Sfx("sugar"); });
                case "grind": return One(() => { Put("grind", At(200, 590), 260, O(760)); Sfx("grind"); });
                case "growl": return One(() => { Put("growl", Anchor("hero"), 140, O(900, 30, -90)); Sfx("growl"); });
                case "rage": return One(() => Rage(A("enemy")));
                case "bite": return Bite(A("enemy"));
                case "price": return One(() => { Put("price", Anchor("hero"), 140, O(760, 0, -20)); Sfx("heartbeat"); });
                case "claw": return One(() => Put("claw", Anchor("hero"), 160, O(480)));
                case "notes": return One(() => { var a = Anchor("hero"); Put("notes", Off(a, 26, -50), 160, O(1000)); });
                case "steam": return One(() => { Put("steam", Anchor("hero"), 130, O(1100, 26, -62)); Sfx("sip"); });
                case "wind": return One(() => { Put("wind", At(200, 600), 470, O(720)); Sfx("wind"); });
            }
            return null;
        }

        static IEnumerator One(Action a) { a(); yield break; }

        IEnumerator Then(Action first, float ms, Action after)
        {
            first();
            yield return Wait(ms);
            after();
        }

        IEnumerator Slash(Spot a)
        {
            Put("slash", a, 270, O(560));
            Sfx("slash");
            yield return Wait(120);
            DoShake(0.5f);
        }

        // огонь: языки пламени встают вдоль ног врага
        void Fire(Spot a)
        {
            var f = Feet(a);
            DoTint("burning", 900);
            var list = new[] { (-0.36f, 160f, 60f), (0.34f, 170f, 150f), (-0.13f, 230f, 0f), (0.12f, 200f, 100f) };
            for (var i = 0; i < list.Length; i++)
            {
                var (k, w, dl) = list[i];
                var o = O(900, ay: baseLine, delay: dl);
                o.Flip = i % 2 == 1;
                Put("fire", At(f.X + a.W * k, f.Y + (w < 180 ? 6 : 0)), w, o);
            }
            Sfx("fire");
        }

        void Snow(Spot a) { Put("snow", a, 230, O(560)); Sfx("snow"); DoShake(0.5f); }

        IEnumerator Snowball(Spot a)
        {
            yield return Fly("snowball_p", 38, new Opt(), Anchor("hero"), a, 300, new FlyOpt { Arc = 90, Spin = 360, Linger = 40 });
            Put("snowball", a, 210, O(600)); Sfx("snow"); DoShake(0.5f);
        }

        IEnumerator Blizzard(Spot a)
        {
            Put("blizzard", a, 340, O(820));
            yield return Wait(200);
            Snow(a);
        }

        // лавина: снег рушится сверху и оседает сугробом
        IEnumerator Avalanche(Spot a)
        {
            Put("avalanche", Feet(a), 320, O(800, ay: baseLine));
            yield return Wait(300);
            Sfx("snow"); DoShake(1.6f);
        }

        IEnumerator Icicle(Spot a)
        {
            yield return Fly("icicle_p", 150, new Opt { Rot = 9 }, Anchor("hero"), a, 240, new FlyOpt { Aim = true, Linger = 40 });
            DoTint("frosty", 700);
            Put("icicle", a, 260, O(560)); Sfx("ice"); DoShake(0.5f);
        }

        IEnumerator Stamp(Spot a)
        {
            Put("stamp", Feet(a), 260, O(760, R(-8, 8), ay: baseLine));
            yield return Wait(120);
            Sfx("stamp"); DoShake(1);
        }

        // письмо летит остриём в цель; справа налево — отражённое, чтобы не перевернулось
        IEnumerator Letter(Spot a, Spot from)
        {
            Sfx("paper");
            yield return Fly("letter_p", 96, new Opt { FlipY = a.X < from.X }, from, a, 320, new FlyOpt { Arc = 40, Aim = true, Linger = 40 });
            Put("letter", a, 260, O(560)); Sfx("bonk", 0.7f); DoShake(0.4f);
        }

        IEnumerator Starfall(Spot a)
        {
            Put("starfall", a, 320, O(760, 0, -30));
            Sfx("star");
            yield return Wait(400);
            DoShake(0.8f);
        }

        IEnumerator Coin(Spot a)
        {
            Sfx("coin");
            yield return Fly("coin_p", 84, new Opt { Loop = true, Dur = 280 }, Anchor("hero"), a, 300, new FlyOpt { Arc = 110, Linger = 40 });
            Put("coin", a, 250, O(600)); Sfx("bonk"); DoShake(0.5f);
        }

        void Heal(Spot a) => Put("heal", Off(a, 0, 34), 170, O(800, ay: baseLine));

        IEnumerator Flamelet()
        {
            var lamp = Anchor("lamp");
            yield return Fly("flamelet_p", 52, new Opt(), At(200, Height - 340), lamp, 300, new FlyOpt { Arc = 40, Linger = 40 });
            Put("flamelet", lamp, 100, O(460));
        }

        IEnumerator Deliver()
        {
            Sfx("paper");
            yield return Fly("deliver_p", 66, new Opt(), Anchor("hero"), At(430, 330), 520, new FlyOpt { Arc = 80, Spin = 30 });
        }

        // знак Оберега над героем, в нём рисунок карты (c:<карта>)
        void Sigil(string art)
        {
            var a = Anchor("hero");
            var at = Off(a, 40, -110);
            Put("sigil", at, 140, O(1000));
            if (art != null && art.StartsWith("c:"))
            {
                var sp = Ui.Art("c/" + art.Substring(2));
                if (sp)
                {
                    var img = Ui.CircleArt("sigil art", layer, sp);
                    var rt = img.rectTransform;
                    rt.anchorMin = rt.anchorMax = new Vector2(0, 1);
                    rt.pivot = new Vector2(0.5f, 0.5f);
                    rt.sizeDelta = new Vector2(46, 46);
                    rt.anchoredPosition = new Vector2(at.X, -at.Y);
                    StartCoroutine(SigilPop(img, 1f * K));
                }
            }
            Sfx("sigil");
        }

        // .sigilpop: знак вырастает, держится и тает
        static IEnumerator SigilPop(Image img, float dur)
        {
            for (var t = 0f; t < dur; t += Time.deltaTime)
            {
                if (!img) yield break;
                var p = t / dur;
                img.rectTransform.localScale = Vector3.one * (p < 0.2f ? Mathf.Lerp(0.4f, 1.1f, p / 0.2f) : 1.1f - 0.1f * p);
                img.color = new Color(1, 1, 1, p < 0.7f ? 1 : 1 - (p - 0.7f) / 0.3f);
                yield return null;
            }
            if (img) Destroy(img.gameObject);
        }

        // ярость босса: те же кольца рыка и сияние, но крупно вокруг врага и в красном
        void Rage(Spot a)
        {
            var red = new Color(1f, 0.32f, 0.26f);
            var o1 = O(860); o1.Color = red;
            var o2 = O(950, 0, -8, delay: 70); o2.Color = red;
            Put("aura", a, 420, o1);
            Put("growl", a, 310, o2);
            Sfx("growl"); DoShake(1.2f);
        }

        // укус Дружка: раскрытая пасть летит от героя и смыкается на враге
        IEnumerator Bite(Spot a)
        {
            Sfx("bark");
            yield return Fly("bite_p", 200, new Opt(), Anchor("hero"), a, 300, new FlyOpt { Arc = 100, R0 = -60, Spin = -8, Linger = 0 });
            Put("bite", a, 300, new Opt { Dur = 460, Rot = -8 });
            yield return Wait(110);
            Sfx("bite"); DoShake(0.9f);
        }
    }
}
