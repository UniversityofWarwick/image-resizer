#!/bin/bash

# Run the image you just built with build_image.sh
# --init is used to handle signals properly, as otherwise
# Ctrl+C won't stop the container.
# --rm removes the container after it stops.
docker run --init --rm -i -t -p3000:3000 image-resizer
