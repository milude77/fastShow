import { ipcMain, dialog, BrowserWindow } from 'electron';
import updater from 'electron-updater';
import log from 'electron-log';

const autoUpdater = updater.autoUpdater;


// ================= 日志配置 =================
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// ================= GitHub 更新源 =================
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'milude77',
  repo: 'fastShow'
});

// ================= 主窗口引用 =================
let mainWindow = null;

export function initUpdater(win) {
  mainWindow = win;

  // ================= IPC：检查更新 =================
  ipcMain.handle('check-for-updates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();

      if (result?.updateInfo) {
        return {
          available: true,
          version: result.updateInfo.version
        };
      }

      return { available: false };
    } catch (error) {
      log.error('检查更新失败:', error);
      return { available: false, error: error.message };
    }
  });

  // ================= IPC：下载更新 =================
  ipcMain.on('download-update', () => {
    autoUpdater.downloadUpdate();
  });

  // ================= IPC：安装更新 =================
  ipcMain.on('quit-and-install', () => {
    autoUpdater.quitAndInstall();
  });

  // ================= 自动更新事件 =================

  // 检查更新中
  autoUpdater.on('checking-for-update', () => {
    sendToRenderer('update-status', 'checking');
  });

  // 有新版本
  autoUpdater.on('update-available', (info) => {
    log.info('发现新版本:', info.version);

    sendToRenderer('update-available', info.version);
  });

  // 没有更新
  autoUpdater.on('update-not-available', () => {
    sendToRenderer('update-status', 'no-update');
  });

  // 下载进度
  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('download-progress', {
      percent: progress.percent,
      speed: progress.bytesPerSecond
    });
  });

  // 下载完成
  autoUpdater.on('update-downloaded', (info) => {
    log.info('更新下载完成:', info.version);

    dialog.showMessageBox({
      type: 'info',
      buttons: ['立即重启', '稍后'],
      title: '应用更新',
      message: `新版本 ${info.version} 已下载完成，是否立即重启？`,
      defaultId: 0,
      cancelId: 1,
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  // 错误处理
  autoUpdater.on('error', (error) => {
    log.error('更新错误:', error);
    sendToRenderer('update-error', error.message);
  });
}

// ================= 工具函数 =================
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}