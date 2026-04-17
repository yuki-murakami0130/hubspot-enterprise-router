// netlify/functions/enterprise-check.js
// hubspotutk から Contact を取得し、contact_origin が「サイト最適化WP」なら true を返す

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;

function isEnterpriseFromContactOrigin(contactOrigin) {
  if (!contactOrigin) return false;

  const raw = Array.isArray(contactOrigin) ? contactOrigin.join(";") : String(contactOrigin);
  const values = raw.split(";").map((s) => s.trim()).filter(Boolean);

  return values.includes("サイト最適化WP");
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

    const url = new URL("https://api.hubapi.com/contacts/v1/contact/byUtk/batch/");
    url.searchParams.set("utk", utk);

    // 取得したいプロパティを contact_type → contact_origin に変更
    url.searchParams.append("property", "contact_origin");

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

    const record = data?.[utk];
    if (!record) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ found: false, isEnterprise: false }),
      };
    }

    const contactOrigin = record?.properties?.contact_origin?.value || "";
    const isEnterprise = isEnterpriseFromContactOrigin(contactOrigin);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        found: true,
        isEnterprise,
        contactOrigin,
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "server_error", message: String(e) }),
    };
  }
};
