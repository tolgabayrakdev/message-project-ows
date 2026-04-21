import { getDb, saveDb } from '../config/database.js';

export const getRooms = (req, res) => {
  const db = getDb();
  const result = db.exec('SELECT * FROM rooms ORDER BY id');
  
  if (result.length === 0) {
    return res.json([]);
  }
  
  const rooms = result[0].values.map(row => ({
    id: row[0],
    name: row[1],
    created_at: row[2]
  }));
  
  res.json(rooms);
};

export const createRoom = (req, res) => {
  const { name } = req.body;
  const db = getDb();
  
  if (!name) return res.status(400).json({ error: 'Oda adı girin' });

  try {
    db.run('INSERT INTO rooms (name) VALUES (?)', [name]);
    const result = db.exec('SELECT last_insert_rowid() as id');
    const roomId = result[0].values[0][0];
    
    saveDb();
    res.json({ id: roomId, name });
  } catch (err) {
    res.status(500).json({ error: 'Oda oluşturulamadı' });
  }
};

export const getMessages = (req, res) => {
  const { roomId } = req.params;
  const db = getDb();
  const limit = 100;

  try {
    const result = db.exec(
      `SELECT m.id, m.content, m.status, m.created_at, u.username
       FROM messages m
       JOIN users u ON m.user_id = u.id
       WHERE m.room_id = ?
       ORDER BY m.created_at ASC
       LIMIT ?`,
      [roomId, limit]
    );
    
    if (result.length === 0) {
      return res.json([]);
    }
    
    const messages = result[0].values.map(row => ({
      id: row[0],
      content: row[1],
      status: row[2],
      created_at: row[3],
      username: row[4]
    }));
    
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
};