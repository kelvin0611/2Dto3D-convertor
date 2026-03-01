<?php
/**
 * fetch_designs.php
 *
 * 功能說明：
 *   讀取伺服器上 uploads/ 公共資料夾內所有的 .stl 檔案，並將清單以 JSON 格式回傳給前端。
 *   供「公共畫廊 (Public Gallery)」前端渲染使用，讓所有使用者上傳的作品都能被其他人看見。
 *
 * 回傳格式：JSON 陣列，每個元素為一個物件，包含：
 *   - path        ：檔案相對路徑（給前端下載 / 顯示用）
 *   - fileName    ：完整檔名（含自訂名稱 + 時間戳記 + uniqid）
 *   - designName  ：從檔名解析出的「作品名稱」（不含時間戳記等技術資訊）
 *   - mtime       ：最後修改時間（UNIX timestamp，秒）
 *
 *   範例：
 *   [
 *     {
 *       "path": "uploads/myArt_1680000000_642a1b2c3d4e5.stl",
 *       "fileName": "myArt_1680000000_642a1b2c3d4e5.stl",
 *       "designName": "myArt",
 *       "mtime": 1680000000
 *     },
 *     ...
 *   ]
 *
 * 排序規則：依檔案最後修改時間降冪排序（最新上傳的創作出現在陣列最前面）。
 *
 * 空值處理：若 uploads/ 不存在或目錄內沒有任何 .stl 檔案，回傳空陣列 []。
 */

// ============================================
// CORS 設定：允許跨網域請求
// ============================================
// 讓前端無論從哪個網域發送請求都能取得畫廊清單，方便本地開發與跨域部署。
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

// ============================================
// 設定要讀取的目錄：uploads/
// ============================================
$uploadDir = __DIR__ . '/uploads/';

// ============================================
// 空值處理：資料夾不存在或無法讀取 → 回傳空 JSON 陣列 []
// ============================================
if (!is_dir($uploadDir) || !is_readable($uploadDir)) {
    echo json_encode([], JSON_UNESCAPED_UNICODE);
    exit;
}

// ============================================
// 讀取目錄內所有檔案，篩選出副檔名為 .stl 的檔案，並解析出作品名稱
// ============================================
$files = [];
$items = scandir($uploadDir);

foreach ($items as $item) {
    // 跳過 . 、 .. 以及子目錄
    if ($item === '.' || $item === '..') {
        continue;
    }
    $fullPath = $uploadDir . $item;
    // 只處理「檔案」且副檔名為 .stl（不區分大小寫）
    if (
        is_file($fullPath) &&
        strtolower(pathinfo($item, PATHINFO_EXTENSION)) === 'stl'
    ) {
        $baseName = pathinfo($item, PATHINFO_FILENAME);

        // 從檔名中拆出「作品名稱 / 時間戳記 / uniqid」
        // 規則：{designName}_{timestamp}_{uniqid}.stl
        $designNameForUser = $baseName; // 預設整個 baseName
        $parts = explode('_', $baseName);
        if (count($parts) >= 3) {
            $uniqidPart  = array_pop($parts);  // 最右邊：uniqid
            $timestampPart = array_pop($parts); // 倒數第二：時間戳記
            // 剩下的全部視為「作品名稱」，允許裡面包含底線
            $designNameCore = implode('_', $parts);
            if ($designNameCore !== '') {
                // 顯示時可把底線轉成空白，較好閱讀
                $designNameForUser = str_replace('_', ' ', $designNameCore);
            }
        }

        $files[] = [
            'path'       => 'uploads/' . $item,       // 相對路徑，供前端組 URL 使用
            'fileName'   => $item,                    // 完整檔名
            'designName' => $designNameForUser,       // 解析後的作品名稱（給前端顯示）
            'mtime'      => filemtime($fullPath)      // 最後修改時間（用於排序）
        ];
    }
}

// ============================================
// 依檔案最後修改時間降冪排序（最新的排在最前面）
// ============================================
// $b['mtime'] - $a['mtime']：數值大（較新）的排前面。
usort($files, function ($a, $b) {
    return $b['mtime'] - $a['mtime'];
});

// ============================================
// 將排序後的檔案物件陣列輸出為 JSON
// ============================================
// 若沒有 .stl 檔案，$files 為空陣列 []，直接輸出即可。
echo json_encode(array_values($files), JSON_UNESCAPED_UNICODE);
