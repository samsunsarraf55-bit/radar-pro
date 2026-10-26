/**
 * RADAR PRO — Cloudflare Worker
 * Sadece JavaScript. HTML yapistirmayin.
 * HTML: GitHub radar-pro-latest.html
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Cache-Control": "no-store",
};

const HTML_URLS = [
  "https://raw.githubusercontent.com/samsunsarraf55-bit/radar-pro/main/altin-fiyatlari%20(1).html",
  "https://cdn.jsdelivr.net/gh/samsunsarraf55-bit/radar-pro@main/altin-fiyatlari%20(1).html",
  "https://raw.githubusercontent.com/samsunsarraf55-bit/radar-pro/main/index.html",
  "https://raw.githubusercontent.com/samsunsarraf55-bit/radar-pro/main/radar-pro-latest.html",
  "https://raw.githubusercontent.com/samsunsarraf55-bit/radar-pro/main/altin-fiyatlari.html",
];

const SOURCES = {
  kaptan: { url: "https://www.kaptandoviz.com/kurlar/api.php" },
  gunes: { url: "https://api.guneskuyumculuk.net/temp-server/merkez/data" },
  solis: { url: "https://api.solisdoviz.com/data/5959NguJERffE_doviz" },
  sar: {
    url: "https://sardoviz.com/?ajax=1",
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json",
      Referer: "https://sardoviz.com/",
    },
  },
  altinkose: {
    url: "https://www.altinkose.com.tr/api/storefront",
    method: "POST",
    body: JSON.stringify({ islem: "kurlar" }),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: "https://www.altinkose.com.tr",
      Referer: "https://www.altinkose.com.tr/canli-altin-fiyatlari",
    },
  },
  ilkay: {
    url: "http://ilkaydoviz.sdatam.com/",
    headers: { Accept: "text/html", Referer: "http://ilkaydoviz.sdatam.com/" },
    parseHtml: true,
  },
};

const VIZYON_ADJ = {
  KULCEALTIN: { alis: 0, satis: 5 },
  AYAR22: { alis: 15, satis: -20 },
  CEYREK_YENI: { alis: -240, satis: -120 },
  YARIM_YENI: { alis: -420, satis: -310 },
  TEK_YENI: { alis: -715, satis: -560 },
  ATA_YENI: { alis: -100, satis: -275 },
};
const VIZYON_ALLOW = ["KULCEALTIN", "AYAR22", "CEYREK_YENI", "YARIM_YENI", "TEK_YENI", "ATA_YENI"];

function json(data, status) {
  status = status || 200;
  return new Response(JSON.stringify(data), {
    status: status,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, CORS_HEADERS),
  });
}

function parseIlkayHtml(html) {
  var rates = [], seen = {};
  var m, mainRe = /currency-name">\s*([^<]+)\s*<\/span>[\s\S]*?buy-price">\s*<span>([^<]+)<\/span>[\s\S]*?sell-price">\s*<span>([^<]+)<\/span>/gi;
  while ((m = mainRe.exec(html))) {
    var code = m[1].trim().toUpperCase();
    if (seen[code]) continue;
    var alis = parseFloat(String(m[2]).replace(",", "."));
    var satis = parseFloat(String(m[3]).replace(",", "."));
    if (isNaN(alis) || isNaN(satis)) continue;
    seen[code] = 1;
    rates.push({ code: code, alis: alis, satis: satis });
  }
  var tickRe = /ticker-item">\s*([A-Z]{3})\s*<span class="ticker-buy">([^<]+)<\/span>\s*<span class="ticker-sep">\/<\/span>\s*<span class="ticker-sell">([^<]+)<\/span>/gi;
  while ((m = tickRe.exec(html))) {
    var c = m[1].toUpperCase();
    if (seen[c]) continue;
    var a = parseFloat(String(m[2]).replace(",", "."));
    var s = parseFloat(String(m[3]).replace(",", "."));
    if (isNaN(a) || isNaN(s)) continue;
    seen[c] = 1;
    rates.push({ code: c, alis: a, satis: s });
  }
  return { source: "ilkay", time: new Date().toISOString(), data: rates };
}

async function fetchSource(key) {
  var spec = SOURCES[key];
  if (!spec) throw new Error("unknown source");
  var headers = Object.assign({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
  }, spec.headers || {});
  var opts = { method: spec.method || "GET", headers: headers };
  if (spec.body) opts.body = spec.body;
  var res = await fetch(spec.url, opts);
  var text = await res.text();
  if (spec.parseHtml) return parseIlkayHtml(text);
  return JSON.parse(text.replace(/^\uFEFF/, ""));
}

async function fetchVizyon() {
  return new Promise(function (resolve, reject) {
    var url = "wss://socket.haremaltin.com/socket.io/?EIO=4&transport=websocket";
    var settled = false, ws;
    var timer = setTimeout(function () {
      if (!settled) {
        settled = true;
        try { if (ws) ws.close(); } catch (e) {}
        reject(new Error("vizyon timeout"));
      }
    }, 15000);
    try { ws = new WebSocket(url); } catch (e) { clearTimeout(timer); reject(e); return; }
    ws.addEventListener("message", function (ev) {
      var d = String(ev.data);
      if (d.charAt(0) === "0") { ws.send("40"); return; }
      if (d.indexOf("40") === 0) { ws.send('42["get_prices"]'); return; }
      if (d.indexOf("42") === 0 && d.indexOf("price_changed") !== -1) {
        try {
          var payload = JSON.parse(d.slice(2));
          var data = (payload[1] && payload[1].data) || payload[1] || {};
          var rows = [];
          Object.keys(data).forEach(function (code) {
            if (VIZYON_ALLOW.indexOf(code) < 0) return;
            var e = data[code] || {};
            var alis = parseFloat(String(e.alis).replace(",", "."));
            var satis = parseFloat(String(e.satis).replace(",", "."));
            if (isNaN(alis) || isNaN(satis)) return;
            var adj = VIZYON_ADJ[code];
            if (adj) { alis += Number(adj.alis) || 0; satis += Number(adj.satis) || 0; }
            if (alis <= 0 && satis <= 0) return;
            rows.push({ code: code, name: code, alis: alis, satis: satis });
          });
          rows.sort(function (a, b) {
            return VIZYON_ALLOW.indexOf(a.code) - VIZYON_ALLOW.indexOf(b.code);
          });
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            try { ws.close(); } catch (e) {}
            resolve({ source: "vizyon", time: new Date().toISOString(), data: rows });
          }
        } catch (err) {
          if (!settled) { settled = true; clearTimeout(timer); reject(err); }
        }
      }
    });
    ws.addEventListener("error", function () {
      if (!settled) { settled = true; clearTimeout(timer); reject(new Error("vizyon ws error")); }
    });
  });
}

function injectFmtHelpers(body) {
  if (!body) return body;
  if (body.indexOf("function fmtGold") < 0) {
    var patch =
      "function fmtGold(n){if(n==null||isNaN(Number(n)))return\"\\u2014\";return Number(n).toLocaleString(\"tr-TR\",{minimumFractionDigits:2,maximumFractionDigits:2});}\\n" +
      "function fmtFx(n){if(n==null||isNaN(Number(n)))return\"\\u2014\";var x=Number(n);var third=Math.round(Math.abs(x)*1000)%10;var d=(third===0)?2:3;return x.toLocaleString(\"tr-TR\",{minimumFractionDigits:d,maximumFractionDigits:d});}\\n";
    if (body.indexOf("function fmt(n,d)") >= 0) {
      body = body.replace("function fmt(n,d)", patch + "function fmt(n,d)");
    } else if (body.indexOf("function rowKey") >= 0) {
      body = body.replace("function rowKey", patch + "function rowKey");
    } else {
      body = body.replace("</script>", patch + "</script>");
    }
  }
  if (body.indexOf("firmHead(d.maxKey") < 0 && body.indexOf("function openSumDetail") >= 0) {
    var oldDetail =
      "title.textContent = d.label + \" — firma detayı\";\n" +
      "  body.innerHTML =\n" +
      "    '<div style=\"font-size:12px;color:var(--muted);margin-bottom:10px\">Piyasadaki en yüksek alış ve en düşük satışın geldiği firmaların tam fiyatları</div>'+\n" +
      "    '<div style=\"border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px\">'+\n" +
      "      '<div style=\"font-weight:700;margin-bottom:6px\">Alış max · '+(d.maxFirm||\"—\")+'</div>'+\n" +
      "      '<div>Alış: <b style=\"color:var(--green)\">'+ff(maxQ.alis!=null?maxQ.alis:d.maxAlis)+'</b></div>'+\n" +
      "      '<div>Satış: <b style=\"color:var(--red)\">'+ff(maxQ.satis)+'</b></div>'+\n" +
      "    '</div>'+\n" +
      "    '<div style=\"border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px\">'+\n" +
      "      '<div style=\"font-weight:700;margin-bottom:6px\">Satış min · '+(d.minFirm||\"—\")+'</div>'+\n" +
      "      '<div>Alış: <b style=\"color:var(--green)\">'+ff(minQ.alis)+'</b></div>'+\n" +
      "      '<div>Satış: <b style=\"color:var(--red)\">'+ff(minQ.satis!=null?minQ.satis:d.minSatis)+'</b></div>'+\n" +
      "    '</div>';";
    var newDetail =
      "title.textContent = d.label + \" — firma detayı\";\n" +
      "  function firmHead(key, name, kindLabel){\n" +
      "    var logo = \"\";\n" +
      "    try { if(key && typeof firmLogo===\"function\") logo = firmLogo(key); } catch(e){}\n" +
      "    var nm = name || \"—\";\n" +
      "    return '<div style=\"display:flex;align-items:center;gap:8px;font-weight:700;margin-bottom:8px\">'+\n" +
      "      '<span style=\"color:var(--muted);font-weight:600;font-size:12px\">'+kindLabel+'</span>'+\n" +
      "      '<span style=\"display:inline-flex;align-items:center;gap:6px\">'+logo+'<span>'+nm+'</span></span>'+\n" +
      "    '</div>';\n" +
      "  }\n" +
      "  body.innerHTML =\n" +
      "    '<div style=\"font-size:12px;color:var(--muted);margin-bottom:10px\">Piyasadaki en yüksek alış ve en düşük satışın geldiği firmaların tam fiyatları</div>'+\n" +
      "    '<div style=\"border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px\">'+\n" +
      "      firmHead(d.maxKey, d.maxFirm, \"Alış max\")+\n" +
      "      '<div>Alış: <b style=\"color:var(--green)\">'+ff(maxQ.alis!=null?maxQ.alis:d.maxAlis)+'</b></div>'+\n" +
      "      '<div>Satış: <b style=\"color:var(--red)\">'+ff(maxQ.satis)+'</b></div>'+\n" +
      "    '</div>'+\n" +
      "    '<div style=\"border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px\">'+\n" +
      "      firmHead(d.minKey, d.minFirm, \"Satış min\")+\n" +
      "      '<div>Alış: <b style=\"color:var(--green)\">'+ff(minQ.alis)+'</b></div>'+\n" +
      "      '<div>Satış: <b style=\"color:var(--red)\">'+ff(minQ.satis!=null?minQ.satis:d.minSatis)+'</b></div>'+\n" +
      "    '</div>';";
    if (body.indexOf(oldDetail) >= 0) {
      body = body.replace(oldDetail, newDetail);
    }
  }
  return body;
}

async function loadAppHtml() {
  var bust = "?t=" + Date.now();
  for (var i = 0; i < HTML_URLS.length; i++) {
    try {
      var hr = await fetch(HTML_URLS[i] + bust, { cf: { cacheTtl: 0 } });
      if (hr.ok) {
        var body = await hr.text();
        if (body.indexOf("firmGrid") !== -1 || body.indexOf("STANDARD_NAMES") !== -1) {
          return injectFmtHelpers(body);
        }
      }
    } catch (e) {}
  }
  return null;
}

export default {
  async fetch(request) {
    var url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (url.pathname === "/api/health" || url.pathname === "/health") {
      return json({ ok: true, time: new Date().toISOString(), service: "radar-worker" });
    }
    var m = url.pathname.match(new RegExp("^/api/(kaptan|gunes|solis|sar|altinkose|ilkay|vizyon)$"));
    if (m) {
      var key = m[1];
      try {
        var data = key === "vizyon" ? await fetchVizyon() : await fetchSource(key);
        return json(data);
      } catch (e) {
        return json({ error: "upstream_fail", source: key, message: String(e.message || e) }, 502);
      }
    }
    if (url.pathname === "/" || url.pathname === "" || url.pathname === "/app" || url.pathname === "/index.html") {
      var html = await loadAppHtml();
      if (html) {
        return new Response(html, {
          headers: Object.assign({
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
          }, CORS_HEADERS),
        });
      }
      return new Response(
        "<!DOCTYPE html><html><body style='font-family:system-ui;padding:40px'><h1>RADAR PRO</h1><p>GitHub'a <b>radar-pro-latest.html</b> yukleyin.</p></body></html>",
        { headers: Object.assign({ "Content-Type": "text/html; charset=utf-8" }, CORS_HEADERS) }
      );
    }
    return json({ error: "not_found", path: url.pathname }, 404);
  },
};
