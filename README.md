# 魔導書バトル（試作）

本の表紙を撮影すると、その本が「魔導書」カードになる。そのカードでCPUとターン制バトル。スマホブラウザ用PWA。

- 撮影してカード化：カメラ（使えない時は写真を選ぶ）→ 表紙の自動検出（四隅は手で調整可）→ 端末内OCR（Tesseract.js / jpn+eng、初回のみ約5MBを読み込み）でタイトル読み取り → 違えば手で修正 → 召喚演出
- 強さ：表紙の主な色＋タイトルのキーワード（炎→火、海→水…）＋ハッシュで決定。同じ本（同じタイトル＋近い表紙色）からは同じカード
- `StatGenerator` インターフェース：`DeterministicStatGenerator`（実装済み）／`AIStatGenerator`（将来の画像AI用の空の入口）
- バトル：デッキ20枚（不足ははじまりの魔導書20種で補充）、魔力1から毎ターン+1（最大10）、体力20、場は5体まで、挑発・速攻・回復・全体攻撃・ドロー・吸収、属性相性 火>風>土>水>火・光⇔闇 1.5倍
- CPU：見習い（ランダム）／宮廷（貪欲）／大賢者（先読み＋とどめ探索）
- 保存：IndexedDB（カードと表紙画像）＋ localStorage（デッキ・戦績）。表紙はこの端末の中だけに保存され、送信されません。

## 構成
`js/statgen.js` 強さ生成 / `js/rules.js` ルール / `js/ai.js` CPU（以上DOMなし、Nodeでテスト）/ `js/capture.js` カメラ・表紙検出・射影補正・OCR / `js/cardview.js` カード描画 / `js/summon.js` 召喚演出 / `js/db.js` / `js/app.js` 画面

## テスト
```
node --test tests/            # 単体テスト
node tests/sim.js 200         # CPU同士の対戦シミュレーション
python3 tests/make_covers.py  # テスト用の架空の表紙・撮影画像を生成
node tests/browser-e2e.js     # headless Chrome（:8811で配信して実行）
```
OCR: Tesseract.js（Apache-2.0）、言語データ（Apache-2.0）。vendor/tesseract/NOTICE.txt 参照。
