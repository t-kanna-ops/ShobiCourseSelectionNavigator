
// Q1～Q4回答後におすすめクラスをランキング下に表示
async function renderClassRecommendationAreaByProfile(profile) {
  document.getElementById('class-recommend-area')?.remove();
  // class.csv取得
  let csv = '';
  try {
    const res = await fetch('class.csv');
    if (!res.ok) throw new Error(`class.csv の取得に失敗しました (HTTP ${res.status})`);
    csv = await res.text();
  } catch(e) {
    // エラーをUIに表示してデバッグを容易にする
    const rankingSection = document.getElementById('ranking-section');
    if (rankingSection) {
      const errArea = document.createElement('div');
      errArea.id = 'class-recommend-area';
      errArea.style = 'margin:2em 0;padding:1.5em;background:#222;color:#ff6666;border-radius:16px;box-shadow:0 0 16px #ff6666;max-width:700px;';
      errArea.innerHTML = `<div style='font-size:1.1em;font-weight:bold;'>基礎演習クラス取得エラー</div><div style='margin-top:0.5em;font-size:0.95em;'>${e.message}</div>`;
      rankingSection.insertAdjacentElement('afterend', errArea);
    }
    return;
  }
  const lines = csv.split(/\r?\n/).filter(l=>l.trim());
  // BOM除去（UTF-8 BOMが付いている場合）
  if (lines.length > 0 && lines[0].charCodeAt(0) === 0xFEFF) {
    lines[0] = lines[0].slice(1);
  }
  // 正規化関数（全角→半角・小文字化）
  const norm = v => v ? v.toString().trim().toLowerCase().replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)) : '';
  // profile は [{key, weight}] の重み付き配列
  const results = lines.map(line=>{
    const cols = line.split(',');
    if(cols.length<7) return null;
    const attrs = cols.slice(3,7).map(norm);
    let score = 0;
    profile.forEach(({key, weight, q})=>{
      const normKey = norm(key);
      const matched = attrs.some(attr => normKey === attr);
      if (matched) {
        score += weight;  // 一致：加点（全Q共通）
      } else {
        score -= weight;  // 非一致：全Qマイナス補正
      }
    });
    return { code:cols[0], className:cols[1], teacher:cols[2], score };
  }).filter(Boolean);
  // 偏差値でマッチ度を表示（偏差値 = 50 + 10×(score-平均)/標準偏差）
  results.sort((a,b)=>b.score-a.score);
  const scores = results.map(r => r.score);
  const mean = scores.reduce((s, v) => s + v, 0) / (scores.length || 1);
  const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / (scores.length || 1);
  const stdDev = Math.sqrt(variance);
  results.forEach(r => {
    r.percent = stdDev > 0
      ? Math.round((50 + 10 * (r.score - mean) / stdDev) * 10) / 10
      : 50;
  });
  const top5 = results.slice(0,5);
  let html = '';
  if (top5.length === 0) {
    html = `<div style='color:#aaa;'>（マッチするクラスが見つかりませんでした）</div>`;
  } else {
    html = top5.map((r,idx)=>{
      return `<div style='margin-bottom:1.2em;padding:1em 1.2em;background:#333;border-radius:10px;box-shadow:0 0 8px #00ff99;'>
        <div style='font-size:1.1em;font-weight:bold;'>${idx+1}位：${r.className}</div>
        <div>教員: <span style='color:#00ff99;'>${r.teacher}</span></div>
        <div style='margin-top:0.5em;'><span style='color:#ffd700;font-weight:bold;'>マッチ度 ${r.percent}%</span>　<a href='https://cps-portal.shobi-u.ac.jp/cpsmart/public/dashboard/main/ja/simple/1900/3000280/wsl/SyllabusSansho?kogiCd=${r.code}' target='_blank' style='color:#00bfff;text-decoration:underline;'>シラバスを見る</a></div>
      </div>`;
    }).join('');
  }
  // ランキング下に挿入（なければ main-area 末尾に追加）
  const rankingSection = document.getElementById('ranking-section');
  const insertTarget = rankingSection || document.getElementById('main-area');
  if (insertTarget) {
    const area = document.createElement('div');
    area.id = 'class-recommend-area';
    area.style = 'margin:2em 0;padding:2em;background:#222;color:#fff;border-radius:16px;box-shadow:0 0 16px #00ff99;max-width:700px;';
    area.innerHTML = `<div style='font-size:1.3em;font-weight:bold;margin-bottom:1em;'>あなたにおすすめの基礎演習クラス</div><div id='class-recommend-result'>${html}</div>`;
    if (rankingSection) {
      rankingSection.insertAdjacentElement('afterend', area);
    } else {
      insertTarget.appendChild(area);
    }
  }
  // 教員ランキングを続けて表示
  await renderTeacherRankingByProfile(profile);
}

async function renderTeacherRankingByProfile(profile) {
  const norm = v => v ? v.toString().trim().toLowerCase().replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)) : '';
  let csv = '';
  try {
    const res = await fetch('kyoin.csv');
    if (!res.ok) throw new Error(`kyoin.csv の取得に失敗しました (HTTP ${res.status})`);
    csv = await res.text();
  } catch(e) {
    return;
  }
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  if (lines.length > 0 && lines[0].charCodeAt(0) === 0xFEFF) lines[0] = lines[0].slice(1);

  const results = lines.map(line => {
    const cols = line.split(',');
    if (cols.length < 2) return null;
    const teacher = cols[0].trim();
    // 属性ごとの出現回数を集計（重複＝強調）
    const attrCounts = {};
    cols.slice(1, 5).map(norm).filter(a => a !== '').forEach(a => {
      attrCounts[a] = (attrCounts[a] || 0) + 1;
    });
    const attrs = Object.keys(attrCounts); // 表示用（重複除去済み）
    let score = 0;
    profile.forEach(({ key, weight }) => {
      const normKey = norm(key);
      const count = attrCounts[normKey] || 0;
      if (count > 0) {
        score += weight * count; // 重複回数分だけ重みを倍増
      } else {
        score -= weight;
      }
    });
    return { teacher, attrs, score };
  }).filter(Boolean);

  results.sort((a, b) => b.score - a.score);
  const scores = results.map(r => r.score);
  const mean = scores.reduce((s, v) => s + v, 0) / (scores.length || 1);
  const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / (scores.length || 1);
  const stdDev = Math.sqrt(variance);
  results.forEach(r => {
    r.percent = stdDev > 0
      ? Math.round((50 + 10 * (r.score - mean) / stdDev) * 10) / 10
      : 50;
  });

  // 全員を表示（上位10名）
  let html = '';
  if (results.length === 0) {
    html = `<div style='color:#aaa;'>（マッチする先生が見つかりませんでした）</div>`;
  } else {
    html = results.slice(0, 10).map((r, idx) => {
      const tagHtml = r.attrs.map(a => `<span style='display:inline-block;background:#0d2040;border:1px solid #30363d;border-radius:4px;padding:0.1em 0.5em;margin:0.1em;font-size:0.82em;color:#aad4ff;'>${a}</span>`).join('');
      return `<div style='margin-bottom:1.2em;padding:1em 1.2em;background:#333;border-radius:10px;box-shadow:0 0 8px #00bfff;'>
        <div style='font-size:1.1em;font-weight:bold;'>${idx + 1}位：<span style='color:#00ff99;'>${r.teacher}</span></div>
        <div style='margin-top:0.4em;'>${tagHtml}</div>
        <div style='margin-top:0.5em;'><span style='color:#ffd700;font-weight:bold;'>マッチ度 ${r.percent}%</span></div>
      </div>`;
    }).join('');
  }

  document.getElementById('class-recommend-area')?.insertAdjacentHTML('afterend',
    `<div id='teacher-recommend-area' style='margin:2em 0;padding:2em;background:#222;color:#fff;border-radius:16px;box-shadow:0 0 16px #00bfff;max-width:700px;'>
      <div style='font-size:1.3em;font-weight:bold;margin-bottom:1em;'>あなたの興味に近い分野の先生</div>
      <div id='teacher-recommend-result'>${html}</div>
    </div>`
  );
}
// データファイルのロード確認
if (typeof courseData === 'undefined' || typeof dpLabels === 'undefined') {
  document.body.innerHTML = '<div style="color:red;font-size:1.2em;padding:2em;">データファイル（data.js）が正しく読み込まれていません。<br>index.htmlの&lt;script src="data.js"&gt;がapp.jsより先に記述されているか確認してください。</div>';
  throw new Error('data.js未読込: courseData, dpLabelsが未定義');
}
// グローバル状態管理
let selectedCourses = [];
let radarChart;
let userAnswers = { q1: [], q2: [], q3: [], q4: [], teaching: false };
let diagnosisStep = 0;
// グローバル宣言（分析結果表示用）
let aiAnalysisResult = '';
let courseSectionOpenState = {};
// courseData, dpLabelsはdata.jsで定義済み

// アシスタント起動時のメッセージ表示関数
function showAssistantMessage() {
  const main = document.getElementById("main-area");
  main.innerHTML = `<div class="cyberpunk-init">
    <div class="ai-message">これから、履修科目選択アシスタントを起動します</div>
    <div class="ai-message">まずはあなたの興味や関心があることについて教えてください</div>
    <button id="next-btn" class="cyberpunk-btn">次へ</button>
  </div>`;
  document.getElementById("next-btn").onclick = () => {
    diagnosisStep = 1;
    showDiagnosisStep();
  };
}

function renderSelectedCoursesList() {
  const container = document.getElementById('selected-courses-list');
  if (!container) return;
  // 選択科目を配当年次ごとにグループ化
  const selected = courseData.filter(c => selectedCourses.includes(c.id));
  const yearGroups = {};
  selected.forEach(course => {
    const year = course.year || 1;
    if (!yearGroups[year]) yearGroups[year] = [];
    yearGroups[year].push(course);
  });
  // 年次ごとの単位数が36を超えていたら超過分を次の年次へ移動
  // 以下の科目は配当年次固定（繰り越し対象外）：
  //   ・常時固定：全必修科目（getRequiredIds()）
  //   ・教職フラグON時の追加固定：区分9 ＋ 指定科目
  const ALWAYS_FIXED_IDS = new Set(getRequiredIds());
  const TEACHING_FIXED_IDS = new Set([
    // 区分9は category で判定するため個別列挙不要
    // 以下は教職フラグON時に追加固定する科目
    'C034','C042',           // 文書作成演習Ⅰ・Ⅱ
    'C038','C039','C040','C081', // メディア論・Webビジネス研究・経営学概論・マーケティング論
    'C182','C183','C184','C185', // 基礎演習Ａ〜Ｄ
    'C186','C187',           // ゼミナールＡ・Ｂ
    'C188','C189'            // 卒業研究Ａ・Ｂ
  ]);

  function isFixed(course) {
    if (ALWAYS_FIXED_IDS.has(course.id)) return true;
    if (userAnswers.teaching) {
      if (String(course.category) === '9') return true;
      if (TEACHING_FIXED_IDS.has(course.id)) return true;
    }
    return false;
  }

  const maxCreditsPerYear = 36;
  const sortedYears = Object.keys(yearGroups).map(Number).sort((a, b) => a - b);
  for (let i = 0; i < sortedYears.length; i++) {
    let year = sortedYears[i];
    let courses = yearGroups[year];
    let totalCredits = courses.reduce((sum, c) => sum + (c.credits || 0), 0);
    while (totalCredits > maxCreditsPerYear) {
      // 固定科目を除いた末尾から繰り越す
      let moveIdx = -1;
      for (let j = courses.length - 1; j >= 0; j--) {
        if (!isFixed(courses[j])) { moveIdx = j; break; }
      }
      if (moveIdx === -1) break; // 繰り越せる科目が存在しない
      const moveCourse = courses.splice(moveIdx, 1)[0];
      let nextYear = sortedYears[i + 1] || (year + 1);
      if (!yearGroups[nextYear]) yearGroups[nextYear] = [];
      yearGroups[nextYear].unshift(moveCourse);
      totalCredits -= moveCourse.credits || 0;
    }
  }
  // 年次順で表示
  container.innerHTML = sortedYears.map(year => {
    const yearCourses = yearGroups[year];
    const yearCredits = yearCourses.reduce((sum, c) => sum + (c.credits || 0), 0);
    return `
      <div class='year-block' style='margin-bottom:1.5em;'>
        <h3 style='color:#00bfff;'>${year}年次：${yearCredits}単位</h3>
        <ul style='margin-left:1em;'>
          ${yearCourses.map(c => `<li>${c.name} <span style='color:#ffd700;'>(${c.credits}単位)</span></li>`).join('')}
        </ul>
      </div>
    `;
  }).join('');
}

// サイバーパンクUI初期化関数
function setupCyberpunkFlow() {
  const main = document.getElementById("main-area");
  main.innerHTML = `<div id="assistant-init" class="cyberpunk-init">
    <button id="start-assistant-btn" class="cyberpunk-btn">履修科目選択アシスタントを起動する</button>
  </div>`;
  document.getElementById("start-assistant-btn").onclick = () => {
    showAssistantMessage();
  };
  // 初回訪問時（チュートリアル未完了）はチュートリアルを表示
  if (!localStorage.getItem('shobi_tutorial_done')) {
    showTutorial();
  }
}

// ===== チュートリアル =====
function showTutorial() {
  const STEPS = [
    {
      title: '👋 ようこそ！履修科目選択アシスタント',
      body: `<p>このツールは、あなたの<strong>興味・関心・目標</strong>に合わせて、履修すべき科目をAIが提案するアシスタントです。</p>
<p style="margin-top:0.8em;">初めて使う方のために、かんたんな使い方を説明します。<br>左下の「スキップ」を押すといつでも終了できます。</p>`
    },
    {
      title: '📋 全体の流れ',
      body: `<ol style="line-height:2;padding-left:1.4em;">
  <li><strong>Q1〜Q4の質問に回答</strong>（約2分）</li>
  <li>あなたの回答をもとに<strong>おすすめ科目を自動表示</strong></li>
  <li>AIが<strong>進路アドバイス</strong>をコメント</li>
  <li>科目を選んで<strong>単位・DP・年次計画を確認</strong></li>
  <li>おすすめの<strong>基礎演習クラスと先生</strong>も表示されます</li>
</ol>`
    },
    {
      title: '🎵 Q1：興味のある分野を選ぼう',
      body: `<p>音楽・舞台・エンタメなど、<strong>あなたが興味を持っている分野</strong>を最大5つ、優先順位をつけて選びます。たくさん選べば選ぶほど、優先順位は曖昧になりますので、特に優先したい分野がある場合は1つだけ選んでください。</p>
<p style="margin-top:0.8em;color:#ffd700;">⭐ 1位に選んだ分野が最も強く反映されます。迷ったら直感で選んでOKです。</p>`
    },
    {
      title: '🎯 Q2：やりたいことを選ぼう',
      body: `<p>「クリエイト・制作」「パフォーマンス・表現」「ビジネス・支える」の中から、<strong>やりたいこと</strong>を最大3つ選びます。</p>
<p style="margin-top:0.8em;">教員免許の取得を目指す方は <strong>「教職課程・教員免許」</strong> もチェックしてください。<br>教職課程では追加の必修科目が発生するため、重要な注意事項が表示されます。</p>`
    },
    {
      title: '💪 Q3：身につけたい力を選ぼう',
      body: `<p>DP（ディプロマ・ポリシー）に沿った<strong>20の能力指標</strong>の中から、特に伸ばしたいものを最大5つ選びます。</p>
<p style="margin-top:0.8em;color:#00ff99;">これがレーダーチャートに反映され、「こうなりたい！」と思う理想の自分に合わせて単位を積むためのヒントになります。</p>`
    },
    {
      title: '🎸 Q4：楽器・専攻を選ぼう',
      body: `<p>演奏したい、あるいは演奏経験がある楽器を選びます。専攻楽器に関連した実技科目が優先的に表示されます。</p>
<p style="margin-top:0.8em;color:#aaa;">楽器が特にない場合は選ばずに次へ進んでください。</p>`
    },
    {
      title: '📊 結果画面の見方',
      body: `<ul style="line-height:2;padding-left:1.2em;">
  <li>🏆 <strong>おすすめランキング</strong>：回答に合った科目の上位10件</li>
  <li>📡 <strong>レーダーチャート</strong>：選択科目のDP獲得バランス</li>
  <li>✅ <strong>科目一覧</strong>：区分ごとに全科目を閲覧・選択可能</li>
  <li>🤖 <strong>AIアドバイス</strong>：進路・大学生活のヒントをAIがコメント</li>
  <li>🎓 <strong>基礎演習クラス・先生ランキング</strong>：あなたに近い先生も紹介</li>
</ul>`
    },
    {
      title: '🚀 準備完了！',
      body: `<p style="font-size:1.1em;">説明は以上です。<br>「はじめる」ボタンを押してアシスタントを起動しましょう！</p>
<p style="margin-top:1em;color:#aaa;font-size:0.9em;">※ このチュートリアルは次回以降は表示されません。<br>もう一度見たい場合はブラウザのキャッシュをクリアしてください。</p>`
    }
  ];

  let currentStep = 0;

  const overlay = document.createElement('div');
  overlay.id = 'tutorial-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.82);z-index:9999;display:flex;align-items:center;justify-content:center;';

  function renderStep() {
    const step = STEPS[currentStep];
    const isLast = currentStep === STEPS.length - 1;
    const dots = STEPS.map((_, i) =>
      `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin:0 3px;background:${i === currentStep ? '#00ff99' : '#444'};"></span>`
    ).join('');

    overlay.innerHTML = `
      <div style="background:#1a2233;border:2px solid #00ff99;border-radius:16px;padding:2em 2.2em;max-width:500px;width:92%;color:#e0f0ff;font-size:0.95em;line-height:1.75;position:relative;">
        <div style="font-size:1.25em;font-weight:bold;color:#00ff99;margin-bottom:0.9em;">${step.title}</div>
        <div style="min-height:130px;">${step.body}</div>
        <div style="text-align:center;margin:1.2em 0 0.5em;">${dots}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:1em;">
          <button id="tut-skip" style="background:none;border:none;color:#888;cursor:pointer;font-size:0.9em;text-decoration:underline;">スキップ</button>
          <div style="display:flex;gap:0.6em;">
            ${currentStep > 0 ? `<button id="tut-prev" class="cyberpunk-btn" style="background:#444;min-width:80px;">◀ 前へ</button>` : ''}
            <button id="tut-next" class="cyberpunk-btn" style="min-width:100px;">${isLast ? '🚀 はじめる' : '次へ ▶'}</button>
          </div>
        </div>
        <div style="text-align:center;font-size:0.8em;color:#555;margin-top:0.6em;">${currentStep + 1} / ${STEPS.length}</div>
      </div>`;

    document.getElementById('tut-skip').onclick = () => closeTutorial();
    document.getElementById('tut-next').onclick = () => {
      if (isLast) { closeTutorial(); }
      else { currentStep++; renderStep(); }
    };
    const prevBtn = document.getElementById('tut-prev');
    if (prevBtn) prevBtn.onclick = () => { currentStep--; renderStep(); };
  }

  function closeTutorial() {
    localStorage.setItem('shobi_tutorial_done', '1');
    overlay.remove();
  }

  document.body.appendChild(overlay);
  renderStep();
}

// 診断完了後のメイン画面表示
function showMainApp() {
  // 画面描画前におすすめ科目抽出
  recommendCourses();
  // 必修科目は常に選択状態（教職フラグも考慮）
  getRequiredIds().forEach(id => {
    if (!selectedCourses.includes(id)) selectedCourses.push(id);
  });
  const main = document.getElementById("main-area");
  main.innerHTML = `
    <div id="reference-area" style="margin-bottom:1em;">
      <button id="reference-btn" class="cyberpunk-btn" style="background:#00bfff;color:#fff;">参考資料：履修モデル一覧</button>
    </div>
    <section id="your-answers-section" style="margin-bottom:1.5em;padding:1.2em 1.5em;background:#1a2233;border-radius:12px;border:1px solid #00bfff44;">
      <h2 style="margin-bottom:0.8em;">あなたが選んだのは…</h2>
      <div id="your-answers-list"></div>
    </section>
    <section id="ranking-section">
      <h2>おすすめランキング</h2>
      <div id="ranking-list"></div>
    </section>
    <section id="simulation-section">
      <h2>履修シミュレーション</h2>
      <div id="course-list"></div>
    </section>
    <section id="summary-section">
      <h2>履修バランス</h2>
      <canvas id="dpRadarChart" width="400" height="400"></canvas>
      <div style="display:flex;gap:2em;justify-content:center;margin:1.5em 0;">
        <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:1em;padding-bottom:1em;min-width:200px;">
          <canvas id="fieldPieChart" width="140" height="140" style="display:block;"></canvas>
          <div id="fieldPieInfo"></div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:1em;padding-bottom:1em;min-width:200px;">
          <canvas id="domainPieChart" width="140" height="140" style="display:block;"></canvas>
          <div id="domainPieInfo"></div>
        </div>
      </div>
      <div id="credit-summary"></div>
      <button id="auto-select-btn" class="cyberpunk-btn" style="margin-top:1em;">おすすめ科目自動選択</button>
    </section>
    <section id="ai-analysis-section">
      <h2>履修ナビ一言アドバイス</h2>
      <button id="ai-analysis-start-btn" class="cyberpunk-btn" style="margin-bottom:1em;">アドバイスを聞く</button>
      <div id="ai-analysis-result">${aiAnalysisResult}</div>
    </section>
    <section id="selected-courses-section">
      <h2>選択科目一覧</h2>
      <div id="selected-courses-list"></div>
    </section>
  `;
  renderRanking();
  // 選択内容の表示
  (()=>{
    const q1Labels = {pops:"ポピュラー音楽",classic:"クラシック音楽",sound:"サウンドエンジニアリング",dance:"ダンス・身体表現",act:"演劇・声優",vocal:"オペラ・ミュージカル・声楽",entertainment:"エンタメ・総合芸術",it:"IT・先端技術"};
    const q2Labels = {create:"クリエイト・創作・制作・ものづくり",performance:"パフォーマンス・演奏・表現・舞台に立つ",business:"ビジネス・販売・チームワーク・誰かを支える"};
    const q4Labels = {keyboard:"キーボード・ピアノ",brass:"吹奏楽器（管楽器・パーカッションなど）",ensemble:"バンドアンサンブル（ドラム・ギター・ベースなど）",vocal:"声楽（オペラ・ミュージカル）"};
    const rows = [
      { q:"Q1. 興味のある分野",   keys: userAnswers.q1 || [], map: q1Labels, ordered: true },
      { q:"Q2. キーワード",        keys: userAnswers.q2 || [], map: q2Labels, ordered: true },
      { q:"Q3. 身につけたい力",    keys: userAnswers.q3 || [], map: dpLabels,  ordered: true },
      { q:"Q4. 演奏経験・楽器",   keys: userAnswers.q4 || [], map: q4Labels, ordered: false }
    ];
    const container = document.getElementById('your-answers-list');
    if (container) {
      container.innerHTML = rows.map(row => {
        const items = row.keys.length
          ? row.keys.map((k, i) => `<span style="display:inline-block;margin:0.2em 0.4em 0.2em 0;padding:0.2em 0.7em;background:#0d2040;border:1px solid #00bfff88;border-radius:6px;color:#e0f0ff;font-size:0.9em;">${row.ordered ? `${i+1}位: ` : ''}${row.map[k] || k}</span>`).join('')
          : `<span style="color:#666;font-size:0.88em;">（未選択）</span>`;
        return `<div style="margin-bottom:0.6em;"><span style="color:#00bfff;font-weight:bold;font-size:0.92em;margin-right:0.5em;">${row.q}</span>${items}</div>`;
      }).join('');
    }
  })();
  renderCourseList();
  renderCharts();
  renderPieCharts();
  renderSelectedCoursesList();
  // おすすめ科目自動選択ボタンのonclick再設定
  const autoBtn = document.getElementById("auto-select-btn");
  if (autoBtn) {
    // おすすめ自動選択で追加したIDを記憶する
    let autoSelectedIds = [];
    autoBtn.onclick = () => {
      // 「おすすめ科目自動解除」モード：自動選択した科目を全解除
      if (autoBtn.dataset.autoSelected === "1") {
        selectedCourses = selectedCourses.filter(id => !autoSelectedIds.includes(id));
        autoSelectedIds = [];
        autoBtn.dataset.autoSelected = "0";
        autoBtn.textContent = "おすすめ科目自動選択";
        renderCourseList();
        renderCharts();
        renderPieCharts();
        renderSelectedCoursesList();
        updateSelectedCreditInfo();
        return;
      }
      // 「おすすめ科目自動選択」モード：教職フラグに応じた上限単位数で選択
      const maxCredits = userAnswers.teaching ? 143 : 100;
      const recommended = courseData
        .filter(c => c.isRecommended)
        .sort((a, b) => b._recommendPercent - a._recommendPercent);
      let totalCredits = getRequiredIds().reduce((sum, id) => {
        const c = courseData.find(x => x.id === id);
        return c ? sum + c.credits : sum;
      }, 0);
      selectedCourses = [...getRequiredIds()]; // 必修は常に選択
      autoSelectedIds = [];
      let pool = [...recommended];
      for (const c of pool) {
        if (!selectedCourses.includes(c.id) && totalCredits + c.credits <= maxCredits) {
          selectedCourses.push(c.id);
          autoSelectedIds.push(c.id);
          totalCredits += c.credits;
        }
      }
      if (totalCredits > maxCredits) {
        let over = totalCredits - maxCredits;
        let removable = selectedCourses.filter(id => !getRequiredIds().includes(id));
        while (over > 0 && removable.length > 0) {
          const idx = Math.floor(Math.random() * removable.length);
          const removeId = removable[idx];
          const c = courseData.find(x => x.id === removeId);
          if (c) {
            selectedCourses = selectedCourses.filter(id => id !== removeId);
            autoSelectedIds = autoSelectedIds.filter(id => id !== removeId);
            over -= c.credits;
            removable.splice(idx, 1);
          }
        }
      }
      autoBtn.dataset.autoSelected = "1";
      autoBtn.textContent = "おすすめ科目自動解除";
      renderCourseList();
      renderCharts();
      renderPieCharts();
      renderSelectedCoursesList();
      updateSelectedCreditInfo(); // 単位数表示を更新
    };
  }
  // AI分析スタートボタンのonclick設定
  const aiBtn = document.getElementById("ai-analysis-start-btn");
  if (aiBtn) {
    aiBtn.onclick = async () => {
      await renderAIAnalysis();
      aiBtn.remove(); // 一度押したらボタン削除
    };
  }
  // 参考資料ボタンの機能追加（描画後に設定）
  const refBtn = document.getElementById("reference-btn");
  if (refBtn) {
    refBtn.onclick = () => {
      window.open('https://drive.google.com/drive/folders/16wsROeRv6IP4_vq88JSx3bo3mHreOY_x?usp=drive_link', '_blank');
    };
  }
  setupFloatMenu(); // 診断完了後にMenuボタン初期化
}

// 初期化
window.addEventListener("DOMContentLoaded", () => {
  setupCyberpunkFlow();
  renderRanking();
  // setupFloatMenu(); ←診断完了後に初期化するため削除
});

// おすすめランキング表示機能（グローバル領域に移動）
function renderRanking() {
  const rankingList = document.getElementById("ranking-list");
  if (!rankingList) return;
  // おすすめ度順で上位10件を抽出
  const recommended = courseData
    .filter(c => c._recommendPercent > 0)
    .sort((a, b) => b._recommendPercent - a._recommendPercent)
    .slice(0, 10);
  rankingList.innerHTML = '';
  recommended.forEach((course, idx) => {
    const item = document.createElement("div");
    item.className = "ranking-item";
    item.style.display = "flex";
    item.style.alignItems = "center";
    item.style.justifyContent = "flex-start";
    item.style.padding = "0.5em 0";
    item.style.borderBottom = "1px dashed #00ff99";
    item.innerHTML = `
      <span style="font-size:1.5em;font-weight:bold;color:#fff;background:#00bfff;border-radius:50%;width:2em;height:2em;display:inline-flex;align-items:center;justify-content:center;margin-right:1em;">${idx + 1}</span>
      <span style="font-size:1.1em;font-weight:bold;color:#fff;margin-right:1em;">${course.name}</span>
      <span style="font-size:1em;color:#00ff99;background:#222;padding:0.2em 0.7em;border-radius:1em;margin-right:1em;">${course.category}</span>
      <span style="font-size:1em;color:#ffd700;font-weight:bold;">おすすめ度 ${course._recommendPercent}%</span>
    `;
    rankingList.appendChild(item);
  });
};
// 必修科目IDリスト
const requiredCourseIds = [
  "C034", "C038", "C039", "C040", "C042", "C081",
  "C182", "C183", "C184", "C185", "C186", "C187", "C188", "C189"
];
// 教職課程履修時の追加必修科目id
const teachingRequiredIds = [
  "C029", // 日本音楽史
  "C030", // 西洋音楽史Ⅰ
  "C031", // 西洋音楽史Ⅱ
  "C052", // 諸民族の音楽
  "C113", // 音楽基礎論
  "C097", // ソルフェージュⅠ
  "C120", // ソルフェージュⅡ
  "C098", // 合唱Ⅰ
  "C099", // 合唱Ⅱ
  "C121", // 歌唱法Ⅰ
  "C122", // 歌唱法Ⅱ
  "C100", // キーボード演習Ⅰ
  "C101", // キーボード演習Ⅱ
  "C145", // 伴奏法Ⅰ
  "C146", // 伴奏法Ⅱ
  "C123", // 日本音楽実習Ⅰ
  "C147", // 日本音楽実習Ⅱ
  "C148", // 指揮法Ⅰ
  "C149", // 指揮法Ⅱ
  "C134", // 作曲法Ⅰ
  "C135", // 作曲法Ⅱ
  "C165", // 日本伝統音楽「長唄」の発声と表現
  "C104", // 教職ピアノⅠ
  "C105", // 教職ピアノⅡ
  "C124", // 教職ピアノⅢ
  "C125", // 教職ピアノⅣ
  "C102", // 教職合奏Ａ
  "C103", // 教職合奏Ｂ
  // 区分9 教職に関する科目（全件）
  "C190", "C191", "C192", "C193", "C194",
  "C195", "C196", "C197", "C198", "C199",
  "C200", "C201", "C202", "C203", "C204",
  "C205", "C206", "C207", "C208", "C209",
  "C210", "C211", "C212", "C213", "C214"
];
// 現在の必修 IDリスト（教職フラグを考慮）を返す
function getRequiredIds() {
  if (userAnswers.teaching) {
    return [...new Set([...requiredCourseIds, ...teachingRequiredIds])];
  }
  return requiredCourseIds;
}
// 診断フェーズのUI表示関数
function showDiagnosisStep() {
  const main = document.getElementById("main-area");
  if (diagnosisStep === 1) {
    main.innerHTML = `<div class="cyberpunk-init">
      <div class="ai-message">Q1. あなたはどんな分野に興味がありますか？<br>（最大5つまで優先順位付きで選択）</div>
      <form id="q1-form">
        ${[
          {key: "pops", label: "ポピュラー音楽"},
          {key: "classic", label: "クラシック音楽"},
          {key: "sound", label: "サウンドエンジニアリング"},
          {key: "dance", label: "ダンス・身体表現"},
          {key: "act", label: "演劇・声優"},
          {key: "vocal", label: "オペラ・ミュージカル・声楽"},
          {key: "entertainment", label: "エンタメ・総合芸術"},
          {key: "it", label: "IT・先端技術"}
        ].map(domain => `<button type="button" class="q1-select-btn" data-key="${domain.key}">${domain.label}</button><br>`).join('')}
      </form>
      <div id="q1-selected-list" style="margin:1em 0;"></div>
      <button id="next-btn" class="cyberpunk-btn">次へ</button>
    </div>`;
    let selectedQ1 = [...(userAnswers.q1 || [])];
    const maxQ1 = 5;
    const q1Options = [
      {key: "pops", label: "ポピュラー音楽"},
      {key: "classic", label: "クラシック音楽"},
      {key: "sound", label: "サウンドエンジニアリング"},
      {key: "dance", label: "ダンス・身体表現"},
      {key: "act", label: "演劇・声優"},
      {key: "vocal", label: "オペラ・ミュージカル・声楽"},
      {key: "entertainment", label: "エンタメ・総合芸術"},
      {key: "it", label: "IT・先端技術"}
    ];
    const q1Btns = Array.from(document.querySelectorAll('.q1-select-btn'));
    const selectedList = document.getElementById('q1-selected-list');
    function updateSelectedList() {
      selectedList.innerHTML = selectedQ1.map((key, idx) => {
        const opt = q1Options.find(o => o.key === key);
        return `<span style='color:#00ff99;font-weight:bold;margin-right:1em;'>${idx+1}位：${opt ? opt.label : key}</span><br>`;
      }).join('');
      q1Btns.forEach(btn => {
        btn.disabled = selectedQ1.length >= maxQ1 && !selectedQ1.includes(btn.dataset.key);
        btn.classList.toggle('selected', selectedQ1.includes(btn.dataset.key));
        btn.style.background = selectedQ1.includes(btn.dataset.key) ? '#ffff00' : '#80ee80';
        btn.style.color = '#222';
      });
    }
    q1Btns.forEach(btn => {
      btn.onclick = () => {
        const key = btn.dataset.key;
        if (selectedQ1.includes(key)) {
          selectedQ1 = selectedQ1.filter(k => k !== key);
        } else if (selectedQ1.length < maxQ1) {
          selectedQ1.push(key);
        }
        updateSelectedList();
      };
      btn.style.background = '#80ee80';
      btn.style.color = '#222';
    });
    updateSelectedList();
    document.getElementById("next-btn").onclick = () => {
      userAnswers.q1 = selectedQ1;
      diagnosisStep = 2;
      showDiagnosisStep();
    };
  } else if (diagnosisStep === 2) {
    main.innerHTML = `<div class="cyberpunk-init">
      <div class="ai-message">Q2. あなたは次のどのキーワード群に興味がありますか？<br>教職課程を希望する場合は教職課程も選択してください。<br>（最大3つまで優先順位付きで選択）</div>
      <form id="q2-form">
        ${[
          {key: "create", label: "クリエイト・創作・制作・ものづくり"},
          {key: "performance", label: "パフォーマンス・演奏・表現・舞台に立つ"},
          {key: "business", label: "ビジネス・販売・チームワーク・誰かを支える"}
        ].map(field => `<button type="button" class="q2-select-btn" data-key="${field.key}">${field.label}</button><br>`).join('')}
        <div style="margin-top:1em;border-top:1px solid #444;padding-top:0.8em;">
          <button type="button" id="teaching-btn" data-key="teaching" style="background:#80ee80;color:#222;padding:0.45em 1.1em;border-radius:6px;border:none;cursor:pointer;font-size:0.9em;font-family:monospace;">教職課程</button>
        </div>
      </form>
      <div id="q2-selected-list" style="margin:1em 0;"></div>
      <div style="display:flex;gap:0.8em;">
        <button id="back-btn" class="cyberpunk-btn" style="background:#555;">戻る</button>
        <button id="next-btn" class="cyberpunk-btn">次へ</button>
      </div>
    </div>`;
    let selectedQ2 = [...(userAnswers.q2 || [])];
    let teachingFlag = !!(userAnswers.teaching);
    const maxQ2 = 3;
    const q2Options = [
      {key: "create", label: "クリエイト・創作・制作・ものづくり"},
      {key: "performance", label: "パフォーマンス・演奏・表現・舞台に立つ"},
      {key: "business", label: "ビジネス・販売・チームワーク・誰かを支える"}
    ];
    const teachingBtn = document.getElementById('teaching-btn');
    function updateTeachingBtn() {
      teachingBtn.style.background = teachingFlag ? '#ffff00' : '#80ee80';
      teachingBtn.style.color = '#222';
    }
    teachingBtn.onclick = () => {
      const turningOn = !teachingFlag;
      teachingFlag = turningOn;
      updateTeachingBtn();
      if (turningOn) {
        // 教職課程注意フロートウィンドウを表示
        const overlay = document.createElement('div');
        overlay.id = 'teaching-notice-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9000;display:flex;align-items:center;justify-content:center;';
        const box = document.createElement('div');
        box.style.cssText = 'background:#1a2233;border:2px solid #ff6666;border-radius:12px;padding:1.8em 2em;max-width:480px;width:90%;color:#e0f0ff;font-size:0.92em;line-height:1.8;';
        box.innerHTML = `
          <div style="font-weight:bold;font-size:1.1em;color:#ff6666;margin-bottom:0.8em;">⚠️ 重要：教職履修の覚悟</div>
          <p style="margin:0 0 1em;">教職課程では、卒業要件124単位に加え約43単位の追加修得が必要で、卒業要件内の一部科目も必修化されます。また教育実習は厳しい条件をクリアし、本気で教員を志す学生のみが対象です。</p>
          <p style="margin:0 0 1em;">各学期の説明会出席は必須です。ガイドを熟読し、仕組みを完全に理解して臨んでください。理解不足は自身の時間を無駄にするだけでなく、実習先に多大な迷惑をかけます。</p>
          <p style="margin:0 0 1.2em;font-weight:bold;color:#ffd700;">強い責任感と覚悟を持って選択してください。</p>
          <div style="text-align:center;">
            <button id="teaching-notice-ok" class="cyberpunk-btn" style="min-width:120px;">確認</button>
          </div>
        `;
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        document.getElementById('teaching-notice-ok').onclick = () => overlay.remove();
      }
    };
    updateTeachingBtn();
    const q2Btns = Array.from(document.querySelectorAll('.q2-select-btn')).filter(b => b.id !== 'teaching-btn');
    const selectedList = document.getElementById('q2-selected-list');
    function updateSelectedList() {
      selectedList.innerHTML = selectedQ2.map((key, idx) => {
        const opt = q2Options.find(o => o.key === key);
        return `<span style='color:#00ff99;font-weight:bold;margin-right:1em;'>${idx+1}位：${opt ? opt.label : key}</span><br>`;
      }).join('');
      q2Btns.forEach(btn => {
        btn.disabled = selectedQ2.length >= maxQ2 && !selectedQ2.includes(btn.dataset.key);
        btn.classList.toggle('selected', selectedQ2.includes(btn.dataset.key));
        btn.style.background = selectedQ2.includes(btn.dataset.key) ? '#ffff00' : '#80ee80';
        btn.style.color = '#222';
      });
    }
    q2Btns.forEach(btn => {
      btn.onclick = () => {
        const key = btn.dataset.key;
        if (selectedQ2.includes(key)) {
          selectedQ2 = selectedQ2.filter(k => k !== key);
        } else if (selectedQ2.length < maxQ2) {
          selectedQ2.push(key);
        }
        updateSelectedList();
      };
      btn.style.background = '#80ee80';
      btn.style.color = '#222';
    });
    updateSelectedList();
    document.getElementById("back-btn").onclick = () => {
      userAnswers.q2 = selectedQ2;
      userAnswers.teaching = teachingFlag;
      diagnosisStep = 1;
      showDiagnosisStep();
    };
    document.getElementById("next-btn").onclick = () => {
      userAnswers.q2 = selectedQ2;
      userAnswers.teaching = teachingFlag;
      diagnosisStep = 3;
      showDiagnosisStep();
    };
  } else if (diagnosisStep === 3) {
    main.innerHTML = `<div class="cyberpunk-init">
      <div class="ai-message">Q3. 特に身につけたい力は？<br>（最大5つまで優先順位付きで選択）</div>
      <form id="q3-form" class="dp-checkboxes">
        ${Object.entries(dpLabels).map(([key, label]) => `<button type="button" class="q3-select-btn" data-key="${key}">${label}</button>`).join('')}
      </form>
      <div id="q3-selected-list" style="margin:1em 0;"></div>
      <div style="display:flex;gap:0.8em;">
        <button id="back-btn" class="cyberpunk-btn" style="background:#555;">戻る</button>
        <button id="next-btn" class="cyberpunk-btn">次へ</button>
      </div>
    </div>`;
    let selectedQ3 = [...(userAnswers.q3 || [])];
    const maxQ3 = 5;
    const q3Btns = Array.from(document.querySelectorAll('.q3-select-btn'));
    const selectedList = document.getElementById('q3-selected-list');
    function updateSelectedList() {
      selectedList.innerHTML = selectedQ3.map((key, idx) => `<span style='color:#00ff99;font-weight:bold;margin-right:1em;'>${idx+1}位：${dpLabels[key]}</span>`).join('');
      q3Btns.forEach(btn => {
        btn.disabled = selectedQ3.length >= maxQ3 && !selectedQ3.includes(btn.dataset.key);
        btn.classList.toggle('selected', selectedQ3.includes(btn.dataset.key));
        btn.style.background = selectedQ3.includes(btn.dataset.key) ? '#ffff00' : '#80ee80';
        btn.style.color = '#222';
      });
    }
    q3Btns.forEach(btn => {
      btn.onclick = () => {
        const key = btn.dataset.key;
        if (selectedQ3.includes(key)) {
          selectedQ3 = selectedQ3.filter(k => k !== key);
        } else if (selectedQ3.length < maxQ3) {
          selectedQ3.push(key);
        }
        updateSelectedList();
      };
      btn.style.background = '#80ee80';
      btn.style.color = '#222';
    });
    updateSelectedList();
    document.getElementById("back-btn").onclick = () => {
      userAnswers.q3 = selectedQ3;
      diagnosisStep = 2;
      showDiagnosisStep();
    };
    document.getElementById("next-btn").onclick = () => {
      userAnswers.q3 = selectedQ3;
      diagnosisStep = 4;
      showDiagnosisStep();
    };
  } else if (diagnosisStep === 4) {
    main.innerHTML = `<div class="cyberpunk-init">
      <div class="ai-message">Q4. 演奏経験がある、もしくは演奏できるようになりたい楽器は？<br>（当てはまるものをすべて選択。なければそのまま「次へ」）</div>
      <form id="q4-form">
        ${[
          {key: "keyboard", label: "キーボード・ピアノ"},
          {key: "brass",    label: "吹奏楽器（管楽器・パーカッションなど）"},
          {key: "ensemble", label: "バンドアンサンブル（ドラム・ギター・ベースなど）"},
          {key: "vocal",    label: "声楽（オペラ・ミュージカル）"}
        ].map(opt => `<button type="button" class="q4-select-btn" data-key="${opt.key}">${opt.label}</button><br>`).join('')}
      </form>
      <div id="q4-selected-list" style="margin:1em 0;"></div>
      <div style="display:flex;gap:0.8em;">
        <button id="back-btn" class="cyberpunk-btn" style="background:#555;">戻る</button>
        <button id="next-btn" class="cyberpunk-btn">診断する</button>
      </div>
    </div>`;
    let selectedQ4 = [...(userAnswers.q4 || [])];
    const q4Options = [
      {key: "keyboard", label: "キーボード・ピアノ"},
      {key: "brass",    label: "吹奏楽器（管楽器・パーカッションなど）"},
      {key: "ensemble", label: "バンドアンサンブル（ドラム・ギター・ベースなど）"},
      {key: "vocal",    label: "声楽（オペラ・ミュージカル）"}
    ];
    const q4Btns = Array.from(document.querySelectorAll('.q4-select-btn'));
    const q4SelectedList = document.getElementById('q4-selected-list');
    function updateQ4List() {
      q4SelectedList.innerHTML = selectedQ4.map(key => {
        const opt = q4Options.find(o => o.key === key);
        return `<span style='color:#00ff99;font-weight:bold;margin-right:1em;'>✔ ${opt ? opt.label : key}</span>`;
      }).join('');
      q4Btns.forEach(btn => {
        btn.style.background = selectedQ4.includes(btn.dataset.key) ? '#ffff00' : '#80ee80';
        btn.style.color = '#222';
      });
    }
    q4Btns.forEach(btn => {
      btn.onclick = () => {
        const key = btn.dataset.key;
        if (selectedQ4.includes(key)) {
          selectedQ4 = selectedQ4.filter(k => k !== key);
        } else {
          selectedQ4.push(key);
        }
        updateQ4List();
      };
      btn.style.background = '#80ee80';
      btn.style.color = '#222';
    });
    updateQ4List();
    document.getElementById("back-btn").onclick = () => {
      userAnswers.q4 = selectedQ4;
      diagnosisStep = 3;
      showDiagnosisStep();
    };
    document.getElementById("next-btn").onclick = () => {
      userAnswers.q4 = selectedQ4;
      diagnosisStep = 5;
      // Q1: domains, Q2: fields, Q3: dp, Q4: instrument
      // 選択順による個別重み配列
      const q1Weights = [1.00, 0.50, 0.30, 0.20]; // 4番目以降は0.20固定
      const q2Weights = [0.80, 0.32, 0.24];
      const q4Weights = [2.00, 1.00];
      const profile = [];
      // Q1: domains
      if (Array.isArray(userAnswers.q1)) {
        userAnswers.q1.forEach((key, idx) => {
          profile.push({ key, weight: q1Weights[idx] ?? 0.20, q: 'q1' });
        });
      }
      // Q2: fields（マイナス補正なし）
      if (Array.isArray(userAnswers.q2)) {
        userAnswers.q2.forEach((key, idx) => {
          if (q2Weights[idx] !== undefined) profile.push({ key, weight: q2Weights[idx], q: 'q2' });
        });
      }
      // Q4: instrument
      if (Array.isArray(userAnswers.q4)) {
        userAnswers.q4.forEach((key, idx) => {
          if (q4Weights[idx] !== undefined) profile.push({ key, weight: q4Weights[idx], q: 'q4' });
        });
      }
      // Q4回答完了時点で初回ログを記録（GASに新規行追加、rowIdをキャッシュ）
      if (typeof AppLogger !== 'undefined') {
        AppLogger.writeInitial({
          answers: {
            q1: userAnswers.q1 || [],
            q2: userAnswers.q2 || [],
            q3: userAnswers.q3 || [],
            q4: userAnswers.q4 || []
          }
        });
      }
      // Q3はdpだがclass.csvには直接使わないので除外
      showMainApp();
      setTimeout(()=>renderClassRecommendationAreaByProfile(profile), 100);
    };
  } else if (diagnosisStep === 5) {
    // 診断・おすすめ科目抽出はshowMainAppで実行
    showMainApp();
  }
} // showDiagnosisStep関数ここで閉じる

// --- 以降はグローバル関数宣言 ---
  // DP
  const dpKeys = Object.keys(dpLabels);
  // 軸ごとの色分け（1～6:青, 7～11:緑, 12～17:黄, 18～20:赤)
  const axisColors = dpKeys.map((_, idx) => {
    if (idx < 6) return '#00bfff';      // 青
    if (idx < 11) return '#00ff99';     // 緑
    if (idx < 17) return '#ffd700';     // 黄
    return '#ff6666';                   // 赤
  });

function renderCharts() {
  const drawArcsPlugin = {
    id: 'drawArcs',
    afterDraw: chart => {
      if (!chart._drawArcsValues) return;
      // デバッグ: 弧の半径値を出力
      const arcColors = ["#00bfff", "#00ff99", "#ffd700", "#ff6666"];
      const arcSegments = [6, 5, 6, 3]; // DP1, DP2, DP3, DP4の詳細DP数
      const totalSegments = 20;
      const { ctx, chartArea } = chart;
      if (!chartArea) return;
      const centerX = chartArea.width / 2 + chartArea.left;
      const centerY = chartArea.height / 2 + chartArea.top;
      const maxRadius = 100;
      const minRadius = 10;
      const arcWidth = 8;
      chart._drawArcsValues.forEach((val, i) => {
        // 180度+90度回転（Math.PI + Math.PI/2加算）
        const startAngle = Math.PI + Math.PI/2 + arcSegments.slice(0, i).reduce((sum, seg) => sum + (seg / totalSegments) * Math.PI * 2, 0);
        const arcLength = (arcSegments[i] / totalSegments) * Math.PI * 2;
        const endAngle = startAngle + arcLength;
        // レーダーチャートと同じ基準で半径を算出
        const baseRadius = Math.min(chartArea.width, chartArea.height) * 0.45;
        const minRadius = baseRadius * 0.5;
        const maxRadius = baseRadius;
        // const arcRadius = (minRadius + (maxRadius - minRadius) * val);
        const arcRadius = (val)*200;
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX+5, centerY, arcRadius, startAngle, endAngle, false);
        ctx.strokeStyle = arcColors[i];
        ctx.lineWidth = arcWidth;
        ctx.globalAlpha = 0.7;
        ctx.stroke();
        ctx.restore();
      });
    }
  };
  Chart.register(drawArcsPlugin);
  
  const selected = courseData.filter(c => selectedCourses.includes(c.id));
  // 全科目のDP合計値（分母）
  const dpKeys = Object.keys(dpLabels);
  const totalDP = {};
  dpKeys.forEach(key => {
    totalDP[key] = courseData.reduce((sum, c) => sum + (c.dp && c.dp[key] ? c.dp[key] : 0), 0);
  });
  // 履修科目のDP合計値（分子）
  const selectedDP = {};
  dpKeys.forEach(key => {
    selectedDP[key] = selected.reduce((sum, c) => sum + (c.dp && c.dp[key] ? c.dp[key] : 0), 0);
  });
  // 割合（0～1）
  const dpValues = dpKeys.map(key => {
    const denom = totalDP[key] || 1;
    return Math.round((selectedDP[key] / denom) * 100) / 100;
  });
  // 大項目DP集計（DP1,DP2,DP3,DP4）
  const dpGroups = [
    dpKeys.filter(k => k.startsWith('1-')), // DP1
    dpKeys.filter(k => k.startsWith('2-')), // DP2
    dpKeys.filter(k => k.startsWith('3-')), // DP3
    dpKeys.filter(k => k.startsWith('4-'))  // DP4
  ];
  const dpGroupValues = dpGroups.map(group => {
    const total = group.reduce((sum, k) => sum + (totalDP[k] || 0), 0);
    const selected = group.reduce((sum, k) => sum + (selectedDP[k] || 0), 0);
    return total ? selected / total : 0;
  });
  // Q3選択DPのみ白でハイライト
  const highlightKeys = userAnswers.q3 || [];
  const labelColors = dpKeys.map((key, idx) => highlightKeys.includes(key) ? '#fff' : axisColors[idx]);
  const radarCanvas = document.getElementById("dpRadarChart");
  const radarCtx = radarCanvas.getContext("2d");
  if (radarChart) radarChart.destroy();
  radarChart = new Chart(radarCtx, {
    type: "radar",
    data: {
      labels: dpKeys.map(k => dpLabels[k]), // 文字列配列のみ
      datasets: [{
        label: "DPバランス（20軸）",
        data: dpValues,
        backgroundColor: "rgba(0,191,255,0.1)",
        borderColor: "#00bfff",
        pointBackgroundColor: "#00ff99"
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {},
        
        // 弧描画プラグイン
        afterDraw: chart => {
          const arcColors = ["#00bfff", "#00ff99", "#ffd700", "#ff6666"];
          const { ctx, chartArea } = chart;
          if (!chartArea) return;
          const centerX = chartArea.width / 2 + chartArea.left;
          const centerY = chartArea.height / 2 + chartArea.top;
          const arcRadius = Math.min(chartArea.width, chartArea.height) * 0.45;
          const arcWidth = 10;
          dpGroupValues.forEach((val, i) => {
            const startAngle = (Math.PI * 0.5) + (i * Math.PI * 0.5);
            const endAngle = startAngle + (Math.PI * 2 * val * 0.25); // 0～0.25周
            ctx.save();
            ctx.beginPath();
            ctx.arc(centerX+5, centerY, arcRadius, startAngle, endAngle, false);
            ctx.strokeStyle = arcColors[i];
            ctx.lineWidth = arcWidth;
            ctx.globalAlpha = 0.7;
            ctx.stroke();
            ctx.restore();
          });
          
        }
        
      },
      scales: {
        r: {
          min: 0,
          max: 1,
          radius: 1.2,
          ticks: {
            stepSize: 0.1,
            color: 'transparent',
            display: false
          },
          angleLines: { color: labelColors },
          grid: { color: '#181f2b' },
          pointLabels: {
            font: { size: 13 },
            color: labelColors // 軸ごとに色分け
          }
        }
      }
    }
    
  });
  radarChart._drawArcsValues = dpGroupValues;
  // 弧の描画（DP1:青, DP2:緑, DP3:黄, DP4:赤）
  const arcColors = ["#00bfff", "#00ff99", "#ffd700", "#ff6666"];
  const centerX = radarCanvas.width / 2;
  const centerY = radarCanvas.height / 2;
  const arcRadius = radarCanvas.width * 0.45;
  const arcWidth = 10;
  dpGroupValues.forEach((val, i) => {
    const startAngle = (Math.PI * 0.5) + (i * Math.PI * 0.5);
    const endAngle = startAngle + (Math.PI * 2 * val * 0.25); // 0～0.25周
    radarCtx.save();
    radarCtx.beginPath();
    radarCtx.arc(centerX+5, centerY, arcRadius, startAngle, endAngle, false);
    radarCtx.strokeStyle = arcColors[i];
    radarCtx.lineWidth = arcWidth;
    radarCtx.globalAlpha = 0.7;
    radarCtx.stroke();
    radarCtx.restore();
  });
  const creditSum = selected.reduce((sum, c) => sum + c.credits, 0);
  const creditSummary = document.getElementById("credit-summary");
  creditSummary.innerHTML = `選択中の合計単位: <strong>${creditSum}</strong> / ${userAnswers.teaching ? 143 : 100}単位`;
}

      function recommendCourses() {
        // Q1分野細分化対応
        const q1Map = {
          pops: c => c.domains.music && c.name.includes('ポップ'),
          classic: c => c.domains.music && (c.name.includes('クラシック') || c.name.includes('合唱') || c.name.includes('器楽')),
          sound: c => c.domains.music && (c.name.includes('サウンド') || c.name.includes('音響') || c.name.includes('エンジニア')),
          dance: c => c.domains.stage && c.name.includes('ダンス'),
          act: c => c.domains.stage && (c.name.includes('演劇') || c.name.includes('声優')),
          vocal: c => c.domains.stage && (c.name.includes('オペラ') || c.name.includes('ミュージカル') || c.name.includes('ボーカル')),
          entertainment: c => c.domains.entertainment,
          it: c => c.domains.it
        };
        // Q4: 楽器フラグを持つ科目で、q4で一つも選択されていない楽器カテゴリは除外
        const q4Selected = userAnswers.q4 || [];
        const sorted = courseData.filter(c => {
          if (c.isTeaching || String(c.category).startsWith('6')) return false;
          // instrumentフラグがある科目：q4で対応する楽器を選んでいなければ除外
          if (c.instrument) {
            return q4Selected.includes(c.instrument);
          }
          return true;
        });
        let maxScore = 1;
        sorted.forEach(course => {
          let score = 0;
          // Q1:分野（重み0.4）
          let q1Match = 0;
          if (userAnswers.q1.length) {
            userAnswers.q1.forEach(domain => {
              if (q1Map[domain] && q1Map[domain](course)) q1Match += 1;
            });
            if (userAnswers.q1.includes("wide")) {
              q1Match += Object.keys(course.domains).length;
            }
          }
          // Q2:フィールド（重み0.3）
          let q2Match = 0;
          if (userAnswers.q2.length) {
            userAnswers.q2.forEach(field => {
              if (course.fields[field] && course.fields[field] > 0) q2Match += 1;
            });
          }
          // Q3:DP（優先順位ごとにレートを掛けて加点）
          let q3Match = 0;
          const q3Rates = [0.3, 0.25, 0.2, 0.15, 0.1];
          if (userAnswers.q3.length) {
            userAnswers.q3.forEach((dpkey, idx) => {
              if (course.dp[dpkey]) q3Match += course.dp[dpkey] * q3Rates[idx];
            });
          }
          // パーセンテージ化
          const q1Rate = userAnswers.q1.length ? q1Match / userAnswers.q1.length : 0;
          const q2Rate = userAnswers.q2.length ? q2Match / userAnswers.q2.length : 0;
          // Q3は合計値（レート反映済み）をそのまま使う
          score = q1Rate * 0.4 + q2Rate * 0.3 + q3Match * 0.3;
          course._score = score;
          if (score > maxScore) maxScore = score;
        });
        // おすすめ度％算出
        sorted.forEach(course => {
          course._recommendPercent = maxScore ? Math.round((course._score / maxScore) * 100) : 0;
        });
        // 教職フラグに応じた上限単位分おすすめ抽出
        sorted.sort((a,b) => b._score - a._score);
        let totalCredits = 0;
        courseData.forEach(c => { delete c.isRecommended; });
        for (const c of sorted) {
          if (totalCredits < 100) {
            c.isRecommended = true;
            totalCredits += c.credits;
          }
        }
      }

      function renderRecommendedCourses() {
        const container = document.getElementById("recommended-courses");
        container.innerHTML = "";
        const recommended = courseData.filter(c => c.isRecommended);
        recommended.forEach(course => {
          // おすすめ科目でも選択可能にする
          container.appendChild(createCourseCard(course, true, true));
        });
      }

      function renderCourseList() {
        const container = document.getElementById("course-list");
        container.innerHTML = "";
        // 教職フラグがオップのときは区分9（教職科目）も表示、オフのときは非表示
        const courses = courseData.filter(c => {
          if (String(c.category) === '9') return userAnswers.teaching;
          return !c.isTeaching;
        });
        // 区分ごとにグループ化
        const group = {};
        courses.forEach(c => {
          const cat = String(c.category);
          if (!group[cat]) group[cat] = [];
          group[cat].push(c);
        });
        // 区分番号順
        Object.keys(group).sort((a,b) => Number(a) - Number(b)).forEach(cat => {
          // アコーディオンヘッダー
          const section = document.createElement("div");
          section.className = "course-section";
          const heading = document.createElement("h3");
          heading.innerHTML = `<span style='font-size:1.2em;vertical-align:middle;'>▽</span> 区分${cat}`;
          heading.style.cursor = "pointer";
          heading.style.background = "#222";
          heading.style.color = "#00ff99";
          heading.style.padding = "0.5em 1em";
          heading.style.borderRadius = "8px";
          // contentはsection内でスコープを持たせる
          const content = document.createElement("div");
          // 折り畳み状態を復元
          content.style.display = courseSectionOpenState[cat] ? "block" : "none";
          heading.onclick = () => {
            courseSectionOpenState[cat] = content.style.display === "none";
            content.style.display = courseSectionOpenState[cat] ? "block" : "none";
          };
          section.appendChild(heading);
          // 区分内五十音順
          group[cat].sort((a,b) => a.name.localeCompare(b.name, 'ja')).forEach(course => {
            content.appendChild(createCourseCard(course, true, course.isRecommended));
          });
          section.appendChild(content);
          container.appendChild(section);
        });
      }


      function toggleCourseSelection(courseId) {
        // 必修科目は選択解除不可（教職フラグも考慮）
        if (getRequiredIds().includes(courseId)) return;
        if (selectedCourses.includes(courseId)) {
          selectedCourses = selectedCourses.filter(id => id !== courseId);
        } else {
          selectedCourses.push(courseId);
        }
        renderCourseList();
        renderCharts();
        renderPieCharts();
        renderSelectedCoursesList();
        updateSelectedCreditInfo();
      }


// createCourseCard関数はここから
function createCourseCard(course, selectable, showBadge) {
  const card = document.createElement("div");
  card.className = "course-card" + (selectedCourses.includes(course.id) ? " selected" : "");
  if (selectedCourses.includes(course.id)) {
    card.style.border = "2px solid #ffe066"; // 明るい黄色
    card.style.boxShadow = "0 0 8px #ffe066";
  }
  // レイアウト: 左に選択ボタン、右に3段（科目名、区分/年次、単位）
  const row = document.createElement("div");
  row.className = "course-row";
  // 必修科目IDリスト（教職フラグも考慮）
  const requiredIds = getRequiredIds();
  if (requiredIds.includes(course.id)) {
    // 必修ラベル（赤字）
    const req = document.createElement("span");
    req.textContent = "必修科目";
    req.className = "course-required-label";
    row.appendChild(req);
    // 選択ボタンは絶対に生成しない
  } else if (['C104','C105','C124','C125','C123','C147','C165'].includes(course.id) && !userAnswers.teaching) {
    // 教職課程限定科目 かつ フラグOFFの場合
    const notice = document.createElement("span");
    notice.textContent = "※教職課程履修者のみ履修可";
    notice.style.cssText = "font-size:0.78em;color:#ff9999;display:block;padding:0.3em 0.5em;";
    row.appendChild(notice);
  } else if (selectable) {
    // ボタン縦並びコンテナ
    const btnWrap = document.createElement("div");
    btnWrap.className = "course-btn-wrap";
    // 概要ボタン
    const btn = document.createElement("button");
    btn.textContent = "概要";
    btn.className = "course-summary-btn";
    btn.onclick = () => {
      showSyllabusFloatWindow(course);
    };
    btnWrap.appendChild(btn);
    // 選択フラグが立っている科目には「解除」ボタンを表示
    if (selectedCourses.includes(course.id)) {
      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "解除";
      cancelBtn.className = "course-cancel-btn";
      cancelBtn.onclick = () => {
        selectedCourses = selectedCourses.filter(id => id !== course.id);
        renderCourseList();
        renderCharts();
        renderPieCharts();
        renderSelectedCoursesList();
        updateSelectedCreditInfo();
      };
      btnWrap.appendChild(cancelBtn);
    }
    row.appendChild(btnWrap);
  }
  // シラバスフロートウィンドウ表示関数（kamoku.csv参照）
  async function showSyllabusFloatWindow(course) {
    document.getElementById('syllabus-float-window')?.remove();
    const win = document.createElement('div');
    win.id = 'syllabus-float-window';
    win.style = 'position:fixed;top:10vh;left:50%;transform:translateX(-50%);z-index:2000;background:#222;color:#fff;padding:2em 1.5em;border-radius:16px;box-shadow:0 0 24px #00ff99;max-width:600px;width:90vw;max-height:80vh;overflow:auto;';
    win.innerHTML = `<div style='font-size:1.2em;font-weight:bold;margin-bottom:1em;'>${course.name}（概要）</div><div id='syllabus-desc' style='min-height:5em;margin-bottom:2em;'>読み込み中...</div><div style='margin-top:1.5em;text-align:right;'><button id='syllabus-select-btn' class='cyberpunk-btn' style='margin-right:1em;'>選択</button><button id='syllabus-close-btn' class='cyberpunk-btn'>閉じる</button></div>`;
    document.body.appendChild(win);
    // 概要文取得
    try {
      const res = await fetch('kamoku.csv');
      const text = await res.text();
      const lines = text.split(/\r?\n/);
      let found = '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const m = line.match(/^"?([^",]+)"?,"?([^"]*)"?$/);
        if (m && m[1].trim() === course.name.trim()) {
          found = m[2].replace(/"/g, '').replace(/\r|\n/g, '<br>');
          break;
        }
      }
      document.getElementById('syllabus-desc').innerHTML = found || '（概要文が見つかりません）';
    } catch(e) {
      document.getElementById('syllabus-desc').innerHTML = '（概要文の取得に失敗しました）';
    }
    // 選択ボタン
    document.getElementById('syllabus-select-btn').onclick = () => {
      if (!selectedCourses.includes(course.id)) selectedCourses.push(course.id);
      renderCourseList();
      renderCharts();
      renderPieCharts();
      renderSelectedCoursesList();
      updateSelectedCreditInfo();
      win.remove();
    };
    // 閉じるボタン
    document.getElementById('syllabus-close-btn').onclick = () => {
      win.remove();
    };
  }
  const info = document.createElement("div");
  info.className = "course-info";
  // 1段目: 科目名＋おすすめ度バッジ
  const nameRow = document.createElement("div");
  nameRow.style.display = "flex";
  nameRow.style.alignItems = "center";
  const name = document.createElement("div");
  name.className = "name";
  name.textContent = course.name;
  nameRow.appendChild(name);
  // おすすめバッジ・おすすめ度は縦並びのみ
  info.appendChild(nameRow);
  // 2段目: 区分/年次
  const category = document.createElement("div");
  category.className = "category";
  category.textContent = `${course.category} / ${course.year}年次`;
  info.appendChild(category);
  // 3段目: 単位数
  const credits = document.createElement("div");
  credits.className = "credits";
  credits.textContent = `${course.credits} 単位`;
  info.appendChild(credits);
  row.appendChild(info);
  // DP情報列（右側）
  const dpObj = course.dp || {};
  const mainDPs = Object.entries(dpObj).filter(([, v]) => v === 2).map(([k]) => k);
  const subDPs  = Object.entries(dpObj).filter(([, v]) => v === 1).map(([k]) => k);
  if (mainDPs.length > 0 || subDPs.length > 0) {
    const dpCol = document.createElement("div");
    dpCol.className = "course-dp-col";
    if (mainDPs.length > 0) {
      const mainRow = document.createElement("div");
      mainRow.className = "course-dp-main";
      mainRow.textContent = "主DP：" + mainDPs.join(" / ");
      dpCol.appendChild(mainRow);
    }
    if (subDPs.length > 0) {
      const subRow = document.createElement("div");
      subRow.className = "course-dp-sub";
      subRow.textContent = "副DP：" + subDPs.join(" / ");
      dpCol.appendChild(subRow);
    }
    row.appendChild(dpCol);
  }
  card.appendChild(row);
  // おすすめバッジ＋おすすめ度（縦並び）
  if (showBadge && course.isRecommended) {
    const badgeWrap = document.createElement("div");
    badgeWrap.style.display = "flex";
    badgeWrap.style.flexDirection = "column";
    badgeWrap.style.alignItems = "flex-start";
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = `おすすめ`;
    badgeWrap.appendChild(badge);
    const percent = document.createElement("div");
    percent.className = "recommend-percent";
    percent.textContent = `おすすめ度 ${course._recommendPercent}%`;
    badgeWrap.appendChild(percent);
    info.appendChild(badgeWrap);
  }
  return card;
}
function updateSelectedCreditInfo() {
  // 選択科目の合計単位数を計算
  let n = selectedCourses.reduce((sum, id) => {
    const c = courseData.find(x => x.id === id);
    return c ? sum + c.credits : sum;
  }, 0);
  const creditDiv = document.getElementById('selected-credit-info');
  if (creditDiv) {
    creditDiv.textContent = `${n}/${userAnswers.teaching ? 143 : 100}`;
  }
}
function renderPieCharts() {
  const selected = courseData.filter(c => selectedCourses.includes(c.id));
  // フィールド
  const fieldKeys = ["performance", "create", "business"];
  const fieldLabels = ["パフォーマンス", "クリエイト", "ビジネス"];
  const fieldColors = ["#00bfff", "#00ff99", "#ffd700"];
  const fieldData = fieldKeys.map(key => selected.reduce((sum, c) => sum + (c.fields && c.fields[key] ? c.fields[key] : 0), 0));
  const fieldCtx = document.getElementById("fieldPieChart");
  if (fieldCtx) {
    const ctx = fieldCtx.getContext("2d");
    if (window.fieldPieChart && typeof window.fieldPieChart.destroy === "function") {
      window.fieldPieChart.destroy();
    }
    window.fieldPieChart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: ["", "", ""], // ラベル非表示
        datasets: [{
          data: fieldData,
          backgroundColor: fieldColors
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        responsive: false
      }
    });
    // canvas下に数値リスト表示（色付き）
    let info = document.getElementById("fieldPieInfo");
    if (info) {
      info.innerHTML = fieldLabels.map((label, i) => `<span style='color:${fieldColors[i]};'>${label}：<strong>${fieldData[i]}</strong></span>`).join('<br>');
    }
  }
  // 分野（教職課程除外）
  const domainKeys = ["music", "stage", "entertainment", "it"];
  const domainLabels = ["音楽表現", "舞台芸術", "エンタメ", "情報技術"];
  const domainColors = ["#00bfff", "#00ff99", "#ffd700", "#ff66cc"];
  const domainData = domainKeys.map(key => selected.reduce((sum, c) => sum + (c.domains && c.domains[key] ? c.domains[key] : 0), 0));
  const domainCtx = document.getElementById("domainPieChart");
  if (domainCtx) {
    const ctx = domainCtx.getContext("2d");
    if (window.domainPieChart && typeof window.domainPieChart.destroy === "function") {
      window.domainPieChart.destroy();
    }
    window.domainPieChart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: ["", "", "", ""], // ラベル非表示
        datasets: [{
          data: domainData,
          backgroundColor: domainColors
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        responsive: false
      }
    });
    // canvas下に数値リスト表示（色付き）
    let info = document.getElementById("domainPieInfo");
    if (info) {
      info.innerHTML = domainLabels.map((label, i) => `<span style='color:${domainColors[i]};'>${label}：<strong>${domainData[i]}</strong></span>`).join('<br>');
    }
  }
}

function setupFloatMenu() {
  document.getElementById('float-menu-container')?.remove();
  // 親コンテナ生成
  const container = document.createElement('div');
  container.id = 'float-menu-container';
  container.style = 'position:fixed;top:16px;left:16px;z-index:1000;display:flex;flex-direction:column;align-items:flex-start;';

  // Menuボタン
  const btn = document.createElement('button');
  btn.className = 'menu-btn';
  btn.id = 'menu-btn';
  btn.textContent = 'Menu';
  btn.onclick = () => showFloatMenu();
  container.appendChild(btn);

  // 単位数表示エリア（常にcontainer配下に移動）
  let creditDiv = document.getElementById('selected-credit-info');
  if (!creditDiv) {
    creditDiv = document.createElement('div');
    creditDiv.id = 'selected-credit-info';
    creditDiv.style = 'position:fixed;top:80px;left:16px;margin:0;font-size:1.1em;color:#00ff99;text-align:left;background:transparent;z-index:1001;';
  } else {
    creditDiv.style = 'position:fixed;top:80px;left:16px;margin:0;font-size:1.1em;color:#00ff99;text-align:left;background:transparent;z-index:1001;';
  }
  document.body.appendChild(creditDiv); // float-menu-containerではなくbody直下に固定表示
  document.body.appendChild(container);
  updateSelectedCreditInfo(); // 内容を必ず更新
}

function showFloatMenu() {
  document.getElementById('float-menu')?.remove();
  // メニュー本体生成
  const menu = document.createElement('div');
  menu.id = 'float-menu';
  menu.className = 'float-menu';
  // 閉じるボタン
  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-btn';
  closeBtn.innerHTML = '×';
  closeBtn.onclick = () => menu.remove();
  menu.appendChild(closeBtn);
  // メニューリスト
  const list = document.createElement('div');
  list.className = 'menu-list';
  // 目次（各エリアへのスクロール）
  const sections = [
    { id: 'ranking-section', label: 'おすすめランキング' },
    { id: 'simulation-section', label: '履修シミュレーション' },
    { id: 'summary-section', label: '履修バランス' },
    { id: 'ai-analysis-section', label: '履修ナビ一言アドバイス' },
    { id: 'selected-courses-section', label: '選択科目一覧' }
  ];
  sections.forEach(sec => {
    const item = document.createElement('div');
    item.className = 'menu-item';
    item.textContent = sec.label;
    item.onclick = () => {
      document.getElementById(sec.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      menu.remove();
    };
    list.appendChild(item);
  });
  // おすすめ科目自動選択ボタン
  const autoBtn = document.createElement('button');
  autoBtn.textContent = 'おすすめ科目自動選択';
  autoBtn.onclick = () => {
    document.getElementById('auto-select-btn')?.click();
    menu.remove();
  };
  list.appendChild(autoBtn);
  menu.appendChild(list);
  document.body.appendChild(menu);
}

async function renderAIAnalysis() {
  const data = getSelectedFieldDomainDP();
  // DP獲得率（例: DP名と値のリスト）
  // 最大獲得値（仮にdata.dpMaxArrで取得、なければ定数で最大値を定義）
  const dpMaxArr = data.dpMaxArr || [20, 20, 20, 20, 20, 20]; // DP数に応じて最大値を設定
  const dpRate = data.dpLabelsArr.map((label, i) => {
    const val = data.dpData[i];
    const max = dpMaxArr[i] || 1;
    const percent = Math.round((val / max) * 100);
    return `${label}: ${percent}%`;
  }).join(', ');
  // 専門性と履修領域（例: フィールド・分野名と値のリスト）
  const fieldRate = data.fieldLabels.map((label, i) => `${label}: ${data.fieldData[i]}`).join(', ');
  const domainRate = data.domainLabels.map((label, i) => `${label}: ${data.domainData[i]}`).join(', ');
  const specialty = `フィールド: ${fieldRate}\n分野: ${domainRate}`;
  // Q1～Q4の選択内容をラベル化してプロンプトに含める
  const q1Map = {pops:'ポピュラー音楽',classic:'クラシック音楽',sound:'サウンドエンジニアリング',dance:'ダンス・身体表現',act:'演劇・声優',vocal:'オペラ・ミュージカル・声楽',entertainment:'エンタメ・総合芸術',it:'IT・先端技術'};
  const q2Map = {create:'クリエイト・制作・ものづくり',performance:'パフォーマンス・演奏・舞台',business:'ビジネス・チームワーク'};
  const q4Map = {keyboard:'キーボード・ピアノ',brass:'管楽器・パーカッション',ensemble:'バンドアンサンブル',vocal:'声楽・オペラ・ミュージカル'};
  const q1Text = (userAnswers.q1||[]).map(k=>q1Map[k]||k).join('、') || 'なし';
  const q2Text = (userAnswers.q2||[]).map(k=>q2Map[k]||k).join('、') || 'なし';
  const q3Text = (userAnswers.q3||[]).map(k=>dpLabels[k]||k).join('、') || 'なし';
  const q4Text = (userAnswers.q4||[]).map(k=>q4Map[k]||k).join('、') || 'なし';
  // プロンプト生成（シンプル版）
  const prompt = `日本語だけで返答してください。Markdownは使わないでください。\n\n音楽・舞台・エンタメ系の大学に通う学生へ、明るくフレンドリーな口調でアドバイスをお願いします。\n\n【学生の興味・関心】\n・興味のある分野：${q1Text}\n・やりたいこと：${q2Text}\n・身につけたい力：${q3Text}\n・演奏したい楽器：${q4Text}\n\n【履修データ】\n・DP獲得率：${dpRate}\n・専門性と領域：${specialty}\n\n以下の2点を150字以内でそれぞれ答えてください。\n\n（１）この学生に向いていそうな職業や進路を、具体的な職業名で3つ提案してください。理由も一言添えてください。\n\n（２）大学生活や学外でやっておくと良いことを1〜2つ、明るく具体的に伝えてください。`;
  // API送信
  const resultDiv = document.getElementById('ai-analysis-result');
  resultDiv.innerHTML = '<div style="color:#00bfff;">アドバイスを考えているよ！ちょっと待ってね✨</div>';
  try {
    const res = await fetch("https://test001-ten-steel.vercel.app/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: prompt }) // messageキーに修正
    });
    const data = await res.json();
    // APIリターンは data.reply で受ける
    if (data.reply) {
      resultDiv.innerHTML = `<div style='white-space:pre-line;'>${data.reply}</div>`;
      // AIレスポンス受信時：同一行をrowIdで上書き更新
      if (typeof AppLogger !== 'undefined') {
        AppLogger.updateWithAI(data.reply);
      }
    } else {
      resultDiv.innerHTML = `<div style='color:red;'>AI分析の取得に失敗しました。${data.error ? `<br>${data.error}` : ''}</div>`;
    }
  } catch (e) {
    resultDiv.innerHTML = `<div style='color:red;'>AI分析の取得に失敗しました。<br>${e.toString()}</div>`;
  }
}

// 拡張：職業リスト（分野・フィールド・DPごとにマッチ度）
const jobMaster = [
  { label: '舞台俳優', domain: 'stage', field: 'performance', dp: ['DP1-1','DP1-2'] },
  { label: '舞台監督', domain: 'stage', field: 'performance', dp: ['DP2-1','DP2-2'] },
  { label: 'イベントプロデューサー', domain: 'entertainment', field: 'business', dp: ['DP3-1','DP3-2'] },
  { label: '演出家', domain: 'stage', field: 'performance', dp: ['DP1-1','DP2-1'] },
  { label: '作曲家', domain: 'music', field: 'create', dp: ['DP4-1','DP4-2'] },
  { label: 'サウンドエンジニア', domain: 'music', field: 'it', dp: ['DP3-2','DP4-3'] },
  { label: '音楽プロデューサー', domain: 'music', field: 'business', dp: ['DP2-2','DP3-1'] },
  { label: 'アナリスト', domain: 'it', field: 'business', dp: ['DP3-1','DP3-2'] },
  { label: '音楽ジャーナリスト', domain: 'music', field: 'business', dp: ['DP2-1','DP3-1'] },
  { label: 'ITエンジニア', domain: 'it', field: 'create', dp: ['DP4-3','DP3-2'] },
  { label: '教員', domain: 'isTeaching', field: 'business', dp: ['DP2-2','DP4-1'] },
  { label: '映像クリエイター', domain: 'entertainment', field: 'create', dp: ['DP4-2','DP4-3'] },
  { label: '舞台美術', domain: 'stage', field: 'create', dp: ['DP4-1','DP2-1'] },
  { label: 'データサイエンティスト', domain: 'it', field: 'business', dp: ['DP3-2','DP4-3'] },
  { label: 'プロダクトマネージャー', domain: 'business', field: 'business', dp: ['DP2-2','DP3-1'] }
];

function getSelectedFieldDomainDP() {
  const selected = courseData.filter(c => selectedCourses.includes(c.id));
  // フィールド
  const fieldKeys = ["performance", "create", "business"];
  const fieldLabels = ["パフォーマンス", "クリエイト", "ビジネス"];
  const fieldData = fieldKeys.map(key => selected.reduce((sum, c) => sum + (c.fields && c.fields[key] ? c.fields[key] : 0), 0));
  // 分野（教職課程除外）
  const domainKeys = ["music", "stage", "entertainment", "it"];
  const domainLabels = ["音楽表現", "舞台芸術", "エンタメ", "情報技術"];
  const domainData = domainKeys.map(key => selected.reduce((sum, c) => sum + (c.domains && c.domains[key] ? c.domains[key] : 0), 0));
  const dpLabelsArr = dpKeys.map(k => dpLabels[k]);
  const dpData = dpKeys.map(key => selected.reduce((sum, c) => sum + (c.dp && c.dp[key] ? c.dp[key] : 0), 0));
  return {
    fieldKeys, fieldLabels, fieldData,
    domainKeys, domainLabels, domainData,
    dpKeys, dpLabelsArr, dpData
  };
}

// 重み付け関数（選択数に応じて重み配列を返す）
function getWeights(n) {
  if (n === 1) return [1];
  if (n === 2) return [0.6, 0.4];
  if (n === 3) return [0.5, 0.3, 0.2];
  if (n === 4) return [0.4, 0.3, 0.2, 0.1];
  if (n === 5) return [0.3, 0.25, 0.2, 0.15, 0.1];
  return Array(n).fill(1/n);
}

// 参考資料ボタンの機能追加
setTimeout(() => {
  const refBtn = document.getElementById("reference-btn");
  if (refBtn) {
    refBtn.onclick = () => {
      window.open('https://drive.google.com/drive/folders/16wsROeRv6IP4_vq88JSx3bo3mHreOY_x?usp=drive_link', '_blank');
    };
  }
}, 0);
