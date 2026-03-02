    <?php
    /**
     * fetch_designs_detail.php
     * 讀取 uploads/ 內的檔案組（.stl / .svg / .json），
     * 依同一主檔名（不含副檔名）分組，回傳每組作品的 STL / SVG / JSON 路徑與時間戳，
     * 並解析出「作品名稱」（不含時間戳記與 uniqid）。
     *
     * 檔案命名規則：
     *   {designName}_{timestamp}_{uniqid}.ext
     *   例如：myArt_1680000000_642a1b2c3d4e5.stl
     */

    // CORS 設定（方便本機 / 其他來源存取）
    header("Access-Control-Allow-Origin: *");
    header("Content-Type: application/json; charset=UTF-8");

    // 上傳檔案實際存放在專案根目錄的 uploads/ 中
    $uploadDir = __DIR__ . '/../uploads/';

    if (!is_dir($uploadDir) || !is_readable($uploadDir)) {
        echo json_encode([]);
        exit;
    }

    $items = scandir($uploadDir);
    $designs = [];

    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }

        $fullPath = $uploadDir . $item;
        if (!is_file($fullPath)) {
            continue;
        }

        $ext  = strtolower(pathinfo($item, PATHINFO_EXTENSION));
        $base = pathinfo($item, PATHINFO_FILENAME); // 主檔名（含作品名稱 + 時間戳記 + uniqid）

        if (!isset($designs[$base])) {
            $designs[$base] = [
                'id'         => $base,  // 原始主檔名，作為唯一識別
                'stl'        => null,
                'svg'        => null,
                'json'       => null,
                'mtime'      => 0,      // 該組檔案中最新的修改時間
            ];
        }

        $relPath = 'uploads/' . $item;
        $mtime   = filemtime($fullPath);

        if ($mtime > $designs[$base]['mtime']) {
            $designs[$base]['mtime'] = $mtime;
        }

        if ($ext === 'stl') {
            $designs[$base]['stl'] = $relPath;
        } elseif ($ext === 'svg') {
            $designs[$base]['svg'] = $relPath;
        } elseif ($ext === 'json') {
            $designs[$base]['json'] = $relPath;
        }
    }

    // 將關聯陣列轉為索引陣列並依 mtime 排序（新到舊）
    $result = array_values($designs);
    usort($result, function($a, $b) {
        return $b['mtime'] <=> $a['mtime'];
    });

    // 解析出「作品名稱」與時間戳記，方便前端顯示
    foreach ($result as &$item) {
        $base = $item['id'];
        $parts = explode('_', $base);

        $designNameForUser = $base;
        $timestampPart = null;

        if (count($parts) >= 3) {
            $uniqidPart   = array_pop($parts);   // 最右邊：uniqid
            $timestampRaw = array_pop($parts);   // 倒數第二：時間戳記
            $designNameCore = implode('_', $parts);

            if ($designNameCore !== '') {
                $designNameForUser = str_replace('_', ' ', $designNameCore);
            }

            if (ctype_digit($timestampRaw)) {
                $timestampPart = (int)$timestampRaw;
            }
        }

        $item['designName'] = $designNameForUser;
        if ($timestampPart !== null) {
            $item['timestamp'] = $timestampPart;
        }
    }
    unset($item);

    echo json_encode($result, JSON_UNESCAPED_UNICODE);
