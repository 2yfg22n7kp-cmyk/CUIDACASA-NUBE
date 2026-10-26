// Generado a partir de index.html: misma lógica de alertas que ve el tablero.
export default function crearLogica(S){
'use strict';
const TIPOS={postural:{n:'Cambio de posición',ico:'pos'},hidratacion:{n:'Hidratación',ico:'hid'},alimentacion:{n:'Alimentación',ico:'ali'},medicacion:{n:'Medicación',ico:'med'},higiene:{n:'Higiene',ico:'hig'}};
const ALARMA=/enrojec|no quis|no comi|rechaz|ca[ií]d|fiebre|v[oó]mit|confus|ahog|dolor|sangr|desmay/i;
const hhmm=t=>{t=Math.max(0,Math.round(t));return String(Math.floor(t/60)%24).padStart(2,'0')+':'+String(t%60).padStart(2,'0');};
const pct=(a,b)=>b?Math.round(a/b*100):0;
const activos=()=>Object.keys(S.pacientes).filter(pid=>S.pacientes[pid].activo!==false).sort((a,b)=>String(S.pacientes[a].nombre).localeCompare(S.pacientes[b].nombre));
function personasDe(pid,r){return Object.keys(S.equipo.miembros||{}).filter(u=>{const m=S.equipo.miembros[u];return m.rol===r&&(m.pacientes||[]).includes(pid);});}
function nombre(uid){const m=(S.equipo.miembros||{})[uid];if(m&&m.nombre)return m.nombre;if(uid==='owner'||(S.equipo.admins||[]).includes(uid)){const ai=(S.equipo.adminInfo||{})[uid];return (ai&&ai.nombre)||'Coordinación';}const p=S.names[uid];return (p&&p.name)||'Alguien del equipo';}
function tareas(pid){
  const p=S.pacientes[pid],out=[]; if(!p) return out;
  const t0=p.turno[0],t1=p.turno[1];
  (p.plan||[]).forEach(it=>{
    let hs=[];
    if(it.horas&&it.horas.length) hs=it.horas.slice();
    else if(it.cada>0){for(let t=(it.desde!=null?it.desde:t0+30);t<t1;t+=it.cada*60) hs.push(t);}
    hs.filter(t=>t>=t0&&t<t1).forEach(t=>out.push({key:it.id+'@'+t,it,t}));
  });
  return out.sort((a,b)=>a.t-b.t);
}
const dia=pid=>S.dias[pid]||{};
const regs=pid=>Object.values(dia(pid).reg||{}).sort((a,b)=>a.t-b.t);
const regDe=(pid,key)=>regs(pid).find(r=>r.key===key);
function estado(pid,tk,c){
  const r=regDe(pid,tk.key);
  if(r) return Math.abs(r.t-tk.t)<=30?'hecha':'tarde';
  if(c<tk.t-30) return 'proxima';
  if(c<=tk.t+30) return 'ahora';
  return 'omitida';
}
function cumplimiento(pid,c){let prog=0,ok=0;tareas(pid).forEach(tk=>{const e=estado(pid,tk,c);if(e==='proxima'||e==='ahora')return;prog++;if(e==='hecha')ok++;});return {prog,ok,p:pct(ok,prog)};}
const liquidos=pid=>regs(pid).filter(r=>r.tipo==='hidratacion').reduce((s,r)=>s+((r.d&&r.d.ml)||0),0);
const metaLiq=pid=>{const it=((S.pacientes[pid]||{}).plan||[]).find(i=>i.tipo==='hidratacion');return it?(it.meta||0):0;};
function ultimoPostural(pid){const rs=regs(pid).filter(r=>r.tipo==='postural').map(r=>r.t);const ci=dia(pid).checkin;if(!rs.length) return ci?ci.t:null;return Math.max.apply(null,rs.concat(ci?[ci.t]:[]));}
const novs=pid=>Object.keys(dia(pid).nov||{}).map(id=>Object.assign({id},dia(pid).nov[id])).sort((a,b)=>a.t-b.t);
function alertas(c){
  const out=[];
  activos().forEach(pid=>{
    const p=S.pacientes[pid],d=dia(pid),ci=d.checkin,cuid=personasDe(pid,'cuidadora').map(nombre).join(', ')||'La cuidadora';
    novs(pid).forEach(n=>{
      if(n.caida) out.push({id:'nov-'+n.id,pid,sev:'crit',t:n.t,t1:'Caída reportada',t2:'“'+n.txt+'”'});
      else if(ALARMA.test(n.txt)) out.push({id:'nov-'+n.id,pid,sev:'warn',t:n.t,t1:'Señal de alarma en una novedad',t2:'“'+n.txt+'”'});
    });
    if(c<p.turno[0]) return;
    if(!ci){ if(c>p.turno[0]+15) out.push({id:'sinllegada-'+pid,pid,sev:'crit',t:p.turno[0]+15,t1:'Sin llegada registrada',t2:cuid+' debía llegar a las '+hhmm(p.turno[0])+'.'}); return; }
    if(ci.t-p.turno[0]>10) out.push({id:'tarde-'+pid,pid,sev:'info',t:ci.t,t1:'Llegada tardía',t2:(ci.t-p.turno[0])+' min tarde ('+hhmm(ci.t)+').'});
    if(d.checkout) return;
    if((p.plan||[]).some(i=>i.tipo==='postural')){const u=ultimoPostural(pid);if(u!==null&&c-u>150) out.push({id:'postural-'+pid+'-'+u,pid,sev:'crit',t:u+150,t1:'Más de 2 h 30 min sin cambio de posición',t2:'Último registro: '+hhmm(u)+(p.val&&p.val.braden?' · Braden '+p.val.braden:'')+'.'});}
    const meta=metaLiq(pid);
    if(meta){const fr=Math.min(1,(c-p.turno[0])/(p.turno[1]-p.turno[0])),esp=meta*fr,tot=liquidos(pid);
      if(fr>0.25&&tot<0.7*esp) out.push({id:'hid-'+pid+'-'+Math.floor(c/120),pid,sev:'warn',t:c,t1:'Hidratación por debajo del objetivo',t2:tot+' ml registrados; a esta hora se esperaban unos '+Math.round(esp/50)*50+' ml (meta: '+meta+' ml).'});}
    tareas(pid).forEach(tk=>{if(tk.it.tipo==='postural'||tk.it.tipo==='hidratacion')return;if(estado(pid,tk,c)==='omitida') out.push({id:'omit-'+pid+'-'+tk.key,pid,sev:tk.it.tipo==='medicacion'?'crit':'warn',t:tk.t+30,t1:TIPOS[tk.it.tipo].n+' de las '+hhmm(tk.t)+' sin registrar',t2:tk.it.obj});});
  });
  const ack=id=>{const pid=(out.find(a=>a.id===id)||{}).pid;return pid&&dia(pid).ack&&dia(pid).ack[id];};
  const rank={crit:0,warn:1,info:2};
  out.forEach(a=>{a.ack=ack(a.id)||null;});
  return out.sort((a,b)=>(!!a.ack)-(!!b.ack)||rank[a.sev]-rank[b.sev]||a.t-b.t);
}
return {alertas,tareas,activos};
}
