#!/bin/bash

# Run the image you just built with build_image.sh
# --init is used to handle signals properly, as otherwise
# Ctrl+C won't stop the container.
# --rm removes the container after it stops.
# We pass the current user ID to the container
# to minimise things running as root.
docker run --user "$UID" --init --rm -i -t -p3000:3000 image-resizer
