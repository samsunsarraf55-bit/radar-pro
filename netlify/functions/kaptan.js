exports.handler = async function () {
  try {
    const res = await fetch("https://www.kaptandoviz.com/kurlar/api.php", {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    });
    const text = await res.text();
    return {
      statusCode: res.ok ? 200 : res.status,
      headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" },
      body: text.replace(/^\uFEFF/, ""),
    };
  } catch (e) {
    return { statusCode: 502, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};
