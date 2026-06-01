FROM node:20-slim

# Install curl (and anything else Coral needs)
RUN apt-get update && apt-get install -y curl

# Install Coral CLI (local-first SQL runtime)
RUN curl -fsSL https://withcoral.com/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3001
CMD ["node", "index.js"]
