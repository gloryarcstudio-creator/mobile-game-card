// Как Unity берёт картинки из Resources/Art (их делает tools/unity/export_assets.py из WebP веб-версии).
// Все картинки рисуются интерфейсом как есть: без мип-уровней, без растягивания до степени двойки,
// с прозрачностью. На телефонах — сжатие ASTC: размер блока — это ручка «качество против веса приложения».
//   ea/  — раскадровки живых врагов, самая большая часть игры: 6×6 (около 3,6 бита на точку);
//   fx/  — ролики эффектов (свечение, мягкие края): тоже 6×6.
//   bg/, pic/, e/, h/ — большие рисунки: 5×5.
//   остальное (рамки, кнопки, карты, значки) — мелкие детали с чёткими краями: 4×4.
// Поменяли блок — Unity пережмёт картинки при следующем открытии проекта (Assets → Reimport All для верности).
using UnityEditor;

namespace Fitil.EditorTools
{
    public sealed class TextureImport : AssetPostprocessor
    {
        const string Art = "Assets/Fitil/Resources/Art/";

        void OnPreprocessTexture()
        {
            if (!assetPath.StartsWith(Art)) return;
            var ti = (TextureImporter)assetImporter;
            ti.textureType = TextureImporterType.Default;
            ti.npotScale = TextureImporterNPOTScale.None;
            ti.mipmapEnabled = false;
            ti.alphaSource = TextureImporterAlphaSource.FromInput;
            ti.alphaIsTransparency = true;
            ti.sRGBTexture = true;
            ti.isReadable = false;
            ti.wrapMode = UnityEngine.TextureWrapMode.Clamp;
            ti.filterMode = UnityEngine.FilterMode.Bilinear;
            ti.maxTextureSize = 4096;
            ti.textureCompression = TextureImporterCompression.CompressedHQ;

            var rel = assetPath.Substring(Art.Length);
            var block = rel.StartsWith("ea/") || rel.StartsWith("fx/") ? TextureImporterFormat.ASTC_6x6
                : rel.StartsWith("bg/") || rel.StartsWith("pic/") || rel.StartsWith("e/") || rel.StartsWith("h/") ? TextureImporterFormat.ASTC_5x5
                : TextureImporterFormat.ASTC_4x4;
            foreach (var platform in new[] { "Android", "iPhone" })
            {
                var ps = ti.GetPlatformTextureSettings(platform);
                ps.overridden = true;
                ps.maxTextureSize = 4096;
                ps.format = block;
                ps.compressionQuality = 50;
                ti.SetPlatformTextureSettings(ps);
            }
        }
    }
}
