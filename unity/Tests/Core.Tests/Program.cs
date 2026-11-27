// Маленький запускатель тестов без NuGet: каждый метод Test* в классах *Tests.
using System;
using System.IO;
using System.Linq;
using System.Reflection;

namespace Fitil.Tests
{
    public static class Program
    {
        public static string Root;

        public static int Main(string[] args)
        {
            Root = FindRoot();
            var filter = args.Length > 0 ? args[0] : null;
            int ok = 0, fail = 0;
            var tests = typeof(Program).Assembly.GetTypes()
                .Where(t => t.Name.EndsWith("Tests"))
                .SelectMany(t => t.GetMethods(BindingFlags.Public | BindingFlags.Static).Where(m => m.Name.StartsWith("Test")))
                .Where(m => filter == null || (m.DeclaringType.Name + "." + m.Name).Contains(filter));
            foreach (var m in tests)
            {
                var name = m.DeclaringType.Name + "." + m.Name;
                try { m.Invoke(null, null); ok++; Console.WriteLine("ok   " + name); }
                catch (TargetInvocationException e) { fail++; Console.WriteLine("FAIL " + name + ": " + e.InnerException.Message); }
            }
            Console.WriteLine($"{ok} ok, {fail} fail");
            return fail == 0 ? 0 : 1;
        }

        static string FindRoot()
        {
            var d = new DirectoryInfo(AppContext.BaseDirectory);
            while (d != null && !Directory.Exists(Path.Combine(d.FullName, "unity", "Assets", "Fitil"))) d = d.Parent;
            if (d == null) throw new Exception("не найден корень репозитория");
            return d.FullName;
        }

        public static string Data(string name) => File.ReadAllText(Path.Combine(Root, "unity", "Assets", "Fitil", "Resources", "Data", name));
        public static string Fixture(string name) => File.ReadAllText(Path.Combine(Root, "unity", "Tests", "Fixtures", name));
    }

    public sealed class AssertException : Exception { public AssertException(string m) : base(m) { } }

    public static class Assert
    {
        public static void True(bool c, string what) { if (!c) throw new AssertException(what); }
        public static void Equal<T>(T expected, T actual, string what)
        {
            if (!Equals(expected, actual)) throw new AssertException($"{what}: ждали «{expected}», получили «{actual}»");
        }
    }
}
