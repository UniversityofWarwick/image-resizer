FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY *.mjs ./

EXPOSE 3000

# Default to the node user which exists in the base image,
# to avoid running as root.
USER node

CMD ["node", "server.mjs"]
