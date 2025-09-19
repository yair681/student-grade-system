document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const messageDiv = document.getElementById('message');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();
            if (response.ok) {
                // Store user info in session storage
                sessionStorage.setItem('userRole', result.user.role);
                sessionStorage.setItem('userId', result.user.id);
                
                if (result.user.role === 'teacher') {
                    window.location.href = 'teacher.html';
                } else if (result.user.role === 'student') {
                    window.location.href = 'student.html';
                }
            } else {
                showMessage(result.message || 'שם משתמש או סיסמה שגויים.', true);
            }
        } catch (error) {
            console.error('Login error:', error);
            showMessage('שגיאה בתקשורת עם השרת.', true);
        }
    });

    const showMessage = (msg, isError = false) => {
        messageDiv.textContent = msg;
        messageDiv.className = isError ? 'error' : 'message';
    };
});