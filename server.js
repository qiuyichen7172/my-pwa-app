// 本地同步服务器
// 用于存储和同步PWA应用的数据

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'sync-data.json');

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' })); // 增加请求体大小限制

// 静态文件服务 - 提供HTML、CSS、JS等静态资源
app.use(express.static(path.join(__dirname), {
    // 为静态资源添加缓存控制头
    setHeaders: (res, path) => {
        // 所有文件都设置严格的缓存控制
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        // 添加ETag，帮助浏览器验证资源是否更新
        res.setHeader('ETag', `"${Date.now()}-${Math.random().toString(36).substr(2, 9)}"`);
    }
}));

// 添加缓存控制中间件
app.use((req, res, next) => {
    // 设置全局缓存控制头
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// 初始化数据文件
function initDataFile() {
    if (!fs.existsSync(DATA_FILE)) {
        const initialData = {
            notes: [],
            albums: [],
            devices: [],
            lastUpdate: new Date().toISOString()
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
        console.log('[initDataFile] 初始化数据文件成功:', DATA_FILE);
    }
}

// 健康检查端点
app.get('/ping', (req, res) => {
    console.log('[ping] 收到健康检查请求');
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        message: '本地同步服务器正在运行'
    });
});

// 获取最新数据端点
app.get('/data', (req, res) => {
    console.log('[get-data] 收到获取数据请求');
    
    initDataFile();
    
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        console.log(`[get-data] 返回数据：${data.notes?.length} 条笔记，${data.albums?.length} 个相册`);
        res.json(data);
    } catch (error) {
        console.error('[get-data] 读取数据文件失败:', error);
        res.status(500).json({ 
            error: '读取数据失败',
            message: '无法读取数据文件，请检查服务器状态' 
        });
    }
});

// 同步数据端点
app.post('/sync', (req, res) => {
    console.log('[sync] 收到同步请求');
    
    const { queue, deviceId } = req.body;
    
    // 验证请求数据
    if (!queue || !Array.isArray(queue)) {
        console.error('[sync] 无效的同步队列');
        return res.status(400).json({ 
            error: '无效的同步队列',
            message: '请提供有效的同步队列' 
        });
    }
    
    if (!deviceId) {
        console.error('[sync] 缺少设备ID');
        return res.status(400).json({ 
            error: '缺少设备ID',
            message: '请提供有效的设备ID' 
        });
    }
    
    console.log(`[sync] 处理来自设备 ${deviceId} 的 ${queue.length} 条同步记录`);
    
    initDataFile();
    
    try {
        // 读取现有数据
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        
        // 处理同步队列
        let processedCount = 0;
        queue.forEach(item => {
            try {
                processSyncItem(data, item, deviceId);
                processedCount++;
            } catch (error) {
                console.error(`[sync] 处理同步记录失败 (${item.id}):`, error);
            }
        });
        
        // 更新最后更新时间
        data.lastUpdate = new Date().toISOString();
        
        // 保存数据
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        
        console.log(`[sync] 同步完成，成功处理 ${processedCount} 条记录`);
        res.json({ 
            success: true, 
            message: `处理了${processedCount}条同步记录`,
            lastUpdate: data.lastUpdate,
            totalProcessed: processedCount
        });
    } catch (error) {
        console.error('[sync] 同步处理失败:', error);
        res.status(500).json({ 
            error: '同步处理失败',
            message: '处理同步数据时发生错误' 
        });
    }
});

// 处理单条同步记录
function processSyncItem(data, item, deviceId) {
    const { id, type, dataType, data: itemData, timestamp } = item;
    
    console.log(`[processSyncItem] 处理记录: ${type} ${dataType} ${itemData.id}`);
    
    // 确保数据类型存在
    if (!data[dataType]) {
        data[dataType] = [];
    }
    
    if (dataType === 'note') {
        processNoteSync(data, item, deviceId);
    } else if (dataType === 'album') {
        processAlbumSync(data, item, deviceId);
    } else {
        console.warn(`[processSyncItem] 未知的数据类型: ${dataType}`);
    }
}

// 处理笔记同步
function processNoteSync(data, item, deviceId) {
    const { type, data: note } = item;
    
    if (type === 'add' || type === 'update') {
        // 查找现有笔记
        const existingIndex = data.notes.findIndex(n => n.id === note.id);
        
        if (existingIndex !== -1) {
            // 现有笔记，按时间戳更新
            const existingNote = data.notes[existingIndex];
            const existingTime = new Date(existingNote.updatedAt || existingNote.createdAt);
            const newTime = new Date(note.updatedAt || note.createdAt);
            
            if (newTime > existingTime) {
                console.log(`[processNoteSync] 更新笔记: ${note.id}`);
                data.notes[existingIndex] = note;
            } else {
                console.log(`[processNoteSync] 跳过旧笔记: ${note.id}`);
            }
        } else {
            // 新笔记，直接添加
            console.log(`[processNoteSync] 添加新笔记: ${note.id}`);
            data.notes.push(note);
        }
    } else if (type === 'delete') {
        // 删除笔记
        console.log(`[processNoteSync] 删除笔记: ${note.id}`);
        data.notes = data.notes.filter(n => n.id !== note.id);
    }
}

// 处理相册同步
function processAlbumSync(data, item, deviceId) {
    const { type, data: album } = item;
    
    if (type === 'add' || type === 'update') {
        // 查找现有相册
        const existingIndex = data.albums.findIndex(a => a.id === album.id);
        
        if (existingIndex !== -1) {
            // 现有相册，按时间戳更新
            const existingAlbum = data.albums[existingIndex];
            const existingTime = new Date(existingAlbum.updatedAt || existingAlbum.createdAt);
            const newTime = new Date(album.updatedAt || album.createdAt);
            
            if (newTime > existingTime) {
                console.log(`[processAlbumSync] 更新相册: ${album.id}，媒体文件数: ${album.media?.length || 0}`);
                data.albums[existingIndex] = album;
            } else {
                console.log(`[processAlbumSync] 跳过旧相册: ${album.id}`);
            }
        } else {
            // 新相册，直接添加
            console.log(`[processAlbumSync] 添加新相册: ${album.id}`);
            data.albums.push(album);
        }
    } else if (type === 'delete') {
        // 删除相册
        console.log(`[processAlbumSync] 删除相册: ${album.id}`);
        data.albums = data.albums.filter(a => a.id !== album.id);
    }
}

// API端点 - 获取所有笔记
app.get('/notes.json', (req, res) => {
    console.log('[GET /notes.json] 收到获取所有笔记请求');
    
    initDataFile();
    
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        res.json(data.notes || []);
        console.log(`[GET /notes.json] 返回 ${data.notes?.length || 0} 条笔记`);
    } catch (error) {
        console.error('[GET /notes.json] 读取数据失败:', error);
        res.status(500).json({ 
            error: '读取数据失败',
            message: '无法读取笔记数据' 
        });
    }
});

// API端点 - 保存所有笔记
app.put('/notes.json', (req, res) => {
    console.log('[PUT /notes.json] 收到保存所有笔记请求');
    
    const notes = req.body || [];
    
    if (!Array.isArray(notes)) {
        console.error('[PUT /notes.json] 无效的笔记数据格式');
        return res.status(400).json({ 
            error: '无效的数据格式',
            message: '笔记数据必须是数组格式' 
        });
    }
    
    initDataFile();
    
    try {
        // 读取现有数据
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        
        // 更新笔记数据
        data.notes = notes;
        data.lastUpdate = new Date().toISOString();
        
        // 保存数据
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        
        console.log(`[PUT /notes.json] 保存成功，共 ${notes.length} 条笔记`);
        res.json({ 
            success: true, 
            message: `保存了${notes.length}条笔记`,
            lastUpdate: data.lastUpdate,
            totalNotes: notes.length
        });
    } catch (error) {
        console.error('[PUT /notes.json] 保存数据失败:', error);
        res.status(500).json({ 
            error: '保存数据失败',
            message: '无法保存笔记数据' 
        });
    }
});

// API端点 - 删除服务器上的笔记
app.delete('/notes/:noteId', (req, res) => {
    console.log(`[DELETE /notes/:noteId] 收到删除笔记请求: ${req.params.noteId}`);
    
    const noteId = req.params.noteId;
    
    if (!noteId) {
        return res.status(400).json({ 
            error: '参数缺失',
            message: '请提供笔记ID' 
        });
    }
    
    initDataFile();
    
    try {
        // 读取现有数据
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        
        // 过滤掉要删除的笔记
        const originalCount = data.notes?.length || 0;
        data.notes = data.notes?.filter(note => note.id !== noteId) || [];
        const newCount = data.notes.length;
        
        // 更新最后更新时间
        data.lastUpdate = new Date().toISOString();
        
        // 保存数据
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        
        console.log(`[DELETE /notes/:noteId] 删除成功，删除了 ${originalCount - newCount} 条笔记`);
        res.json({ 
            success: true, 
            message: `成功删除笔记: ${noteId}`,
            lastUpdate: data.lastUpdate,
            totalNotes: newCount,
            deletedCount: originalCount - newCount
        });
    } catch (error) {
        console.error('[DELETE /notes/:noteId] 删除数据失败:', error);
        res.status(500).json({ 
            error: '删除数据失败',
            message: '无法删除笔记数据' 
        });
    }
});



// API端点 - 上传图片（base64）
app.post('/upload', (req, res) => {
    console.log('[POST /upload] 收到图片上传请求');
    
    const { filename, data } = req.body;
    
    if (!filename || !data) {
        console.error('[POST /upload] 缺少文件名或图片数据');
        return res.status(400).json({ 
            error: '参数缺失',
            message: '请提供文件名和图片数据' 
        });
    }
    
    try {
        // 创建uploads目录（如果不存在）
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
            console.log('[POST /upload] 创建uploads目录');
        }
        
        // 从base64数据中提取二进制数据
        const base64Data = data.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');
        const binaryData = Buffer.from(base64Data, 'base64');
        
        // 生成唯一文件名
        const uniqueFilename = `${Date.now()}-${filename}`;
        const filePath = path.join(uploadsDir, uniqueFilename);
        
        // 保存文件
        fs.writeFileSync(filePath, binaryData);
        
        console.log('[POST /upload] 图片上传成功:', uniqueFilename);
        
        // 返回访问URL
        res.json({ 
            success: true, 
            message: '图片上传成功',
            filename: uniqueFilename,
            url: `${req.protocol}://${req.get('host')}/uploads/${uniqueFilename}`
        });
    } catch (error) {
        console.error('[POST /upload] 图片上传失败:', error);
        res.status(500).json({ 
            error: '上传失败',
            message: '无法上传图片' 
        });
    }
});

// 静态文件服务 - 提供uploads目录下的文件
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 启动服务器
app.listen(PORT, () => {
    console.log('=' .repeat(60));
    console.log('本地同步服务器已启动');
    console.log(`服务地址: http://localhost:${PORT}`);
    console.log('=' .repeat(60));
    console.log('可用端点:');
    console.log(`  GET  http://localhost:${PORT}/ping       - 健康检查`);
    console.log(`  GET  http://localhost:${PORT}/data       - 获取所有数据`);
    console.log(`  POST http://localhost:${PORT}/sync       - 同步数据`);
    console.log(`  GET  http://localhost:${PORT}/notes.json - 获取所有笔记`);
    console.log(`  PUT  http://localhost:${PORT}/notes.json - 保存所有笔记`);
    console.log(`  POST http://localhost:${PORT}/upload     - 上传图片（base64）`);
    console.log('=' .repeat(60));
    console.log('使用说明:');
    console.log('1. 启动服务器: node server.js');
    console.log('2. 使用Ngrok进行内网穿透: ngrok http 3000');
    console.log('3. 在PWA应用中配置Ngrok生成的URL');
    console.log('4. 应用将自动检测并同步数据');
    console.log('=' .repeat(60));
    console.log('数据文件:', DATA_FILE);
    console.log('上传目录:', path.join(__dirname, 'uploads'));
    console.log('=' .repeat(60));
    
    // 初始化数据文件
    initDataFile();
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
    console.error('[uncaughtException] 发生未捕获的异常:', error);
    process.exit(1);
});

// 处理未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
    console.error('[unhandledRejection] 发生未处理的Promise拒绝:', reason);
});
