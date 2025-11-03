FROM node:18-alpine

WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy app code
COPY . .

EXPOSE 3001

CMD ["npm", "start"]
