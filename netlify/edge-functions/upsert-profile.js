/**
 * POST /api/upsert-profile
 * Verifies the user's JWT, then upserts a row in user_profiles using the
 * service role key (which lives only in this server-side function).
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

  const SUPABASE_URL      = Netlify.env.get('SUPABASE_URL');
  const ANON_KEY          = Netlify.env.get('SUPABASE_ANON_KEY');
  const SERVICE_ROLE_KEY  = Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY');

  // Verify token → get user identity
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!userRes.ok) return new Response('Unauthorized', { status: 401 });
  const user = await userRes.json();

  // Upsert profile — service role key never leaves this function
  const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=ignore-duplicates',
    },
    body: JSON.stringify({
      user_id: user.id,
      email: user.email,
      voiceflow_user_id: user.id,
    }),
  });

  return new Response(null, { status: dbRes.ok ? 200 : 500 });
};

export const config = { path: '/api/upsert-profile' };
