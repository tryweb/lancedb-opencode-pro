FROM node:22-bookworm

WORKDIR /workspace

COPY package.json tsconfig.json README.md ./
COPY src ./src
COPY openspec ./openspec

RUN npm install

CMD ["sleep", "infinity"]
