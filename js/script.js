// 全局变量
let currentAlbum = null;
let currentUser = null;
let syncManager = null;

// 数据缓存
let notesData = [];
let albumsData = [];
let usersData = [];
let deletedNotesData = []; // 已删除笔记列表

// 自定义确认对话框相关变量
let confirmCallback = null;

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
    retryDelay: 30000, // 30秒重试间隔
    syncInterval: 60000, // 1分钟同步检查间隔
    debounceDelay: 2000 // 2秒防抖延迟
};

// 图片压缩配置
const IMAGE_CONFIG = {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.8
};

// 同步状态
let syncStatus = {
    isSyncing: false,
    lastSyncTime: null,
    pendingChanges: false,
    retryCount: 0
};

// 防抖定时器
let syncDebounceTimer = null;

// 防抖同步函数
function debouncedSync(note) {
    // 清除之前的定时器
    if (syncDebounceTimer) {
        clearTimeout(syncDebounceTimer);
    }
    
    // 设置新的定时器
    syncDebounceTimer = setTimeout(() => {
        if (syncManager && note) {
            syncManager.addToQueue(note);
            syncManager.syncToServer();
        }
    }, SYNC_CONFIG.debounceDelay);
}

// 初始化数据
function initData() {
    console.log('[initData] 开始执行');
    
    try {
        // 从localStorage加载数据
        const storedNotes = localStorage.getItem('notes');
        const storedAlbums = localStorage.getItem('albums');
        const storedUsers = localStorage.getItem('users');
        const storedDeletedNotes = localStorage.getItem('deletedNotes');
        
        console.log('[initData] localStorage数据:', { storedNotes, storedAlbums, storedUsers, storedDeletedNotes });
        
        // 安全解析localStorage数据
        notesData = storedNotes ? JSON.parse(storedNotes) : [];
        albumsData = storedAlbums ? JSON.parse(storedAlbums) : [];
        usersData = storedUsers ? JSON.parse(storedUsers) : [];
        deletedNotesData = storedDeletedNotes ? JSON.parse(storedDeletedNotes) : [];
        
        // 确保数据类型正确
        notesData = Array.isArray(notesData) ? notesData : [];
        albumsData = Array.isArray(albumsData) ? albumsData : [];
        usersData = Array.isArray(usersData) ? usersData : [];
        deletedNotesData = Array.isArray(deletedNotesData) ? deletedNotesData : [];
        
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
        
        // 初始化已删除笔记数据（如果不存在）
        if (deletedNotesData.length === 0) {
            console.log('[initData] 初始化已删除笔记数据');
            deletedNotesData = [];
            localStorage.setItem('deletedNotes', JSON.stringify(deletedNotesData));
        }
        
        // 自动清理：删除超过30天的删除记录
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const beforeClean = deletedNotesData.length;
        deletedNotesData = deletedNotesData.filter(item => {
            return new Date(item.deletedAt) > thirtyDaysAgo;
        });
        if (beforeClean !== deletedNotesData.length) {
            localStorage.setItem('deletedNotes', JSON.stringify(deletedNotesData));
            console.log(`[initData] 自动清理了 ${beforeClean - deletedNotesData.length} 条过期删除记录`);
        }
        
        console.log('[initData] 初始化完成:', { 
            notesCount: notesData.length, 
            albumsCount: albumsData.length, 
            usersCount: usersData.length,
            deletedNotesCount: deletedNotesData.length
        });
    } catch (error) {
        console.error('[initData] 初始化数据时发生错误:', error);
        // 重置所有数据
        notesData = [];
        albumsData = [];
        usersData = [];
        deletedNotesData = [];
        localStorage.clear();
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
    
    // 添加到同步队列（通用方法，支持多种数据类型和操作类型）
    addToSyncQueue(type, dataType, data) {
        console.log(`[addToSyncQueue] 添加到同步队列: ${type} ${dataType}`, data.id || data);
        
        // 检查队列大小
        if (this.syncQueue.length >= SYNC_CONFIG.maxQueueSize) {
            console.warn('[addToSyncQueue] 同步队列已满，移除最旧的记录');
            this.syncQueue.shift();
        }
        
        // 创建同步记录
        const syncItem = {
            id: generateId(),
            type: type,
            dataType: dataType,
            data: data,
            timestamp: new Date().toISOString(),
            deviceId: this.deviceId
        };
        
        // 添加到队列
        this.syncQueue.push(syncItem);
        
        // 保存到localStorage
        localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
        
        console.log('[addToSyncQueue] 同步记录添加成功，队列长度:', this.syncQueue.length);
        
        // 如果在线，立即尝试同步
        if (navigator.onLine) {
            this.syncToServer();
        }
    }
    
    // 同步到服务器（异步非阻塞）
    async syncToServer() {
        // 如果正在同步，跳过
        if (syncStatus.isSyncing) {
            console.log('[syncToServer] 正在同步中，跳过');
            return false;
        }
        
        console.log('[syncToServer] 开始同步到服务器');
        
        // 显示同步状态
        this.showSyncStatus('正在同步...', '🔄', '#17a2b8');
        
        // 检查网络连接
        if (!navigator.onLine) {
            console.log('[syncToServer] 网络未连接，跳过同步');
            this.showSyncStatus('离线模式', '📴', '#6c757d');
            setTimeout(() => this.hideSyncStatus(), 2000);
            return false;
        }
        
        // 检查服务器URL
        if (!this.serverUrl) {
            console.log('[syncToServer] 服务器URL未配置');
            this.hideSyncStatus();
            return false;
        }
        
        // 标记为正在同步
        syncStatus.isSyncing = true;
        
        try {
            // 智能同步：先获取服务器笔记，然后只上传服务器缺少的本地笔记
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), SYNC_CONFIG.pingTimeout);
            
            // 获取服务器笔记
            const serverResponse = await fetch(`${this.serverUrl}/notes.json`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!serverResponse.ok) {
                throw new Error(`获取服务器笔记失败: ${serverResponse.statusText}`);
            }
            
            const serverNotes = await serverResponse.json();
            const localNoteIds = new Set(notesData.map(note => note.id));
            const serverNoteIds = new Set(serverNotes.map(note => note.id));
            
            // 服务器缺少的本地笔记（需要上传）
            const notesToUpload = notesData.filter(note => !serverNoteIds.has(note.id));
            
            // 创建合并后的笔记列表（保留服务器已有笔记，添加本地新笔记）
            const mergedNotes = [...serverNotes, ...notesToUpload];
            
            // 上传合并后的笔记列表
            const uploadController = new AbortController();
            const uploadTimeoutId = setTimeout(() => uploadController.abort(), SYNC_CONFIG.pingTimeout);
            
            const uploadResponse = await fetch(`${this.serverUrl}/notes.json`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(mergedNotes),
                signal: uploadController.signal
            });
            
            clearTimeout(uploadTimeoutId);
            
            if (!uploadResponse.ok) {
                throw new Error(`同步失败: ${uploadResponse.statusText}`);
            }
            
            // 清空同步队列
            this.syncQueue = [];
            localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
            
            // 更新最后同步时间
            this.lastSync = new Date().toISOString();
            localStorage.setItem('lastSync', this.lastSync);
            
            // 重置重试计数
            syncStatus.retryCount = 0;
            
            console.log('[syncToServer] 同步成功');
            this.showSyncStatus('同步成功', '✅', '#28a745');
            setTimeout(() => this.hideSyncStatus(), 2000);
            
            return true;
        } catch (error) {
            console.error('[syncToServer] 同步失败:', error);
            
            // 增加重试计数
            syncStatus.retryCount++;
            
            // 如果重试次数小于3次，延迟重试
            if (syncStatus.retryCount < 3) {
                this.showSyncStatus(`同步失败，${syncStatus.retryCount}秒后重试`, '⚠️', '#ffc107');
                setTimeout(() => {
                    syncStatus.isSyncing = false;
                    this.syncToServer();
                }, syncStatus.retryCount * 1000);
            } else {
                this.showSyncStatus('同步失败', '❌', '#dc3545');
                setTimeout(() => this.hideSyncStatus(), 3000);
            }
            
            return false;
        } finally {
            // 标记为同步完成
            syncStatus.isSyncing = false;
        }
    }
    
    // 从服务器拉取数据（异步非阻塞）
    async pullFromServer() {
        // 如果正在同步，跳过
        if (syncStatus.isSyncing) {
            console.log('[pullFromServer] 正在同步中，跳过');
            return false;
        }
        
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
            // 设置超时
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), SYNC_CONFIG.pingTimeout);
            
            const response = await fetch(`${this.serverUrl}/notes.json`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`拉取失败: ${response.statusText}`);
            }
            
            const remoteNotes = await response.json();
            console.log('[pullFromServer] 拉取到笔记数:', remoteNotes.length);
            
            // 合并数据
            const mergedNotes = this.mergeData(notesData, remoteNotes);
            
            // 检查是否有变化
            const hasChanges = JSON.stringify(mergedNotes) !== JSON.stringify(notesData);
            
            if (hasChanges) {
                // 更新本地数据
                notesData = mergedNotes;
                localStorage.setItem('notes', JSON.stringify(notesData));
                
                // 更新UI
                renderNotes();
                
                console.log('[pullFromServer] 数据有变化，已更新');
            } else {
                console.log('[pullFromServer] 数据无变化');
            }
            
            // 更新最后同步时间
            this.lastSync = new Date().toISOString();
            localStorage.setItem('lastSync', this.lastSync);
            
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
// 同步数据
// 初始化设置页面显示
// 上传到服务器
async function uploadToServer() {
    if (!syncManager) return;
    
    console.log('[uploadToServer] 开始上传到服务器');
    
    try {
        const statusBar = document.getElementById('sync-status-bar');
        if (statusBar) {
            statusBar.style.display = 'block';
            statusBar.style.background = '#28a745';
            statusBar.innerHTML = '<span id="sync-status-text">正在上传到服务器...</span><span id="sync-status-icon">⬆️</span>';
        }
        
        const success = await syncManager.syncToServer();
        
        if (success) {
            if (statusBar) {
                statusBar.innerHTML = '<span id="sync-status-text">上传成功！</span><span id="sync-status-icon">✅</span>';
                setTimeout(() => statusBar.style.display = 'none', 2000);
            }
            updateSyncStats();
        } else {
            if (statusBar) {
                statusBar.style.background = '#dc3545';
                statusBar.innerHTML = '<span id="sync-status-text">上传失败！</span><span id="sync-status-icon">❌</span>';
                setTimeout(() => statusBar.style.display = 'none', 3000);
            }
        }
    } catch (error) {
        console.error('[uploadToServer] 上传失败:', error);
        const statusBar = document.getElementById('sync-status-bar');
        if (statusBar) {
            statusBar.style.background = '#dc3545';
            statusBar.innerHTML = '<span id="sync-status-text">上传失败！</span><span id="sync-status-icon">❌</span>';
            setTimeout(() => statusBar.style.display = 'none', 3000);
        }
    }
}

// 从服务器下载
async function downloadFromServer() {
    if (!syncManager) return;
    
    console.log('[downloadFromServer] 开始从服务器下载');
    
    try {
        const statusBar = document.getElementById('sync-status-bar');
        if (statusBar) {
            statusBar.style.display = 'block';
            statusBar.style.background = '#17a2b8';
            statusBar.innerHTML = '<span id="sync-status-text">正在从服务器下载...</span><span id="sync-status-icon">⬇️</span>';
        }
        
        const success = await syncManager.pullFromServer();
        
        if (success) {
            if (statusBar) {
                statusBar.innerHTML = '<span id="sync-status-text">下载成功！</span><span id="sync-status-icon">✅</span>';
                setTimeout(() => statusBar.style.display = 'none', 2000);
            }
            updateSyncStats();
        } else {
            if (statusBar) {
                statusBar.style.background = '#dc3545';
                statusBar.innerHTML = '<span id="sync-status-text">下载失败！</span><span id="sync-status-icon">❌</span>';
                setTimeout(() => statusBar.style.display = 'none', 3000);
            }
        }
    } catch (error) {
        console.error('[downloadFromServer] 下载失败:', error);
        const statusBar = document.getElementById('sync-status-bar');
        if (statusBar) {
            statusBar.style.background = '#dc3545';
            statusBar.innerHTML = '<span id="sync-status-text">下载失败！</span><span id="sync-status-icon">❌</span>';
            setTimeout(() => statusBar.style.display = 'none', 3000);
        }
    }
}

// 双向同步（智能合并）
async function syncBothWays() {
    if (!syncManager) return;
    
    console.log('[syncBothWays] 开始双向同步');
    
    try {
        const statusBar = document.getElementById('sync-status-bar');
        if (statusBar) {
            statusBar.style.display = 'block';
            statusBar.style.background = '#6c757d';
            statusBar.innerHTML = '<span id="sync-status-text">正在双向同步...</span><span id="sync-status-icon">🔄</span>';
        }
        
        // 1. 先同步 deletedNotes（删除记录）
        await syncDeletedNotes();
        
        // 2. 获取服务器笔记
        const response = await fetch(`${syncManager.getServerUrl()}/notes.json`);
        if (!response.ok) {
            throw new Error(`获取服务器笔记失败: ${response.statusText}`);
        }
        const serverNotes = await response.json();
        
        // 3. 获取本地笔记
        const localNotes = notesData;
        
        // 4. 过滤掉已删除的笔记（关键步骤！）
        const deletedNoteIds = new Set(deletedNotesData.map(item => item.id));
        const filteredServerNotes = serverNotes.filter(note => !deletedNoteIds.has(note.id));
        const filteredLocalNotes = localNotes.filter(note => !deletedNoteIds.has(note.id));
        
        console.log('[syncBothWays] 过滤已删除笔记:', {
            deletedCount: deletedNoteIds.size,
            serverBefore: serverNotes.length,
            serverAfter: filteredServerNotes.length,
            localBefore: localNotes.length,
            localAfter: filteredLocalNotes.length
        });
        
        // 5. 智能合并：找出本地缺少的服务器笔记和服务器缺少的本地笔记
        const localNoteIds = new Set(filteredLocalNotes.map(note => note.id));
        const serverNoteIds = new Set(filteredServerNotes.map(note => note.id));
        
        // 本地缺少的服务器笔记（需要下载）
        const notesToDownload = filteredServerNotes.filter(note => !localNoteIds.has(note.id));
        
        // 服务器缺少的本地笔记（需要上传）
        const notesToUpload = filteredLocalNotes.filter(note => !serverNoteIds.has(note.id));
        
        console.log('[syncBothWays] 同步分析:', {
            localCount: filteredLocalNotes.length,
            serverCount: filteredServerNotes.length,
            toDownload: notesToDownload.length,
            toUpload: notesToUpload.length
        });
        
        let success = true;
        
        // 6. 先上传本地缺少的笔记到服务器
        if (notesToUpload.length > 0) {
            // 创建合并后的笔记列表（保留服务器已有笔记，添加本地新笔记）
            const mergedNotesForServer = [...filteredServerNotes, ...notesToUpload];
            const uploadResponse = await fetch(`${syncManager.getServerUrl()}/notes.json`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(mergedNotesForServer)
            });
            
            if (!uploadResponse.ok) {
                throw new Error(`上传笔记失败: ${uploadResponse.statusText}`);
                success = false;
            }
        }
        
        // 7. 再下载服务器缺少的笔记到本地
        if (notesToDownload.length > 0) {
            // 合并本地笔记和服务器新笔记
            const mergedNotesForLocal = [...filteredLocalNotes, ...notesToDownload];
            
            // 更新本地数据
            notesData = mergedNotesForLocal;
            localStorage.setItem('notes', JSON.stringify(notesData));
            
            // 更新UI
            renderNotes();
        } else {
            // 即使没有新笔记下载，也要更新本地数据（过滤掉已删除的）
            notesData = filteredLocalNotes;
            localStorage.setItem('notes', JSON.stringify(notesData));
            renderNotes();
        }
        
        if (success) {
            if (statusBar) {
                statusBar.innerHTML = '<span id="sync-status-text">双向同步成功！</span><span id="sync-status-icon">✅</span>';
                setTimeout(() => statusBar.style.display = 'none', 2000);
            }
            updateSyncStats();
        } else {
            if (statusBar) {
                statusBar.style.background = '#dc3545';
                statusBar.innerHTML = '<span id="sync-status-text">双向同步失败！</span><span id="sync-status-icon">❌</span>';
                setTimeout(() => statusBar.style.display = 'none', 3000);
            }
        }
    } catch (error) {
        console.error('[syncBothWays] 双向同步失败:', error);
        const statusBar = document.getElementById('sync-status-bar');
        if (statusBar) {
            statusBar.style.background = '#dc3545';
            statusBar.innerHTML = '<span id="sync-status-text">双向同步失败！</span><span id="sync-status-icon">❌</span>';
            setTimeout(() => statusBar.style.display = 'none', 3000);
        }
    }
}

// 查看服务器笔记
async function viewServerNotes() {
    if (!syncManager) return;
    
    console.log('[viewServerNotes] 开始查看服务器笔记');
    
    const container = document.getElementById('server-notes-container');
    const statusBar = document.getElementById('sync-status-bar');
    
    if (container) {
        container.innerHTML = '<p style="color: #17a2b8; text-align: center;">正在加载服务器笔记...</p>';
    }
    
    try {
        if (statusBar) {
            statusBar.style.display = 'block';
            statusBar.style.background = '#17a2b8';
            statusBar.innerHTML = '<span id="sync-status-text">正在获取服务器笔记...</span><span id="sync-status-icon">📋</span>';
        }
        
        const response = await fetch(`${syncManager.getServerUrl()}/notes.json`);
        if (!response.ok) {
            throw new Error(`获取失败: ${response.statusText}`);
        }
        
        const serverNotes = await response.json();
        console.log('[viewServerNotes] 服务器笔记数量:', serverNotes.length);
        
        displayServerNotes(container, serverNotes, statusBar, false);
        
        // 更新统计信息
        updateSyncStats();
    } catch (error) {
        console.error('[viewServerNotes] 获取服务器笔记失败:', error);
        
        // 服务器不可用时，显示示例数据
        const exampleNotes = generateServerNotesOfflineExample();
        displayServerNotes(container, exampleNotes, statusBar, true);
    }
}

// 显示服务器笔记
function displayServerNotes(container, notes, statusBar, isExample = false) {
    if (container) {
        if (notes.length === 0) {
            container.innerHTML = '<p style="color: #999; text-align: center;">服务器上没有笔记</p>';
        } else {
            const notesHtml = notes.map(note => {
                // 生成笔记摘要
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = note.content || '';
                const textContent = tempDiv.textContent || tempDiv.innerText || '';
                const excerpt = textContent.trim().substring(0, 50) + (textContent.length > 50 ? '...' : '');
                
                return `
                    <div class="server-note-item" style="margin-bottom: 0.5rem; padding: 0.5rem; background: white; border: 1px solid #e0e0e0; border-radius: 4px; display: flex; justify-content: space-between; align-items: flex-start; position: relative;">
                        <div style="flex: 1; cursor: pointer;" onclick="viewNoteDetail('${note.id}')" title="点击查看笔记详情">
                            <div style="font-weight: bold; margin-bottom: 0.25rem;">${note.title || '无标题'}</div>
                            <div style="font-size: 0.8rem; color: #666; margin-bottom: 0.25rem;">${note.author} · ${formatDate(note.createdAt)}</div>
                            <div style="font-size: 0.8rem; color: #999;">${excerpt}</div>
                            ${isExample ? '<div style="font-size: 0.8rem; color: #17a2b8; margin-top: 0.25rem;">（示例数据）</div>' : ''}
                        </div>
                        <div style="display: flex; gap: 0.25rem; z-index: 10;">
                            <button class="server-note-view-btn" onclick="event.stopPropagation(); viewNoteDetail('${note.id}')" style="background: #17a2b8; color: white; border: none; border-radius: 4px; font-size: 0.8rem; padding: 0.25rem 0.5rem; cursor: pointer; display: inline-block !important; visibility: visible !important;">👁️ 查看</button>
                        </div>
                    </div>
                `;
            }).join('');
            
            container.innerHTML = notesHtml;
        }
    }
    
    if (statusBar) {
        if (isExample) {
            statusBar.innerHTML = '<span id="sync-status-text">服务器不可用，显示示例数据</span><span id="sync-status-icon">📋</span>';
        } else {
            statusBar.innerHTML = `<span id="sync-status-text">获取服务器笔记成功！共 ${notes.length} 条</span><span id="sync-status-icon">✅</span>`;
        }
        setTimeout(() => statusBar.style.display = 'none', 2000);
    }
}

// 查看笔记详情
function viewNoteDetail(noteId) {
    console.log('[viewNoteDetail] 查看笔记详情:', noteId);
    
    // 查找本地笔记
    let note = notesData.find(n => n.id === noteId);
    
    if (note) {
        // 本地有该笔记，直接显示
        showFullNote(note);
    } else {
        // 本地没有该笔记，尝试从服务器获取
        fetchServerNote(noteId);
    }
}

// 从服务器获取笔记
async function fetchServerNote(noteId) {
    if (!syncManager) return;
    
    console.log('[fetchServerNote] 从服务器获取笔记:', noteId);
    
    const statusBar = document.getElementById('sync-status-bar');
    if (statusBar) {
        statusBar.style.display = 'block';
        statusBar.style.background = '#17a2b8';
        statusBar.innerHTML = '<span id="sync-status-text">正在获取笔记详情...</span><span id="sync-status-icon">📋</span>';
    }
    
    try {
        const response = await fetch(`${syncManager.getServerUrl()}/notes/${noteId}`);
        if (!response.ok) {
            throw new Error(`获取笔记失败: ${response.statusText}`);
        }
        
        const note = await response.json();
        console.log('[fetchServerNote] 获取笔记成功:', note);
        
        // 显示笔记详情
        showFullNote(note);
        
        if (statusBar) {
            statusBar.style.display = 'none';
        }
    } catch (error) {
        console.error('[fetchServerNote] 获取笔记失败:', error);
        
        if (statusBar) {
            statusBar.style.background = '#dc3545';
            statusBar.innerHTML = '<span id="sync-status-text">获取笔记失败！</span><span id="sync-status-icon">❌</span>';
            setTimeout(() => statusBar.style.display = 'none', 3000);
        }
    }
}

// 显示完整笔记
function showFullNote(note) {
    console.log('[showFullNote] 显示完整笔记:', note.id);
    
    const modal = document.getElementById('full-note-modal');
    const titleEl = modal.querySelector('.full-note-title');
    const metaEl = modal.querySelector('.full-note-meta');
    const bodyEl = modal.querySelector('.full-note-body');
    const commentsEl = modal.querySelector('.comments-section');
    
    // 设置笔记内容
    titleEl.textContent = note.title || '无标题';
    metaEl.innerHTML = `
        <span class="note-author">✍️ ${note.author || '未知作者'}</span>
        <span class="note-date">${formatDate(note.createdAt)}</span>
    `;
    bodyEl.innerHTML = note.content || '';
    
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
                                ${comment.author === (currentUser ? currentUser.nickname : '') ? `
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
                                                ${reply.author === (currentUser ? currentUser.nickname : '') ? `
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
        
        <!-- 删除按钮放在右下角 -->
        <div style="display: flex; justify-content: flex-end; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e0e0e0;">
            <button class="btn-primary" onclick="window.deleteNote && window.deleteNote('${note.id}')" style="background: #dc3545;">
                🗑️ 删除笔记
            </button>
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
    
    // 显示模态框
    modal.classList.add('active');
}

// 删除服务器上的笔记
async function deleteServerNote(noteId) {
    if (!syncManager || !confirm('确定要删除服务器上的这条笔记吗？此操作不可恢复！')) return;
    
    console.log(`[deleteServerNote] 删除服务器笔记: ${noteId}`);
    
    const statusBar = document.getElementById('sync-status-bar');
    
    try {
        if (statusBar) {
            statusBar.style.display = 'block';
            statusBar.style.background = '#dc3545';
            statusBar.innerHTML = '<span id="sync-status-text">正在删除服务器笔记...</span><span id="sync-status-icon">🗑️</span>';
        }
        
        const response = await fetch(`${syncManager.getServerUrl()}/notes/${noteId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`删除失败: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('[deleteServerNote] 删除成功:', result);
        
        if (statusBar) {
            statusBar.innerHTML = '<span id="sync-status-text">删除服务器笔记成功！</span><span id="sync-status-icon">✅</span>';
            setTimeout(() => statusBar.style.display = 'none', 2000);
        }
        
        // 重新加载服务器笔记列表
        viewServerNotes();
        updateSyncStats();
    } catch (error) {
        console.error('[deleteServerNote] 删除服务器笔记失败:', error);
        
        if (statusBar) {
            statusBar.style.background = '#dc3545';
            statusBar.innerHTML = '<span id="sync-status-text">删除服务器笔记失败！</span><span id="sync-status-icon">❌</span>';
            setTimeout(() => statusBar.style.display = 'none', 3000);
        }
    }
}

// 生成服务器笔记离线示例
function generateServerNotesOfflineExample() {
    // 生成示例笔记数据
    const exampleNotes = [
        {
            id: 'example-1',
            title: '示例笔记 1',
            content: '<p>这是服务器上的第一条示例笔记</p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==" alt="示例图片">',
            author: '用户1',
            comments: [],
            createdAt: '2026-03-01T10:00:00.000Z',
            updatedAt: '2026-03-01T10:00:00.000Z'
        },
        {
            id: 'example-2',
            title: '示例笔记 2',
            content: '<p>这是服务器上的第二条示例笔记</p>',
            author: '用户2',
            comments: [],
            createdAt: '2026-03-02T14:30:00.000Z',
            updatedAt: '2026-03-02T14:30:00.000Z'
        },
        {
            id: 'example-3',
            title: '示例笔记 3',
            content: '<p>这是服务器上的第三条示例笔记，包含了一些详细内容</p><p>这是第二行内容</p>',
            author: '用户1',
            comments: [],
            createdAt: '2026-03-03T09:15:00.000Z',
            updatedAt: '2026-03-03T09:15:00.000Z'
        }
    ];
    
    return exampleNotes;
}

// 更新同步统计信息
async function updateSyncStats() {
    // 更新本地笔记数量
    const localCountEl = document.getElementById('local-count');
    if (localCountEl) {
        localCountEl.textContent = notesData.length;
    }
    
    // 获取服务器笔记数量
    try {
        if (syncManager && navigator.onLine) {
            const response = await fetch(`${syncManager.getServerUrl()}/notes.json`);
            if (response.ok) {
                const serverNotes = await response.json();
                const serverCountEl = document.getElementById('server-count');
                if (serverCountEl) {
                    serverCountEl.textContent = serverNotes.length;
                }
            }
        }
    } catch (error) {
        console.error('[updateSyncStats] 获取服务器笔记数量失败:', error);
    }
    

}

// 立即同步数据（兼容旧版）
async function syncData() {
    await syncBothWays();
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

// 全局变量：当前筛选条件
let currentFilter = 'all';

// 自定义确认对话框实现
function showConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-title');
        const messageEl = document.getElementById('confirm-message');
        const okBtn = document.getElementById('confirm-ok');
        const cancelBtn = document.getElementById('confirm-cancel');
        
        if (!modal || !titleEl || !messageEl || !okBtn || !cancelBtn) {
            console.warn('[showConfirm] 确认对话框元素未找到，直接返回true');
            resolve(true);
            return;
        }
        
        titleEl.textContent = title;
        messageEl.textContent = message;
        
        // 清理之前的事件监听器
        const newOkBtn = okBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        
        // 绑定新的事件监听器
        newOkBtn.addEventListener('click', () => {
            modal.classList.remove('show');
            resolve(true);
        });
        
        newCancelBtn.addEventListener('click', () => {
            modal.classList.remove('show');
            resolve(false);
        });
        
        // 点击关闭按钮或模态框外部关闭
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            newCloseBtn.addEventListener('click', () => {
                modal.classList.remove('show');
                resolve(false);
            });
        }
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
                resolve(false);
            }
        });
        
        modal.classList.add('show');
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
    
    // 更新同步统计信息
    updateSyncStats();
    
    // 初始双向同步（只执行一次，把本地未上传数据上传到服务器，把服务器未下载数据下载到本地）
    setTimeout(async () => {
        if (syncManager && navigator.onLine) {
            await syncBothWays();
        }
    }, 3000); // 延迟3秒执行，避免阻塞页面加载
    
    // 添加筛选按钮事件监听器
    addFilterEventListeners();
    
    // 添加清除缓存按钮事件监听器
    addClearCacheEventListener();
    
    // 检查Service Worker是否需要更新
    checkServiceWorkerUpdate();
});

// 添加清除缓存按钮事件监听器
function addClearCacheEventListener() {
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', clearCache);
    }
}

// 清除缓存函数
async function clearCache() {
    console.log('[clearCache] 开始清除缓存');
    
    // 显示同步状态
    const statusBar = document.getElementById('sync-status-bar');
    if (statusBar) {
        statusBar.style.display = 'block';
        statusBar.style.background = '#28a745';
        statusBar.innerHTML = '<span id="sync-status-text">正在清除缓存...</span><span id="sync-status-icon">🔄</span>';
    }
    
    try {
        // 1. 清除Service Worker缓存
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                // 发送消息给Service Worker，清除缓存
                if (registration.active) {
                    registration.active.postMessage('clearCache');
                }
                // 注销Service Worker
                await registration.unregister();
            }
        }
        
        // 2. 清除浏览器缓存
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            for (const cacheName of cacheNames) {
                await caches.delete(cacheName);
            }
        }
        
        // 3. 清除localStorage和sessionStorage
        localStorage.clear();
        sessionStorage.clear();
        
        // 4. 刷新页面
        setTimeout(() => {
            window.location.reload(true); // 强制刷新页面
        }, 1000);
        
    } catch (error) {
        console.error('[clearCache] 清除缓存失败:', error);
        if (statusBar) {
            statusBar.style.background = '#dc3545';
            statusBar.innerHTML = '<span id="sync-status-text">清除缓存失败！</span><span id="sync-status-icon">❌</span>';
            setTimeout(() => statusBar.style.display = 'none', 3000);
        }
    }
}

// 检查Service Worker是否需要更新
async function checkServiceWorkerUpdate() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('service-worker.js');
            
            // 检查是否有新的Service Worker等待激活
            if (registration.waiting) {
                console.log('[checkServiceWorkerUpdate] 发现新的Service Worker，正在激活...');
                // 发送消息给等待的Service Worker，让它立即激活
                registration.waiting.postMessage('skipWaiting');
            }
            
            // 监听更新事件
            registration.addEventListener('updatefound', () => {
                console.log('[checkServiceWorkerUpdate] 正在下载新的Service Worker...');
                const newWorker = registration.installing;
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                console.log('[checkServiceWorkerUpdate] 新的Service Worker已准备好，正在激活...');
                                newWorker.postMessage('skipWaiting');
                            }
                        }
                    });
                }
            });
            
        } catch (error) {
            console.error('[checkServiceWorkerUpdate] 注册Service Worker失败:', error);
        }
    }
}

// 添加筛选下拉框事件监听器
function addFilterEventListeners() {
    const filterSelect = document.getElementById('note-filter');
    if (filterSelect) {
        filterSelect.addEventListener('change', function() {
            // 更新当前筛选条件
            currentFilter = this.value;
            // 重新渲染笔记
            renderNotes();
        });
    }
}

// 检查笔记是否符合筛选条件
function isNoteInFilter(note) {
    const now = new Date();
    const noteDate = new Date(note.createdAt || note.updatedAt);
    const diffTime = Math.abs(now - noteDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    switch (currentFilter) {
        case '6months':
            return diffDays <= 180;
        case '3months':
            return diffDays <= 90;
        case '1month':
            return diffDays <= 30;
        case 'all':
        default:
            return true;
    }
}

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
    
    // 服务器设置按钮
    const serverSettingsBtn = document.getElementById('server-settings-btn');
    const serverSettingsModal = document.getElementById('server-settings-modal');
    serverSettingsBtn.addEventListener('click', function() {
        serverSettingsModal.classList.add('show');
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
        // 显示加载状态
        const statusBar = document.getElementById('sync-status-bar');
        if (statusBar) {
            statusBar.style.display = 'block';
            statusBar.style.background = '#17a2b8';
            statusBar.innerHTML = '<span id="sync-status-text">正在处理图片...</span><span id="sync-status-icon">🖼️</span>';
        }
        
        try {
            // 直接使用FileReader读取图片（不压缩，避免压缩失败）
            const reader = new FileReader();
            const base64Data = await new Promise((resolve, reject) => {
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            
            // 尝试压缩图片，如果失败则使用原图
            let finalUrl = base64Data;
            try {
                finalUrl = await compressImage(file);
            } catch (compressError) {
                console.warn('[handleInsertMedia] 图片压缩失败，使用原图:', compressError);
                finalUrl = base64Data;
            }
            
            // 插入图片到编辑器
            insertMediaIntoEditor(finalUrl, type, file.name);
            
            // 显示成功状态
            if (statusBar) {
                statusBar.style.background = '#28a745';
                statusBar.innerHTML = '<span id="sync-status-text">图片插入成功！</span><span id="sync-status-icon">✅</span>';
                setTimeout(() => {
                    statusBar.style.display = 'none';
                }, 2000);
            }
            
            console.log('[handleInsertMedia] 图片插入成功');
        } catch (error) {
            console.error('[handleInsertMedia] 处理图片失败:', error);
            
            // 显示失败状态
            if (statusBar) {
                statusBar.style.background = '#dc3545';
                statusBar.innerHTML = '<span id="sync-status-text">图片处理失败，请重试</span><span id="sync-status-icon">❌</span>';
                setTimeout(() => {
                    statusBar.style.display = 'none';
                }, 3000);
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

// 添加笔记（乐观更新）
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
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending' // 标记为待同步状态
    };
    
    // 乐观更新：立即添加到数据缓存并渲染
    notesData.unshift(newNote);
    localStorage.setItem('notes', JSON.stringify(notesData));
    
    // 重置表单并关闭模态框
    document.getElementById('note-form').reset();
    document.getElementById('note-content').innerHTML = '';
    document.getElementById('note-modal').classList.remove('show');
    
    // 立即渲染笔记列表（乐观更新）
    renderNotes();
    
    // 异步同步到服务器（不阻塞UI）
    debouncedSync(newNote);
}

// 渲染笔记列表
function renderNotes() {
    console.log('[renderNotes] 开始执行');
    console.log('[renderNotes] notesData:', notesData);
    
    // 确保notesData是数组
    if (!Array.isArray(notesData)) {
        console.error('[renderNotes] notesData不是数组，尝试从localStorage重新加载');
        // 尝试从localStorage重新加载数据，而不是直接重置为空数组
        const storedNotes = localStorage.getItem('notes');
        notesData = storedNotes ? JSON.parse(storedNotes) : [];
        // 再次检查是否为数组
        if (!Array.isArray(notesData)) {
            console.error('[renderNotes] 从localStorage加载的数据也不是数组，重置为空数组');
            notesData = [];
            localStorage.setItem('notes', JSON.stringify(notesData));
        }
    }
    
    // 根据当前筛选条件过滤笔记，并排除已删除的笔记
    const deletedNoteIds = new Set(deletedNotesData.map(item => item.id));
    const filteredNotes = notesData.filter(note => isNoteInFilter(note) && !deletedNoteIds.has(note.id));
    console.log('[renderNotes] 已删除笔记ID集合:', deletedNoteIds);
    console.log('[renderNotes] 过滤后笔记数量:', filteredNotes.length);
    
    const notesContainer = document.getElementById('notes-container');
    
    if (!notesContainer) {
        console.error('[renderNotes] notes-container元素未找到');
        return;
    }
    
    console.log('[renderNotes] 渲染', filteredNotes.length, '条笔记（总笔记数：', notesData.length, '，筛选条件：', currentFilter, '）');
    
    if (filteredNotes.length === 0) {
        console.log('[renderNotes] 没有符合条件的笔记可渲染');
        notesContainer.innerHTML = `<p style="text-align: center; color: #999; grid-column: 1 / -1; padding: 2rem; font-size: 1.2rem;">${notesData.length === 0 ? '还没有笔记，快来添加第一条吧！' : '没有符合筛选条件的笔记'}</p>`;
        return;
    }
    
    try {
        const notesHtml = filteredNotes.map(note => {
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
        
        <!-- 删除按钮放在右下角 -->
        <div style="display: flex; justify-content: flex-end; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e0e0e0;">
            <button class="btn-primary" onclick="window.deleteNote && window.deleteNote('${note.id}')" style="background: #dc3545;">
                🗑️ 删除笔记
            </button>
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

// 删除笔记（统一删除：本地+服务器）
window.deleteNote = async function deleteNote(noteId) {
    console.log('[deleteNote] 开始删除流程，noteId:', noteId);
    
    // 先关闭笔记详情页，让确认框正常显示
    const modal = document.getElementById('full-note-modal');
    if (modal) {
        modal.classList.remove('active');
        console.log('[deleteNote] 已关闭笔记详情页');
    }
    
    // 等待一下，确保模态框关闭
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 使用自定义确认对话框
    const isConfirmed = await showConfirm('确认删除', '确定要删除这篇笔记吗？删除后将同步到所有设备，无法恢复！');
    console.log('[deleteNote] 用户确认结果:', isConfirmed);
    
    // 执行删除操作
    if (isConfirmed === true) {
        console.log('[deleteNote] 用户确认删除，开始执行统一删除操作');
        
        // 显示删除状态
        const statusBar = document.getElementById('sync-status-bar');
        if (statusBar) {
            statusBar.style.display = 'block';
            statusBar.style.background = '#dc3545';
            statusBar.innerHTML = '<span id="sync-status-text">正在删除笔记...</span><span id="sync-status-icon">🗑️</span>';
        }
        
        // 保存要删除的笔记数据，以便在服务器删除失败时可以恢复
        const noteToDelete = notesData.find(note => note.id === noteId);
        
        // 1. 从本地数据缓存中删除笔记（如果存在）
        const initialLength = notesData.length;
        notesData = notesData.filter(note => note.id !== noteId);
        console.log('[deleteNote] 从本地删除后，笔记数量从', initialLength, '变为', notesData.length);
        
        // 2. 添加到本地已删除笔记列表
        const deletedItem = {
            id: noteId,
            deletedAt: new Date().toISOString()
        };
        
        // 检查是否已存在，避免重复添加
        const existingIndex = deletedNotesData.findIndex(item => item.id === noteId);
        if (existingIndex === -1) {
            deletedNotesData.push(deletedItem);
        } else {
            deletedNotesData[existingIndex] = deletedItem;
        }
        
        // 保存到localStorage
        localStorage.setItem('notes', JSON.stringify(notesData));
        localStorage.setItem('deletedNotes', JSON.stringify(deletedNotesData));
        console.log('[deleteNote] 已保存到本地localStorage');
        
        // 重新渲染笔记列表
        renderNotes();
        console.log('[deleteNote] 已重新渲染笔记列表');
        
        // 3. 尝试删除服务器上的笔记
        let serverDeleteSuccess = false;
        if (syncManager && navigator.onLine) {
            try {
                const response = await fetch(`${syncManager.getServerUrl()}/notes/${noteId}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    console.log('[deleteNote] 服务器笔记删除成功');
                    serverDeleteSuccess = true;
                    
                    // 4. 同步 deletedNotes 到服务器
                    await syncDeletedNotes();
                    console.log('[deleteNote] 已同步删除记录到服务器');
                } else {
                    console.warn('[deleteNote] 服务器笔记删除失败，HTTP状态:', response.status);
                }
            } catch (error) {
                console.warn('[deleteNote] 连接服务器失败:', error);
            }
        } else {
            console.log('[deleteNote] 离线模式，删除记录将在下次同步时上传');
            serverDeleteSuccess = true; // 离线模式视为成功
        }
        
        // 如果服务器删除失败，提供恢复选项
        if (!serverDeleteSuccess && noteToDelete) {
            console.warn('[deleteNote] 服务器删除失败，询问用户是否恢复');
            
            const shouldRestore = await showConfirm(
                '服务器删除失败',
                '服务器删除失败，但本地已删除。是否要恢复笔记？（恢复后可重试删除）'
            );
            
            if (shouldRestore) {
                // 恢复笔记
                notesData.push(noteToDelete);
                deletedNotesData = deletedNotesData.filter(item => item.id !== noteId);
                localStorage.setItem('notes', JSON.stringify(notesData));
                localStorage.setItem('deletedNotes', JSON.stringify(deletedNotesData));
                renderNotes();
                
                console.log('[deleteNote] 已恢复笔记');
                if (statusBar) {
                    statusBar.innerHTML = '<span id="sync-status-text">笔记已恢复！</span><span id="sync-status-icon">⚠️</span>';
                    setTimeout(() => statusBar.style.display = 'none', 3000);
                }
                return;
            }
        }
        
        // 显示成功状态
        if (statusBar) {
            const statusMessage = serverDeleteSuccess 
                ? '笔记已成功删除！' 
                : '本地已删除，服务器删除失败';
            const statusIcon = serverDeleteSuccess ? '✅' : '⚠️';
            statusBar.innerHTML = `<span id="sync-status-text">${statusMessage}</span><span id="sync-status-icon">${statusIcon}</span>`;
            setTimeout(() => statusBar.style.display = 'none', 3000);
        }
    } else {
        console.log('[deleteNote] 用户取消了删除操作');
        // 如果用户取消删除，重新打开笔记详情页
        if (modal) {
            setTimeout(() => {
                openFullNote(noteId);
            }, 100);
        }
    }
}

// 同步已删除笔记列表到服务器
async function syncDeletedNotes() {
    if (!syncManager || !navigator.onLine) {
        console.log('[syncDeletedNotes] 离线模式，跳过同步');
        return;
    }
    
    console.log('[syncDeletedNotes] 开始同步删除记录');
    
    try {
        // 先获取服务器的删除记录
        const getResponse = await fetch(`${syncManager.getServerUrl()}/deleted-notes.json`);
        if (!getResponse.ok) {
            throw new Error('获取服务器删除记录失败');
        }
        
        const serverDeletedNotes = await getResponse.json();
        
        // 合并本地和服务器的删除记录
        const mergedDeletedNotes = [...deletedNotesData];
        const localIds = new Set(deletedNotesData.map(item => item.id));
        
        serverDeletedNotes.forEach(item => {
            if (!localIds.has(item.id)) {
                mergedDeletedNotes.push(item);
            }
        });
        
        // 上传合并后的删除记录到服务器
        const putResponse = await fetch(`${syncManager.getServerUrl()}/deleted-notes.json`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(mergedDeletedNotes)
        });
        
        if (!putResponse.ok) {
            throw new Error('上传删除记录失败');
        }
        
        // 更新本地删除记录
        deletedNotesData = mergedDeletedNotes;
        localStorage.setItem('deletedNotes', JSON.stringify(deletedNotesData));
        
        console.log('[syncDeletedNotes] 同步完成，共', deletedNotesData.length, '条删除记录');
    } catch (error) {
        console.error('[syncDeletedNotes] 同步失败:', error);
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
            if (syncManager) {
                syncManager.addToSyncQueue('delete', 'album', album);
            }
            
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
    if (syncManager) {
        syncManager.addToSyncQueue('add', 'album', newAlbum);
    }
    
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
            if (syncManager) {
                syncManager.addToSyncQueue('update', 'album', currentAlbum);
            }
            
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
            if (syncManager) {
                syncManager.addToSyncQueue('update', 'album', currentAlbum);
            }
            
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
            if (syncManager) {
                syncManager.saveServerUrl(newServerUrl);
            }
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
    // 设置服务器URL输入框的值
    const serverUrlInput = document.getElementById('server-url');
    if (serverUrlInput && syncManager) {
        serverUrlInput.value = syncManager.getServerUrl();
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