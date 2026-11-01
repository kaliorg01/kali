FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV PORT=3333
ENV HOST=0.0.0.0
ENV NODE_ENV=production

EXPOSE 3333

VOLUME ["/app/dados"]

CMD ["node", "server.js"]
