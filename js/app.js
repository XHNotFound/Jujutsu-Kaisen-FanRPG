// js/app.js — 应用入口
// 负责初始化 Pyodide、加载模块、启动 UIManager

import { UIManager } from './modules/UIManager.js';
import { SaveManager } from './modules/SaveManager.js';
import { CharCreator } from './modules/CharCreator.js';
import { pyodideLoader } from './pyodide_loader.js';

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  const saveManager = new SaveManager();
  const charCreator = new CharCreator();
  const uiManager = new UIManager(saveManager, charCreator, pyodideLoader);

  // 暴露到 window 方便调试
  window.__app = { saveManager, charCreator, uiManager, pyodideLoader };

  // 先启动 UI（不等待 Pyodide）
  uiManager.init();

  // 后台异步加载 Pyodide（不阻塞 UI）
  pyodideLoader.load().then(() => {
    console.log('[app] Pyodide 环境就绪');
    return pyodideLoader.runPython('"Hello from Python (Pyodide v" + str(__import__("sys").version_info.major) + "." + str(__import__("sys").version_info.minor) + ")"');
  }).then(result => {
    console.log('[app] Pyodide 自检:', result);
  }).catch(err => {
    console.warn('[app] Pyodide 加载失败（将在需要时重试）:', err.message);
  });
});
