# Relay Server Dockerfile
# Uses Node.js to run a local version of the Cloudflare Workers relay server

FROM node:20-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm install
RUN cd client && npm install

# Copy source code
COPY . .

# Build client
RUN npm run build:client

# Expose port
EXPOSE 80

# Start the server using wrangler dev
CMD ["npx", "wrangler", "dev", "--ip", "0.0.0.0", "--port", "80"]

