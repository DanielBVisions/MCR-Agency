const TO_ADDRESS = 'dan@perspectiv.design';
const FROM_ADDRESS = 'MCR Agency Collective <hello@agencycollective.co.uk>';

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  var name = (data.name || '').trim();
  var agency = (data.agency || '').trim();
  var role = (data.role || '').trim();
  var email = (data.email || '').trim();
  var note = (data.note || '').trim();

  if (!name || !agency || !email || !/^\S+@\S+\.\S+$/.test(email)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing or invalid required fields' }) };
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured' }) };
  }

  // Best-effort: every submission also gets stored in Supabase so the
  // whole team can see requests, not just whoever has Netlify access.
  // A failure here is logged but never blocks the email below, which is
  // the part the visitor's confirmation actually depends on.
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      // Accept either a bare project URL or one that already has /rest/v1
      // (with or without a trailing slash) tacked on.
      var supabaseBase = process.env.SUPABASE_URL.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
      var supabaseRes = await fetch(supabaseBase + '/rest/v1/seat_requests', {
        method: 'POST',
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({ name: name, agency: agency, role: role, email: email, note: note })
      });
      if (!supabaseRes.ok) {
        console.error('Supabase insert error:', supabaseRes.status, await supabaseRes.text());
      }
    } catch (err) {
      console.error('Supabase insert failed:', err);
    }
  } else {
    console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipping Supabase log');
  }

  var bodyLines = [
    'Name: ' + name,
    'Agency: ' + agency,
    'Role: ' + (role || '-'),
    'Email: ' + email,
    '',
    'Note:',
    note || '-'
  ];

  try {
    var resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [TO_ADDRESS],
        reply_to: email,
        subject: 'Seat request: ' + agency,
        text: bodyLines.join('\n')
      })
    });

    if (!resendRes.ok) {
      var errText = await resendRes.text();
      console.error('Resend error:', resendRes.status, errText);
      return { statusCode: 502, body: JSON.stringify({ error: 'Failed to send' }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('Send failed:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
