// js/pyodide_loader.js — Pyodide 环境加载器
// 职责：加载 Python 运行时，暴露全局 API 供各模块调用 Python 代码

/**
 * PyodideLoader — 单例模式管理 Python 环境生命周期
 * 所有 Python 文件写入 Pyodide 虚拟文件系统，并保持全局命名空间
 */
export class PyodideLoader {
  constructor() {
    /** @type {object|null} Pyodide 实例 */
    this.pyodide = null;
    /** @type {boolean} 是否正在加载 */
    this._loading = false;
    /** @type {Promise|null} 加载中 Promise */
    this._loadingPromise = null;
    /** @type {Set<string>} 已加载的 Python 文件路径 */
    this._loadedFiles = new Set();
  }

  /**
   * 加载 Pyodide 环境（幂等：已加载时立即返回）
   * @returns {Promise<object>} Pyodide 实例
   */
  async load() {
    if (this.pyodide) {
      return this.pyodide;
    }

    if (this._loading && this._loadingPromise) {
      return this._loadingPromise;
    }

    this._loading = true;
    this._loadingPromise = this._doLoad();
    return this._loadingPromise;
  }

  /**
   * 执行一段 Python 代码（持久全局命名空间，可跨调用访问变量和导入）
   * @param {string} code — Python 源码
   * @returns {Promise<any>} Python 执行结果（最后一行的值）
   */
  async runPython(code) {
    const py = await this.load();
    return py.runPythonAsync(code);
  }

  /**
   * 加载 Python 文件到 Pyodide 虚拟文件系统
   * 写入后文件可被 Python import 语句找到
   * @param {string} filePath — 相对路径（如 "python/battle_engine.py"）
   * @returns {Promise<void>}
   */
  async loadPythonFile(filePath) {
    const py = await this.load();
    // Phase 7: 清除 Python 模块缓存，确保重新加载（支持热更新）
    if (this._loadedFiles.has(filePath)) {
      // 清除模块缓存
      const moduleName = filePath.replace(/\//g, '.').replace('.py', '');
      await py.runPythonAsync(`
import sys
for k in list(sys.modules.keys()):
    if '${moduleName.split('/').pop().replace('.py','')}' in k or 'python' in k:
        sys.modules.pop(k, None)
      `.trim());
      this._loadedFiles.delete(filePath);
    }

    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`无法加载 Python 文件: ${filePath} (${response.status})`);
    }
    const code = await response.text();

    // 确保虚拟 FS 中的目录存在
    const parts = filePath.replace(/\\/g, '/').split('/');
    const fileName = parts.pop();
    let dirPath = '/home/pyodide';
    for (const part of parts) {
      dirPath += '/' + part;
      try { py.FS.mkdir(dirPath); } catch (e) { /* 目录已存在 */ }
    }

    // 写入到 Pyodide 虚拟文件系统
    const pyPath = dirPath + '/' + fileName;
    py.FS.writeFile(pyPath, code);
    this._loadedFiles.add(filePath);
  }

  /**
   * 批量加载 Python 文件
   * @param {string[]} filePaths — 文件路径数组
   * @returns {Promise<void>}
   */
  async loadPythonFiles(filePaths) {
    // 按依赖顺序加载：models.py 必须在 battle_engine.py 之前
    for (const fp of filePaths) {
      await this.loadPythonFile(fp);
    }
  }

  /**
   * 检查环境是否已就绪
   * @returns {boolean}
   */
  isReady() {
    return this.pyodide !== null;
  }

  /**
   * 获取环境加载状态文本（用于 UI 提示）
   * @returns {string}
   */
  getStatusText() {
    if (this.pyodide) return 'Python 环境已就绪';
    if (this._loading) return '正在加载 Python 环境...';
    return 'Python 环境未加载';
  }

  // ===== 内部实现 =====

  async _doLoad() {
    // loadPyodide 由 index.html 中的本地 script 注入到全局
    // 使用本地 lib/pyodide/ 目录下的文件
    const py = await loadPyodide({
      indexURL: './lib/pyodide/'
    });
    // 将 /home/pyodide 添加到 sys.path 以便 import 能找到 python/ 包
    py.runPython(`import sys\nsys.path.insert(0, '/home/pyodide')`);
    this.pyodide = py;
    // 缓存到 window 方便跨 eval / 页面复用同一个实例
    window._pyodideInstance = py;
    this._loading = false;
    console.log('[PyodideLoader] Python 环境加载成功 (v' + py.version + ')');
    return py;
  }
}

// 单例导出
export const pyodideLoader = new PyodideLoader();
