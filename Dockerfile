FROM node:24-alpine

WORKDIR /app

COPY ./tls/cert.pem ./tls/key.pem ./tls/
RUN chmod a+r ./tls/*.pem
COPY package*.json ./
RUN npm install --production

COPY *.mjs ./

EXPOSE 3000

CMD ["node", "server.mjs"]
