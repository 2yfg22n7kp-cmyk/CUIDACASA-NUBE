// Revisa las alertas del día y manda un aviso al celular de la coordinación
// por cada alerta nueva. Las críticas se recuerdan cada 10 minutos (hasta 3 veces)
// mientras nadie las marque como gestionadas en el tablero.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getAuth } from 'firebase-admin/auth';
import crearLogica from './logica.mjs';

const PROYECTO = 'gestion-cuidados-83327';
const TZ = 'America/Argentina/Buenos_Aires';
const RECORDAR_MIN = 10;
const MAX_VECES = 3;

export function admin() {
  if (!getApps().length) {
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    if (!clientEmail || !privateKey) throw new Error('Faltan FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY en Netlify');
    initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID || PROYECTO, clientEmail, privateKey }) });
  }
  return { db: getFirestore(), msg: getMessaging(), auth: getAuth() };
}

export function ahora(fecha = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(fecha);
  const g = t => (p.find(x => x.type === t) || {}).value;
  return { fecha: g('year') + '-' + g('month') + '-' + g('day'), min: (+g('hour')) * 60 + (+g('minute')) };
}

export async function cargar(db, fecha) {
  const S = { equipo: { miembros: {} }, pacientes: {}, dias: {}, names: {}, fecha };
  const eq = await db.collection('config').doc('equipo').get();
  if (eq.exists) S.equipo = Object.assign({ miembros: {} }, eq.data());
  (await db.collection('pacientes').get()).forEach(d => { S.pacientes[d.id] = d.data(); });
  (await db.collection('dias').where('fecha', '==', fecha).get()).forEach(d => { const x = d.data(); if (x.pid) S.dias[x.pid] = x; });
  Object.keys(S.pacientes).forEach(pid => { const p = S.pacientes[pid]; if (!Array.isArray(p.turno)) p.turno = [480, 1200]; });
  return S;
}

export async function tokensDe(db, uids) {
  const out = [];
  for (const uid of [...new Set(uids)]) {
    const d = await db.collection('tokens').doc(uid).get();
    ((d.exists && d.data().lista) || []).forEach(tok => out.push({ uid, tok }));
  }
  return out;
}

const MALOS = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument'];

export async function enviar(db, msg, destinos, aviso, link) {
  if (!destinos.length) return 0;
  const r = await msg.sendEachForMulticast({
    tokens: destinos.map(d => d.tok),
    notification: { title: aviso.titulo, body: aviso.cuerpo },
    webpush: {
      headers: { Urgency: aviso.crit ? 'high' : 'normal', TTL: '3600' },
      notification: { icon: '/icon-192.png', badge: '/icon-192.png', tag: aviso.tag, renotify: true, requireInteraction: !!aviso.crit, vibrate: aviso.crit ? [400, 150, 400, 150, 400] : [250, 120, 250] },
      fcmOptions: { link },
    },
    data: { tag: aviso.tag },
  });
  let ok = 0;
  for (let i = 0; i < r.responses.length; i++) {
    const x = r.responses[i];
    if (x.success) { ok++; continue; }
    const code = x.error && x.error.code;
    if (MALOS.includes(code)) {
      const d = destinos[i];
      await db.collection('tokens').doc(d.uid).set({ lista: FieldValue.arrayRemove(d.tok) }, { merge: true });
    }
  }
  return ok;
}

export function enlace() {
  return (process.env.URL || 'https://gestion-cuidados-domiciliarios.netlify.app') + '/';
}

export async function barrer({ db, msg }, cuando = new Date()) {
  const { fecha, min } = ahora(cuando);
  const S = await cargar(db, fecha);
  const destinos = await tokensDe(db, S.equipo.admins || []);
  if (!destinos.length) return { fecha, alertas: 0, enviados: 0, destinos: 0 };
  const L = crearLogica(S);
  const al = L.alertas(min).filter(a => !a.ack && a.sev !== 'info');
  const t = cuando.getTime();
  let enviados = 0;
  for (const a of al) {
    const ref = db.collection('avisos').doc((fecha + '_' + a.id).replace(/\//g, '-').slice(0, 1400));
    const snap = await ref.get();
    const prev = snap.exists ? snap.data() : null;
    const veces = (prev && prev.veces) || 0;
    const toca = !prev || (a.sev === 'crit' && veces < MAX_VECES && t - (prev.ultimo || 0) >= RECORDAR_MIN * 60000);
    if (!toca) continue;
    const p = S.pacientes[a.pid] || {};
    const n = await enviar(db, msg, destinos, {
      titulo: (prev ? 'Sigue sin gestionar: ' : (a.sev === 'crit' ? 'URGENTE: ' : '')) + a.t1,
      cuerpo: (p.nombre || '') + ' · ' + a.t2,
      tag: a.id,
      crit: a.sev === 'crit',
    }, enlace());
    await ref.set({ fecha, pid: a.pid, id: a.id, sev: a.sev, veces: veces + 1, ultimo: t, enviados: n }, { merge: true });
    enviados += n;
  }
  return { fecha, alertas: al.length, enviados, destinos: destinos.length };
}
