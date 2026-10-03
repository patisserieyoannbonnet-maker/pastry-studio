// ToqueLab V2 · fonction serveur (Vercel Edge) : appelle Claude en streaming avec la clé cachée
export const config = { runtime: "edge" };

const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 16000; // la réflexion éventuelle du modèle compte dans cette limite

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: { message: "Méthode non autorisée" } }, 405);
  let body;
  try { body = await req.json(); } catch (e) { return json({ error: { message: "Requête invalide" } }, 400); }
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  if (!prompt || prompt.length > 20000) return json({ error: { message: "Demande vide ou trop longue" } }, 400);

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, stream: true, messages: [{ role: "user", content: prompt }] })
  });

  if (!r.ok) {
    const t = await r.text();
    let m = t;
    try { m = JSON.parse(t).error.message; } catch (e) {}
    return json({ error: { message: m } }, r.status);
  }
  return new Response(r.body, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}
