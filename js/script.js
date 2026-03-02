// 全局变量
let currentAlbum = null;
let currentUser = null;
let syncManager = null;

// 数据缓存
let notesData = [];
let albumsData = [];
let usersData = [];

// 固定账号初始密码和映射关系
const ACCOUNT_MAPPING = {
    'qiuyichen': 'user1',
    'luoyu': 'user2'
};

// 默认昵称映射
const DEFAULT_NICKNAMES = {
    user1: '邱以辰',
    user2: '罗钰'
};

// 固定账号初始密码
const INITIAL_PASSWORDS = {
    user1: 'qiuyichen',
    user2: 'luoyu'
};

// 在一起起始日期
const START_DATE = new Date('2025-02-16');

// 全局变量
let lastScrollTop = 0;
const USER_INFO_HEIGHT = 70; // 用户信息栏最小高度
const SYNC_INTERVAL = 60000; // 1分钟同步检查间隔

// 同步相关配置
const SYNC_CONFIG = {
    pingTimeout: 5000, // 5秒超时
    maxQueueSize: 1000, // 最大队列大小
    retryDelay: 30000 // 30秒重试间隔
};

// 初始化数据
function initData() {
    console.log('[initData] 开始执行');
    
    try {
        // 从localStorage加载数据
        const storedNotes = localStorage.getItem('notes');
        const storedAlbums = localStorage.getItem('albums');
        const storedUsers = localStorage.getItem('users');
        const storedSyncQueue = localStorage.getItem('syncQueue');
        const storedDeviceId = localStorage.getItem('deviceId');
        const storedServerUrl = localStorage.getItem('serverUrl');
        const storedLastSync = localStorage.getItem('lastSync');
        
        console.log('[initData] localStorage数据:', { storedNotes, storedAlbums, storedUsers, storedSyncQueue, storedDeviceId, storedServerUrl, storedLastSync });
        
        // 安全解析localStorage数据
        notesData = storedNotes ? JSON.parse(storedNotes) : [];
        albumsData = storedAlbums ? JSON.parse(storedAlbums) : [];
        usersData = storedUsers ? JSON.parse(storedUsers) : [];
        syncQueue = storedSyncQueue ? JSON.parse(storedSyncQueue) : [];
        serverUrl = storedServerUrl || '';
        lastSync = storedLastSync || '';
        
        // 生成或加载设备ID
        deviceId = storedDeviceId || generateDeviceId();
        localStorage.setItem('deviceId', deviceId);
        
        // 确保数据类型正确
        notesData = Array.isArray(notesData) ? notesData : [];
        albumsData = Array.isArray(albumsData) ? albumsData : [];
        usersData = Array.isArray(usersData) ? usersData : [];
        syncQueue = Array.isArray(syncQueue) ? syncQueue : [];
        
        // 初始化默认用户数据（如果不存在）
        if (usersData.length === 0) {
            console.log('[initData] 初始化默认用户数据');
            usersData = [
                { id: 'user1', password: INITIAL_PASSWORDS.user1, nickname: DEFAULT_NICKNAMES.user1 },
                { id: 'user2', password: INITIAL_PASSWORDS.user2, nickname: DEFAULT_NICKNAMES.user2 }
            ];
            localStorage.setItem('users', JSON.stringify(usersData));
        }
        
        // 初始化默认笔记数据（如果不存在）
        if (notesData.length === 0) {
            console.log('[initData] 初始化默认笔记数据');
            notesData = [];
            localStorage.setItem('notes', JSON.stringify(notesData));
        }
        
        // 初始化默认相册数据（如果不存在）
        if (albumsData.length === 0) {
            console.log('[initData] 初始化默认相册数据');
            albumsData = [];
            localStorage.setItem('albums', JSON.stringify(albumsData));
        }
        
        console.log('[initData] 初始化完成:', { 
            notesCount: notesData.length, 
            albumsCount: albumsData.length, 
            usersCount: usersData.length,
            syncQueueCount: syncQueue.length,
            deviceId: deviceId,
            serverUrl: serverUrl,
            lastSync: lastSync
        });
    } catch (error) {
        console.error('[initData] 初始化数据时发生错误:', error);
        // 重置所有数据
        notesData = [];
        albumsData = [];
        usersData = [];
        syncQueue = [];
        localStorage.clear();
        deviceId = generateDeviceId();
        localStorage.setItem('deviceId', deviceId);
        console.log('[initData] 已重置所有数据');
    }
}

// 生成设备ID
function generateDeviceId() {
    return 'device-' + Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
}

// 生成唯一ID
function generateId() {
    return Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
}

// 格式化日期
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// SyncManager类
class SyncManager {
    constructor() {
        this.syncQueue = JSON.parse(localStorage.getItem('syncQueue')) || [];
        this.deviceId = localStorage.getItem('deviceId') || generateDeviceId();
        this.serverUrl = localStorage.getItem('serverUrl') || 'https://pwa.diandiandidi.vip';
        this.lastSync = localStorage.getItem('lastSync') || '';
        
        // 保存设备ID到localStorage
        localStorage.setItem('deviceId', this.deviceId);
        
        // 绑定事件监听器
        this.bindEventListeners();
        
        console.log('[SyncManager] 初始化完成:', { 
            deviceId: this.deviceId, 
            serverUrl: this.serverUrl, 
            queueLength: this.syncQueue.length 
        });
    }
    
    // 绑定事件监听器
    bindEventListeners() {
        // 网络状态变化监听
        window.addEventListener('online', () => {
            console.log('[SyncManager] 检测到网络连接，开始同步');
            this.syncToServer();
        });
        
        window.addEventListener('offline', () => {
            console.log('[SyncManager] 检测到网络断开');
        });
    }
    
    // 添加到同步队列
    addToQueue(note) {
        console.log('[addToQueue] 添加到同步队列:', note.id);
        
        // 检查队列大小
        if (this.syncQueue.length >= SYNC_CONFIG.maxQueueSize) {
            console.warn('[addToQueue] 同步队列已满，移除最旧的记录');
            this.syncQueue.shift();
        }
        
        // 创建同步记录
        const syncItem = {
            id: generateId(),
            type: 'update',
            dataType: 'note',
            data: note,
            timestamp: new Date().toISOString(),
            deviceId: this.deviceId
        };
        
        // 添加到队列
        this.syncQueue.push(syncItem);
        
        // 保存到localStorage
        localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
        
        console.log('[addToQueue] 同步记录添加成功，队列长度:', this.syncQueue.length);
        
        // 如果在线，立即尝试同步
        if (navigator.onLine) {
            this.syncToServer();
        }
    }
    
    // 同步到服务器
    async syncToServer() {
        console.log('[syncToServer] 开始同步到服务器');
        
        // 显示同步状态
        this.showSyncStatus('正在同步...', '🔄', '#28a745');
        
        // 检查网络连接
        if (!navigator.onLine) {
            console.log('[syncToServer] 网络未连接，跳过同步');
            this.hideSyncStatus();
            return false;
        }
        
        // 检查服务器URL
        if (!this.serverUrl) {
            console.log('[syncToServer] 服务器URL未配置');
            this.hideSyncStatus();
            return false;
        }
        
        try {
            // 上传所有笔记
            const response = await fetch(`${this.serverUrl}/notes.json`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(notesData)
            });
            
            if (!response.ok) {
                throw new Error(`同步失败: ${response.statusText}`);
            }
            
            // 清空同步队列
            this.syncQueue = [];
            localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
            
            // 更新最后同步时间
            this.lastSync = new Date().toISOString();
            localStorage.setItem('lastSync', this.lastSync);
            
            console.log('[syncToServer] 同步成功');
            this.showSyncStatus('同步成功', '✅', '#28a745');
            setTimeout(() => this.hideSyncStatus(), 2000);
            
            return true;
        } catch (error) {
            console.error('[syncToServer] 同步失败:', error);
            this.showSyncStatus('同步失败', '❌', '#dc3545');
            setTimeout(() => this.hideSyncStatus(), 2000);
            return false;
        }
    }
    
    // 从服务器拉取数据
    async pullFromServer() {
        console.log('[pullFromServer] 开始从服务器拉取数据');
        
        // 检查网络连接
        if (!navigator.onLine) {
            console.log('[pullFromServer] 网络未连接，跳过拉取');
            return false;
        }
        
        // 检查服务器URL
        if (!this.serverUrl) {
            console.log('[pullFromServer] 服务器URL未配置');
            return false;
        }
        
        try {
            const response = await fetch(`${this.serverUrl}/notes.json`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`拉取失败: ${response.statusText}`);
            }
            
            const remoteNotes = await response.json();
            console.log('[pullFromServer] 拉取到笔记数:', remoteNotes.length);
            
            // 合并数据
            const mergedNotes = this.mergeData(notesData, remoteNotes);
            
            // 更新本地数据
            notesData = mergedNotes;
            localStorage.setItem('notes', JSON.stringify(notesData));
            
            // 更新UI
            renderNotes();
            
            // 更新最后同步时间
            this.lastSync = new Date().toISOString();
            localStorage.setItem('lastSync', this.lastSync);
            
            console.log('[pullFromServer] 数据拉取并合并成功');
            return true;
        } catch (error) {
            console.error('[pullFromServer] 拉取失败:', error);
            return false;
        }
    }
    
    // 合并数据（时间戳优先）
    mergeData(local, remote) {
        console.log('[mergeData] 合并数据，本地:', local.length, '条，远程:', remote.length, '条');
        
        // 创建本地数据映射
        const localMap = new Map(local.map(item => [item.id, item]));
        const merged = [...local];
        
        // 处理远程数据
        for (const remoteItem of remote) {
            const localItem = localMap.get(remoteItem.id);
            
            if (!localItem) {
                // 新数据，直接添加
                merged.push(remoteItem);
            } else {
                // 已有数据，按时间戳更新
                const localTime = new Date(localItem.updatedAt || localItem.createdAt);
                const remoteTime = new Date(remoteItem.updatedAt || remoteItem.createdAt);
                
                if (remoteTime > localTime) {
                    // 远程数据更新，替换本地数据
                    const index = merged.findIndex(item => item.id === remoteItem.id);
                    if (index !== -1) {
                        merged[index] = remoteItem;
                    }
                }
            }
        }
        
        // 按时间戳排序（最新的在前）
        merged.sort((a, b) => {
            const timeA = new Date(a.updatedAt || a.createdAt);
            const timeB = new Date(b.updatedAt || b.createdAt);
            return timeB - timeA;
        });
        
        console.log('[mergeData] 合并完成，共:', merged.length, '条数据');
        return merged;
    }
    
    // 上传图片（base64）
    async uploadImage(base64Data, filename) {
        console.log('[uploadImage] 开始上传图片:', filename);
        
        // 检查网络连接
        if (!navigator.onLine) {
            console.log('[uploadImage] 网络未连接，跳过上传');
            return {
                success: false,
                error: '网络未连接'
            };
        }
        
        // 检查服务器URL
        if (!this.serverUrl) {
            console.log('[uploadImage] 服务器URL未配置');
            return {
                success: false,
                error: '服务器URL未配置'
            };
        }
        
        try {
            const response = await fetch(`${this.serverUrl}/upload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filename: filename,
                    data: base64Data
                })
            });
            
            if (!response.ok) {
                throw new Error(`上传失败: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('[uploadImage] 上传成功:', result);
            return result;
        } catch (error) {
            console.error('[uploadImage] 上传失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // 显示同步状态
    showSyncStatus(text, icon, color) {
        const statusBar = document.getElementById('sync-status-bar');
        const statusText = document.getElementById('sync-status-text');
        const statusIcon = document.getElementById('sync-status-icon');
        
        if (statusBar) {
            statusBar.style.display = 'block';
            statusBar.style.background = color;
        }
        
        if (statusText) {
            statusText.textContent = text;
        }
        
        if (statusIcon) {
            statusIcon.textContent = icon;
        }
    }
    
    // 隐藏同步状态
    hideSyncStatus() {
        const statusBar = document.getElementById('sync-status-bar');
        if (statusBar) {
            statusBar.style.display = 'none';
        }
    }
    
    // 保存服务器地址
    saveServerUrl(url) {
        this.serverUrl = url;
        localStorage.setItem('serverUrl', url);
        console.log('[saveServerUrl] 服务器地址已保存:', url);
    }
    
    // 获取设备ID
    getDeviceId() {
        return this.deviceId;
    }
    
    // 获取最后同步时间
    getLastSync() {
        return this.lastSync;
    }
    
    // 获取服务器地址
    getServerUrl() {
        return this.serverUrl;
    }
}

// 同步相关函数

// 检查服务器是否可用
async function checkServer() {
    console.log('[checkServer] 检查服务器:', serverUrl);
    
    if (!serverUrl) {
        console.log('[checkServer] 服务器URL未配置');
        return false;
    }
    
    try {
        const response = await fetch(`${serverUrl}/ping`, {
            timeout: SYNC_CONFIG.pingTimeout,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        console.log('[checkServer] 服务器响应:', result);
        
        return response.ok && result.status === 'ok';
    } catch (error) {
        console.error('[checkServer] 服务器检查失败:', error);
        return false;
    }
}

// 上传待同步队列
async function uploadSyncQueue() {
    console.log('[uploadSyncQueue] 开始上传同步队列，队列长度:', syncQueue.length);
    
    if (syncQueue.length === 0) {
        console.log('[uploadSyncQueue] 同步队列为空，跳过上传');
        return true;
    }
    
    try {
        const response = await fetch(`${serverUrl}/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                queue: syncQueue,
                deviceId: deviceId
            })
        });
        
        const result = await response.json();
        console.log('[uploadSyncQueue] 上传响应:', result);
        
        if (response.ok && result.success) {
            console.log('[uploadSyncQueue] 同步队列上传成功');
            // 清空已同步的队列
            syncQueue = [];
            localStorage.setItem('syncQueue', JSON.stringify(syncQueue));
            return true;
        } else {
            throw new Error(result.message || '上传失败');
        }
    } catch (error) {
        console.error('[uploadSyncQueue] 同步队列上传失败:', error);
        return false;
    }
}

// 下载最新数据
async function downloadLatestData() {
    console.log('[downloadLatestData] 开始下载最新数据');
    
    try {
        const response = await fetch(`${serverUrl}/data`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        console.log('[downloadLatestData] 下载数据:', { notesCount: data.notes?.length, albumsCount: data.albums?.length });
        
        if (response.ok && data) {
            await mergeData(data);
            console.log('[downloadLatestData] 数据下载并合并成功');
            return true;
        } else {
            throw new Error('下载失败');
        }
    } catch (error) {
        console.error('[downloadLatestData] 数据下载失败:', error);
        return false;
    }
}

// 合并数据
async function mergeData(serverData) {
    console.log('[mergeData] 开始合并数据');
    
    if (!serverData) return false;
    
    try {
        // 合并笔记数据
        if (Array.isArray(serverData.notes)) {
            await mergeNotes(serverData.notes);
        }
        
        // 合并相册数据
        if (Array.isArray(serverData.albums)) {
            await mergeAlbums(serverData.albums);
        }
        
        // 更新最后同步时间
        lastSync = new Date().toISOString();
        localStorage.setItem('lastSync', lastSync);
        
        // 更新UI
        renderNotes();
        renderAlbums();
        
        console.log('[mergeData] 数据合并成功');
        return true;
    } catch (error) {
        console.error('[mergeData] 数据合并失败:', error);
        return false;
    }
}

// 合并笔记数据
async function mergeNotes(serverNotes) {
    console.log('[mergeNotes] 合并笔记，本地笔记数:', notesData.length, '服务器笔记数:', serverNotes.length);
    
    // 创建现有笔记ID映射
    const existingNotesMap = new Map(notesData.map(note => [note.id, note]));
    
    // 合并服务器笔记
    for (const serverNote of serverNotes) {
        const existingNote = existingNotesMap.get(serverNote.id);
        
        if (!existingNote) {
            // 新笔记，直接添加
            notesData.push(serverNote);
        } else {
            // 已有笔记，按时间戳更新
            const existingTime = new Date(existingNote.updatedAt || existingNote.createdAt);
            const serverTime = new Date(serverNote.updatedAt || serverNote.createdAt);
            
            if (serverTime > existingTime) {
                // 服务器版本更新，替换本地版本
                const index = notesData.findIndex(note => note.id === serverNote.id);
                if (index !== -1) {
                    notesData[index] = serverNote;
                }
            }
        }
    }
    
    // 保存到localStorage
    localStorage.setItem('notes', JSON.stringify(notesData));
    console.log('[mergeNotes] 笔记合并完成，合并后笔记数:', notesData.length);
}

// 合并相册数据
async function mergeAlbums(serverAlbums) {
    console.log('[mergeAlbums] 合并相册，本地相册数:', albumsData.length, '服务器相册数:', serverAlbums.length);
    
    // 创建现有相册ID映射
    const existingAlbumsMap = new Map(albumsData.map(album => [album.id, album]));
    
    // 合并服务器相册
    for (const serverAlbum of serverAlbums) {
        const existingAlbum = existingAlbumsMap.get(serverAlbum.id);
        
        if (!existingAlbum) {
            // 新相册，直接添加
            albumsData.push(serverAlbum);
        } else {
            // 已有相册，合并媒体文件并按时间戳更新
            const existingTime = new Date(existingAlbum.updatedAt || existingAlbum.createdAt);
            const serverTime = new Date(serverAlbum.updatedAt || serverAlbum.createdAt);
            
            // 合并媒体文件
            if (Array.isArray(serverAlbum.media)) {
                const existingMediaMap = new Map(existingAlbum.media.map(media => [media.id || media.name, media]));
                
                for (const media of serverAlbum.media) {
                    const mediaKey = media.id || media.name;
                    if (!existingMediaMap.has(mediaKey)) {
                        existingAlbum.media.push(media);
                    }
                }
            }
            
            // 按时间戳更新相册
            if (serverTime > existingTime) {
                // 更新相册信息，但保留本地媒体文件
                const index = albumsData.findIndex(album => album.id === serverAlbum.id);
                if (index !== -1) {
                    albumsData[index] = {
                        ...serverAlbum,
                        media: existingAlbum.media // 保留本地媒体文件
                    };
                }
            }
        }
    }
    
    // 保存到localStorage
    localStorage.setItem('albums', JSON.stringify(albumsData));
    console.log('[mergeAlbums] 相册合并完成，合并后相册数:', albumsData.length);
}

// 同步数据
async function syncData() {
    console.log('[syncData] 开始同步数据');
    
    // 检查网络连接
    if (!navigator.onLine) {
        console.log('[syncData] 网络未连接，跳过同步');
        return false;
    }
    
    // 检查服务器是否可用
    const serverAvailable = await checkServer();
    if (!serverAvailable) {
        console.log('[syncData] 服务器不可用，跳过同步');
        return false;
    }
    
    try {
        // 上传待同步队列
        const uploadSuccess = await uploadSyncQueue();
        if (!uploadSuccess) {
            throw new Error('上传同步队列失败');
        }
        
        // 下载最新数据
        const downloadSuccess = await downloadLatestData();
        if (!downloadSuccess) {
            throw new Error('下载最新数据失败');
        }
        
        console.log('[syncData] 数据同步成功');
        return true;
    } catch (error) {
        console.error('[syncData] 数据同步失败:', error);
        return false;
    }
}

// 启动同步检查
function startSyncChecker() {
    console.log('[startSyncChecker] 启动同步检查，间隔:', SYNC_INTERVAL, 'ms');
    
    // 立即执行一次同步检查
    syncData();
    
    // 定时执行同步检查
    setInterval(syncData, SYNC_INTERVAL);
}

// 初始化设置页面显示
function initSettingsDisplay() {
    const deviceIdDisplay = document.getElementById('device-id-display');
    const lastSyncDisplay = document.getElementById('last-sync-display');
    const serverUrlInput = document.getElementById('server-url');
    
    if (syncManager) {
        if (deviceIdDisplay) {
            deviceIdDisplay.textContent = syncManager.getDeviceId();
        }
        
        if (lastSyncDisplay) {
            lastSyncDisplay.textContent = syncManager.getLastSync() || '从未同步';
        }
        
        if (serverUrlInput) {
            serverUrlInput.value = syncManager.getServerUrl();
        }
    }
}

// 保存服务器地址
function saveServerUrl() {
    const serverUrlInput = document.getElementById('server-url');
    const url = serverUrlInput.value.trim();
    
    if (url && syncManager) {
        syncManager.saveServerUrl(url);
        alert('服务器地址保存成功！');
        initSettingsDisplay();
    } else {
        alert('请输入有效的服务器地址！');
    }
}

// 立即同步数据
function syncData() {
    if (syncManager) {
        syncManager.syncToServer().then(success => {
            if (success) {
                console.log('[syncData] 同步成功');
            } else {
                console.log('[syncData] 同步失败');
            }
        });
    }
}

// 图片压缩函数
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (event) => {
            const img = new Image();
            
            img.onload = () => {
                // 创建画布
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // 计算压缩后的尺寸
                if (width > height) {
                    if (width > IMAGE_CONFIG.maxWidth) {
                        height = Math.round((height * IMAGE_CONFIG.maxWidth) / width);
                        width = IMAGE_CONFIG.maxWidth;
                    }
                } else {
                    if (height > IMAGE_CONFIG.maxHeight) {
                        width = Math.round((width * IMAGE_CONFIG.maxHeight) / height);
                        height = IMAGE_CONFIG.maxHeight;
                    }
                }
                
                // 设置画布尺寸
                canvas.width = width;
                canvas.height = height;
                
                // 绘制压缩后的图片
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // 转换为base64
                const base64Data = canvas.toDataURL('image/jpeg', IMAGE_CONFIG.quality);
                resolve(base64Data);
            };
            
            img.onerror = reject;
            img.src = event.target.result;
        };
        
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 初始化数据
    initData();
    
    // 创建SyncManager实例
    syncManager = new SyncManager();
    
    // 绑定事件监听器
    bindEventListeners();
    
    // 添加滚动事件监听器
    window.addEventListener('scroll', handleScroll);
    
    // 检查是否已登录
    checkLogin();
    
    // 计算并显示在一起天数
    updateTogetherDays();
    
    // 确保无论是否登录都渲染笔记和相册列表
    renderNotes();
    renderAlbums();
    
    // 初始化设置页面显示
    initSettingsDisplay();
    
    // 启动同步检查
    setInterval(() => {
        if (syncManager) {
            syncManager.pullFromServer();
        }
    }, SYNC_CONFIG.syncInterval);
    
    // 初始拉取数据
    if (syncManager) {
        syncManager.pullFromServer();
    }
});

// 处理滚动事件，控制用户信息栏显示/隐藏
function handleScroll() {
    // 优化手机端滚动体验，降低滚动事件触发频率
    if (handleScroll.timeout) {
        clearTimeout(handleScroll.timeout);
    }
    
    handleScroll.timeout = setTimeout(() => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const userInfo = document.getElementById('user-info');
        
        if (userInfo && userInfo.style.display !== 'none') {
            if (scrollTop > lastScrollTop && scrollTop > USER_INFO_HEIGHT * 2) {
                // 向下滚动，隐藏用户信息栏
                userInfo.classList.add('hidden');
                document.body.classList.add('user-info-hidden');
            } else if (scrollTop < lastScrollTop || scrollTop < USER_INFO_HEIGHT) {
                // 向上滚动，显示用户信息栏
                userInfo.classList.remove('hidden');
                document.body.classList.remove('user-info-hidden');
            }
        }
        
        lastScrollTop = scrollTop;
    }, 50); // 50ms延迟，减少手机端滚动卡顿
}



// 计算在一起天数
function updateTogetherDays() {
    const today = new Date();
    const diffTime = Math.abs(today - START_DATE);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const togetherDaysEl = document.getElementById('together-days');
    if (togetherDaysEl) {
        togetherDaysEl.textContent = `💖 我们已经在一起 ${diffDays} 天啦！`;
    }
}

// 检查登录状态
function checkLogin() {
    const user = localStorage.getItem('currentUser');
    if (user) {
        currentUser = JSON.parse(user);
        document.getElementById('login-modal').classList.remove('show');
        document.getElementById('user-info').style.display = 'block';
        document.getElementById('current-user').textContent = `欢迎，${currentUser.nickname} 💕`;
        updateTogetherDays();
        // 登录后渲染笔记和相册列表
        renderNotes();
        renderAlbums();
    }
}

// 绑定事件监听器
function bindEventListeners() {
    // 导航切换
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            switchSection(targetId);
        });
    });

    // 模态框关闭按钮
    const closeButtons = document.querySelectorAll('.close');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            modal.classList.remove('show');
        });
    });

    // 点击模态框外部关闭
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('show');
        }
    });

    // 登录表单提交
    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        login();
    });

    // 登出按钮
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn.addEventListener('click', logout);

    // 设置按钮
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    settingsBtn.addEventListener('click', function() {
        settingsModal.classList.add('show');
    });

    // 设置表单提交
    const settingsForm = document.getElementById('settings-form');
    settingsForm.addEventListener('submit', function(e) {
        e.preventDefault();
        saveSettings();
    });

    // 添加笔记按钮
    const addNoteBtn = document.getElementById('add-note-btn');
    const noteModal = document.getElementById('note-modal');
    addNoteBtn.addEventListener('click', function() {
        noteModal.classList.add('show');
    });

    // 添加笔记表单提交
    const noteForm = document.getElementById('note-form');
    noteForm.addEventListener('submit', function(e) {
        e.preventDefault();
        addNote();
    });

    // 添加相册按钮
    const addAlbumBtn = document.getElementById('add-album-btn');
    const albumModal = document.getElementById('album-modal');
    addAlbumBtn.addEventListener('click', function() {
        albumModal.classList.add('show');
    });

    // 添加相册表单提交
    const albumForm = document.getElementById('album-form');
    albumForm.addEventListener('submit', function(e) {
        e.preventDefault();
        addAlbum();
    });

    // 插入图片和视频的文件输入
    const insertImageInput = document.getElementById('insert-image-input');
    const insertVideoInput = document.getElementById('insert-video-input');
    
    insertImageInput.addEventListener('change', function(e) {
        handleInsertMedia(e.target.files[0], 'image');
    });
    
    insertVideoInput.addEventListener('change', function(e) {
        handleInsertMedia(e.target.files[0], 'video');
    });
    
    // 完整笔记模态框关闭按钮
    const closeFullNoteBtn = document.querySelector('.close-full-note');
    if (closeFullNoteBtn) {
        closeFullNoteBtn.addEventListener('click', closeFullNote);
    }
    
    // 点击模态框外部关闭完整笔记
    const fullNoteModal = document.getElementById('full-note-modal');
    if (fullNoteModal) {
        fullNoteModal.addEventListener('click', function(e) {
            if (e.target === fullNoteModal) {
                closeFullNote();
            }
        });
    }
    
    // 相册媒体上传change事件
    const albumMediaInput = document.getElementById('album-media');
    if (albumMediaInput) {
        albumMediaInput.addEventListener('change', uploadAlbumMedia);
    }
}

// 切换区域
function switchSection(sectionId) {
    // 更新导航状态
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('active');
        }
    });

    // 更新显示的区域
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
        section.classList.remove('active');
        if (section.id === sectionId) {
            section.classList.add('active');
        }
    });
}

// 登录功能
function login() {
    const code = document.getElementById('login-code').value;
    
    // 根据口令识别账号
    const account = ACCOUNT_MAPPING[code];
    
    if (!account) {
        alert('登录口令错误，请重新输入！');
        return;
    }
    
    // 检查用户是否存在
    let user = usersData.find(u => u.id === account);
    
    // 检查用户是否存在
    if (!user) {
        // 如果用户不存在，创建新用户，使用默认昵称
        user = {
            id: account,
            password: code,
            nickname: DEFAULT_NICKNAMES[account]
        };
        usersData.push(user);
        localStorage.setItem('users', JSON.stringify(usersData));
    } else {
        // 更新密码，保留原有昵称
        user.password = code; // 更新密码，支持后续修改
        localStorage.setItem('users', JSON.stringify(usersData));
    }
    
    // 保存当前登录用户到localStorage
    currentUser = {
        id: user.id,
        nickname: user.nickname,
        lastLogin: new Date().toISOString()
    };
    
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // 更新UI
    document.getElementById('login-modal').classList.remove('show');
    document.getElementById('user-info').style.display = 'block';
    document.getElementById('current-user').textContent = `欢迎，${currentUser.nickname} 💕`;
    updateTogetherDays();
    
    // 渲染数据
    renderNotes();
    renderAlbums();
}

// 登出功能
function logout() {
    if (confirm('确定要退出登录吗？')) {
        localStorage.removeItem('currentUser');
        currentUser = null;
        
        // 更新UI
        document.getElementById('user-info').style.display = 'none';
        document.getElementById('login-modal').classList.add('show');
        
        // 清空内容
        document.getElementById('notes-container').innerHTML = '';
        document.getElementById('albums-container').innerHTML = '';
    }
}

// 保存设置
function saveSettings() {
    const newNickname = document.getElementById('new-nickname').value.trim();
    const newPassword = document.getElementById('new-password').value;
    
    if (!newNickname && !newPassword) {
        alert('请输入要修改的内容！');
        return;
    }
    
    // 找到当前用户
    const userIndex = usersData.findIndex(u => u.id === currentUser.id);
    
    if (userIndex !== -1) {
        // 更新昵称
        if (newNickname) {
            if (newNickname.length < 2 || newNickname.length > 10) {
                alert('昵称长度请控制在2-10个字符之间！');
                return;
            }
            usersData[userIndex].nickname = newNickname;
            currentUser.nickname = newNickname;
        }
        
        // 更新密码
        if (newPassword) {
            if (newPassword.length < 6) {
                alert('密码长度不能少于6个字符！');
                return;
            }
            usersData[userIndex].password = newPassword;
        }
        
        // 保存到localStorage
        localStorage.setItem('users', JSON.stringify(usersData));
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        // 更新UI
        document.getElementById('current-user').textContent = `欢迎，${currentUser.nickname} 💕`;
        document.getElementById('settings-modal').classList.remove('show');
        document.getElementById('settings-form').reset();
        
        alert('设置保存成功！');
    }
}

// 插入图片
function insertImage() {
    document.getElementById('insert-image-input').click();
}

// 插入视频
function insertVideo() {
    document.getElementById('insert-video-input').click();
}

// 处理插入媒体
async function handleInsertMedia(file, type) {
    if (!file) return;
    
    if (type === 'image') {
        try {
            // 显示加载状态
            const statusBar = document.getElementById('sync-status-bar');
            if (statusBar) {
                statusBar.style.display = 'block';
                statusBar.style.background = '#17a2b8';
                statusBar.innerHTML = '<span id="sync-status-text">正在压缩图片...</span><span id="sync-status-icon">🖼️</span>';
            }
            
            // 压缩图片
            const compressedData = await compressImage(file);
            
            // 如果在线，上传到服务器
            let finalUrl = compressedData;
            if (navigator.onLine && syncManager) {
                statusBar.innerHTML = '<span id="sync-status-text">正在上传图片...</span><span id="sync-status-icon">📤</span>';
                const uploadResult = await syncManager.uploadImage(compressedData, file.name);
                if (uploadResult.success && uploadResult.url) {
                    finalUrl = uploadResult.url;
                }
            }
            
            // 插入图片到编辑器
            insertMediaIntoEditor(finalUrl, type, file.name);
            
            // 隐藏加载状态
            if (statusBar) {
                statusBar.style.display = 'none';
            }
        } catch (error) {
            console.error('[handleInsertMedia] 处理图片失败:', error);
            alert('图片处理失败，请重试！');
            
            // 隐藏加载状态
            const statusBar = document.getElementById('sync-status-bar');
            if (statusBar) {
                statusBar.style.display = 'none';
            }
        }
    } else if (type === 'video') {
        // 视频处理（暂时直接使用base64）
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            insertMediaIntoEditor(content, type, file.name);
        };
        reader.readAsDataURL(file);
    }
}

// 插入媒体到编辑器
function insertMediaIntoEditor(content, type, fileName) {
    const editor = document.getElementById('note-content');
    
    // 确保焦点在内容区域
    editor.focus();
    
    // 在内容区域内插入媒体
    const selection = window.getSelection();
    let range;
    
    try {
        // 尝试获取当前范围
        range = selection.getRangeAt(0);
        // 检查当前范围是否在编辑器内
        if (!editor.contains(range.commonAncestorContainer)) {
            // 如果不在编辑器内，创建一个新的范围在编辑器末尾
            range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
        }
    } catch (error) {
        // 如果无法获取范围，创建一个新的范围在编辑器末尾
        range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
    }
    
    if (type === 'image') {
        const img = document.createElement('img');
        img.src = content;
        img.alt = fileName;
        // 添加样式类，确保图片大小合适
        img.style.maxWidth = '100%';
        img.style.maxHeight = '400px';
        img.style.height = 'auto';
        img.style.objectFit = 'contain';
        img.style.margin = '10px 0';
        range.insertNode(img);
    } else if (type === 'video') {
        const video = document.createElement('video');
        video.src = content;
        video.controls = true;
        video.muted = false;
        // 添加样式类，确保视频大小合适
        video.style.maxWidth = '100%';
        video.style.maxHeight = '400px';
        video.style.height = 'auto';
        video.style.margin = '10px 0';
        range.insertNode(video);
    }
    
    // 移动光标到媒体后面
    const insertedMedia = type === 'image' ? img : video;
    range.setStartAfter(insertedMedia);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    
    // 触发input事件
    editor.dispatchEvent(new Event('input', { bubbles: true }));
}

// 添加笔记
function addNote() {
    const title = document.getElementById('note-title').value;
    const content = document.getElementById('note-content').innerHTML;
    
    if (!content.trim()) {
        alert('笔记内容不能为空！');
        return;
    }
    
    const newNote = {
        id: Date.now().toString(),
        title: title,
        content: content,
        author: currentUser.nickname,
        comments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    // 添加到数据缓存
    notesData.unshift(newNote);
    
    // 保存到localStorage
    localStorage.setItem('notes', JSON.stringify(notesData));
    
    // 使用SyncManager进行同步
    if (syncManager) {
        syncManager.addToQueue(newNote);
        syncManager.syncToServer();
    }
    
    // 重置表单并关闭模态框
    document.getElementById('note-form').reset();
    document.getElementById('note-content').innerHTML = '';
    document.getElementById('note-modal').classList.remove('show');
    
    // 重新渲染笔记列表
    renderNotes();
}

// 渲染笔记列表
function renderNotes() {
    console.log('[renderNotes] 开始执行');
    console.log('[renderNotes] notesData:', notesData);
    
    // 确保notesData是数组
    if (!Array.isArray(notesData)) {
        console.error('[renderNotes] notesData不是数组，重置为空数组');
        notesData = [];
        localStorage.setItem('notes', JSON.stringify(notesData));
    }
    
    const notesContainer = document.getElementById('notes-container');
    
    if (!notesContainer) {
        console.error('[renderNotes] notes-container元素未找到');
        return;
    }
    
    console.log('[renderNotes] 渲染', notesData.length, '条笔记');
    
    if (notesData.length === 0) {
        console.log('[renderNotes] 没有笔记可渲染，显示空状态');
        notesContainer.innerHTML = '<p style="text-align: center; color: #999; grid-column: 1 / -1; padding: 2rem; font-size: 1.2rem;">还没有笔记，快来添加第一条吧！</p>';
        return;
    }
    
    try {
        const notesHtml = notesData.map(note => {
            // 提取笔记中的第一张图片作为封面
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = note.content || '';
            const firstImage = tempDiv.querySelector('img');
            const firstVideo = tempDiv.querySelector('video');
            const coverMedia = firstImage || firstVideo;
            
            // 生成笔记摘要
            const textContent = tempDiv.textContent || tempDiv.innerText || '';
            const excerpt = textContent.trim().substring(0, 100) + (textContent.length > 100 ? '...' : '');
            
            return `
                <div class="note-card" data-id="${note.id}" onclick="openFullNote('${note.id}')">
                    <div class="note-cover">
                        ${coverMedia ? `
                            ${coverMedia.tagName === 'IMG' ? 
                                `<img src="${coverMedia.src}" alt="笔记封面" style="max-width: 100%; max-height: 200px; height: auto; object-fit: cover;">` : 
                                `<video src="${coverMedia.src}" muted loop playsinline style="max-width: 100%; max-height: 200px; height: auto; object-fit: cover;"></video>`}
                        ` : '📝'}
                    </div>
                    <div class="note-card-content">
                        <div>
                            <div class="note-header">
                                <h3 class="note-title">${note.title || '无标题'}</h3>
                                <button class="delete-note-btn" onclick="event.stopPropagation(); deleteNote('${note.id}')" title="删除笔记">
                                    🗑️
                                </button>
                            </div>
                            <p class="note-excerpt">${excerpt}</p>
                        </div>
                        <p class="note-meta">
                            <span class="note-author">✍️ ${note.author || '未知作者'}</span>
                            <span class="note-date">${formatDate(note.createdAt)}</span>
                            <span class="note-comments">💬 ${note.comments ? note.comments.length : 0}</span>
                        </p>
                    </div>
                </div>
            `;
        }).join('');
        
        console.log('[renderNotes] 生成的HTML长度:', notesHtml.length);
        notesContainer.innerHTML = notesHtml;
        console.log('[renderNotes] 笔记渲染完成');
    } catch (error) {
        console.error('[renderNotes] 渲染过程中发生错误:', error);
        notesContainer.innerHTML = '<p style="text-align: center; color: #ff6b6b; grid-column: 1 / -1; padding: 2rem; font-size: 1.2rem;">渲染笔记时发生错误，请刷新页面重试</p>';
    }
}

// 打开完整笔记
function openFullNote(noteId) {
    const note = notesData.find(n => n.id === noteId);
    
    if (!note) return;
    
    const modal = document.getElementById('full-note-modal');
    const titleEl = modal.querySelector('.full-note-title');
    const metaEl = modal.querySelector('.full-note-meta');
    const bodyEl = modal.querySelector('.full-note-body');
    const commentsEl = modal.querySelector('.comments-section');
    
    // 设置笔记内容
    titleEl.textContent = note.title;
    metaEl.innerHTML = `
        <span class="note-author">✍️ ${note.author}</span>
        <span class="note-date">${formatDate(note.createdAt)}</span>
    `;
    bodyEl.innerHTML = note.content;
    
    // 设置留言内容
    commentsEl.innerHTML = `
        <h4>💬 留言 (${note.comments ? note.comments.length : 0})</h4>
        ${note.comments && note.comments.length > 0 ? `
            <div class="comments">
                ${note.comments.map(comment => `
                    <div class="comment">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div class="comment-author">${comment.author}</div>
                            <div style="display: flex; gap: 0.5rem;">
                                <button class="comment-btn reply-btn" onclick="replyToComment('${note.id}', '${comment.id}', '${comment.author}')" title="回复">
                                    💬
                                </button>
                                ${comment.author === currentUser.nickname ? `
                                    <button class="comment-btn delete-btn" onclick="deleteComment('${note.id}', '${comment.id}')" title="删除">
                                        🗑️
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                        <div class="comment-content">${comment.content}</div>
                        <div class="comment-date">${formatDate(comment.createdAt)}</div>
                        
                        <!-- 子回复层级 -->
                        ${comment.replies && comment.replies.length > 0 ? `
                            <div class="comment-replies">
                                ${comment.replies.map(reply => `
                                    <div class="comment reply">
                                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                            <div class="comment-author">${reply.author} 回复 ${reply.parentAuthor}</div>
                                            <div style="display: flex; gap: 0.5rem;">
                                                <button class="comment-btn reply-btn" onclick="replyToComment('${note.id}', '${comment.id}', '${reply.author}')" title="回复">
                                                    💬
                                                </button>
                                                ${reply.author === currentUser.nickname ? `
                                                    <button class="comment-btn delete-btn" onclick="deleteReply('${note.id}', '${comment.id}', '${reply.id}')" title="删除">
                                                        🗑️
                                                    </button>
                                                ` : ''}
                                            </div>
                                        </div>
                                        <div class="comment-content">${reply.content}</div>
                                        <div class="comment-date">${formatDate(reply.createdAt)}</div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        ` : '<p style="color: #999; font-style: italic;">暂无留言</p>'}
        
        <div class="add-comment">
            <div id="reply-to" style="display: none; margin-bottom: 0.5rem; padding: 0.5rem; background: #f8f9fa; border-radius: 5px; font-size: 0.9rem;"></div>
            <textarea placeholder="写下你的留言..." id="comment-${note.id}"></textarea>
            <button class="btn-primary" onclick="addComment('${note.id}', true)">发送留言</button>
            <button class="btn-primary" id="cancel-reply" style="background: #6c757d; margin-left: 0.5rem; display: none;">取消回复</button>
        </div>
    `;
    
    // 绑定取消回复按钮事件
    const cancelReplyBtn = document.getElementById('cancel-reply');
    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener('click', () => {
            document.getElementById('reply-to').style.display = 'none';
            cancelReplyBtn.style.display = 'none';
            document.getElementById(`comment-${note.id}`).setAttribute('data-reply-to', '');
            document.getElementById(`comment-${note.id}`).placeholder = '写下你的留言...';
        });
    }
    
    modal.classList.add('active');
}

// 关闭完整笔记
function closeFullNote() {
    const modal = document.getElementById('full-note-modal');
    modal.classList.remove('active');
    renderNotes(); // 重新渲染笔记，更新留言数量
}

// 回复留言 - 确保所有回复都作为一级留言的子回复
function replyToComment(noteId, commentId, author) {
    const commentInput = document.getElementById(`comment-${noteId}`);
    const replyToDiv = document.getElementById('reply-to');
    const cancelReplyBtn = document.getElementById('cancel-reply');
    
    // 直接设置为回复一级留言，确保只有两级结构
    commentInput.setAttribute('data-reply-to', commentId);
    commentInput.setAttribute('data-reply-to-author', author);
    commentInput.placeholder = `回复 ${author}...`;
    replyToDiv.innerHTML = `💬 正在回复 ${author}`;
    replyToDiv.style.display = 'block';
    cancelReplyBtn.style.display = 'inline-block';
    
    // 聚焦到输入框
    commentInput.focus();
}

// 添加留言
function addComment(noteId, isFullNote = false) {
    const commentInput = document.getElementById(`comment-${noteId}`);
    const content = commentInput.value.trim();
    
    if (!content) {
        alert('留言内容不能为空！');
        return;
    }
    
    const note = notesData.find(n => n.id === noteId);
    
    if (note) {
        const replyTo = commentInput.getAttribute('data-reply-to');
        
        if (replyTo) {
            // 添加回复
            const parentComment = note.comments.find(c => c.id === replyTo);
            const parentAuthor = commentInput.getAttribute('data-reply-to-author');
            
            if (parentComment) {
                // 确保父评论有replies数组
                if (!parentComment.replies) {
                    parentComment.replies = [];
                }
                
                const newReply = {
                    id: Date.now().toString(),
                    author: currentUser.nickname,
                    parentAuthor: parentAuthor,
                    content: content,
                    createdAt: new Date().toISOString()
                };
                
                parentComment.replies.push(newReply);
            }
        } else {
            // 添加新评论
            const newComment = {
                id: Date.now().toString(),
                author: currentUser.nickname,
                content: content,
                createdAt: new Date().toISOString(),
                replies: []
            };
            
            // 确保笔记有comments数组
            if (!note.comments) {
                note.comments = [];
            }
            note.comments.push(newComment);
        }
        
        // 保存到localStorage
        localStorage.setItem('notes', JSON.stringify(notesData));
        
        // 清空输入和回复状态
        commentInput.value = '';
        commentInput.setAttribute('data-reply-to', '');
        commentInput.setAttribute('data-reply-to-author', '');
        commentInput.placeholder = '写下你的留言...';
        
        // 隐藏回复提示
        const replyToDiv = document.getElementById('reply-to');
        const cancelReplyBtn = document.getElementById('cancel-reply');
        if (replyToDiv) replyToDiv.style.display = 'none';
        if (cancelReplyBtn) cancelReplyBtn.style.display = 'none';
        
        // 如果是从完整笔记添加的留言，更新模态框内容
        if (isFullNote) {
            openFullNote(noteId);
        } else {
            renderNotes();
        }
    }
}

// 删除留言
function deleteComment(noteId, commentId) {
    if (confirm('确定要删除这条留言吗？删除后无法恢复！')) {
        const note = notesData.find(n => n.id === noteId);
        
        if (note) {
            const commentIndex = note.comments.findIndex(c => c.id === commentId);
            if (commentIndex !== -1) {
                note.comments.splice(commentIndex, 1);
                // 保存到localStorage
                localStorage.setItem('notes', JSON.stringify(notesData));
                openFullNote(noteId);
            }
        }
    }
}

// 删除回复
function deleteReply(noteId, commentId, replyId) {
    if (confirm('确定要删除这条回复吗？删除后无法恢复！')) {
        const note = notesData.find(n => n.id === noteId);
        
        if (note) {
            const parentComment = note.comments.find(c => c.id === commentId);
            if (parentComment && parentComment.replies) {
                const replyIndex = parentComment.replies.findIndex(r => r.id === replyId);
                if (replyIndex !== -1) {
                    parentComment.replies.splice(replyIndex, 1);
                    // 保存到localStorage
                    localStorage.setItem('notes', JSON.stringify(notesData));
                    openFullNote(noteId);
                }
            }
        }
    }
}

// 删除笔记
function deleteNote(noteId) {
    if (confirm('确定要删除这篇笔记吗？删除后无法恢复！')) {
        // 找到要删除的笔记
        const noteToDelete = notesData.find(note => note.id === noteId);
        
        // 从数据缓存中删除笔记
        notesData = notesData.filter(note => note.id !== noteId);
        
        // 保存到localStorage
        localStorage.setItem('notes', JSON.stringify(notesData));
        
        // 添加到待同步队列
        if (noteToDelete) {
            addToSyncQueue('delete', 'note', noteToDelete);
        }
        
        // 重新渲染笔记列表
        renderNotes();
        
        alert('笔记已成功删除！');
    }
}

// 渲染相册列表
function renderAlbums() {
    const albumsContainer = document.getElementById('albums-container');
    
    if (albumsData.length === 0) {
        albumsContainer.innerHTML = '<p style="text-align: center; color: #999; grid-column: 1 / -1;">还没有相册，快来创建第一个吧！</p>';
        return;
    }
    
    albumsContainer.innerHTML = albumsData.map(album => `
        <div class="album-card" onclick="openAlbum('${album.id}')">
            <div class="album-cover">
                ${album.media && album.media.length > 0 ? `
                    <img src="${album.media[0].data}" alt="${album.name}" style="width: 100%; height: 100%; object-fit: cover;">
                ` : '📸'}
                <div class="album-actions" style="position: absolute; top: 10px; right: 10px; display: flex; gap: 5px; opacity: 0; transition: opacity 0.3s ease;">
                    <button class="close-btn" onclick="event.stopPropagation(); renameAlbum('${album.id}')" title="重命名相册" style="font-size: 0.8rem; width: 30px; height: 30px;">
                        ✏️
                    </button>
                    <button class="close-btn" onclick="event.stopPropagation(); deleteAlbum('${album.id}')" title="删除相册" style="font-size: 0.8rem; width: 30px; height: 30px; background: rgba(220, 53, 69, 0.9);">
                        🗑️
                    </button>
                </div>
            </div>
            <div class="album-info">
                <h3 class="album-name">${album.name}</h3>
                <p class="album-description">${album.description}</p>
                <div class="album-stats">
                    <span>📷 ${album.media ? album.media.length : 0} 张</span>
                    <span>🕒 ${formatDate(album.createdAt)}</span>
                </div>
            </div>
        </div>
    `).join('');
    
    // 添加悬停效果
    const albumCards = document.querySelectorAll('.album-card');
    albumCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.querySelector('.album-actions').style.opacity = '1';
        });
        card.addEventListener('mouseleave', function() {
            this.querySelector('.album-actions').style.opacity = '0';
        });
    });
}

// 重命名相册
function renameAlbum(albumId) {
    const album = albumsData.find(a => a.id === albumId);
    
    if (album) {
        const newName = prompt('请输入新的相册名称：', album.name);
        if (newName && newName.trim() && newName !== album.name) {
            album.name = newName.trim();
            localStorage.setItem('albums', JSON.stringify(albumsData));
            renderAlbums();
            alert('相册名称已更新！');
        }
    }
}

// 删除相册
function deleteAlbum(albumId) {
    const album = albumsData.find(a => a.id === albumId);
    
    if (album) {
        if (confirm(`确定要删除相册"${album.name}"吗？相册中的所有媒体文件也将被删除，删除后无法恢复！`)) {
            // 从数据缓存中删除相册
            albumsData = albumsData.filter(a => a.id !== albumId);
            
            // 保存到localStorage
            localStorage.setItem('albums', JSON.stringify(albumsData));
            
            // 添加到待同步队列
            addToSyncQueue('delete', 'album', album);
            
            // 重新渲染相册列表
            renderAlbums();
            
            alert('相册已成功删除！');
        }
    }
}

// 创建相册
function addAlbum() {
    const name = document.getElementById('album-name').value;
    const description = document.getElementById('album-description').value;
    
    const newAlbum = {
        id: Date.now().toString(),
        name: name,
        description: description,
        media: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    // 添加到数据缓存
    albumsData.unshift(newAlbum);
    
    // 保存到localStorage
    localStorage.setItem('albums', JSON.stringify(albumsData));
    
    // 添加到待同步队列
    addToSyncQueue('add', 'album', newAlbum);
    
    // 重置表单并关闭模态框
    document.getElementById('album-form').reset();
    document.getElementById('album-modal').classList.remove('show');
    
    // 重新渲染相册列表
    renderAlbums();
}

// 打开相册详情
function openAlbum(albumId) {
    currentAlbum = albumsData.find(album => album.id === albumId);
    
    if (currentAlbum) {
        renderAlbumDetail();
        document.getElementById('album-detail-modal').classList.add('show');
    }
}

// 渲染相册详情
function renderAlbumDetail() {
    const content = document.getElementById('album-detail-content');
    
    content.innerHTML = `
        <div class="album-detail-header">
            <h3>${currentAlbum.name}</h3>
            <p>${currentAlbum.description}</p>
            <p style="color: #999; font-size: 0.9rem;">创建于：${formatDate(currentAlbum.createdAt)}</p>
        </div>
        
        <div class="media-upload">
            <h4>📤 上传媒体</h4>
            <input type="file" id="album-media" name="media" multiple accept="image/*,video/*" style="display: none;">
            <button class="btn-primary" onclick="document.getElementById('album-media').click()">从手机上传</button>
            <button class="btn-primary" style="margin-left: 0.5rem; background: #28a745;" onclick="openImportModal()">📝 从笔记导入</button>
        </div>
        
        <h4>📷 媒体列表 (${currentAlbum.media.length})</h4>
        <div class="media-grid">
            ${currentAlbum.media.length > 0 ? currentAlbum.media.map((item, index) => `
                <div class="media-item">
                    ${item.type.startsWith('image/') ? `
                        <img src="${item.data}" alt="${item.name}" onclick="viewMedia('${item.data}', '${item.type}')">
                    ` : `
                        <video src="${item.data}" onclick="viewMedia('${item.data}', '${item.type}')"></video>
                    `}
                    <button class="delete-media" onclick="deleteAlbumMedia(${index})">×</button>
                </div>
            `).join('') : '<p style="text-align: center; color: #999; grid-column: 1 / -1;">相册中还没有媒体文件</p>'}
        </div>
    `;
}

// 打开从笔记导入图片模态框
function openImportModal() {
    const importModal = document.getElementById('import-modal');
    const importContent = document.getElementById('import-content');
    
    if (notesData.length === 0) {
        importContent.innerHTML = '<p style="text-align: center; color: #999;">还没有笔记，无法导入图片</p>';
    } else {
        // 渲染所有笔记和它们的媒体
        importContent.innerHTML = notesData.map(note => {
            // 从笔记内容中提取所有图片和视频
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = note.content;
            const mediaElements = tempDiv.querySelectorAll('img, video');
            
            if (mediaElements.length === 0) return '';
            
            return `
                <div class="note-item">
                    <h4>${note.title}</h4>
                    <p>${note.author} · ${formatDate(note.createdAt)}</p>
                    <div class="note-media-grid">
                        ${Array.from(mediaElements).map((media, index) => {
                            const type = media.tagName === 'IMG' ? 'image' : 'video';
                            const src = media.src;
                            return `
                                <div class="note-media-item">
                                    <input type="checkbox" id="import-media-${note.id}-${index}" 
                                           data-note-id="${note.id}" 
                                           data-note-title="${note.title}" 
                                           data-media-index="${index}" 
                                           data-media-src="${src}" 
                                           data-media-type="${type}">
                                    ${type === 'image' ? `<img src="${src}" alt="导入图片">` : `<video src="${src}" muted loop playsinline></video>`}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('') + `
            <div style="text-align: center; margin-top: 1rem;">
                <button class="btn-primary" onclick="importSelectedMedia()">导入选中的媒体</button>
            </div>
        `;
    }
    
    importModal.classList.add('show');
}

// 导入选中的媒体
function importSelectedMedia() {
    const checkboxes = document.querySelectorAll('#import-content input[type="checkbox"]:checked');
    
    if (checkboxes.length === 0) {
        alert('请选择要导入的媒体！');
        return;
    }
    
    const selectedMedia = Array.from(checkboxes).map(checkbox => {
        const src = checkbox.dataset.mediaSrc;
        const type = checkbox.dataset.mediaType;
        const noteId = checkbox.dataset.noteId;
        const noteTitle = checkbox.dataset.noteTitle;
        
        return {
            name: `imported-${Date.now()}.${type === 'image' ? 'jpg' : 'mp4'}`,
            type: type === 'image' ? 'image/jpeg' : 'video/mp4',
            data: src,
            noteId: noteId,
            noteTitle: noteTitle
        };
    });
    
    // 找到当前相册在数据缓存中的索引
    const albumIndex = albumsData.findIndex(album => album.id === currentAlbum.id);
    
    if (albumIndex !== -1) {
        // 更新数据缓存
        albumsData[albumIndex].media = [...albumsData[albumIndex].media, ...selectedMedia];
        
        // 保存到localStorage
        localStorage.setItem('albums', JSON.stringify(albumsData));
        
        // 更新当前相册对象
        currentAlbum = albumsData[albumIndex];
        
        // 关闭模态框并重新渲染
        document.getElementById('import-modal').classList.remove('show');
        renderAlbumDetail();
        
        alert(`成功导入 ${selectedMedia.length} 个媒体文件到相册！`);
    }
}

// 修改渲染相册详情函数，添加跳转链接
function renderAlbumDetail() {
    const content = document.getElementById('album-detail-content');
    
    content.innerHTML = `
        <div class="album-detail-header">
            <h3>${currentAlbum.name}</h3>
            <p>${currentAlbum.description}</p>
            <p style="color: #999; font-size: 0.9rem;">创建于：${formatDate(currentAlbum.createdAt)}</p>
        </div>
        
        <div class="media-upload">
            <h4>📤 上传媒体</h4>
            <input type="file" id="album-media" name="media" multiple accept="image/*,video/*" style="display: none;">
            <button class="btn-primary" onclick="document.getElementById('album-media').click()">从手机上传</button>
            <button class="btn-primary" style="margin-left: 0.5rem; background: #28a745;" onclick="openImportModal()">📝 从笔记导入</button>
        </div>
        
        <h4>📷 媒体列表 (${currentAlbum.media.length})</h4>
        <div class="media-grid">
            ${currentAlbum.media.length > 0 ? currentAlbum.media.map((item, index) => {
                const mediaHtml = item.type.startsWith('image/') ? 
                    `<img src="${item.data}" alt="${item.name}" onclick="viewMedia('${item.data}', '${item.type}')">` : 
                    `<video src="${item.data}" onclick="viewMedia('${item.data}', '${item.type}')" controls></video>`;
                
                // 如果媒体来自笔记，添加跳转链接
                if (item.noteId) {
                    return `
                        <div class="media-item">
                            <div style="position: relative;">
                                ${mediaHtml}
                                <div class="media-note-link" style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0, 0, 0, 0.6); color: white; padding: 0.5rem; font-size: 0.8rem; text-align: center; cursor: pointer;" 
                                     onclick="openFullNote('${item.noteId}')">
                                    📝 来自：${item.noteTitle}
                                </div>
                            </div>
                            <button class="delete-media" onclick="deleteAlbumMedia(${index})">×</button>
                        </div>
                    `;
                } else {
                    return `
                        <div class="media-item">
                            ${mediaHtml}
                            <button class="delete-media" onclick="deleteAlbumMedia(${index})">×</button>
                        </div>
                    `;
                }
            }).join('') : '<p style="text-align: center; color: #999; grid-column: 1 / -1;">相册中还没有媒体文件</p>'}
        </div>
    `;
}

// 上传相册媒体
function uploadAlbumMedia() {
    const fileInput = document.getElementById('album-media');
    const mediaFiles = fileInput.files;
    
    if (mediaFiles.length === 0) {
        alert('请选择要上传的媒体文件！');
        return;
    }
    
    // 处理媒体文件（转换为DataURL）
    const mediaPromises = Array.from(mediaFiles).map(file => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                resolve({
                    name: file.name,
                    type: file.type,
                    data: e.target.result
                });
            };
            reader.readAsDataURL(file);
        });
    });

    Promise.all(mediaPromises).then(newMedia => {
        // 找到当前相册在数据缓存中的索引
        const albumIndex = albumsData.findIndex(album => album.id === currentAlbum.id);
        
        if (albumIndex !== -1) {
            // 更新数据缓存
            albumsData[albumIndex].media = [...albumsData[albumIndex].media, ...newMedia];
            
            // 更新相册的更新时间
            albumsData[albumIndex].updatedAt = new Date().toISOString();
            
            // 保存到localStorage
            localStorage.setItem('albums', JSON.stringify(albumsData));
            
            // 更新当前相册对象
            currentAlbum = albumsData[albumIndex];
            
            // 将更新后的相册添加到待同步队列
            addToSyncQueue('update', 'album', currentAlbum);
            
            // 重置文件输入并重新渲染
            fileInput.value = '';
            renderAlbumDetail();
        }
    });
}

// 删除相册媒体
function deleteAlbumMedia(index) {
    if (confirm('确定要删除这个媒体文件吗？')) {
        // 找到当前相册在数据缓存中的索引
        const albumIndex = albumsData.findIndex(album => album.id === currentAlbum.id);
        
        if (albumIndex !== -1) {
            // 更新数据缓存
            albumsData[albumIndex].media.splice(index, 1);
            
            // 更新相册的更新时间
            albumsData[albumIndex].updatedAt = new Date().toISOString();
            
            // 保存到localStorage
            localStorage.setItem('albums', JSON.stringify(albumsData));
            
            // 更新当前相册对象
            currentAlbum = albumsData[albumIndex];
            
            // 将更新后的相册添加到待同步队列
            addToSyncQueue('update', 'album', currentAlbum);
            
            // 重新渲染
            renderAlbumDetail();
        }
    }
}

// 查看媒体
function viewMedia(url, type) {
    // 创建媒体查看器元素（如果不存在）
    let mediaViewer = document.getElementById('media-viewer');
    if (!mediaViewer) {
        mediaViewer = document.createElement('div');
        mediaViewer.id = 'media-viewer';
        mediaViewer.className = 'media-viewer';
        mediaViewer.innerHTML = '<div class="media-viewer-content"></div>';
        document.body.appendChild(mediaViewer);
        
        // 添加关闭事件
        mediaViewer.addEventListener('click', function() {
            this.classList.remove('active');
        });
    }
    
    // 更新媒体内容
    const content = mediaViewer.querySelector('.media-viewer-content');
    if (type.startsWith('image/')) {
        content.innerHTML = `<img src="${url}" alt="媒体查看">`;
    } else if (type.startsWith('video/')) {
        content.innerHTML = `<video src="${url}" controls autoplay></video>`;
    }
    
    // 显示媒体查看器
    mediaViewer.classList.add('active');
}

// 保存服务器URL
function saveServerUrl() {
    const serverUrlInput = document.getElementById('server-url');
    const newServerUrl = serverUrlInput.value.trim();
    
    if (newServerUrl) {
        // 验证URL格式
        try {
            new URL(newServerUrl);
            serverUrl = newServerUrl;
            localStorage.setItem('serverUrl', serverUrl);
            alert('服务器地址保存成功！');
            
            // 立即尝试同步
            syncData();
        } catch (error) {
            alert('请输入有效的URL地址！');
        }
    } else {
        alert('请输入服务器地址！');
    }
}

// 更新设备信息显示
function updateDeviceInfoDisplay() {
    // 显示设备ID
    const deviceIdDisplay = document.getElementById('device-id-display');
    if (deviceIdDisplay && deviceId) {
        deviceIdDisplay.textContent = deviceId;
    }
    
    // 显示最后同步时间
    const lastSyncDisplay = document.getElementById('last-sync-display');
    if (lastSyncDisplay) {
        if (lastSync) {
            lastSyncDisplay.textContent = new Date(lastSync).toLocaleString('zh-CN');
        } else {
            lastSyncDisplay.textContent = '从未同步';
        }
    }
    
    // 设置服务器URL输入框的值
    const serverUrlInput = document.getElementById('server-url');
    if (serverUrlInput) {
        serverUrlInput.value = serverUrl;
    }
}

// 初始化设置页面显示
function initSettingsDisplay() {
    // 监听设置模态框显示事件
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) {
        // 使用MutationObserver监听模态框显示状态变化
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class' && settingsModal.classList.contains('show')) {
                    updateDeviceInfoDisplay();
                }
            });
        });
        
        observer.observe(settingsModal, {
            attributes: true,
            attributeFilter: ['class']
        });
    }
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 辅助函数：生成唯一ID
function generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// 数据同步功能

// 导出所有数据为JSON文件
function exportData() {
    try {
        // 获取所有数据
        const data = {
            notes: notesData,
            albums: albumsData,
            users: usersData,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        // 转换为JSON字符串
        const jsonString = JSON.stringify(data, null, 2);
        
        // 创建Blob对象
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // 创建下载链接
        const a = document.createElement('a');
        a.href = url;
        a.download = `couple-notes-export-${new Date().toISOString().slice(0, 10)}.json`;
        
        // 触发下载
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // 释放URL对象
        URL.revokeObjectURL(url);
        
        console.log('[exportData] 数据导出成功');
        alert('数据导出成功！');
    } catch (error) {
        console.error('[exportData] 数据导出失败:', error);
        alert('数据导出失败，请重试！');
    }
}

// 导入数据从JSON文件
function importData(event) {
    try {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const jsonString = e.target.result;
            const importedData = JSON.parse(jsonString);
            
            // 验证数据格式
            if (!importedData.notes || !importedData.albums || !importedData.users) {
                throw new Error('无效的数据格式');
            }
            
            // 合并数据
            mergeData(importedData);
            
            // 更新UI
            renderNotes();
            renderAlbums();
            
            console.log('[importData] 数据导入成功');
            alert('数据导入成功！');
        };
        reader.readAsText(file);
    } catch (error) {
        console.error('[importData] 数据导入失败:', error);
        alert('数据导入失败，请检查文件格式！');
    }
}

// 合并数据
function mergeData(importedData) {
    try {
        console.log('[mergeData] 开始合并数据');
        
        // 合并笔记数据
        if (Array.isArray(importedData.notes)) {
            const existingNoteIds = new Set(notesData.map(note => note.id));
            const newNotes = importedData.notes.filter(note => !existingNoteIds.has(note.id));
            notesData = [...notesData, ...newNotes].sort((a, b) => 
                new Date(b.createdAt) - new Date(a.createdAt)
            );
            localStorage.setItem('notes', JSON.stringify(notesData));
            console.log('[mergeData] 合并了', newNotes.length, '条新笔记');
        }
        
        // 合并相册数据
        if (Array.isArray(importedData.albums)) {
            const existingAlbumIds = new Set(albumsData.map(album => album.id));
            const newAlbums = importedData.albums.filter(album => !existingAlbumIds.has(album.id));
            
            // 合并相册数据
            newAlbums.forEach(newAlbum => {
                const existingAlbum = albumsData.find(album => album.id === newAlbum.id);
                if (existingAlbum) {
                    // 如果相册已存在，合并媒体文件
                    const existingMediaIds = new Set(existingAlbum.media.map(media => media.name));
                    const newMedia = newAlbum.media.filter(media => !existingMediaIds.has(media.name));
                    existingAlbum.media = [...existingAlbum.media, ...newMedia];
                } else {
                    // 否则添加新相册
                    albumsData.push(newAlbum);
                }
            });
            
            localStorage.setItem('albums', JSON.stringify(albumsData));
            console.log('[mergeData] 合并了', newAlbums.length, '个新相册');
        }
        
        // 合并用户数据
        if (Array.isArray(importedData.users)) {
            const existingUserIds = new Set(usersData.map(user => user.id));
            const newUsers = importedData.users.filter(user => !existingUserIds.has(user.id));
            usersData = [...usersData, ...newUsers];
            localStorage.setItem('users', JSON.stringify(usersData));
            console.log('[mergeData] 合并了', newUsers.length, '个新用户');
        }
        
        console.log('[mergeData] 数据合并完成');
    } catch (error) {
        console.error('[mergeData] 数据合并失败:', error);
        throw error;
    }
}