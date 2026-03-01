#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Git 常用操作 - 對話式小工具
在專案目錄下執行：python git_helper.py
僅使用 Python 內建模組，無需 pip 安裝。
"""

import os
import subprocess
import sys

# Windows 下讓終端正確顯示中文
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


def run_git(args, capture=True, cwd=None):
    """執行 git 指令，回傳 (成功與否, 輸出文字)。"""
    cwd = cwd or os.getcwd()
    cmd = ["git"] + args
    try:
        r = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=capture,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        out = (r.stdout or "") + (r.stderr or "")
        return (r.returncode == 0, out.strip())
    except FileNotFoundError:
        return False, "錯誤：找不到 git，請先安裝 Git 並確認已加入 PATH。"
    except Exception as e:
        return False, str(e)


def is_git_repo():
    """目前目錄是否為 Git 儲存庫。"""
    ok, _ = run_git(["rev-parse", "--git-dir"], capture=True)
    return ok


def show_output(ok, out):
    """印出指令結果，無輸出時也換行。"""
    print(out if out else "(無輸出)")
    if not ok:
        print("\n[ 上述指令執行失敗 ]")


def input_default(prompt, default=""):
    """帶預設值的輸入，直接 Enter 用預設。"""
    if default:
        s = input(f"{prompt} [{default}]: ").strip()
        return s if s else default
    return input(f"{prompt}: ").strip()


def yes_no(prompt, default_no=False):
    """是/否選擇。"""
    d = "y/N" if default_no else "Y/n"
    a = input(f"{prompt} ({d}): ").strip().lower()
    if not a:
        return not default_no
    return a in ("y", "yes", "是")


def menu_status():
    print("\n--- 查看狀態 (git status) ---")
    ok, out = run_git(["status"])
    show_output(ok, out)


def menu_add():
    print("\n--- 加入暫存區 (git add) ---")
    print("輸入要加入的檔案或目錄，多個用空白分隔；輸入 . 代表全部。")
    s = input("檔案/目錄: ").strip()
    if not s:
        print("已取消。")
        return
    parts = s.split()
    ok, out = run_git(["add"] + parts)
    show_output(ok, out)


def menu_commit():
    print("\n--- 提交版本 (git commit) ---")
    msg = input_default("Commit 訊息", "更新")
    if not msg:
        print("已取消。")
        return
    ok, out = run_git(["commit", "-m", msg])
    show_output(ok, out)


def menu_log():
    print("\n--- 最近提交紀錄 (git log --oneline) ---")
    n = input_default("顯示筆數", "20")
    try:
        n = int(n)
    except ValueError:
        n = 20
    ok, out = run_git(["log", "--oneline", "-n", str(n)])
    show_output(ok, out)


def menu_branch():
    print("\n--- 分支操作 ---")
    print("1) 列出分支  2) 建立並切換到新分支  3) 切換分支  4) 合併分支到目前  5) 刪除分支")
    c = input("請選擇 (1-5): ").strip()
    if c == "1":
        ok, out = run_git(["branch", "-a"])
        show_output(ok, out)
    elif c == "2":
        name = input("新分支名稱 (例如 feature/xxx): ").strip()
        if not name:
            print("已取消。")
            return
        ok, out = run_git(["switch", "-c", name])
        show_output(ok, out)
    elif c == "3":
        ok, out = run_git(["branch"])
        if not ok:
            show_output(ok, out)
            return
        print(out)
        name = input("要切換的分支名稱: ").strip()
        if not name:
            print("已取消。")
            return
        ok, out = run_git(["switch", name])
        show_output(ok, out)
    elif c == "4":
        ok, out = run_git(["branch"])
        if not ok:
            show_output(ok, out)
            return
        print("目前分支：")
        print(out)
        name = input("要合併進來的分支名稱: ").strip()
        if not name:
            print("已取消。")
            return
        if not yes_no(f"確定要將 {name} 合併到目前分支？", default_no=True):
            print("已取消。")
            return
        ok, out = run_git(["merge", name])
        show_output(ok, out)
    elif c == "5":
        ok, out = run_git(["branch"])
        if not ok:
            show_output(ok, out)
            return
        print(out)
        name = input("要刪除的分支名稱: ").strip()
        if not name:
            print("已取消。")
            return
        if not yes_no(f"確定刪除分支 {name}？", default_no=True):
            print("已取消。")
            return
        ok, out = run_git(["branch", "-d", name])
        show_output(ok, out)
    else:
        print("無效選項。")


def menu_pull():
    print("\n--- 從遠端拉回 (git pull) ---")
    ok, out = run_git(["pull"])
    show_output(ok, out)


def menu_push():
    print("\n--- 推送到遠端 (git push) ---")
    branch = input_default("分支名稱（直接 Enter 用目前分支）", "")
    args = ["push"]
    if branch:
        args.extend(["-u", "origin", branch])
    ok, out = run_git(args)
    show_output(ok, out)


def menu_stash():
    print("\n--- 暫存工作 (git stash) ---")
    print("1) 暫存目前修改 (stash)  2) 取回暫存 (stash pop)  3) 列出暫存清單")
    c = input("請選擇 (1-3): ").strip()
    if c == "1":
        msg = input_default("暫存說明（選填）", "")
        args = ["stash", "push"]
        if msg:
            args.extend(["-m", msg])
        ok, out = run_git(args)
        show_output(ok, out)
    elif c == "2":
        ok, out = run_git(["stash", "pop"])
        show_output(ok, out)
    elif c == "3":
        ok, out = run_git(["stash", "list"])
        show_output(ok, out)
    else:
        print("無效選項。")


def menu_remote():
    print("\n--- 遠端 (remote) ---")
    print("1) 列出遠端  2) 新增遠端 (origin)")
    c = input("請選擇 (1-2): ").strip()
    if c == "1":
        ok, out = run_git(["remote", "-v"])
        show_output(ok, out)
    elif c == "2":
        url = input("遠端 URL (例如 https://github.com/帳號/repo.git): ").strip()
        if not url:
            print("已取消。")
            return
        name = input_default("遠端名稱", "origin")
        ok, out = run_git(["remote", "add", name, url])
        show_output(ok, out)
    else:
        print("無效選項。")


def menu_restore():
    print("\n--- 還原檔案 (git restore) ---")
    ok, out = run_git(["status", "--short"])
    if not ok:
        show_output(ok, out)
        return
    if out:
        print("目前有變更的檔案：")
        print(out)
    else:
        print("目前沒有可還原的變更。")
        return
    path = input("要還原的檔案路徑（輸入 . 還原全部）: ").strip()
    if not path:
        print("已取消。")
        return
    if path == "." and not yes_no("確定還原所有已修改檔案？", default_no=True):
        print("已取消。")
        return
    ok, out = run_git(["restore", path])
    show_output(ok, out)


def menu_version_restore():
    """版本回復：依過去的 commit 還原單一檔案，或將整個專案重置到該版本。"""
    print("\n--- 版本回復（回到過去的 commit）---")
    ok, out = run_git(["log", "--oneline", "-n", "30"])
    if not ok:
        show_output(ok, out)
        return
    if not out:
        print("尚無任何 commit，無法回復版本。")
        return
    lines = out.strip().split("\n")
    print("最近 30 筆 commit（越上面越新）：")
    for i, line in enumerate(lines, 1):
        print(f"  {i:2}) {line}")
    print("\n1) 只還原「某個檔案」到指定版本的內容（不影響其他檔案與歷史）")
    print("2) 整個專案重置到指定版本（會丟棄該版本之後的 commit 與未提交的修改，請謹慎）")
    c = input("請選擇 (1 或 2): ").strip()
    if c not in ("1", "2"):
        print("已取消。")
        return
    commit_input = input("請輸入要回復的版本（輸入上表編號 1-{} 或貼上 commit 前幾碼）: ".format(len(lines))).strip()
    if not commit_input:
        print("已取消。")
        return
    commit_ref = commit_input
    if commit_input.isdigit():
        idx = int(commit_input)
        if 1 <= idx <= len(lines):
            commit_ref = lines[idx - 1].split()[0]
        else:
            print("編號超出範圍。")
            return
    if c == "1":
        path = input("要還原的檔案路徑（例如 app.js）: ").strip()
        if not path:
            print("已取消。")
            return
        ok, out = run_git(["restore", "--source", commit_ref, "--", path])
        show_output(ok, out)
        if ok:
            print("該檔案已還原為該版本的內容，請檢查後可再 commit。")
    else:
        print("警告：即將執行 git reset --hard，會導致：")
        print("  - 目前分支指向所選的 commit，之後的 commit 將不再出現在此分支；")
        print("  - 工作目錄與暫存區都會被還原成該版本狀態，未提交的修改會全部消失。")
        if not yes_no("確定要將整個專案重置到上述版本？", default_no=True):
            print("已取消。")
            return
        ok, out = run_git(["reset", "--hard", commit_ref])
        show_output(ok, out)


def menu_diff():
    print("\n--- 查看差異 (git diff) ---")
    print("1) 工作區 vs 暫存區  2) 暫存區 vs 最後 commit")
    c = input("請選擇 (1-2): ").strip()
    if c == "1":
        ok, out = run_git(["diff"])
    elif c == "2":
        ok, out = run_git(["diff", "--staged"])
    else:
        print("無效選項。")
        return
    show_output(ok, out)


def menu_untrack():
    print("\n--- 從版控移除但保留檔案 (git rm --cached) ---")
    print("常用於把某資料夾加入 .gitignore 後，讓 Git 不再追蹤該資料夾。")
    path = input("要移除追蹤的檔案或目錄 (例如 uploads 或 uploads/): ").strip()
    if not path:
        print("已取消。")
        return
    if not yes_no(f"確定讓 Git 不再追蹤「{path}」？（本機檔案會保留）", default_no=True):
        print("已取消。")
        return
    ok, out = run_git(["rm", "-r", "--cached", path])
    show_output(ok, out)
    if ok:
        print("\n請記得執行一次 commit 才會生效。")


def menu_init():
    print("\n--- 初始化 Git 儲存庫 (git init) ---")
    if is_git_repo():
        print("目前目錄已經是 Git 儲存庫。")
        return
    if not yes_no("要在目前目錄建立新的 Git 儲存庫？"):
        print("已取消。")
        return
    ok, out = run_git(["init"])
    show_output(ok, out)


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    root = os.getcwd()

    print("=" * 50)
    print("  Git 常用操作 - 對話式小工具")
    print("  專案目錄:", root)
    print("=" * 50)

    if not is_git_repo():
        print("\n目前目錄尚非 Git 儲存庫。可選 13) 初始化。")

    actions = [
        ("查看狀態 (status)", menu_status),
        ("加入暫存 (add)", menu_add),
        ("提交版本 (commit)", menu_commit),
        ("最近紀錄 (log)", menu_log),
        ("分支 (branch/switch/merge)", menu_branch),
        ("從遠端拉回 (pull)", menu_pull),
        ("推送到遠端 (push)", menu_push),
        ("暫存工作 (stash)", menu_stash),
        ("遠端設定 (remote)", menu_remote),
        ("還原檔案 (restore)", menu_restore),
        ("版本回復 (依 commit 還原/重置)", menu_version_restore),
        ("查看差異 (diff)", menu_diff),
        ("移除追蹤但保留檔案 (rm --cached)", menu_untrack),
        ("初始化儲存庫 (init)", menu_init),
    ]

    while True:
        print("\n--- 請選擇操作 ---")
        for i, (label, _) in enumerate(actions, 1):
            print(f"  {i:2}) {label}")
        print("  0) 結束")
        choice = input("\n輸入選項 (0-{}): ".format(len(actions))).strip()
        if choice == "0":
            print("再見。")
            break
        try:
            idx = int(choice)
            if 1 <= idx <= len(actions):
                actions[idx - 1][1]()
            else:
                print("無效選項。")
        except ValueError:
            print("請輸入數字。")


if __name__ == "__main__":
    main()
