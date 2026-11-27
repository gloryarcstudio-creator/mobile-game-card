// Маленький разборщик JSON для Fitil.Core: без UnityEngine, чтобы Core собирался и тестировался через dotnet.
// Объект -> Dictionary<string, object> (порядок ключей сохраняется), массив -> List<object>,
// число -> double, строка -> string, true/false -> bool, null -> null.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Fitil.Core
{
    public static class Json
    {
        public static object Parse(string text)
        {
            var p = new Parser(text);
            p.Ws();
            var v = p.Value();
            p.Ws();
            if (p.Pos != text.Length) throw p.Error("лишние символы после JSON");
            return v;
        }

        public static Dictionary<string, object> Obj(object v) => v as Dictionary<string, object>;
        public static List<object> Arr(object v) => v as List<object>;
        public static string Str(object v, string def = null) => v as string ?? def;
        public static double Num(object v, double def = 0) => v is double d ? d : def;
        public static int Int(object v, int def = 0) => v is double d ? (int)d : v is bool b ? (b ? 1 : 0) : def;
        public static bool Bool(object v, bool def = false) => v is bool b ? b : def;

        public static object Get(Dictionary<string, object> o, string key) =>
            o != null && o.TryGetValue(key, out var v) ? v : null;

        public static string Write(object v)
        {
            var sb = new StringBuilder();
            WriteValue(sb, v);
            return sb.ToString();
        }

        static void WriteValue(StringBuilder sb, object v)
        {
            switch (v)
            {
                case null: sb.Append("null"); break;
                case string s: WriteString(sb, s); break;
                case bool b: sb.Append(b ? "true" : "false"); break;
                case double d: sb.Append(d.ToString("R", CultureInfo.InvariantCulture)); break;
                case float f: sb.Append(((double)f).ToString("R", CultureInfo.InvariantCulture)); break;
                case int i: sb.Append(i.ToString(CultureInfo.InvariantCulture)); break;
                case long l: sb.Append(l.ToString(CultureInfo.InvariantCulture)); break;
                case uint u: sb.Append(u.ToString(CultureInfo.InvariantCulture)); break;
                case IDictionary<string, object> o:
                    sb.Append('{');
                    var first = true;
                    foreach (var kv in o)
                    {
                        if (!first) sb.Append(',');
                        first = false;
                        WriteString(sb, kv.Key);
                        sb.Append(':');
                        WriteValue(sb, kv.Value);
                    }
                    sb.Append('}');
                    break;
                case System.Collections.IEnumerable list:
                    sb.Append('[');
                    var f2 = true;
                    foreach (var x in list)
                    {
                        if (!f2) sb.Append(',');
                        f2 = false;
                        WriteValue(sb, x);
                    }
                    sb.Append(']');
                    break;
                default: throw new ArgumentException("Json.Write: тип " + v.GetType());
            }
        }

        static void WriteString(StringBuilder sb, string s)
        {
            sb.Append('"');
            foreach (var c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4"));
                        else sb.Append(c);
                        break;
                }
            }
            sb.Append('"');
        }

        sealed class Parser
        {
            readonly string s;
            public int Pos;
            public Parser(string text) { s = text; }

            public FormatException Error(string what) => new FormatException($"JSON: {what} (символ {Pos})");

            public void Ws()
            {
                while (Pos < s.Length && (s[Pos] == ' ' || s[Pos] == '\n' || s[Pos] == '\r' || s[Pos] == '\t' || s[Pos] == '﻿')) Pos++;
            }

            public object Value()
            {
                if (Pos >= s.Length) throw Error("неожиданный конец");
                var c = s[Pos];
                switch (c)
                {
                    case '{': return Object();
                    case '[': return Array();
                    case '"': return String();
                    case 't': Word("true"); return true;
                    case 'f': Word("false"); return false;
                    case 'n': Word("null"); return null;
                    default:
                        if (c == '-' || (c >= '0' && c <= '9')) return Number();
                        throw Error("неожиданный символ '" + c + "'");
                }
            }

            void Word(string w)
            {
                if (string.CompareOrdinal(s, Pos, w, 0, w.Length) != 0) throw Error("ожидалось " + w);
                Pos += w.Length;
            }

            Dictionary<string, object> Object()
            {
                var o = new Dictionary<string, object>();
                Pos++;
                Ws();
                if (Pos < s.Length && s[Pos] == '}') { Pos++; return o; }
                while (true)
                {
                    Ws();
                    if (Pos >= s.Length || s[Pos] != '"') throw Error("ожидался ключ");
                    var k = String();
                    Ws();
                    if (Pos >= s.Length || s[Pos] != ':') throw Error("ожидалось ':'");
                    Pos++;
                    Ws();
                    o[k] = Value();
                    Ws();
                    if (Pos >= s.Length) throw Error("незакрытый объект");
                    if (s[Pos] == ',') { Pos++; continue; }
                    if (s[Pos] == '}') { Pos++; return o; }
                    throw Error("ожидалось ',' или '}'");
                }
            }

            List<object> Array()
            {
                var a = new List<object>();
                Pos++;
                Ws();
                if (Pos < s.Length && s[Pos] == ']') { Pos++; return a; }
                while (true)
                {
                    Ws();
                    a.Add(Value());
                    Ws();
                    if (Pos >= s.Length) throw Error("незакрытый массив");
                    if (s[Pos] == ',') { Pos++; continue; }
                    if (s[Pos] == ']') { Pos++; return a; }
                    throw Error("ожидалось ',' или ']'");
                }
            }

            string String()
            {
                Pos++;
                var sb = new StringBuilder();
                while (true)
                {
                    if (Pos >= s.Length) throw Error("незакрытая строка");
                    var c = s[Pos++];
                    if (c == '"') return sb.ToString();
                    if (c != '\\') { sb.Append(c); continue; }
                    if (Pos >= s.Length) throw Error("незакрытая строка");
                    var e = s[Pos++];
                    switch (e)
                    {
                        case '"': sb.Append('"'); break;
                        case '\\': sb.Append('\\'); break;
                        case '/': sb.Append('/'); break;
                        case 'b': sb.Append('\b'); break;
                        case 'f': sb.Append('\f'); break;
                        case 'n': sb.Append('\n'); break;
                        case 'r': sb.Append('\r'); break;
                        case 't': sb.Append('\t'); break;
                        case 'u':
                            if (Pos + 4 > s.Length) throw Error("короткий \\u");
                            sb.Append((char)int.Parse(s.Substring(Pos, 4), NumberStyles.HexNumber, CultureInfo.InvariantCulture));
                            Pos += 4;
                            break;
                        default: throw Error("неизвестная escape-последовательность");
                    }
                }
            }

            double Number()
            {
                var start = Pos;
                if (s[Pos] == '-') Pos++;
                while (Pos < s.Length && "0123456789.eE+-".IndexOf(s[Pos]) >= 0) Pos++;
                return double.Parse(s.Substring(start, Pos - start), NumberStyles.Float, CultureInfo.InvariantCulture);
            }
        }
    }
}
