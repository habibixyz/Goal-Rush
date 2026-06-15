FROM node:20-slim

# Install system dependencies required to build better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV PORT=3001
EXPOSE 3001

CMD ["npm", "start"]
