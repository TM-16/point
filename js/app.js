// グローバル変数
let currentLatitude = null;
let currentLongitude = null;
let currentUser = null;
let lastDestination = '';

// カードの初期順序定義 (realtime-transit-section は一番下に配置)
const DEFAULT_SECTION_ORDER = ['header-section', 'location-section', 'bus-section', 'route-section', 'realtime-transit-section'];
const SECTION_NAMES = {
    'header-section': '時刻 ＆ Google検索',
    'location-section': '現在地 ＆ ルートマップ',
    'bus-section': '🚌 地域交通情報',
    'route-section': '目的地までの経路・時間予測',
    'realtime-transit-section': '🚃 リアルタイム乗換案内'
};

// モーダル編集時の一時変数
let tempSectionOrder = [];
let tempBlindedSections = [];

// DOM要素
let mapIframe, statusDiv, mapWarning, destinationInput, distanceDiv, historyDiv, mainContent, googleSearchInput;

document.addEventListener('DOMContentLoaded', () => {
    currentUser = localStorage.getItem('current_active_user');
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }

    mapIframe = document.getElementById('map-iframe');
    statusDiv = document.getElementById('location-status');
    mapWarning = document.getElementById('map-warning');
    destinationInput = document.getElementById('destination');
    distanceDiv = document.getElementById('distance');
    historyDiv = document.getElementById('search-history'); 
    mainContent = document.getElementById('main-content');
    googleSearchInput = document.getElementById('google-search-input');

    const display = document.getElementById('current-user-display');
    if (display) display.textContent = currentUser;

    initTheme();
    applySavedSectionOrder();
    applySavedCollapsedState();
    applySavedBlindedState();
    loadSearchHistory();
    
    getAndDisplayLocationFast();

    updateTime();
    setInterval(updateTime, 1000);
});

// --- ログアウト ---
function handleLogout() {
    localStorage.removeItem('current_active_user');
    localStorage.removeItem('saved_username');
    localStorage.removeItem('saved_password');
    window.location.href = 'index.html';
}

function hideSplash() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.classList.add('hidden');
        setTimeout(() => splash.style.display = 'none', 400);
    }
}

// --- 高速 ＆ 再取得用位置情報処理 ---
function getAndDisplayLocationFast() {
    if (!navigator.geolocation) {
        if (statusDiv) statusDiv.textContent = 'Geolocation API非対応です';
        hideSplash();
        if (mainContent) mainContent.style.display = 'block';
        return;
    }

    if (statusDiv) statusDiv.textContent = '位置情報を取得中...';
    if (mapWarning) mapWarning.style.display = 'none';

    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
        (position) => {
            currentLatitude = position.coords.latitude;
            currentLongitude = position.coords.longitude;
            
            if (statusDiv) {
                statusDiv.textContent = `現在地: 緯度 ${currentLatitude.toFixed(4)}, 経度 ${currentLongitude.toFixed(4)}`;
            }
            if (mapIframe) {
                mapIframe.src = `https://maps.google.com/maps?q=${currentLatitude},${currentLongitude}&z=15&output=embed`;
                mapIframe.style.display = 'block';
            }
            if (mapWarning) mapWarning.style.display = 'none';
            
            hideSplash();
            if (mainContent) mainContent.style.display = 'block';
        },
        (error) => {
            let errorMsg = '🚨 位置情報が取得できませんでした。';
            
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    errorMsg = '🚨 位置情報の利用が拒否されています。ブラウザの設定で「位置情報アクセス権限」を「許可」にしてください。';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMsg = '🚨 電波状況等により現在地を判定できませんでした。';
                    break;
                case error.TIMEOUT:
                    errorMsg = '🚨 位置情報の取得がタイムアウトしました。もう一度「🔄 再取得」を押してください。';
                    break;
            }

            if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
                errorMsg += ' (※Webサイトが https:// で保護されていない場合機能しません)';
            }

            if (statusDiv) statusDiv.textContent = '位置情報の取得に失敗しました';
            if (mapWarning) {
                mapWarning.textContent = errorMsg;
                mapWarning.style.display = 'block';
            }

            hideSplash();
            if (mainContent) mainContent.style.display = 'block';
        },
        options
    );
}

// --- 確実な直通ルート検索処理 (Google Maps Transitエンジン使用) ---
function searchNavitimeExternal() {
    let origin = document.getElementById('rt-origin').value.trim();
    let destination = document.getElementById('rt-destination').value.trim();
    const mode = document.getElementById('rt-mode').value;

    if (!origin) {
        alert('出発地点を入力してください。');
        return;
    }
    if (!destination) {
        alert('目的地を入力してください。');
        return;
    }

    // バス・電車を問わず確実に結果を表示できるGoogle Maps経路URL
    let travelMode = 'transit'; // 公共交通機関（バス・電車）
    if (mode === 'bus') travelMode = 'transit'; 
    if (mode === 'train') travelMode = 'transit';

    const targetUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=${travelMode}`;

    // 別タブで直接ルート画面を開く
    window.open(targetUrl, '_blank');
}

// ナビタイムカードのリセット処理
function resetNavitimeCard() {
    document.getElementById('rt-origin').value = '';
    document.getElementById('rt-destination').value = '';
    document.getElementById('rt-mode').selectedIndex = 0;
}

// --- 設定モーダル制御 ---
function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;

    document.getElementById('setting-new-username').value = '';
    document.getElementById('setting-old-pass').value = '';
    document.getElementById('setting-new-pass').value = '';

    const historySaveSetting = localStorage.getItem(`save_history_setting_${currentUser}`);
    const isHistoryEnabled = historySaveSetting === null ? true : JSON.parse(historySaveSetting);
    document.getElementById('setting-save-history-toggle').checked = isHistoryEnabled;

    const dblclickDeleteSetting = localStorage.getItem(`dblclick_delete_setting_${currentUser}`);
    const isDblclickEnabled = dblclickDeleteSetting === null ? true : JSON.parse(dblclickDeleteSetting);
    document.getElementById('setting-dblclick-delete-toggle').checked = isDblclickEnabled;

    tempSectionOrder = getCurrentSectionOrder();
    tempBlindedSections = getCurrentBlindedSections();

    renderReorderList();
    modal.style.display = 'flex';
}

function saveSettingsModal() {
    const isHistorySaveChecked = document.getElementById('setting-save-history-toggle').checked;
    localStorage.setItem(`save_history_setting_${currentUser}`, JSON.stringify(isHistorySaveChecked));
    if (!isHistorySaveChecked) {
        localStorage.removeItem(`history_${currentUser}`);
    }

    const isDblclickChecked = document.getElementById('setting-dblclick-delete-toggle').checked;
    localStorage.setItem(`dblclick_delete_setting_${currentUser}`, JSON.stringify(isDblclickChecked));

    localStorage.setItem(`section_order_${currentUser}`, JSON.stringify(tempSectionOrder));
    localStorage.setItem(`blinded_sections_${currentUser}`, JSON.stringify(tempBlindedSections));

    applySavedSectionOrder();
    applySavedBlindedState();
    loadSearchHistory();

    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'none';
}

function cancelSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'none';
}

// --- ユーザー名変更 ---
function updateUsername() {
    const newName = document.getElementById('setting-new-username').value.trim();
    if (!newName) {
        alert('新しいユーザー名を入力してください。');
        return;
    }
    if (newName === currentUser) {
        alert('現在のユーザー名と同じです。');
        return;
    }

    const usersDb = JSON.parse(localStorage.getItem('app_users_db') || '{}');
    if (usersDb[newName]) {
        alert('そのユーザー名はすでに使用されています。');
        return;
    }

    const currentPass = usersDb[currentUser];
    delete usersDb[currentUser];
    usersDb[newName] = currentPass;
    localStorage.setItem('app_users_db', JSON.stringify(usersDb));

    const oldHistory = localStorage.getItem(`history_${currentUser}`);
    if (oldHistory) {
        localStorage.setItem(`history_${newName}`, oldHistory);
        localStorage.removeItem(`history_${currentUser}`);
    }

    const oldOrder = localStorage.getItem(`section_order_${currentUser}`);
    if (oldOrder) {
        localStorage.setItem(`section_order_${newName}`, oldOrder);
        localStorage.removeItem(`section_order_${currentUser}`);
    }

    const oldCollapsed = localStorage.getItem(`collapsed_sections_${currentUser}`);
    if (oldCollapsed) {
        localStorage.setItem(`collapsed_sections_${newName}`, oldCollapsed);
        localStorage.removeItem(`collapsed_sections_${currentUser}`);
    }

    const oldBlinded = localStorage.getItem(`blinded_sections_${currentUser}`);
    if (oldBlinded) {
        localStorage.setItem(`blinded_sections_${newName}`, oldBlinded);
        localStorage.removeItem(`blinded_sections_${currentUser}`);
    }

    const oldDblclick = localStorage.getItem(`dblclick_delete_setting_${currentUser}`);
    if (oldDblclick) {
        localStorage.setItem(`dblclick_delete_setting_${newName}`, oldDblclick);
        localStorage.removeItem(`dblclick_delete_setting_${currentUser}`);
    }

    currentUser = newName;
    localStorage.setItem('current_active_user', currentUser);
    if (localStorage.getItem('saved_username')) {
        localStorage.setItem('saved_username', currentUser);
    }

    document.getElementById('current-user-display').textContent = currentUser;
    alert('ユーザー名を変更しました。');
}

// --- パスワード変更 ---
function updatePassword() {
    const oldPass = document.getElementById('setting-old-pass').value.trim();
    const newPass = document.getElementById('setting-new-pass').value.trim();

    if (!oldPass || !newPass) {
        alert('現在のパスワードと新しいパスワードの両方を入力してください。');
        return;
    }

    const usersDb = JSON.parse(localStorage.getItem('app_users_db') || '{}');
    if (usersDb[currentUser] !== oldPass) {
        alert('現在のパスワードが間違っています。');
        return;
    }

    usersDb[currentUser] = newPass;
    localStorage.setItem('app_users_db', JSON.stringify(usersDb));

    if (localStorage.getItem('saved_password')) {
        localStorage.setItem('saved_password', newPass);
    }

    alert('パスワードを変更しました。');
}

// --- カード配置 ＆ ブラインド管理 ---
function getCurrentSectionOrder() {
    const savedOrder = localStorage.getItem(`section_order_${currentUser}`);
    return savedOrder ? JSON.parse(savedOrder) : [...DEFAULT_SECTION_ORDER];
}

function getCurrentBlindedSections() {
    const savedBlinded = localStorage.getItem(`blinded_sections_${currentUser}`);
    return savedBlinded ? JSON.parse(savedBlinded) : [];
}

function applySavedSectionOrder() {
    const container = document.getElementById('app-sections-container');
    if (!container) return;

    const order = getCurrentSectionOrder();
    order.forEach(id => {
        const elem = document.querySelector(`[data-section-id="${id}"]`);
        if (elem) container.appendChild(elem);
    });
}

function applySavedBlindedState() {
    const blindedList = getCurrentBlindedSections();
    DEFAULT_SECTION_ORDER.forEach(id => {
        const elem = document.getElementById(id);
        if (elem) {
            if (blindedList.includes(id)) {
                elem.classList.add('blinded');
            } else {
                elem.classList.remove('blinded');
            }
        }
    });
}

function renderReorderList() {
    const listContainer = document.getElementById('reorder-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    tempSectionOrder.forEach((id, index) => {
        const item = document.createElement('div');
        const isBlinded = tempBlindedSections.includes(id);
        item.className = `reorder-item ${isBlinded ? 'is-blinded' : ''}`;
        
        const label = document.createElement('span');
        label.textContent = SECTION_NAMES[id] || id;

        const btns = document.createElement('div');
        btns.className = 'reorder-btns';

        const blindBtn = document.createElement('button');
        blindBtn.textContent = isBlinded ? '🙈 隠す' : '👁️ 表示';
        blindBtn.onclick = () => toggleTempBlind(id);
        btns.appendChild(blindBtn);

        if (index > 0) {
            const upBtn = document.createElement('button');
            upBtn.textContent = '▲';
            upBtn.onclick = () => moveTempSectionOrder(index, -1);
            btns.appendChild(upBtn);
        }

        if (index < tempSectionOrder.length - 1) {
            const downBtn = document.createElement('button');
            downBtn.textContent = '▼';
            downBtn.onclick = () => moveTempSectionOrder(index, 1);
            btns.appendChild(downBtn);
        }

        item.appendChild(label);
        item.appendChild(btns);
        listContainer.appendChild(item);
    });
}

function toggleTempBlind(id) {
    if (tempBlindedSections.includes(id)) {
        tempBlindedSections = tempBlindedSections.filter(item => item !== id);
    } else {
        tempBlindedSections.push(id);
    }
    renderReorderList();
}

function moveTempSectionOrder(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= tempSectionOrder.length) return;

    const temp = tempSectionOrder[index];
    tempSectionOrder[index] = tempSectionOrder[targetIndex];
    tempSectionOrder[targetIndex] = temp;

    renderReorderList();
}

function resetSectionOrder() {
    if (!confirm('カードの配置と表示設定を初期状態に戻しますか？')) return;

    tempSectionOrder = [...DEFAULT_SECTION_ORDER];
    tempBlindedSections = [];
    renderReorderList();
}

// --- アカウント削除 ---
function deleteAccount() {
    if (!confirm('本当にアカウントを削除しますか？この操作は取り消せません。')) return;

    const usersDb = JSON.parse(localStorage.getItem('app_users_db') || '{}');
    delete usersDb[currentUser];
    localStorage.setItem('app_users_db', JSON.stringify(usersDb));

    localStorage.removeItem(`history_${currentUser}`);
    localStorage.removeItem(`section_order_${currentUser}`);
    localStorage.removeItem(`collapsed_sections_${currentUser}`);
    localStorage.removeItem(`blinded_sections_${currentUser}`);
    localStorage.removeItem(`save_history_setting_${currentUser}`);
    localStorage.removeItem(`dblclick_delete_setting_${currentUser}`);

    handleLogout();
}

// --- テーマ切り替え ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark-mode';
    document.body.className = savedTheme;
    updateThemeButtonText(savedTheme);
}

function toggleTheme() {
    const isDark = document.body.classList.contains('dark-mode');
    const newTheme = isDark ? 'light-mode' : 'dark-mode';
    document.body.className = newTheme;
    localStorage.setItem('theme', newTheme);
    updateThemeButtonText(newTheme);
}

function updateThemeButtonText(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
        btn.textContent = theme === 'dark-mode' ? '☀️ ライト' : '🌙 ダーク';
    }
}

// --- セクション開閉 ---
function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;

    section.classList.toggle('collapsed');

    const collapsedList = [];
    document.querySelectorAll('.collapsible-section.collapsed').forEach(elem => {
        collapsedList.push(elem.id);
    });

    localStorage.setItem(`collapsed_sections_${currentUser}`, JSON.stringify(collapsedList));
}

function applySavedCollapsedState() {
    if (!currentUser) return;
    const saved = localStorage.getItem(`collapsed_sections_${currentUser}`);
    if (!saved) return;

    const collapsedList = JSON.parse(saved);
    collapsedList.forEach(id => {
        const elem = document.getElementById(id);
        if (elem) {
            elem.classList.add('collapsed');
        }
    });
}

// --- ルート検索 ＆ 時間予測 ---
function calculateRouteAndDisplay() {
    const destination = destinationInput ? destinationInput.value.trim() : '';
    if (!currentLatitude || !currentLongitude) {
        alert('現在地が取得されていません。「🔄 再取得」ボタンを押してみてください。');
        return;
    }
    if (!destination) {
        alert('目的地を入力してください。');
        return;
    }

    lastDestination = destination;
    saveToSearchHistory(destination);

    const origin = `${currentLatitude},${currentLongitude}`;
    if (mapIframe) {
        mapIframe.src = `https://maps.google.com/maps?saddr=${origin}&daddr=${encodeURIComponent(destination)}&output=embed`;
        mapIframe.style.display = 'block';
    }

    fetchGeocodeAndCalculate(destination);

    const openMapsBtn = document.getElementById('open-maps-btn');
    if (openMapsBtn) openMapsBtn.style.display = 'block';
}

function fetchGeocodeAndCalculate(destination) {
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination)}`)
        .then(res => res.json())
        .then(data => {
            if (data && data.length > 0) {
                const destLat = parseFloat(data[0].lat);
                const destLon = parseFloat(data[0].lon);
                const distKm = getHaversineDistance(currentLatitude, currentLongitude, destLat, destLon);
                displayEstimatedTimes(distKm);
            } else {
                displayFallbackTimes();
            }
        })
        .catch(() => displayFallbackTimes());
}

function getHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function displayEstimatedTimes(distKm) {
    let roadDist = distKm;
    
    if (distKm < 3) {
        roadDist = distKm * 1.45;
    } else if (distKm < 20) {
        roadDist = distKm * 1.35;
    } else {
        roadDist = distKm * 1.25;
    }

    const walkMin = Math.round((roadDist / 4.0) * 60);         
    const bikeMin = Math.round((roadDist / 14.0) * 60);        
    const carMin = Math.round((roadDist / 25.0) * 60);         
    const transitMin = Math.round((roadDist / 22.0) * 60) + 8; 

    document.getElementById('distance').textContent = `目安距離: 約 ${roadDist.toFixed(1)} km`;
    document.getElementById('travel-time-walking').textContent = `🚶 徒歩: 約 ${formatMinutes(walkMin)}`;
    document.getElementById('travel-time-bicycling').textContent = `🚲 自転車: 約 ${formatMinutes(bikeMin)}`;
    document.getElementById('travel-time-driving').textContent = `🚗 車: 約 ${formatMinutes(carMin)}`;
    document.getElementById('travel-time-transit').textContent = `🚃 公共交通機関: 約 ${formatMinutes(transitMin)}`;
}

function displayFallbackTimes() {
    document.getElementById('distance').textContent = `目安距離: マップをご確認ください`;
    document.getElementById('travel-time-walking').textContent = `🚶 徒歩: マップで確認`;
    document.getElementById('travel-time-bicycling').textContent = `🚲 自転車: マップで確認`;
    document.getElementById('travel-time-driving').textContent = `🚗 車: マップで確認`;
    document.getElementById('travel-time-transit').textContent = `🚃 公共交通機関: マップで確認`;
}

function formatMinutes(min) {
    if (min < 60) return `${min} 分`;
    return `${Math.floor(min / 60)} 時間 ${min % 60} 分`;
}

function openExternalGoogleMaps() {
    if (!lastDestination || !currentLatitude) return;
    window.open(`https://www.google.com/maps/dir/${currentLatitude},${currentLongitude}/${encodeURIComponent(lastDestination)}`, '_blank');
}

// --- 検索履歴管理 ---
function getUserHistoryKey() {
    return `history_${currentUser}`;
}

function loadSearchHistory() {
    const clearAllBtn = document.getElementById('clear-all-history-btn');
    if (!historyDiv || !currentUser) return;

    const historySaveSetting = localStorage.getItem(`save_history_setting_${currentUser}`);
    const isHistoryEnabled = historySaveSetting === null ? true : JSON.parse(historySaveSetting);

    if (!isHistoryEnabled) {
        historyDiv.innerHTML = '';
        if (clearAllBtn) clearAllBtn.style.display = 'none';
        return;
    }

    const history = JSON.parse(localStorage.getItem(getUserHistoryKey()) || '[]');
    historyDiv.innerHTML = '';

    if (history.length === 0) {
        historyDiv.textContent = '履歴: なし';
        if (clearAllBtn) clearAllBtn.style.display = 'none';
        return;
    }

    if (clearAllBtn) clearAllBtn.style.display = 'block';

    const label = document.createElement('span');
    label.textContent = '履歴: ';
    historyDiv.appendChild(label);

    const dblclickDeleteSetting = localStorage.getItem(`dblclick_delete_setting_${currentUser}`);
    const isDblclickEnabled = dblclickDeleteSetting === null ? true : JSON.parse(dblclickDeleteSetting);

    history.forEach(item => {
        const span = document.createElement('span');
        span.className = 'history-item';
        
        const textNode = document.createElement('span');
        textNode.textContent = item;
        
        textNode.onclick = () => {
            if (destinationInput) destinationInput.value = item;
        };

        if (isDblclickEnabled) {
            textNode.ondblclick = (e) => {
                e.stopPropagation();
                deleteHistoryItem(item);
            };
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-history-btn';
        deleteBtn.textContent = '×';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteHistoryItem(item);
        };

        span.appendChild(textNode);
        span.appendChild(deleteBtn);
        historyDiv.appendChild(span);
    });
}

function saveToSearchHistory(destination) {
    if (!destination || !currentUser) return;

    const historySaveSetting = localStorage.getItem(`save_history_setting_${currentUser}`);
    const isHistoryEnabled = historySaveSetting === null ? true : JSON.parse(historySaveSetting);
    
    if (!isHistoryEnabled) return;

    let history = JSON.parse(localStorage.getItem(getUserHistoryKey()) || '[]');
    history = history.filter(item => item !== destination);
    history.unshift(destination);

    if (history.length > 5) history = history.slice(0, 5);

    localStorage.setItem(getUserHistoryKey(), JSON.stringify(history));
    loadSearchHistory();
}

function deleteHistoryItem(itemToDelete) {
    if (!currentUser) return;
    let history = JSON.parse(localStorage.getItem(getUserHistoryKey()) || '[]');
    history = history.filter(item => item !== itemToDelete);
    localStorage.setItem(getUserHistoryKey(), JSON.stringify(history));
    loadSearchHistory();
}

function clearAllSearchHistory() {
    if (!confirm('検索履歴をすべて削除しますか？')) return;
    if (!confirm('本当にすべて消去してもよろしいですか？（この操作は取り消せません）')) return;

    localStorage.removeItem(getUserHistoryKey());
    loadSearchHistory();
}

// --- ユーティリティ ---
function performGoogleSearch() {
    if (!googleSearchInput) return;
    const query = googleSearchInput.value.trim();
    if (query) {
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
        googleSearchInput.value = '';
    } else {
        alert('検索キーワードを入力してください。');
    }
}

function goToTrainScheduleSite() {
    window.open("https://www.navitime.co.jp/transfer/", '_blank');
}

function goToBusScheduleSite() {
    const urlInput = document.getElementById('bus-schedule-url');
    let url = urlInput ? urlInput.value.trim() : '';
    if (!url) {
        alert('URLを入力してください。');
        return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    window.open(url, '_blank');
}

function updateTime() {
    const now = new Date();
    const timeElem = document.getElementById('current-time');
    if (timeElem) {
        timeElem.textContent = `現在時刻: ${now.getHours()}時${now.getMinutes()}分${now.getSeconds()}秒`;
    }
}