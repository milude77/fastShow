const { ipcRenderer } = require('electron');

ipcRenderer.on('new-invite-received', (event, data) => {
  console.log('New invite received:', data);
});

