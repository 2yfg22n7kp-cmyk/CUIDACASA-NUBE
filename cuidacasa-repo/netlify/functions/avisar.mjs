// La app la llama al instante cuando una cuidadora carga una caída o una novedad,
// para no esperar al barrido programado. También manda el aviso de prueba.
import { admin, barrer, tokensDe, enviar, enlace } from '../lib/barrer.mjs';

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'usar POST' }, 405);
  let A;
  try { A = admin(); } catch (e) { return json({ error: e.message }, 500); }
  const h = req.headers.get('authorization') || '';
  const idToken = h.startsWith('Bearer ') ? h.slice(7) : '';
  let uid;
  try { uid = (await A.auth.verifyIdToken(idToken)).uid; } catch (e) { return json({ error: 'sesión no válida' }, 401); }
  let body = {};
  try { body = await req.json(); } catch (e) {}
  try {
    if (body.prueba) {
      const destinos = await tokensDe(A.db, [uid]);
      if (!destinos.length) return json({ error: 'este usuario no tiene celulares activados', enviados: 0 });
      const n = await enviar(A.db, A.msg, destinos, { titulo: 'Aviso de prueba', cuerpo: 'Si ves esto, las alertas de CuidaCasa llegan a este celular.', tag: 'prueba', crit: false }, enlace());
      return json({ enviados: n, destinos: destinos.length });
    }
    return json(await barrer(A));
  } catch (e) {
    return json({ error: e.message }, 500);
  }
};
