// netlify/functions/enterprise-check.js
// hubspotutk から Contact を取得し、contact_type で Enterprise 判定する（byUtk/batch 版）

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;

function isEnterpriseFromContactType(contactType) {
  if (!contactType) return false;

  const raw = Array.isArray(contactType) ? contactType.join(";") : String(contactType);
  const values = raw.split(";").map((s) => s.trim()).filter(Boolean);

  // 英語・日本語どちらでもOKにする（安全側）
  const enterpriseSet = new Set(["enterprise", "エンタープライズ"]);
  const generalBusinessSet = new Set(["general business", "general_business", "一般企業", "general business"]); // 念のため

  return values.some(v => enterpriseSet.has(v) || generalBusinessSet.has(v));
}

exports.handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "https://studio.design",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  try {
    if (!HUBSPOT_TOKEN) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing HUBSPOT_TOKEN" }),
      };
    }

    const utk = (event.queryStringParameters?.utk || "").trim();
    if (!utk) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ found: false, isEnterprise: false, reason: "no_utk" }),
      };
    }

    // ★ hubspotutk から直接Contactを取る（batch endpoint）
    // docs: /contacts/v1/contact/byUtk/batch/ :contentReference[oaicite:2]{index=2}
    const url = new URL("https://api.hubapi.com/contacts/v1/contact/byUtk/batch/");
    url.searchParams.set("utk", utk);
    // 必要なプロパティだけ返してもらう（軽量化）
    url.searchParams.append("property", "contact_type");

    const resp = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${HUBSPOT_TOKEN}`,
      },
    });

    const data = await resp.json();

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: corsHeaders,
        body: JSON.stringify({ error: "HubSpot API error", details: data }),
      };
    }

    // レスポンスは { "<utk>": { properties: {...} } } 形式
    const record = data?.[utk];
    if (!record) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ found: false, isEnterprise: false }),
      };
    }

    const contactType = record?.properties?.contact_type?.value || "";
    const isEnterprise = isEnterpriseFromContactType(contactType);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ found: true, isEnterprise, contactType }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "server_error", message: String(e) }),
    };
  }
};
