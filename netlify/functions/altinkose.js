exports.handler = async function () {
  try {
    const res = await fetch("https://www.altinkose.com.tr/api/storefront", {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Content-Type": "application/json",
        Accept: "application/json",
        Origin: "https://www.altinkose.com.tr",
        Referer: "https://www.altinkose.com.tr/canli-altin-fiyatlari",
      },
      body: JSON.stringify({ islem: "kurlar" }),
    });
    const text = await res.text();
    return {
      statusCode: res.ok ? 200 : res.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
      body: text,
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: String(e.message || e) }),
    };
  }
};
