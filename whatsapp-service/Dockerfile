FROM node:18-alpine

# Install build dependencies (required for native crypto packages if any build from source)
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application files
COPY . .

# Expose port
EXPOSE 3000

# Start command
CMD ["npm", "start"]
