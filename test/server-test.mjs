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
    /*
      Read the image file into a memory buffer.
      It would be good to use a readable stream here to demonstrate the streaming,
      but that would require a client that was capable of reading the response
      stream at the same time as sending the request body, which supertest does not support.

      So we read the file into a buffer and send it in one go.
    */
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
