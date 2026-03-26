FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# 安装 knex CLI（如果你项目里没有）
RUN npm install -g knex

CMD ["sh", "-c", "npx knex migrate:latest && npm run server"]