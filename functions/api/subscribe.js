/**
 * CF Pages Function: POST /api/subscribe  { email }
 *
 * 1. Records to D1 `subscribers` (binding: DB) — unchanged contract.
 * 2. Subscribes to this site's MailerLite group (env MAILERLITE_API_KEY,
 *    group id from site.config.json). Created WITHOUT a status so the
 *    account-wide "Double opt-in for API" applies: MailerLite emails a
 *    confirmation link and the subscriber stays `unconfirmed` (uncampaignable)
 *    until they click it. Never pass status:'active' here — that bypasses
 *    double opt-in and lets bot form-spam straight onto the list
 *    (2026-08-03 incident: harvested-address signups on gclicensehub).
 * 3. Same-origin gate: POSTs whose Origin/Referer don't match this site's
 *    hostname are rejected (cheap bot filter; browsers always send Origin
 *    on same-origin POST).
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
    // No `status`: double opt-in for API decides (unconfirmed → email → active).
    body: JSON.stringify({ email, groups: [String(groupId)] })
  });
  // 200/201 = created or already existed and was updated.
  if (r.ok) return { ok: true };
  let detail = '';
  try { detail = JSON.stringify(await r.json()).slice(0, 300); } catch (e) {}
  return { ok: false, status: r.status, detail };
}

export async function onRequestPost({ request, env }) {
  try {
    const host = new URL(request.url).hostname;

    // Same-origin gate — reject cross-site / headless-direct POSTs.
    const origin = request.headers.get('origin') || '';
    const referer = request.headers.get('referer') || '';
    const originHost = (() => { try { return origin ? new URL(origin).hostname : ''; } catch (e) { return ''; } })();
    const refererHost = (() => { try { return referer ? new URL(referer).hostname : ''; } catch (e) { return ''; } })();
    const sameOrigin = [originHost, refererHost].some(
      (h) => h && (h === host || h.endsWith('.' + host) || host.endsWith('.' + h.replace(/^www\./, '')))
    );
    if (!sameOrigin) {
      return new Response(JSON.stringify({ ok: false, error: 'bad origin' }), { status: 403 });
    }

    const ct = request.headers.get('content-type') || '';
    let email = '';
    let honeypot = '';
    if (ct.includes('application/json')) {
      const body = await request.json();
      email = body.email || '';
      honeypot = body.website || '';
    } else {
      const form = await request.formData();
      email = form.get('email') || form.get('fields[email]') || '';
      honeypot = form.get('website') || '';
    }

    // Honeypot: hidden field a human never fills. Pretend success, store nothing.
    if (honeypot) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' }
      });
    }

    email = String(email).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid email' }), { status: 400 });
    }

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
