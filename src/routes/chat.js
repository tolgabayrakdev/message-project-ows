import { getRooms, createRoom, getMessages } from '../controllers/chatController.js';
import { verifyToken } from '../middlewares/auth.js';
import { Router } from 'express';

const router = Router();

router.get('/rooms', verifyToken, getRooms);
router.post('/rooms', verifyToken, createRoom);
router.get('/rooms/:roomId/messages', verifyToken, getMessages);

export default router;