import jwt from 'jsonwebtoken';
import db from '../config/database.js';

const JWT_SECRET = 'chat-secret-key-2024';
const onlineUsers = new Map();

export const initializeSocket = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Token yok'));

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error('Geçersiz token'));
      socket.user = decoded;
      next();
    });
  });

  io.on('connection', (socket) => {
    onlineUsers.set(socket.user.id, { username: socket.user.username, socketId: socket.id });
    io.emit('users:online', Array.from(onlineUsers.values()).map(u => u.username));

    socket.on('join:room', (roomId) => {
      socket.join(`room_${roomId}`);
    });

    socket.on('message:send', (data) => {
      const { roomId, content } = data;
      if (!roomId || !content) return;

      db.run(
        'INSERT INTO messages (room_id, user_id, content) VALUES (?, ?, ?)',
        [roomId, socket.user.id, content],
        function (err) {
          if (err) return;

          const message = {
            id: this.lastID,
            room_id: roomId,
            user_id: socket.user.id,
            username: socket.user.username,
            content,
            created_at: new Date().toISOString()
          };

          io.to(`room_${roomId}`).emit('message:new', message);
        }
      );
    });

    socket.on('message:delivered', (data) => {
      const { messageId, roomId } = data;
      db.run('UPDATE messages SET status = ? WHERE id = ?', ['delivered', messageId]);
      io.to(`room_${roomId}`).emit('message:status', { messageId, status: 'delivered' });
    });

    socket.on('message:read', (data) => {
      const { roomId } = data;
      db.all('SELECT id, user_id FROM messages WHERE room_id = ? AND user_id != ? AND status != ?', 
        [roomId, socket.user.id, 'read'], 
        (err, messages) => {
          if (messages) {
            messages.forEach(msg => {
              db.run('UPDATE messages SET status = ? WHERE id = ?', ['read', msg.id]);
              io.to(`room_${roomId}`).emit('message:status', { messageId: msg.id, status: 'read' });
            });
          }
        }
      );
    });

    socket.on('disconnect', () => {
      onlineUsers.delete(socket.user.id);
      io.emit('users:online', Array.from(onlineUsers.values()).map(u => u.username));
    });
  });
};
