FROM node:22-slim
WORKDIR /app
COPY . .
ENV NODE_ENV=production PORT=3000 DB_PATH=/data/exampro.db COOKIE_SECURE=1
VOLUME /data
EXPOSE 3000
CMD ["sh","-c","node --no-warnings server/seed.js && node --no-warnings server/index.js"]
