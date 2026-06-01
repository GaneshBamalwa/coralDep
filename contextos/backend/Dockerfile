FROM ubuntu:24.04

# Install curl and ca-certificates
RUN apt-get update && apt-get install -y curl ca-certificates

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Install Coral CLI (local-first SQL runtime)
RUN curl -fsSL https://withcoral.com/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3001
CMD ["node", "index.js"]
