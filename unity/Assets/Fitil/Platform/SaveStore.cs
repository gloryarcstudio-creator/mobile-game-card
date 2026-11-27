// Сохранения: те же части, что ключи localStorage веб-версии
// (lastray.save.<story>, lastray.settings, lastray.stats, lastray.ach, lastray.store, last-ray-audio),
// только каждая — свой JSON-файл в Application.persistentDataPath.
// Запись идёт во временный файл и потом заменяет старый, чтобы севший телефон не оставил полфайла.
using System;
using System.IO;
using UnityEngine;

namespace Fitil.Platform
{
    public static class SaveStore
    {
        static string Dir => Path.Combine(Application.persistentDataPath, "save");

        static string PathOf(string key)
        {
            foreach (var c in Path.GetInvalidFileNameChars()) key = key.Replace(c, '_');
            return Path.Combine(Dir, key + ".json");
        }

        public static string Read(string key)
        {
            try
            {
                var p = PathOf(key);
                if (File.Exists(p)) return File.ReadAllText(p);
                var bak = p + ".bak";
                return File.Exists(bak) ? File.ReadAllText(bak) : null;
            }
            catch (Exception e)
            {
                Debug.LogWarning($"Сохранение {key} не прочиталось: {e.Message}");
                return null;
            }
        }

        public static bool Write(string key, string json)
        {
            try
            {
                Directory.CreateDirectory(Dir);
                var p = PathOf(key);
                var tmp = p + ".tmp";
                File.WriteAllText(tmp, json);
                if (File.Exists(p)) File.Replace(tmp, p, p + ".bak");
                else File.Move(tmp, p);
                return true;
            }
            catch (Exception e)
            {
                Debug.LogWarning($"Сохранение {key} не записалось: {e.Message}");
                return false;
            }
        }

        public static void Remove(string key)
        {
            try
            {
                var p = PathOf(key);
                if (File.Exists(p)) File.Delete(p);
                if (File.Exists(p + ".bak")) File.Delete(p + ".bak");
            }
            catch (Exception e) { Debug.LogWarning($"Сохранение {key} не удалилось: {e.Message}"); }
        }
    }
}
