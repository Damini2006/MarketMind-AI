# Stage 1: build the static assets
FROM node:20-alpine AS build

WORKDIR /app

# `npm ci` rather than `npm install`: it installs exactly package-lock.json, so
# the image is reproducible and a lock-file drift fails loudly instead of
# silently resolving newer versions. This also matches what CI runs.
COPY package*.json ./
RUN npm ci

COPY . .

# The SPA is served same-origin by nginx, which proxies /api and /ws to the
# backend (see nginx.conf). Nothing here is a secret: it is all compiled into
# the public bundle.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# Stage 2: serve with nginx
FROM nginx:alpine

# Only the built assets and the server config cross the stage boundary — the
# whole node toolchain, node_modules and the build context stay behind.
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Security headers live in their own file because nginx does not merge
# `add_header` across levels: the server block and the cached-asset location
# both `include` it. Copied to /etc/nginx/ (not conf.d/) so it is a snippet,
# not a server config nginx would load globally.
COPY security-headers.conf /etc/nginx/security-headers.conf

# NOTE: this stage intentionally keeps nginx's default master-as-root so it can
# bind :80 and write its pid/cache. Worker processes still run as the
# unprivileged `nginx` user. To run fully unprivileged, switch to
# `nginxinc/nginx-unprivileged`, which listens on :8080 — that changes the
# published port mapping in docker-compose.yml, so it is left as a deliberate
# deployment choice rather than a silent edit here.
EXPOSE 80

# Overrides the base image's healthcheck, which probes a file this image does
# not serve. busybox wget ships with nginx:alpine. Use 127.0.0.1, not
# `localhost`: nginx listens on IPv4 only ("listen 80" -> 0.0.0.0) while
# busybox resolves localhost to ::1 first, so `localhost` gets connection
# refused and the container is permanently unhealthy.
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
