// Языки игры: перенос js/i18n.js один в один.
// Русский текст из кода служит ключом перевода: Loc.Tr("Уровень {n}", ("n", 5)).
// В строке можно писать:
//   {n}                       — подставить значение n;
//   {n|монета|монеты|монет}   — слово в форме для числа n (в английском две формы: coin|coins);
//   {f|пошла|пошёл}           — по полу героя забега (Loc.Gender задаёт игра).
// Ключ "ctx::текст": по-русски покажется «текст», а перевод ищется по всему ключу.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Fitil.Core
{
    public static class Loc
    {
        public static readonly string[] Langs = { "en", "ru", "uk" };
        public static readonly Dictionary<string, string> LangNames = new Dictionary<string, string>
        {
            ["en"] = "English", ["ru"] = "Русский", ["uk"] = "Українська",
        };

        public static string Lang { get; private set; } = "ru";

        /// <summary>Пол героя забега: true — героиня (как I18N.gender в веб-версии).</summary>
        public static Func<bool> Gender = () => true;

        /// <summary>Ключи без перевода (для проверки, как I18N.missing).</summary>
        public static readonly HashSet<string> Missing = new HashSet<string>();

        static Dictionary<string, string> dict = new Dictionary<string, string>();

        /// <summary>Выбрать язык: сохранённый в настройках, иначе язык телефона (ru/uk), иначе английский.</summary>
        public static string Detect(string saved, string systemTwoLetter)
        {
            if (saved != null && LangNames.ContainsKey(saved)) return saved;
            var k = (systemTwoLetter ?? "").ToLowerInvariant();
            if (k.Length > 2) k = k.Substring(0, 2);
            return LangNames.ContainsKey(k) ? k : "en";
        }

        /// <summary>Включить язык. strings — содержимое strings.&lt;lang&gt;.json (для ru не нужно).</summary>
        public static void Use(string lang, Dictionary<string, string> strings)
        {
            Lang = lang;
            dict = strings ?? new Dictionary<string, string>();
            Missing.Clear();
        }

        public static Dictionary<string, string> ParseStrings(string json)
        {
            var o = Json.Obj(Json.Parse(json));
            var d = new Dictionary<string, string>(o.Count);
            foreach (var kv in o) if (kv.Value is string s) d[kv.Key] = s;
            return d;
        }

        /// <summary>Форма слова для числа: one / few / many (в английском one / other).</summary>
        public static string Plural(double n, IList<string> forms)
        {
            var x = Math.Abs((long)Math.Truncate(n));
            if (Lang == "en")
            {
                var j = x == 1 ? 0 : 1;
                return j < forms.Count ? forms[j] : forms[0];
            }
            var a = x % 10;
            var b = x % 100;
            var i = a == 1 && b != 11 ? 0 : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 1 : 2;
            return i < forms.Count ? forms[i] : forms[forms.Count - 1];
        }

        public static string Tr(string s, params (string key, object value)[] vars)
        {
            if (s == null) return null;
            var cut = s.IndexOf("::", StringComparison.Ordinal);
            var output = cut >= 0 ? s.Substring(cut + 2) : s;
            if (Lang != "ru")
            {
                if (dict.TryGetValue(s, out var d)) output = d; else Missing.Add(s);
            }
            return output.IndexOf('{') >= 0 ? Fill(output, vars) : output;
        }

        /// <summary>Подстановка значений, форм слова по числу и по полу героя (как fill в i18n.js).</summary>
        public static string Fill(string s, params (string key, object value)[] vars)
        {
            var sb = new StringBuilder(s.Length + 16);
            var i = 0;
            while (i < s.Length)
            {
                var c = s[i];
                if (c == '{' && TryToken(s, i, out var end, out var key, out var forms))
                {
                    sb.Append(Resolve(s.Substring(i, end - i + 1), key, forms, vars));
                    i = end + 1;
                    continue;
                }
                sb.Append(c);
                i++;
            }
            return sb.ToString();
        }

        // {word} или {word|a|b|...}: word — буквы/цифры/_, формы без { } |
        static bool TryToken(string s, int start, out int end, out string key, out List<string> forms)
        {
            end = -1; key = null; forms = null;
            var i = start + 1;
            while (i < s.Length && IsWord(s[i])) i++;
            if (i == start + 1 || i >= s.Length) return false;
            key = s.Substring(start + 1, i - start - 1);
            if (s[i] == '}') { end = i; return true; }
            if (s[i] != '|') return false;
            forms = new List<string>();
            while (i < s.Length && s[i] == '|')
            {
                var j = i + 1;
                while (j < s.Length && s[j] != '|' && s[j] != '{' && s[j] != '}') j++;
                if (j >= s.Length || s[j] == '{') return false;
                forms.Add(s.Substring(i + 1, j - i - 1));
                i = j;
            }
            if (i < s.Length && s[i] == '}') { end = i; return true; }
            return false;
        }

        static bool IsWord(char c) => c == '_' || (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');

        static string Resolve(string whole, string key, List<string> forms, (string key, object value)[] vars)
        {
            object v = null;
            var has = false;
            if (vars != null)
                foreach (var p in vars)
                    if (p.key == key) { v = p.value; has = v != null; break; }
            if (forms != null)
            {
                if (key == "f")
                {
                    var g = Gender() ? 0 : 1;
                    return g < forms.Count ? forms[g] : forms[0];
                }
                if (!has) return whole;
                return Plural(ToNumber(v), forms);
            }
            return has ? Convert.ToString(v, CultureInfo.InvariantCulture) : whole;
        }

        static double ToNumber(object v)
        {
            switch (v)
            {
                case int i: return i;
                case long l: return l;
                case double d: return d;
                case float f: return f;
                case string s when double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var x): return x;
                default: return 0;
            }
        }

        /// <summary>Число в записи текущего языка: 1,000 / 1 000.</summary>
        public static string Num(long n)
        {
            var culture = Lang == "en" ? "en-US" : Lang == "uk" ? "uk-UA" : "ru-RU";
            return n.ToString("#,0", CultureInfo.GetCultureInfo(culture));
        }
    }
}
