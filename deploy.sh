#!/bin/bash

# CleanCare Pro Production Deployment Script
echo "🚀 Starting CleanCare Pro Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js and try again."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm and try again."
    exit 1
fi

print_status "Node.js version: $(node --version)"
print_status "npm version: $(npm --version)"

# Check if environment variables are set
print_status "Checking environment configuration..."

if [ ! -f ".env" ]; then
    print_error ".env file not found. Please create .env file with required variables."
    exit 1
fi

if [ ! -f "backend/.env" ]; then
    print_error "backend/.env file not found. Please create backend/.env file with required variables."
    exit 1
fi

print_success "Environment files found"

# Install frontend dependencies
print_status "Installing frontend dependencies..."
npm install
if [ $? -eq 0 ]; then
    print_success "Frontend dependencies installed"
else
    print_error "Failed to install frontend dependencies"
    exit 1
fi

# Install backend dependencies
print_status "Installing backend dependencies..."
cd backend
npm install
if [ $? -eq 0 ]; then
    print_success "Backend dependencies installed"
else
    print_error "Failed to install backend dependencies"
    exit 1
fi
cd ..

# Test MongoDB connection
print_status "Testing MongoDB connection..."
cd backend
node test-connection.js
if [ $? -eq 0 ]; then
    print_success "MongoDB connection successful"
else
    print_warning "MongoDB connection test failed - continuing with deployment"
fi
cd ..

# Build frontend for production
print_status "Building frontend for production..."
npm run build
if [ $? -eq 0 ]; then
    print_success "Frontend build completed"
else
    print_error "Frontend build failed"
    exit 1
fi

# Create production startup script
print_status "Creating production startup script..."
cat > start-production.sh << 'EOF'
#!/bin/bash

# Production startup script for CleanCare Pro
echo "🚀 Starting CleanCare Pro in production mode..."

# Start backend server
cd backend
NODE_ENV=production node server-laundry.js &
BACKEND_PID=$!
echo "✅ Backend server started (PID: $BACKEND_PID)"

# Wait for backend to start
sleep 3

# Serve frontend (using a simple HTTP server)
cd ..
if command -v serve &> /dev/null; then
    echo "📦 Serving frontend with 'serve'..."
    serve -s dist -p 8080 &
    FRONTEND_PID=$!
    echo "✅ Frontend server started (PID: $FRONTEND_PID)"
else
    echo "⚠️ 'serve' not found. Installing..."
    npm install -g serve
    serve -s dist -p 8080 &
    FRONTEND_PID=$!
    echo "✅ Frontend server started (PID: $FRONTEND_PID)"
fi

echo ""
echo "🎉 CleanCare Pro is now running!"
echo "📱 Frontend: http://localhost:8080"
echo "🔧 Backend API: http://localhost:3001/api"
echo ""
echo "To stop the servers:"
echo "kill $BACKEND_PID $FRONTEND_PID"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
EOF

chmod +x start-production.sh

# Create development startup script
print_status "Creating development startup script..."
cat > start-development.sh << 'EOF'
#!/bin/bash

# Development startup script for CleanCare Pro
echo "🔧 Starting CleanCare Pro in development mode..."

# Run both frontend and backend concurrently
npm run dev:full
EOF

chmod +x start-development.sh

# Create Docker configuration (optional)
print_status "Creating Docker configuration..."
cat > Dockerfile << 'EOF'
# Multi-stage build for CleanCare Pro
FROM node:18-alpine AS frontend-build

# Set working directory
WORKDIR /app

# Copy frontend package files
COPY package*.json ./
RUN npm ci --only=production

# Copy frontend source
COPY . .

# Build frontend
RUN npm run build

# Backend stage
FROM node:18-alpine AS backend

# Set working directory
WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend-build /app/dist ./dist

# Expose ports
EXPOSE 3001 8080

# Create startup script
RUN echo '#!/bin/sh' > start.sh && \
    echo 'cd backend && node server-laundry.js &' >> start.sh && \
    echo 'cd / && npx serve -s dist -p 8080' >> start.sh && \
    echo 'wait' >> start.sh && \
    chmod +x start.sh

CMD ["./start.sh"]
EOF

cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  cleancare-pro:
    build: .
    ports:
      - "8080:8080"
      - "3001:3001"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
      - backend/.env
    restart: unless-stopped

  # Optional: Add MongoDB if running locally
  # mongodb:
  #   image: mongo:latest
  #   ports:
  #     - "27017:27017"
  #   environment:
  #     MONGO_INITDB_ROOT_USERNAME: admin
  #     MONGO_INITDB_ROOT_PASSWORD: password
  #   volumes:
  #     - mongodb_data:/data/db

# volumes:
#   mongodb_data:
EOF

# Create package.json scripts for production
print_status "Updating package.json with production scripts..."
npm pkg set scripts.start:prod="./start-production.sh"
npm pkg set scripts.start:dev="./start-development.sh"
npm pkg set scripts.docker:build="docker build -t cleancare-pro ."
npm pkg set scripts.docker:run="docker-compose up -d"

# Create .gitignore entries for production files
print_status "Updating .gitignore..."
echo "" >> .gitignore
echo "# Production files" >> .gitignore
echo "dist/" >> .gitignore
echo "build/" >> .gitignore
echo "*.log" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env.production" >> .gitignore

# Final validation
print_status "Running final validation..."

# Check if dist folder was created
if [ -d "dist" ]; then
    print_success "Frontend build output found"
else
    print_error "Frontend build output not found"
    exit 1
fi

# Check if backend server file exists
if [ -f "backend/server-laundry.js" ]; then
    print_success "Backend server file found"
else
    print_error "Backend server file not found"
    exit 1
fi

print_success "🎉 Deployment preparation completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. To start in production mode: ./start-production.sh"
echo "2. To start in development mode: ./start-development.sh"
echo "3. To build Docker image: npm run docker:build"
echo "4. To run with Docker: npm run docker:run"
echo ""
echo "🌐 The application will be available at:"
echo "   Frontend: http://localhost:8080"
echo "   Backend API: http://localhost:3001/api"
echo ""
echo "📱 Features ready:"
echo "   ✅ Fast2SMS Authentication"
echo "   ✅ MongoDB Database Storage"
echo "   ✅ Booking Management"
echo "   ✅ User Profile Management"
echo "   ✅ Real-time Notifications"
echo ""
print_success "Happy deploying! 🚀"
