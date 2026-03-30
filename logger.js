// ===== logger.js =====
// AI APIへの送信ログを localStorage に蓄積し、Google スプレッドシートにも送信する

const AppLogger = (() => {
  const STORAGE_KEY    = 'shobi_ai_prompt_logs';
  const SESSION_ROW_KEY = 'shobi_log_session_rowid'; // セッション中の行IDキャッシュ
  const MAX_ENTRIES    = 500;
  const GAS_ENDPOINT   = 'https://script.google.com/macros/s/AKfycbx98LVRe5BrfHXdZaEiee-mZ-0ZOMB0kDp6CTIcsi-SIkTEUGIVUEMTjf7ootuXruKytA/exec';

  // GASへPOSTし、レスポンスのrowIdを返す（失敗時はnull）
  async function postToGAS(payload) {
    if (!GAS_ENDPOINT || GAS_ENDPOINT.startsWith('YOUR_')) return null;
    try {
      const res = await fetch(GAS_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain' }, // GAS CORS対策: text/plainはプリフライト不要
        body:    JSON.stringify(payload)
      });
      const json = await res.json();
      return json.rowId || null;
    } catch (e) {
      console.warn('[AppLogger] GAS送信失敗:', e);
      return null;
    }
  }

  // クライアントのパブリックIPを取得（ipify.org利用、失敗時は空文字）
  async function getClientIP() {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const json = await res.json();
      console.log('[AppLogger] IP取得成功:', json.ip);
      return json.ip || '';
    } catch (e) {
      console.warn('[AppLogger] IP取得失敗:', e);
      return '';
    }
  }

  /**
   * Q4回答時の初回ログ（新規行として追記し、rowIdをセッションキャッシュに保存）
   */
  async function writeInitial(entry) {
    try {
      const ip = await getClientIP();
      const logs = load();
      const logEntry = {
        timestamp: new Date().toISOString(),
        browser:   navigator.userAgent,
        ip:        ip,
        event:     'q4_answered',
        ...entry
      };
      logs.push(logEntry);
      if (logs.length > MAX_ENTRIES) logs.splice(0, logs.length - MAX_ENTRIES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));

      // GASへ送信し、返ってきたrowIdをセッションストレージにキャッシュ
      const rowId = await postToGAS(logEntry);
      console.log('[AppLogger] GAS送信結果 rowId:', rowId, ' ip:', ip);
      if (rowId) {
        sessionStorage.setItem(SESSION_ROW_KEY, String(rowId));
      }
    } catch (e) {
      console.warn('[AppLogger] writeInitial失敗:', e);
    }
  }

  /**
   * AIレスポンス受信時の上書き更新（セッションキャッシュのrowIdで同一行を更新）
   */
  async function updateWithAI(aiReply, extra = {}) {
    try {
      const rowId = sessionStorage.getItem(SESSION_ROW_KEY);
      const payload = {
        event:     'ai_response_received',
        aiReply:   aiReply,
        dpRate:    extra.dpRate    || '',
        specialty: extra.specialty || '',
        rowId:     rowId ? parseInt(rowId, 10) : null
      };

      if (rowId) {
        await postToGAS(payload);
        sessionStorage.removeItem(SESSION_ROW_KEY); // 使用済みキャッシュをクリア
      } else {
        // rowIdがない場合は通常のwrite（フォールバック）
        await postToGAS({ ...payload, timestamp: new Date().toISOString(), browser: navigator.userAgent });
      }

      // localStorageの最新エントリにもaiReply/dpRate/specialtyを追記
      const logs = load();
      if (logs.length > 0) {
        const last = logs[logs.length - 1];
        if (!last.aiReply) {
          last.aiReply   = aiReply;
          last.dpRate    = extra.dpRate    || '';
          last.specialty = extra.specialty || '';
          last.event     = 'ai_response_received';
          localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
        }
      }
    } catch (e) {
      console.warn('[AppLogger] updateWithAI失敗:', e);
    }
  }

  /**
   * 全ログを取得する（後方互換用のwrite関数も維持）
   */
  function write(entry) {
    try {
      const logs = load();
      const logEntry = { timestamp: new Date().toISOString(), browser: navigator.userAgent, ...entry };
      logs.push(logEntry);
      if (logs.length > MAX_ENTRIES) logs.splice(0, logs.length - MAX_ENTRIES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
      postToGAS(logEntry);
    } catch (e) {
      console.warn('[AppLogger] ログ書き込み失敗:', e);
    }
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  }

  function download() {
    const logs = load();
    if (logs.length === 0) { alert('ログがまだありません。'); return; }
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const date = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href = url; a.download = `shobi_ai_log_${date}.json`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function clear() { localStorage.removeItem(STORAGE_KEY); }
  function count() { return load().length; }

  return { write, writeInitial, updateWithAI, load, download, clear, count };
})();
