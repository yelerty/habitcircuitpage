import {
    auth,
    db,
    authReadyPromise,
    authInitialized,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    doc,
    updateDoc,
    deleteDoc,
    increment,
    serverTimestamp
} from './firebase.js';

// ===== Constants =====
const DAYS_OF_WEEK = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];
const TIME_TYPES = {
    '아침': { icon: '🌅', color: 'morning' },
    '점심': { icon: '☀️', color: 'afternoon' },
    '저녁': { icon: '🌙', color: 'evening' }
};

// ===== Data Schema Matching iOS App =====
// This matches the RoutineExportData structure from iOS
const createRoutineDocument = (dayOfWeek, timeType, routines, userId, title = '', uploadId = '', passwordHash = '') => {
    return {
        version: '1.0',
        dayOfWeek: dayOfWeek,
        timeType: timeType,
        routines: routines.map((name, index) => ({
            name: name,
            order: index + 1
        })),
        anonId: userId,
        uploadId: uploadId, // Group routines from same upload session
        createdAt: serverTimestamp(),
        likes: 0,
        title: title || '', // Optional title
        passwordHash: passwordHash, // For edit authentication
        metadata: {
            platform: 'Web',
            uploadDate: new Date().toISOString()
        }
    };
};

// ===== Admin Configuration =====
const ADMIN_PASSWORD = '1723'; // 관리자 비밀번호 (변경 가능)

// ===== State Management =====
let currentRoutines = [];
let currentFilters = {
    sort: 'recent'
};
let pendingUpload = null;
let currentUserRoutines = {}; // Store routines by userId for download
let uploadPassword = ''; // Store password for current upload session

// ===== Simple Password Hash =====
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===== DOM Elements =====
const elements = {
    // Tabs
    tabBtns: document.querySelectorAll('.tab-btn'),
    browseView: document.getElementById('browse-view'),
    uploadView: document.getElementById('upload-view'),

    // Filters
    sortFilter: document.getElementById('sort-filter'),

    // Routines Container
    routinesContainer: document.getElementById('routines-container'),

    // Upload Methods
    uploadTabBtns: document.querySelectorAll('.upload-tab-btn'),
    fileUploadMethod: document.getElementById('file-upload-method'),
    manualUploadMethod: document.getElementById('manual-upload-method'),

    // File Upload
    fileDropZone: document.getElementById('file-drop-zone'),
    fileInput: document.getElementById('file-input'),
    browseFileBtn: document.getElementById('browse-file-btn'),
    filePreview: document.getElementById('file-preview'),

    // Manual Form
    manualForm: document.getElementById('manual-form'),
    manualTitle: document.getElementById('manual-title'),
    manualDay: document.getElementById('manual-day'),
    manualTime: document.getElementById('manual-time'),
    manualRoutines: document.getElementById('manual-routines'),
    manualPassword: document.getElementById('manual-password'),
    manualAddBtn: document.getElementById('manual-add-btn'),
    manualDoneBtn: document.getElementById('manual-done-btn'),
    addedRoutinesList: document.getElementById('added-routines-list'),
    addedRoutinesContent: document.getElementById('added-routines-content'),

    // Preview title
    previewTitle: document.getElementById('preview-title'),

    // Upload Preview
    uploadPreview: document.getElementById('upload-preview'),
    previewContent: document.getElementById('preview-content'),
    confirmUploadBtn: document.getElementById('confirm-upload-btn'),
    cancelUploadBtn: document.getElementById('cancel-upload-btn'),

    // Modal
    modal: document.getElementById('routine-modal'),
    modalBody: document.getElementById('modal-body'),
    closeModalBtn: document.getElementById('close-modal-btn'),

    // Toast
    toast: document.getElementById('toast')
};

// ===== Initialize App =====
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    initializeAuthStatus();
    loadRoutines();
});

// ===== Auth Status UI =====
async function initializeAuthStatus() {
    const authStatusEl = document.getElementById('auth-status');
    const indicatorEl = authStatusEl.querySelector('.auth-status-indicator');
    const textEl = authStatusEl.querySelector('.auth-status-text');

    authStatusEl.classList.add('loading');

    try {
        console.log('⏳ Waiting for authentication...');
        const user = await authReadyPromise;

        if (user) {
            // Success
            authStatusEl.classList.remove('loading');
            authStatusEl.classList.add('authenticated');
            indicatorEl.textContent = '✅';
            textEl.textContent = '인증 완료';
            console.log('✅ Auth status UI updated: authenticated');

            // Auto-hide after 3 seconds
            setTimeout(() => {
                authStatusEl.style.opacity = '0';
                authStatusEl.style.transition = 'opacity 0.5s ease';
                setTimeout(() => {
                    authStatusEl.style.display = 'none';
                }, 500);
            }, 3000);
        } else {
            throw new Error('No user returned from authentication');
        }
    } catch (error) {
        // Error
        authStatusEl.classList.remove('loading');
        authStatusEl.classList.add('error');
        indicatorEl.textContent = '❌';
        textEl.textContent = '인증 실패';
        console.error('❌ Auth status UI updated: error', error);

        // Show error details
        setTimeout(() => {
            textEl.textContent = '인증 실패 - 페이지 새로고침 필요';
        }, 2000);
    }
}

// ===== Event Listeners =====
function initializeEventListeners() {
    // View tabs
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    // Filters
    elements.sortFilter.addEventListener('change', handleFilterChange);

    // Upload method tabs
    elements.uploadTabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchUploadMethod(btn.dataset.method));
    });

    // File upload
    elements.browseFileBtn.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', handleFileSelect);
    elements.fileDropZone.addEventListener('dragover', handleDragOver);
    elements.fileDropZone.addEventListener('dragleave', handleDragLeave);
    elements.fileDropZone.addEventListener('drop', handleFileDrop);

    // Manual form
    elements.manualForm.addEventListener('submit', handleManualSubmit);
    elements.manualDoneBtn.addEventListener('click', handleManualDone);

    // Upload preview
    elements.confirmUploadBtn.addEventListener('click', confirmUpload);
    elements.cancelUploadBtn.addEventListener('click', cancelUpload);

    // Modal
    elements.closeModalBtn.addEventListener('click', closeModal);
    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) closeModal();
    });
}

// ===== View Switching =====
function switchView(viewName) {
    // Update tab buttons
    elements.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    // Update views
    elements.browseView.classList.toggle('active', viewName === 'browse');
    elements.uploadView.classList.toggle('active', viewName === 'upload');

    // Load routines if switching to browse view
    if (viewName === 'browse') {
        loadRoutines();
    }
}

function switchUploadMethod(method) {
    // Update tab buttons
    elements.uploadTabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.method === method);
    });

    // Update upload methods
    elements.fileUploadMethod.classList.toggle('active', method === 'file');
    elements.manualUploadMethod.classList.toggle('active', method === 'manual');

    // Reset forms
    resetUploadForms();
}

// ===== Firestore Operations =====
async function loadRoutines() {
    try {
        elements.routinesContainer.innerHTML = '<div class="loading">로딩 중...</div>';

        // Build query
        let q = collection(db, 'routines');
        const constraints = [];

        // Sort
        if (currentFilters.sort === 'popular') {
            constraints.push(orderBy('likes', 'desc'));
        } else {
            constraints.push(orderBy('createdAt', 'desc'));
        }

        if (constraints.length > 0) {
            q = query(collection(db, 'routines'), ...constraints);
        }

        // Fetch data
        const querySnapshot = await getDocs(q);
        currentRoutines = [];

        querySnapshot.forEach((doc) => {
            currentRoutines.push({
                id: doc.id,
                ...doc.data()
            });
        });

        renderRoutines();
    } catch (error) {
        console.error('Error loading routines:', error);
        showToast('루틴을 불러오는 중 오류가 발생했습니다.', 'error');
        elements.routinesContainer.innerHTML = '<div class="loading">오류가 발생했습니다.</div>';
    }
}

async function uploadRoutine(routineData) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('로그인이 필요합니다.');
        }

        await addDoc(collection(db, 'routines'), routineData);
        showToast('루틴이 성공적으로 공유되었습니다!', 'success');

        // Reset and switch to browse view
        resetUploadForms();
        switchView('browse');
        loadRoutines();
    } catch (error) {
        console.error('Error uploading routine:', error);
        showToast('업로드 중 오류가 발생했습니다.', 'error');
    }
}

async function likeRoutine(routineId) {
    try {
        const routineRef = doc(db, 'routines', routineId);
        await updateDoc(routineRef, {
            likes: increment(1)
        });

        // Update local state
        const routine = currentRoutines.find(r => r.id === routineId);
        if (routine) {
            routine.likes = (routine.likes || 0) + 1;
            renderRoutines();
        }
    } catch (error) {
        console.error('Error liking routine:', error);
        showToast('좋아요 처리 중 오류가 발생했습니다.', 'error');
    }
}

async function likeUserRoutines(userId, routines) {
    try {
        // Check if already liked today
        const likedToday = checkIfLikedToday(userId);
        if (likedToday) {
            showToast('오늘 이미 좋아요를 누르셨습니다. 내일 다시 시도해주세요!', 'error');
            return;
        }

        // Like only the first routine (representing the whole user's routine set)
        const firstRoutine = routines[0];
        const routineRef = doc(db, 'routines', firstRoutine.id);
        await updateDoc(routineRef, {
            likes: increment(1)
        });

        // Update local state for the first routine
        const localRoutine = currentRoutines.find(r => r.id === firstRoutine.id);
        if (localRoutine) {
            localRoutine.likes = (localRoutine.likes || 0) + 1;
        }

        // Mark as liked today
        markAsLikedToday(userId);

        renderRoutines();
        showToast('❤️ 좋아요!', 'success');
    } catch (error) {
        console.error('Error liking routines:', error);
        showToast('좋아요 처리 중 오류가 발생했습니다.', 'error');
    }
}

// Check if user already liked this routine today
function checkIfLikedToday(userId) {
    const today = new Date().toDateString();
    const likedData = JSON.parse(localStorage.getItem('likedRoutines') || '{}');
    return likedData[userId] === today;
}

// Mark routine as liked today
function markAsLikedToday(userId) {
    const today = new Date().toDateString();
    const likedData = JSON.parse(localStorage.getItem('likedRoutines') || '{}');
    likedData[userId] = today;
    localStorage.setItem('likedRoutines', JSON.stringify(likedData));
}

// ===== Render Functions =====
function renderRoutines() {
    if (currentRoutines.length === 0) {
        elements.routinesContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <h3>아직 공유된 루틴이 없습니다</h3>
                <p>첫 번째로 루틴을 공유해보세요!</p>
            </div>
        `;
        return;
    }

    // Group routines by uploadId (each upload session becomes a separate card)
    const groupedByUpload = {};
    currentRoutines.forEach(routine => {
        const uploadKey = routine.uploadId || routine.anonId; // Fallback to anonId for old data
        if (!groupedByUpload[uploadKey]) {
            groupedByUpload[uploadKey] = [];
        }
        groupedByUpload[uploadKey].push(routine);
    });

    // Create user cards
    const userCards = Object.entries(groupedByUpload).map(([uploadKey, routines]) => {
        return createUserCard(uploadKey, routines);
    });

    elements.routinesContainer.innerHTML = userCards.join('');

    // Add event listeners to user cards
    document.querySelectorAll('.user-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Check if click is on like button
            if (e.target.closest('.total-likes')) {
                e.stopPropagation();
                const uploadKey = card.dataset.userId;
                likeUserRoutines(uploadKey, groupedByUpload[uploadKey]);
                return;
            }

            const uploadKey = card.dataset.userId;
            showUserRoutines(uploadKey, groupedByUpload[uploadKey]);
        });
    });
}

function createUserCard(userId, routines) {
    // Calculate stats
    const daySet = new Set(routines.map(r => r.dayOfWeek));
    const totalRoutineItems = routines.reduce((sum, r) => sum + r.routines.length, 0);
    const totalLikes = routines.reduce((sum, r) => sum + (r.likes || 0), 0);

    // Get latest upload date
    const latestDate = routines.reduce((latest, r) => {
        const date = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
        return date > latest ? date : latest;
    }, new Date(0));

    // Get title (use first routine's title, or default)
    const title = routines[0]?.title || '익명 사용자의 일주일 루틴';

    // Check if already liked today
    const likedToday = checkIfLikedToday(userId);
    const heartStyle = likedToday
        ? 'cursor: not-allowed; opacity: 0.5;'
        : 'cursor: pointer; transition: transform 0.2s;';
    const heartHover = likedToday
        ? ''
        : 'onmouseover="this.style.transform=\'scale(1.2)\'" onmouseout="this.style.transform=\'scale(1)\'"';

    return `
        <div class="user-card" data-user-id="${userId}">
            <div class="user-card-header">
                <div class="user-avatar">👤</div>
                <div class="user-info">
                    <h3 class="user-title">${title}</h3>
                    <p class="user-stats">${daySet.size}개 요일 · ${totalRoutineItems}개 루틴</p>
                </div>
            </div>
            <div class="user-card-footer">
                <span class="upload-date">${formatDate(latestDate)}</span>
                <span class="total-likes" style="${heartStyle}" ${heartHover}>
                    ${likedToday ? '💔' : '❤️'} ${totalLikes}
                </span>
            </div>
        </div>
    `;
}

function showUserRoutines(userId, routines) {
    // Store for download function
    currentUserRoutines[userId] = routines;

    // Group by day
    const groupedByDay = {};
    routines.forEach(routine => {
        if (!groupedByDay[routine.dayOfWeek]) {
            groupedByDay[routine.dayOfWeek] = [];
        }
        groupedByDay[routine.dayOfWeek].push(routine);
    });

    // Get title
    const title = routines[0]?.title || '익명 사용자의 일주일 루틴';

    // Render day groups
    const dayOrder = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];
    const html = dayOrder
        .filter(day => groupedByDay[day])
        .map(day => createDayRoutineGroup(day, groupedByDay[day]))
        .join('');

    elements.modalBody.innerHTML = `
        <div class="user-routines-modal">
            <h2 class="modal-title">👤 ${title}</h2>
            <div class="modal-routines">
                ${html}
            </div>
            <div style="display: flex; gap: 12px; margin-top: 20px;">
                <button class="btn-secondary" style="flex: 1;" onclick="editUserRoutines('${userId}')">
                    ✏️ 수정하기
                </button>
                <button class="btn-primary" style="flex: 1;" onclick="downloadAllUserRoutines('${userId}')">
                    📥 다운로드
                </button>
            </div>
            <div style="margin-top: 12px;">
                <button class="btn-secondary" style="width: 100%; background: var(--color-danger); color: white;" onclick="deleteUserRoutines('${userId}')">
                    🗑️ 삭제하기
                </button>
            </div>
            <p style="margin-top: 12px; font-size: 0.85rem; color: var(--text-tertiary); text-align: center;">
                📥 다운로드 후 파일 앱의 "HabitCircuit" 폴더로 이동하면<br>
                앱에서 쉽게 가져올 수 있습니다
            </p>
        </div>
    `;

    elements.modal.classList.remove('hidden');

    // Add event listeners to day headers
    document.querySelectorAll('.day-routine-group-header').forEach(header => {
        header.addEventListener('click', () => {
            const dayGroup = header.parentElement;
            dayGroup.classList.toggle('collapsed');
        });
    });
}

function createDayRoutineGroup(day, dayRoutines) {
    // Collect all routine items with their time info
    const allRoutineItems = [];
    dayRoutines.forEach(routineDoc => {
        const timeInfo = TIME_TYPES[routineDoc.timeType] || { icon: '⏰', color: 'morning' };
        routineDoc.routines.forEach(item => {
            allRoutineItems.push({
                ...item,
                timeType: routineDoc.timeType,
                timeIcon: timeInfo.icon,
                timeColor: timeInfo.color,
                routineDocId: routineDoc.id,
                likes: routineDoc.likes || 0
            });
        });
    });

    // Sort by order
    allRoutineItems.sort((a, b) => {
        // First by time type (아침, 점심, 저녁)
        const timeOrder = { '아침': 0, '점심': 1, '저녁': 2 };
        const timeCompare = timeOrder[a.timeType] - timeOrder[b.timeType];
        if (timeCompare !== 0) return timeCompare;
        // Then by order within same time
        return a.order - b.order;
    });

    const totalCount = allRoutineItems.length;
    const shouldFold = totalCount > 10;
    const displayItems = shouldFold ? allRoutineItems.slice(0, 10) : allRoutineItems;
    const hiddenCount = shouldFold ? totalCount - 10 : 0;

    return `
        <div class="day-routine-group ${shouldFold ? 'collapsed' : ''}">
            <div class="day-routine-group-header">
                <div class="day-routine-title">
                    <span class="day-name">${day}</span>
                    <span class="routine-count">${totalCount}개</span>
                </div>
                ${shouldFold ? '<span class="expand-icon">▼</span>' : ''}
            </div>
            <div class="day-routine-content">
                <div class="routine-list">
                    ${displayItems.map(item => `
                        <div class="routine-list-item">
                            <span class="time-icon ${item.timeColor}">${item.timeIcon}</span>
                            <span class="routine-item-name">${item.name}</span>
                        </div>
                    `).join('')}
                </div>
                ${shouldFold ? `
                    <div class="show-more-items">
                        ${allRoutineItems.slice(10).map(item => `
                            <div class="routine-list-item">
                                <span class="time-icon ${item.timeColor}">${item.timeIcon}</span>
                                <span class="routine-item-name">${item.name}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function createDayGroup(day, timeGroups) {
    const timeOrder = ['아침', '점심', '저녁'];
    const totalRoutines = Object.values(timeGroups).flat().length;

    return `
        <div class="day-group">
            <div class="day-group-header">
                <div class="day-group-title">
                    <span class="day-name">${day}</span>
                    <span class="routine-count">${totalRoutines}개 루틴</span>
                </div>
                <span class="expand-icon">▼</span>
            </div>
            <div class="day-group-content">
                ${timeOrder
                    .filter(time => timeGroups[time])
                    .map(time => createTimeGroup(time, timeGroups[time]))
                    .join('')}
            </div>
        </div>
    `;
}

function createTimeGroup(timeType, routines) {
    const timeInfo = TIME_TYPES[timeType] || { icon: '⏰', color: 'morning' };

    return `
        <div class="time-group">
            <div class="time-group-header">
                <span class="time-badge ${timeInfo.color}">
                    ${timeInfo.icon} ${timeType}
                </span>
                <span class="time-routine-count">${routines.length}개</span>
                <span class="expand-icon-small">▼</span>
            </div>
            <div class="time-group-content">
                ${routines.map(routine => createRoutineCard(routine)).join('')}
            </div>
        </div>
    `;
}

function createRoutineCard(routine) {
    const routinesList = routine.routines.slice(0, 3);
    const hasMore = routine.routines.length > 3;

    return `
        <div class="routine-card" data-routine-id="${routine.id}">
            <div class="routine-items">
                ${routinesList.map(r => `
                    <div class="routine-item">
                        <span class="routine-item-number">${r.order}</span>
                        <span class="routine-item-name">${r.name}</span>
                    </div>
                `).join('')}
                ${hasMore ? `<div class="routine-item"><span class="routine-item-name">+${routine.routines.length - 3}개 더보기</span></div>` : ''}
            </div>
            <div class="routine-card-footer">
                <span>${formatDate(routine.createdAt)}</span>
                <span class="routine-likes" data-routine-id="${routine.id}">
                    ❤️ ${routine.likes || 0}
                </span>
            </div>
        </div>
    `;
}

function showRoutineDetail(routineId) {
    const routine = currentRoutines.find(r => r.id === routineId);
    if (!routine) return;

    const timeInfo = TIME_TYPES[routine.timeType] || { icon: '⏰', color: 'morning' };

    elements.modalBody.innerHTML = `
        <div class="routine-card">
            <div class="routine-card-header">
                <span class="routine-badge ${timeInfo.color}">
                    ${timeInfo.icon} ${routine.timeType}
                </span>
                <span class="routine-day">${routine.dayOfWeek}</span>
            </div>
            <div class="routine-items">
                ${routine.routines.map(r => `
                    <div class="routine-item">
                        <span class="routine-item-number">${r.order}</span>
                        <span class="routine-item-name">${r.name}</span>
                    </div>
                `).join('')}
            </div>
            <div class="routine-card-footer">
                <span>${formatDate(routine.createdAt)}</span>
                <span class="routine-likes" data-routine-id="${routine.id}">
                    ❤️ ${routine.likes || 0}
                </span>
            </div>
        </div>
        <div style="display: flex; gap: 12px; margin-top: 20px;">
            <button class="btn-secondary" style="flex: 1;" onclick="copyRoutineJSON('${routineId}')">
                📋 JSON 복사
            </button>
            <button class="btn-primary" style="flex: 1;" onclick="downloadRoutineJSON('${routineId}')">
                📥 다운로드
            </button>
        </div>
        <p style="margin-top: 12px; font-size: 0.85rem; color: var(--text-tertiary); text-align: center;">
            다운로드한 파일을 HabitCircuit 앱에서 가져오기 할 수 있습니다
        </p>
    `;

    elements.modal.classList.remove('hidden');
}

function closeModal() {
    elements.modal.classList.add('hidden');
}

// ===== File Upload Handlers =====
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processFile(file);
    }
}

function handleDragOver(e) {
    e.preventDefault();
    elements.fileDropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    elements.fileDropZone.classList.remove('drag-over');
}

function handleFileDrop(e) {
    e.preventDefault();
    elements.fileDropZone.classList.remove('drag-over');

    const file = e.dataTransfer.files[0];
    if (file) {
        processFile(file);
    }
}

function processFile(file) {
    if (!file.name.endsWith('.json')) {
        showToast('JSON 파일만 업로드할 수 있습니다.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            validateAndPreviewFile(data);
        } catch (error) {
            showToast('JSON 파일을 읽을 수 없습니다.', 'error');
        }
    };
    reader.readAsText(file);
}

function validateAndPreviewFile(data) {
    // Check if it's iOS app export format
    if (data.version && data.routines && Array.isArray(data.routines)) {
        // Group by day and time
        const grouped = {};
        data.routines.forEach(routine => {
            const key = `${routine.dayOfWeek}-${routine.timeType}`;
            if (!grouped[key]) {
                grouped[key] = {
                    dayOfWeek: routine.dayOfWeek,
                    timeType: routine.timeType,
                    routines: []
                };
            }
            grouped[key].routines.push(routine);
        });

        // Show preview for each group
        pendingUpload = Object.values(grouped);
        showUploadPreview(pendingUpload);
    } else {
        showToast('올바른 형식의 루틴 파일이 아닙니다.', 'error');
    }
}

function showUploadPreview(routineGroups) {
    elements.previewContent.innerHTML = routineGroups.map((group, index) => {
        const timeInfo = TIME_TYPES[group.timeType] || { icon: '⏰', color: 'morning' };
        return `
            <div class="routine-card" style="margin-bottom: 16px;">
                <div class="routine-card-header">
                    <span class="routine-badge ${timeInfo.color}">
                        ${timeInfo.icon} ${group.timeType}
                    </span>
                    <span class="routine-day">${group.dayOfWeek}</span>
                </div>
                <div class="routine-items">
                    ${group.routines.sort((a, b) => a.order - b.order).map(r => `
                        <div class="routine-item">
                            <span class="routine-item-number">${r.order}</span>
                            <span class="routine-item-name">${r.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');

    elements.uploadPreview.classList.remove('hidden');
}

// ===== Manual Form Handlers =====
function handleManualSubmit(e) {
    e.preventDefault();

    const day = elements.manualDay.value;
    const time = elements.manualTime.value;
    const routinesText = elements.manualRoutines.value.trim();
    const password = elements.manualPassword.value;

    if (!day || !time || !routinesText || !password) {
        showToast('모든 필드를 입력해주세요.', 'error');
        return;
    }

    if (password.length !== 4 || !/^\d{4}$/.test(password)) {
        showToast('비밀번호는 4자리 숫자여야 합니다.', 'error');
        return;
    }

    const routines = routinesText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    if (routines.length === 0) {
        showToast('최소 1개 이상의 루틴을 입력해주세요.', 'error');
        return;
    }

    // Store password for this upload session (first time only)
    if (!uploadPassword) {
        uploadPassword = password;
    } else if (uploadPassword !== password) {
        showToast('처음 입력한 비밀번호와 같아야 합니다.', 'error');
        return;
    }

    // Initialize pendingUpload if it doesn't exist
    if (!pendingUpload) {
        pendingUpload = [];
    }

    // Add the new routine to pending upload
    pendingUpload.push({
        dayOfWeek: day,
        timeType: time,
        routines: routines.map((name, index) => ({
            name,
            order: index + 1
        }))
    });

    // Clear the routines textarea for next input
    elements.manualRoutines.value = '';

    // Show success message
    showToast(`${day} ${time} 루틴이 추가되었습니다!`, 'success');

    // Update the added routines list
    updateAddedRoutinesList();

    // Enable the done button
    elements.manualDoneBtn.disabled = false;
}

function handleManualDone() {
    if (!pendingUpload || pendingUpload.length === 0) {
        showToast('추가된 루틴이 없습니다.', 'error');
        return;
    }

    // Get title from manual form
    const title = elements.manualTitle.value.trim();
    elements.previewTitle.value = title;

    showUploadPreview(pendingUpload);
}

function updateAddedRoutinesList() {
    if (!pendingUpload || pendingUpload.length === 0) {
        elements.addedRoutinesList.classList.add('hidden');
        return;
    }

    elements.addedRoutinesList.classList.remove('hidden');

    const html = pendingUpload.map((item, index) => {
        const timeIcon = TIME_TYPES[item.timeType]?.icon || '';
        const routinesList = item.routines.map(r => r.name).join(', ');

        return `
            <div class="added-routine-item">
                <div class="added-routine-header">
                    <span class="added-routine-badge">${item.dayOfWeek} ${timeIcon} ${item.timeType}</span>
                    <button class="btn-remove" onclick="removeAddedRoutine(${index})">✕</button>
                </div>
                <div class="added-routine-content">
                    ${item.routines.map(r => `<span class="routine-tag">${r.name}</span>`).join('')}
                </div>
            </div>
        `;
    }).join('');

    elements.addedRoutinesContent.innerHTML = html;
}

// Make removeAddedRoutine globally available
window.removeAddedRoutine = function(index) {
    if (pendingUpload && pendingUpload.length > index) {
        const removed = pendingUpload.splice(index, 1)[0];
        showToast(`${removed.dayOfWeek} ${removed.timeType} 루틴이 삭제되었습니다.`, 'info');
        updateAddedRoutinesList();

        // Disable done button if no routines left
        if (pendingUpload.length === 0) {
            elements.manualDoneBtn.disabled = true;
        }
    }
}

// ===== Upload Confirmation =====
async function confirmUpload() {
    if (!pendingUpload || pendingUpload.length === 0) return;

    elements.confirmUploadBtn.disabled = true;
    elements.confirmUploadBtn.textContent = '업로드 중...';

    try {
        console.log('📤 Starting upload process...');
        console.log('Auth initialized:', authInitialized);
        console.log('Current user:', auth.currentUser);

        // Wait for authentication to complete using the promise
        let user = auth.currentUser;
        if (!user) {
            console.log('⏳ Waiting for authentication to complete...');
            showToast('인증 중입니다...', 'success');

            // Wait for the auth promise to resolve (with timeout)
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Authentication timeout')), 10000)
            );

            try {
                user = await Promise.race([authReadyPromise, timeoutPromise]);

                if (!user) {
                    throw new Error('Authentication failed: No user returned');
                }

                console.log('✅ Authentication successful:', user.uid);
            } catch (authError) {
                console.error('❌ Authentication error:', authError);
                showToast('로그인에 실패했습니다. 페이지를 새로고침하고 다시 시도해주세요.', 'error');

                // Show additional debugging info
                console.error('Firebase Auth Domain:', auth.config.authDomain);
                console.error('Auth Error Details:', {
                    code: authError.code,
                    message: authError.message,
                    stack: authError.stack
                });

                return;
            }
        }

        console.log('📝 Uploading routines...');
        console.log('Number of routine groups:', pendingUpload.length);

        // Get title from preview input
        const title = elements.previewTitle.value.trim();
        console.log('Title:', title);

        // Generate unique upload ID for this upload session
        const uploadId = `${user.uid}_${Date.now()}`;
        console.log('Upload ID:', uploadId);

        // Hash the password
        const passwordHash = await hashPassword(uploadPassword);
        console.log('Password hashed');

        // Upload each routine group
        for (const group of pendingUpload) {
            console.log('Uploading group:', group.dayOfWeek, group.timeType);

            const routineDoc = createRoutineDocument(
                group.dayOfWeek,
                group.timeType,
                group.routines.map(r => r.name),
                user.uid,
                title,
                uploadId,
                passwordHash
            );

            console.log('Document to upload:', routineDoc);

            await addDoc(collection(db, 'routines'), routineDoc);
            console.log('✅ Uploaded successfully');
        }

        showToast(`${pendingUpload.length}개의 루틴이 성공적으로 공유되었습니다!`, 'success');
        resetUploadForms();
        switchView('browse');
        loadRoutines();
    } catch (error) {
        console.error('❌ Error uploading routines:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);

        let errorMessage = '업로드 중 오류가 발생했습니다';

        // Provide more specific error messages
        if (error.code === 'permission-denied') {
            errorMessage = '권한이 거부되었습니다. Firebase 설정을 확인해주세요.';
            console.error('💡 Hint: Check Firestore security rules and Authentication settings');
        } else if (error.code === 'unavailable') {
            errorMessage = 'Firebase 서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.';
        } else if (error.message) {
            errorMessage += ': ' + error.message;
        }

        showToast(errorMessage, 'error');
    } finally {
        elements.confirmUploadBtn.disabled = false;
        elements.confirmUploadBtn.textContent = '확인 및 업로드';
    }
}

function cancelUpload() {
    pendingUpload = null;
    resetUploadForms();
}

// ===== Filter Handlers =====
function handleFilterChange() {
    currentFilters.sort = elements.sortFilter.value;
    loadRoutines();
}

// ===== Utility Functions =====
function resetUploadForms() {
    elements.fileInput.value = '';
    elements.filePreview.innerHTML = '';
    elements.filePreview.classList.add('hidden');
    elements.manualForm.reset();
    elements.uploadPreview.classList.add('hidden');
    elements.addedRoutinesList.classList.add('hidden');
    elements.addedRoutinesContent.innerHTML = '';
    elements.manualDoneBtn.disabled = true;
    pendingUpload = null;
    uploadPassword = ''; // Reset password
}

function formatDate(timestamp) {
    if (!timestamp) return '방금 전';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;

    return date.toLocaleDateString('ko-KR');
}

function showToast(message, type = 'success') {
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type}`;
    elements.toast.classList.remove('hidden');

    setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, 3000);
}

// ===== Global Functions for Modal =====
// Helper function to create iOS-compatible export data
function createExportData(routine) {
    return {
        version: routine.version || '1.0',
        exportDate: new Date().toISOString(),
        routines: routine.routines.map(r => ({
            name: r.name,
            dayOfWeek: routine.dayOfWeek,
            timeType: routine.timeType,
            order: r.order
        }))
    };
}

window.copyRoutineJSON = function(routineId) {
    const routine = currentRoutines.find(r => r.id === routineId);
    if (!routine) return;

    const exportData = createExportData(routine);

    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2))
        .then(() => {
            showToast('JSON이 클립보드에 복사되었습니다!', 'success');
            closeModal();
        })
        .catch(() => {
            showToast('복사 중 오류가 발생했습니다.', 'error');
        });
};

window.downloadRoutineJSON = function(routineId) {
    const routine = currentRoutines.find(r => r.id === routineId);
    if (!routine) return;

    const exportData = createExportData(routine);
    const jsonString = JSON.stringify(exportData, null, 2);

    // Create blob and download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    // Generate filename with date
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `HabitCircuit-${routine.dayOfWeek}-${routine.timeType}-${dateStr}.json`;
    a.download = fileName;

    // Trigger download
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('루틴이 다운로드되었습니다! 앱에서 가져오기 하세요.', 'success');
    closeModal();
};

window.downloadAllUserRoutines = function(userId) {
    const routines = currentUserRoutines[userId];
    if (!routines || routines.length === 0) return;

    // Convert all routines to export format
    const allExportRoutines = [];
    routines.forEach(routine => {
        routine.routines.forEach(item => {
            allExportRoutines.push({
                name: item.name,
                dayOfWeek: routine.dayOfWeek,
                timeType: routine.timeType,
                order: item.order
            });
        });
    });

    const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        routines: allExportRoutines
    };

    const jsonString = JSON.stringify(exportData, null, 2);

    // Create blob and download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    // Generate filename with date and title
    const dateStr = new Date().toISOString().split('T')[0];
    const title = (routines[0]?.title || '루틴모음').replace(/[^a-zA-Z0-9가-힣]/g, '-');
    const fileName = `HabitCircuit-${title}-${dateStr}.json`;
    a.download = fileName;

    // Trigger download
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Show detailed instructions
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (isIOS) {
        alert(`✅ 다운로드 완료: ${fileName}\n\n📁 파일을 쉽게 찾으려면:\n1. 파일 앱 열기\n2. "다운로드" 폴더에서 파일 찾기\n3. 파일을 길게 누르기 → "이동" 선택\n4. "HabitCircuit" 폴더로 이동\n\n📱 앱에서 가져오기:\n1. HabitCircuit 앱 열기\n2. 설정 → "루틴 가져오기"\n3. "HabitCircuit" 폴더에서 파일 선택\n\n💡 HabitCircuit 폴더에 저장하면 다음부터 더 쉽게 찾을 수 있습니다!`);
    } else {
        showToast('전체 루틴이 다운로드되었습니다! 앱에서 가져오기 하세요.', 'success');
    }
    closeModal();
};

window.editUserRoutines = function(userId) {
    const routines = currentUserRoutines[userId];
    if (!routines || routines.length === 0) return;

    // Prompt for password
    const password = prompt('수정하려면 비밀번호 4자리를 입력하세요:');
    if (!password) return;

    if (password.length !== 4 || !/^\d{4}$/.test(password)) {
        showToast('비밀번호는 4자리 숫자여야 합니다.', 'error');
        return;
    }

    // Verify password
    hashPassword(password).then(async (inputHash) => {
        const firstRoutine = routines[0];
        if (firstRoutine.passwordHash !== inputHash) {
            showToast('비밀번호가 일치하지 않습니다.', 'error');
            return;
        }

        showToast('비밀번호 확인 완료! 수정 기능은 곧 추가됩니다.', 'success');
        // TODO: Implement edit functionality
        // For now, just show a message
        alert('수정 기능은 현재 개발 중입니다.\n\n대신 다음 방법을 사용하세요:\n1. 📥 다운로드 버튼으로 루틴 다운로드\n2. 삭제 후 재업로드');
    }).catch(error => {
        console.error('Password verification error:', error);
        showToast('비밀번호 확인 중 오류가 발생했습니다.', 'error');
    });
};

window.deleteUserRoutines = function(userId) {
    const routines = currentUserRoutines[userId];
    if (!routines || routines.length === 0) return;

    // Confirm deletion
    const confirmDelete = confirm('정말로 이 루틴을 삭제하시겠습니까?\n삭제된 루틴은 복구할 수 없습니다.');
    if (!confirmDelete) return;

    // Prompt for password
    const password = prompt('삭제하려면 비밀번호 4자리를 입력하세요:');
    if (!password) return;

    if (password.length !== 4 || !/^\d{4}$/.test(password)) {
        showToast('비밀번호는 4자리 숫자여야 합니다.', 'error');
        return;
    }

    // Check if admin password
    if (password === ADMIN_PASSWORD) {
        // Admin access - delete without verification
        performDeletion(routines);
        return;
    }

    // Verify user password and delete
    hashPassword(password).then(async (inputHash) => {
        const firstRoutine = routines[0];
        if (firstRoutine.passwordHash !== inputHash) {
            showToast('비밀번호가 일치하지 않습니다.', 'error');
            return;
        }

        // Password verified, proceed with deletion
        performDeletion(routines);
    }).catch(error => {
        console.error('Password verification error:', error);
        showToast('비밀번호 확인 중 오류가 발생했습니다.', 'error');
    });
};

async function performDeletion(routines) {
    try {
        showToast('루틴 삭제 중...', 'success');

        // Delete all routines for this user
        const deletePromises = routines.map(routine =>
            deleteDoc(doc(db, 'routines', routine.id))
        );

        await Promise.all(deletePromises);

        showToast(`${routines.length}개의 루틴이 삭제되었습니다.`, 'success');
        closeModal();

        // Refresh the routines list
        loadRoutines();
    } catch (error) {
        console.error('Error deleting routines:', error);
        showToast('루틴 삭제 중 오류가 발생했습니다.', 'error');
    }
}
