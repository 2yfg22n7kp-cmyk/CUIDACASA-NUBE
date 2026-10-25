// Entrega a la app la clave pública para activar los avisos (no es secreta).
export default async () => new Response(JSON.stringify({ vapid: process.env.VAPID_PUBLIC_KEY || null }), {
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
