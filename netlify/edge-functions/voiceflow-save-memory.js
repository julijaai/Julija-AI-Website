/**
 * POST /api/voiceflow-save-memory
 * Called by Voiceflow's API tool to persist a conversation summary.
 * Auth: shared API secret (not JWT — Voiceflow can't hold user tokens).
 * Body: { user_email: string, summary: string }
 */
export default async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Verify shared secret sent by Voiceflow
  const authHeader = request.headers.get('Authorization');
  const API_SECRET = Netlify.env.get('VOICEFLOW_API_SECRET');
  if (!authHeader || authHeader !== `Bearer ${API_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const { user_email, summary } = body;
  if (!user_email || !summary) {
    return new Response('Bad Request', { status: 400 });
  }

  const SUPABASE_URL     = Netlify.env.get('SUPABASE_URL');
  const SERVICE_ROLE_KEY = Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY');

  // Update memory in user_profiles matched by email
  const dbRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_profiles?email=eq.${encodeURIComponent(user_email)}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ memory: summary }),
    }
  );

  return new Response(null, { status: dbRes.ok ? 200 : 500 });
};

export const config = { path: '/api/voiceflow-save-memory' };
