import jwt from 'jsonwebtoken';
import { getDb, saveDb } from '../config/database.js';

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

      const db = getDb();
      db.run(
        'INSERT INTO messages (room_id, user_id, content, status) VALUES (?, ?, ?, ?)',
        [roomId, socket.user.id, content, 'sent']
      );
      
      const result = db.exec('SELECT last_insert_rowid() as id');
      const messageId = result[0].values[0][0];
      
      saveDb();

      const message = {
        id: messageId,
        room_id: roomId,
        user_id: socket.user.id,
        username: socket.user.username,
        content,
        status: 'sent',
        created_at: new Date().toISOString()
      };

      io.to(`room_${roomId}`).emit('message:new', message);
    });

    socket.on('message:delivered', (data) => {
      const { messageId, roomId } = data;
      const db = getDb();
      db.run('UPDATE messages SET status = ? WHERE id = ?', ['delivered', messageId]);
      saveDb();
      io.to(`room_${roomId}`).emit('message:status', { messageId, status: 'delivered' });
    });

    socket.on('message:read', (data) => {
      const { roomId } = data;
      const db = getDb();
      
      db.run(
        `UPDATE messages SET status = 'read' WHERE room_id = ? AND user_id != ? AND status != 'read'`,
        [roomId, socket.user.id]
      );
      saveDb();
      
      const result = db.exec(
        `SELECT id FROM messages WHERE room_id = ? AND user_id != ? AND status = 'read'`,
        [roomId, socket.user.id]
      );
      
      if (result.length > 0) {
        result[0].values.forEach(row => {
          io.to(`room_${roomId}`).emit('message:status', { messageId: row[0], status: 'read' });
        });
      }
    });

    socket.on('disconnect', () => {
      onlineUsers.delete(socket.user.id);
      io.emit('users:online', Array.from(onlineUsers.values()).map(u => u.username));
    });
  });
};