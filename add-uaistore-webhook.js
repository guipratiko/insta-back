import { MongoClient } from 'mongodb';
const MONGO_URI = 'mongodb+srv://clerky:qGfdSCz1bDTuHD5o@cluster0.6mgam.mongodb.net/sis-clerky';

(async () => {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  
  console.log('🔄 Atualizando @uaistore.go com webhook ID correto...\n');
  
  // Atualizar @uaistore.go com webhook_ids
  const updateResult = await db.collection('instagram_accounts').updateOne(
    { username: 'uaistore.go' },
    { 
      $set: { 
        // ID principal para webhooks (é o ID que recebe/envia mensagens)
        webhook_ids: ['17841475047401790'],
        updated_at: new Date()
      } 
    }
  );
  console.log(`✅ Conta @uaistore.go atualizada (modified: ${updateResult.modifiedCount})`);
  
  // Verificar resultado
  console.log('\n📊 Contas no banco:');
  const allAccounts = await db.collection('instagram_accounts').find({}).toArray();
  allAccounts.forEach(acc => {
    console.log(`\n  @${acc.username}`);
    console.log(`    - API ID: ${acc.instagram_account_id}`);
    console.log(`    - Webhook IDs: ${(acc.webhook_ids || [acc.instagram_account_id]).join(', ')}`);
  });
  
  await client.close();
  console.log('\n✅ Concluído!');
})();
