FROM node:22-alpine

# build tools for native modules (utp-native etc.)
RUN apk add --no-cache tar python3 make g++

WORKDIR /app

RUN npm install webtorrent create-torrent

COPY seed.mjs /app/seed.mjs

EXPOSE 19000 19001 19002

CMD ["node", "/app/seed.mjs"]
