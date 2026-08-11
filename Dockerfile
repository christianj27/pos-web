# ============================================================
# POS Web (React) — Multi-stage Dockerfile
#
# PLACE: POS/Project/Frontend/pos-web/Dockerfile
# (part of your local structure: Frontend/pos-web/)
#
# Stage 1: build the React app with Node
# Stage 2: serve static files with nginx + proxy /api → pos-api
# ============================================================

# ---------- STAGE 1: BUILD THE REACT APP ----------
FROM node:22-alpine AS build
WORKDIR /app

# Copy package files first → layer caching for npm install
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Copy source and build
COPY . .
# ✅ Production settings — forced HERE, never trusted from local .env:
#   - VITE_API_BASE_URL=/api → nginx proxies /api to the API container
#   - VITE_USE_MOCK=false    → real API mode (local .env may have mock=true!)
# Vite bakes these INTO the bundle at build time — runtime env can't override.
ENV VITE_API_BASE_URL=
ENV VITE_USE_MOCK=false
RUN npm run build

# ---------- STAGE 2: NGINX RUNTIME ----------
FROM nginx:1.27-alpine AS runtime

# Copy the built static files
COPY --from=build /app/dist /usr/share/nginx/html

# Custom nginx config: serve SPA + proxy /api to the API container
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
