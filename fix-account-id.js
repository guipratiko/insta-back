import { MongoClient } from 'mongodb';
const MONGO_URI = 'mongodb+srv://clerky:qGfdSCz1bDTuHD5o@cluster0.6mgam.mongodb.net/sis-clerky';

(async () => {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  
  console.log('🔧 Corrigindo IDs das contas...\n');
  
  // 1. Remover contas falsas (IDs de usuários que foram adicionados por engano)
  const deleteResult = await db.collection('instagram_accounts').deleteMany({
    username: { $in: ['account_820446', 'account_401790'] }
  });
  console.log(`🗑️  Removidas ${deleteResult.deletedCount} contas falsas`);
  
  // 2. Atualizar @clerky_ia com o ID correto que vem no webhook
  // O webhook envia entry.id = 17841400776820446
  const updateResult = await db.collection('instagram_accounts').updateOne(
    { username: 'clerky_ia' },
    { 
      $set: { 
        instagram_account_id: '17841400776820446',
        updated_at: new Date()
      } 
    }
  );
  console.log(`✅ Conta @clerky_ia atualizada (modified: ${updateResult.modifiedCount})`);
  
  // 3. Verificar resultado
  console.log('\n📊 Contas no banco:');
  const allAccounts = await db.collection('instagram_accounts').find({}).toArray();
  allAccounts.forEach(acc => {
    console.log(`  - ${acc.instagram_account_id} (@${acc.username})`);
  });
  
  await client.close();
  console.log('\n✅ Concluído! Agora o webhook deve encontrar a conta @clerky_ia');
})();
