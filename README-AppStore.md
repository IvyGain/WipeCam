# WipeCam AppStore版

AppStore対応版のWipeCamアプリケーション。Apple Developer Guidelinesに準拠し、Mac App Storeでの配布に対応しています。

![WipeCam AppStore版](assets/icon.png)

## AppStore対応の変更点

### 🚫 削除された機能
- **透明フローティングウィンドウ**: AppStoreでは透明ウィンドウの使用が制限されています
- **グローバルホットキー**: システムレベルのホットキーはAppStoreでは許可されていません
- **常時最前面表示**: AppStoreでは常時最前面表示機能が制限されています
- **MediaPipeライブラリ**: 外部AIライブラリの使用が制限されています

### ✅ 実装された機能
- **通常のウィンドウ**: 標準的なアプリウィンドウ
- **アプリ内ショートカット**: Cmd+S (保存), Cmd+B (背景除去), Cmd+R (カメラ再起動)
- **サンドボックス対応**: AppStoreのセキュリティ要件に準拠
- **簡易背景除去**: WebRTCベースの基本的な背景除去機能
- **プライバシー説明**: カメラ・マイク使用の詳細な説明

## 機能

### 背景除去
- **簡易アルゴリズム**: 緑色背景の検出と除去
- **背景色選択**: 透明、黒、白、緑、青から選択
- **リアルタイム処理**: ブラウザネイティブ機能を使用

### エフェクト
- **なし**: 通常の映像
- **ヴィンテージ**: 暖色系の古い写真風
- **クール**: 青みがかった冷たい印象  
- **ウォーム**: 暖かみのある色調
- **ノワール**: 白黒フィルム風

### アプリ内ショートカット
- `Cmd+S`: 画像保存
- `Cmd+B`: 背景除去のON/OFF
- `Cmd+R`: カメラ再起動

## AppStoreガイドライン対応

### セキュリティ要件
- **サンドボックス**: 完全にサンドボックス化された環境で実行
- **権限最小化**: 必要最小限の権限のみ要求
- **プライバシー保護**: データの外部送信なし

### プライバシー説明
- **カメラ権限**: 背景除去機能のための詳細な説明
- **マイク権限**: 動画録画機能のための詳細な説明
- **データ処理**: デバイス上でのみ処理、外部送信なし

### 技術的制約
- **透明ウィンドウ**: 使用不可（AppStore制限）
- **グローバルホットキー**: 使用不可（AppStore制限）
- **外部ライブラリ**: 制限あり（MediaPipe等）
- **常時最前面**: 使用不可（AppStore制限）

## 開発

### 必要な環境
- Node.js 18+
- pnpm 8+
- Xcode 14+ (AppStore配布用)

### セットアップ
```bash
# 依存関係のインストール
pnpm install

# AppStore版の開発モードで実行
pnpm dev:appstore

# テスト実行
pnpm test

# AppStore版のビルド
pnpm build:appstore
```

### AppStore版ビルド
```bash
# AppStore版のビルド
pnpm build:appstore

# 配布用パッケージ作成
pnpm dist:appstore
```

## AppStore申請手順

### 1. Apple Developer Program登録
- Apple Developer Programに登録
- 証明書とプロビジョニングプロファイルの作成

### 2. AppStore Connect設定
- AppStore Connectでアプリを作成
- メタデータとスクリーンショットの準備

### 3. アプリの署名
```bash
# 開発用証明書で署名
codesign --force --deep --sign "Developer ID Application: Your Name" WipeCam.app

# AppStore用証明書で署名
codesign --force --deep --sign "3rd Party Mac Developer Application: Your Name" WipeCam.app
```

### 4. アップロード
```bash
# AppStore Connectにアップロード
xcrun altool --upload-app --type osx --file WipeCam.pkg --username "your-email" --password "app-specific-password"
```

## 制限事項

### AppStore制限による機能制限
1. **透明ウィンドウ**: 実装不可
2. **グローバルホットキー**: 実装不可
3. **常時最前面表示**: 実装不可
4. **高度なAI処理**: MediaPipe等の外部ライブラリ使用不可

### 代替実装
1. **背景除去**: WebRTCベースの簡易アルゴリズム
2. **ショートカット**: アプリ内でのCmd+キー組み合わせ
3. **ウィンドウ管理**: 通常のアプリウィンドウ

## ライセンス

MIT License

## 技術スタック

- **Electron**: クロスプラットフォームデスクトップアプリ
- **WebRTC**: ブラウザネイティブの背景除去
- **TypeScript**: 型安全な開発
- **Vitest**: モダンなテストフレームワーク
- **electron-builder**: AppStore対応インストーラー作成

## 貢献

AppStore版への貢献は歓迎します。ただし、AppStoreガイドラインに準拠する必要があります。

## 注意事項

- AppStore版は機能が制限されています
- フル機能版は直接配布で提供されます
- AppStore版はサンドボックス環境で実行されます
- プライバシーとセキュリティが最優先されます 