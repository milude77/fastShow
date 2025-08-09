# Electron 进程间通信 (IPC) 详解

Electron 的架构分为两种主要进程：**主进程**和**渲染器进程**。理解它们之间的通信是掌握 Electron 开发的关键。

- **主进程 (Main Process):**
  - 每个 Electron 应用有且只有一个主进程。
  - 它是应用的入口点（在你的项目中是 `src/electron/main.js`）。
  - 它可以访问 Node.js 的所有 API，负责管理应用的生命周期、创建和管理窗口、与操作系统交互等原生功能。
  - **它没有权限访问网页的 DOM 结构。**

- **渲染器进程 (Renderer Process):**
  - 每个浏览器窗口（`BrowserWindow` 实例）都运行一个独立的渲染器进程。
  - 它负责渲染网页内容（在你的项目中是 React 应用，如 `App.jsx`）。
  - 它运行在浏览器环境中，可以访问 DOM API、`window` 对象等。
  - **出于安全原因，它默认无法直接访问 Node.js API。**

由于这两种进程的环境和权限完全隔离，它们之间需要一种安全的通信机制，这就是 **进程间通信 (IPC)**。

---

## 通信的三大关键环节

在你的项目中，IPC 通信是通过以下三个文件协作完成的：

### 1. `src/electron/main.js` (主进程 - 后端)

这是你的应用“后端”。它使用 `ipcMain` 模块来**监听**和**响应**来自渲染器进程的事件。

**关键代码分析:**
```javascript
// main.js
import { ipcMain } from 'electron'

// 监听从渲染器发来的 'chat-message' 频道
ipcMain.on('chat-message', (event, msg) => {
  console.log('收到前端消息:', msg);
  // event.reply 用来向发送此消息的渲染器进程回复
  event.reply('chat-reply', msg);
});
```
- `ipcMain.on(channel, listener)`: 在主进程中监听一个特定的频道 (`channel`)。当有消息传来时，执行回调函数 `listener`。
- `event.reply(channel, ...args)`: 向原始消息的来源（即特定的渲染器进程）发送回复。

### 2. `src/electron/preload.js` (预加载脚本 - 安全桥梁)

这是连接主进程和渲染器进程的**安全桥梁**。它是一个特殊的脚本，在渲染器进程加载网页之前运行，并且**同时可以访问 Node.js API 和 DOM API**。

它的核心任务是使用 `contextBridge` 将主进程的功能安全地暴露给渲染器进程。

**关键代码分析:**
```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 方法一：单向通信（渲染器 -> 主进程）
  sendMessage: (msg) => ipcRenderer.send('chat-message', msg),
  
  // 方法二：双向通信（主进程 -> 渲染器）
  onReply: (callback) => {
    return ipcRenderer.on('chat-reply', (event, data) => callback(data));
  },

  // 清理监听器
  removeChatListener: () => {
    ipcRenderer.removeAllListeners('chat-reply');
  }
});
```
- `contextBridge.exposeInMainWorld(apiKey, apiObject)`: 这是最关键的安全函数。它将一个对象 (`apiObject`) 挂载到渲染器进程的 `window` 对象上，属性名为 `apiKey` (这里是 `electronAPI`)。这样做可以避免将整个 `ipcRenderer` 暴露给渲染器，从而防止潜在的安全风险。
- `ipcRenderer.send(channel, ...args)`: 从渲染器向主进程发送一个消息。
- `ipcRenderer.on(channel, listener)`: 在渲染器中监听来自主进程的消息。

### 3. `src/ui/App.jsx` (渲染器进程 - 前端)

这是你的应用界面。它通过 `window.electronAPI` 来调用在 `preload.js` 中暴露的方法，从而与主进程通信。

**关键代码分析:**
```jsx
// App.jsx (简化前)
function App() {
  // ...
  useEffect(() => {
    // 监听来自主进程的回复
    window.electronAPI.onReply(handleReply);
  }, []);

  function sendMessage() {
    // 调用暴露的方法，向主进程发送消息
    window.electronAPI.sendMessage(sendedMessage);
  }
  // ...
}
```
- `window.electronAPI.sendMessage(...)`: 调用了 `preload.js` 中定义的 `sendMessage` 函数，触发 `ipcRenderer.send`。
- `window.electronAPI.onReply(...)`: 调用了 `preload.js` 中定义的 `onReply` 函数，设置了一个监听器来接收主进程的回复。

---

## 数据流转过程（以你的代码为例）

1.  **用户点击发送 (App.jsx):**
    - `sendMessage` 函数被调用。
    - `window.electronAPI.sendMessage('你好')` 执行。

2.  **消息穿过桥梁 (preload.js):**
    - `sendMessage` 方法被触发，执行 `ipcRenderer.send('chat-message', '你好')`。
    - 消息被发送到 `chat-message` 频道。

3.  **主进程处理 (main.js):**
    - `ipcMain.on('chat-message', ...)` 的监听器被触发。
    - `console.log` 打印出 "收到前端消息: 你好"。
    - `event.reply('chat-reply', '你好')` 执行，将同样的消息回复到 `chat-reply` 频道。

4.  **回复穿过桥梁 (preload.js):**
    - `ipcRenderer.on('chat-reply', ...)` 的监听器被触发。
    - 它调用了在 `App.jsx` 中传入的 `handleReply` 回调函数，参数是 `'你好'`。

5.  **前端接收回复 (App.jsx):**
    - `handleReply` 函数执行，将收到的消息更新到界面上。

这样就完成了一次完整的双向通信。

---

## 新增一个简单示例：获取应用版本号

让我们添加一个新功能：在前端点击一个按钮，从主进程获取应用的版本号并显示。

**1. 修改 `main.js`**
```javascript
// 在 main.js 的 ipcMain 部分添加
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});
```
*我们使用 `ipcMain.handle`，这是专门为“请求-响应”模式设计的，比 `on/reply` 更简洁。*

**2. 修改 `preload.js`**
```javascript
// 在 exposeInMainWorld 的对象中添加一个方法
contextBridge.exposeInMainWorld('electronAPI', {
  // ... 已有方法
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
});
```
*`ipcRenderer.invoke` 与 `ipcMain.handle` 配对使用。它会返回一个 Promise。*

**3. 修改 `Chat.jsx` (或任何你的UI文件)**
```jsx
// 在你的组件中添加一个函数和一个按钮
async function showAppVersion() {
  const version = await window.electronAPI.getAppVersion();
  alert(`应用版本: ${version}`);
}

// 在 JSX 的某个地方添加按钮
<button onClick={showAppVersion}>显示版本号</button>
```

通过这个例子，你可以更清晰地看到如何添加新的 IPC 通信。
