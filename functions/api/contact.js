/**
 * CF Pages Function: POST /api/contact  { name, email, topic, message }
 *
 * The 11 site zones have NO MX records, so the published hello@<domain>
 * address bounces. This form is the working inbound channel: it writes to
 * D1 `contact_messages` (binding: DB) and the panel reads from there.
 * Deliberately NO email send and NO DNS — mail servers are off-limits.
 *
 * Accepts JSON (fetch) or form-encoded (no-JS fallback -> 302 back to /contact/).
 */
import site from '../../site.config.json';

const LIMITS = { name: 100, email: 200, topic: 60, message: 5000 };
const TOPICS = ['correction', 'data', 'general'];

const clean = (v, max) => String(v ?? '').trim().slice(0, max);
const validEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

export async function onRequestPost({ request, env }) {
  const ct = request.headers.get('content-type') || '';
  const isForm = !ct.includes('application/json');
  const host = new URL(request.url).hostname;

  const reply = (ok, status, extra = {}) => {
    if (isForm) {
      // No-JS path: bounce back to the page with a flag, never show raw JSON.
      const flag = ok ? 'sent=1' : 'error=1';
      return new Response(null, { status: 302, headers: { Location: `/contact/?${flag}` } });
    }
    return new Response(JSON.stringify({ ok, ...extra }), {
      status,
      headers: { 'content-type': 'application/json' }
    });
  };

  try {
    let body = {};
    if (isForm) {
      const f = await request.formData();
      body = {
        name: f.get('name'), email: f.get('email'), topic: f.get('topic'),
        message: f.get('message'), website: f.get('website')
      };
    } else {
      body = await request.json();
    }

    // Honeypot: real users never fill this. Silently accept, never store.
    if (clean(body.website, 200) !== '') return reply(true, 200, { stored: false });

    const name = clean(body.name, LIMITS.name);
    const email = clean(body.email, LIMITS.email).toLowerCase();
    const message = clean(body.message, LIMITS.message);
    let topic = clean(body.topic, LIMITS.topic).toLowerCase();
    if (!TOPICS.includes(topic)) topic = 'general';

    if (!validEmail(email)) return reply(false, 400, { error: 'invalid email' });
    if (message.length < 2) return reply(false, 400, { error: 'empty message' });

    await env.DB.prepare(
      'INSERT INTO contact_messages (site, name, email, topic, message) VALUES (?1, ?2, ?3, ?4, ?5)'
    ).bind(host, name || null, email, topic, message).run();

    return reply(true, 200, { stored: true });
  } catch (e) {
    console.log('contact failed', host, String(e).slice(0, 200));
    return reply(false, 500, { error: 'server error' });
  }
}
