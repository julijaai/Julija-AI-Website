/**
 * GET /api/voiceflow-get-memory?email={email}
 * Called by Voiceflow's LOAD Workflow at session start to retrieve the user's
 * persistent memory. Auth: shared secret (Voiceflow calls this server-to-server).
 * Returns { memory: "..." } — empty string if no memory exists yet.
 */
export default async (request) => {
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const authHeader = request.headers.get('Authorization');
  const API_SECRET = Netlify.env.get('VOICEFLOW_API_SECRET');
  if (!authHeader || authHeader !== `Bearer ${API_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const email = url.searchParams.get('email');

  if (!email) {
    return new Response(JSON.stringify({ memory: '' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const SUPABASE_URL     = Netlify.env.get('SUPABASE_URL');
  const SERVICE_ROLE_KEY = Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY');

  try {
    const dbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_profiles?email=eq.${encodeURIComponent(email)}&select=memory`,
      {
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    const rows = dbRes.ok ? await dbRes.json() : [];
    const memory = rows?.[0]?.memory || '';

    return new Response(JSON.stringify({ memory }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ memory: '' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config = { path: '/api/voiceflow-get-memory' };
