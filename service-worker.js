// 缓存名称
const CACHE_NAME = 'couple-notes-v4';
const urlsToCache = [
  '.',
  'index.html',
  'css/style.css',
  'js/script.js',
  'manifest.json'
];

// 安装Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache opened');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting(); // 立即激活新的Service Worker
});

// 激活Service Worker
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim(); // 立即控制所有客户端
    })
  );
});

// 拦截网络请求
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // API请求 - 优先使用网络，不缓存API响应
  if (requestUrl.pathname.includes('/notes.json') || 
      requestUrl.pathname.includes('/upload') ||
      requestUrl.pathname.includes('/sync') ||
      requestUrl.pathname.includes('/data') ||
      requestUrl.pathname.includes('/ping')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // API请求失败时，返回适当的错误响应
          return new Response(JSON.stringify({ error: 'Network error' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 503
          });
        })
    );
    return;
  }
  
  // HTML文件 - 使用Network First策略，确保每次获取最新的HTML
  if (requestUrl.pathname.endsWith('.html') || requestUrl.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // 检查响应是否有效
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // 克隆响应，一份用于返回，一份用于更新缓存
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        })
        .catch(() => {
          // 网络请求失败，尝试从缓存获取
          return caches.match(event.request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // 缓存中也没有，返回网络错误
              return new Response('Network error', {
                status: 503
              });
            });
        })
    );
    return;
  }
  
  // 其他静态资源 - 使用Stale While Revalidate策略
  // 先返回缓存的资源，然后在后台更新缓存
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // 从网络获取最新资源，用于更新缓存
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            // 检查响应是否有效
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            
            // 克隆响应，一份用于更新缓存
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return networkResponse;
          })
          .catch(() => {
            // 网络请求失败，不做处理
            return null;
          });
        
        // 如果缓存中有响应，先返回缓存的响应，然后在后台更新缓存
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // 缓存中没有响应，等待网络请求
        return fetchPromise;
      })
  );
});