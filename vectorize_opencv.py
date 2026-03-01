import sys
import json
from pathlib import Path

import cv2
import numpy as np


def main() -> None:
    """
    使用 OpenCV 從黑白圖片中找出外圈與洞，輸出 JSON 給 PHP / 前端使用。

    呼叫方式：
        python vectorize_opencv.py path/to/image.png

    輸出格式：
        {
          "shapes": [
            {
              "outer": [[x, y], ...],
              "holes": [
                [[x, y], ...],
                ...
              ]
            },
            ...
          ]
        }
    """
    if len(sys.argv) < 2:
        print(json.dumps({"error": "no input image"}))
        return

    img_path = Path(sys.argv[1])
    if not img_path.exists():
        print(json.dumps({"error": "image not found"}))
        return

    # 讀圖 → 灰階 → 二值化（假設黑線、白底）
    img = cv2.imread(str(img_path))
    if img is None:
        print(json.dumps({"error": "cannot read image"}))
        return

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 門檻 127 可依實際圖像做微調
    _, thresh = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY_INV)

    # 找輪廓 + 階層（RETR_CCOMP：會把外圈與洞分成不同層級）
    contours, hierarchy = cv2.findContours(
        thresh, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE
    )

    if hierarchy is None:
        print(json.dumps({"shapes": []}))
        return

    hierarchy = hierarchy[0]  # 形如 (N, 4): [next, prev, child, parent]
    shapes = []

    for i, cnt in enumerate(contours):
        h = hierarchy[i]
        parent_idx = h[3]

        # parent_idx == -1 表示這是一個「最外層」輪廓（外圈）
        if parent_idx != -1:
            continue

        # 取得外圈座標
        outer = cnt.squeeze(axis=1).tolist()

        # 找出所有以它為 parent 的洞
        holes = []
        child_idx = h[2]
        while child_idx != -1:
            child_cnt = contours[child_idx]
            hole = child_cnt.squeeze(axis=1).tolist()
            holes.append(hole)
            # 兄弟節點
            child_idx = hierarchy[child_idx][0]

        shapes.append(
            {
                "outer": outer,  # [[x, y], ...]
                "holes": holes,  # [ [[x,y]...], [[x,y]...] ... ]
            }
        )

    print(json.dumps({"shapes": shapes}))


if __name__ == "__main__":
    main()

