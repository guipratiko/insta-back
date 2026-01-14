import { MongoClient } from 'mongodb';
const MONGO_URI = 'mongodb+srv://clerky:qGfdSCz1bDTuHD5o@cluster0.6mgam.mongodb.net/sis-clerky';

(async () => {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  
  console.log('🔧 Corrigindo mapeamento de webhook IDs...\n');
  
  // 1. Atualizar @clerky_ia
  await db.collection('instagram_accounts').updateOne(
    { username: 'clerky_ia' },
    { 
      $set: { 
        instagram_account_id: '17841475047401790',
        webhook_ids: ['17841475047401790'],
        updated_at: new Date()
      } 
    }
  );
  console.log('✅ @clerky_ia atualizada → webhook_id: 17841475047401790');
  
  // 2. Atualizar @uaistore.go
  await db.collection('instagram_accounts').updateOne(
    { username: 'uaistore.go' },
    { 
      $set: { 
        instagram_account_id: '17841400776820446',
        webhook_ids: ['17841400776820446'],
        updated_at: new Date()
      } 
    }
  );
  console.log('✅ @uaistore.go atualizada → webhook_id: 17841400776820446');
  
  // 3. Verificar
  console.log('\n📊 Configuração final:');
  const accounts = await db.collection('instagram_accounts').find({}).toArray();
  accounts.forEach(acc => {
    console.log(`\n  @${acc.username}`);
    console.log(`    - instagram_account_id: ${acc.instagram_account_id}`);
    console.log(`    - webhook_ids: ${(acc.webhook_ids || []).join(', ')}`);
  });
  
  await client.close();
  console.log('\n✅ Mapeamento corrigido! Agora as mensagens vão para as contas corretas.');
})();
