// Фон, на котором кто-то стоит (Art.groundCam в js/paint.js): картинка поднимается так, чтобы её линия снега
// встала под ноги фигуры, а передний план ниже этой линии растягивается до низа экрана.
// Без этого фигура стоит на фоне неба и кажется висящей в воздухе.
using UnityEngine;
using UnityEngine.UI;

namespace Fitil.Game
{
    public sealed class GroundBg : MaskableGraphic
    {
        const float LowMax = 2.2f;   // сильнее снег не тянем: мазки становятся полосами

        Sprite sprite;
        float feet;            // линия снега на картинке, доля высоты от верха (0..1)
        RectTransform stand;   // неподвижная метка: её низ — линия ног
        float lastY = float.NaN;
        readonly Vector3[] corners = new Vector3[4];

        public override Texture mainTexture => sprite ? sprite.texture : s_WhiteTexture;

        /// <summary>feetPx — линия снега на картинке в точках макета 400×860 (FEET в js/paint.js).</summary>
        public static GroundBg Make(RectTransform parent, string art, float feetPx, RectTransform stand)
        {
            var g = Ui.Node("bg", parent).Fill().gameObject.AddComponent<GroundBg>();
            g.sprite = Ui.Art(art);
            g.feet = Mathf.Clamp01(feetPx / 860f);
            g.stand = stand;
            g.raycastTarget = false;
            g.color = g.sprite ? Color.white : (Color)Ui.Night;
            return g;
        }

        float StandY()
        {
            if (!stand) return float.NaN;
            stand.GetWorldCorners(corners);
            return rectTransform.InverseTransformPoint(corners[0]).y;
        }

        void LateUpdate()
        {
            var y = StandY();
            if (float.IsNaN(y) != float.IsNaN(lastY) || (!float.IsNaN(y) && Mathf.Abs(y - lastY) > 0.25f))
            {
                lastY = y;
                SetVerticesDirty();
            }
        }

        protected override void OnRectTransformDimensionsChange()
        {
            base.OnRectTransformDimensionsChange();
            SetVerticesDirty();
        }

        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear();
            var r = rectTransform.rect;
            if (r.width <= 0 || r.height <= 0) return;
            if (!sprite)
            {
                Quad(vh, r.xMin, r.xMax, r.yMax, r.yMin, 0, 0);
                return;
            }
            // картинка покрывает экран целиком, лишнее срезается по краям (background-size: cover)
            float tw = sprite.texture.width, th = sprite.texture.height;
            var s = Mathf.Max(r.width / tw, r.height / th);
            float w = tw * s, h = th * s;
            var x0 = r.center.x - w / 2;
            var x1 = x0 + w;
            var top = r.center.y + h / 2;
            var line = top - feet * h;          // где линия снега лежит сама по себе
            var want = float.IsNaN(lastY) ? StandY() : lastY;
            var up = float.IsNaN(want) ? 0 : Mathf.Max(0, want - line);   // вниз фон не сдвигаем: сверху открылась бы пустота
            if (up < 0.5f)
            {
                Quad(vh, x0, x1, top, top - h, 1, 0);
                return;
            }
            var at = line + up;                  // линия снега теперь под ногами
            var vLine = 1 - feet;
            Quad(vh, x0, x1, top + up, at, 1, vLine);
            // передний план: растянуть так, чтобы низ картинки снова дошёл до низа экрана
            var low = (1 - feet) * h;
            var need = low > 0 ? (at - r.yMin) / low : 1;
            var k = Mathf.Clamp(need, 1, LowMax);
            var bottom = at - low * k;
            Quad(vh, x0, x1, at, bottom, vLine, 0);
            // не хватило: нижняя кромка картинки тянется дальше ровным цветом
            if (bottom > r.yMin) Quad(vh, x0, x1, bottom, r.yMin, 0.004f, 0.002f);
        }

        void Quad(VertexHelper vh, float xa, float xb, float yTop, float yBottom, float vTop, float vBottom)
        {
            var c = (Color32)color;
            var n = vh.currentVertCount;
            vh.AddVert(new Vector3(xa, yBottom), c, new Vector2(0, vBottom));
            vh.AddVert(new Vector3(xa, yTop), c, new Vector2(0, vTop));
            vh.AddVert(new Vector3(xb, yTop), c, new Vector2(1, vTop));
            vh.AddVert(new Vector3(xb, yBottom), c, new Vector2(1, vBottom));
            vh.AddTriangle(n, n + 1, n + 2);
            vh.AddTriangle(n + 2, n + 3, n);
        }
    }
}
