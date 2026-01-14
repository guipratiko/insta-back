import { MongoClient } from 'mongodb';
const MONGO_URI = 'mongodb+srv://clerky:qGfdSCz1bDTuHD5o@cluster0.6mgam.mongodb.net/sis-clerky';

(async () => {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  
  console.log('🔄 Atualizando conta para mapear múltiplos IDs de webhook...\n');
  
  // Atualizar @clerky_ia para aceitar múltiplos webhook IDs
  const updateResult = await db.collection('instagram_accounts').updateOne(
    { username: 'clerky_ia' },
    { 
      $set: { 
        // ID principal (principal webhook entry.id)
        instagram_account_id: '17841475047401790',
        // IDs alternativos (outros contextos de webhook)
        webhook_ids: ['17841475047401790', '17841400776820446'],
        updated_at: new Date()
      } 
    }
  );
  console.log(`✅ Conta @clerky_ia atualizada (modified: ${updateResult.modifiedCount})`);
  
  // Verificar resultado
  console.log('\n📊 Conta @clerky_ia:');
  const account = await db.collection('instagram_accounts').findOne({ username: 'clerky_ia' });
  console.log(`  - ID Principal: ${account.instagram_account_id}`);
  console.log(`  - Webhook IDs: ${account.webhook_ids.join(', ')}`);
  
  await client.close();
  console.log('\n✅ Concluído! Agora o webhook aceitará ambos os IDs');
})();
