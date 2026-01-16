# 闪聊

'闪聊' 是一个功能丰富的桌面聊天应用程序，旨在提供流畅、安全的实时通讯体验。它基于强大的 Electron 框架构建，结合了 React 的现代化用户界面和 Node.js 的高效后端服务，支持私聊、群聊、文件传输等多种功能。

## 应用截图
(./docs/showImg_1.png)
(./docs/showImg_2.png)
(./docs/showImg_3.png)
(./docs/showImg_4.png)

## 主要特性

-   **实时通讯**：通过 Socket.IO 实现高效、低延迟的实时消息传输。
-   **私聊与群聊**：支持一对一私聊以及多人群组聊天。
-   **用户认证与管理**：安全的注册、登录流程，以及用户凭证管理。
-   **聊天记录管理**：本地 SQLite 数据库存储聊天记录，支持历史消息加载。
-   **文件传输**：支持文件上传和下载功能，集成 MinIO 对象存储。
-   **系统托盘集成**：应用可最小化到系统托盘，不打扰工作流。
-   **联系人与群组管理**：添加好友、创建群组、管理好友请求和群组邀请。
-   **消息状态追踪**：发送消息后，客户端能够追踪消息的发送状态（发送中、成功、失败）。

## 技术栈

-   **前端 (UI)**: React 19, Vite, Ant Design (antd)
-   **桌面应用框架**: Electron
-   **后端 (Server)**: Node.js, Express.js
-   **实时通讯**: Socket.IO
-   **数据库**: SQLite3 (本地存储), PostgreSQL (服务器端)
-   **ORM/数据库查询**: Knex.js
-   **对象存储**: MinIO (通过后端服务集成)
-   **身份验证**: JWT (JSON Web Tokens), bcrypt (密码哈希)
-   **状态管理**: React Hooks
-   **构建工具**: Vite, Electron Builder

## 项目结构

```
fastShow/
├── public/                # 静态资源
├── server/                # Node.js 后端服务
│   ├── chatServer.js      # Socket.IO 聊天服务核心
│   ├── start.js           # 服务启动脚本
│   └── migrations/        # 数据库迁移文件
├── src/
│   ├── electron/          # Electron 主进程代码
│   │   ├── main.js        # 应用入口，主进程逻辑
│   │   ├── preload.js     # 预加载脚本，桥接主进程与渲染进程
│   │   ├── api.js         # 与后端 API 交互
│   │   └── store.js       # Electron Store，用于本地配置管理
│   └── ui/                # React 用户界面代码
│       ├── App.jsx        # 应用程序主组件
│       ├── AuthPage.jsx   # 认证页面 (登录/注册)
│       ├── main.jsx       # React 应用入口
│       ├── components/    # 可复用 UI 组件 (如消息列表、联系人列表、工具栏等)
│       ├── context/       # React Context (认证、Socket)
│       ├── css/           # 全局样式
│       └── hooks/         # 自定义 React Hooks
├── build/                 # 应用图标等构建资源
├── docs/                  # 文档
├── package.json           # 项目依赖和脚本配置
├── vite.config.js         # Vite 配置
└── README.md              # 项目说明文件
```

## 快速开始

### 前提条件

-   Node.js (推荐 v18 或更高版本)
-   npm 或 yarn
-   Git

### 安装

1.  **克隆仓库**

    ```bash
    git clone https://github.com/milude77/fastShow.git
    cd fastShow
    ```

2.  **安装依赖**

    ```bash
    npm install
    # 或者
    yarn install
    ```

### 运行应用

**开发模式 (同时启动 Electron 和 React)**

```bash
npm run dev
# 或者
yarn dev
```

**仅运行后端服务**

```bash
npm run server
# 或者
yarn server
```

### 构建应用

要构建可分发的桌面应用程序（例如 Windows .exe）：

```bash
npm run build:electron
# 或者
yarn build:electron
```

构建完成后，可执行文件将位于 `release/` 目录下。

## 配置

应用程序的 Socket.IO 服务器 URL 需要手动创建 `config.json` 配置：
例如

```json
{
  "DEV_SERVER_URL": "http://localhost:3001",
}
```

在生产环境中，请确保 `SOCKET_SERVER_URL` 指向您实际部署的后端服务地址。

## 贡献

欢迎贡献！如果您有任何功能建议、错误报告或改进，请随时提交 Pull Request 或创建 Issue。

## 许可证

本项目采用 MIT 许可证，详情请见 `LICENSE.txt` 文件。
