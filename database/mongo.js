import { MongoClient, ObjectId } from 'mongodb';

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

// API MongoDB Nativa
const dbWrapper = {
  // Criar/atualizar usuário
  async createUser(userId, name) {
    const collection = db.collection('users');
    await collection.updateOne(
      { _id: parseInt(userId) },
      { $set: { _id: parseInt(userId), name, created_at: new Date() } },
      { upsert: true }
    );
  },

  // Criar/atualizar conta Instagram
  async upsertInstagramAccount(data) {
    const collection = db.collection('instagram_accounts');
    const result = await collection.updateOne(
      { instagram_account_id: data.instagram_account_id },
      {
        $set: {
          user_id: parseInt(data.user_id),
          instagram_account_id: data.instagram_account_id,
          username: data.username,
          access_token: data.access_token,
          page_id: data.page_id,
          page_name: data.page_name,
          token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          updated_at: new Date()
        },
        $setOnInsert: {
          created_at: new Date()
        }
      },
      { upsert: true }
    );
    return result;
  },

  // Buscar contas por user_id
  async getAccountsByUserId(userId) {
    const collection = db.collection('instagram_accounts');
    const docs = await collection.find({ user_id: parseInt(userId) }).toArray();
    return docs.map(doc => ({
      id: doc._id.toString(),
      user_id: doc.user_id,
      instagram_account_id: doc.instagram_account_id,
      username: doc.username,
      page_name: doc.page_name,
      page_id: doc.page_id,
      token_expires_at: doc.token_expires_at,
      created_at: doc.created_at,
      updated_at: doc.updated_at
    }));
  },

  // Buscar conta por ID
  async getAccountById(accountId) {
    const collection = db.collection('instagram_accounts');
    const doc = await collection.findOne({ _id: new ObjectId(accountId) });
    if (!doc) return null;
    return {
      id: doc._id.toString(),
      instagram_account_id: doc.instagram_account_id,
      username: doc.username,
      access_token: doc.access_token,
      page_id: doc.page_id,
      page_name: doc.page_name
    };
  },

  // Buscar conta por instagram_account_id
  async getAccountByInstagramId(instagramAccountId) {
    const collection = db.collection('instagram_accounts');
    const doc = await collection.findOne({ instagram_account_id: instagramAccountId });
    if (!doc) return null;
    return {
      id: doc._id.toString(),
      instagram_account_id: doc.instagram_account_id,
      access_token: doc.access_token
    };
  },

  // Salvar mensagem
  async saveMessage(data) {
    const collection = db.collection('messages');
    await collection.updateOne(
      { message_id: data.message_id },
      {
        $set: {
          account_id: data.account_id,
          sender_id: data.sender_id,
          recipient_id: data.recipient_id,
          message_id: data.message_id,
          text: data.text,
          timestamp: data.timestamp,
          raw_data: data.raw_data,
          replied: false,
          created_at: new Date()
        }
      },
      { upsert: true }
    );
  },

  // Buscar mensagens por account_id
  async getMessagesByAccountId(accountId) {
    const collection = db.collection('messages');
    const docs = await collection
      .find({ account_id: accountId })
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();
    return docs.map(doc => ({
      id: doc._id.toString(),
      account_id: doc.account_id,
      sender_id: doc.sender_id,
      recipient_id: doc.recipient_id,
      message_id: doc.message_id,
      text: doc.text,
      timestamp: doc.timestamp,
      replied: doc.replied,
      reply_text: doc.reply_text,
      created_at: doc.created_at
    }));
  },

  // Salvar comentário
  async saveComment(data) {
    const collection = db.collection('comments');
    await collection.updateOne(
      { comment_id: data.comment_id },
      {
        $set: {
          account_id: data.account_id,
          comment_id: data.comment_id,
          post_id: data.post_id,
          from_user_id: data.from_user_id,
          from_username: data.from_username,
          text: data.text,
          timestamp: data.timestamp,
          raw_data: data.raw_data,
          replied: false,
          created_at: new Date()
        }
      },
      { upsert: true }
    );
  },

  // Atualizar token
  async updateToken(accountId, newToken) {
    const collection = db.collection('instagram_accounts');
    await collection.updateOne(
      { _id: new ObjectId(accountId) },
      {
        $set: {
          access_token: newToken,
          token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          updated_at: new Date()
        }
      }
    );
  }
};

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
