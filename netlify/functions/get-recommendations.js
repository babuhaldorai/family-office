// Server-side proxy to the Anthropic API. Keeps the API key out of the
// browser — the client sends a pre-computed JSON summary of the business's
// own numbers (trends, outliers, forecasts already calculated client-side),
// and this function asks Claude to turn that into plain-English
// recommendations.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY is not set on this Netlify site. Add it under Site configuration → Environment variables.' }),
    };
  }

  let summary;
  try {
    summary = JSON.parse(event.body).summary;
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }
  if (!summary) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing summary in request body' }) };
  }

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content:
            "You are reviewing a family's small business data — a tea plantation and a few rental properties. " +
            'Below is a JSON summary already computed from their real records (monthly trends, outliers, simple forecasts, and a list of rule-based flags). ' +
            'Write 5-8 short, specific, plain-English bullet points: the most important observations and concrete next steps, ordered by importance. ' +
            'Use the actual numbers given. Do not restate the raw JSON. Do not give generic business advice unconnected to these figures.\n\n' +
            JSON.stringify(summary, null, 2),
        }],
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return { statusCode: resp.status, body: JSON.stringify({ error: data.error?.message || 'Anthropic API error' }) };
    }
    const text = (data.content || []).map(c => c.text).filter(Boolean).join('\n');
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
