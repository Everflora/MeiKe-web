(() => {
  'use strict';
  const notice = document.getElementById('pwa-notice');
  const message = document.getElementById('pwa-message');
  const update = document.getElementById('pwa-update');
  let registration, refreshing = false, dismissTimer;
  function show(text, persistent = false) {
    clearTimeout(dismissTimer);
    message.textContent = text;
    notice.hidden = false;
    if (!persistent) dismissTimer = setTimeout(() => notice.hidden = true, 6000);
  }
  window.meikeStartupFailed = () => {
    const text = document.getElementById('loading-message');
    if (text) text.textContent = '暂时无法打开，请检查网络后重试。已保存的课表不会因此被删除。';
    const retry = document.getElementById('retry');
    if (retry) retry.hidden = false;
  };
  document.getElementById('retry').onclick = () => location.reload();
  document.getElementById('pwa-dismiss').onclick = () => notice.hidden = true;
  update.onclick = () => {
    if (!registration?.waiting) return;
    refreshing = true;
    registration.waiting.postMessage({type: 'SKIP_WAITING'});
  };
  function available() {
    if (!registration?.waiting) return;
    update.hidden = false;
    show('梅课有新版本，保存当前编辑后即可更新。', true);
  }
  addEventListener('offline', () => show('当前已离线。缓存完成后仍可查看和编辑本机课表。'));
  addEventListener('online', () => { show('已恢复网络连接'); registration?.update().catch(() => {}); });
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) location.reload();
  });
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'OFFLINE_READY') show('离线资源已就绪，断网也能使用本机课表。');
  });
  navigator.serviceWorker.register(new URL('sw.js', document.baseURI), {scope: './', updateViaCache: 'none'})
    .then(value => {
      registration = value;
      available();
      value.addEventListener('updatefound', () => {
        const worker = value.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) available();
          if (worker.state === 'redundant') show('离线资源下载未完成，请保持联网后重新打开。原有课表会保留。');
        });
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') value.update().catch(() => {});
      });
    }).catch(() => show('离线资源尚未下载完成，请保持联网后重新打开。'));
})();
