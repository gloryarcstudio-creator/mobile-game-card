// Выбор героя перед забегом (экран героев в game.js, упрощённо): восемь героев плиткой,
// под ними выбранный герой в полный рост, его история и кнопка «В путь».
// Платные герои без покупки показаны с ценой и не выбираются (покупки — этап «магазин»).
using System;
using Fitil.Core;
using Fitil.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace Fitil.Game
{
    public sealed class HeroSelect : MonoBehaviour
    {
        RectTransform root, back, info;
        GameData data;
        Action<string> go;
        Action cancel;
        string current;

        public static HeroSelect Show(GameData data, Action<string> go, Action cancel)
        {
            var o = new GameObject("HeroSelect");
            o.transform.SetParent(Boot.Instance.transform, false);
            var s = o.AddComponent<HeroSelect>();
            s.data = data;
            s.go = go;
            s.cancel = cancel;
            s.Build();
            return s;
        }

        void OnDestroy()
        {
            if (root) Destroy(root.gameObject);
            if (back) Destroy(back.gameObject);
        }

        void Build()
        {
            back = Ui.Node("heroes back", Boot.Instance.Back).Fill();
            Boot.Background(back, "bg/bg_title");
            var dim = Ui.Img("dim", back, null, new Color(0.04f, 0.05f, 0.1f, 0.55f));
            dim.rectTransform.Fill();

            root = Ui.Node("heroes", Boot.Instance.Safe).Fill();
            var title = Ui.Label("title", root, Loc.Tr("Кто понесёт письмо?"), 28, Ui.GoldHi, TextAnchor.MiddleCenter, true).Shadow(2f);
            title.rectTransform.Box(0, 18, 400, 40);

            var grid = Ui.Node("grid", root).Box(10, 66, 380, 250);
            var i = 0;
            string first = null;
            foreach (var kv in data.Classes)
            {
                var h = kv.Value;
                var owned = Store.HeroOwned(data, h.Id);
                first ??= owned ? h.Id : null;
                var tile = Ui.Hit("hero " + h.Id, grid, () => Pick(h.Id));
                var rt = (RectTransform)tile.transform;
                rt.Box((i % 4) * 95, (i / 4) * 125, 90, 120);
                var plate = Ui.Round("plate", rt, new Color32(20, 24, 38, 200));
                plate.rectTransform.Fill();
                var face = Ui.CircleArt("face", rt, Ui.Art("h/" + h.Id + "_face"));
                face.rectTransform.Box(10, 6, 70, 70);
                if (!owned) face.transform.GetChild(0).GetComponent<Image>().color = new Color(0.45f, 0.45f, 0.5f);
                var name = Ui.Label("name", rt, h.Name, 14, owned ? Ui.Paper : new Color(0.7f, 0.7f, 0.75f), TextAnchor.MiddleCenter, true).Shadow().Fit(9);
                name.rectTransform.Box(2, 78, 86, 22);
                var sub = Ui.Label("role", rt, owned ? h.Role : Store.Price, 11, owned ? new Color(1, 1, 1, 0.7f) : Ui.GoldHi).Fit(7);
                sub.rectTransform.Box(2, 98, 86, 18);
                i++;
            }

            info = Ui.Node("info", root).Box(0, 330, 400, 530);
            var backBtn = Ui.Btn("back", root, Loc.Tr("Назад"), () => cancel?.Invoke(), 18);
            ((RectTransform)backBtn.transform).Box(16, 790, 120, 52, 0);
            Pick(first ?? "lamp");
        }

        void Pick(string id)
        {
            current = id;
            Ui.Clear(info);
            var h = data.Classes[id];
            var owned = Store.HeroOwned(data, id);
            var body = Ui.Img("body", info, "h/" + id);
            body.preserveAspect = true;
            body.rectTransform.Box(0, 0, 190, 300);
            var name = Ui.Label("name", info, h.Name, 26, Ui.GoldHi, TextAnchor.UpperLeft, true).Shadow(2f);
            name.rectTransform.Box(190, 6, 200, 34);
            var role = Ui.Label("role", info, h.Role + " · HP " + h.Hp, 15, Ui.Paper, TextAnchor.UpperLeft).Shadow();
            role.rectTransform.Box(190, 42, 200, 22);
            var about = Ui.Label("about", info, h.About ?? h.Who ?? "", 15, Ui.Paper, TextAnchor.UpperLeft).Shadow().Fit(10);
            about.rectTransform.Box(190, 70, 200, 200);

            var start = Ui.Btn("go", info, owned ? Loc.Tr("В путь") : Loc.Tr("Магазин") + " · " + Store.Price, () =>
            {
                if (owned) go?.Invoke(current);
            }, 22);
            ((RectTransform)start.transform).Box(160, 400, 220, 60);
            start.interactable = owned;
        }
    }
}
