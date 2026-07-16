// ============================================================================
//  MOLDYN — Suivi de Production
//  Edge Function : moldyn-chat
//  ---------------------------------------------------------------------------
//  Role : proxy entre l'app (HTML public sur GitHub Pages) et l'API Claude.
//         La cle ANTHROPIC_API_KEY reste cote serveur, JAMAIS dans le client.
//
//  Le modele NE FAIT PAS LE CALCUL. Il extrait seulement l'INTENTION
//  (total, heures a exclure, heures a fixer...). La repartition est calculee
//  ici en TypeScript => resultat toujours exact et deterministe.
// ============================================================================

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

// Origines autorisees (separees par des virgules dans le secret ALLOWED_ORIGINS)
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://aissamta.github.io")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Modele : haiku = rapide + pas cher (parfait pour parser une phrase courte).
// Si le darija est mal compris, passer a "claude-sonnet-5".
const MODEL = Deno.env.get("MOLDYN_MODEL") ?? "claude-haiku-4-5-20251001";

const MAX_TOKENS = 1024;
const MAX_BODY_BYTES = 16_000; // garde-fou contre les gros payloads
const HOURS = 8;

// --- Rate limit simple en memoire (par IP, par instance) --------------------
// Note : les edge functions sont ephemeres => ce n'est PAS une protection
// forte, juste un frein. Pour du strict, utiliser une table Postgres.
const RATE_LIMIT = 20; // requetes
const RATE_WINDOW_MS = 60_000; // par minute
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE_LIMIT;
}

// --- CORS -------------------------------------------------------------------
function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin! : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

// ============================================================================
//  LE CALCUL (deterministe, cote serveur — pas le modele)
// ============================================================================

/**
 * Repartit `total` pieces sur les 8 heures.
 *  - `exclure` : heures a mettre a 0 (ex : arret complet)
 *  - `fixer`   : heures dont la quantite est imposee (ex : heure 3 = 200 a cause d'une pause)
 * Le reste est reparti equitablement ; le reliquat va aux premieres heures libres.
 */
function repartir(
  total: number,
  exclure: number[] = [],
  fixer: { h: number; qte: number }[] = [],
): number[] {
  const out = new Array(HOURS).fill(0);
  const fixedMap = new Map(fixer.map((f) => [f.h, Math.max(0, Math.round(f.qte))]));

  // 1. Poser les heures imposees
  let dejaPose = 0;
  for (const [h, q] of fixedMap) {
    if (h >= 1 && h <= HOURS) {
      out[h - 1] = q;
      dejaPose += q;
    }
  }

  // 2. Determiner les heures libres
  const libres: number[] = [];
  for (let h = 1; h <= HOURS; h++) {
    if (exclure.includes(h) || fixedMap.has(h)) continue;
    libres.push(h);
  }
  if (libres.length === 0) return out;

  // 3. Repartir le reste
  const reste = Math.max(0, Math.round(total) - dejaPose);
  const base = Math.floor(reste / libres.length);
  let reliquat = reste - base * libres.length;

  for (const h of libres) {
    out[h - 1] = base + (reliquat > 0 ? 1 : 0);
    if (reliquat > 0) reliquat--;
  }
  return out;
}

// ============================================================================
//  OUTIL EXPOSE AU MODELE
// ============================================================================

function buildTool(arretTypes: string[]) {
  return {
    name: "remplir_fiche",
    description:
      "Applique les modifications demandees a la fiche de production MOLDYN. " +
      "N'invente jamais de chiffres : n'utilise que ce que l'operateur a dit.",
    input_schema: {
      type: "object",
      properties: {
        reply: {
          type: "string",
          description:
            "Reponse tres courte a l'operateur, en darija marocaine ecrite en lettres latines. Max 20 mots.",
        },
        operations: {
          type: "array",
          description: "Liste des operations a appliquer. Vide si aucune action.",
          items: {
            type: "object",
            properties: {
              op: {
                type: "string",
                enum: ["repartir", "set_qte", "set_arret"],
                description:
                  "repartir = distribuer un total sur les 8 heures. " +
                  "set_qte = fixer une seule heure. " +
                  "set_arret = renseigner un arret sur une heure.",
              },
              ref: {
                type: "string",
                description:
                  "Nom de la reference concernee. Si l'operateur n'en cite qu'une seule ou n'en cite aucune, laisser vide.",
              },
              total: {
                type: "number",
                description: "op=repartir : total de pieces a repartir.",
              },
              exclure: {
                type: "array",
                items: { type: "integer", minimum: 1, maximum: 8 },
                description:
                  "op=repartir : heures a mettre a 0 (arret total sur ces heures).",
              },
              fixer: {
                type: "array",
                description:
                  "op=repartir : heures dont la quantite est imposee (ex : heure avec pause). Le reste du total est reparti sur les autres heures.",
                items: {
                  type: "object",
                  properties: {
                    h: { type: "integer", minimum: 1, maximum: 8 },
                    qte: { type: "number" },
                  },
                  required: ["h", "qte"],
                },
              },
              h: {
                type: "integer",
                minimum: 1,
                maximum: 8,
                description: "op=set_qte / set_arret : numero de l'heure (1 a 8).",
              },
              qte: { type: "number", description: "op=set_qte : quantite." },
              type_arret: {
                type: "string",
                enum: arretTypes.length ? arretTypes : ["Aucun arrêt"],
                description: "op=set_arret : type d'arret, choisi dans la liste.",
              },
              min: {
                type: "integer",
                description: "op=set_arret : duree de l'arret en minutes.",
              },
              commentaire: {
                type: "string",
                description: "op=set_arret : commentaire libre, court.",
              },
            },
            required: ["op"],
          },
        },
      },
      required: ["reply", "operations"],
    },
  };
}

const SYSTEM = `Tu es l'assistant de saisie de l'application MOLDYN (suivi de production, usine).
L'operateur te parle en DARIJA marocaine (lettres latines), parfois melangee avec du francais.
Ton seul travail : traduire sa demande en operations via l'outil remplir_fiche.

REGLES ABSOLUES :
- Ne calcule JAMAIS toi-meme une repartition. Utilise op="repartir" et donne total / exclure / fixer. Le serveur fait le calcul.
- N'invente aucun chiffre. Si une info manque, ne fais pas l'operation et demande-la dans "reply".
- Les heures vont de 1 a 8 (1H..8H).
- Si l'operateur dit qu'une heure a eu une pause / un arret et que la quantite y est plus basse, mets cette heure dans "fixer" avec la quantite qu'il annonce. S'il ne donne pas de quantite pour cette heure, demande-la.
- Si l'operateur dit qu'une heure est totalement arretee (0 piece), mets-la dans "exclure".
- "reply" : darija, tres court, pas de blabla.

Exemples de langage :
- "9sem 4000 3la 8 swaye3"            -> repartir, total=4000
- "s3a 3 fiha pause, dirt ghir 200"   -> repartir avec fixer=[{h:3, qte:200}]
- "s3a 5 makhdemtch"                  -> exclure=[5]
- "s3a 6 att validation 30 min"       -> set_arret h=6 type_arret="ATT Validation" min=30`;

// ============================================================================
//  HANDLER
// ============================================================================

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, origin);
  }
  if (!ANTHROPIC_API_KEY) {
    return json({ error: "Server misconfigured: missing ANTHROPIC_API_KEY" }, 500, origin);
  }
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: "Origin not allowed" }, 403, origin);
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (rateLimited(ip)) {
    return json({ error: "Trop de requetes, patiente une minute." }, 429, origin);
  }

  // --- Lire et valider le body ---
  let payload: {
    message?: string;
    fiche?: unknown;
    arretTypes?: string[];
    history?: { role: string; content: string }[];
  };
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return json({ error: "Payload trop grand" }, 413, origin);
    }
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "JSON invalide" }, 400, origin);
  }

  const message = (payload.message ?? "").toString().trim();
  if (!message) return json({ error: "Message vide" }, 400, origin);

  const arretTypes = Array.isArray(payload.arretTypes) ? payload.arretTypes : [];
  const history = Array.isArray(payload.history) ? payload.history.slice(-6) : [];

  // Contexte : etat actuel de la fiche, pour que le modele sache quelles refs existent
  const contexte = `Etat actuel de la fiche (JSON) :
${JSON.stringify(payload.fiche ?? {}, null, 0).slice(0, 4000)}`;

  const messages = [
    ...history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) })),
    { role: "user", content: `${contexte}\n\nDemande de l'operateur : ${message}` },
  ];

  // --- Appel API Claude ---
  let data: any;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM,
        messages,
        tools: [buildTool(arretTypes)],
        tool_choice: { type: "tool", name: "remplir_fiche" },
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("Anthropic error", res.status, detail.slice(0, 500));
      return json({ error: "Erreur du service IA" }, 502, origin);
    }
    data = await res.json();
  } catch (e) {
    console.error("Fetch failed", e);
    return json({ error: "Service IA injoignable" }, 502, origin);
  }

  // --- Extraire le tool_use (par TYPE, jamais par position) ---
  const toolBlock = (data.content ?? []).find(
    (b: any) => b.type === "tool_use" && b.name === "remplir_fiche",
  );
  if (!toolBlock) {
    return json({ ok: true, reply: "Ma fhemtch, 3awd 3afak.", operations: [] }, 200, origin);
  }

  const input = toolBlock.input ?? {};
  const rawOps = Array.isArray(input.operations) ? input.operations : [];

  // --- Resoudre les operations : LE CALCUL SE FAIT ICI ---
  const operations = rawOps.map((o: any) => {
    if (o.op === "repartir") {
      return {
        op: "set_ref_hours",
        ref: o.ref ?? "",
        hours: repartir(
          Number(o.total) || 0,
          Array.isArray(o.exclure) ? o.exclure.map(Number) : [],
          Array.isArray(o.fixer) ? o.fixer : [],
        ),
      };
    }
    if (o.op === "set_qte") {
      return {
        op: "set_qte",
        ref: o.ref ?? "",
        h: Number(o.h),
        qte: Math.max(0, Math.round(Number(o.qte) || 0)),
      };
    }
    if (o.op === "set_arret") {
      return {
        op: "set_arret",
        h: Number(o.h),
        type: o.type_arret ?? "Aucun arrêt",
        min: Math.max(0, Math.round(Number(o.min) || 0)),
        commentaire: (o.commentaire ?? "").toString().slice(0, 200),
      };
    }
    return null;
  }).filter(Boolean);

  return json(
    {
      ok: true,
      reply: (input.reply ?? "").toString().slice(0, 300),
      operations,
    },
    200,
    origin,
  );
});
