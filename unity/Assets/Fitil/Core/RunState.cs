// Состояние забега (run в game.js): герой, здоровье, монеты, колода, талисманы, шаг пути,
// учёт встреч с врагами и героями. Сохраняется целиком (Save.cs).
using System.Collections.Generic;

namespace Fitil.Core
{
    /// <summary>Встреча на развилке (карта пути): бой, элита, босс, событие, лавка, сундук, костёр, встреча с героем.</summary>
    public sealed class Encounter
    {
        public string T;       // fight | elite | boss | event | shop | chest | rest | meet
        public string Enemy;   // для боёв
        public string Ev;      // для события
        public string Hero;    // для встречи
        public bool Last;      // лавка и костёр перед финальным боссом
    }

    /// <summary>Как разговор перед боем меняет бой (run.fmod). Живёт до награды за этот бой.</summary>
    public sealed class FightMod
    {
        public int Str, Weak, Stun;
        public double GoldMul = 1, HpMul = 1;
        public bool Talked, Calm;
    }

    public sealed class RunState
    {
        public string Cls;
        public int Diff = 1;
        public int Step;
        public int Hp, MaxHp, Gold;
        public List<CardInst> Deck = new List<CardInst>();
        public readonly List<string> Relics = new List<string>();
        public bool Candle;          // Последняя свеча уже спасла
        public int Fights, Lit;
        public List<string> Killed = new List<string>();
        public readonly List<string> Kind = new List<string>();     // кого пощадили или с кем решили миром
        public readonly Dictionary<string, int> Seen = new Dictionary<string, int>();
        public readonly List<string> Recent = new List<string>();
        public readonly Dictionary<string, int> Offered = new Dictionary<string, int>();
        public List<string> LastOffered = new List<string>();
        public readonly List<string> Bosses = new List<string>();
        public Rng Rng = new Rng(1);
        public int UidSeq = 1;

        // путь
        public List<Encounter> Choices;
        public string Prev;          // тип прошлой встречи
        public bool Forced;          // после передышки дорога только через бой
        public readonly Dictionary<string, int> EvSeen = new Dictionary<string, int>();
        public string EvLast;
        public string FinalPrep;     // перед финальным боссом: shop → rest → done
        public string Final;         // финальный босс
        public FightMod Fmod;

        // лор: отношения с героями, ушедшие в Тень, встречи, тайны, обиды врагов, тон забега
        public readonly Dictionary<string, int> Rel = new Dictionary<string, int>();
        public readonly List<string> Fallen = new List<string>();
        public readonly List<string> Met = new List<string>();
        public readonly List<string> MeetLog = new List<string>();
        public readonly List<string> Secrets = new List<string>();
        public readonly Dictionary<string, int> Grudge = new Dictionary<string, int>();
        public int Peace, Anger, Pass;
        public readonly Dictionary<int, string> MeetPlan = new Dictionary<int, string>();
        public string Forgiven, FinalDark;

        /// <summary>Итоги забега (run.st): время, урон, лечение, монеты…</summary>
        public readonly Dictionary<string, long> St = new Dictionary<string, long>();

        public bool HasRelic(string id) => Relics.Contains(id);

        public CardInst Mk(string id, bool up = false) => new CardInst { Uid = UidSeq++, Id = id, Up = up };

        public void StAdd(string k, long n = 1)
        {
            if (n <= 0) return;
            St[k] = (St.TryGetValue(k, out var v) ? v : 0) + n;
        }
    }
}
