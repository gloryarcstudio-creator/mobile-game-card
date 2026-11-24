// Плагин Google Mobile Ads ставят двумя способами: пакетом (тогда условие FITIL_ADMOB ставит сам Unity,
// см. Platform/Ads/Fitil.Platform.Ads.asmdef) или файлом .unitypackage в Assets — тогда условие ставит этот скрипт.
// С условием собирается Fitil.Platform.Ads, и реклама за награду становится настоящей.
// Если плагин удалили, а условие осталось и проект не собирается: Player Settings → Scripting Define Symbols, убрать FITIL_ADMOB.
using System;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;

namespace Fitil.EditorTools
{
    [InitializeOnLoad]
    public static class AdsDefine
    {
        const string Define = "FITIL_ADMOB";

        static AdsDefine()
        {
            EditorApplication.delayCall += Sync;
        }

        static void Sync()
        {
            var has = AppDomain.CurrentDomain.GetAssemblies().Any(a => a.GetType("GoogleMobileAds.Api.MobileAds", false) != null);
            Set(NamedBuildTarget.Android, has);
            Set(NamedBuildTarget.iOS, has);
        }

        static void Set(NamedBuildTarget target, bool on)
        {
            var list = PlayerSettings.GetScriptingDefineSymbols(target).Split(';').Where(x => x.Length > 0).ToList();
            if (list.Contains(Define) == on) return;
            if (on) list.Add(Define); else list.Remove(Define);
            PlayerSettings.SetScriptingDefineSymbols(target, string.Join(";", list));
            Debug.Log(on ? "Google Mobile Ads найден: реклама за награду теперь настоящая (условие FITIL_ADMOB)."
                         : "Google Mobile Ads не найден: реклама за награду тестовая (условие FITIL_ADMOB убрано).");
        }
    }
}
