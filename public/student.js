document.addEventListener('DOMContentLoaded', () => {
    const studentInfoDiv = document.getElementById('student-info');
    const dataDisplayDiv = document.getElementById('data-display');
    const absencesDisplayDiv = document.getElementById('absences-display');
    const delaysDisplayDiv = document.getElementById('delays-display');
    const messageDiv = document.getElementById('message');
    const notificationsList = document.getElementById('notifications-list');
    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    const socket = io();
    const publicVapidKey = 'YOUR_PUBLIC_VAPID_KEY'; // החלף במפתח שלך

    const checkAuthAndLoad = async () => {
        const userId = sessionStorage.getItem('userId');
        const userRole = sessionStorage.getItem('userRole');
        
        if (userRole !== 'student' || !userId) {
            window.location.href = 'login.html';
            return;
        }

        socket.emit('joinStudentRoom', userId);
        
        await subscribeUser(userId);

        try {
            const studentDataResponse = await fetch(`/api/student/${userId}`);
            if (!studentDataResponse.ok) {
                 showMessage('שגיאה בטעינת נתוני התלמיד.', true);
                return;
            }
            const student = await studentDataResponse.json();
            if (student) {
                displayStudentData(student);
            } else {
                showMessage('אין נתונים זמינים עבורך.', true);
            }
        } catch (error) {
            console.error('Auth error:', error);
            window.location.href = 'login.html';
        }
    };
    
    async function subscribeUser(studentId) {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            return;
        }

        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const registration = await navigator.serviceWorker.register('/service-worker.js');
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
                });
                await fetch('/api/subscribe', {
                    method: 'POST',
                    body: JSON.stringify({ studentId, subscription }),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
            }
        } catch (error) {
            console.error('Push subscription failed:', error);
        }
    }

    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    const displayStudentData = (student) => {
        studentInfoDiv.innerHTML = `
            <h2>${student.name}</h2>
            <p><strong>כיתה:</strong> ${student.class}</p>
        `;

        dataDisplayDiv.innerHTML = `
            <h3>ציונים</h3>
            <ul class="grades-list">
                ${student.grades && student.grades.length > 0 ? student.grades.map(g => `
                    <li>
                        <div class="grade-item">
                            <div class="grade-main">
                                <span class="grade-subject">${g.subject || 'מקצוע לא ידוע'}</span>
                                <span class="grade-value">${g.grade || 'ציון לא ידוע'}</span>
                            </div>
                            <small class="grade-meta">${g.date || 'תאריך לא ידוע'}</small>
                        </div>
                    </li>
                `).join('') : '<li>אין ציונים להצגה.</li>'}
            </ul>
        `;

        absencesDisplayDiv.innerHTML = `
            <h3>חיסורים</h3>
            <ul class="absences-list">
                ${student.absences && student.absences.length > 0 ? student.absences.map(a => `
                    <li>
                        <div class="absence-item">
                            <span class="absence-hours">${a.hours} שעות</span>
                            <small class="absence-meta">${a.date || 'תאריך לא ידוע'}</small>
                        </div>
                    </li>
                `).join('') : '<li>אין חיסורים להצגה.</li>'}
            </ul>
        `;

        delaysDisplayDiv.innerHTML = `
            <h3>איחורים</h3>
            <ul class="delays-list">
                ${student.delays && student.delays.length > 0 ? student.delays.map(d => `
                    <li>
                        <div class="delay-item">
                            <span class="delay-minutes">${d.minutes} דקות</span>
                            <small class="delay-meta">${d.date || 'תאריך לא ידוע'}</small>
                        </div>
                    </li>
                `).join('') : '<li>אין איחורים להצגה.</li>'}
            </ul>
        `;
    };

    const showMessage = (msg, isError = false) => {
        messageDiv.textContent = msg;
        messageDiv.className = isError ? 'error active' : 'message active';
    };

    socket.on('update', async (data) => {
        const notificationItem = document.createElement('li');
        notificationItem.className = 'notification-item';
        notificationItem.innerHTML = `<span class="notification-message">עדכון חדש:</span> ${data.message}`;
        notificationsList.prepend(notificationItem);
    
        const userId = sessionStorage.getItem('userId');
        if (userId) {
            try {
                const response = await fetch(`/api/student/${userId}`);
                if (response.ok) {
                    const studentData = await response.json();
                    displayStudentData(studentData);
                }
            } catch(e) {
                console.error('Failed to reload student data after update:', e);
            }
        }
    });
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(tab.dataset.tab + '-tab').classList.add('active');
        });
    });

    checkAuthAndLoad();
});