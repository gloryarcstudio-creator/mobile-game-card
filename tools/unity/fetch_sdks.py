#!/usr/bin/env python3
"""SDK, которые нельзя поставить пакетом из реестра: скачиваются перед сборкой в GitHub и в git не попадают.

  Tenjin   — TenjinUnityPackage.unitypackage со страницы Releases репозитория tenjin/tenjin-unity-sdk,
             распаковывается в unity/Assets (ставится всегда; без ключа TENJIN_SDK_KEY он в игре не запускается).
  Firebase — пакеты .tgz с dl.google.com (App, Analytics, Crashlytics, Remote Config), дописываются в
             unity/Packages/manifest.json. Ставится, только когда есть файлы настроек проекта Firebase:
             секреты FIREBASE_GOOGLE_SERVICES_JSON (Android) и FIREBASE_GOOGLE_SERVICE_INFO_PLIST (iOS),
             оба в base64. Без них Firebase в сборку не входит.

Значения секретов в журнал не печатаются. Если что-то не скачалось, сборка идёт дальше без этого SDK.
Запуск: python3 -I tools/unity/fetch_sdks.py
"""
import base64, io, json, os, sys, tarfile, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'unity')
CACHE = os.path.join(ROOT, 'SdkCache')
FIREBASE_VERSIONS = ['12.10.1', '12.10.0', '12.9.0', '12.8.0', '12.6.0', '12.5.0']
FIREBASE_PACKAGES = ['app', 'analytics', 'crashlytics', 'remote-config']


def get(url, headers=None, timeout=120):
    req = urllib.request.Request(url, headers=dict({'User-Agent': 'build-script'}, **(headers or {})))
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def tenjin():
    if os.environ.get('TARGET', '') not in ('Android', 'iOS'):
        print('Tenjin: нужен только на Android и iOS, для этой сборки не ставится')
        return
    headers = {'Accept': 'application/vnd.github+json'}
    if os.environ.get('GITHUB_TOKEN'):
        headers['Authorization'] = 'Bearer ' + os.environ['GITHUB_TOKEN']
    rel = json.loads(get('https://api.github.com/repos/tenjin/tenjin-unity-sdk/releases/latest', headers))
    assets = [a for a in rel.get('assets', []) if a['name'].lower().endswith('.unitypackage')]
    if not assets:
        raise RuntimeError('в выпуске %s нет .unitypackage' % rel.get('tag_name'))
    data = get(assets[0]['browser_download_url'], timeout=300)
    n = 0
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as tar:
        entries = {}
        for m in tar.getmembers():
            parts = m.name.strip('./').split('/')
            if len(parts) == 2 and m.isfile():
                entries.setdefault(parts[0], {})[parts[1]] = tar.extractfile(m).read()
        for guid, e in entries.items():
            if 'pathname' not in e:
                continue
            path = e['pathname'].decode('utf-8').split('\n')[0].strip()
            if not path.startswith('Assets/') or '..' in path:
                continue
            # менеджер зависимостей уже стоит пакетом вместе с рекламой Google: вторая копия дала бы конфликт
            if path.startswith(('Assets/ExternalDependencyManager', 'Assets/PlayServicesResolver')):
                continue
            dst = os.path.join(ROOT, path)
            if 'asset' in e:
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                with open(dst, 'wb') as f:
                    f.write(e['asset'])
                n += 1
            else:
                os.makedirs(dst, exist_ok=True)
            if 'asset.meta' in e:
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                with open(dst + '.meta', 'wb') as f:
                    f.write(e['asset.meta'])
    print('Tenjin %s: %s, файлов %d' % (rel.get('tag_name'), assets[0]['name'], n))


def secret_file(env, path):
    v = os.environ.get(env, '').strip()
    if not v:
        return False
    try:
        data = base64.b64decode(v, validate=True)
    except Exception:
        data = v.encode('utf-8')   # секрет положили как есть, без base64
    with open(path, 'wb') as f:
        f.write(data)
    return True


def firebase():
    android = secret_file('FIREBASE_GOOGLE_SERVICES_JSON', os.path.join(ROOT, 'Assets', 'google-services.json'))
    ios = secret_file('FIREBASE_GOOGLE_SERVICE_INFO_PLIST', os.path.join(ROOT, 'Assets', 'GoogleService-Info.plist'))
    target = os.environ.get('TARGET', '')
    if os.environ.get('FIREBASE_PROBE') == 'true' and target == 'Android' and not android:
        # проверка сборки без проекта Firebase: файл-пустышка, данные по нему никуда не уходят
        with open(os.path.join(ROOT, 'Assets', 'google-services.json'), 'w') as f:
            json.dump({'project_info': {'project_number': '100000000000', 'project_id': 'probe-build',
                                        'storage_bucket': 'probe-build.appspot.com'},
                       'client': [{'client_info': {'mobilesdk_app_id': '1:100000000000:android:0000000000000000',
                                                   'android_client_info': {'package_name': 'com.protekgames.lastray'}},
                                   'oauth_client': [], 'api_key': [{'current_key': 'probe-build-key'}],
                                   'services': {'appinvite_service': {'other_platform_oauth_client': []}}}],
                       'configuration_version': '1'}, f)
        android = True
        print('Firebase: пробная сборка с файлом-пустышкой')
    need = android if target == 'Android' else ios if target == 'iOS' else False
    print('Firebase: файл настроек Android %s, iOS %s' % ('есть' if android else 'нет', 'есть' if ios else 'нет'))
    if not need:
        print('Firebase: для сборки %s файла настроек нет, пакеты не ставятся' % (target or 'без платформы'))
        return
    os.makedirs(CACHE, exist_ok=True)
    last = None
    for ver in FIREBASE_VERSIONS:
        try:
            files = {}
            for p in FIREBASE_PACKAGES:
                name = 'com.google.firebase.%s' % p
                tgz = '%s-%s.tgz' % (name, ver)
                dst = os.path.join(CACHE, tgz)
                if not os.path.exists(dst):
                    data = get('https://dl.google.com/games/registry/unity/%s/%s' % (name, tgz), timeout=600)
                    with open(dst, 'wb') as f:
                        f.write(data)
                files[name] = 'file:../SdkCache/' + tgz
            manifest = os.path.join(ROOT, 'Packages', 'manifest.json')
            with open(manifest, encoding='utf-8') as f:
                m = json.load(f)
            m['dependencies'].update(files)
            with open(manifest, 'w', encoding='utf-8') as f:
                json.dump(m, f, indent=2)
            print('Firebase %s: пакеты %s' % (ver, ', '.join(FIREBASE_PACKAGES)))
            return
        except Exception as e:
            last = e
    raise RuntimeError('пакеты не скачались: %s' % last)


for name, step in (('Tenjin', tenjin), ('Firebase', firebase)):
    try:
        step()
    except Exception as e:
        print('::warning::%s не подключён: %s' % (name, e))
