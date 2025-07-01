import express from 'express';
import sharp from 'sharp';
import winston from'winston';

const app = express();

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

const QUALITY = process.env.TARGET_QUALITY || 80;
const DEFAULT_WIDTH = process.env.TARGET_DEFAULT_WIDTH || 1280;

/**
 * Resize an image to a specified maximum width and convert it to the specified format.
 * It will not resize an image larger than its original size.
 * If the image is already in the requested format, it will not change it.
 * If the target format is 'copy', it will keep the input format.
 */
function conversionHandler(targetFormat) {
  return async function (req, res) {
    const width = parseInt(req.query.width, 10) || DEFAULT_WIDTH;
    logger.debug(`Received request to resize image to ${targetFormat} format, width: ${width}`);
    const lossless = false; // No need for lossless yet.

    let image = sharp().autoOrient();
    const stream = req.pipe(image);
    const metadata = await image.metadata();

    logger.debug(`Image info: width=${metadata.width}, height=${metadata.height}, format=${metadata.format}`);
    let needsResize = width < metadata.width;
    let needsConversion = targetFormat !== 'copy' && metadata.format !== targetFormat;
    const resolvedFormat = targetFormat === 'copy' ? metadata.format : targetFormat;
    res.set('Content-Type', `image/${resolvedFormat}`);

    let actions = [];
    if ((metadata.orientation ?? 1) !== 1) {
      // We set autoOrient which will apply the orientation automatically,
      // but we still want to log it as an action.
      actions.push('orient');
    }
    if (needsResize) {
      image = image.resize({ width });
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
          res.status(500).end(`Unsupported target format: ${targetFormat}`);
          return;
      }
      actions.push(`convert:${targetFormat}`)
    }
    res.set('X-Result-Actions', actions.join(', '));

    stream
      .on('error', err => {
        logger.error('Processing error:', err);
        res.status(500).end('Image processing failed');
      })
      .on('end', () => {
        logger.debug('Complete');
      })
      .pipe(res);
  }
}

app.post('/resize/webp', conversionHandler('webp'));
app.post('/resize/avif', conversionHandler('avif'));
app.post('/resize', conversionHandler('copy'));

app.get('/', (_, res) => {
  res.send([
    'POST to /resize/[webp|avif] to convert to WebP or AVIF.',
    'POST to /resize to resize keeping the original format.',
    'Query parameter "width" can be used to specify the maximum width.',
    'Any EXIF transformations will be baked in to the output.'
  ].join('\n'));
});

app.listen(3000, () => logger.debug('Sharp API listening on port 3000'));
