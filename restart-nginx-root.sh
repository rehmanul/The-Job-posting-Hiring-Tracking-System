#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Restart Nginx (no sudo needed for root user)
echo "Restarting Nginx..."
systemctl restart nginx

# Check Nginx status
echo "Checking Nginx status..."
systemctl status nginx
