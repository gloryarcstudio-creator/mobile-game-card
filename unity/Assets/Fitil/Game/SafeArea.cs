// Безопасная зона экрана: всё, на что нажимают и что читают, живёт внутри неё,
// чтобы вырез камеры, «чёлка», скруглённые углы и полоска жестов ничего не закрывали.
// Фоны лежат вне этой зоны и заходят под вырез.
using UnityEngine;

namespace Fitil.Game
{
    [RequireComponent(typeof(RectTransform))]
    public sealed class SafeArea : MonoBehaviour
    {
        RectTransform rt;
        Rect last;
        Vector2Int lastSize;
        ScreenOrientation lastOrientation;

        void Awake()
        {
            rt = (RectTransform)transform;
            Apply();
        }

        void Update()
        {
            if (Screen.safeArea != last || Screen.width != lastSize.x || Screen.height != lastSize.y || Screen.orientation != lastOrientation) Apply();
        }

        void Apply()
        {
            last = Screen.safeArea;
            lastSize = new Vector2Int(Screen.width, Screen.height);
            lastOrientation = Screen.orientation;
            if (Screen.width <= 0 || Screen.height <= 0) return;
            var min = new Vector2(last.xMin / Screen.width, last.yMin / Screen.height);
            var max = new Vector2(last.xMax / Screen.width, last.yMax / Screen.height);
            rt.anchorMin = min;
            rt.anchorMax = max;
            rt.offsetMin = Vector2.zero;
            rt.offsetMax = Vector2.zero;
        }
    }
}
