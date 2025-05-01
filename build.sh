#!/bin/bash

# Build and run script for Security Scan Chat extension

echo "Installing dependencies..."
npm install

echo "Compiling extension..."
npm run compile

echo "Packaging extension..."
npm run package

echo "Extension built successfully."
echo "To run in development mode, use: code --extensionDevelopmentPath=$(pwd)"

# Optional: Launch VSCode with the extension
if [ "$1" == "--launch" ]; then
  echo "Launching VS Code with extension..."
  code --extensionDevelopmentPath=$(pwd)
fi 