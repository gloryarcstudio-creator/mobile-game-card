// Снегопад поверх фонов и под экраном (#snow в game.js). Три слоя глубины: дальние снежинки мелкие, тусклые
// и медленные, ближние крупные и яркие; всех сносит один ветер, который то усиливается, то стихает.
// Все снежинки — одна сетка из квадратиков с круглой картинкой: один вызов отрисовки на кадр.
// В настройках снегопад выключается совсем (экономит заряд).
using UnityEngine;
using UnityEngine.UI;

namespace Fitil.Game
{
    public sealed class Snow : MaskableGraphic
    {
        struct Flake { public int Z; public float X, Y, R, V, D; }

        const int Count = 76;
        static readonly float[] Alpha = { 0.42f, 0.7f, 0.92f };
        Flake[] flakes;
        float ms;
        bool shown;

        public override Texture mainTexture => Ui.Circle ? Ui.Circle.texture : s_WhiteTexture;

        protected override void Awake()
        {
            base.Awake();
            raycastTarget = false;
            color = new Color32(235, 242, 255, 255);
            flakes = new Flake[Count];
            for (var i = 0; i < Count; i++)
            {
                var z = i < 34 ? 0 : i < 62 ? 1 : 2;
                flakes[i] = new Flake
                {
                    Z = z, X = Random.value * 400, Y = Random.value * 860,
                    R = new[] { 0.7f, 1.3f, 2.3f }[z] + Random.value * new[] { 0.6f, 0.9f, 1.3f }[z],
                    V = new[] { 0.22f, 0.5f, 0.95f }[z] + Random.value * new[] { 0.2f, 0.35f, 0.5f }[z],
                    D = Random.value * 6,
                };
            }
        }

        void Update()
        {
            var on = Settings.Snow;
            if (!on)
            {
                if (shown) { shown = false; SetVerticesDirty(); }
                return;
            }
            shown = true;
            // скорости — в шагах на кадр при 60 кадрах в секунду: шаг растёт с прошедшим временем (90 и 120 Гц не ускоряют снег)
            var dt = Time.unscaledDeltaTime;
            var k = Mathf.Min(3, dt * 60);
            ms += dt * 1000;
            var wind = Mathf.Sin(ms / 7300) * 0.22f + Mathf.Sin(ms / 2900 + 1.7f) * 0.1f;
            for (var i = 0; i < Count; i++)
            {
                var f = flakes[i];
                f.Y += f.V * k;
                f.X += (Mathf.Sin(ms / 1400 + f.D) * (0.2f + f.Z * 0.12f) + wind * (0.5f + f.Z * 0.6f)) * k;
                if (f.Y > 870) { f.Y = -10; f.X = Random.value * 400; }
                if (f.X < -8) f.X += 416; else if (f.X > 408) f.X -= 416;
                flakes[i] = f;
            }
            SetVerticesDirty();
        }

        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear();
            if (!shown || flakes == null) return;
            var rect = rectTransform.rect;
            // снег идёт по всему экрану: логические 400×860 растягиваются на весь холст (на высоких телефонах — выше)
            var sx = rect.width / 400f;
            var sy = rect.height / 860f;
            var c = (Color32)color;
            for (var i = 0; i < Count; i++)
            {
                var f = flakes[i];
                var a = (byte)(c.a * Alpha[f.Z]);
                var col = new Color32(c.r, c.g, c.b, a);
                var x = rect.xMin + f.X * sx;
                var y = rect.yMax - f.Y * sy;
                var r = f.R;
                var n = vh.currentVertCount;
                vh.AddVert(new Vector3(x - r, y - r), col, new Vector2(0, 0));
                vh.AddVert(new Vector3(x - r, y + r), col, new Vector2(0, 1));
                vh.AddVert(new Vector3(x + r, y + r), col, new Vector2(1, 1));
                vh.AddVert(new Vector3(x + r, y - r), col, new Vector2(1, 0));
                vh.AddTriangle(n, n + 1, n + 2);
                vh.AddTriangle(n + 2, n + 3, n);
            }
        }
    }
}
