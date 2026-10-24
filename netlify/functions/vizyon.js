const WebSocket = require("ws");

const VIZYON_ADJ = {
  KULCEALTIN: { alis: 0, satis: 5 },
  AYAR22: { alis: 15, satis: -20 },
  CEYREK_YENI: { alis: -240, satis: -120 },
  YARIM_YENI: { alis: -420, satis: -310 },
  TEK_YENI: { alis: -715, satis: -560 },
  ATA_YENI: { alis: -100, satis: -275 },
};
const ALLOW = Object.keys(VIZYON_ADJ);

exports.handler = async function () {
  const rows = await new Promise(function (resolve) {
    let settled = false;
    const done = function (data) {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch (e) {}
      resolve(data);
    };

    const timer = setTimeout(function () {
      done([]);
    }, 12000);

    let ws;
    try {
      ws = new WebSocket("wss://socket.haremaltin.com/socket.io/?EIO=4&transport=websocket", {
        headers: {
          Origin: "https://www.haremaltin.com",
          "User-Agent": "Mozilla/5.0",
        },
      });
    } catch (e) {
      clearTimeout(timer);
      done([]);
      return;
    }

    ws.on("message", function (raw) {
      const d = String(raw);
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
          const payload = JSON.parse(d.slice(2));
          const data = (payload[1] && payload[1].data) || payload[1] || {};
          const out = [];
          ALLOW.forEach(function (code) {
            const e = data[code] || {};
            let alis = parseFloat(String(e.alis).replace(",", "."));
            let satis = parseFloat(String(e.satis).replace(",", "."));
            if (isNaN(alis) || isNaN(satis)) return;
            const adj = VIZYON_ADJ[code];
            if (adj) {
              alis += Number(adj.alis) || 0;
              satis += Number(adj.satis) || 0;
            }
            out.push({ code: code, name: code, alis: alis, satis: satis });
          });
          clearTimeout(timer);
          done(out);
        } catch (err) {
          clearTimeout(timer);
          done([]);
        }
      }
    });

    ws.on("error", function () {
      clearTimeout(timer);
      done([]);
    });
  });

  if (!rows.length) {
    return {
      statusCode: 502,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify({ error: "vizyon_ws_timeout", source: "vizyon", data: [] }),
    };
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify({
      source: "vizyon",
      time: new Date().toISOString(),
      data: rows,
    }),
  };
};
