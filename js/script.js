// 全局变量
let currentAlbum = null;
let currentUser = null;

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

// 初始化数据
function initData() {
    // 从localStorage加载数据
    notesData = JSON.parse(localStorage.getItem('notes')) || [];
    albumsData = JSON.parse(localStorage.getItem('albums')) || [];
    usersData = JSON.parse(localStorage.getItem('users')) || [];
    
    // 初始化默认用户数据（如果不存在）
    if (usersData.length === 0) {
        usersData = [
            { id: 'user1', password: INITIAL_PASSWORDS.user1, nickname: DEFAULT_NICKNAMES.user1 },
            { id: 'user2', password: INITIAL_PASSWORDS.user2, nickname: DEFAULT_NICKNAMES.user2 }
        ];
        localStorage.setItem('users', JSON.stringify(usersData));
    }
    
    // 初始化默认笔记数据（如果不存在）
    if (notesData.length === 0) {
        notesData = [];
        localStorage.setItem('notes', JSON.stringify(notesData));
    }
    
    // 初始化默认相册数据（如果不存在）
    if (albumsData.length === 0) {
        albumsData = [];
        localStorage.setItem('albums', JSON.stringify(albumsData));
    }
}

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 初始化数据
    initData();
    
    // 检查是否已登录
    checkLogin();
    
    // 计算并显示在一起天数
    updateTogetherDays();
    
    // 绑定事件监听器
    bindEventListeners();
    
    // 添加滚动事件监听器
    window.addEventListener('scroll', handleScroll);
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
function handleInsertMedia(file, type) {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        const editor = document.getElementById('note-content');
        
        // 在光标位置插入媒体
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        
        if (type === 'image') {
            const img = document.createElement('img');
            img.src = content;
            img.alt = file.name;
            range.insertNode(img);
        } else if (type === 'video') {
            const video = document.createElement('video');
            video.src = content;
            video.controls = true;
            video.muted = false;
            range.insertNode(video);
        }
        
        // 移动光标到媒体后面
        range.setStartAfter(img || video);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // 触发input事件
        editor.dispatchEvent(new Event('input', { bubbles: true }));
    };
    reader.readAsDataURL(file);
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
        createdAt: new Date().toISOString()
    };
    
    // 添加到数据缓存
    notesData.unshift(newNote);
    
    // 保存到localStorage
    localStorage.setItem('notes', JSON.stringify(notesData));
    
    // 重置表单并关闭模态框
    document.getElementById('note-form').reset();
    document.getElementById('note-content').innerHTML = '';
    document.getElementById('note-modal').classList.remove('show');
    
    // 重新渲染笔记列表
    renderNotes();
}

// 渲染笔记列表
function renderNotes() {
    const notesContainer = document.getElementById('notes-container');
    
    if (notesData.length === 0) {
        notesContainer.innerHTML = '<p style="text-align: center; color: #999; grid-column: 1 / -1;">还没有笔记，快来添加第一条吧！</p>';
        return;
    }
    
    notesContainer.innerHTML = notesData.map(note => {
        // 提取笔记中的第一张图片作为封面
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = note.content;
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
                            `<img src="${coverMedia.src}" alt="笔记封面">` : 
                            `<video src="${coverMedia.src}" muted loop playsinline></video>`}
                    ` : '📝'}
                </div>
                <div class="note-card-content">
                    <div>
                        <div class="note-header">
                            <h3 class="note-title">${note.title}</h3>
                            <button class="delete-note-btn" onclick="event.stopPropagation(); deleteNote('${note.id}')" title="删除笔记">
                                🗑️
                            </button>
                        </div>
                        <p class="note-excerpt">${excerpt}</p>
                    </div>
                    <p class="note-meta">
                        <span class="note-author">✍️ ${note.author}</span>
                        <span class="note-date">${formatDate(note.createdAt)}</span>
                        <span class="note-comments">💬 ${note.comments ? note.comments.length : 0}</span>
                    </p>
                </div>
            </div>
        `;
    }).join('');
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
        // 从数据缓存中删除笔记
        notesData = notesData.filter(note => note.id !== noteId);
        
        // 保存到localStorage
        localStorage.setItem('notes', JSON.stringify(notesData));
        
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
            albumsData = albumsData.filter(a => a.id !== albumId);
            localStorage.setItem('albums', JSON.stringify(albumsData));
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
        createdAt: new Date().toISOString()
    };
    
    // 添加到数据缓存
    albumsData.unshift(newAlbum);
    
    // 保存到localStorage
    localStorage.setItem('albums', JSON.stringify(albumsData));
    
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
            <input type="file" id="album-media" name="media" multiple accept="image/*,video/*">
            <button class="btn-primary" onclick="uploadAlbumMedia()">上传到相册</button>
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
            <input type="file" id="album-media" name="media" multiple accept="image/*,video/*">
            <button class="btn-primary" onclick="uploadAlbumMedia()">上传到相册</button>
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
            
            // 保存到localStorage
            localStorage.setItem('albums', JSON.stringify(albumsData));
            
            // 更新当前相册对象
            currentAlbum = albumsData[albumIndex];
            
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
            
            // 保存到localStorage
            localStorage.setItem('albums', JSON.stringify(albumsData));
            
            // 更新当前相册对象
            currentAlbum = albumsData[albumIndex];
            
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