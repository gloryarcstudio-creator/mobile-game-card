// Двойное касание (lastTap в game.js): второй тап в ту же точку не должен нажать то, что успело появиться под пальцем —
// карту в открывшейся колоде, «Дальше» после выбора, дорожку на карте пути. Та же самая кнопка нажимается как раньше.
// В самом бою ввод и так закрыт на время анимаций, там касания не трогаем (двойной тап по карте разыгрывает её).
// Работает как обычный GraphicRaycaster холста, только такое касание «не попадает» ни во что.
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Fitil.Game
{
    public sealed class TapGuard : GraphicRaycaster
    {
        const float Window = 0.3f;   // секунды между касаниями
        const float Reach = 34f;     // точки макета 400×860

        float lastAt = -10;
        Vector2 lastPos;
        string lastKey;
        bool lastSwitch;
        int vetoFrame = -1;

        public override void Raycast(PointerEventData eventData, List<RaycastResult> resultAppendList)
        {
            var from = resultAppendList.Count;
            base.Raycast(eventData, resultAppendList);
            if (Time.frameCount == vetoFrame) { Drop(resultAppendList, from); return; }
            if (!Input.GetMouseButtonDown(0)) return;

            var hit = resultAppendList.Count > from ? resultAppendList[from].gameObject : null;
            var handler = hit ? ExecuteEvents.GetEventHandler<IPointerClickHandler>(hit) : null;
            var key = Key(handler);
            var isSwitch = handler && handler.name == "radio";   // переключатели в настройках (Menus.Radio)
            var now = Time.unscaledTime;
            // касание приходит в точках экрана: переводим расстояние в точки макета
            var canvas = GetComponent<Canvas>();
            var k = canvas && canvas.scaleFactor > 0 ? canvas.scaleFactor : 1f;
            var near = Vector2.Distance(eventData.position, lastPos) / k < Reach;
            // переключатели настроек стоят строками вплотную: два разных подряд пропускаем, под пальцем там ничего нового не появляется
            if (now - lastAt < Window && near && key != lastKey && !(isSwitch && lastSwitch) && !InFight())
            {
                vetoFrame = Time.frameCount;
                Drop(resultAppendList, from);
                return;
            }
            lastAt = now;
            lastPos = eventData.position;
            lastKey = key;
            lastSwitch = isSwitch;
        }

        static void Drop(List<RaycastResult> list, int from)
        {
            if (list.Count > from) list.RemoveRange(from, list.Count - from);
        }

        /// <summary>Что под пальцем: имя кнопки и начало её надписи. Перерисованная та же кнопка даёт тот же ключ.</summary>
        static string Key(GameObject handler)
        {
            if (!handler) return "";
            var t = handler.GetComponentInChildren<Text>();
            var text = t ? t.text : "";
            return handler.name + "|" + (text.Length > 24 ? text.Substring(0, 24) : text);
        }

        static bool InFight()
        {
            var flow = RunFlow.Current;
            if (flow == null || !flow.InFight || !Boot.Instance) return false;
            var top = Boot.Instance.Top;
            for (var i = 0; i < top.childCount; i++)
            {
                var c = top.GetChild(i);
                if (c.gameObject.activeInHierarchy && c.name == "overlay") return false;
            }
            return true;
        }
    }
}
