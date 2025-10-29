import {
    auth,
    db,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    doc,
    updateDoc,
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
const createRoutineDocument = (dayOfWeek, timeType, routines, userId) => {
    return {
        version: '1.0',
        dayOfWeek: dayOfWeek,
        timeType: timeType,
        routines: routines.map((name, index) => ({
            name: name,
            order: index + 1
        })),
        anonId: userId,
        createdAt: serverTimestamp(),
        likes: 0,
        metadata: {
            platform: 'Web',
            uploadDate: new Date().toISOString()
        }
    };
};

// ===== State Management =====
let currentRoutines = [];
let currentFilters = {
    day: '',
    time: '',
    sort: 'recent'
};
let pendingUpload = null;

// ===== DOM Elements =====
const elements = {
    // Tabs
    tabBtns: document.querySelectorAll('.tab-btn'),
    browseView: document.getElementById('browse-view'),
    uploadView: document.getElementById('upload-view'),

    // Filters
    dayFilter: document.getElementById('day-filter'),
    timeFilter: document.getElementById('time-filter'),
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
    manualDay: document.getElementById('manual-day'),
    manualTime: document.getElementById('manual-time'),
    manualRoutines: document.getElementById('manual-routines'),
    manualSubmitBtn: document.getElementById('manual-submit-btn'),

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
    loadRoutines();
});

// ===== Event Listeners =====
function initializeEventListeners() {
    // View tabs
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    // Filters
    elements.dayFilter.addEventListener('change', handleFilterChange);
    elements.timeFilter.addEventListener('change', handleFilterChange);
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

        if (currentFilters.day) {
            constraints.push(where('dayOfWeek', '==', currentFilters.day));
        }
        if (currentFilters.time) {
            constraints.push(where('timeType', '==', currentFilters.time));
        }

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

    elements.routinesContainer.innerHTML = currentRoutines
        .map(routine => createRoutineCard(routine))
        .join('');

    // Add event listeners to cards
    document.querySelectorAll('.routine-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.routine-likes')) {
                showRoutineDetail(card.dataset.routineId);
            }
        });
    });

    // Add event listeners to like buttons
    document.querySelectorAll('.routine-likes').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            likeRoutine(btn.dataset.routineId);
        });
    });
}

function createRoutineCard(routine) {
    const timeInfo = TIME_TYPES[routine.timeType] || { icon: '⏰', color: 'morning' };
    const routinesList = routine.routines.slice(0, 3);
    const hasMore = routine.routines.length > 3;

    return `
        <div class="routine-card" data-routine-id="${routine.id}">
            <div class="routine-card-header">
                <span class="routine-badge ${timeInfo.color}">
                    ${timeInfo.icon} ${routine.timeType}
                </span>
                <span class="routine-day">${routine.dayOfWeek}</span>
            </div>
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
        <button class="btn-primary" style="width: 100%; margin-top: 20px;" onclick="copyRoutineJSON('${routineId}')">
            JSON 복사하기
        </button>
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

    if (!day || !time || !routinesText) {
        showToast('모든 필드를 입력해주세요.', 'error');
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

    pendingUpload = [{
        dayOfWeek: day,
        timeType: time,
        routines: routines.map((name, index) => ({
            name,
            order: index + 1
        }))
    }];

    showUploadPreview(pendingUpload);
}

// ===== Upload Confirmation =====
async function confirmUpload() {
    if (!pendingUpload || pendingUpload.length === 0) return;

    const user = auth.currentUser;
    if (!user) {
        showToast('로그인이 필요합니다. 잠시 후 다시 시도해주세요.', 'error');
        return;
    }

    elements.confirmUploadBtn.disabled = true;
    elements.confirmUploadBtn.textContent = '업로드 중...';

    try {
        // Upload each routine group
        for (const group of pendingUpload) {
            const routineDoc = createRoutineDocument(
                group.dayOfWeek,
                group.timeType,
                group.routines.map(r => r.name),
                user.uid
            );
            await addDoc(collection(db, 'routines'), routineDoc);
        }

        showToast(`${pendingUpload.length}개의 루틴이 성공적으로 공유되었습니다!`, 'success');
        resetUploadForms();
        switchView('browse');
        loadRoutines();
    } catch (error) {
        console.error('Error uploading routines:', error);
        showToast('업로드 중 오류가 발생했습니다.', 'error');
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
    currentFilters.day = elements.dayFilter.value;
    currentFilters.time = elements.timeFilter.value;
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
    pendingUpload = null;
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
window.copyRoutineJSON = function(routineId) {
    const routine = currentRoutines.find(r => r.id === routineId);
    if (!routine) return;

    const exportData = {
        version: routine.version || '1.0',
        exportDate: new Date().toISOString(),
        routines: routine.routines.map(r => ({
            name: r.name,
            dayOfWeek: routine.dayOfWeek,
            timeType: routine.timeType,
            order: r.order
        }))
    };

    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2))
        .then(() => {
            showToast('JSON이 클립보드에 복사되었습니다!', 'success');
            closeModal();
        })
        .catch(() => {
            showToast('복사 중 오류가 발생했습니다.', 'error');
        });
};
