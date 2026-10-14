完整網站上傳包｜2026-10-14

1. 先備份你的 GitHub repository。
2. 將此 ZIP 解壓；把內容合併到網站根目錄，index.html 與 shared、pool、assets、exhibits 同一層。不要額外包在一層新資料夾。
3. 不必刪除原網站的其他檔案；保留 CNAME、.github、Git 設定。
4. GitHub Desktop：Commit to main → Push origin，等待 Pages 部署完成。
5. Chrome 按 Ctrl+F5，從首頁進入展廳。工作台網址：/workbench.html。

本機測試：雙擊「開始本機預覽.bat」，保持 PowerShell 視窗開啟。不要直接用 file:// 開 HTML。

內容：首頁、10筆預設展廳清單、展廳 HTML、工作台、共用引擎、pool、assets 與 360view。
限制：僅包含目前網站原始碼與預設資料；你瀏覽器內新增的 Hex18 等展廳不會自動同步。需由原工作台匯出更新 ZIP，再合併到此包／repository。
本包未經實際 WebGL 瀏覽器畫面驗證；已檢查本機檔案引用與 ZIP 完整性。
