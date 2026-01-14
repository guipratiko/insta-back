import { MongoClient } from 'mongodb';
const MONGO_URI = 'mongodb+srv://clerky:qGfdSCz1bDTuHD5o@cluster0.6mgam.mongodb.net/sis-clerky';

// IDs que aparecem nos webhooks
const webhookAccountIds = [
  '17841400776820446',
  '17841475047401790'
];

(async () => {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  
  console.log('🔄 Adicionando contas dos webhooks...\n');
  
  for (const accountId of webhookAccountIds) {
    // Verificar se já existe
    const existing = await db.collection('instagram_accounts').findOne({ 
      instagram_account_id: accountId 
    });
    
    if (existing) {
      console.log(`✅ Conta ${accountId} já existe`);
      continue;
    }
    
    // Buscar o token da conta existente para copiar
    const mainAccount = await db.collection('instagram_accounts').findOne({ 
      username: 'clerky_ia' 
    });
    
    // Adicionar nova conta usando o mesmo token (pode precisar atualizar depois)
    await db.collection('instagram_accounts').insertOne({
      user_id: 1,
      instagram_account_id: accountId,
      username: `account_${accountId.slice(-6)}`,
      access_token: mainAccount.access_token, // Usar token da conta principal
      page_id: accountId,
      page_name: `Account ${accountId.slice(-6)}`,
      token_expires_at: mainAccount.token_expires_at,
      created_at: new Date(),
      updated_at: new Date()
    });
    
    console.log(`✅ Conta ${accountId} adicionada`);
  }
  
  // Listar todas as contas
  console.log('\n📊 Contas no banco:');
  const allAccounts = await db.collection('instagram_accounts').find({}).toArray();
  allAccounts.forEach(acc => {
    console.log(`  - ${acc.instagram_account_id} (${acc.username})`);
  });
  
  await client.close();
  console.log('\n✅ Concluído!');
})();
