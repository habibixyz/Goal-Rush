FROM node:20-slim AS builder
RUN apt-get update && apt-get install -y openssl ca-certificates
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-slim AS runner
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000
CMD ["npm", "run", "start"]
