// Morning Ai Official Website Service Worker
const CACHE_NAME = 'morning-ai-website-v1.0.0';
const STATIC_CACHE_NAME = 'morning-ai-website-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'morning-ai-website-dynamic-v1.0.0';

// 需要緩存的靜態資源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Vite 構建的資源會在運行時動態添加
];

// 需要緩存的頁面路由
const PAGE_ROUTES = [
  '/',
  '/products',
  '/pricing',
  '/about',
  '/contact',
  '/get-started'
];

// 離線頁面HTML
const OFFLINE_PAGE = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Morning Ai - 離線瀏覽</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 0;
      background: linear-gradient(135deg, #FFD700 0%, #FF6B35 100%);
      color: white;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      text-align: center;
    }
    .container {
      max-width: 500px;
      padding: 2rem;
    }
    .logo {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 2rem;
      margin-bottom: 1rem;
      font-weight: 600;
    }
    .tagline {
      font-size: 1.2rem;
      opacity: 0.9;
      margin-bottom: 1.5rem;
      font-style: italic;
    }
    p {
      font-size: 1rem;
      opacity: 0.9;
      line-height: 1.6;
      margin-bottom: 2rem;
    }
    .retry-btn {
      background: rgba(255,255,255,0.2);
      border: 2px solid white;
      color: white;
      padding: 1rem 2rem;
      border-radius: 12px;
      font-size: 1.1rem;
      font-weight: 500;
      cursor: pointer;
      margin-top: 1rem;
      transition: all 0.3s ease;
    }
    .retry-btn:hover {
      background: rgba(255,255,255,0.3);
      transform: translateY(-2px);
    }
    .features {
      background: rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 1.5rem;
      margin-top: 2rem;
      text-align: left;
    }
    .feature-item {
      display: flex;
      align-items: center;
      margin-bottom: 0.8rem;
    }
    .feature-icon {
      margin-right: 0.8rem;
      font-size: 1.2rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">🌅</div>
    <h1>Morning Ai</h1>
    <div class="tagline">Rhythm of smiles, every day.</div>
    <p>您目前處於離線模式。Morning Ai 官方網站的部分內容已緩存，您可以瀏覽基本信息。</p>
    
    <div class="features">
      <div class="feature-item">
        <span class="feature-icon">🤖</span>
        <span>智能AI代理平台</span>
      </div>
      <div class="feature-item">
        <span class="feature-icon">💬</span>
        <span>24/7 智能客服</span>
      </div>
      <div class="feature-item">
        <span class="feature-icon">📊</span>
        <span>數據分析洞察</span>
      </div>
      <div class="feature-item">
        <span class="feature-icon">🚀</span>
        <span>自動化業務流程</span>
      </div>
    </div>
    
    <button class="retry-btn" onclick="window.location.reload()">重新連接</button>
  </div>
</body>
</html>
`;

// Service Worker 安裝事件
self.addEventListener('install', (event) => {
  console.log('[Website SW] Installing Service Worker');
  
  event.waitUntil(
    Promise.all([
      // 緩存靜態資源
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        console.log('[Website SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      // 緩存離線頁面
      caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
        console.log('[Website SW] Caching offline page');
        return cache.put('/offline.html', new Response(OFFLINE_PAGE, {
          headers: { 'Content-Type': 'text/html' }
        }));
      })
    ]).then(() => {
      console.log('[Website SW] Installation complete');
      return self.skipWaiting();
    })
  );
});

// Service Worker 激活事件
self.addEventListener('activate', (event) => {
  console.log('[Website SW] Activating Service Worker');
  
  event.waitUntil(
    Promise.all([
      // 清理舊緩存
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME) {
              console.log('[Website SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      self.clients.claim()
    ]).then(() => {
      console.log('[Website SW] Activation complete');
    })
  );
});

// 網路請求攔截
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 只處理同源請求
  if (url.origin !== location.origin) {
    return;
  }
  
  // HTML 請求 - 網路優先策略
  if (request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match('/offline.html');
          });
        })
    );
    return;
  }
  
  // API 請求 - 網路優先，短期緩存
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 只緩存成功的 GET 請求
          if (response.status === 200 && request.method === 'GET') {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
              // 為API數據設置較短的緩存時間
              const headers = new Headers(responseClone.headers);
              headers.set('sw-cached-at', Date.now().toString());
              cache.put(request, new Response(responseClone.body, {
                status: responseClone.status,
                statusText: responseClone.statusText,
                headers: headers
              }));
            });
          }
          return response;
        })
        .catch(() => {
          // 網路失敗時從緩存返回
          if (request.method === 'GET') {
            return caches.match(request).then((cachedResponse) => {
              if (cachedResponse) {
                // 檢查緩存時間，API數據緩存不超過5分鐘
                const cachedAt = cachedResponse.headers.get('sw-cached-at');
                if (cachedAt && (Date.now() - parseInt(cachedAt)) > 5 * 60 * 1000) {
                  // 緩存過期
                  return new Response(
                    JSON.stringify({ 
                      error: 'API數據已過期，請連接網路獲取最新信息',
                      cached: true,
                      expired: true
                    }),
                    {
                      status: 503,
                      headers: { 'Content-Type': 'application/json' }
                    }
                  );
                }
                return cachedResponse;
              }
              return new Response(
                JSON.stringify({ 
                  error: '無法連接服務器，請檢查網路連接',
                  offline: true
                }),
                {
                  status: 503,
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            });
          }
          
          return new Response(
            JSON.stringify({ 
              error: '網路連接失敗，請檢查您的網路設置' 
            }),
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }
  
  // 靜態資源 - 緩存優先策略
  if (request.destination === 'script' || 
      request.destination === 'style' || 
      request.destination === 'image' ||
      request.destination === 'font') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(request).then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }
  
  // 其他請求使用默認策略
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request);
    })
  );
});

// 推送通知事件 - 品牌相關通知
self.addEventListener('push', (event) => {
  console.log('[Website SW] Push notification received');
  
  const options = {
    body: 'Morning Ai 有新的產品更新和功能發布',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/'
    },
    actions: [
      {
        action: 'view-updates',
        title: '查看更新',
        icon: '/icons/icon-96x96.png'
      },
      {
        action: 'visit-website',
        title: '訪問網站',
        icon: '/icons/icon-96x96.png'
      },
      {
        action: 'close',
        title: '關閉',
        icon: '/icons/icon-96x96.png'
      }
    ]
  };
  
  if (event.data) {
    try {
      const payload = event.data.json();
      if (payload.type === 'product-update') {
        options.body = `新功能發布：${payload.feature}`;
        options.data.url = '/products';
      } else if (payload.type === 'promotion') {
        options.body = `限時優惠：${payload.offer}`;
        options.data.url = '/pricing';
      } else if (payload.type === 'announcement') {
        options.body = `重要公告：${payload.message}`;
        options.data.url = '/news';
      }
    } catch (e) {
      console.log('[Website SW] Push payload parsing failed:', e);
    }
  }
  
  event.waitUntil(
    self.registration.showNotification('Morning Ai', options)
  );
});

// 通知點擊事件
self.addEventListener('notificationclick', (event) => {
  console.log('[Website SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  let urlToOpen = '/';
  if (event.action === 'view-updates') {
    urlToOpen = '/updates';
  } else if (event.action === 'visit-website') {
    urlToOpen = '/';
  } else {
    urlToOpen = event.notification.data?.url || '/';
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// 後台同步事件 - 內容同步
self.addEventListener('sync', (event) => {
  console.log('[Website SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-content') {
    event.waitUntil(syncContent());
  }
});

// 同步網站內容
async function syncContent() {
  try {
    // 同步主要頁面內容
    const pagesToSync = ['/', '/products', '/pricing'];
    
    for (const page of pagesToSync) {
      try {
        const response = await fetch(page);
        if (response.ok) {
          const cache = await caches.open(DYNAMIC_CACHE_NAME);
          await cache.put(page, response.clone());
        }
      } catch (error) {
        console.log(`[Website SW] Failed to sync ${page}:`, error);
      }
    }
    
    console.log('[Website SW] Content sync completed');
  } catch (error) {
    console.error('[Website SW] Content sync failed:', error);
    throw error;
  }
}

// 緩存管理
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            return caches.delete(cacheName);
          })
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }
  
  if (event.data && event.data.type === 'SYNC_CONTENT') {
    event.waitUntil(syncContent());
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

