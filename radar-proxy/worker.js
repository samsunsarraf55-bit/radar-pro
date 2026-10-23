/**
 * RADAR PRO — Cloudflare Worker (kalici proxy)
 * See repo README for deploy steps
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Cache-Control": "no-store",
};

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
  var headers = Object.assign(
    { "Content-Type": "application/json; charset=utf-8" },
    CORS_HEADERS
  );
  return new Response(JSON.stringify(data), { status: status, headers: headers });
}

function parseIlkayHtml(html) {
  var rates = [];
  var seen = {};
  var tickRe =
    /<span class="ticker-item">\s*([A-Z]{3})\s*<span class="ticker-buy">([^<]+)<\/span><span class="ticker-sep">\/<\/span><span class="ticker-sell">([^<]+)<\/span>/g;
  var m;
  while ((m = tickRe.exec(html))) {
    if (seen[m[1]]) continue;
    seen[m[1]] = 1;
    rates.push({
      code: m[1],
      alis: parseFloat(String(m[2]).replace(",", ".")),
      satis: parseFloat(String(m[3]).replace(",", ".")),
    });
  }
  var blocks = html.split('class="rate-row"');
  for (var bi = 1; bi < blocks.length; bi++) {
    var b = blocks[bi];
    var nm = /currency-name">\s*([^<]+)/.exec(b);
    var prices = b.match(/>([0-9]+,[0-9]+)</g) || [];
    var nums = prices.map(function (p) {
      return p.replace(/[> <]/g, "");
    });
    if (nm && nums.length >= 2) {
      var code = nm[1].trim();
      if (!seen[code]) {
        seen[code] = 1;
        rates.push({
          code: code,
          alis: parseFloat(nums[0].replace(",", ".")),
          satis: parseFloat(nums[1].replace(",", ".")),
        });
      }
    }
  }
  return { source: "ilkay", time: new Date().toISOString(), data: rates };
}

async function fetchSource(key) {
  var spec = SOURCES[key];
  if (!spec) throw new Error("unknown source");
  var headers = Object.assign(
    {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
    },
    spec.headers || {}
  );
  var opts = { method: spec.method || "GET", headers: headers };
  if (spec.body) opts.body = spec.body;
  var res = await fetch(spec.url, opts);
  var text = await res.text();
  if (spec.parseHtml) return parseIlkayHtml(text);
  try {
    return JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch (e) {
    throw new Error("json_parse: " + text.slice(0, 100));
  }
}

async function fetchVizyon() {
  return new Promise(function (resolve, reject) {
    var url = "wss://socket.haremaltin.com/socket.io/?EIO=4&transport=websocket";
    var settled = false;
    var ws;
    var timer = setTimeout(function () {
      if (!settled) {
        settled = true;
        try {
          if (ws) ws.close();
        } catch (e) {}
        reject(new Error("vizyon timeout"));
      }
    }, 15000);
    try {
      ws = new WebSocket(url);
    } catch (e) {
      clearTimeout(timer);
      reject(e);
      return;
    }
    ws.addEventListener("message", function (ev) {
      var d = String(ev.data);
      if (d.charAt(0) === "0") {
        ws.send("40");
        return;
      }
      if (d.indexOf("40") === 0) {
        ws.send('42["get_prices"]');
        return;
      }
      if (d.indexOf("42") === 0 && d.indexOf("price_changed") !== -1) {
        try {
          var payload = JSON.parse(d.slice(2));
          var body = payload[1] || {};
          var data = body.data || body;
          var rows = [];
          Object.keys(data).forEach(function (code) {
            if (VIZYON_ALLOW.indexOf(code) < 0) return;
            var e = data[code] || {};
            var alis = parseFloat(String(e.alis).replace(",", "."));
            var satis = parseFloat(String(e.satis).replace(",", "."));
            if (isNaN(alis) || isNaN(satis)) return;
            var adj = VIZYON_ADJ[code];
            if (adj) {
              alis += Number(adj.alis) || 0;
              satis += Number(adj.satis) || 0;
            }
            if (alis <= 0 && satis <= 0) return;
            rows.push({ code: code, name: code, alis: alis, satis: satis });
          });
          rows.sort(function (a, b) {
            return VIZYON_ALLOW.indexOf(a.code) - VIZYON_ALLOW.indexOf(b.code);
          });
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            try {
              ws.close();
            } catch (e) {}
            resolve({ source: "vizyon", time: new Date().toISOString(), data: rows });
          }
        } catch (err) {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        }
      }
    });
    ws.addEventListener("error", function () {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error("vizyon ws error"));
      }
    });
  });
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
    var m = url.pathname.match(/^\/api\/(kaptan|gunes|solis|sar|altinkose|ilkay|vizyon)$/);
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
      var sources = [
        "https://cdn.jsdelivr.net/gh/samsunsarraf55-bit/radar-pro@main/altin-fiyatlari.html",
        "https://raw.githubusercontent.com/samsunsarraf55-bit/radar-pro/main/altin-fiyatlari.html",
      ];
      for (var si = 0; si < sources.length; si++) {
        try {
          var hr = await fetch(sources[si], { cf: { cacheTtl: 60 } });
          if (hr.ok) {
            var body = await hr.text();
            if (body.indexOf("RADAR") !== -1 || body.indexOf("firmGrid") !== -1) {
              return new Response(body, {
                headers: Object.assign({ "Content-Type": "text/html; charset=utf-8" }, CORS_HEADERS),
              });
            }
          }
        } catch (e) {}
      }
      var help =
        "<!DOCTYPE html><html lang=tr><head><meta charset=utf-8><title>RADAR PRO</title></head><body>" +
        "<h1>RADAR PRO Proxy</h1><p>HTML henuz GitHubda yok. Proxy URL: <code>" +
        url.origin +
        "</code></p><p><a href=/api/health>/api/health</a></p></body></html>";
      return new Response(help, {
        headers: Object.assign({ "Content-Type": "text/html; charset=utf-8" }, CORS_HEADERS),
      });
    }
    return json({ error: "not_found", path: url.pathname }, 404);
  },
};
