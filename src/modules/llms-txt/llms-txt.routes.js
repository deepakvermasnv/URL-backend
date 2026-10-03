import { Router } from 'express';
import { generationRateLimiter } from '../../middleware/rate-limit.js';
import { downloadLlmsTxt, generateLlmsTxt, previewLlmsTxt } from './llms-txt.controller.js';

const router = Router();

router.post('/preview', generationRateLimiter, previewLlmsTxt);
router.post('/generate', generationRateLimiter, generateLlmsTxt);
router.post('/download', generationRateLimiter, downloadLlmsTxt);

export default router;
