document.addEventListener('DOMContentLoaded', () => {
    const studentSelect = document.getElementById('teacher-student-select');
    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const gradeForm = document.getElementById('grade-form');
    const absenceForm = document.getElementById('absence-form');
    const delayForm = document.getElementById('delay-form');
    const createStudentForm = document.getElementById('create-student-form');
    const messageDiv = document.getElementById('message');
    let selectedStudentId = null;

    const checkAuthAndLoad = async () => {
        const userRole = sessionStorage.getItem('userRole');
        if (userRole !== 'teacher') {
            window.location.href = 'login.html';
            return;
        }
        await loadStudents();
        if (studentSelect.options.length > 1) {
            studentSelect.value = studentSelect.options[1].value;
            selectedStudentId = studentSelect.options[1].value;
            showMessage(`נבחר תלמיד: ${studentSelect.options[1].text}`);
        }
    };
    
    const loadStudents = async () => {
        try {
            const response = await fetch('/api/students');
            const students = await response.json();
            
            studentSelect.innerHTML = '<option value="">בחר תלמיד...</option>';
            students.forEach(student => {
                const option = document.createElement('option');
                option.value = student.id;
                option.textContent = `${student.name} (${student.class})`;
                studentSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load students:', error);
            showMessage('שגיאה בטעינת התלמידים. נסה לרענן את הדף.', true);
        }
    };

    createStudentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('student-name-input').value;
        const className = document.getElementById('student-class-input').value;
        const username = document.getElementById('student-username-input').value;
        const password = document.getElementById('student-password-input').value;

        try {
            const response = await fetch('/api/create-student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, className, username, password })
            });

            if (response.ok) {
                showMessage('התלמיד נוצר בהצלחה!');
                createStudentForm.reset();
                loadStudents();
            } else {
                const errorText = await response.text();
                showMessage(`שגיאה ביצירת תלמיד: ${errorText}`, true);
            }
        } catch (error) {
            console.error('Student creation error:', error);
            showMessage('אירעה שגיאה. נסה שוב.', true);
        }
    });

    studentSelect.addEventListener('change', (e) => {
        selectedStudentId = e.target.value;
        if (selectedStudentId) {
            showMessage(`נבחר תלמיד: ${studentSelect.options[studentSelect.selectedIndex].text}`);
        } else {
            showMessage('אנא בחר תלמיד.', true);
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

    const sendData = async (endpoint, data, form) => {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            
            if (response.ok) {
                showMessage('הנתונים נשמרו בהצלחה!');
                form.reset();
            } else {
                const errorText = await response.text();
                showMessage(`שגיאה בשמירת הנתונים: ${errorText}`, true);
            }
        } catch (error) {
            console.error('Form submission error:', error);
            showMessage('אירעה שגיאה. נסה שוב.', true);
        }
    };

    gradeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedStudentId) {
            showMessage('אנא בחר תלמיד.', true);
            return;
        }
        console.log(`Sending grade for student ID: ${selectedStudentId}`); // **NEW**
        const data = {
            studentId: selectedStudentId,
            subject: document.getElementById('grade-subject').value,
            grade: Number(document.getElementById('grade-value').value),
            date: document.getElementById('grade-date').value,
            description: document.getElementById('grade-description').value
        };
        await sendData('/api/grades', data, gradeForm);
    });

    absenceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedStudentId) {
            showMessage('אנא בחר תלמיד.', true);
            return;
        }
        const data = {
            studentId: selectedStudentId,
            date: document.getElementById('absence-date').value,
            hours: Number(document.getElementById('absence-hours').value),
            reason: document.getElementById('absence-reason').value
        };
        await sendData('/api/absences', data, absenceForm);
    });

    delayForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedStudentId) {
            showMessage('אנא בחר תלמיד.', true);
            return;
        }
        const data = {
            studentId: selectedStudentId,
            date: document.getElementById('delay-date').value,
            minutes: Number(document.getElementById('delay-minutes').value),
            reason: document.getElementById('delay-reason').value
        };
        await sendData('/api/delays', data, delayForm);
    });

    const showMessage = (msg, isError = false) => {
        messageDiv.textContent = msg;
        messageDiv.className = isError ? 'error' : 'message';
    };

    checkAuthAndLoad();
});