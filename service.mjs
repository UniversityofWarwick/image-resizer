import sharp from 'sharp';
import { Stream } from 'stream';
import logger from './logging.mjs';

const QUALITY = process.env.TARGET_QUALITY || 80;

/**
 * Takes a readable stream of image data and returns a stream of the transformed image
 * along with metadata about the transformation.
 *
 * @param {Stream} stream The input image stream.
 * @param {{ width: number, height: number, targetFormat: string, lossless?: boolean }} options
 * @returns {Promise<{ contentType: string, actions: string[], stream: Stream }>}
 * @throws {Error} If the target format is unsupported.
 */
export async function resize(stream, options) {
  const { width, height, targetFormat, lossless } = options;

  // "animated" will read all frames so that GIF files are encoded to animated output
  // (where supported, which it is in WebP). For other inputs that are only a single image,
  // it has no effect.
  let image = sharp({ animated: true }).autoOrient();
  const output = stream.pipe(image);
  const metadata = await image.metadata();

  // If the lossless option is not set, run some heuristics
  const calculatedLossless = (lossless !== undefined) ? lossless : !(await isLossyPreferred(image));

  logger.debug(`Image info: width=${metadata.width}, height=${metadata.height}, format=${metadata.format}`);
  let needsResize = (width && width < metadata.width) || (height && height < metadata.height);
  let needsConversion = targetFormat !== 'copy' && metadata.format !== targetFormat;
  const resolvedFormat = targetFormat === 'copy' ? metadata.format : targetFormat;

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
        throw new Error(`Unsupported target format: ${targetFormat}`);
    }
    actions.push(`convert:${targetFormat}`)
  }

  return {
    contentType: `image/${resolvedFormat}`,
    actions,
    lossless: calculatedLossless,
    stream: output,
  };
}

async function isLossyPreferred(sharpInstance) {
  const results = await analyzeImage(sharpInstance);
  return results.lossyPreferred;
}

/**
 * Runs some heuristics on an image to determine if it would be best converted
 * to a lossy format. This is useful for processing photos that have been saved
 * as PNG or other lossless formats, while keeping detail on PNGs that are likely
 * graphics or screenshots.
 *
 * @param {sharp.Sharp} sharpInstance An instance of a sharp image.
 * @returns {Promise<{lossyPreferred: boolean, stats: {isOpaque: boolean, entropy: number, standardDeviation: number}} | {lossyPreferred: boolean, stats: {error: string}}>}
 */
export async function analyzeImage(sharpInstance) {
  // Thresholds can be adjusted based on your specific image set
  const PHOTO_STD_DEV_THRESHOLD = 28;
  const PHOTO_ENTROPY_THRESHOLD = 6;

  try {
    const metadata = await sharpInstance.metadata(); // Ensure metadata is loaded

    // If an image is already lossy (JPEG or lossy WebP), we won't get anything out of
    // converting it to lossless, so will recommend lossy output.
    const alreadyLossy = metadata.format == 'jpeg' || (metadata.format == 'webp' && metadata.lossless === false);

    const { isOpaque, entropy, channels } = await sharpInstance.stats();
    const standardDeviation = channels[0].stdev;

    // Determine if the image is a photograph
    const lossyPreferred = alreadyLossy || (isOpaque && entropy > PHOTO_ENTROPY_THRESHOLD);

    return {
      lossyPreferred,
      stats: {
        isOpaque,
        entropy,
        standardDeviation,
      },
    };

  } catch (error) {
    console.error('Failed to analyze image stats:', error);
    return {
      lossyPreferred: true, // Default to true on error
      stats: {
        error: error.message
      },
    };
  }
}
