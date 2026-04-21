import httpServer from './app.js';
import { initDb } from './config/database.js';

const PORT = process.env.PORT || 3000;

initDb().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Database init failed:', err);
});