// =====================================================
// Google Apps Script コード
// スプレッドシートの「拡張機能」→「Apps Script」に貼り付けてデプロイする
// =====================================================

const SPREADSHEET_ID = '105WpyGuwkkIbCnSf5f0yJZbNlqgqvmhZMYfD8lLD9jY';
const SHEET_NAME     = 'logs';

// JSON レスポンスヘルパー
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// カンマ区切り文字列を配列に分割（空文字・"なし" は空配列）
function splitAnswer(val) {
  const s = (val || '').toString().trim();
  if (!s || s === 'なし') return [];
  return s.split(',').map(v => v.trim()).filter(Boolean);
}

// GETリクエスト
// ?action=getLogs でスプレッドシートの全ログをJSON配列で返す
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';

  if (action === 'getLogs') {
    try {
      const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
      const sheet = ss.getSheetByName(SHEET_NAME);
      if (!sheet) return jsonResponse([]);

      const rows = sheet.getDataRange().getValues();
      if (rows.length <= 1) return jsonResponse([]); // ヘッダーのみ

      const logs = rows.slice(1).map(row => {
        // Col0: タイムスタンプ（Date or string）→ ISO-like JST 文字列
        const ts  = row[0];
        const timestamp = (ts instanceof Date)
          ? Utilities.formatDate(ts, 'Asia/Tokyo', "yyyy-MM-dd'T'HH:mm:ss")
          : (ts || '').toString();

        // Col8: specialty は " / 分野:" で改行を復元
        const specialty = (row[8] || '').toString()
          .replace(/\s*\/\s*分野:/, '\n分野:');

        return {
          timestamp,
          event:     (row[1]  || '').toString(),
          ip:        (row[2]  || '').toString(),
          answers: {
            q1: splitAnswer(row[3]),
            q2: splitAnswer(row[4]),
            q3: splitAnswer(row[5]),
            q4: splitAnswer(row[6])   // "なし" → []
          },
          dpRate:    (row[7]  || '').toString(),
          specialty,
          aiReply:   (row[9]  || '').toString(),
          browser:   (row[10] || '').toString()
        };
      });

      return jsonResponse(logs);
    } catch (err) {
      return jsonResponse({ error: err.toString() });
    }
  }

  // デフォルト（疎通確認用）
  return jsonResponse({ status: 'ok' });
}

function doPost(e) {
  try {
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    let   sheet = ss.getSheetByName(SHEET_NAME);

    // シートがなければ作成してヘッダーを追加
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow([
        'タイムスタンプ(JST)', 'イベント', 'IP',
        'Q1(分野)', 'Q2(やりたいこと)', 'Q3(身につけたい力)', 'Q4(楽器)',
        'DP獲得率', '専門性と領域', 'AIコメント', 'ブラウザ'
      ]);
      sheet.setFrozenRows(1);
    }

    const data    = JSON.parse(e.postData.contents);
    const answers = data.answers || {};

    // UTC → JST 変換
    const utcDate = new Date(data.timestamp || new Date());
    const jstDate = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
    const jstStr  = Utilities.formatDate(jstDate, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

    // IPアドレス（クライアントJSから送信されたもの）
    const ip = data.ip || '';

    // モード判定：rowId があれば上書き更新、なければ新規追記
    if (data.rowId) {
      // ===== 上書き更新モード =====
      const rowIdx = parseInt(data.rowId, 10);
      if (!isNaN(rowIdx) && rowIdx > 1) {
        // イベント列（B列 = 2列目）更新
        sheet.getRange(rowIdx, 2).setValue(data.event || 'ai_response_received');
        // DP獲得率列（H列 = 8列目）更新
        sheet.getRange(rowIdx, 8).setValue(data.dpRate || '');
        // 専門性と領域列（I列 = 9列目）更新
        sheet.getRange(rowIdx, 9).setValue((data.specialty || '').replace(/\n/g, ' / '));
        // AIコメント列（J列 = 10列目）更新
        sheet.getRange(rowIdx, 10).setValue(data.aiReply || '');
      }
      const result = JSON.stringify({ status: 'ok', rowId: rowIdx });
      return ContentService
        .createTextOutput(result)
        .setMimeType(ContentService.MimeType.JSON);

    } else {
      // ===== 新規追記モード =====
      sheet.appendRow([
        jstStr,
        data.event    || 'q4_answered',
        ip,
        (answers.q1   || []).join(', '),
        (answers.q2   || []).join(', '),
        (answers.q3   || []).join(', '),
        (answers.q4   || []).join('、') || 'なし',
        data.dpRate   || '',
        (data.specialty || '').replace(/\n/g, ' / '),
        '',   // AIコメントは後で上書き
        (data.browser || '').substring(0, 120)
      ]);
      // 追記した行番号を返す（ヘッダー含む行数）
      const newRowId = sheet.getLastRow();
      const result = JSON.stringify({ status: 'ok', rowId: newRowId });
      return ContentService
        .createTextOutput(result)
        .setMimeType(ContentService.MimeType.JSON);
    }

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// テスト用
function testDoPost() {
  const mockEvent = {
    postData: {
      contents: JSON.stringify({
        timestamp:  new Date().toISOString(),
        event:      'q4_answered',
        answers:    { q1: ['pops'], q2: ['performance'], q3: [], q4: ['keyboard'] },
        browser:    'TestBrowser/1.0'
      })
    },
    parameter: { userIp: '192.168.0.1' }
  };
  const result = doPost(mockEvent);
  Logger.log(result.getContent());
}
