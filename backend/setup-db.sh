#!/bin/bash
echo "Setting up MySQL database..."
mysql -u root -e "SOURCE ./database/schema.sql"
echo "Database setup complete."
