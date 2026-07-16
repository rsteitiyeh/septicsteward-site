/**
 * CF Pages Function: POST /api/subscribe  { email }
 *
 * 1. Records to D1 `subscribers` (binding: DB) — unchanged contract.
 * 2. Subscribes to this site's MailerLite group (env MAILERLITE_API_KEY,
 *    group id from site.config.json). The group's automation delivers the
 *    magnet and starts the nurture sequence.
 *
 * D1 stays the source of truth: if MailerLite fails we still keep the lead
 * and still return ok, because the browser hands over the file regardless.
 */
import site from '../../site.config.json';

const ML_ENDPOINT = 'https://connect.mailerlite.com/api/subscribers';

async function toMailerLite(email, env, groupId) {
  if (!env.MAILERLITE_API_KEY || !groupId) {
    return { ok: false, skipped: true, reason: 'no api key or group id' };
  }
  const r = await fetch(ML_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      authorization: `Bearer ${env.MAILERLITE_API_KEY}`
    },
    body: JSON.stringify({ email, groups: [String(groupId)], status: 'active' })
  });
  // 200/201 = created or already existed and was updated.
  if (r.ok) return { ok: true };
  let detail = '';
  try { detail = JSON.stringify(await r.json()).slice(0, 300); } catch (e) {}
  return { ok: false, status: r.status, detail };
}

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

    const host = new URL(request.url).hostname;
    const groupId = (site.mailerlite && site.mailerlite.groupId) || '';

    // D1 first — never lose the lead to a MailerLite hiccup.
    let stored = true;
    try {
      await env.DB.prepare(
        'INSERT INTO subscribers (email, site, created_at) VALUES (?1, ?2, datetime("now"))'
      ).bind(email, host).run();
    } catch (e) {
      stored = false; // duplicate or transient — not fatal
    }

    const ml = await toMailerLite(email, env, groupId);
    if (!ml.ok && !ml.skipped) {
      console.log('mailerlite subscribe failed', host, ml.status, ml.detail);
    }

    return new Response(JSON.stringify({ ok: true, stored, list: !!ml.ok }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }
}
