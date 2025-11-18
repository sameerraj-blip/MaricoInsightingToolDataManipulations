import { Router } from "express";
import { chatWithAI, chatWithAIStream } from "../controllers/chatController.js";

const router = Router();

// Chat endpoint
router.post('/chat', chatWithAI);

// Streaming chat endpoint (SSE)
router.post('/chat/stream', chatWithAIStream);

export default router;
