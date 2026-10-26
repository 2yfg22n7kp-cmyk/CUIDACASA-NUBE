// Corre sola cada 2 minutos: detecta alertas nuevas (también las que dependen
// de la hora, como "sin llegada" o "medicación sin registrar") y avisa al celular.
import { admin, barrer } from '../lib/barrer.mjs';

export default async () => {
  try {
    const r = await barrer(admin());
    console.log('barrido', JSON.stringify(r));
  } catch (e) {
    console.error('error en el barrido', e && e.message);
  }
};

export const config = { schedule: '*/2 * * * *' };
