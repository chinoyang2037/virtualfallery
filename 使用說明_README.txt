Virtual Gallery 完整網頁下載包
製作日期：2026-10-21
來源：https://virtual-gallery-workbench.chinoyang2021.chatgpt.site/
版本：48；原始碼版本 fee01cd6ec9bea787d05432ae7033bcdda166382

一、Windows 本機開啟
1. 將 ZIP 全部解壓縮至一個資料夾，保留原有目錄。
2. 雙擊「開始本機預覽.bat」，瀏覽器會開啟 http://127.0.0.1:8765/index.html。
3. 使用期間保留啟動視窗；結束時按 Ctrl+C 或關閉視窗。
4. 若 8765 埠已在使用，先關閉之前啟動的預覽視窗。
請使用本機預覽工具，直接雙擊 HTML 可能受到瀏覽器本機檔案讀取限制。

二、上傳既有網站／GitHub repository
1. 先備份原網站資料。
2. 將本包內的 index.html 及所有資料夾放在同一網站根目錄。
3. 保留 assets、pool、360view、shared、exhibits、viewer、preview-modules、works 的原有相對位置。
4. 使用 GitHub Desktop 時，將檔案解壓縮至目標 repository，再 Commit 及 Push。
5. 如主機設定有自訂網域／CNAME，請保留主機原有設定；本包不包含 DNS 或主機帳號設定。

三、內容
包含目前網站全部 HTML、JavaScript、CSS、展廳、封面、共用圖庫、光電作品、環景、音樂，以及網站內已有的 Excel／CSV。
包含最新「回首頁／Home」按鈕及首頁六秒後蜂鳥隨機導覽。
workbench.html 為展廳工作站；index.html 為網站首頁。
使用者只存在瀏覽器內、尚未匯出或發布的個別設定，不會自動包含在網站下載包。
外部字型、統計服務或外部連結仍需網路；本包完整保留網站本身已儲存的資源。

四、檢查
原始 site-files.json 的 964 項資源均已比對檔案大小，另含 site-files.json 本身，網站檔案合計 965 個。
ZIP 打包後已進行 CRC 完整性檢查。本次未重新進行瀏覽器或 Windows 實機操作測試。
