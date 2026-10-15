#!/bin/sh
cat > /usr/share/nginx/html/config.js <<EOT
window.NILORA_CONFIG = { apiBase: "${PUBLIC_API_URL:-http://localhost:8080}" };
EOT
