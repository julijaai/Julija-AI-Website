/**
 * POST /api/set-voiceflow-memory
 * Fetches the user's memory from Supabase, then PATCHes the
 * user_memory_from_db variable directly into Voiceflow's runtime state
 * for this user — so it is available before the widget's first interaction.
 */
export default async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 });
  }
  const token = authHeader.slice(7);

  const SUPABASE_URL     = Netlify.env.get('SUPABASE_URL');
  const ANON_KEY         = Netlify.env.get('SUPABASE_ANON_KEY');
  const SERVICE_ROLE_KEY = Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const VF_API_KEY       = Netlify.env.get('VOICEFLOW_API_KEY');

  // Verify JWT → identify user
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}` },
  });
  if (!userRes.ok) return new Response('Unauthorized', { status: 401 });
  const user = await userRes.json();

  // Fetch memory from user_profiles
  const dbRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_profiles?user_id=eq.${user.id}&select=memory`,
    {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
    }
  );
  const rows = dbRes.ok ? await dbRes.json() : [];
  const memory = rows?.[0]?.memory || '';

  // PATCH Voiceflow runtime state — set user_memory_from_db for this user
  // so Julija sees it from the very first interaction.
  // 5-second timeout so a slow/unreachable Voiceflow endpoint never blocks the page.
  if (VF_API_KEY) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      await fetch(
        `https://general-runtime.voiceflow.com/state/user/${encodeURIComponent(user.email)}/variables?versionID=development`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': VF_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_memory_from_db: memory }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);
    } catch {
      // Timeout or network error — non-critical, widget still loads
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { path: '/api/set-voiceflow-memory' };
