// Notificação push (celular/PC com o app fechado). Chaves VAPID: env VAPID_PUBLIC/VAPID_PRIVATE ou geradas em dados/vapid.json.
import fs from 'node:fs';
import path from 'node:path';
import webpush from 'web-push';
import * as db from './db.js';

const ARQ = path.join(process.cwd(), 'dados', 'vapid.json');
let chaves = null;
function carregar() {
  if (chaves) return chaves;
  if (process.env.VAPID_PUBLIC && process.env.VAPID_PRIVATE) chaves = { publicKey: process.env.VAPID_PUBLIC, privateKey: process.env.VAPID_PRIVATE };
  else {
    try { chaves = JSON.parse(fs.readFileSync(ARQ, 'utf8')); } catch {
      chaves = webpush.generateVAPIDKeys();
      try { fs.mkdirSync(path.dirname(ARQ), { recursive: true }); fs.writeFileSync(ARQ, JSON.stringify(chaves)); } catch { /* sem disco: vale só até reiniciar */ }
    }
  }
  webpush.setVapidDetails(process.env.VAPID_CONTATO || 'mailto:admin@kali.local', chaves.publicKey, chaves.privateKey);
  return chaves;
}
export const chavePublica = () => carregar().publicKey;

/** Manda pra todas as inscrições do usuário; inscrição morta (404/410) é apagada. */
export async function enviarPush(uid, dados) {
  carregar();
  for (const sub of db.inscricoesPush(uid)) {
    try { await webpush.sendNotification(JSON.parse(sub.json), JSON.stringify(dados), { TTL: 3600 }); }
    catch (e) { if (e && (e.statusCode === 404 || e.statusCode === 410)) db.removerPush(sub.endpoint); }
  }
}
