// ==================== API Configuration ====================
const API_URL = 'http://localhost:3000/api';

// ==================== Auth Token Management ====================
function getToken() {
  return localStorage.getItem('token');
}

function getUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

function setAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function isLoggedIn() {
  return !!getToken();
}

function isAdmin() {
  const user = getUser();
  return user && user.role === 'admin';
}

// ==================== Utility Functions ====================
function togglePassword() {
  const passwordInput = document.getElementById('password');
  passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
}

function showRegister() {
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('registerForm').classList.remove('hidden');
}

function showLogin() {
  document.getElementById('registerForm').classList.add('hidden');
  document.getElementById('loginForm').classList.remove('hidden');
}

function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 25px;
    background: ${type === 'success' ? 'var(--success)' : 'var(--accent)'};
    color: ${type === 'success' ? 'var(--primary)' : 'white'};
    border-radius: 10px;
    font-weight: 500;
    z-index: 1000;
    animation: slideIn 0.3s ease;
  `;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

// ==================== API Helpers ====================
async function apiRequest(endpoint, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const options = {
    method,
    headers
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, options);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }
  
  return data;
}

// ==================== Login Handler ====================
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const role = document.querySelector('input[name="role"]:checked').value;
  
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Logging in...';
  
  try {
    const data = await apiRequest('/auth/login', 'POST', { email, password });
    
    if (data.user.role !== role) {
      throw new Error(`Please login as ${data.user.role} to continue`);
    }
    
    setAuth(data.token, data.user);
    showNotification('Login successful!');
    
    if (data.user.role === 'admin') {
      window.location.href = 'admin.html';
    } else {
      window.location.href = 'dashboard.html';
    }
  } catch (error) {
    showNotification(error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Login</span><span class="btn-arrow">→</span>';
  }
});

// ==================== Register Handler ====================
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Creating account...';
  
  try {
    const data = await apiRequest('/auth/register', 'POST', { name, email, password });
    setAuth(data.token, data.user);
    showNotification('Account created successfully!');
    window.location.href = 'dashboard.html';
  } catch (error) {
    showNotification(error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Create Account</span><span class="btn-arrow">→</span>';
  }
});

// ==================== Logout Handler ====================
function logout() {
  clearAuth();
  window.location.href = 'index.html';
}

// ==================== Dashboard Functions ====================
async function loadDashboard() {
  if (!isLoggedIn()) {
    window.location.href = 'index.html';
    return;
  }
  
  const user = getUser();
  document.getElementById('userName').textContent = user.name;
  document.getElementById('userEmail').textContent = user.email;
  document.getElementById('userInitial').textContent = user.name.charAt(0).toUpperCase();
  
  // Load user stats
  try {
    const results = await apiRequest(`/results/user/${user.id}`);
    const completedTests = results.length;
    const totalScore = results.reduce((sum, r) => sum + (r.score / r.total_questions * 100), 0);
    const avgScore = completedTests > 0 ? (totalScore / completedTests).toFixed(0) : 0;
    
    document.getElementById('totalTests').textContent = completedTests;
    document.getElementById('avgScore').textContent = avgScore + '%';
    document.getElementById('totalQuestions').textContent = results.reduce((sum, r) => sum + r.total_questions, 0);
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// ==================== Test Functions ====================
let currentQuestions = [];
let currentQuestionIndex = 0;
let selectedAnswers = {};
let timerInterval;
let timeLeft = 1800; // 30 minutes

async function startTest(category) {
  try {
    const questions = await apiRequest(`/questions?category=${category}&limit=10`);
    
    if (questions.length === 0) {
      showNotification('No questions available for this category', 'error');
      return;
    }
    
    currentQuestions = questions;
    currentQuestionIndex = 0;
    selectedAnswers = {};
    timeLeft = 1800;
    
    document.getElementById('categorySelect').style.display = 'none';
    document.getElementById('questionContainer').classList.add('active');
    document.getElementById('testCategory').textContent = category;
    
    startTimer();
    showQuestion();
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

function startTimer() {
  updateTimerDisplay();
  
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      submitTest();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timerValue = document.getElementById('timerValue');
  
  timerValue.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  timerValue.classList.remove('warning', 'danger');
  if (timeLeft <= 300) {
    timerValue.classList.add('danger');
  } else if (timeLeft <= 600) {
    timerValue.classList.add('warning');
  }
}

function showQuestion() {
  const question = currentQuestions[currentQuestionIndex];
  
  document.getElementById('questionNumber').textContent = `Question ${currentQuestionIndex + 1} of ${currentQuestions.length}`;
  
  const difficultyEl = document.getElementById('questionDifficulty');
  difficultyEl.textContent = question.difficulty;
  difficultyEl.className = `question-difficulty difficulty-${question.difficulty}`;
  
  document.getElementById('questionText').textContent = question.question_text;
  
  const optionsContainer = document.getElementById('optionsContainer');
  optionsContainer.innerHTML = '';
  
  // Parse options if they're stored as a string
  let options;
  if (typeof question.options === 'string') {
    options = JSON.parse(question.options);
  } else {
    options = question.options;
  }
  
  options.forEach((option, index) => {
    const optionEl = document.createElement('div');
    optionEl.className = `option-item ${selectedAnswers[currentQuestionIndex] === index ? 'selected' : ''}`;
    optionEl.innerHTML = `
      <span class="option-letter">${String.fromCharCode(65 + index)}</span>
      <span class="option-text">${option}</span>
    `;
    optionEl.onclick = () => selectOption(index);
    optionsContainer.appendChild(optionEl);
  });
  
  // Update progress bar
  const progress = ((currentQuestionIndex + 1) / currentQuestions.length) * 100;
  document.getElementById('progressBar').style.width = `${progress}%`;
  document.getElementById('progressText').textContent = `${currentQuestionIndex + 1}/${currentQuestions.length}`;
  
  // Update navigation buttons
  document.getElementById('prevBtn').style.visibility = currentQuestionIndex === 0 ? 'hidden' : 'visible';
  
  if (currentQuestionIndex === currentQuestions.length - 1) {
    document.getElementById('nextBtn').classList.add('submit-test-btn');
    document.getElementById('nextBtn').textContent = 'Submit Test';
  } else {
    document.getElementById('nextBtn').classList.remove('submit-test-btn');
    document.getElementById('nextBtn').textContent = 'Next →';
  }
}

function selectOption(index) {
  selectedAnswers[currentQuestionIndex] = index;
  showQuestion();
}

function prevQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    showQuestion();
  }
}

function nextQuestion() {
  if (currentQuestionIndex < currentQuestions.length - 1) {
    currentQuestionIndex++;
    showQuestion();
  } else {
    submitTest();
  }
}

async function submitTest() {
  clearInterval(timerInterval);
  
  let score = 0;
  currentQuestions.forEach((question, index) => {
    if (selectedAnswers[index] === question.correct_answer) {
      score++;
    }
  });
  
  const totalQuestions = currentQuestions.length;
  const category = document.getElementById('testCategory').textContent;
  const timeTaken = 1800 - timeLeft;
  
  try {
    await apiRequest('/results', 'POST', {
      score,
      totalQuestions,
      timeTaken,
      category
    });
    
    showResults(score, totalQuestions, timeTaken);
  } catch (error) {
    showNotification(error.message, 'error');
    showResults(score, totalQuestions, timeTaken);
  }
}

function showResults(score, totalQuestions, timeTaken) {
  document.getElementById('questionContainer').classList.remove('active');
  document.getElementById('resultsContainer').style.display = 'block';
  
  const percentage = Math.round((score / totalQuestions) * 100);
  document.getElementById('scorePercentage').textContent = percentage + '%';
  
  let message = '';
  let icon = '';
  
  if (percentage >= 80) {
    message = 'Excellent!';
    icon = '🏆';
  } else if (percentage >= 60) {
    message = 'Good Job!';
    icon = '🎉';
  } else if (percentage >= 40) {
    message = 'Keep Practicing!';
    icon = '💪';
  } else {
    message = 'Need Improvement';
    icon = '📚';
  }
  
  document.getElementById('resultMessage').textContent = message;
  document.getElementById('resultIcon').textContent = icon;
  
  document.getElementById('scoreCorrect').textContent = score;
  document.getElementById('scoreTotal').textContent = totalQuestions;
  
  const minutes = Math.floor(timeTaken / 60);
  const seconds = timeTaken % 60;
  document.getElementById('scoreTime').textContent = `${minutes}m ${seconds}s`;
}

function retakeTest() {
  document.getElementById('resultsContainer').style.display = 'none';
  document.getElementById('categorySelect').style.display = 'block';
  currentQuestions = [];
  selectedAnswers = {};
}

// ==================== Admin Functions ====================
async function loadAdminDashboard() {
  if (!isLoggedIn() || !isAdmin()) {
    window.location.href = 'index.html';
    return;
  }
  
  const user = getUser();
  document.getElementById('adminName').textContent = user.name;
  document.getElementById('adminEmail').textContent = user.email;
  document.getElementById('adminInitial').textContent = user.name.charAt(0).toUpperCase();
  
  loadStats();
  loadUsers();
  loadAllResults();
}

async function loadStats() {
  try {
    const stats = await apiRequest('/stats');
    document.getElementById('statUsers').textContent = stats.totalUsers;
    document.getElementById('statQuestions').textContent = stats.totalQuestions;
    document.getElementById('statTests').textContent = stats.totalTests;
    document.getElementById('statAvgScore').textContent = stats.averageScore + '%';
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

async function loadUsers() {
  try {
    const users = await apiRequest('/users');
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    
    users.forEach(user => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>#${user.id}</td>
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td><span class="status-badge ${user.role}">${user.role}</span></td>
        <td>${new Date(user.created_at).toLocaleDateString()}</td>
        <td>
          <div class="action-btns">
            <button class="action-btn delete" onclick="deleteUser(${user.id})" title="Delete">🗑️</button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

async function loadAllResults() {
  try {
    const results = await apiRequest('/results/all');
    const tbody = document.getElementById('resultsTableBody');
    tbody.innerHTML = '';
    
    results.forEach(result => {
      const percentage = Math.round((result.score / result.total_questions) * 100);
      let scoreClass = 'low';
      if (percentage >= 80) scoreClass = 'high';
      else if (percentage >= 60) scoreClass = 'medium';
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>#${result.id}</td>
        <td>${result.name}</td>
        <td>${result.email}</td>
        <td>${result.category}</td>
        <td class="score-cell ${scoreClass}">${result.score}/${result.total_questions} (${percentage}%)</td>
        <td>${new Date(result.created_at).toLocaleDateString()}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading results:', error);
  }
}

async function deleteUser(userId) {
  if (!confirm('Are you sure you want to delete this user?')) return;
  
  try {
    await apiRequest(`/users/${userId}`, 'DELETE');
    showNotification('User deleted successfully');
    loadUsers();
    loadStats();
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

function showGeneratorModal() {
  document.getElementById('generatorModal').classList.add('active');
}

function hideGeneratorModal() {
  document.getElementById('generatorModal').classList.remove('active');
}

async function generateQuestions() {
  const category = document.getElementById('genCategory').value;
  const count = parseInt(document.getElementById('genCount').value);
  const difficulty = document.getElementById('genDifficulty').value;
  
  const btn = document.querySelector('.generate-btn');
  btn.disabled = true;
  btn.textContent = 'Generating...';
  
  try {
    const result = await apiRequest('/questions/generate-ai', 'POST', {
      category,
      count,
      difficulty
    });
    
    showNotification(`${result.questions.length} questions generated successfully!`);
    hideGeneratorModal();
    loadStats();
  } catch (error) {
    showNotification(error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Questions';
  }
}

// ==================== Initialize ====================
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  
  if (path.includes('dashboard.html')) {
    loadDashboard();
  } else if (path.includes('admin.html')) {
    loadAdminDashboard();
  } else if (path.includes('test.html')) {
    // Test page initialization
  }
});
