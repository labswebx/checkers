#!/bin/bash

# Update package list
apt-get update

# Install dependencies for Chrome
apt-get install -y \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxtst6 \
    libnss3 \
    libcups2 \
    libxss1 \
    libxrandr2 \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libpangocairo-1.0-0 \
    libgtk-3-0 \
    libgbm1 \
    libxshmfence1 \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    fonts-liberation \
    libu2f-udev \
    libvulkan1 \
    xvfb \
    xauth \
    libpango-1.0-0 \
    libcairo2

# Make the script executable
chmod +x "$(dirname "$0")/setup-puppeteer.sh"

echo "Puppeteer dependencies installed successfully!" 