import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiService, type NewsItem } from "./ApiService";
import "./App.css";

const categories = ["金融", "國際情勢", "科技", "AI"];

export default function App() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeCategory, setActiveCategory] = useState("科技");
  const [currentView, setCurrentView] = useState<"home" | "saved">("home");

  // 首頁即時新聞
  const { data: homeNews = [], isLoading: isLoadingHome, isError: isErrorHome } = useQuery({
    queryKey: ["newsList", activeCategory],
    queryFn: () => ApiService.fetchNews(activeCategory),
    refetchInterval: Number(import.meta.env.VITE_REFRESH_INTERVAL) || 60000,
    // @ts-ignore
    refetchOnWindowFocus: false,
    enabled: currentView === "home",
  });

  // 收藏的新聞
  const { data: savedNews = [], isLoading: isLoadingSaved, isError: isErrorSaved } = useQuery({
    queryKey: ["savedNews", userId],
    queryFn: () => ApiService.fetchSavedNews(userId),
    refetchOnWindowFocus: false,
    enabled: currentView === "saved" && isLoggedIn,
  });

  // 用戶行為操作
  const actionMutation = useMutation({
    mutationFn: (args: { news: NewsItem; type: "share" | "save" | "unsave" | "read" }) =>
      ApiService.logAction(userId, args.news, args.type),
    onSuccess: (_, args) => {
      // 收藏或取消收藏後立刻刷新狀態讓畫面即時更新
      if (args.type === "save" || args.type === "unsave") {
        queryClient.invalidateQueries({ queryKey: ["savedNews", userId] });
      }
    }
  });

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (userId.trim()) setIsLoggedIn(true);
  };

  const handleAction = (news: NewsItem, type: "share" | "save" | "unsave" | "read") => {
    actionMutation.mutate({ news, type });
  };

  const handleShare = async (news: NewsItem) => {
    try {
      await navigator.clipboard.writeText(news.sourceUrl);
      alert("✅ 已複製新聞連結！");
      handleAction(news, "share");
    } catch (err) {
      console.error(err);
    }
  };

  const handleCardClick = (news: NewsItem, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.vote-buttons')) return;
    
    handleAction(news, "read");
    window.open(news.sourceUrl, "_blank");
  };

  if (!isLoggedIn) {
    return (
      <div className="login-overlay">
        <div className="login-box dialog-glass">
          <h1>GLOBAL TECH NEWS</h1>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="請輸入您的 ID..."
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
            />
            <button type="submit">進入控制台</button>
          </form>
        </div>
      </div>
    );
  }

  const displayedNews = currentView === "home" ? homeNews : savedNews;
  const isLoading = currentView === "home" ? isLoadingHome : isLoadingSaved;
  const isError = currentView === "home" ? isErrorHome : isErrorSaved;

  return (
    <div className="dashboard-container dark-theme">
      <header className="news-header">
        <div className="live-badge">LIVE</div>
        
        {/* 全新頂部頁籤切換 */}
        <nav className="nav-tabs">
          <button 
            className={`tab-btn ${currentView === "home" ? "active" : ""}`}
            onClick={() => setCurrentView("home")}
          >
            首頁快訊
          </button>
          <button 
            className={`tab-btn ${currentView === "saved" ? "active" : ""}`}
            onClick={() => setCurrentView("saved")}
          >
            我的收藏
          </button>
        </nav>

        {currentView === "home" && (
          <div className="category-filters">
            {categories.map(cat => (
              <button 
                key={cat} 
                className={`cat-btn ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
        
        <div style={{flexGrow: 1}}></div>
        <div className="user-id">ID: {userId}</div>
      </header>

      <main className="news-grid">
        {isLoading && !displayedNews.length ? (
          <div className="loading-spinner">載入中，請稍候...</div>
        ) : isError ? (
          <div className="error-message">訊號中斷，請確認您的 API 網址是否已在 .env 設定。</div>
        ) : displayedNews.length === 0 ? (
          <div className="loading-spinner">尚未有任何內容喔！</div>
        ) : (
          displayedNews.slice(0, 100).map((news) => {
            // 確認目前此新聞是否在已收藏清單 (若是 Saved View 畫面本身一定收藏)
            const isSaved = currentView === "saved" || savedNews.some(sn => sn.id === news.id);

            return (
              <article key={news.id} className="news-card" onClick={(e) => handleCardClick(news, e)}>
                <div className="news-image-wrapper">
                  <img 
                    src={news.imageUrl} 
                    alt={news.title}
                    className="card-img"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.src.includes('picsum.photos')) {
                        target.src = `https://picsum.photos/seed/${news.id.replace(/\W/g, '') || Math.random()}/800/400`;
                      }
                    }}
                  />
                  <div className="image-overlay"></div>
                  <span className="category-tag">{news.category}</span>
                </div>
                
                <div className="news-content">
                  <h2 className="news-title">{news.title}</h2>
                  <p className="news-summary">{news.summary}</p>
                  
                  <div className="news-actions">
                    <span className="click-hint">點擊卡片閱讀全文</span>
                    <div className="vote-buttons">
                      <button 
                        onClick={() => handleShare(news)}
                        disabled={actionMutation.isPending}
                        className="btn-share"
                      >
                        🔗 分享
                      </button>
                      
                      {isSaved ? (
                        <button 
                          onClick={() => handleAction(news, "unsave")}
                          disabled={actionMutation.isPending}
                          className="btn-saved-active"
                        >
                          ❌ 取消收藏
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleAction(news, "save")}
                          disabled={actionMutation.isPending}
                          className="btn-save"
                        >
                          ⭐ 加入收藏
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </main>
    </div>
  );
}
