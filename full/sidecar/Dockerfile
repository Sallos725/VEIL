FROM node:22-alpine

WORKDIR /app/full/sidecar

COPY full/sidecar/package.json ./
COPY shared/text.js /app/shared/text.js
COPY full/sidecar/src ./src

ENV VEIL_PORT=6010
ENV VEIL_HOST=0.0.0.0
ENV VEIL_DATA_DIR=/app/data

RUN mkdir -p /app/data

EXPOSE 6010

CMD ["node", "src/server.js"]
