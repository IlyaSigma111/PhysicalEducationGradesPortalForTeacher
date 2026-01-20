// Firebase конфигурация (ДОЛЖНА БЫТЬ ОДИНАКОВОЙ!)
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
let app, db;
try {
    app = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log('✅ Firebase инициализирован успешно');
} catch (error) {
    console.error('❌ Ошибка инициализации Firebase:', error);
    showCriticalError('Ошибка подключения к базе данных. Пожалуйста, обновите страницу.');
}

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
    resultsList: document.getElementById('results-list'),
    statsGrid: document.querySelector('.stats-grid')
};

// Состояние
let state = {
    results: [],
    filteredResults: [],
    filters: {
        class: '',
        date: ''
    },
    sortBy: 'timestamp',
    isConnected: false,
    lastUpdate: null
};

// Инициализация
async function init() {
    console.log('👨‍🏫 Инициализация панели учителя...');
    
    // Проверка подключения
    await checkConnection();
    
    // Настройка фильтров
    setupFilters();
    
    // Загрузить результаты
    await loadResults();
    
    // Обработчики событий
    setupEventListeners();
    
    // Автоматическое обновление
    startAutoRefresh();
    
    console.log('✅ Панель учителя инициализирована');
}

// Проверка подключения
async function checkConnection() {
    if (!db) {
        console.error('❌ Firebase не инициализирован');
        showCriticalError('Firebase не инициализирован. Проверьте конфигурацию.');
        return false;
    }
    
    try {
        console.log('🔌 Проверка подключения к Firestore...');
        
        // Быстрая проверка
        const testQuery = await db.collection('testResults').limit(1).get();
        
        state.isConnected = true;
        console.log('✅ Подключение установлено. Документов в коллекции:', testQuery.size);
        
        // Показать статус подключения
        showConnectionStatus(true);
        return true;
        
    } catch (error) {
        console.error('❌ Ошибка подключения к Firestore:', error);
        console.error('Код ошибки:', error.code);
        console.error('Сообщение:', error.message);
        
        state.isConnected = false;
        showConnectionStatus(false);
        
        showError(`Ошибка подключения: ${error.code || 'Неизвестная ошибка'}`);
        return false;
    }
}

// Показать статус подключения
function showConnectionStatus(isConnected) {
    // Удаляем старый статус, если есть
    const oldStatus = document.getElementById('connection-status');
    if (oldStatus) oldStatus.remove();
    
    const statusDiv = document.createElement('div');
    statusDiv.id = 'connection-status';
    
    if (isConnected) {
        statusDiv.innerHTML = `
            <div style="
                background: rgba(16, 185, 129, 0.1);
                border: 2px solid #10b981;
                border-radius: 12px;
                padding: 10px 15px;
                margin-bottom: 20px;
                color: #10b981;
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 14px;
                animation: fadeIn 0.5s ease;
            ">
                <i class="fas fa-wifi" style="font-size: 16px;"></i>
                <span>✅ Подключено к серверу</span>
                <small style="margin-left: auto; opacity: 0.7;">
                    ${new Date().toLocaleTimeString('ru-RU')}
                </small>
            </div>
        `;
    } else {
        statusDiv.innerHTML = `
            <div style="
                background: rgba(239, 68, 68, 0.1);
                border: 2px solid #ef4444;
                border-radius: 12px;
                padding: 10px 15px;
                margin-bottom: 20px;
                color: #ef4444;
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 14px;
                animation: fadeIn 0.5s ease;
            ">
                <i class="fas fa-exclamation-triangle" style="font-size: 16px;"></i>
                <span>❌ Нет подключения к серверу</span>
                <button onclick="checkConnection()" style="
                    margin-left: auto;
                    background: #ef4444;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    padding: 5px 10px;
                    font-size: 12px;
                    cursor: pointer;
                ">
                    Повторить
                </button>
            </div>
        `;
    }
    
    // Вставляем в контейнер
    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(statusDiv, container.firstChild);
    }
}

// Настройка фильтров
function setupFilters() {
    // Установить сегодняшнюю дату по умолчанию
    const today = new Date().toISOString().split('T')[0];
    elements.dateFilter.value = today;
    state.filters.date = today;
}

// Настройка обработчиков событий
function setupEventListeners() {
    elements.classFilter.addEventListener('change', () => {
        state.filters.class = elements.classFilter.value;
        applyFiltersAndSort();
    });
    
    elements.dateFilter.addEventListener('change', () => {
        state.filters.date = elements.dateFilter.value;
        applyFiltersAndSort();
    });
    
    elements.sortBy.addEventListener('change', () => {
        state.sortBy = elements.sortBy.value;
        applyFiltersAndSort();
    });
    
    elements.refreshBtn.addEventListener('click', async () => {
        elements.refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Обновление...';
        elements.refreshBtn.disabled = true;
        
        await loadResults();
        
        elements.refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Обновить';
        elements.refreshBtn.disabled = false;
    });
    
    elements.exportBtn.addEventListener('click', exportResults);
}

// Запустить автоматическое обновление
function startAutoRefresh() {
    // Обновлять каждые 10 секунд
    setInterval(async () => {
        if (state.isConnected && document.visibilityState === 'visible') {
            console.log('🔄 Автоматическое обновление...');
            await loadResults();
        }
    }, 10000);
}

// Загрузить результаты
async function loadResults() {
    console.log('📥 Загрузка результатов...');
    
    if (!state.isConnected) {
        console.warn('⚠️ Пропускаем загрузку - нет подключения');
        showError('Нет подключения к серверу. Проверьте интернет.');
        return;
    }
    
    try {
        showLoading();
        
        // Получаем данные с тайм-аутом
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Таймаут загрузки')), 10000)
        );
        
        const queryPromise = db.collection('testResults')
            .orderBy('timestamp', 'desc')
            .limit(200)
            .get();
        
        const snapshot = await Promise.race([queryPromise, timeoutPromise]);
        
        console.log('✅ Данные получены. Документов:', snapshot.size);
        
        state.results = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            state.results.push({
                id: doc.id,
                ...data,
                // Нормализуем timestamp
                _timestamp: data.timestamp ? 
                    (data.timestamp.toDate ? data.timestamp.toDate().getTime() : 
                     new Date(data.timestamp).getTime()) : 
                    Date.now()
            });
        });
        
        state.lastUpdate = new Date();
        updateStatistics();
        applyFiltersAndSort();
        
        console.log(`✅ Загружено ${state.results.length} результатов`);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки результатов:', error);
        
        let errorMessage = 'Ошибка загрузки данных';
        if (error.code === 'permission-denied') {
            errorMessage = 'Нет доступа к базе данных. Проверьте правила Firestore.';
        } else if (error.message === 'Таймаут загрузки') {
            errorMessage = 'Слишком долгая загрузка. Проверьте подключение.';
        } else if (error.code === 'failed-precondition') {
            errorMessage = 'Требуется индекс. Проверьте консоль Firebase.';
        }
        
        showError(errorMessage);
    }
}

// Показать загрузку
function showLoading() {
    elements.resultsList.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Загрузка результатов...</p>
        </div>
    `;
}

// Показать ошибку
function showError(message) {
    elements.resultsList.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-triangle"></i>
            <p style="color: #ef4444; font-weight: 600;">${message}</p>
            <p style="font-size: 14px; margin-top: 10px; color: #888;">
                Проверьте:<br>
                1. Подключение к интернету<br>
                2. Блокировщики рекламы<br>
                3. Консоль браузера (F12)
            </p>
            <button onclick="loadResults()" class="btn" style="margin-top: 20px;">
                <i class="fas fa-redo"></i>
                Попробовать снова
            </button>
        </div>
    `;
}

// Показать критическую ошибку
function showCriticalError(message) {
    document.body.innerHTML = `
        <div style="
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            padding: 20px;
            text-align: center;
        ">
            <div style="
                background: white;
                border-radius: 20px;
                padding: 40px;
                max-width: 500px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
            ">
                <div style="
                    width: 80px;
                    height: 80px;
                    background: #ef4444;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 20px;
                    color: white;
                    font-size: 36px;
                ">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h2 style="color: #1f2937; margin-bottom: 15px;">Критическая ошибка</h2>
                <p style="color: #6b7280; margin-bottom: 25px;">${message}</p>
                <button onclick="location.reload()" style="
                    background: #6366f1;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 12px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    margin: 0 auto;
                ">
                    <i class="fas fa-redo"></i>
                    Обновить страницу
                </button>
            </div>
        </div>
    `;
}

// Обновить статистику
function updateStatistics() {
    console.log('📊 Обновление статистики...');
    
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
    let bestPercentage = 0;
    let bestStudent = { studentName: '', studentClass: '' };
    
    state.results.forEach(r => {
        const percentage = r.percentage || 0;
        if (percentage > bestPercentage) {
            bestPercentage = percentage;
            bestStudent = {
                studentName: r.studentName || 'Неизвестно',
                studentClass: r.studentClass || '?'
            };
        }
    });
    
    elements.bestScore.textContent = `${bestPercentage}%`;
    elements.bestStudent.textContent = `${bestStudent.studentName}, ${bestStudent.studentClass} класс`;
    
    // Тесты за сегодня
    const today = new Date().toDateString();
    const todayResults = state.results.filter(r => {
        const resultDate = r.timestamp ? 
            (r.timestamp.toDate ? r.timestamp.toDate().toDateString() : 
             new Date(r.timestamp).toDateString()) : 
            today;
        return resultDate === today;
    });
    
    elements.todayTests.textContent = todayResults.length;
    
    console.log('✅ Статистика обновлена');
}

// Применить фильтры и сортировку
function applyFiltersAndSort() {
    console.log('🔍 Применение фильтров...');
    
    let filtered = [...state.results];
    
    // Фильтр по классу
    if (state.filters.class) {
        filtered = filtered.filter(r => r.studentClass === state.filters.class);
    }
    
    // Фильтр по дате
    if (state.filters.date) {
        const filterDate = new Date(state.filters.date).toDateString();
        filtered = filtered.filter(r => {
            const resultDate = r.timestamp ? 
                (r.timestamp.toDate ? r.timestamp.toDate().toDateString() : 
                 new Date(r.timestamp).toDateString()) : 
                new Date().toDateString();
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
            return (b._timestamp || 0) - (a._timestamp || 0);
        }
    });
    
    state.filteredResults = filtered;
    renderResults();
}

// Отобразить результаты
function renderResults() {
    console.log('🎨 Отображение результатов:', state.filteredResults.length);
    
    if (state.filteredResults.length === 0) {
        elements.resultsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>Нет результатов по выбранным фильтрам</p>
                <p style="font-size: 14px; margin-top: 10px; color: #888;">
                    Всего результатов в базе: ${state.results.length}<br>
                    Последнее обновление: ${state.lastUpdate ? state.lastUpdate.toLocaleTimeString('ru-RU') : 'никогда'}
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
        
        // Определяем цвет оценки
        const gradeColor = grade === '5' ? '#10b981' : 
                          grade === '4' ? '#3b82f6' : 
                          grade === '3' ? '#f59e0b' : '#ef4444';
        
        return `
        <div class="result-item" style="animation-delay: ${index * 0.05}s">
            <div class="result-content">
                <div class="result-student">
                    <strong>${studentName}</strong>
                    <div class="result-class">${studentClass} класс</div>
                    <small style="color: #888; font-size: 12px; margin-top: 4px;">
                        ID: ${result.id.substring(0, 8)}...
                    </small>
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
                    <span class="grade-badge" style="background: ${gradeColor}">
                        ${grade}
                    </span>
                    <div class="result-grade-text" style="margin-top: 8px; font-size: 13px; color: #666;">
                        ${gradeText}
                    </div>
                </div>
                
                <div class="result-details">
                    <div class="result-date">${date}</div>
                    <div class="result-time">${time}</div>
                    ${result.timestamp && result.timestamp.toDate ? 
                        `<small style="color: #999;">${result.timestamp.toDate().toLocaleTimeString('ru-RU')}</small>` : 
                        ''}
                </div>
                
                <div class="result-actions">
                    <button class="action-btn" onclick="viewDetails('${result.id}')" title="Подробнее">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn" onclick="deleteResult('${result.id}')" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');
    
    console.log('✅ Результаты отображены');
}

// Просмотр деталей
async function viewDetails(id) {
    try {
        const doc = await db.collection('testResults').doc(id).get();
        if (doc.exists) {
            const data = doc.data();
            alert(`
Детальная информация:
────────────────────
Ученик: ${data.studentName || 'Неизвестно'}
Класс: ${data.studentClass || '?'}
Результат: ${data.correctAnswers || 0}/${data.totalQuestions || 10}
Процент: ${data.percentage || 0}%
Оценка: ${data.grade || '3'} (${data.gradeText || ''})
Дата: ${data.date || '-'}
Время: ${data.time || '-'}
ID теста: ${data.testId || 'нет'}
            `.trim());
        }
    } catch (error) {
        console.error('Ошибка загрузки деталей:', error);
        alert('Ошибка загрузки деталей');
    }
}

// Удалить результат
async function deleteResult(id) {
    if (!confirm('Удалить этот результат?')) return;
    
    try {
        await db.collection('testResults').doc(id).delete();
        console.log('🗑️ Результат удален:', id);
        
        // Удаляем из локального состояния
        state.results = state.results.filter(r => r.id !== id);
        updateStatistics();
        applyFiltersAndSort();
        
        alert('✅ Результат удален');
    } catch (error) {
        console.error('❌ Ошибка удаления:', error);
        alert('Ошибка при удалении: ' + error.message);
    }
}

// Экспорт результатов
function exportResults() {
    if (state.filteredResults.length === 0) {
        alert('Нет данных для экспорта');
        return;
    }
    
    let csv = 'ID;Фамилия Имя;Класс;Правильно;Всего;Процент;Оценка;Оценка текст;Дата;Время;ID теста\n';
    
    state.filteredResults.forEach(result => {
        csv += `${result.id.substring(0, 8)};${result.studentName || ''};${result.studentClass || ''};${result.correctAnswers || 0};${result.totalQuestions || 10};${result.percentage || 0}%;${result.grade || '3'};${result.gradeText || ''};${result.date || '-'};${result.time || '-'};${result.testId || ''}\n`;
    });
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    
    link.setAttribute('href', url);
    link.setAttribute('download', `результаты_физкультура_${dateStr}_${state.filteredResults.length}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('📤 Экспортировано:', state.filteredResults.length, 'записей');
}

// Глобальные функции для отладки
window.debugTeacher = function() {
    console.log('🔍 Отладка панели учителя:');
    console.log('- Firebase app:', app);
    console.log('- Firestore db:', db);
    console.log('- Состояние:', state);
    console.log('- Всего результатов:', state.results.length);
    console.log('- Отфильтровано:', state.filteredResults.length);
    console.log('- Последнее обновление:', state.lastUpdate);
    
    if (state.results.length > 0) {
        console.log('- Первый результат:', state.results[0]);
    }
};

window.forceRefresh = async function() {
    console.log('🔄 Принудительное обновление...');
    await loadResults();
};

// Запуск при загрузке
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM загружен, запускаю панель учителя...');
    init();
});
