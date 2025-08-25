#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Restart Nginx
echo "Restarting Nginx..."
sudo systemctl restart nginx

# Check Nginx status
echo "Checking Nginx status..."
sudo systemctl status nginx
