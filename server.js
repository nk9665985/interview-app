const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Initialize SQLite Database
const db = new sqlite3.Database('./interview_app.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initDatabase();
  }
});

// Initialize Database Tables
function initDatabase() {
  // Create Users Table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create Questions Table
  db.run(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      question_text TEXT NOT NULL,
      options TEXT NOT NULL,
      correct_answer INTEGER NOT NULL,
      difficulty TEXT DEFAULT 'medium',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create Results Table
  db.run(`
    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      score INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      time_taken INTEGER NOT NULL,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Insert default admin if not exists
  db.get('SELECT * FROM users WHERE email = ?', ['admin@interviewapp.com'], (err, row) => {
    if (!row) {
      bcrypt.hash('admin123', 10, (err, hash) => {
        if (!err) {
          db.run(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            ['Admin', 'admin@interviewapp.com', hash, 'admin'],
            (err) => {
              if (!err) console.log('Default admin created: admin@interviewapp.com / admin123');
            }
          );
        }
      });
    }
  });

  // Insert sample questions if none exist
  db.get('SELECT COUNT(*) as count FROM questions', (err, row) => {
    if (row && row.count === 0) {
      const sampleQuestions = [
        { category: 'Technical', question_text: 'What is the time complexity of binary search?', options: JSON.stringify(['O(1)', 'O(n)', 'O(log n)', 'O(n log n)']), correct_answer: 2, difficulty: 'easy' },
        { category: 'Technical', question_text: 'Which data structure uses LIFO principle?', options: JSON.stringify(['Queue', 'Stack', 'Array', 'Linked List']), correct_answer: 1, difficulty: 'easy' },
        { category: 'Technical', question_text: 'What does SQL stand for?', options: JSON.stringify(['Structured Query Language', 'Simple Query Language', 'Standard Query Language', 'System Query Language']), correct_answer: 0, difficulty: 'easy' },
        { category: 'Technical', question_text: 'Which HTTP method is used to update an existing resource?', options: JSON.stringify(['GET', 'POST', 'PUT', 'DELETE']), correct_answer: 2, difficulty: 'medium' },
        { category: 'Technical', question_text: 'What is the purpose of index in database?', options: JSON.stringify(['To store data', 'To speed up data retrieval', 'To delete data', 'To update data']), correct_answer: 1, difficulty: 'medium' },
        { category: 'HR', question_text: 'What are your greatest strengths?', options: JSON.stringify(['I am hardworking', 'I am a team player', 'I have good communication skills', 'All of the above']), correct_answer: 3, difficulty: 'easy' },
        { category: 'HR', question_text: 'Where do you see yourself in 5 years?', options: JSON.stringify(['In a managerial role', 'In a senior technical role', 'Starting my own business', 'Continuing to grow with the company']), correct_answer: 3, difficulty: 'medium' },
        { category: 'HR', question_text: 'Why should we hire you?', options: JSON.stringify(['Because I need a job', 'Because I have the skills and passion', 'Because I am qualified', 'Because I am available']), correct_answer: 1, difficulty: 'medium' },
        { category: 'Aptitude', question_text: 'If 2x + 5 = 15, what is the value of x?', options: JSON.stringify(['5', '10', '7.5', '5.5']), correct_answer: 0, difficulty: 'easy' },
        { category: 'Aptitude', question_text: 'What comes next in the sequence: 2, 6, 12, 20, ?', options: JSON.stringify(['28', '30', '32', '36']), correct_answer: 1, difficulty: 'medium' }
      ];

      const stmt = db.prepare('INSERT INTO questions (category, question_text, options, correct_answer, difficulty) VALUES (?, ?, ?, ?, ?)');
      sampleQuestions.forEach(q => {
        stmt.run(q.category, q.question_text, q.options, q.correct_answer, q.difficulty);
      });
      stmt.finalize();
      console.log('Sample questions inserted');
    }
  });

  console.log('Database initialized successfully');
}

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'interviewappsecretkey123';

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Admin Middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ==================== ROUTES ====================

// Auth Routes
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
    if (row) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      db.run(
        'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
        [name, email, hash],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          const token = jwt.sign({ id: this.lastID, email, role: 'user' }, JWT_SECRET, { expiresIn: '24h' });
          res.json({ token, user: { id: this.lastID, name, email, role: 'user' } });
        }
      );
    });
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    bcrypt.compare(password, user.password, (err, valid) => {
      if (!valid) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    });
  });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [req.user.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(row);
  });
});

// Question Routes
app.get('/api/questions', authenticateToken, (req, res) => {
  const { category, difficulty, limit = 10 } = req.query;
  let query = 'SELECT * FROM questions';
  let conditions = [];
  let params = [];

  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }
  if (difficulty) {
    conditions.push('difficulty = ?');
    params.push(difficulty);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY RANDOM() LIMIT ?';
  params.push(parseInt(limit));

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    rows = rows.map(row => ({
      ...row,
      options: JSON.parse(row.options)
    }));
    res.json(rows);
  });
});

app.get('/api/questions/all', authenticateToken, requireAdmin, (req, res) => {
  db.all('SELECT * FROM questions ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    rows = rows.map(row => ({
      ...row,
      options: JSON.parse(row.options)
    }));
    res.json(rows);
  });
});

app.delete('/api/questions/:id', authenticateToken, requireAdmin, (req, res) => {
  db.run('DELETE FROM questions WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Question deleted successfully' });
  });
});

// AI Question Generator
app.post('/api/questions/generate-ai', authenticateToken, requireAdmin, (req, res) => {
  const { category, count = 5, difficulty = 'medium' } = req.body;
  const questions = generateSampleQuestions(category, count, difficulty);

  const stmt = db.prepare('INSERT INTO questions (category, question_text, options, correct_answer, difficulty) VALUES (?, ?, ?, ?, ?)');
  questions.forEach(q => {
    stmt.run(category, q.question_text, JSON.stringify(q.options), q.correct_answer, difficulty);
  });
  stmt.finalize();

  res.json({ message: `${questions.length} questions generated successfully`, questions });
});

function generateSampleQuestions(category, count, difficulty) {
  const sampleData = {
    Technical: [
      { question_text: 'What is the difference between GET and POST methods?', options: ['GET is used for retrieving data, POST for sending data', 'POST is faster', 'They are the same', 'GET cannot have parameters'], correct_answer: 0 },
      { question_text: 'What is a closure in JavaScript?', options: ['A function with access to outer scope variables', 'A way to close browser', 'A type of loop', 'A debugging tool'], correct_answer: 0 },
      { question_text: 'What is CSS box model?', options: ['A layout system', 'Content + Padding + Border + Margin', 'A JavaScript framework', 'A database concept'], correct_answer: 1 },
      { question_text: 'What is REST API?', options: ['A programming language', 'An architectural style for APIs', 'A database', 'A testing tool'], correct_answer: 1 },
      { question_text: 'What is Object Oriented Programming?', options: ['A programming paradigm', 'A text editor', 'A database', 'An operating system'], correct_answer: 0 }
    ],
    HR: [
      { question_text: 'What is your greatest weakness?', options: ['I work too hard', 'I am a perfectionist', 'I struggle with time management', 'I get along with everyone'], correct_answer: 1 },
      { question_text: 'Why do you want to work here?', options: ['For the salary', 'I believe in the company mission', 'For job security', 'Because my friend works here'], correct_answer: 1 },
      { question_text: 'How do you handle stress?', options: ['I ignore it', 'I take breaks and prioritize', 'I work more hours', 'I complain to colleagues'], correct_answer: 1 },
      { question_text: 'What are your salary expectations?', options: ['As high as possible', 'Based on market rate and my experience', 'Minimum wage', 'I will work for free'], correct_answer: 1 },
      { question_text: 'Do you prefer working alone or in a team?', options: ['Always alone', 'Always in a team', 'Depends on the task', 'I have no preference'], correct_answer: 2 }
    ],
    Aptitude: [
      { question_text: 'If a train travels 300km in 3 hours, what is its speed?', options: ['90 km/h', '100 km/h', '150 km/h', '200 km/h'], correct_answer: 1 },
      { question_text: 'What is 15% of 200?', options: ['25', '30', '35', '40'], correct_answer: 1 },
      { question_text: 'Complete: 1, 4, 9, 16, ?', options: ['20', '25', '30', '36'], correct_answer: 1 },
      { question_text: 'If a shopkeeper gives 20% discount, what is the price of Rs.1000 item?', options: ['Rs.800', 'Rs.900', 'Rs.1000', 'Rs.1200'], correct_answer: 0 },
      { question_text: 'What is the average of 10, 20, 30, 40?', options: ['20', '25', '30', '35'], correct_answer: 1 }
    ]
  };

  let questions = sampleData[category] || sampleData['Technical'];
  return questions.slice(0, count).map(q => ({
    ...q,
    category,
    difficulty
  }));
}

// Result Routes
app.post('/api/results', authenticateToken, (req, res) => {
  const { score, totalQuestions, timeTaken, category } = req.body;
  
  db.run(
    'INSERT INTO results (user_id, score, total_questions, time_taken, category) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, score, totalQuestions, timeTaken, category],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID, user_id: req.user.id, score, total_questions: totalQuestions, time_taken: timeTaken, category });
    }
  );
});

app.get('/api/results/user/:userId', authenticateToken, (req, res) => {
  if (req.user.id !== parseInt(req.params.userId) && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  db.all(
    'SELECT r.*, u.name, u.email FROM results r JOIN users u ON r.user_id = u.id WHERE r.user_id = ? ORDER BY r.created_at DESC',
    [req.params.userId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

app.get('/api/results/all', authenticateToken, requireAdmin, (req, res) => {
  db.all(
    'SELECT r.*, u.name, u.email FROM results r JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC',
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

// User Routes (Admin)
app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
  db.all('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.delete('/api/users/:id', authenticateToken, requireAdmin, (req, res) => {
  db.run('DELETE FROM users WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'User deleted successfully' });
  });
});

// Stats Route
app.get('/api/stats', authenticateToken, requireAdmin, (req, res) => {
  db.get('SELECT COUNT(*) as totalUsers FROM users', (err, userRow) => {
    db.get('SELECT COUNT(*) as totalQuestions FROM questions', (err, questionRow) => {
      db.get('SELECT COUNT(*) as totalTests FROM results', (err, resultRow) => {
        db.get('SELECT AVG(CAST(score AS FLOAT)/total_questions*100) as avg FROM results', (err, avgRow) => {
          res.json({
            totalUsers: userRow ? userRow.totalUsers : 0,
            totalQuestions: questionRow ? questionRow.totalQuestions : 0,
            totalTests: resultRow ? resultRow.totalTests : 0,
            averageScore: avgRow && avgRow.avg ? parseFloat(avgRow.avg).toFixed(2) : 0
          });
        });
      });
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Admin login: admin@interviewapp.com / admin123`);
});
