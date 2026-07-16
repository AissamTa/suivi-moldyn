# MOLDYN — Déploiement de `moldyn-chat`

## 1. Poser la clé (côté serveur, jamais dans le HTML)

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
supabase secrets set ALLOWED_ORIGINS=https://aissamta.github.io
```

Pour tester en local, ajouter l'origine du serveur local :

```bash
supabase secrets set ALLOWED_ORIGINS=https://aissamta.github.io,http://localhost:5500
```

Modèle par défaut : `claude-haiku-4-5-20251001` (rapide + pas cher).
Si le darija est mal compris :

```bash
supabase secrets set MOLDYN_MODEL=claude-sonnet-5
```

## 2. Déployer

L'app n'a pas de login → pas de JWT à vérifier :

```bash
supabase functions deploy moldyn-chat --no-verify-jwt
```

URL obtenue :
`https://<PROJECT_REF>.supabase.co/functions/v1/moldyn-chat`

## 3. Tester

```bash
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/moldyn-chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://aissamta.github.io" \
  -d '{
    "message": "9sem 4000 3la 8 swaye3, s3a 3 fiha pause drt ghir 200",
    "fiche": { "refs": [{ "ref": "REF-A", "h": [0,0,0,0,0,0,0,0] }] },
    "arretTypes": ["Aucun arrêt", "ATT Validation", "ATT Pièces"]
  }'
```

Réponse attendue :

```json
{
  "ok": true,
  "reply": "Sift, 9semt 4000 w s3a 3 khllitha 200.",
  "operations": [
    { "op": "set_ref_hours", "ref": "REF-A",
      "hours": [543,543,200,543,543,543,543,542] }
  ]
}
```

---

## Contrat (client → fonction)

| Champ | Type | Rôle |
|---|---|---|
| `message` | string | La phrase de l'opérateur (darija) |
| `fiche` | object | État actuel — sert au modèle à connaître les réfs existantes |
| `arretTypes` | string[] | Les options exactes du `<select>` d'arrêt de v7 |
| `history` | array | 6 derniers tours max (optionnel) |

## Contrat (fonction → client)

| `op` | Champs | Effet |
|---|---|---|
| `set_ref_hours` | `ref`, `hours[8]` | Remplace les 8 heures d'une réf |
| `set_qte` | `ref`, `h`, `qte` | Une seule case |
| `set_arret` | `h`, `type`, `min`, `commentaire` | Une ligne d'arrêt |

C'est le **client** qui applique les opérations au DOM. La fonction ne fait que
calculer.

---

## Sécurité — ce qui est vrai, et ce qui ne l'est pas

**Protégé :**
- La clé Anthropic n'est jamais dans le HTML. Impossible à voler depuis le navigateur.
- `max_tokens` plafonné à 1024 → coût par appel borné.
- Payload limité à 16 Ko.
- Rotation de la clé = 1 commande, sans retoucher l'app.

**Pas protégé (à savoir) :**
- L'`Origin` est vérifiée, ce qui bloque les abus depuis un autre site dans un
  navigateur. Mais un `curl` peut la falsifier. Une app publique sans login ne
  peut pas être verrouillée complètement.
- Le rate limit est **en mémoire**, donc par instance et remis à zéro quand la
  fonction dort. C'est un frein, pas un mur.

**Si l'usage sort de l'usine**, deux options :
1. Rate limit en base (table `chat_hits(ip, ts)` + index) au lieu de la mémoire.
2. Un vrai login Supabase Auth, puis déployer **sans** `--no-verify-jwt`.

Tant que ça reste un outil interne MOLDYN, l'état actuel est raisonnable.
Mettre un budget d'alerte sur la console Anthropic reste conseillé.
