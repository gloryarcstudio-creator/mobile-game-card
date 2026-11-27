// Числа баланса: копия констант и BAL из начала js/game.js (длинный сюжет).
// Менять в обеих версиях вместе, пока веб-версия остаётся эталоном.
namespace Fitil.Core
{
    public static class Balance
    {
        public const int HandSize = 5;
        public const int MaxEnergy = 3;
        public const int FlameBonus = 2;   // +урон атак за каждый Огонёк
        public const int FlameMax = 3;     // при стольких Огоньках лампа вспыхивает
        public const int BurstDmg = 8;
        public const int HandMax = 10;

        public const double HpStep = 0.055;
        public static readonly int[] StrEvery = { 10, 5 };
        public static readonly double[] EliteHp = { 0.95, 1.2 };
        public static readonly int[] EliteW = { 10, 12 };
        public static readonly double[] BossHp = { 2.2, 2.3, 2.2 };
        public static readonly int[] BossStr = { 0, 4, 5 };
        public static readonly int[] RageStr = { 2, 3, 4 };
        public static readonly int[] RageBlock = { 8, 12, 16 };
        public const double EliteAfterCalm = 0.3;
        public const double ChestRelic = 0.33;
        public const int HoneBlock = 2;
    }
}
