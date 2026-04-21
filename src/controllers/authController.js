import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/database.js';

const JWT_SECRET = 'chat-secret-key-2024';

export const register = (req, res) => {
  const { username, phone, password } = req.body;

  if (!username || !phone || !password) {
    return res.status(400).json({ error: 'Tüm alanları doldurun' });
  }

  const hashedPassword = bcrypt.hashSync(password, 8);

  db.run(
    'INSERT INTO users (username, phone, password) VALUES (?, ?, ?)',
    [username, phone, hashedPassword],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Kullanıcı adı veya telefon zaten kayıtlı' });
        }
        return res.status(500).json({ error: 'Kayıt hatası' });
      }

      const token = jwt.sign({ id: this.lastID, username }, JWT_SECRET, { expiresIn: '1h' });
      res.json({ token, user: { id: this.lastID, username, phone } });
    }
  );
};

export const login = (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ error: 'Telefon ve şifre girin' });
  }

  db.get('SELECT * FROM users WHERE phone = ?', [phone], (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Şifre yanlış' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user.id, username: user.username, phone: user.phone } });
  });
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

    db.get('SELECT id, username, phone FROM users WHERE id = ?', [decoded.id], (err, user) => {
      if (err || !user) {
        return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
      }
      res.json({ user });
    });
  });
};
