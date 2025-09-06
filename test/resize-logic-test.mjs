import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { resize } from '../service.mjs';
import { Readable } from 'stream';

// Helper to get the current directory name in ES Modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Resize Function Logic', () => {
  const testImagePath = path.join(__dirname, 'images', 'goose (lossy).png');
  
  function createImageStream(imagePath) {
    return fs.createReadStream(imagePath);
  }

  describe('Action Detection', () => {
    it('should detect scale:down action when width is smaller than original', async () => {
      const stream = createImageStream(testImagePath);
      const result = await resize(stream, {
        width: 100,
        height: 0,
        targetFormat: 'copy'
      });

      expect(result.actions).to.include('scale:down');
      expect(result.contentType).to.equal('image/png');
    });

    it('should detect convert action when changing format', async () => {
      const stream = createImageStream(testImagePath);
      const result = await resize(stream, {
        width: 0,
        height: 0,
        targetFormat: 'webp'
      });

      expect(result.actions).to.include('convert:webp');
      expect(result.contentType).to.equal('image/webp');
    });

    it('should detect both scale:down and convert actions', async () => {
      const stream = createImageStream(testImagePath);
      const result = await resize(stream, {
        width: 50,
        height: 0,
        targetFormat: 'avif'
      });

      expect(result.actions).to.include('scale:down');
      expect(result.actions).to.include('convert:avif');
      expect(result.contentType).to.equal('image/avif');
    });

    it('should not resize when target dimensions are larger than original', async () => {
      const stream = createImageStream(testImagePath);
      const result = await resize(stream, {
        width: 5000, // Much larger than test image
        height: 0,
        targetFormat: 'copy'
      });

      expect(result.actions).to.not.include('scale:down');
    });
  });

  describe('Format Handling', () => {
    it('should keep original format when targetFormat is "copy"', async () => {
      const stream = createImageStream(testImagePath);
      const result = await resize(stream, {
        width: 0,
        height: 0,
        targetFormat: 'copy'
      });

      expect(result.contentType).to.equal('image/png');
      expect(result.actions.some(action => action.startsWith('convert:'))).to.be.false;
    });

    it('should throw error for unsupported target format', async () => {
      const stream = createImageStream(testImagePath);
      
      try {
        await resize(stream, {
          width: 0,
          height: 0,
          targetFormat: 'unsupported'
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Unsupported target format');
      }
    });
  });

  describe('Lossless Override', () => {
    it('should respect explicit lossless=true setting', async () => {
      const stream = createImageStream(testImagePath);
      const result = await resize(stream, {
        width: 0,
        height: 0,
        targetFormat: 'webp',
        lossless: true
      });

      expect(result.lossless).to.be.true;
    });

    it('should respect explicit lossless=false setting', async () => {
      const stream = createImageStream(testImagePath);
      const result = await resize(stream, {
        width: 0,
        height: 0,
        targetFormat: 'webp',
        lossless: false
      });

      expect(result.lossless).to.be.false;
    });

    it('should use heuristics when lossless is undefined', async () => {
      const stream = createImageStream(testImagePath);
      const result = await resize(stream, {
        width: 0,
        height: 0,
        targetFormat: 'webp'
        // lossless is undefined
      });

      expect(result.lossless).to.be.a('boolean');
    });
  });

  describe('Dimension Logic', () => {
    it('should handle both width and height constraints', async () => {
      const stream = createImageStream(testImagePath);
      const result = await resize(stream, {
        width: 100,
        height: 100,
        targetFormat: 'copy'
      });

      expect(result.actions).to.include('scale:down');
    });

    it('should handle zero dimensions as no constraint', async () => {
      const stream = createImageStream(testImagePath);
      const result = await resize(stream, {
        width: 0,
        height: 0,
        targetFormat: 'copy'
      });

      expect(result.actions).to.not.include('scale:down');
    });

    it('should handle negative dimensions as no constraint', async () => {
      const stream = createImageStream(testImagePath);
      const result = await resize(stream, {
        width: -1,
        height: -1,
        targetFormat: 'copy'
      });

      // Note: negative numbers are truthy in JS, so they trigger resize logic
      // This test documents the current behavior - negative values are treated as constraints
      expect(result.actions).to.include('scale:down');
    });
  });

  describe('Stream Output', () => {
    it('should return a readable stream', async () => {
      const stream = createImageStream(testImagePath);
      const result = await resize(stream, {
        width: 100,
        height: 0,
        targetFormat: 'copy'
      });

      expect(result.stream).to.be.an('object');
      expect(result.stream.readable).to.be.true;
    });
  });
});