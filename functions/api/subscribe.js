// Cloudflare Pages Function: POST /api/subscribe  { email, source, site }
// Stores into D1 (binding: DB) table subscribers; fails soft.
export async function onRequestPost({ request, env }) {
  try {
    const { email, source, site } = await request.json();
    if (!/^\S+@\S+\.\S+$/.test(email || "")) {
      return new Response(JSON.stringify({ ok: false, error: "invalid email" }), { status: 400 });
    }
    if (env.DB) {
      await env.DB.prepare(
        "CREATE TABLE IF NOT EXISTS subscribers (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, source TEXT, site TEXT, created_at TEXT DEFAULT (datetime('now')), UNIQUE(email, site))"
      ).run();
      await env.DB.prepare(
        "INSERT OR IGNORE INTO subscribers (email, source, site) VALUES (?1, ?2, ?3)"
      ).bind(email.trim().toLowerCase(), source || "", site || "septicsteward").run();
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }
}
