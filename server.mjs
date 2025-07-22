import fs from 'node:fs';

import Koa from 'koa';
import Router from '@koa/router';
import sharp from 'sharp';
import logger from './logging.mjs';

import * as service from './service.mjs';

const app = new Koa();
const router = new Router();

const DEFAULT_WIDTH = process.env.TARGET_DEFAULT_WIDTH || 1280;

// Access logger helper
const accessLogger = {
  info: (msg, meta = {}) => logger.info(msg, { ...meta, type: 'access' }),
  warn: (msg, meta = {}) => logger.warn(msg, { ...meta, type: 'access' }),
  error: (msg, meta = {}) => logger.error(msg, { ...meta, type: 'access' })
};

function parseBoolean(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  return Boolean(value);
}

/**
 * Resize an image to a specified maximum width and convert it to the specified format.
 * It will not resize an image larger than its original size.
 * If the image is already in the requested format, it will not change it.
 * If the target format is 'copy', it will keep the input format.
 */
function conversionHandler(targetFormat) {
  /**
   * @param {Koa.Context} ctx The Koa context object.
   */
  return async function (ctx) {
    const req = ctx.req;
    const res = ctx.res;
    const width = parseInt(ctx.query.width, 10) || DEFAULT_WIDTH;
    const height = parseInt(ctx.query.height, 10) || null;
    const lossless = parseBoolean(ctx.query.lossless); // can be undefined
    logger.debug(`Received request to resize image to ${targetFormat} format, width: ${width}`);

    const { contentType, actions, stream, lossless: outputLossless } = await service.resize(req, {
      width, height, targetFormat, lossless
    });
    ctx.set('Content-Type', contentType);
    ctx.set('X-Result-Actions', actions.join(', '));
    ctx.set('X-Result-Lossless', outputLossless);
    ctx.body = stream
      .on('error', err => {
        logger.error('Processing error:', err);
        ctx.status = 500;
        ctx.body = 'Image processing failed';
      })
      .on('end', () => {
        logger.debug('Complete');
      });

  }
}

router.post('/resize/webp', conversionHandler('webp'));
router.post('/resize/avif', conversionHandler('avif'));
router.post('/resize', conversionHandler('copy'));

router.post('/metadata', async (ctx) => {
  const req = ctx.req;
  const res = ctx.res;
  const includeStats = ctx.query.stats === 'true';
  // read request body as a stream and pipe it to sharp
  const image = sharp().autoOrient();
  const stream = req.pipe(image);
  try {
    const metadata = await image.metadata();
    const stats = includeStats ? image.stats() : null;
    ctx.body = {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      orientation: metadata.orientation,
      hasAlpha: metadata.hasAlpha
    };
    if (includeStats) {
      ctx.body.stats = await stats;
    }
    ctx.set('Content-Type', 'application/json');
  }
  catch (err) {
    logger.error('Metadata extraction error:', err);
    ctx.status = 500;
    ctx.body = 'Failed to extract metadata';
  }
});

router.get('/', (ctx) => {
  ctx.body = [
    'POST to /resize/[webp|avif] to convert to WebP or AVIF.',
    'POST to /resize to resize keeping the original format.',
    'Query parameter "width" can be used to specify the maximum width.',
    'Any EXIF transformations will be baked in to the output.'
  ].join('\n');
});

// Access logging middleware
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  accessLogger.info(ctx.url, {
    method: ctx.method,
    status: ctx.status,
    duration_ms: ms,
    ip: ctx.ip
  });
});

app
  .use(router.routes())
  .use(router.allowedMethods());

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  logger.info(`Sharp API listening on http://localhost:${PORT}`);
});
