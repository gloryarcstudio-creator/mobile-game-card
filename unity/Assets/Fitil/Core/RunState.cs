// Состояние забега (run в game.js). Пока только то, что нужно бою;
// развилки, лавка, события и сохранение добавятся на этапе «Core: забег».
using System.Collections.Generic;

namespace Fitil.Core
{
    public sealed class RunState
    {
        public string Cls;
        public int Diff = 1;
        public int Step;
        public int Hp, MaxHp, Gold;
        public readonly List<CardInst> Deck = new List<CardInst>();
        public readonly List<string> Relics = new List<string>();
        public bool Candle;          // Последняя свеча уже спасла
        public int Fights, Lit;
        public readonly List<string> Killed = new List<string>();
        public readonly Dictionary<string, int> Seen = new Dictionary<string, int>();
        public readonly List<string> Recent = new List<string>();
        public readonly Dictionary<string, int> Offered = new Dictionary<string, int>();
        public readonly List<string> LastOffered = new List<string>();
        public readonly List<string> Bosses = new List<string>();
        public Rng Rng = new Rng(1);
        public int UidSeq = 1;

        public bool HasRelic(string id) => Relics.Contains(id);

        public CardInst Mk(string id, bool up = false) => new CardInst { Uid = UidSeq++, Id = id, Up = up };
    }
}
