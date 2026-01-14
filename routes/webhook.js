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
    console.log('✅ Webhook verificado com sucesso!');
    return res.status(200).send(challenge);
  }
  
  console.error('❌ Token inválido');
  return res.sendStatus(403);
});

// Receber eventos do webhook (POST)
router.post('/instagram', async (req, res) => {
  const body = req.body;

  console.log('📨 Webhook recebido:', JSON.stringify(body, null, 2));

  if (body.object === 'instagram') {
    for (const entry of body.entry || []) {
      const recipientId = entry.id; // ID da conta Instagram que recebeu a mensagem

      // Processar mensagens
      if (entry.messaging) {
        for (const event of entry.messaging) {
          await handleMessage(recipientId, event);
        }
      }

      // Processar mudanças (comentários, etc)
      if (entry.changes) {
        for (const change of entry.changes) {
          await handleChange(recipientId, change);
        }
      }
    }

    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// Processar mensagem recebida
async function handleMessage(recipientId, event) {
  const senderId = event.sender?.id;
  const message = event.message;
  const timestamp = event.timestamp;

  console.log(`💬 Mensagem recebida na conta ${recipientId} de ${senderId}:`, message?.text);

  // Buscar conta no banco pelo instagram_account_id
  const account = await db.getAccountByInstagramId(recipientId);

  if (!account) {
    console.error(`❌ Conta ${recipientId} não encontrada no banco`);
    
    // Debug: listar todas as contas no banco
    const allAccounts = await db.getAccountsByUserId(1);
    console.log(`📊 Contas no banco:`, allAccounts.map(a => ({ 
      id: a.instagram_account_id, 
      username: a.username 
    })));
    return;
  }

  // Salvar mensagem no banco
  await db.saveMessage({
    account_id: account.id,
    sender_id: senderId,
    recipient_id: recipientId,
    message_id: message?.mid || `msg_${Date.now()}`,
    text: message?.text || '',
    timestamp: timestamp,
    raw_data: JSON.stringify(event)
  });

  console.log(`✅ Mensagem salva no banco (account_id: ${account.id})`);

  // Aqui você pode adicionar lógica de resposta automática
  // sendAutoReply(account.id, senderId, message?.text);
}

// Processar mudanças (comentários, menções, etc)
async function handleChange(recipientId, change) {
  const value = change.value;

  console.log(`🔔 Mudança recebida na conta ${recipientId}:`, change.field);

  // Buscar conta no banco
  const account = await db.getAccountByInstagramId(recipientId);

  if (!account) {
    console.error(`❌ Conta ${recipientId} não encontrada no banco`);
    return;
  }

  // Processar comentários
  if (change.field === 'comments' && value.text) {
    await db.saveComment({
      account_id: account.id,
      comment_id: value.id || `comment_${Date.now()}`,
      post_id: value.media?.id || '',
      from_user_id: value.from?.id || '',
      from_username: value.from?.username || '',
      text: value.text,
      timestamp: Date.now(),
      raw_data: JSON.stringify(change)
    });

    console.log(`✅ Comentário salvo no banco (account_id: ${account.id})`);
  }
}

export default router;
