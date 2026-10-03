import { z } from 'zod';
import { HttpError } from '../../utils/http-error.js';
import { parseLlmsTxtRequest } from './llms-txt.validator.js';
import { runLlmsTxtJob } from './llms-txt.service.js';

/**
 * @param {unknown} body
 */
function parseBody(body) {
  try {
    return parseLlmsTxtRequest(body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid request body.', {
        issues: err.errors,
      });
    }
    throw err;
  }
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function previewLlmsTxt(req, res, next) {
  try {
    const input = parseBody(req.body);
    const data = await runLlmsTxtJob(input, { preview: true });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function generateLlmsTxt(req, res, next) {
  try {
    const input = parseBody(req.body);
    const data = await runLlmsTxtJob(input, { preview: false });
    console.log(
      JSON.stringify({
        event: 'llms_txt_generate',
        origin: data.website?.origin,
        discovered: data.stats?.discovered,
        processed: data.stats?.processed,
        failed: data.stats?.failed,
      }),
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function downloadLlmsTxt(req, res, next) {
  try {
    const input = parseBody(req.body);
    const data = await runLlmsTxtJob(input, { preview: false });
    const filename = data.filename || 'llms.txt';
    const safeName = filename.replace(/[^\w.-]/g, '_');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.send(data.content);
  } catch (err) {
    next(err);
  }
}
