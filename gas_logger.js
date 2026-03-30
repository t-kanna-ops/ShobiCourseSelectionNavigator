// =====================================================
// Google Apps Script コード
// スプレッドシートの「拡張機能」→「Apps Script」に貼り付けてデプロイする
// =====================================================

const SPREADSHEET_ID = '105WpyGuwkkIbCnSf5f0yJZbNlqgqvmhZMYfD8lLD9jY';
const SHEET_NAME     = 'logs'; // シート名（なければ自動作成）

function doPost(e) {
  try {
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    let   sheet = ss.getSheetByName(SHEET_NAME);

    // シートがなければ作成してヘッダーを追加
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow([
        'タイムスタンプ(JST)', 'イベント',
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

    sheet.appendRow([
      jstStr,
      data.event    || '',
      (answers.q1   || []).join(', '),
      (answers.q2   || []).join(', '),
      (answers.q3   || []).join(', '),
      (answers.q4   || []).join('、') || 'なし',
      data.dpRate   || '',
      (data.specialty || '').replace(/\n/g, ' / '),
      data.aiReply  || '',
      (data.browser || '').substring(0, 120)
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// テスト用：スクリプトエディタから直接実行して動作確認できる
function testDoPost() {
  const mockEvent = {
    postData: {
      contents: JSON.stringify({
        timestamp:  new Date().toISOString(),
        event:      'ai_response_received',
        answers:    { q1: ['pops'], q2: ['performance'], q3: [], q4: ['keyboard'] },
        dpRate:     'DP1: 80%, DP2: 60%',
        specialty:  'フィールド: パフォーマンス: 5\n分野: 音楽: 8',
        aiReply:    'テスト用AIコメントです。',
        browser:    'TestBrowser/1.0'
      })
    }
  };
  const result = doPost(mockEvent);
  Logger.log(result.getContent());
}
