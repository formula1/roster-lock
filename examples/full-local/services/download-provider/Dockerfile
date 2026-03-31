# Download Provider Dockerfile
# Serves piece file listings and tarballs

FROM node:20-alpine

WORKDIR /app

# Install curl for healthcheck + tar for creating archives
RUN apk add --no-cache curl tar

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 80

# Start the server
CMD ["npm", "start"]

