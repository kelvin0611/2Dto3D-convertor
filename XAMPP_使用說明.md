# 使用 XAMPP 啟動伺服器與測試上傳

## 一、用 XAMPP 啟動伺服器

### 1. 放置專案
把整個 `trial` 資料夾複製到 XAMPP 的網站根目錄：

- **Windows**：`C:\xampp\htdocs\trial`
- 也就是讓 `index.html`、`app.js`、`save_model.php`、`fetch_designs.php` 都在 `C:\xampp\htdocs\trial\` 底下。

### 2. 啟動 Apache
1. 開啟 **XAMPP Control Panel**
2. 在 **Apache** 那一行按 **Start**
3. 狀態變成綠色的 **Running** 即表示伺服器已啟動

### 3. 開啟網頁
在瀏覽器網址列輸入：

```
http://localhost/trial/
```

或直接開啟：

```
http://localhost/trial/index.html
```

即可使用你的 2D 轉 3D 應用。

---

## 二、測試檔案是否成功上傳到伺服器

### 方法 A：看網頁彈窗（最直接）
1. 在網頁上畫好 2D、轉成 3D 後，按 **「上傳到伺服器」**（或對應的上傳按鈕）
2. 若成功，會跳出 **「伺服器回應：儲存成功！檔名：design_xxxxx_xxxxx.stl」**
3. 若失敗，會出現 **「上傳失敗，請確定你的 XAMPP 伺服器有開啟！」** 或錯誤訊息

### 方法 B：檢查 uploads 資料夾
- 上傳成功後，STL 會存在：`C:\xampp\htdocs\trial\uploads\`
- 檔名格式：`design_時間戳記_唯一ID.stl`
- 直接到該資料夾看是否有新產生的 `.stl` 檔案，即可確認是否成功提交

### 方法 C：用 API 看已上傳清單
在瀏覽器開啟：

```
http://localhost/trial/fetch_designs.php
```

會回傳 JSON，列出 `uploads/` 裡所有 `.stl` 的路徑，例如：

```json
["uploads/design_1730000000_abc123.stl", ...]
```

可確認檔案是否已被伺服器記錄。

---

## 三、下載與編輯已上傳的檔案

### 下載
- **從資料夾**：到 `C:\xampp\htdocs\trial\uploads\` 直接複製需要的 `.stl` 到電腦其他位置
- **從瀏覽器**：在網址列輸入（把檔名換成實際檔名）  
  `http://localhost/trial/uploads/design_xxxxx_xxxxx.stl`  
  瀏覽器會下載該 STL 檔

### 編輯
- 用 3D 軟體開啟 STL（例如 Blender、MeshLab、Tinkercad、Cura 等）即可編輯或列印。

---

## 四、常見問題

| 狀況 | 可能原因 | 處理方式 |
|------|----------|----------|
| 上傳按下去沒反應或失敗 | Apache 沒開 | 在 XAMPP 中啟動 Apache |
| 上傳失敗 | 專案沒放在 htdocs | 確認路徑為 `C:\xampp\htdocs\trial\` |
| 出現「未收到 stlData」 | 前端沒正確送出 | 確認是從 `http://localhost/trial/` 開啟頁面，不要用 file:// 開 |
| 出現「無法建立/寫入 uploads」 | 權限不足 | 手動在 `trial` 下建立 `uploads` 資料夾，並確認 Apache/PHP 有寫入權限 |

---

**總結**：用 XAMPP 啟動 Apache → 從 `http://localhost/trial/` 開啟網頁 → 上傳後看彈窗訊息與 `uploads` 資料夾（或 `fetch_designs.php`）確認 → 到 `uploads` 或透過網址下載 STL 後用 3D 軟體編輯。
