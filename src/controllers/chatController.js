import db from '../config/database.js';

export const getRooms = (req, res) => {
  db.all('SELECT * FROM rooms ORDER BY id', [], (err, rooms) => {
    if (err) return res.status(500).json({ error: 'Sunucu hatası' });
    res.json(rooms);
  });
};

export const createRoom = (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Oda adı girin' });

  db.run('INSERT INTO rooms (name) VALUES (?)', [name], function (err) {
    if (err) return res.status(500).json({ error: 'Oda oluşturulamadı' });
    res.json({ id: this.lastID, name });
  });
};

export const getMessages = (req, res) => {
  const { roomId } = req.params;
  const limit = 100;

  db.all(
    `SELECT m.id, m.content, m.created_at, u.username
     FROM messages m
     JOIN users u ON m.user_id = u.id
     WHERE m.room_id = ?
     ORDER BY m.created_at ASC
     LIMIT ?`,
    [roomId, limit],
    (err, messages) => {
      if (err) return res.status(500).json({ error: 'Sunucu hatası' });
      res.json(messages);
    }
  );
};

export const getOnlineUsers = (req, res) => {
  res.json({ users: [] });
};