import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb, saveDb } from '../config/database.js';

const JWT_SECRET = 'chat-secret-key-2024';

export const register = (req, res) => {
  const { username, phone, password } = req.body;
  const db = getDb();

  if (!username || !phone || !password) {
    return res.status(400).json({ error: 'Tüm alanları doldurun' });
  }

  const hashedPassword = bcrypt.hashSync(password, 8);

  try {
    db.run('INSERT INTO users (username, phone, password) VALUES (?, ?, ?)', [username, phone, hashedPassword]);
    const result = db.exec('SELECT last_insert_rowid() as id');
    const userId = result[0].values[0][0];
    
    saveDb();
    
    const token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: userId, username, phone } });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Kullanıcı adı veya telefon zaten kayıtlı' });
    }
    res.status(500).json({ error: 'Kayıt hatası' });
  }
};

export const login = (req, res) => {
  const { phone, password } = req.body;
  const db = getDb();

  if (!phone || !password) {
    return res.status(400).json({ error: 'Telefon ve şifre girin' });
  }

  try {
    const result = db.exec('SELECT * FROM users WHERE phone = ?', [phone]);
    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
    }

    const user = {
      id: result[0].values[0][0],
      username: result[0].values[0][1],
      phone: result[0].values[0][2],
      password: result[0].values[0][3]
    };

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Şifre yanlış' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user.id, username: user.username, phone: user.phone } });
  } catch (err) {
    res.status(500).json({ error: 'Giriş hatası' });
  }
};

export const verify = (req, res) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token yok' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Geçersiz token' });
    }

    const db = getDb();
    try {
      const result = db.exec('SELECT id, username, phone FROM users WHERE id = ?', [decoded.id]);
      if (result.length === 0 || result[0].values.length === 0) {
        return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
      }

      const user = {
        id: result[0].values[0][0],
        username: result[0].values[0][1],
        phone: result[0].values[0][2]
      };
      res.json({ user });
    } catch (err) {
      res.status(500).json({ error: 'Sunucu hatası' });
    }
  });
};