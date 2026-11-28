'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  init: () => ipcRenderer.invoke('state:init'),
  downloadModel: (id) => ipcRenderer.invoke('model:download', id),
  addModel: () => ipcRenderer.invoke('model:add'),
  pickEngine: () => ipcRenderer.invoke('engine:pick'),
  startEngine: (payload) => ipcRenderer.invoke('engine:start', payload),
  stopEngine: () => ipcRenderer.invoke('engine:stop'),
  send: (messages) => ipcRenderer.invoke('chat:send', messages),
  search: (query) => ipcRenderer.invoke('search:web', query),
  readUrl: (url, opts) => ipcRenderer.invoke('web:read', url, opts),
  readFromText: (text) => ipcRenderer.invoke('web:read-from-text', text),
  openExternal: (url) => ipcRenderer.invoke('open:external', url),
  profileList: () => ipcRenderer.invoke('profile:list'),
  profileCreate: (payload) => ipcRenderer.invoke('profile:create', payload),
  profileVerify: (payload) => ipcRenderer.invoke('profile:verify', payload),
  profileActivate: (id) => ipcRenderer.invoke('profile:activate', id),
  profileDelete: (id) => ipcRenderer.invoke('profile:delete', id),
  profileReset: (payload) => ipcRenderer.invoke('profile:reset', payload),
  githubDeviceCode: (clientId) => ipcRenderer.invoke('github:device-code', clientId),
  githubPoll: (payload) => ipcRenderer.invoke('github:poll', payload),
  onChunk: (cb) => ipcRenderer.on('chat:chunk', (_e, data) => cb(data)),
  onProgress: (cb) => ipcRenderer.on('model:progress', (_e, data) => cb(data)),
  onEngineLog: (cb) => ipcRenderer.on('engine:log', (_e, line) => cb(line)),
  onEngineExit: (cb) => ipcRenderer.on('engine:exit', (_e, code) => cb(code))
})
