/**
 * POST /api/save-message
 * Body: { role: 'user' | 'assistant', content: string }
 * Verifies the user's JWT, then inserts a row in conversations using the
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

  // Parse and validate body
  let body;
  try { body = await request.json(); } catch { return new Response('Bad Request', { status: 400 }); }

  const { role, content } = body;
  if (!role || !content || !['user', 'assistant'].includes(role)) {
    return new Response('Bad Request', { status: 400 });
  }

  // Insert message — service role key never leaves this function
  const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      user_id: user.id,
      role,
      content,
      platform: 'Chat widget',
      country: 'Serbia',
    }),
  });

  return new Response(null, { status: dbRes.ok ? 200 : 500 });
};

export const config = { path: '/api/save-message' };
