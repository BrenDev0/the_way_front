# The panel as one Node server. `next build` with output "standalone" traces the files the
# server needs into .next/standalone, so the image ships that and the static assets --
# not node_modules.
#
#   docker build -t yourname/the-way-web:1.0.0 .
#   docker run -p 3000:3000 -e API_URL=... -e REQUEST_SIGNING_SECRET=... yourname/the-way-web:1.0.0
#
# API_URL and REQUEST_SIGNING_SECRET are read when the server starts, so one image runs
# anywhere. NEXT_PUBLIC_* values are different: Next.js writes them into the browser code
# at build time. Leave NEXT_PUBLIC_UPLOAD_ORIGIN empty for a deployment -- uploads then go
# to the address the API signs (its BUCKET_PUBLIC_ENDPOINT); it only patches local setups.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci


FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_UPLOAD_ORIGIN=
ENV NEXT_PUBLIC_UPLOAD_ORIGIN=$NEXT_PUBLIC_UPLOAD_ORIGIN
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build


FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
