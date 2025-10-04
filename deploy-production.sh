#!/bin/bash

# Production Deployment Script for CleanCare Pro
echo "🚀 Starting production deployment for CleanCare Pro..."

set -e  # Exit immediately if a command exits with a non-zero status

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check Node.js and npm
print_status "Checking system requirements..."
node --version || { print_error "Node.js not found"; exit 1; }
npm --version || { print_error "npm not found"; exit 1; }

# Install frontend dependencies
print_status "Installing frontend dependencies..."
npm install --production=false
print_success "Frontend dependencies installed"

# Build frontend
print_status "Building frontend for production..."
npm run build
print_success "Frontend build completed"

# Install backend dependencies
print_status "Installing backend dependencies..."
cd backend
npm install --production
print_success "Backend dependencies installed"

# Test backend startup
print_status "Testing backend configuration..."
node -e "
const productionConfig = require('./config/production');
try {
  productionConfig.validateConfig();
  console.log('✅ Backend configuration valid');
} catch (error) {
  console.error('❌ Backend configuration error:', error.message);
  process.exit(1);
}
"

cd ..

print_success "🎉 Production deployment completed successfully!"
print_status "To start the application:"
print_status "  Backend: cd backend && NODE_ENV=production node server-laundry.js"
print_status "  Frontend: serve -s dist -p 8080"
