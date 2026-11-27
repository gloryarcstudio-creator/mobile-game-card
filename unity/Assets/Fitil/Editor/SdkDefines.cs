// Условие FITIL_TENJIN: плагин Tenjin ставится файлом .unitypackage, без пакета и без своей сборки, поэтому
// узнать о нём по пакету нельзя. Условие ставится, когда в проекте есть его класс, и снимается, когда плагин убрали.
// (Google Mobile Ads и Firebase включаются по пакетам, см. asmdef в Platform/Ads и Platform/Firebase.)
using System;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;

namespace Fitil.EditorTools
{
    [InitializeOnLoad]
    public static class SdkDefines
    {
        const string Define = "FITIL_TENJIN";

        static SdkDefines()
        {
            EditorApplication.delayCall += Sync;
        }

        [MenuItem("Fitil/SDK/Refresh defines")]
        public static void Sync()
        {
            if (EditorUtility.scriptCompilationFailed || EditorApplication.isCompiling) return;
            var has = AppDomain.CurrentDomain.GetAssemblies().Any(a => { try { return a.GetType("BaseTenjin", false) != null; } catch { return false; } });
            Set(NamedBuildTarget.Android, has);
            Set(NamedBuildTarget.iOS, has);
        }

        static void Set(NamedBuildTarget target, bool on)
        {
            var list = PlayerSettings.GetScriptingDefineSymbols(target).Split(';').Where(x => x.Length > 0).ToList();
            if (list.Contains(Define) == on) return;
            if (on) list.Add(Define); else list.Remove(Define);
            PlayerSettings.SetScriptingDefineSymbols(target, string.Join(";", list));
            Debug.Log(on ? "Tenjin найден: атрибуция включена (условие FITIL_TENJIN)." : "Tenjin не найден: условие FITIL_TENJIN убрано.");
        }
    }
}
