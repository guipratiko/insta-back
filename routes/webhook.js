import express from 'express';
import db from '../database/init.js';

const router = express.Router();
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;

// Verificação do webhook (GET)
router.get('/instagram', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('🔍 Webhook validation attempt');
  console.log('   Token recebido:', token);
  console.log('   Token esperado:', VERIFY_TOKEN);
  console.log('   Corresponde?', token === VERIFY_TOKEN);

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verificado!');
    console.log('   Retornando challenge:', challenge);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end(String(challenge));
  }
  
  console.error('❌ Token inválido');
  return res.sendStatus(403);
});

// Receber eventos do webhook (POST)
router.post('/instagram', (req, res) => {
  const body = req.body;

  console.log('📨 Webhook recebido:', JSON.stringify(body, null, 2));

  if (body.object === 'instagram') {
    body.entry?.forEach(entry => {
      const recipientId = entry.id; // ID da conta Instagram que recebeu a mensagem

      // Processar mensagens
      if (entry.messaging) {
        entry.messaging.forEach(event => {
          handleMessage(recipientId, event);
        });
      }

      // Processar mudanças (comentários, etc)
      if (entry.changes) {
        entry.changes.forEach(change => {
          handleChange(recipientId, change);
        });
      }
    });

    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// Processar mensagem recebida
function handleMessage(recipientId, event) {
  const senderId = event.sender?.id;
  const message = event.message;
  const timestamp = event.timestamp;

  console.log(`💬 Mensagem recebida na conta ${recipientId} de ${senderId}:`, message?.text);

  // Buscar conta no banco pelo instagram_account_id
  const accountStmt = db.prepare('SELECT id FROM instagram_accounts WHERE instagram_account_id = ?');
  const account = accountStmt.get(recipientId);

  if (!account) {
    console.error(`❌ Conta ${recipientId} não encontrada no banco`);
    return;
  }

  // Salvar mensagem no banco
  const stmt = db.prepare(`
    INSERT INTO messages (account_id, sender_id, recipient_id, message_id, text, timestamp, raw_data)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(message_id) DO NOTHING
  `);

  stmt.run(
    account.id,
    senderId,
    recipientId,
    message?.mid || `msg_${Date.now()}`,
    message?.text || '',
    timestamp,
    JSON.stringify(event)
  );

  console.log(`✅ Mensagem salva no banco (account_id: ${account.id})`);

  // Aqui você pode adicionar lógica de resposta automática
  // sendAutoReply(account.id, senderId, message?.text);
}

// Processar mudanças (comentários, menções, etc)
function handleChange(recipientId, change) {
  const value = change.value;

  console.log(`🔔 Mudança recebida na conta ${recipientId}:`, change.field);

  // Buscar conta no banco
  const accountStmt = db.prepare('SELECT id FROM instagram_accounts WHERE instagram_account_id = ?');
  const account = accountStmt.get(recipientId);

  if (!account) {
    console.error(`❌ Conta ${recipientId} não encontrada no banco`);
    return;
  }

  // Processar comentários
  if (change.field === 'comments' && value.text) {
    const stmt = db.prepare(`
      INSERT INTO comments (account_id, comment_id, post_id, from_user_id, from_username, text, timestamp, raw_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(comment_id) DO NOTHING
    `);

    stmt.run(
      account.id,
      value.id || `comment_${Date.now()}`,
      value.media?.id || '',
      value.from?.id || '',
      value.from?.username || '',
      value.text,
      Date.now(),
      JSON.stringify(change)
    );

    console.log(`✅ Comentário salvo no banco (account_id: ${account.id})`);
  }
}

export default router;
