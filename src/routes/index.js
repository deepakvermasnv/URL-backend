import { Router } from 'express';
import llmsTxtRoutes from '../modules/llms-txt/llms-txt.routes.js';
import { env } from '../config/env.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      service: 'urltrim-shared-backend',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    },
  });
});

router.use('/llms-txt', llmsTxtRoutes);

export default router;
