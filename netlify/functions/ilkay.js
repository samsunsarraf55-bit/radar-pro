exports.handler = async function () {
  try {
    const res = await fetch("http://ilkaydoviz.sdatam.com/", {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "text/html",
        Referer: "http://ilkaydoviz.sdatam.com/",
      },
    });
    const html = await res.text();
    const rates = [];
    const seen = {};
    const mainRe = /currency-name">\s*([^<]+)\s*<\/span>[\s\S]*?buy-price">\s*<span>([^<]+)<\/span>[\s\S]*?sell-price">\s*<span>([^<]+)<\/span>/gi;
    let m;
    while ((m = mainRe.exec(html))) {
      const code = m[1].trim().toUpperCase();
      if (seen[code]) continue;
      const alis = parseFloat(String(m[2]).replace(",", "."));
      const satis = parseFloat(String(m[3]).replace(",", "."));
      if (isNaN(alis) || isNaN(satis)) continue;
      seen[code] = 1;
      rates.push({ code, alis, satis });
    }
    const tickRe = /ticker-item">\s*([A-Z]{3})\s*<span class="ticker-buy">([^<]+)<\/span>\s*<span class="ticker-sep">\/<\/span>\s*<span class="ticker-sell">([^<]+)<\/span>/gi;
    while ((m = tickRe.exec(html))) {
      const c = m[1].toUpperCase();
      if (seen[c]) continue;
      const a = parseFloat(String(m[2]).replace(",", "."));
      const s = parseFloat(String(m[3]).replace(",", "."));
      if (isNaN(a) || isNaN(s)) continue;
      seen[c] = 1;
      rates.push({ code: c, alis: a, satis: s });
    }
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify({ source: "ilkay", time: new Date().toISOString(), data: rates }),
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: String(e.message || e) }),
    };
  }
};
