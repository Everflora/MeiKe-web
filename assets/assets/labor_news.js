// Table mapping adapted from zz6zz666/SEU-Labor-Course-Pusher (MIT).
// See THIRD_PARTY_NOTICES.md. Only course fields are returned to the app.
/*
MIT License
Copyright (c) 2026 zz6zz666

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
globalThis.MeikeLaborParse = doc => {
  const table = doc.querySelector('#c_app_page_index_XuanKe_table');
  if (!table) throw new Error('未找到劳动教育课程列表，请完成登录并进入选课页面。');
  const rows = [...table.querySelectorAll('tbody > tr.c--tr, tbody > tr.c-tr')];
  if (!table.querySelector('tbody') || (rows.length === 0 &&
      [...table.querySelectorAll('tbody > tr')].some(row => row.querySelectorAll('td').length > 1))) {
    throw new Error('学校课程表结构发生变化，请稍后重试。');
  }
  if (rows.length > 3000) throw new Error('课程列表过大，请稍后重试。');
  const clean = value => (value || '').replace(/\s+/g, ' ').trim();
  const result = rows.map(row => {
    const cells = [...row.children].filter(node => node.tagName === 'TD');
    const text = index => clean(cells[index - 1]?.textContent);
    const offset = /^\d+$/.test(text(1)) && !/^\d+$/.test(text(2)) ? 0 : 1;
    if (cells.length < 10 + offset) throw new Error('学校课程表结构发生变化，请稍后重试。');
    const ids = {};
    cells[0].querySelectorAll('td-data').forEach(node => {
      const name = node.getAttribute('data-name');
      if (name === 'SJItemID' || name === 'SJItemKaiKeID') ids[name] = clean(node.getAttribute('data-value'));
    });
    const item = {
      itemId: ids.SJItemID || '', offeringId: ids.SJItemKaiKeID || '',
      name: text(3 + offset), category: text(4 + offset),
      location: clean(cells[6 + offset]?.querySelector('.limit-line')?.textContent) || text(7 + offset),
      time: text(8 + offset), deadline: text(9 + offset),
      enrollment: text(10 + offset), teacher: text(15 + offset),
    };
    if (!item.name) throw new Error('课程名称缺失，未更新新闻列表。');
    if (Object.values(item).some(value => value.length > 2000)) throw new Error('课程信息过长，未更新新闻列表。');
    return item;
  });
  return result;
};
(async () => {
  if (typeof __MEIKE_LABOR_NONCE__ === 'undefined') return;
  const nonce = __MEIKE_LABOR_NONCE__;
  const send = value => MeiKeLaborNews.postMessage(JSON.stringify({nonce, ...value}));
  let timer;
  try {
    const marker = '/SJItemKaiKe/XuanKe/Index';
    if (location.protocol !== 'https:' || !/(^|\.)seu\.edu\.cn$/.test(location.hostname) || !location.pathname.includes(marker)) {
      throw new Error('请先完成登录并打开劳动教育选课页面。');
    }
    const abort = new AbortController();
    timer = setTimeout(() => abort.abort(), 20000);
    // Fetch the complete server-rendered table, unaffected by client-side paging.
    const response = await fetch(location.href, {credentials:'same-origin', signal:abort.signal});
    if (!response.ok) throw new Error('劳动教育平台暂时不可用，请稍后重试。');
    const html = await response.text();
    if (html.length > 3000000) throw new Error('学校页面过大，未更新新闻列表。');
    const rows = MeikeLaborParse(new DOMParser().parseFromString(html, 'text/html'));
    send({kind:'courses', rows});
  } catch (error) {
    send({kind:'error', message:error.name === 'AbortError' ? '读取超时，请刷新后重试。' : error.message});
  } finally { clearTimeout(timer); }
})();
