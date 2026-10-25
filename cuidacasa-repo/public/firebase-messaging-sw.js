// Recibe los avisos de CuidaCasa cuando la app está cerrada o el celular bloqueado.
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
firebase.initializeApp({apiKey:"AIzaSyCg1w4c4Dz0dl8tFGv32W64ZWZZItVpkts",authDomain:"gestion-cuidados-83327.firebaseapp.com",projectId:"gestion-cuidados-83327",storageBucket:"gestion-cuidados-83327.firebasestorage.app",messagingSenderId:"571602133974",appId:"1:571602133974:web:27251b4751cb686a827a77"});
firebase.messaging();
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    for (const w of ws) { if ('focus' in w) return w.focus(); }
    return clients.openWindow('/');
  }));
});
