## Image resizer service

[Sharp](https://sharp.pixelplumbing.com/) is a high performance Node.js library for image manipulation. This wraps it in an Express app to perform some common operations such as resizing images and converting them to better formats.

Operations are streamed directly from request to response so memory usage should be very low even for large files.

It is built into a Docker image, `universityofwarwick/image-resizer`, which exposes a simple API on port 3000 (http/2).
No volumes are required as it is completely stateless,
converting in memory and returning the result each time.
If you want to add caching, that's best implemented by
a different service.

Note that this is an http/2 only server in order to take advantage of multiplexing. In turn it requires TLS, but for our current use case (where this connects to localhost) it doesn't need to be a verified certificate and uses a self-signed certificate which is embedded in this project (don't worry, these aren't leaked credentials). Although it's about as secure as plaintext, rather than force clients to ignore all hosts, you can use certificate pinning and the following pin:

```
sha256/qMaXKACMvhEOTCD+O/plMbVthCv7gbOX42oED2te13Y=
```

At some point we may allow for the certificate to be configurable, in case you do need meaningful encryption.

## Quick Start

Have Docker.

```
./build_image.sh
./run_image.sh
```

## API

Resize image to maximum width of 512 pixels,
keeping original format. The request body should
be the image data.

```http
POST /resize?width=512
Content-type: image/png

...image data
```

As above but converts to WebP.
```http
POST /resize/webp?width=512
```
And this converts to AVIF

```http
POST /resize/webp?width=512
```

Example curl command to resize locally:

```bash
curl -XPOST \
 --data-binary @big_image.png \
 -k --pinnedpubkey "sha256//qMaXKACMvhEOTCD+O/plMbVthCv7gbOX42oED2te13Y=" \
 https://localhost:3000/resize/webp?width=800 \
 --output small.webp
```

The response body will be the converted image, along with some possible headers, which might help you handle the result appropriately:

* `Content-Type` of course reflects the new image type
* `X-Result-Actions` lists the changes it has made, which may be one of:
  * `orient` if EXIF was present and not 1
  * `scale:down` if it is resizing down (we never scale up currently)
  * `convert:webp` or `convert:avif` if the format is changing to one of these formats

