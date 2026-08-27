const TO_ADDRESS = 'daniel.bate@visionsdesign.co.uk';
const FROM_ADDRESS = 'MCR Agency Collective <onboarding@resend.dev>';

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
