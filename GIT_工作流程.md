# Git 工作流程說明（2D 轉 3D 專案）

本文件說明如何用 Git 管理此專案：包含 `.gitignore` 設計、何時開分支、怎麼寫 commit、以及日常操作步驟。

---

## 一、.gitignore 設計說明1

專案根目錄已有 `.gitignore`，目前會忽略：

| 忽略項目 | 說明 |
|----------|------|
| **uploads/** | 使用者上傳的 STL / SVG / JSON。不納入版控可避免每台機器內容不同、體積膨脹；程式會自動建立此資料夾。 |
| **Thumbs.db、Desktop.ini** | Windows 產生的系統檔。 |
| **.vscode/、.cursor/** | 編輯器設定（若不想與他人共用）。 |
| ***.tmp、*.bak、*~** | 暫存與備份檔。 |
| **vendor/、.env** | 若未來使用 Composer 或環境變數，避免把依賴與機密提交。 |

**重要**：若 `uploads/` 已被 Git 追蹤過，需先從索引移除（不刪實體檔案）：

```bash
git rm -r --cached uploads
git commit -m "chore: 將 uploads/ 加入 .gitignore，不再追蹤"
```

之後 `uploads/` 就不會再被 commit，本機檔案仍會保留。

---

## 二、分支策略與開分支時機

- **main（或 master）**：穩定、可隨時部署的版本。
- **功能分支**：開發新功能或較大改動時使用，完成後再合併回 main。

### 什麼時候開新分支？

| 情境 | 建議做法 |
|------|----------|
| 修一個小 bug、改一句文案 | 直接在 main 上改，commit 即可。 |
| 新增「一整個功能」（例如：登入、新頁面） | 開分支，例如 `feature/登入功能`，做完再合併。 |
| 嘗試實驗性改動、怕搞壞 main | 開分支，例如 `experiment/新UI`，不滿意就丟棄。 |
| 要 release、上線前最後整理 | 可開 `release/1.0`（可選，本專案若一人開發可先不做）。 |

### 分支命名建議

- 功能：`feature/簡短描述`，例：`feature/gallery-filter`
- 修 bug：`fix/簡短描述`，例：`fix/upload-name-encoding`
- 實驗：`experiment/簡短描述`

---

## 三、Commit 訊息撰寫建議

建議用「前綴 + 簡短說明」的格式，方便之後用 `git log` 搜尋：

| 前綴 | 用途 | 範例 |
|------|------|------|
| **feat:** | 新功能 | `feat: 新增作品名稱輸入與上傳參數` |
| **fix:** | 修 bug | `fix: 修正畫廊在無 SVG 時無法顯示標題` |
| **docs:** | 只改文件 | `docs: 更新 XAMPP 使用說明` |
| **style:** | 程式碼格式（不影響行為） | `style: 統一縮排為 4 空格` |
| **refactor:** | 重構（不新增功能也不修 bug） | `refactor: 抽出 SVG 產生邏輯到獨立函式` |
| **chore:** | 雜項（如 .gitignore、建置設定） | `chore: 將 uploads/ 加入 .gitignore` |

**範例：**

```bash
git commit -m "feat: 新增作品名稱輸入與畫廊顯示 designName"
git commit -m "fix: 裁切後筆畫粗細異常"
git commit -m "docs: 新增 GIT 工作流程說明"
```

---

## 四、日常操作步驟（照著做即可）

### 第一次在本機使用（已完成可略過）

```bash
# 1. 進入專案目錄（PowerShell 或 Cmd）
cd c:\xampp\htdocs\trial

# 2. 若尚未設定過 Git 使用者（只需做一次）
git config --global user.name "你的名字"
git config --global user.email "你的Email@example.com"

# 3. 若尚未初始化（專案已有 .git 可略過）
git init
```

### 每次改完程式、要存成一個版本時

```bash
cd c:\xampp\htdocs\trial

# 1. 看哪些檔案被改動
git status

# 2. 把要提交的檔案加入暫存區（可多次 add 再一起 commit）
git add app.js
git add index.html
# 或一次加所有已修改的程式檔（不會加 .gitignore 裡的）
git add .

# 3. 提交一個版本，並寫清楚這次改什麼
git commit -m "feat: 新增作品名稱輸入與上傳參數"

# 4. 若有使用遠端（如 GitHub），推上去
git push
```

### 要開發新功能、想獨立一條線時

```bash
# 1. 確認目前在 main 且工作區是乾淨的（已 commit 或 stash）
git status
git switch main

# 2. 開新分支並切過去
git switch -c feature/新功能名稱

# 3. 正常修改、add、commit
# ... 改程式 ...
git add .
git commit -m "feat: 新功能描述"

# 4. 做完後切回 main 並合併
git switch main
git merge feature/新功能名稱

# 5. 若不再需要該分支可刪除
git branch -d feature/新功能名稱

# 6. 若有遠端就推送
git push
```

### 從遠端拉回最新（多人或換電腦時）

```bash
cd c:\xampp\htdocs\trial
git pull
```

---

## 五、建議的第一次完整流程（本專案）

若你**剛初始化**或**尚未做過第一次 commit**，可照下面做一遍：

```bash
cd c:\xampp\htdocs\trial

# 1. 若 uploads 已被追蹤，先從 Git 移除（不刪本機檔案）
git rm -r --cached uploads
git commit -m "chore: 將 uploads/ 加入 .gitignore，不再追蹤"

# 2. 確認 .gitignore 已存在後，加入所有專案檔
git add .
git status

# 3. 第一次正式提交（若上面已 commit 就從這裡開始）
git add .
git commit -m "chore: 加入 .gitignore 與 GIT 工作流程說明"

# 4. 若已建立 GitHub 等遠端
git remote add origin https://github.com/你的帳號/你的repo.git
git branch -M main
git push -u origin main
```

之後就依「四、日常操作步驟」即可：改完 → `git add` → `git commit -m "..."` → 有遠端就 `git push`。

---

## 六、常用指令速查

| 情境 | 指令 |
|------|------|
| 看狀態 | `git status` |
| 看歷史 | `git log --oneline` |
| 還原某檔案 | `git restore 檔名` |
| 暫存手邊修改 | `git stash` → 做完別的事 → `git stash pop` |
| 開新分支 | `git switch -c feature/名稱` |
| 合併分支 | `git switch main` → `git merge feature/名稱` |
| 拉遠端 | `git pull` |
| 推遠端 | `git push` |

有需要可隨時打開這份 `GIT_工作流程.md` 對照操作。

---

## 七、用 Python 對話式小工具操作 Git（選用）

專案內有 `git_helper.py`，可在專案目錄下執行：

```bash
python git_helper.py
```

以選單方式完成：查看狀態、add、commit、log、分支、pull、push、stash、remote、還原、diff、移除追蹤、初始化等常用操作，無需背指令。僅使用 Python 內建模組，不需 pip 安裝。

---

## 八、前端（React）UI 美化與互動建議（選用）

若你在本專案中有使用 React 建前端，建議在「React 專案根目錄」另外建立一個子專案（例如 `frontend/`），並在該資料夾內安裝前端依賴。以下以常見的做法整理幾個建議組合，你可以選一個主路線：

### 1. 使用 UI 元件庫（快速變漂亮）

- **推薦組合（其一即可）**：
  - **MUI**（Material UI）：現代、文件多，適合後台介面、控制台、表單較多的情境。
  - **Ant Design**：偏企業級風格，表格、表單元件很完整。
  - **Chakra UI**：語法簡潔、深色模式好開、客製化彈性高。

> 下方以 MUI 為例，其他元件庫安裝方式大同小異。

```bash
cd path\to\your-react-app

# 安裝 MUI 及其樣式依賴
npm install @mui/material @emotion/react @emotion/styled
# 若需要圖示
npm install @mui/icons-material
```

React 中即可直接使用：

```tsx
import Button from '@mui/material/Button';

export function Example() {
  return (
    <Button variant="contained" color="primary">
      儲存設定
    </Button>
  );
}
```

### 2. 使用 Tailwind CSS 做版型（實用、可與元件庫並用）

若你偏好「原子化 class」來控制排版與間距，可以在 React 專案中加入 Tailwind。不同建構工具（Create React App、Vite、Next.js）設定略有差異，官方文件都有一步一步教學，這裡只列出大致流程（以 Vite 為例）：

```bash
cd path\to\your-react-app

# 安裝 Tailwind、PostCSS、Autoprefixer
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

接著在 `tailwind.config.js` 設定 `content` 指向你的 React 檔案，並在 `src/index.css`（或全域樣式檔）加入：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

之後即可在 React 元件中使用：

```tsx
export function Card({ title, children }) {
  return (
    <div className="rounded-2xl bg-slate-900/90 border border-slate-700/80 p-4 shadow-lg">
      <h2 className="text-lg font-semibold text-slate-50 mb-2">{title}</h2>
      <div className="text-sm text-slate-300">{children}</div>
    </div>
  );
}
```

### 3. 加上互動與動畫（Framer Motion）

若希望畫面有順暢的進場、Hover、切換動畫，可以在 React 中加入 Framer Motion：

```bash
cd path\to\your-react-app
npm install framer-motion
```

簡單使用範例：

```tsx
import { motion } from 'framer-motion';

export function AnimatedPanel({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl bg-slate-900/90 border border-slate-700/80 p-4"
    >
      {children}
    </motion.div>
  );
}
```

### 4. 建議的實際搭配

- **若你想要「最快看起來有質感」**：
  - 先選一套 UI 元件庫（例如 **MUI**），用它的 `AppBar / Button / Card / Dialog` 重構主要頁面。
  - 之後再視需要在特定區塊加入 Framer Motion 做進場／切換動畫。
- **若你對 CSS 舒服且喜歡自己排版**：
  - 在 React 專案加入 **Tailwind CSS**，自己設計版型與色系，再搭配 Framer Motion。

未來若你告訴「React 專案資料夾路徑」及「想先美化的頁面檔案名稱」，可以依照這份說明直接幫你改那個頁面的程式碼。
