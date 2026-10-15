FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY public/ /usr/share/nginx/html/
# Writes config.js from the PUBLIC_API_URL environment variable every time the container starts,
# so changing servers means changing one value, never editing the page.
COPY 40-config.sh /docker-entrypoint.d/40-config.sh
RUN chmod +x /docker-entrypoint.d/40-config.sh
