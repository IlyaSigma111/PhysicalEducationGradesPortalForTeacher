// Firebase конфигурация
const firebaseConfig = {
    apiKey: "AIzaSyDOqQAudgBe8OaIeeuf8DEKTk1z-9zhhcE",
    authDomain: "physicalgrades.firebaseapp.com",
    projectId: "physicalgrades",
    storageBucket: "physicalgrades.firebasestorage.app",
    messagingSenderId: "344942161111",
    appId: "1:344942161111:web:0a48aa6810552be8d6d492",
    measurementId: "G-LKZQC3LP0T"
};

// Инициализация Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// DOM элементы
const elements = {
    totalTests: document.getElementById('total-tests'),
    averageScore: document.getElementById('average-score'),
    bestScore: document.getElementById('best-score'),
    bestStudent: document.getElementById('best-student'),
    todayTests: document.getElementById('today-tests'),
    classFilter: document.getElementById('class-filter'),
    dateFilter: document.getElementById('date-filter'),
    sortBy: document.getElementById('sort-by'),
    refreshBtn: document.getElementById('refresh-btn'),
    exportBtn: document.getElementById('export-btn'),
    resultsList: document.getElementById('results-list')
};

// Состояние
let state = {
    results: [],
    filteredResults: [],
    filters: {
        class: '',
        date: ''
    },
    sortBy: 'timestamp'
};

// Инициализация
function init() {
    // Загрузить результаты
    loadResults();
    
    // Обработчики событий
    elements.classFilter.addEventListener('change', updateFilters);
    elements.dateFilter.addEventListener('change', updateFilters);
    elements.sortBy.addEventListener('change', updateSorting);
    elements.refreshBtn.addEventListener('click', loadResults);
    elements.exportBtn.addEventListener('click', exportResults);
    
    // Автоматическое обновление каждые 30 секунд
    setInterval(loadResults, 30000);
}

// Загрузить результаты
async function loadResults() {
    try {
        showLoading();
        
        const snapshot = await db.collection('testResults')
            .orderBy('timestamp', 'desc')
            .limit(100)
            .get();
        
        state.results = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            state.results.push({
                id: doc.id,
                ...data
            });
        });
        
        updateStatistics();
        applyFiltersAndSort();
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        showError('Ошибка загрузки результатов');
    }
}

// Показать загрузку
function showLoading() {
    elements.resultsList.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner"></i>
            <p>Загрузка результатов...</p>
        </div>
    `;
}

// Показать ошибку
function showError(message) {
    elements.resultsList.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-triangle"></i>
            <p>${message}</p>
        </div>
    `;
}

// Обновить статистику
function updateStatistics() {
    if (state.results.length === 0) {
        elements.totalTests.textContent = '0';
        elements.averageScore.textContent = '0%';
        elements.bestScore.textContent = '0%';
        elements.bestStudent.textContent = '-';
        elements.todayTests.textContent = '0';
        return;
    }
    
    // Общее количество тестов
    elements.totalTests.textContent = state.results.length;
    
    // Средний балл
    const totalPercentage = state.results.reduce((sum, r) => sum + (r.percentage || 0), 0);
    const average = Math.round(totalPercentage / state.results.length);
    elements.averageScore.textContent = `${average}%`;
    
    // Лучший результат
    const bestResult = state.results.reduce((best, r) => 
        (r.percentage || 0) > (best.percentage || 0) ? r : best
    );
    elements.bestScore.textContent = `${bestResult.percentage || 0}%`;
    elements.bestStudent.textContent = `${bestResult.studentName}, ${bestResult.studentClass} класс`;
    
    // Тесты за сегодня
    const today = new Date().toDateString();
    const todayResults = state.results.filter(r => {
        const resultDate = r.timestamp ? r.timestamp.toDate().toDateString() : today;
        return resultDate === today;
    });
    elements.todayTests.textContent = todayResults.length;
}

// Обновить фильтры
function updateFilters() {
    state.filters.class = elements.classFilter.value;
    state.filters.date = elements.dateFilter.value;
    applyFiltersAndSort();
}

// Обновить сортировку
function updateSorting() {
    state.sortBy = elements.sortBy.value;
    applyFiltersAndSort();
}

// Применить фильтры и сортировку
function applyFiltersAndSort() {
    let filtered = [...state.results];
    
    // Фильтр по классу
    if (state.filters.class) {
        filtered = filtered.filter(r => r.studentClass === state.filters.class);
    }
    
    // Фильтр по дате
    if (state.filters.date) {
        const filterDate = new Date(state.filters.date).toDateString();
        filtered = filtered.filter(r => {
            const resultDate = r.timestamp ? r.timestamp.toDate().toDateString() : '';
            return resultDate === filterDate;
        });
    }
    
    // Сортировка
    filtered.sort((a, b) => {
        if (state.sortBy === 'percentage') {
            return (b.percentage || 0) - (a.percentage || 0);
        } else if (state.sortBy === 'studentName') {
            return a.studentName.localeCompare(b.studentName);
        } else {
            // По дате (новые сверху)
            const timeA = a.timestamp ? a.timestamp.toDate().getTime() : 0;
            const timeB = b.timestamp ? b.timestamp.toDate().getTime() : 0;
            return timeB - timeA;
        }
    });
    
    state.filteredResults = filtered;
    renderResults();
}

// Отобразить результаты
function renderResults() {
    if (state.filteredResults.length === 0) {
        elements.resultsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>Нет результатов по выбранным фильтрам</p>
            </div>
        `;
        return;
    }
    
    elements.resultsList.innerHTML = state.filteredResults.map(result => `
        <div class="result-item">
            <div class="result-content">
                <div class="result-student">
                    ${result.studentName}
                    <div class="result-class">${result.studentClass} класс</div>
                </div>
                
                <div class="result-score">
                    <div class="score-circle">
                        <div class="score-value" style="background: conic-gradient(#6366f1 0% ${result.percentage || 0}%, #e5e7eb ${result.percentage || 0}% 100%)">
                            ${result.percentage || 0}%
                        </div>
                    </div>
                    <div class="score-text">${result.correctAnswers || 0}/${result.totalQuestions || 10}</div>
                </div>
                
                <div class="result-grade">
                    <span class="grade-badge grade-${result.grade || '3'}">
                        ${result.grade || '3'}
                    </span>
                    <div class="result-grade-text" style="margin-top: 8px; font-size: 13px; color: #666;">
                        ${result.gradeText || 'Удовлетворительно'}
                    </div>
                </div>
                
                <div class="result-details">
                    <div class="result-date">${result.date || '-'}</div>
                    <div class="result-time">${result.time || '-'}</div>
                </div>
                
                <div class="result-actions">
                    <button class="action-btn" onclick="deleteResult('${result.id}')" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Удалить результат
async function deleteResult(id) {
    if (!confirm('Удалить этот результат?')) return;
    
    try {
        await db.collection('testResults').doc(id).delete();
        loadResults(); // Перезагрузить список
    } catch (error) {
        console.error('Ошибка удаления:', error);
        alert('Ошибка при удалении');
    }
}

// Экспорт результатов
function exportResults() {
    if (state.filteredResults.length === 0) {
        alert('Нет данных для экспорта');
        return;
    }
    
    let csv = 'Фамилия Имя;Класс;Правильно;Всего;Процент;Оценка;Дата;Время\n';
    
    state.filteredResults.forEach(result => {
        csv += `${result.studentName};${result.studentClass};${result.correctAnswers || 0};${result.totalQuestions || 10};${result.percentage || 0}%;${result.grade || '3'};${result.date || '-'};${result.time || '-'}\n`;
    });
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    
    link.setAttribute('href', url);
    link.setAttribute('download', `результаты_физкультура_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Запуск при загрузке
document.addEventListener('DOMContentLoaded', init);
