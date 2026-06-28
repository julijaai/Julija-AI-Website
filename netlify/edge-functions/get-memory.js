/**
 * GET /api/get-memory
 * Returns the stored memory summary for the authenticated user.
 */
export default async (request) => {
  if (request.method !== 'GET') {
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

  // Verify token → get user identity
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

  if (!dbRes.ok) {
    return new Response(JSON.stringify({ memory: '' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rows = await dbRes.json();
  const memory = rows?.[0]?.memory ?? '';

  return new Response(JSON.stringify({ memory }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { path: '/api/get-memory' };
