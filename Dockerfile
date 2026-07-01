FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install
RUN npm install dotenv
RUN npm install https

COPY . .

# 安装 knex CLI（如果你项目里没有）s
RUN npm install -g knex qs

CMD ["sh", "-c", "npx knex migrate:latest --knexfile server/knexfile.cjs && npm run server"]