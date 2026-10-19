#!/bin/bash
# KSU Housing FC27 Cup - Safe External Libraries Linker
# Keeps heavy node_modules outside of OneDrive to avoid sync slowdowns
EXTERNAL_DIR="/Users/ya/Documents/codes/nodejs libs/fc27cup"

echo "📦 Setting up Node.js libraries in external folder: $EXTERNAL_DIR"
mkdir -p "$EXTERNAL_DIR"
cp package.json "$EXTERNAL_DIR/"
cd "$EXTERNAL_DIR" && npm install
cd - > /dev/null

# Create symlink in project
ln -sfn "$EXTERNAL_DIR/node_modules" ./node_modules

echo "✅ Ready! node_modules is safely linked from outside OneDrive."
