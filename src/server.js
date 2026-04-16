require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const db = require('./config/database');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await db.initializeDatabase();

    // Create HTTP server and attach Socket.IO
    const httpServer = http.createServer(app);
    const io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    // Make io accessible in Express controllers via req.app.get('io')
    app.set('io', io);

    io.on('connection', (socket) => {
      console.log(`🔌 Socket connected: ${socket.id}`);

      socket.on('disconnect', () => {
        console.log(`🔌 Socket disconnected: ${socket.id}`);
      });
    });

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 API URL: http://localhost:${PORT}`);
      console.log(`🔔 Socket.IO ready for real-time notifications`);
    });
  } catch (error) {
    console.error('Failed to initialize database:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
