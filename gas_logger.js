// =====================================================
// Google Apps Script コード
// スプレッドシートの「拡張機能」→「Apps Script」に貼り付けてデプロイする
// =====================================================

const SPREADSHEET_ID = '105WpyGuwkkIbCnSf5f0yJZbNlqgqvmhZMYfD8lLD9jY';
const SHEET_NAME     = 'logs';

// CORSプリフライト対応
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
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

    // IPアドレス取得
    const ip = e.parameter && e.parameter.userIp ? e.parameter.userIp : '';

    // モード判定：rowId があれば上書き更新、なければ新規追記
    if (data.rowId) {
      // ===== 上書き更新モード =====
      const rowIdx = parseInt(data.rowId, 10);
      if (!isNaN(rowIdx) && rowIdx > 1) {
        // AIコメント列（J列 = 10列目）だけ更新
        sheet.getRange(rowIdx, 10).setValue(data.aiReply || '');
        // イベント列（B列 = 2列目）も更新
        sheet.getRange(rowIdx, 2).setValue(data.event || 'ai_response_received');
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
