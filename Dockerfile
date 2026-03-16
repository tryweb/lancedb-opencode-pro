FROM node:22-bookworm

WORKDIR /workspace

COPY package.json tsconfig.json tsconfig.test.json README.md ./
COPY src ./src
COPY test ./test
COPY openspec ./openspec

RUN npm install

CMD ["sleep", "infinity"]
