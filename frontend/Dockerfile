# Node 18 LTS
FROM node:18-bullseye

WORKDIR /app

# Copy package files for cached install layer
COPY package.json package-lock.json* ./

# Install dependencies. If package-lock.json exists, npm ci will be used via fallback below.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
