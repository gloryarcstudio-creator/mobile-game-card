// Живой враг (js/paint.js, «Живые враги: раскадровки из роликов»): покой, удар, боль, гибель, у ежа — радость.
// Атласы Art/ea/<враг>_<часть>.png и опись Art/ea/anim.json делает tools/unity/export_assets.py: кадры обрезаны
// по рисунку и уложены плотно, у каждого записаны место в атласе и сдвиг внутри квадратного кадра.
// Кадр квадратный, вписан в рамку по меньшей стороне, ноги стоят на нижнем крае рамки (летающие висят).
// Плавность как в вебе: положение в раскадровке дробное, между соседними кадрами рисуется их смесь,
// а при смене движения прежняя картинка растворяется в новой.
using System.Collections.Generic;
using Fitil.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Fitil.Game
{
    public sealed class EnemyAnim : MonoBehaviour
    {
        sealed class Move
        {
            public string Part;
            public int O, N, Hit;
            public float Fps;
            public int[] Seq;
            public int Ticks => Seq != null ? Seq.Length : N;
            public int Frame(int j) => O + (Seq != null ? Seq[j] : j);
        }

        sealed class Part
        {
            public int W, H;
            public int[][] F;   // кадр атласа: x, y, ширина, высота, сдвиг x, сдвиг y (0 — пустой кадр)
        }

        sealed class Meta
        {
            public int Fs;
            public float Foot;
            public bool Aloft;
            public Move Idle;
            public readonly Dictionary<string, Move> Act = new Dictionary<string, Move>();
            public readonly Dictionary<string, Part> Parts = new Dictionary<string, Part>();
        }

        const float FadeIn = 0.08f, FadeOut = 0.16f;   // переход между движениями, с, при обычной скорости

        static Dictionary<string, object> all;
        static readonly Dictionary<string, Meta> metas = new Dictionary<string, Meta>();
        static readonly Dictionary<string, Texture2D> texs = new Dictionary<string, Texture2D>();
        static readonly Dictionary<string, int> refs = new Dictionary<string, int>();

        Meta m;
        string id;
        readonly Dictionary<string, Texture2D> mine = new Dictionary<string, Texture2D>();
        RectTransform box, sq;
        RawImage a, b, old;
        float idleT0, actT0, sp = 1, x0, xd;
        string act;
        bool dead;

        /// <summary>Сила цвета (тонировка горения и мороза) и общая прозрачность.</summary>
        public Color Tint = Color.white;
        public float Alpha = 1;
        public bool Dead => dead;
        public string Id => id;

        // ================= опись =================
        static Meta MetaOf(string id)
        {
            if (string.IsNullOrEmpty(id)) return null;
            if (metas.TryGetValue(id, out var have)) return have;
            Meta m = null;
            try { m = Read(id); }
            catch (System.Exception e) { Debug.LogWarning("anim " + id + ": " + e.Message); }
            metas[id] = m;
            return m;
        }

        static Meta Read(string id)
        {
            if (all == null)
            {
                var ta = Resources.Load<TextAsset>("Art/ea/anim");
                all = ta ? Json.Obj(Json.Parse(ta.text)) : new Dictionary<string, object>();
                if (ta) Resources.UnloadAsset(ta);
            }
            var e = Json.Obj(Json.Get(Json.Obj(Json.Get(all, "enemies")), id));
            if (e == null) return null;
            var m = new Meta { Fs = Json.Int(Json.Get(e, "fs"), 320) };
            var aloft = Json.Arr(Json.Get(all, "aloft"));
            m.Aloft = aloft != null && aloft.Contains(id);
            m.Foot = m.Aloft ? 1 : Mathf.Min(1, (float)Json.Num(Json.Get(Json.Obj(Json.Get(all, "foot")), id), 1));
            m.Idle = MoveOf(Json.Obj(Json.Get(e, "idle")), "idle");
            var acts = Json.Obj(Json.Get(e, "act"));
            if (acts != null) foreach (var kv in acts) m.Act[kv.Key] = MoveOf(Json.Obj(kv.Value), "act");
            var parts = Json.Obj(Json.Get(e, "parts"));
            if (parts != null)
                foreach (var kv in parts)
                {
                    var p = Json.Obj(kv.Value);
                    var fl = Json.Arr(Json.Get(p, "f"));
                    var part = new Part { W = Json.Int(Json.Get(p, "w"), 1), H = Json.Int(Json.Get(p, "h"), 1), F = new int[fl.Count][] };
                    for (var i = 0; i < fl.Count; i++)
                    {
                        var r = Json.Arr(fl[i]);
                        part.F[i] = new int[6];
                        for (var k = 0; k < 6 && k < r.Count; k++) part.F[i][k] = Json.Int(r[k]);
                    }
                    m.Parts[kv.Key] = part;
                }
            if (m.Idle == null || !m.Parts.ContainsKey(m.Idle.Part)) return null;
            return m;
        }

        static Move MoveOf(Dictionary<string, object> o, string defPart)
        {
            if (o == null) return null;
            var mv = new Move
            {
                Part = Json.Str(Json.Get(o, "f"), defPart),
                O = Json.Int(Json.Get(o, "o")),
                N = Json.Int(Json.Get(o, "n"), 1),
                Hit = Json.Int(Json.Get(o, "hit")),
                Fps = (float)Json.Num(Json.Get(o, "fps"), 12),
            };
            var seq = Json.Arr(Json.Get(o, "seq"));
            if (seq != null && seq.Count > 0)
            {
                mv.Seq = new int[seq.Count];
                for (var i = 0; i < seq.Count; i++) mv.Seq[i] = Json.Int(seq[i]);
            }
            return mv;
        }

        /// <summary>Есть ли у врага раскадровка.</summary>
        public static bool Has(string id) => MetaOf(id) != null;

        /// <summary>Летает ли враг (висит над своей тенью).</summary>
        public static bool Aloft(string id) => MetaOf(id)?.Aloft ?? false;

        /// <summary>Доля кадра от верха до ног (неподвижная картинка ставится так же).</summary>
        public static float Foot(string id) => MetaOf(id)?.Foot ?? 1;

        /// <summary>Неподвижная картинка врага стоит так же, как живая: квадрат по меньшей стороне рамки,
        /// ноги на нижнем крае (Art.enemyStand). side — меньшая сторона рамки.</summary>
        public static void Stand(Image img, string id, float side)
        {
            var rt = img.rectTransform;
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0.5f, 0);
            rt.sizeDelta = new Vector2(side, side);
            rt.anchoredPosition = new Vector2(0, -side * (1 - Foot(id)));
            img.preserveAspect = true;
        }

        // атласы общие: один и тот же враг может стоять на двух экранах сразу, пока прежний закрывается
        static Texture2D Take(string key)
        {
            if (texs.TryGetValue(key, out var t) && t) { refs[key]++; return t; }
            t = Resources.Load<Texture2D>("Art/ea/" + key);
            if (!t) return null;
            t.wrapMode = TextureWrapMode.Clamp;
            texs[key] = t;
            refs[key] = 1;
            return t;
        }

        static void Give(string key)
        {
            if (!refs.TryGetValue(key, out var n)) return;
            if (n > 1) { refs[key] = n - 1; return; }
            refs.Remove(key);
            if (texs.TryGetValue(key, out var t) && t) Resources.UnloadAsset(t);
            texs.Remove(key);
        }

        // ================= на экране =================
        /// <summary>Живой враг во всю рамку box. null — раскадровки нет (тогда остаётся неподвижная картинка).</summary>
        public static EnemyAnim Make(RectTransform box, string id)
        {
            var m = MetaOf(id);
            if (m == null) return null;
            var go = new GameObject("live", typeof(RectTransform));
            var rt = (RectTransform)go.transform;
            rt.SetParent(box, false);
            rt.Fill();
            rt.pivot = new Vector2(0.5f, 0);   // наклон и уменьшение — от ног
            var an = go.AddComponent<EnemyAnim>();
            an.m = m;
            an.id = id;
            an.box = rt;
            // атласы всех частей сразу: покой нужен немедленно, движения — к первому удару
            foreach (var part in m.Parts.Keys)
            {
                var t = Take(id + "_" + part);
                if (t) an.mine[part] = t;
            }
            if (!an.mine.ContainsKey(m.Idle.Part)) { Destroy(go); return null; }
            an.sq = Ui.Node("frame", rt);
            an.sq.anchorMin = an.sq.anchorMax = an.sq.pivot = new Vector2(0.5f, 0);
            an.a = an.Layer("a");
            an.b = an.Layer("b");
            an.old = an.Layer("old");
            an.idleT0 = Time.time;
            an.Tick();
            return an;
        }

        RawImage Layer(string name)
        {
            var r = new GameObject(name, typeof(RectTransform)).AddComponent<RawImage>();
            r.rectTransform.SetParent(sq, false);
            r.rectTransform.anchorMin = r.rectTransform.anchorMax = r.rectTransform.pivot = new Vector2(0, 1);
            r.raycastTarget = false;
            r.enabled = false;
            return r;
        }

        void OnDestroy()
        {
            foreach (var part in mine.Keys) Give(id + "_" + part);
            mine.Clear();
        }

        /// <summary>Разыграть движение: attack | hurt | death | happy; speed 2 — ускоренный бой.
        /// Возвращает секунды до самой сильной позы (удара) при этой скорости; 0 — такого движения нет.</summary>
        public float Play(string kind, float speed = 1)
        {
            if (dead) return 0;
            if (kind == "death") dead = true;   // после гибели покой больше не играет
            if (!m.Act.TryGetValue(kind, out var mv) || mv == null || !mine.ContainsKey(mv.Part)) return 0;
            Snapshot(FadeIn / speed);
            act = kind;
            actT0 = Time.time;
            sp = speed;
            return mv.Hit / mv.Fps / speed;
        }

        /// <summary>Сколько секунд займёт движение целиком; 0 — его нет.</summary>
        public float Duration(string kind, float speed = 1)
        {
            if (!m.Act.TryGetValue(kind, out var mv) || mv == null || !mine.ContainsKey(mv.Part)) return 0;
            return mv.Ticks / mv.Fps / speed;
        }

        // прежняя картинка растворяется в новой
        void Snapshot(float s)
        {
            var src = b.enabled && b.color.a > 0.5f ? b : a;
            if (!src.enabled) return;
            old.enabled = true;
            old.texture = src.texture;
            old.uvRect = src.uvRect;
            old.rectTransform.anchoredPosition = src.rectTransform.anchoredPosition;
            old.rectTransform.sizeDelta = src.rectTransform.sizeDelta;
            x0 = Time.time;
            xd = s;
        }

        void Update() => Tick();

        void Tick()
        {
            // рамка может поменять величину (раскладка экрана): квадрат кадра считается каждый раз
            var w = box.rect.width;
            var h = box.rect.height;
            var d = Mathf.Min(w, h);
            sq.sizeDelta = new Vector2(d, d);
            sq.anchoredPosition = new Vector2(0, -d * (1 - m.Foot));
            var k = d / m.Fs;
            var now = Time.time;

            var oldW = 0f;
            if (xd > 0)
            {
                var u = (now - x0) / xd;
                if (u >= 1) xd = 0; else oldW = 1 - u * u * (3 - 2 * u);
            }
            old.enabled = oldW > 0.004f;
            if (old.enabled) old.color = new Color(Tint.r, Tint.g, Tint.b, oldW * Alpha);

            if (act != null && m.Act.TryGetValue(act, out var mv) && mv != null && mine.TryGetValue(mv.Part, out var at))
            {
                var T = mv.Ticks;
                var p = Mathf.Max(0, (now - actT0) * mv.Fps * sp);
                if (p < T || dead)
                {
                    var i = Mathf.Min(Mathf.FloorToInt(p), T - 1);
                    if (i < T - 1) Show(at, m.Parts[mv.Part], mv.Frame(i), mv.Frame(i + 1), p - i, k);
                    else Show(at, m.Parts[mv.Part], mv.Frame(i), -1, 0, k);
                    return;
                }
                // движение кончилось: его последний кадр растворяется в покое, покой идёт с начала
                Snapshot(FadeOut / sp);
                act = null;
                idleT0 = now;
            }
            else act = null;
            if (dead) return;
            var idle = m.Idle;
            var ip = Mathf.Max(0, (now - idleT0) * idle.Fps);
            var ii = Mathf.FloorToInt(ip);
            Show(mine[idle.Part], m.Parts[idle.Part], ii % idle.N, (ii + 1) % idle.N, ip - ii, k);
        }

        // два соседних кадра: первый целиком, второй поверх с долей f
        void Show(Texture2D tex, Part part, int i, int j, float f, float k)
        {
            Set(a, tex, part, i, 1, k);
            if (j >= 0 && j != i && f > 0.004f) Set(b, tex, part, j, f, k);
            else b.enabled = false;
        }

        void Set(RawImage r, Texture2D tex, Part part, int i, float w, float k)
        {
            if (i < 0 || i >= part.F.Length || part.F[i][2] == 0) { r.enabled = false; return; }
            var fr = part.F[i];
            r.enabled = true;
            if (r.texture != tex) r.texture = tex;
            r.uvRect = new Rect(fr[0] / (float)part.W, 1 - (fr[1] + fr[3]) / (float)part.H, fr[2] / (float)part.W, fr[3] / (float)part.H);
            r.rectTransform.anchoredPosition = new Vector2(fr[4] * k, -fr[5] * k);
            r.rectTransform.sizeDelta = new Vector2(fr[2] * k, fr[3] * k);
            r.color = new Color(Tint.r, Tint.g, Tint.b, w * Alpha);
        }
    }
}
