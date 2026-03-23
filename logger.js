// ===== logger.js =====
// AI APIへの送信ログを localStorage に蓄積し、JSONダウンロードを提供する

const AppLogger = (() => {
  const STORAGE_KEY = 'shobi_ai_prompt_logs';
  const MAX_ENTRIES = 500; // 上限件数（超えたら古いものから削除）

  /**
   * ログエントリを1件追記する
   * @param {Object} entry - 保存するログデータ
   */
  function write(entry) {
    try {
      const logs = load();
      logs.push({
        timestamp:   new Date().toISOString(),
        browser:     navigator.userAgent,
        ...entry
      });
      // 上限を超えたら古い順に削除
      if (logs.length > MAX_ENTRIES) {
        logs.splice(0, logs.length - MAX_ENTRIES);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    } catch (e) {
      console.warn('[AppLogger] ログ書き込み失敗:', e);
    }
  }

  /**
   * 全ログを取得する
   * @returns {Array}
   */
  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  /**
   * ログをJSONファイルとしてダウンロードする
   */
  function download() {
    const logs = load();
    if (logs.length === 0) {
      alert('ログがまだありません。');
      return;
    }
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const date = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href     = url;
    a.download = `shobi_ai_log_${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * ログを全件削除する
   */
  function clear() {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * 件数を返す
   * @returns {number}
   */
  function count() {
    return load().length;
  }

  return { write, load, download, clear, count };
})();
