FROM node:20-slim

# Install curl (and anything else Coral needs)
RUN apt-get update && apt-get install -y curl

# INSTALL CORAL CLI HERE (replace with the actual install command from their docs)
# RUN curl -fsSL https://coral.so/install.sh | bash

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3001
CMD ["node", "index.js"]
