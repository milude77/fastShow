const { ipcRenderer } = require('electron');

ipcRenderer.on('new-invite-received', (event, data) => {
  console.log('New invite received:', data);
});

console.log('Registering language-updated listener')
ipcRenderer.on('language-updated', (event, language) => {
  console.log('Language updated:', language);
})
