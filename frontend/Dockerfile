FROM node:22.20.0-bookworm-slim AS construcao
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM nginx:1.28.0-alpine
COPY deploy/nginx/seguranca.conf /etc/nginx/snippets/seguranca.conf
COPY deploy/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=construcao /app/dist /usr/share/nginx/html
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1/saude"]
