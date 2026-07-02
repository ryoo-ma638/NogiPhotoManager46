# NogiPhotoManager46

弓木奈於さんの生写真コレクションの所有状況を管理するための、個人用Webアプリ（PWA）。

## できること（開発中）
- 生写真セットを「持っている / 持っていない」で1枚ごとに管理
- バインダー・年ごとの収集進捗の可視化
- セット名での検索・未所有の絞り込み
- 所有データのバックアップ / 復元

所有データは端末内にのみ保存され、外部には送信されません。

## 技術構成
Vite + React + TypeScript + Tailwind CSS / IndexedDB (Dexie) / PWA / Vercel

## 開発
```bash
npm install
npm run dev      # 開発サーバ
npm run build    # 本番ビルド
```

設計方針は `開発メモ.md`、実装計画は `task.md` を参照。

## legacy-ios/
以前に試作していたiOS(SwiftUI)版のアーカイブ。現在は開発を停止し、Web版へ移行しています。
