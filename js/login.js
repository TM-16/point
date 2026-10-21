document.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('saved_username');
    const savedPass = localStorage.getItem('saved_password');

    if (savedUser && savedPass) {
        localStorage.setItem('current_active_user', savedUser);
        window.location.href = 'point.html';
    } else {
        hideSplash();
    }
});

function handleLogin() {
    const userIn = document.getElementById('login-username').value.trim();
    const passIn = document.getElementById('login-password').value.trim();
    const rememberMe = document.getElementById('remember-me').checked;

    if (!userIn || !passIn) {
        alert('ユーザー名とパスワードを入力してください。');
        return;
    }

    const usersDb = JSON.parse(localStorage.getItem('app_users_db') || '{}');

    if (usersDb[userIn]) {
        if (usersDb[userIn] !== passIn) {
            alert('パスワードが正しくありません。');
            return;
        }
    } else {
        usersDb[userIn] = passIn;
        localStorage.setItem('app_users_db', JSON.stringify(usersDb));
    }

    localStorage.setItem('current_active_user', userIn);

    if (rememberMe) {
        localStorage.setItem('saved_username', userIn);
        localStorage.setItem('saved_password', passIn);
    } else {
        localStorage.removeItem('saved_username');
        localStorage.removeItem('saved_password');
    }

    window.location.href = 'point.html';
}

// パスワードの表示/非表示切り替え
function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;

    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
}

function hideSplash() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.classList.add('hidden');
        setTimeout(() => splash.style.display = 'none', 400);
    }
}