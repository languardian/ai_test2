const GAS_URL = import.meta.env.VITE_GAS_API_URL;

export interface NewsItem {
  id: string;
  date: string;
  category: string;
  title: string;
  summary: string;
  sourceUrl: string;
  imageUrl?: string;
}

const CATEGORY_RSS_MAP: Record<string, string> = {
  "金融": "https://tw.news.yahoo.com/rss/finance",
  "國際情勢": "https://news.google.com/rss/search?q=%E5%9C%8B%E9%9A%9B%E6%96%B0%E8%81%9E&hl=zh-TW&gl=TW&ceid=TW:zh-Hant",
  "科技": "https://tw.news.yahoo.com/rss/technology",
  "AI": "https://news.google.com/rss/search?q=AI+%E7%A7%91%E6%8A%80&hl=zh-TW&gl=TW&ceid=TW:zh-Hant"
};

export const ApiService = {
  fetchNews: async (category: string = "科技"): Promise<NewsItem[]> => {
    const rssUrl = CATEGORY_RSS_MAP[category] || CATEGORY_RSS_MAP["科技"];
    const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`);
    if (!res.ok) throw new Error("Failed to fetch news");
    
    const result = await res.json();
    return result.items.map((item: any, index: number) => {
      let imgUrl = "";
      
      // 擷取 RSS 原生圖片
      if (item.content && item.content.trim().startsWith("http") && !item.content.includes(" ")) {
        imgUrl = item.content.trim();
      } else if (item.content) {
        const srcMatch = item.content.match(/src="([^"]+)"/);
        // 排除掉 google news return 的無效追蹤用小圖
        if (srcMatch && !srcMatch[1].includes("google.com/")) {
          imgUrl = srcMatch[1];
        }
      }
      
      if (!imgUrl && item.thumbnail) {
        imgUrl = item.thumbnail;
      }
      
      // 終極備案
      if (!imgUrl) {
        imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(item.title + " high quality realistic professional journalism photography")}?width=800&height=400&nologo=true`;
      }
      
      return {
        id: item.guid || String(index),
        date: item.pubDate,
        category: category,
        title: item.title,
        summary: item.description.replace(/<[^>]+>/g, '').substring(0, 120) + '...',
        sourceUrl: item.link,
        imageUrl: imgUrl,
      };
    });
  },

  logAction: async (userId: string, news: NewsItem, actionType: "share" | "save" | "unsave" | "read") => {
    if (!GAS_URL) {
      console.log(`[Mock] User ${userId} action ${actionType} on ${news.id}`);
      return new Promise((r) => setTimeout(() => r({ status: 'ok' }), 500));
    }

    const res = await fetch(GAS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8", 
      },
      body: JSON.stringify({
        action: actionType,
        userId,
        newsId: news.id,
        newsData: (actionType === "save") ? news : undefined, // 發送備份資料
        timestamp: new Date().toISOString(),
      }),
    });
    
    if (!res.ok) throw new Error("Failed to log action");
    return res.json();
  },

  fetchSavedNews: async (userId: string): Promise<NewsItem[]> => {
    if (!GAS_URL) return [];
    const res = await fetch(`${GAS_URL}?action=getSavedNews&userId=${encodeURIComponent(userId)}`);
    if (!res.ok) throw new Error("Failed to fetch saved news");
    const result = await res.json();
    return result.data || [];
  }
};
