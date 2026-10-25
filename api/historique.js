// ToqueLab · historique des demandes (25 oct. 2026)
// Réservé à Yoann : mot de passe dans la variable Vercel TOQUELAB_HISTORIQUE_MDP (jamais dans le code).
// Lit les demandes enregistrées par api/generate.js dans la base Redis reliée au projet.
export const config = { runtime: "edge" };

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
function egal(a, b) {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

export default async function handler(req) {
  if (req.method !== "GET") return json({ error: "Méthode non autorisée." }, 405);
  const mdp = process.env.TOQUELAB_HISTORIQUE_MDP || "";
  if (mdp.length < 8) return json({ error: "Historique non configuré : ajoutez la variable TOQUELAB_HISTORIQUE_MDP (8 caractères minimum) dans Vercel, puis redéployez." }, 503);
  const recu = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!egal(recu, mdp)) {
    await new Promise(r => setTimeout(r, 800)); // freine les essais de mot de passe
    return json({ error: "Mot de passe incorrect." }, 401);
  }
  const url = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, "");
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return json({ error: "Aucune base reliée au projet : Vercel > Storage > Upstash (Redis), puis Connect Project." }, 503);

  const q = new URL(req.url).searchParams;
  const depart = Math.max(0, parseInt(q.get("depart") || "0", 10) || 0);
  const nb = Math.min(200, Math.max(1, parseInt(q.get("nb") || "100", 10) || 100));
  const appel = async cmd => {
    const r = await fetch(url, { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
    if (!r.ok) throw new Error("Base indisponible (" + r.status + ")");
    return (await r.json()).result;
  };
  try {
    const ids = (await appel(["LRANGE", "tl:ids", String(depart), String(depart + nb - 1)])) || [];
    const total = await appel(["LLEN", "tl:ids"]);
    const brut = ids.length ? await appel(["MGET", ...ids.map(i => "tl:e:" + i)]) : [];
    const entrees = brut.map(t => { try { return JSON.parse(t); } catch (e) { return null; } }).filter(Boolean);
    return json({ total, depart, entrees }, 200);
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
}
