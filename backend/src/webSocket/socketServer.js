const { Server } = require('socket.io');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "http://localhost:5173", // Frontend URL (or * for testing)
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log('✅ User connected:', socket.id);

    // Join auction room for real-time updates
    socket.on('join_auction', (auctionId) => {
      socket.join(`auction:${auctionId}`);
      console.log(`User ${socket.id} joined auction:${auctionId}`);
    });

    // Leave auction room
    socket.on('leave_auction', (auctionId) => {
      socket.leave(`auction:${auctionId}`);
      console.log(`User ${socket.id} left auction:${auctionId}`);
    });

    socket.on('disconnect', () => {
      console.log('❌ User disconnected:', socket.id);
    });
  });

  console.log('🔌 WebSocket server initialized');
  return io;
};

// Emit new bid to all users watching an auction
const emitNewBid = (auctionId, bidData) => {
  if (io) {
    io.to(`auction:${auctionId}`).emit('new_bid', bidData);
    console.log(`📢 Emitted new_bid to auction:${auctionId}`);
  }
};

// Emit auction status change
const emitAuctionUpdate = (auctionId, data) => {
  if (io) {
    io.to(`auction:${auctionId}`).emit('auction_update', data);
  }
};

module.exports = { initSocket, emitNewBid, emitAuctionUpdate };