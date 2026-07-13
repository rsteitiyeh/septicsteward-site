/**
 * CF Pages Function: POST /api/subscribe  { email }
 * Records to D1 `subscribers` (binding: DB). Same contract as the pilot.
 */
export async function onRequestPost({ request, env }) {
  try {
    const ct = request.headers.get('content-type') || '';
    let email = '';
    if (ct.includes('application/json')) {
      email = (await request.json()).email || '';
    } else {
      const form = await request.formData();
      email = form.get('email') || form.get('fields[email]') || '';
    }
    email = String(email).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid email' }), { status: 400 });
    }
    const site = new URL(request.url).hostname;
    await env.DB.prepare(
      'INSERT INTO subscribers (email, site, created_at) VALUES (?1, ?2, datetime("now"))'
    ).bind(email, site).run();
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }
}
