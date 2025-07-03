import http2 from 'node:http2';
import fs from 'node:fs';

import Koa from 'koa';
import Router from '@koa/router';
import sharp from 'sharp';
import winston from 'winston';

const app = new Koa();
const router = new Router();

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format((info) => {
      info.type = info.type || 'application';
      return info;
    })(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Access logger helper
const accessLogger = {
  info: (msg, meta = {}) => logger.info(msg, { ...meta, type: 'access' }),
  warn: (msg, meta = {}) => logger.warn(msg, { ...meta, type: 'access' }),
  error: (msg, meta = {}) => logger.error(msg, { ...meta, type: 'access' })
};

const QUALITY = process.env.TARGET_QUALITY || 80;
const DEFAULT_WIDTH = process.env.TARGET_DEFAULT_WIDTH || 1280;

/**
 * Resize an image to a specified maximum width and convert it to the specified format.
 * It will not resize an image larger than its original size.
 * If the image is already in the requested format, it will not change it.
 * If the target format is 'copy', it will keep the input format.
 */
function conversionHandler(targetFormat) {
  return async function (ctx) {
    const req = ctx.req;
    const res = ctx.res;
    const width = parseInt(ctx.query.width, 10) || DEFAULT_WIDTH;
    const height = parseInt(ctx.query.height, 10) || null;
    logger.debug(`Received request to resize image to ${targetFormat} format, width: ${width}`);
    const lossless = false; // No need for lossless yet.

    let image = sharp().autoOrient();
    const stream = req.pipe(image);
    const metadata = await image.metadata();

    logger.debug(`Image info: width=${metadata.width}, height=${metadata.height}, format=${metadata.format}`);
    let needsResize = width < metadata.width || (height && height < metadata.height);
    let needsConversion = targetFormat !== 'copy' && metadata.format !== targetFormat;
    const resolvedFormat = targetFormat === 'copy' ? metadata.format : targetFormat;
    ctx.set('Content-Type', `image/${resolvedFormat}`);

    let actions = [];
    if ((metadata.orientation ?? 1) !== 1) {
      actions.push('orient');
    }
    if (needsResize) {
      image = image.resize({ width, height, fit: 'inside', withoutEnlargement: true });
      actions.push('scale:down');
    }
    if (needsConversion) {
      switch (targetFormat) {
        case 'avif':
          image = image.avif({ lossless, quality: lossless ? undefined : QUALITY });
          break;
        case 'webp':
          image = image.webp({ lossless, quality: lossless ? undefined : QUALITY });
          break;
        default:
          logger.error(`Unsupported target format: ${targetFormat}`);
          ctx.status = 500;
          ctx.body = `Unsupported target format: ${targetFormat}`;
          return;
      }
      actions.push(`convert:${targetFormat}`)
    }
    ctx.set('X-Result-Actions', actions.join(', '));

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

const server = http2.createSecureServer({
  key: fs.readFileSync('tls/key.pem'),
  cert: fs.readFileSync('tls/cert.pem')
}, app.callback());

// Handle TLS socket errors, otherwise the whole
// server can crash from a single client TLS error.
server.on('secureConnection', (tlsSocket) => {
  tlsSocket.on('error', (err) => {
    logger.warn('TLS socket error:', err.message)
  })
});

const PORT = process.env.PORT ?? 3000;
server.listen(PORT, () => {
  logger.info(`Sharp API (HTTP/2) listening on https://localhost:${PORT}`);
});
