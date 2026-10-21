// SEU's wdkb API paths/field names were verified against the public SEUTimetable
// adapter. This is an independent implementation; no login form is inspected.
// No cookies, credentials, student identifiers, or raw response text are sent.
(async () => {
  const nonce = __MEIKE_NONCE__;
  const requestedTerm = __MEIKE_TERM__;
  const send = payload => MeiKeSchoolImport.postMessage(JSON.stringify({ nonce, ...payload }));
  try {
    const marker = '/jwapp/sys/wdkb/';
    const index = location.pathname.indexOf(marker);
    if (location.protocol !== 'https:' || !/(^|\.)seu\.edu\.cn$/.test(location.hostname) || index < 0) {
      throw new Error('请先完成校园登录，进入学校课表页面后再读取。');
    }
    // Preserve the proxy prefix when an on-campus app is opened through WebVPN.
    const base = location.pathname.slice(0, index) + marker;
    const get = async (path, query) => {
      const url = new URL(base + path, location.origin);
      Object.entries(query || {}).forEach(([key, value]) => url.searchParams.set(key, value));
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 20000);
      try {
        const response = await fetch(url.toString(), { credentials: 'same-origin', signal: abort.signal });
        if (!response.ok) throw new Error('学校课表服务暂时不可用，请稍后重试。');
        const text = await response.text();
        if (text.length > 2000000) throw new Error('课表数据过大，无法导入。');
        try { return JSON.parse(text); } catch (_) {
          throw new Error('登录状态可能已失效，请重新登录并进入课表页面。');
        }
      } finally { clearTimeout(timer); }
    };
    const termResult = await get('modules/jshkcb/xnxqcx.do');
    const terms = termResult?.datas?.xnxqcx?.rows;
    if (!Array.isArray(terms) || !terms.length || terms.length > 200) {
      throw new Error('未读到学期信息，请确认已登录学校课表。');
    }
    if (terms.some(t => !t || t.DM == null || !String(t.DM).trim() || typeof t.MC !== 'string' || !t.MC.trim())) {
      throw new Error('学校返回的学期信息无效，请刷新后重试。');
    }
    let selected = requestedTerm && terms.find(t => String(t.DM) === requestedTerm);
    if (requestedTerm && !selected) throw new Error('所选学期已不可用，请重新读取。');
    if (!selected) {
      const visible = document.body.innerText;
      const visibleTerms = terms.filter(t => t.MC && visible.includes(String(t.MC)));
      if (visibleTerms.length === 1) selected = visibleTerms[0];
    }
    if (!selected) {
      send({ kind: 'terms', terms: terms.map(t => ({ code: String(t.DM), name: String(t.MC) })) });
      return;
    }
    const rows = [];
    const seenPages = new Set();
    let total;
    for (let page = 1; page <= 50; page++) {
      const result = await get('modules/xskcb/xskcb.do', {
        XNXQDM: String(selected.DM), pageNumber: String(page), pageSize: '100'
      });
      const table = result?.datas?.xskcb;
      if (!table || !Array.isArray(table.rows)) throw new Error('未读到课程，请确认已登录且所选学期有课表。');
      if (page === 1) {
        if (table.totalCount != null) {
          total = Number(table.totalCount);
          if (!Number.isInteger(total) || total < 0 || total > 5000) throw new Error('课程数量超出支持范围。');
        }
      }
      // Only forward scheduling fields; the full API response stays in WebView.
      const pageRows = table.rows.map(r => ({
        KCM: r.KCM ?? r.KCMC, KCH: r.KCH, JXBID: r.JXBID, JXBH: r.JXBH,
        SKJS: r.SKJS, JASMC: r.JASMC, SKXQ: r.SKXQ,
        KSJC: r.KSJC, JSJC: r.JSJC, ZCMC: r.ZCMC
      }));
      const signature = JSON.stringify(pageRows);
      if (seenPages.has(signature)) throw new Error('学校课表分页未返回完整数据，请重试。');
      seenPages.add(signature);
      rows.push(...pageRows);
      if (rows.length > 5000) throw new Error('课程数量超出支持范围。');
      if (total != null && rows.length >= total) break;
      if (table.rows.length < 100 && total == null) break;
      if (!table.rows.length || page === 50) throw new Error('未读取到完整课表，请重试。');
    }
    if (!rows.length) throw new Error('所选学期没有已排课课程，请切换学期后重试。');
    if (total != null && rows.length !== total) throw new Error('课程数量与学校返回的总数不一致，请重试。');
    send({ kind: 'success', termCode: String(selected.DM), termName: String(selected.MC), rows });
  } catch (error) {
    send({ kind: 'error', message: error.name === 'AbortError' ? '学校课表读取超时，请检查校园网 / VPN 后重试。' : (error.message || '课表读取失败，请重试。') });
  }
})();
