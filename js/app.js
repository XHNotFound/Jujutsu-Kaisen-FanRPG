// js/app.js — 应用入口
// 负责初始化 Pyodide（预留）、加载模块、启动 UIManager

import { UIManager } from './modules/UIManager.js';
import { SaveManager } from './modules/SaveManager.js';
import { CharCreator } from './modules/CharCreator.js';

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // TODO: Phase 2+ 初始化 Pyodide
  // 目前纯 JS 运行，直接启动 UI
  const saveManager = new SaveManager();
  const charCreator = new CharCreator();
  const uiManager = new UIManager(saveManager, charCreator);

  uiManager.init();
});
