// netlify/functions/enterprise-check.js
// HubSpotのhubspotutkからContactを検索し、contact_typeでEnterprise判定する

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;

// HubSpot上で hubspotutk を保持しているプロパティ（ほぼこれでOK）
const UTK_PROPERTY = "hs_analytics_cookie";

function isEnterpriseFromContactType(contactType) {
  if (!contactType) return false;

  const values = Array.isArray(contactType)
    ? contactType
    : String(contactType).split(";").map(s => s.trim());

  return values.includes("enterprise") || values.includes("general business");
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

    const url = "https://api.hubapi.com/crm/v3/objects/contacts/search";
    const payload = {
      filterGroups: [
        {
          filters: [
            { propertyName: UTK_PROPERTY, operator: "EQ", value: utk }
          ],
        },
      ],
      properties: ["contact_type", UTK_PROPERTY],
      limit: 1,
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HUBSPOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: corsHeaders,
        body: JSON.stringify({ error: "HubSpot API error", details: data }),
      };
    }

    const result = data?.results?.[0];
    if (!result) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ found: false, isEnterprise: false }),
      };
    }

    const contactType = result.properties?.contact_type;
    const isEnterprise = isEnterpriseFromContactType(contactType);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        found: true,
        isEnterprise,
        contactType,
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
