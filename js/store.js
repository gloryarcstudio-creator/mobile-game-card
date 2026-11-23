/* Магазин и реклама.
   В прототипе покупки и реклама только имитируются: деньги не списываются, вместо ролика показывается заглушка.
   Для релиза замените две функции внизу (realBuy и realAd) вызовами SDK площадки:
   платежи — Google Play Billing, RuStore, App Store или Яндекс Игры; реклама за награду — AdMob, Яндекс Реклама и т. п.
   Остальная игра пользуется только window.Store и не знает, откуда пришла покупка или реклама. */
(function () {
  const { CLASSES } = window.Data;
  const KEY = 'lastray.store';
  const AD_SECONDS = 5;

  // Цены условные: их задаёт площадка, здесь только подпись на кнопке
  // v177: все цены по $5, так попросил автор игры (было $1.99 герой, $3.99 все герои, $2.99 без рекламы)
  const PRICE = { hero: '$5', pack: '$5', noads: '$5' };

  // Платные герои отмечены в CLASSES полем paid: true (js/data.js)
  const paidHeroes = Object.keys(CLASSES).filter((id) => CLASSES[id].paid);
  const PRODUCTS = {};
  paidHeroes.forEach((id) => { PRODUCTS[`hero_${id}`] = { kind: 'hero', cls: id, price: PRICE.hero, name: `${CLASSES[id].name}, ${CLASSES[id].role.toLowerCase()}` }; });
  PRODUCTS.heroes = { kind: 'pack', gives: paidHeroes.map((id) => `hero_${id}`), price: PRICE.pack, name: tr('Все платные герои') };
  PRODUCTS.noads = { kind: 'noads', price: PRICE.noads, name: tr('Без рекламы') };

  const load = () => { try { return { owned: [], ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { return { owned: [] }; } };
  const state = load();
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* хранилище недоступно */ } };
  const grant = (id) => {
    const p = PRODUCTS[id];
    (p && p.kind === 'pack' ? p.gives : [id]).forEach((x) => { if (!state.owned.includes(x)) state.owned.push(x); });
    persist();
  };

  const owns = (id) => state.owned.includes(id);
  const heroOwned = (cls) => !CLASSES[cls] || !CLASSES[cls].paid || owns(`hero_${cls}`);
  const noAds = () => owns('noads');

  /* ---------- окно поверх игры для покупки и ролика ---------- */
  let layer = null;
  function show(html) {
    if (!layer) { layer = document.createElement('div'); layer.id = 'storelayer'; document.getElementById('app').appendChild(layer); }
    layer.innerHTML = html; layer.className = 'show';
    return layer;
  }
  function hide() { if (layer) { layer.className = ''; layer.innerHTML = ''; } }

  // Заглушка покупки: окно подтверждения. Возвращает true, если покупка прошла.
  function realBuy(id) {
    const p = PRODUCTS[id];
    return new Promise((resolve) => {
      const el = show(`<div class="sl-box">
        <small class="sl-test">${tr('Тестовая покупка')}</small>
        <h2>${p.name}</h2>
        <p>${tr('Цена {p}. Это тестовая версия: деньги не списываются, покупка просто откроется.', { p: p.price })}</p>
        <button class="btn" data-sl="ok">${tr('Купить за {p}', { p: p.price })}</button>
        <button class="btn ghost" data-sl="no">${tr('Отмена')}</button></div>`);
      el.onclick = (e) => { const b = e.target.closest('[data-sl]'); if (!b) return; hide(); resolve(b.dataset.sl === 'ok'); };
    });
  }

  // Заглушка рекламы за награду: ролик на AD_SECONDS секунд. true — досмотрено, награда положена.
  function realAd(reason) {
    return new Promise((resolve) => {
      let left = AD_SECONDS;
      const el = show(`<div class="sl-ad">
        <button class="sl-close" data-sl="close" aria-label="${tr('Закрыть')}">✕</button>
        <small class="sl-test">${tr('Реклама')}</small>
        <div class="sl-screen"><b>${tr('Здесь будет рекламный ролик')}</b><span>${reason || tr('Награда после просмотра')}</span></div>
        <div class="sl-timer">${tr('Награда через <b>{n}</b> с', { n: left })}</div></div>`);
      const tick = () => {
        if (!layer || !layer.classList.contains('show')) return;
        left--;
        const t = el.querySelector('.sl-timer');
        if (!t) return; // окно уже закрыли или подменили
        if (left > 0) { t.innerHTML = tr('Награда через <b>{n}</b> с', { n: left }); setTimeout(tick, 1000); }
        else t.outerHTML = `<button class="btn" data-sl="done">${tr('Забрать награду')}</button>`;
      };
      setTimeout(tick, 1000);
      el.onclick = (e) => {
        const b = e.target.closest('[data-sl]'); if (!b) return;
        if (b.dataset.sl === 'done') { hide(); resolve(true); }
        if (b.dataset.sl === 'close') { hide(); resolve(false); }
      };
    });
  }

  window.Store = {
    PRODUCTS, paidHeroes, owns, heroOwned, noAds,
    // купить товар; после успешной оплаты товар сразу открыт
    async buy(id) { if (owns(id)) return true; const ok = await realBuy(id); if (ok) grant(id); return ok; },
    // посмотреть рекламу за награду; в режиме без рекламы награда сразу
    async ad(reason) { if (noAds()) return true; return realAd(reason); },
    // восстановить покупки: у площадки спрашиваем, что куплено (в прототипе всё и так хранится в браузере)
    async restore() { return state.owned.length; },
    // только для тестовой версии: снова закрыть всё купленное
    resetTest() { state.owned = []; persist(); },
  };
})();
