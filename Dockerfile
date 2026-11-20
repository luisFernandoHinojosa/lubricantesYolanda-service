# --- Etapa 1: dependencias de producción ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# --- Etapa 2: imagen final ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    TZ=America/La_Paz

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

# No correr como root
USER node

EXPOSE 3005

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3005/api/v1/health || exit 1

# node directo (no npm) para que SIGTERM llegue al proceso y el cierre sea ordenado
CMD ["node", "src/server.js"]
