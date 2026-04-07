# nginx/Dockerfile
FROM nginx:1.25-alpine
COPY nginx.conf /etc/nginx/nginx.conf
RUN mkdir -p /etc/nginx/certs
COPY certs/dev.crt /etc/nginx/certs/dev.crt
COPY certs/dev.key /etc/nginx/certs/dev.key
EXPOSE 80 443
