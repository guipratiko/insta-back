import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://clerky:qGfdSCz1bDTuHD5o@cluster0.6mgam.mongodb.net/sis-clerky?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = 'sis-clerky';

let client;
let db;

// Conectar ao MongoDB
async function connectMongo() {
  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log('✅ Conectado ao MongoDB');
  } catch (error) {
    console.error('❌ Erro ao conectar MongoDB:', error.message);
    throw error;
  }
}

// Wrapper para compatibilidade com código anterior (sql.js)
const dbWrapper = {
  prepare: (sql) => {
    return {
      run: (...params) => {
        // Executar de forma síncrona retornando uma promise
        const promise = executeSql(sql, params, 'run');
        return promise; // Retorna Promise
      },
      get: (...params) => {
        return executeSql(sql, params, 'get');
      },
      all: (...params) => {
        return executeSql(sql, params, 'all');
      }
    };
  }
};

// Executor SQL -> MongoDB
async function executeSql(sql, params, mode) {
  // INSERT INTO instagram_accounts
  if (sql.includes('INSERT INTO instagram_accounts')) {
    const collection = db.collection('instagram_accounts');
    const doc = {
      user_id: params[0],
      instagram_account_id: params[1],
      username: params[2],
      access_token: params[3],
      page_id: params[4],
      page_name: params[5],
      token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      created_at: new Date(),
      updated_at: new Date()
    };
    
    try {
      const result = await collection.updateOne(
        { instagram_account_id: params[1] },
        { $set: doc },
        { upsert: true }
      );
      return { changes: result.modifiedCount + result.upsertedCount };
    } catch (error) {
      if (error.code === 11000) return { changes: 0 }; // Duplicate key
      throw error;
    }
  }

  // INSERT OR IGNORE INTO users
  if (sql.includes('INSERT OR IGNORE INTO users')) {
    const collection = db.collection('users');
    try {
      await collection.updateOne(
        { _id: params[0] },
        { $set: { _id: params[0], name: params[1], created_at: new Date() } },
        { upsert: true }
      );
      return { changes: 1 };
    } catch (error) {
      return { changes: 0 };
    }
  }

  // INSERT INTO messages
  if (sql.includes('INSERT INTO messages')) {
    const collection = db.collection('messages');
    const doc = {
      account_id: params[0],
      sender_id: params[1],
      recipient_id: params[2],
      message_id: params[3],
      text: params[4],
      timestamp: params[5],
      raw_data: params[6],
      replied: false,
      created_at: new Date()
    };
    
    try {
      const result = await collection.updateOne(
        { message_id: params[3] },
        { $set: doc },
        { upsert: true }
      );
      return { changes: result.modifiedCount + result.upsertedCount };
    } catch (error) {
      if (error.code === 11000) return { changes: 0 };
      throw error;
    }
  }

  // INSERT INTO comments
  if (sql.includes('INSERT INTO comments')) {
    const collection = db.collection('comments');
    const doc = {
      account_id: params[0],
      comment_id: params[1],
      post_id: params[2],
      from_user_id: params[3],
      from_username: params[4],
      text: params[5],
      timestamp: params[6],
      raw_data: params[7],
      replied: false,
      created_at: new Date()
    };
    
    try {
      const result = await collection.updateOne(
        { comment_id: params[1] },
        { $set: doc },
        { upsert: true }
      );
      return { changes: result.modifiedCount + result.upsertedCount };
    } catch (error) {
      if (error.code === 11000) return { changes: 0 };
      throw error;
    }
  }

  // SELECT FROM instagram_accounts (by id)
  if (sql.includes('SELECT id FROM instagram_accounts WHERE instagram_account_id')) {
    const collection = db.collection('instagram_accounts');
    const doc = await collection.findOne({ instagram_account_id: params[0] });
    return doc;
  }

  // SELECT FROM instagram_accounts WHERE instagram_account_id (for webhook)
  if (sql.includes('SELECT') && sql.includes('instagram_accounts') && sql.includes('instagram_account_id')) {
    const collection = db.collection('instagram_accounts');
    const doc = await collection.findOne({ instagram_account_id: params[0] });
    if (mode === 'get') return doc;
    if (mode === 'all') return doc ? [doc] : [];
  }

  // SELECT * FROM instagram_accounts WHERE user_id (list accounts)
  if (sql.includes('SELECT') && sql.includes('FROM instagram_accounts') && sql.includes('user_id')) {
    const collection = db.collection('instagram_accounts');
    const docs = await collection.find({ user_id: params[0] }).toArray();
    return mode === 'all' ? docs : docs[0] || null;
  }

  // SELECT * FROM messages WHERE account_id
  if (sql.includes('SELECT') && sql.includes('FROM messages') && sql.includes('account_id')) {
    const collection = db.collection('messages');
    const docs = await collection.find({ account_id: params[0] }).sort({ timestamp: -1 }).toArray();
    return mode === 'all' ? docs : docs[0] || null;
  }

  // SELECT COUNT(*) FROM instagram_accounts
  if (sql.includes('SELECT COUNT')) {
    const match = sql.match(/FROM (\w+)/);
    if (match) {
      const collection = db.collection(match[1]);
      const count = await collection.countDocuments();
      return { count };
    }
  }

  // UPDATE access_token
  if (sql.includes('UPDATE instagram_accounts SET access_token')) {
    const collection = db.collection('instagram_accounts');
    const result = await collection.updateOne(
      { _id: params[1] },
      {
        $set: {
          access_token: params[0],
          token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          updated_at: new Date()
        }
      }
    );
    return { changes: result.modifiedCount };
  }

  console.warn('⚠️ Query not implemented:', sql.substring(0, 50));
  return null;
}

export async function initDatabase() {
  console.log('🗄️  Inicializando banco de dados MongoDB...');
  console.log(`📊 MongoDB URI: ${MONGO_URI.substring(0, 40)}...`);
  
  await connectMongo();

  // Criar índices
  try {
    const igAccounts = db.collection('instagram_accounts');
    await igAccounts.createIndex({ instagram_account_id: 1 }, { unique: true });
    await igAccounts.createIndex({ user_id: 1 });
    
    const messages = db.collection('messages');
    await messages.createIndex({ message_id: 1 }, { unique: true });
    await messages.createIndex({ account_id: 1 });
    
    const comments = db.collection('comments');
    await comments.createIndex({ comment_id: 1 }, { unique: true });
    await comments.createIndex({ account_id: 1 });
    
    console.log('✅ Índices criados');
  } catch (error) {
    console.error('⚠️ Erro ao criar índices:', error.message);
  }

  // Debug: contar documentos
  try {
    const count = await db.collection('instagram_accounts').countDocuments();
    console.log(`📊 Contas no banco: ${count}`);
  } catch (error) {
    console.error('Erro ao contar contas:', error.message);
  }

  console.log('✅ Banco de dados inicializado');
}

export { dbWrapper as db };
export default dbWrapper;
