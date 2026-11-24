// Настройки импорта звука, чтобы их не надо было ставить руками в редакторе.
// Музыка: сжатая в памяти (Vorbis), чтобы петли склеивались точно и дорожка не занимала десятки мегабайт.
// Звуки: распаковываются при загрузке, они короткие и должны звучать без задержки.
using UnityEditor;
using UnityEngine;

namespace Fitil.EditorTools
{
    public sealed class AudioImport : AssetPostprocessor
    {
        void OnPreprocessAudio()
        {
            var path = assetPath.Replace('\\', '/');
            var music = path.Contains("/Resources/Audio/Music/");
            var sfx = path.Contains("/Resources/Audio/Sfx/");
            if (!music && !sfx) return;
            var imp = (AudioImporter)assetImporter;
            var s = imp.defaultSampleSettings;
            s.compressionFormat = AudioCompressionFormat.Vorbis;
            s.loadType = music ? AudioClipLoadType.CompressedInMemory : AudioClipLoadType.DecompressOnLoad;
            s.quality = music ? 0.6f : 0.7f;
            s.sampleRateSetting = AudioSampleRateSetting.PreserveSampleRate;
            imp.defaultSampleSettings = s;
            imp.loadInBackground = false;
            imp.forceToMono = false;
        }
    }
}
