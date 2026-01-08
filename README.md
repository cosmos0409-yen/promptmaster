# Prompt Master

這是一個基於 AI 的提示詞生成與管理工具，使用 React + Vite 建構，並支援 Firebase 儲存。

## 專案設置 (Setup)

### 1. 安裝依賴 (Install Dependencies)

```bash
npm install
```

### 2. 環境變數設定 (Configuration)

本專案使用 Firebase 服務，請依據 `.env.example` 建立 `.env` 檔案，並填入您的 Firebase 設定。

```bash
cp .env.example .env
```

`.env` 內容範例：
```env
VITE_FIREBASE_API_KEY=AIzr...
VITE_FIREBASE_AUTH_DOMAIN=project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=project-id
VITE_FIREBASE_STORAGE_BUCKET=project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
VITE_APP_ID=default-app-id
```

### 3. 本地開發 (Development)

啟動開發伺服器：

```bash
npm run dev
```

## 部署到 GitHub Pages (Deployment)

本專案已設定好透過 `gh-pages` 部署。

### 步驟：

1. **修改 package.json**
   打開 `package.json`，將 `homepage` 欄位修改為您的 GitHub Pages 網址：
   ```json
   "homepage": "https://<您的GitHub帳號>.github.io/promptmaster"
   ```

2. **推送程式碼到 GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/cosmos0409-yen/promptmaster.git
   ```

3. **執行部署**
   ```bash
   npm run deploy
   ```
   此指令會自動執行 build 並將 `dist` 資料夾推送到 `gh-pages` 分支。

4. **GitHub 設定**
   前往 GitHub Repo 頁面 -> Settings -> Pages，確認 Source 選為 `gh-pages` branch。

## 技術棧 (Tech Stack)

- React 18
- Vite
- Tailwind CSS
- Firebase (Auth, Firestore)
- Lucide React (Icons)
