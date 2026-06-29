/**
 * POST /api/voiceflow-save-memory
 * Called by Voiceflow's save_session_summary API tool to persist a session summary.
 * Merges the new summary with existing memory using Claude Sonnet 4.6 — never blind-overwrites.
 * Auth: shared secret (Voiceflow calls this server-to-server — no JWT).
 * Body: url-encoded or JSON — { user_email, summary }
 */
export default async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const authHeader = request.headers.get('Authorization');
  const API_SECRET = Netlify.env.get('VOICEFLOW_API_SECRET');
  if (!authHeader || authHeader !== `Bearer ${API_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Accept both url-encoded (from Voiceflow API tool) and JSON
  let user_email, summary;
  const contentType = request.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      user_email = params.get('user_email') || '';
      summary    = params.get('summary') || '';
    } else {
      const body = await request.json();
      user_email = body.user_email || '';
      summary    = body.summary || '';
    }
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  if (!user_email || !summary) {
    return new Response('Bad Request', { status: 400 });
  }

  const SUPABASE_URL     = Netlify.env.get('SUPABASE_URL');
  const SERVICE_ROLE_KEY = Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const ANTHROPIC_KEY    = Netlify.env.get('ANTHROPIC_API_KEY');

  // Load existing memory for this user
  let existingMemory = '';
  try {
    const dbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_profiles?email=eq.${encodeURIComponent(user_email)}&select=memory`,
      {
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    if (dbRes.ok) {
      const rows = await dbRes.json();
      existingMemory = rows?.[0]?.memory || '';
    }
  } catch {}

  // Merge new session summary with existing memory using Claude
  let mergedMemory = summary;

  if (existingMemory && ANTHROPIC_KEY) {
    try {
      const mergeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 600,
          messages: [{
            role: 'user',
            content: `Ti si asistent koji ažurira trajni profil korisnika za AI agenta emotivne podrške.

POSTOJEĆI PROFIL:
${existingMemory}

NOVA SESIJA (sažetak):
${summary}

Napravi AŽURIRANI PROFIL koji:
- Zadržava stabilne činjenice (ime, ključne osobe, ponavljajuće teme, tekuće situacije)
- Uklanja prolazne detalje koji više nisu relevantni
- Integriše nove informacije iz ove sesije
- Piše u trećem licu, srpski jezik (ekavica)
- Ne prelazi 300 reči
- Ne objašnjava šta radiš — samo napiši profil direktno

Ažurirani profil:`,
          }],
        }),
      });
      if (mergeRes.ok) {
        const mergeData = await mergeRes.json();
        const merged = mergeData.content?.[0]?.text?.trim();
        if (merged) mergedMemory = merged;
      }
    } catch {}
  }

  // Upsert merged memory into user_profiles
  const upsertRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_profiles?email=eq.${encodeURIComponent(user_email)}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ memory: mergedMemory }),
    }
  );

  return new Response(null, { status: upsertRes.ok ? 200 : 500 });
};

export const config = { path: '/api/voiceflow-save-memory' };
