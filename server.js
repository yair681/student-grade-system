const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs').promises;
const { Server } = require('socket.io');
const webpush = require('web-push');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// הגדרת מפתחות VAPID להתראות דחיפה
const publicVapidKey = 'BMODj3gboA8deZ15gbisEzC--nMOHStod1_C8TSDaRWRFNXfMqjYyyv_JUUVcW8txXpPguXKmI3PrKQwpFhVQKg';
const privateVapidKey = 'JqMTcI-1IDNh6qWiB6qrQtor6f1d6LlZvvGLyj7Yl2M';

webpush.setVapidDetails('mailto:your_email@example.com', publicVapidKey, privateVapidKey);

// Middleware
app.use(express.json());
app.use(express.static('public'));

const dataPath = path.join(__dirname, 'data.json');

// Helper functions
const readData = async () => {
    try {
        const data = await fs.readFile(dataPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            const initialData = { users: [], students: [] };
            await fs.writeFile(dataPath, JSON.stringify(initialData, null, 2));
            return initialData;
        }
        throw error;
    }
};

const writeData = async (data) => {
    await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
};

// --- Authentication Endpoints ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const data = await readData();
    const user = data.users.find(u => u.username === username && u.password === password);
    
    if (user) {
        res.json({ message: 'Login successful', user: { id: user.id, role: user.role } });
    } else {
        res.status(401).send('Invalid credentials');
    }
});

app.get('/api/me', (req, res) => {
    res.status(200).send();
});

// נקודת קצה חדשה לשמירת מנויי התראות דחיפה
app.post('/api/subscribe', async (req, res) => {
    const { studentId, subscription } = req.body;
    if (!studentId || !subscription) {
        return res.status(400).send('Missing studentId or subscription.');
    }

    const data = await readData();
    const student = data.students.find(s => s.id === parseInt(studentId));
    if (student) {
        student.pushSubscription = subscription;
        await writeData(data);
        console.log(`Push subscription saved for student ${studentId}.`);
        res.status(201).json({ message: 'Subscription saved' });
    } else {
        res.status(404).send('Student not found');
    }
});

// --- Teacher-specific Endpoints ---
app.post('/api/create-student', async (req, res) => {
    const { name, className, username, password } = req.body;
    const data = await readData();
    
    if (data.users.some(u => u.username === username)) {
        return res.status(409).send('Username already exists');
    }

    const studentId = data.users.length + 1;
    const newStudent = { id: studentId, name, class: className, grades: [], absences: [], delays: [], pushSubscription: null };
    const newStudentUser = { id: studentId, username, password, role: 'student' };

    data.students.push(newStudent);
    data.users.push(newStudentUser);

    await writeData(data);
    res.status(201).json(newStudent);
});

// --- Data Endpoints ---
app.get('/api/students', async (req, res) => {
    const data = await readData();
    res.json(data.students);
});

app.get('/api/student/:id', async (req, res) => {
    const data = await readData();
    const student = data.students.find(s => s.id === parseInt(req.params.id));
    if (student) {
        res.json(student);
    } else {
        res.status(404).send('Student not found');
    }
});

app.post('/api/grades', async (req, res) => {
    const { studentId, subject, grade, date, description } = req.body;
    const data = await readData();
    const student = data.students.find(s => s.id === parseInt(studentId));
    if (student) {
        const newGrade = { id: Date.now(), subject, grade, date, description };
        student.grades.push(newGrade);
        await writeData(data);

        // שליחת התראת דחיפה בנוסף להתראת ה-Socket.IO
        if (student.pushSubscription) {
            const payload = JSON.stringify({
                title: 'עדכון במערכת הציונים',
                body: `ציון חדש הוגש: ${subject} - ${grade}`,
            });
            webpush.sendNotification(student.pushSubscription, payload).catch(error => {
                console.error('Push notification failed:', error);
            });
        }
        
        const message = `ציון חדש הוגש: ${subject} - ${grade}`;
        io.to(studentId).emit('update', { type: 'grade', message: message, data: newGrade });
        res.status(201).json(newGrade);
    } else {
        res.status(404).send('Student not found');
    }
});

app.post('/api/absences', async (req, res) => {
    const { studentId, date, hours, reason } = req.body;
    const data = await readData();
    const student = data.students.find(s => s.id === parseInt(studentId));
    if (student) {
        const newAbsence = { id: Date.now(), date, hours, reason };
        student.absences.push(newAbsence);
        await writeData(data);
        const message = `חיסור חדש: ${hours} שעות בתאריך ${date}`;
        io.to(studentId).emit('update', { type: 'absence', message: message, data: newAbsence });
        res.status(201).json(newAbsence);
    } else {
        res.status(404).send('Student not found');
    }
});

app.post('/api/delays', async (req, res) => {
    const { studentId, date, minutes, reason } = req.body;
    const data = await readData();
    const student = data.students.find(s => s.id === parseInt(studentId));
    if (student) {
        const newDelay = { id: Date.now(), date, minutes, reason };
        student.delays.push(newDelay);
        await writeData(data);
        const message = `איחור חדש: ${minutes} דקות בתאריך ${date}`;
        io.to(studentId).emit('update', { type: 'delay', message: message, data: newDelay });
        res.status(201).json(newDelay);
    } else {
        res.status(404).send('Student not found');
    }
});

// Socket.IO for real-time updates
io.on('connection', (socket) => {
    console.log('A user connected');
    socket.on('joinStudentRoom', (studentId) => {
        socket.join(studentId);
        console.log(`User joined student room: ${studentId}`);
    });
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Login page: http://localhost:${PORT}/login.html`);
});