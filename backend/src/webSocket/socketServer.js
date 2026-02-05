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

    // Join user's personal room (for balance updates)
    socket.on('join_user', (userId) => {
      socket.join(`user:${userId}`);
      console.log(`User ${socket.id} joined user room:${userId}`);
    });

    // Leave user room
    socket.on('leave_user', (userId) => {
      socket.leave(`user:${userId}`);
    });

    socket.on('join_admin_room', () => {
      socket.join('admin_room')
      console.log('admin join room');
    })

    socket.on('leave_admin_room', () => {
      socket.leave('admin_room')
      console.log('admin leave room');
    })

    socket.on('disconnect', () => {
      console.log('❌ User disconnected:', socket.id);
    });
  });

  console.log('🔌 WebSocket server initialized');
  return io;
};

// Emit new bid to all users watching an auction
const emitNewBid = (bidData) => {
  if (io) {
    io.emit('new_bid', bidData);
    console.log(`📢 Emitted new_bid to auction:${bidData.auction_id}`);
  }
};

// Emit auction status change
const emitAuctionUpdate = (data) => {
  if (io) {
    io.emit('auction_update', data);
    console.log(`📢 Emitted updated auction:${data.id}`);
  }
};

const emitBalanceUpdate = (userId, newBalance) => {
  if (io) {
    // Private update to the user
    io.to(`user:${userId}`).emit('balance_update', { balance: newBalance });

    // Broadcast to admins
    io.to('admin_room').emit('admin_balance_update', { userId, balance: newBalance });
    console.log(`💰 Emitted balance update for user:${userId} (Visible to Admin)`);
  }
};

const emitAuctionReset = (data) => {
  if (io) {
    io.emit('auction_reset', data);
    console.log(`🔄 Emitted auction_reset to auction:${data.id}`);
  }
};

// Add these functions to your exports
const emitNewUser = (userData) => {
  if (io) {
    io.to('admin_room').emit('new_user', userData); // Broadcast to everyone (or use 'admin_room' if preferred)
    console.log(`📢 Emitted new_user: ${userData.username}`);
  }
};

const emitNewAuction = (auctionData) => {
  if (io) {
    io.emit('new_auction', auctionData);
    console.log(`📢 Emitted new_auction: ${auctionData.id}`);
  }
};

// Don't forget to export them!
module.exports = {
  initSocket,
  emitNewBid,
  emitAuctionUpdate,
  emitBalanceUpdate,
  emitAuctionReset,
  emitNewUser,
  emitNewAuction
};