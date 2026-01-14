import express from 'express';
import axios from 'axios';
import db from '../database/init.js';

const router = express.Router();

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const META_REDIRECT_URI = process.env.META_REDIRECT_URI;
const APP_URL = process.env.APP_URL;

// Gerar URL de login OAuth
router.get('/login', (req, res) => {
  const userId = req.query.userId || '1'; // Em produção, pegar do sistema de autenticação
  
  const scopes = [
    'instagram_basic',
    'instagram_manage_messages',
    'instagram_manage_comments',
    'pages_show_list',
    'pages_read_engagement'
  ];

  const authUrl = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?` +
    `client_id=${META_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}` +
    `&scope=${scopes.join(',')}` +
    `&response_type=code` +
    `&state=${userId}`;

  res.redirect(authUrl);
});

// Callback OAuth
router.get('/callback', async (req, res) => {
  const { code, state: userId } = req.query;

  if (!code) {
    return res.redirect(`${APP_URL}?error=no_code`);
  }

  try {
    // 1. Trocar code por access_token
    const tokenResponse = await axios.get(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
      {
        params: {
          client_id: META_APP_ID,
          client_secret: META_APP_SECRET,
          redirect_uri: META_REDIRECT_URI,
          code
        }
      }
    );

    const { access_token } = tokenResponse.data;

    // 2. Obter informações do usuário e páginas
    const meResponse = await axios.get(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/me`,
      {
        params: {
          fields: 'id,name,accounts{id,name,instagram_business_account{id,username}}',
          access_token
        }
      }
    );

    const pages = meResponse.data.accounts?.data || [];
    
    // 3. Salvar cada conta Instagram conectada
    for (const page of pages) {
      if (page.instagram_business_account) {
        const igAccount = page.instagram_business_account;
        
        // Obter long-lived token para a página
        const pageLongLivedToken = await getLongLivedToken(page.access_token);
        
        // Verificar se usuário existe, senão criar
        const userStmt = db.prepare('INSERT OR IGNORE INTO users (id, name) VALUES (?, ?)');
        userStmt.run(userId, meResponse.data.name);

        // Inserir ou atualizar conta Instagram
        const stmt = db.prepare(`
          INSERT INTO instagram_accounts 
          (user_id, instagram_account_id, username, access_token, page_id, page_name, token_expires_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+60 days'))
          ON CONFLICT(instagram_account_id) 
          DO UPDATE SET 
            access_token = excluded.access_token,
            username = excluded.username,
            page_id = excluded.page_id,
            page_name = excluded.page_name,
            token_expires_at = excluded.token_expires_at,
            updated_at = CURRENT_TIMESTAMP
        `);

        stmt.run(
          userId,
          igAccount.id,
          igAccount.username,
          pageLongLivedToken,
          page.id,
          page.name
        );

        console.log(`✅ Conta Instagram conectada: @${igAccount.username} (${igAccount.id})`);
      }
    }

    res.redirect(`${APP_URL}?connected=success`);
  } catch (error) {
    console.error('Erro no callback OAuth:', error.response?.data || error.message);
    res.redirect(`${APP_URL}?error=oauth_failed`);
  }
});

// Obter long-lived token
async function getLongLivedToken(shortToken) {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
      {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: META_APP_ID,
          client_secret: META_APP_SECRET,
          fb_exchange_token: shortToken
        }
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error('Erro ao obter long-lived token:', error.response?.data || error.message);
    return shortToken; // Fallback para o token original
  }
}

// Listar contas conectadas
router.get('/accounts', (req, res) => {
  const userId = req.query.userId || '1';
  
  const stmt = db.prepare(`
    SELECT 
      id,
      instagram_account_id,
      username,
      page_name,
      token_expires_at,
      created_at,
      updated_at
    FROM instagram_accounts 
    WHERE user_id = ?
    ORDER BY created_at DESC
  `);

  const accounts = stmt.all(userId);
  res.json({ accounts });
});

// Enviar mensagem para um usuário
router.post('/send-message', async (req, res) => {
  const { accountId, recipientId, message } = req.body;

  if (!accountId || !recipientId || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Buscar access token da conta
    const stmt = db.prepare('SELECT access_token, instagram_account_id FROM instagram_accounts WHERE id = ?');
    const account = stmt.get(accountId);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Enviar mensagem via Graph API
    const response = await axios.post(
      `https://graph.instagram.com/${META_GRAPH_VERSION}/me/messages`,
      {
        recipient: { id: recipientId },
        message: { text: message }
      },
      {
        headers: {
          'Authorization': `Bearer ${account.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to send message',
      details: error.response?.data 
    });
  }
});

// Listar mensagens recebidas
router.get('/messages', (req, res) => {
  const accountId = req.query.accountId;
  
  if (!accountId) {
    return res.status(400).json({ error: 'accountId is required' });
  }

  const stmt = db.prepare(`
    SELECT * FROM messages 
    WHERE account_id = ?
    ORDER BY timestamp DESC
    LIMIT 100
  `);

  const messages = stmt.all(accountId);
  res.json({ messages });
});

// Refresh token
router.post('/refresh-token', async (req, res) => {
  const { accountId } = req.body;

  try {
    const stmt = db.prepare('SELECT access_token FROM instagram_accounts WHERE id = ?');
    const account = stmt.get(accountId);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const response = await axios.get(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
      {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: META_APP_ID,
          client_secret: META_APP_SECRET,
          fb_exchange_token: account.access_token
        }
      }
    );

    const newToken = response.data.access_token;

    // Atualizar token no banco
    const updateStmt = db.prepare(`
      UPDATE instagram_accounts 
      SET access_token = ?, token_expires_at = datetime('now', '+60 days'), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    updateStmt.run(newToken, accountId);

    res.json({ success: true, message: 'Token refreshed' });
  } catch (error) {
    console.error('Erro ao renovar token:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

export default router;
