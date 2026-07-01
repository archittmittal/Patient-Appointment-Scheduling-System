# Use official Node.js image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy rest of the backend code
COPY . .

# Expose port (Hugging Face uses 7860 by default)
EXPOSE 7860

# Start the server (update if your entry file is not server.js)
CMD ["node", "src/server.js"]
