import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { analyzeImage } from '../service.mjs';

// Helper to get the current directory name in ES Modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define the directory containing test images
const testImagesDir = path.join(__dirname, 'images');

describe('Image Type Detection: analyzeImage()', () => {
  const imageFiles = fs.readdirSync(testImagesDir);

  imageFiles.forEach(file => {
    // Skip non-test files like .DS_Store
    if (file.startsWith('.')) return;

    const filePath = path.join(testImagesDir, file);
    let expectedLossy;

    if (file.includes('(lossy)')) {
      expectedLossy = true;
    } else if (file.includes('(lossless)')) {
      expectedLossy = false;
    } else {
      return; // Skip files not labeled for testing
    }

    const testTitle = `should correctly recommend "${file}" for ${expectedLossy ? 'lossy' : 'lossless'} compression`;

    it(testTitle, async () => {
      // Get the rich result object from our updated function
      const result = await analyzeImage(sharp(filePath));
      const { lossyPreferred, stats } = result;

      // Create a detailed message that will ONLY be shown on failure
      const statsString = `(Stats: stdev=${stats.standardDeviation?.toFixed(2)}, entropy=${stats.entropy?.toFixed(2)}, opaque=${stats.isOpaque})`;
      const failureMessage = `Assertion failed for ${file}. ${statsString}`;

      console.info(`Analyzing ${file}: ${statsString}`);

      // Assert against the 'lossyPreferred' property and provide the failure message
      expect(lossyPreferred, failureMessage).to.equal(expectedLossy);
    });
  });
});
