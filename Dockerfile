FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY *.mjs ./

EXPOSE 3000

CMD ["node", "server.mjs"]
