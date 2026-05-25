FROM node:22-alpine

WORKDIR /app/full/sidecar

COPY full/sidecar/package.json ./
COPY shared /app/shared
COPY full/sidecar/src ./src

ENV VEIL_PORT=6010
ENV VEIL_HOST=0.0.0.0
ENV VEIL_DATA_DIR=/app/data

RUN mkdir -p /app/data

EXPOSE 6010

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:6010/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
