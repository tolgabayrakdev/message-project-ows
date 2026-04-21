import jwt from 'jsonwebtoken';

const JWT_SECRET = 'chat-secret-key-2024';

export const verifyToken = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Giriş yapmalısınız' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Oturum süresi dolmuş' });
    }
    req.user = decoded;
    next();
  });
};
