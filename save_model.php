<?php
/**
 * save_model.php
 *
 * 功能說明：
 *   負責接收前端透過 POST 傳送的 STL 模型資料，並將資料存入公共資料夾 uploads/。
 *   此腳本為「2D 轉 3D 模型」網頁應用程式之後端，用於打造多人共享的公共畫廊 (Public Gallery)。
 *
 * 接收參數：
 *   - stlData     (必填)：字串格式的 STL 模型資料，由前端產生並 POST 至此端點。
 *   - svgData     (選填)：若前端一併傳送 SVG 字串，則會以同檔名儲存為 .svg。
 *   - pathsData   (選填)：若前端傳送 paths / drawingBBox 的 JSON，則會儲存為 .json。
 *   - designName  (選填)：使用者自訂的作品名稱，將會出現在檔名前綴中。
 *
 * 儲存位置：uploads/（與本腳本同目錄下的 uploads 資料夾）
 * 檔案命名：{設計名稱}_{時間戳記}_{唯一識別碼}.stl，例如 myArt_1680000000_642a1b2c3d4e5.stl，
 *           以避免多人同時上傳時檔名衝突，且方便在畫廊中辨識作品。
 */

// ============================================
// CORS 設定：允許跨網域請求
// ============================================
// 讓來自其他網域的前端（例如本地 XAMPP、未來正式站台）都能呼叫此 API，
// 方便開發測試與跨域部署。正式環境可依需求改為指定網域，例如：
// header("Access-Control-Allow-Origin: https://yourdomain.com");
header("Access-Control-Allow-Origin: *");
header("Content-Type: text/plain; charset=UTF-8");

// ============================================
// 檢查必填參數：stlData
// ============================================
// 若未收到 stlData 或內容為空字串，回傳 400 Bad Request 並結束程式。
if (!isset($_POST['stlData']) || $_POST['stlData'] === '') {
    http_response_code(400);
    echo '錯誤：未收到 stlData 參數，請確認前端有傳送模型資料。';
    exit;
}

// 取得 POST 過來的 STL 字串（必填）
$stlData   = $_POST['stlData'];
// 以下為選填：若前端有傳送則一併儲存，方便畫廊預覽與 G-code 產生
$svgData   = isset($_POST['svgData'])   ? $_POST['svgData']   : null;
$pathsData = isset($_POST['pathsData']) ? $_POST['pathsData'] : null;

// 新增：接收使用者自訂作品名稱並做安全過濾（Sanitize）
// --------------------------------------------
// 原始名稱可能包含空白、斜線、引號等會影響檔案系統的字元，因此必須轉換。
$rawDesignName = isset($_POST['designName']) ? trim($_POST['designName']) : '';

// 將不合法檔名字元（例如 / \ : * ? " < > | 空白 等）以底線取代
// 這裡只允許「各國文字 / 數字 / 底線 / 減號」，其他全部換成底線 _
// \p{L}：任何語言的字母，\p{N}：任何語言的數字
$sanitizedDesignName = preg_replace('/[^\p{L}\p{N}_-]+/u', '_', $rawDesignName);
// 去掉前後多餘的底線，避免出現 __myArt__ 這樣的名稱
$sanitizedDesignName = trim($sanitizedDesignName, '_');

// 若使用者沒填或過濾後為空，統一使用預設名稱 design
if ($sanitizedDesignName === '') {
    $sanitizedDesignName = 'design';
}

// ============================================
// 設定儲存目錄：uploads/
// ============================================
// 使用 __DIR__ 取得本腳本所在目錄的絕對路徑，再拼接 uploads/，作為公共儲存庫。
$uploadDir = __DIR__ . '/uploads/';

// ============================================
// 若 uploads/ 不存在則自動建立，並設定權限為 0777
// ============================================
// 0777 表示所有人可讀寫執行，適合作為多人共享的公共資料夾。
// 若建立失敗（例如權限不足），回傳 500 並結束。
if (!is_dir($uploadDir)) {
    if (!mkdir($uploadDir, 0777, true)) {
        http_response_code(500);
        echo '錯誤：無法建立 uploads 資料夾，請檢查伺服器目錄權限。';
        exit;
    }
}

// ============================================
// 檔案命名：使用「設計名稱 + 時間戳記 + 唯一識別碼」，避免檔名衝突且方便辨識
// ============================================
// time()     ：當前 Unix 時間戳記（秒），例如 1680000000
// uniqid()   ：基於微秒與隨機數的唯一 ID，例如 642a1b2c3d4e5
// 組合範例：myArt_1680000000_642a1b2c3d4e5.stl
$timestamp = time();
$uniqueId  = uniqid();
$fileName  = "{$sanitizedDesignName}_{$timestamp}_{$uniqueId}.stl";
$filePath  = $uploadDir . $fileName;

// 若有儲存 SVG / JSON，使用相同主檔名、不同副檔名
$baseName     = pathinfo($fileName, PATHINFO_FILENAME);
$svgFile      = $baseName . '.svg';
$jsonFile     = $baseName . '.json';
$svgFilePath  = $uploadDir . $svgFile;
$jsonFilePath = $uploadDir . $jsonFile;

// ============================================
// 寫入 STL 檔案
// ============================================
// file_put_contents 成功時回傳寫入的位元組數，失敗時回傳 false。
$written = file_put_contents($filePath, $stlData);

if ($written === false) {
    http_response_code(500);
    echo '錯誤：寫入檔案失敗，請檢查 uploads 資料夾的寫入權限。';
    exit;
}

// ============================================
// 選填：若有提供 svgData，一併寫入 .svg 檔
// ============================================
if ($svgData !== null && $svgData !== '') {
    file_put_contents($svgFilePath, $svgData);
}

// ============================================
// 選填：若有提供 pathsData（JSON），一併寫入 .json 檔
// ============================================
if ($pathsData !== null && $pathsData !== '') {
    file_put_contents($jsonFilePath, $pathsData);
}

// ============================================
// 成功：回傳 200 與純文字訊息，並附上儲存的檔名
// ============================================
http_response_code(200);
echo "儲存成功！主檔案：{$fileName}";
