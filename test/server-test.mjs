import { expect } from 'chai';
import request from 'supertest';
import { app } from '../server.mjs';
import fs from 'fs/promises';

describe('Resizing API', function() {

  it('should respond to GET / with 200', async function() {
    const response = await request(app.callback()).get('/');
    expect(response.status).to.equal(200);
  });

  it('should reject GET to /resize/webp', async function() {
    await request(app.callback())
      .get('/resize/webp')
      .expect(405); // Method Not Allowed
  });

  it('should reject empty POST to /resize/webp', async function() {
    await request(app.callback())
      .post('/resize/webp')
      .expect(500);
  });

  it('should resize an image to WebP format', async function() {
    const imageBuffer = await fs.readFile('./test/images/goose (lossy).png');
    await request(app.callback())
      .post('/resize/webp')
      .query({ width: 200 })
      .send(imageBuffer)
      .expect('Content-Type', /image\/webp/)
      .expect('X-Result-Actions', 'scale:down, convert:webp')
      .expect(200);
  });

});
