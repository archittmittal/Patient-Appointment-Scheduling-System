# Root Dockerfile for Hugging Face Spaces
FROM node:18-slim

# Create app directory
WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./backend/

# Install backend dependencies
WORKDIR /app/backend
RUN npm install

# Copy backend source code
COPY backend/ ./

# Return to /app
WORKDIR /app/backend

# Set environment variables
ENV PORT=7860
ENV NODE_ENV=production

# Expose the port
EXPOSE 7860

# Start the application
CMD ["node", "src/server.js"]
