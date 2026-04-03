# 科技新聞導讀/儀表板 - 後端部署指南 (Google Sheets + Apps Script)

這份指南將協助你建立屬於自己的免費資料庫與 API，用來記錄用戶行為，並支援**完整的收藏與同步機制**。

## 步驟一：建立 Google Sheets 試算表
1. 前往 Google Drive 建立一個新的 Google Sheets 試算表。
2. 將左下角的工作表命名，請務必完全一致：
   - 第一個工作表命名為：`新聞庫`
   - 第二個工作表命名為：`用戶行為`

### 欄位配置 (放在第一列 Row 1)
在 `新聞庫` 工作表的第一列依序輸入（注意這次新增了圖片網址）：
- A1: `序號`
- B1: `日期`
- C1: `分類`
- D1: `標題`
- E1: `內文摘要`
- F1: `來源連結`
- G1: `圖片網址`

在 `用戶行為` 工作表的第一列依序輸入：
- A1: `ID` (用戶識別碼)
- B1: `新聞ID` 
- C1: `操作類型` (share / save / unsave / read)
- D1: `活動記錄時間`

## 步驟二：寫入 Google Apps Script 程式碼
1. 在剛剛那份試算表的頂部選單，點擊 **「擴充功能」 -> 「Apps Script」**。
2. 將編輯器內原本的程式碼清空，**完整貼上**以下全新升級的程式碼（加入收藏查詢與自動入庫）：

```javascript
const SHEET_NEWS = '新聞庫';
const SHEET_USERS = '用戶行為';

// 處理 GET 請求 (取得收藏的內容)
function doGet(e) {
  try {
    const action = e.parameter.action;
    
    // 如果是前端要求撈取用戶的「我的收藏」
    if (action === "getSavedNews") {
      const userId = e.parameter.userId;
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const usersSheet = ss.getSheetByName(SHEET_USERS);
      const newsSheet = ss.getSheetByName(SHEET_NEWS);
      
      // 1. 先找出這位用戶目前處於「收藏(save)」狀態的所有新聞 ID
      const usersData = usersSheet.getDataRange().getValues();
      const savedNewsIds = new Set();
      // usersData: [ID, NewsID, Action, Timestamp]
      for (let i = 1; i < usersData.length; i++) {
        if (String(usersData[i][0]) === String(userId)) {
          const act = usersData[i][2];
          const nid = String(usersData[i][1]);
          if (act === "save") savedNewsIds.add(nid);
          if (act === "unsave") savedNewsIds.delete(nid);
        }
      }
      
      // 2. 根據 ID 去新聞庫把詳細的新聞內容撈出來
      const newsData = newsSheet.getDataRange().getValues();
      const newsList = [];
      for (let i = 1; i < newsData.length; i++) {
        const id = String(newsData[i][0]);
        if (savedNewsIds.has(id)) {
          newsList.push({
            id: id,
            date: newsData[i][1],
            category: newsData[i][2],
            title: newsData[i][3],
            summary: String(newsData[i][4]),
            sourceUrl: newsData[i][5],
            imageUrl: newsData[i][6] || ""
          });
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        data: newsList.reverse() // 後收藏的放前面
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      message: error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// 處理 POST 請求 (記錄用戶行為 & 自動同步新聞)
function doPost(e) {
  try {
    let params;
    // 支援 text/plain 解析以避開 CORS
    if (e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else {
      params = e.parameter;
    }

    const userId = params.userId || "Unknown";
    const newsId = params.newsId || "Unknown";
    const actionType = params.action || "Unknown";
    const timestamp = params.timestamp || new Date().toISOString();

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. 將行為紀錄寫入「用戶行為」供後續追蹤或抵銷計算
    const usersSheet = ss.getSheetByName(SHEET_USERS);
    if (!usersSheet) throw new Error("找不到『用戶行為』工作表");
    usersSheet.appendRow([userId, newsId, actionType, timestamp]);

    // 2. 【方案A實作】：如果用戶按了收藏，則順便把新聞寫入『新聞庫』(如不存在)
    if (actionType === "save" && params.newsData) {
      const newsSheet = ss.getSheetByName(SHEET_NEWS);
      if (!newsSheet) throw new Error("找不到『新聞庫』工作表");
      
      const newsDataList = newsSheet.getDataRange().getValues();
      let exists = false;
      for (let i = 1; i < newsDataList.length; i++) {
        if (String(newsDataList[i][0]) === String(newsId)) {
          exists = true;
          break;
        }
      }
      // 不存在，補進庫存
      if (!exists) {
        const n = params.newsData;
        newsSheet.appendRow([n.id, n.date, n.category, n.title, n.summary, n.sourceUrl, n.imageUrl]);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        message: "Action logged successfully" 
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
        status: "error", 
        message: error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// 攔截 OPTIONS (防 CORS 專用)
function doOptions() {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    });
}
```

## 步驟三：發布API (若已經發布過)
1. 點擊右上角 **「部署」 -> 「管理部署作業」**。
2. 點擊旁邊的鉛筆編輯圖示，然後版本一定要選擇 **「建立新版本」** ，最後點擊部署。
3. （如果是第一次建立，則走原本建立 `網頁應用程式` 並將存取權給予 `所有人` 的流程）。

## 步驟四：回到前端填入環境變數 (本機開發測試)
```env
VITE_GAS_API_URL=https://script.google.com/macros/s/...您的網址.../exec
VITE_NEWS_CATEGORY=科技
VITE_REFRESH_INTERVAL=60000
```


## 步驟五：部署到 GitHub Pages (自動化部署)
本專案已內建 `.github/workflows/deploy.yml` 的 GitHub Actions 自動化腳本。當您將原始碼推送到 GitHub 上的 `main` 或 `master` 分支時，它會安全地替您編譯並發布為網站，而不需要把機密的 GAS URL 寫死在程式碼中。

### 實際部署流程：
1. **前往設定**：在您的 GitHub 儲存庫頁面，點選上方的 **Settings (設定)**。
2. **開啟 GitHub Pages**：在左側導覽列點選 **Pages**，將 **Source** 選項切換為 **GitHub Actions**。
3. **安全注入環境變數**：在左側導覽列找到 **Secrets and variables -> Actions**。
   
   👉 **新增 Secrets (用來存放機密網址)**
   - 點選 `New repository secret` 按鈕
   - Name 填寫：`VITE_GAS_API_URL`
   - Secret 填寫：`https://script.google.com/macros/s/您的網址代碼/exec`

   👉 **新增 Variables (用來存放一般設定，選填)**
   - 點選上方 Variables 標籤，點選 `New repository variable`
   - 可新增 `VITE_NEWS_CATEGORY` (值可填：`科技`、`金融` 等)
   - 可新增 `VITE_REFRESH_INTERVAL` (值可填：`60000` 代表60秒自動回抓)

4. **觸發上線**：環境變數設定好後，回到儲存庫的 **Actions** 頁籤當中手動執行一次 `Deploy to GitHub Pages` 工作流（或您再次 Push 一行程式碼），等待出現綠色勾勾後，GitHub 就會自動把打包好的高質感儀表板呈現上線了！
