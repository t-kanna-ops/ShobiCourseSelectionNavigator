// ===== logger.js =====
// AI APIへの送信ログを localStorage に蓄積し、Google スプレッドシートにも送信する

const AppLogger = (() => {
  const STORAGE_KEY  = 'shobi_ai_prompt_logs';
  const MAX_ENTRIES  = 500;
  // Google Apps Script WebアプリURLをデプロイ後にここへ設定する
  const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbx98LVRe5BrfHXdZaEiee-mZ-0ZOMB0kDp6CTIcsi-SIkTEUGIVUEMTjf7ootuXruKytA/exec';

  /**
   * ログエントリを1件追記する（localStorage保存 + GAS送信）
   */
  function write(entry) {
    try {
      const logs = load();
      const logEntry = {
        timestamp: new Date().toISOString(),
        browser:   navigator.userAgent,
        ...entry
      };
      logs.push(logEntry);
      if (logs.length > MAX_ENTRIES) {
        logs.splice(0, logs.length - MAX_ENTRIES);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));

      // GASへ非同期送信（失敗してもローカル保存には影響しない）
      if (GAS_ENDPOINT && !GAS_ENDPOINT.startsWith('YOUR_')) {
        fetch(GAS_ENDPOINT, {
          method:  'POST',
          mode:    'no-cors', // GAS CORS対策
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(logEntry)
        }).catch(() => {});
      }
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
