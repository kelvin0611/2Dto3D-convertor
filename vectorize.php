<?php
header('Content-Type: application/json; charset=utf-8');

try {
    if (empty($_POST['imageData'])) {
        http_response_code(400);
        echo json_encode(['error' => '缺少 imageData']);
        exit;
    }

    // dataURL: "data:image/png;base64,xxxx"
    $data = $_POST['imageData'];
    if (strpos($data, ',') !== false) {
        $data = substr($data, strpos($data, ',') + 1);
    }

    $binary = base64_decode($data);
    if ($binary === false) {
        http_response_code(400);
        echo json_encode(['error' => 'base64 解碼失敗']);
        exit;
    }

    // 存成暫存 PNG（放在專案目錄，路徑簡單、不含中文）
    $tmpFile = __DIR__ . DIRECTORY_SEPARATOR . 'tmp_input_' . uniqid() . '.png';
    file_put_contents($tmpFile, $binary);

    // 呼叫 Python 腳本（已放在 trial 資料夾）
    // 使用已安裝好 OpenCV 的 Python 3.11
    $python = 'C:\\Users\\user\\AppData\\Local\\Programs\\Python\\Python311\\python.exe';
    $script = 'C:\\xampp\\htdocs\\trial\\vectorize_opencv.py';

    // Windows 下用雙引號包路徑，比單引號可靠
    $cmd = '"' . $python . '" "' . $script . '" "' . $tmpFile . '"';
    $output = shell_exec($cmd);

    // 刪掉暫存檔
    @unlink($tmpFile);

    if ($output === null) {
        http_response_code(500);
        echo json_encode(['error' => 'Python 執行失敗，請確認已安裝 Python 及 opencv-python。']);
        exit;
    }

    echo $output;
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

