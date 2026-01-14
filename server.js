import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './database/init.js';
import instagramRoutes from './routes/instagram.js';
import webhookRoutes from './routes/webhook.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS - Permitir requisições do frontend
const corsOptions = {
  origin: function (origin, callback) {
    console.log(`🔐 CORS request from origin: ${origin}`);
    
    const allowedOrigins = [
      process.env.APP_URL || 'http://localhost:3001',
      'https://front.clerky.com.br',
      'http://localhost:3001'
    ];
    
    // Se não houver origin (requisições do mesmo servidor) ou estiver na lista
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`❌ CORS rejected: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middlewares
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log de requisições
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Inicializar banco de dados
await initDatabase();

// Rotas
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/instagram', instagramRoutes);
app.use('/webhook', webhookRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Erro:', err);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: err.message 
  });
});

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
  console.log(`📱 App URL: ${process.env.APP_URL}`);
  console.log(`🔗 Webhook: http://localhost:${PORT}/webhook/instagram`);
});
