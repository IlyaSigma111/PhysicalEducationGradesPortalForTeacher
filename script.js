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
    
    // Автоматическое обновление
    setInterval(loadResults, 5000); // Каждые 5 секунд
}

// Загрузить результаты
async function loadResults() {
    try {
        showLoading();
        
        console.log('Загрузка данных из Firebase...');
        
        const snapshot = await db.collection('testResults')
            .orderBy('timestamp', 'desc')
            .limit(100)
            .get();
        
        console.log('Получено документов:', snapshot.size);
        
        state.results = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log('Документ:', data);
            state.results.push({
                id: doc.id,
                ...data
            });
        });
        
        console.log('Всего результатов:', state.results.length);
        
        updateStatistics();
        applyFiltersAndSort();
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        showError('Ошибка загрузки результатов. Проверьте подключение к Firebase.');
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
            <button onclick="loadResults()" class="btn" style="margin-top: 20px;">
                <i class="fas fa-redo"></i>
                Попробовать снова
            </button>
        </div>
    `;
}

// Обновить статистику
function updateStatistics() {
    console.log('Обновление статистики...');
    
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
        (r.percentage || 0) > (best.percentage || 0) ? r : best, 
        {percentage: 0, studentName: '', studentClass: ''}
    );
    elements.bestScore.textContent = `${bestResult.percentage || 0}%`;
    elements.bestStudent.textContent = `${bestResult.studentName || 'Неизвестно'}, ${bestResult.studentClass || '?'} класс`;
    
    // Тесты за сегодня
    const today = new Date().toDateString();
    const todayResults = state.results.filter(r => {
        let resultDate;
        if (r.timestamp && r.timestamp.toDate) {
            resultDate = r.timestamp.toDate().toDateString();
        } else if (r.date) {
            resultDate = new Date(r.date).toDateString();
        } else {
            resultDate = today;
        }
        return resultDate === today;
    });
    elements.todayTests.textContent = todayResults.length;
    
    console.log('Статистика обновлена');
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
    console.log('Применение фильтров...');
    
    let filtered = [...state.results];
    
    // Фильтр по классу
    if (state.filters.class) {
        filtered = filtered.filter(r => r.studentClass === state.filters.class);
    }
    
    // Фильтр по дате
    if (state.filters.date) {
        const filterDate = new Date(state.filters.date).toDateString();
        filtered = filtered.filter(r => {
            let resultDate;
            if (r.timestamp && r.timestamp.toDate) {
                resultDate = r.timestamp.toDate().toDateString();
            } else if (r.date) {
                resultDate = new Date(r.date).toDateString();
            } else {
                return false;
            }
            return resultDate === filterDate;
        });
    }
    
    // Сортировка
    filtered.sort((a, b) => {
        if (state.sortBy === 'percentage') {
            return (b.percentage || 0) - (a.percentage || 0);
        } else if (state.sortBy === 'studentName') {
            return (a.studentName || '').localeCompare(b.studentName || '');
        } else {
            // По дате (новые сверху)
            let timeA = 0;
            let timeB = 0;
            
            if (a.timestamp && a.timestamp.toDate) {
                timeA = a.timestamp.toDate().getTime();
            } else if (a.date) {
                timeA = new Date(a.date).getTime();
            }
            
            if (b.timestamp && b.timestamp.toDate) {
                timeB = b.timestamp.toDate().getTime();
            } else if (b.date) {
                timeB = new Date(b.date).getTime();
            }
            
            return timeB - timeA;
        }
    });
    
    state.filteredResults = filtered;
    renderResults();
}

// Отобразить результаты
function renderResults() {
    console.log('Отображение результатов:', state.filteredResults.length);
    
    if (state.filteredResults.length === 0) {
        elements.resultsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>Нет результатов по выбранным фильтрам</p>
                <p style="font-size: 14px; margin-top: 10px; color: #888;">
                    Всего результатов в базе: ${state.results.length}
                </p>
            </div>
        `;
        return;
    }
    
    elements.resultsList.innerHTML = state.filteredResults.map((result, index) => {
        // Безопасное получение данных
        const studentName = result.studentName || 'Неизвестно';
        const studentClass = result.studentClass || '?';
        const percentage = result.percentage || 0;
        const correctAnswers = result.correctAnswers || 0;
        const totalQuestions = result.totalQuestions || 10;
        const grade = result.grade || '3';
        const gradeText = result.gradeText || 'Удовлетворительно';
        const date = result.date || '-';
        const time = result.time || '-';
        
        return `
        <div class="result-item" style="animation-delay: ${index * 0.05}s">
            <div class="result-content">
                <div class="result-student">
                    ${studentName}
                    <div class="result-class">${studentClass} класс</div>
                </div>
                
                <div class="result-score">
                    <div class="score-circle">
                        <div class="score-value" style="background: conic-gradient(#6366f1 0% ${percentage}%, #e5e7eb ${percentage}% 100%)">
                            ${percentage}%
                        </div>
                    </div>
                    <div class="score-text">${correctAnswers}/${totalQuestions}</div>
                </div>
                
                <div class="result-grade">
                    <span class="grade-badge grade-${grade}">
                        ${grade}
                    </span>
                    <div class="result-grade-text" style="margin-top: 8px; font-size: 13px; color: #666;">
                        ${gradeText}
                    </div>
                </div>
                
                <div class="result-details">
                    <div class="result-date">${date}</div>
                    <div class="result-time">${time}</div>
                </div>
                
                <div class="result-actions">
                    <button class="action-btn" onclick="deleteResult('${result.id}')" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

// Удалить результат
async function deleteResult(id) {
    if (!confirm('Удалить этот результат?')) return;
    
    try {
        await db.collection('testResults').doc(id).delete();
        alert('Результат удален');
        loadResults(); // Перезагрузить список
    } catch (error) {
        console.error('Ошибка удаления:', error);
        alert('Ошибка при удалении: ' + error.message);
    }
}

// Экспорт результатов
function exportResults() {
    if (state.filteredResults.length === 0) {
        alert('Нет данных для экспорта');
        return;
    }
    
    let csv = 'Фамилия Имя;Класс;Правильно;Всего;Процент;Оценка;Оценка текст;Дата;Время\n';
    
    state.filteredResults.forEach(result => {
        csv += `${result.studentName || ''};${result.studentClass || ''};${result.correctAnswers || 0};${result.totalQuestions || 10};${result.percentage || 0}%;${result.grade || '3'};${result.gradeText || ''};${result.date || '-'};${result.time || '-'}\n`;
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
