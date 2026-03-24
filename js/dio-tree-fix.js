// dio-tree-fix.js - Исправление для инициализации дерева ДИО

(function() {
    console.log('🔄 Загрузка dio-tree-fix.js...');
    
    // Ждем, пока TreeManager загрузится
    function waitForTreeManager() {
        if (window.TreeManager) {
            console.log('✅ TreeManager найден, применяем исправления');
            applyFixes();
        } else {
            console.log('⏳ Ожидание TreeManager...');
            setTimeout(waitForTreeManager, 100);
        }
    }
    
    function applyFixes() {
        // Сохраняем оригинальный метод importData
        const originalImportData = TreeManager.prototype.importData;
        
        // Переопределяем метод importData
        TreeManager.prototype.importData = function(data) {
            console.log('⚡ importData (исправленная версия):', data);
            
            // Проверяем, что DOM элемент существует
            const containerElement = document.getElementById(this.containerId);
            if (!containerElement) {
                console.warn('⚠️ DOM элемент не найден, сохраняем данные');
                this._pendingData = data;
                this._waitForContainer();
                return;
            }
            
            try {
                // Вызываем оригинальный метод
                originalImportData.call(this, data);
                console.log('✅ Данные успешно импортированы');
                this._pendingData = null;
            } catch (e) {
                console.error('❌ Ошибка при импорте:', e);
                
                // Если ошибка, пробуем позже
                this._pendingData = data;
                this._waitForContainer();
            }
        };
        
        // Добавляем метод ожидания контейнера
        TreeManager.prototype._waitForContainer = function() {
            if (this._waiting) return;
            this._waiting = true;
            
            console.log('⏳ Ожидание готовности DOM элемента...');
            
            let attempts = 0;
            const maxAttempts = 30; // 3 секунды (30 * 100ms)
            
            const checkInterval = setInterval(() => {
                attempts++;
                const containerElement = document.getElementById(this.containerId);
                
                if (containerElement && containerElement.children && containerElement.children.length >= 0) {
                    clearInterval(checkInterval);
                    console.log('✅ DOM элемент готов, загружаем сохранённые данные (попытка', attempts, ')');
                    
                    if (this._pendingData) {
                        // Небольшая задержка для полной готовности
                        setTimeout(() => {
                            try {
                                originalImportData.call(this, this._pendingData);
                                console.log('✅ Данные загружены после ожидания');
                                this._pendingData = null;
                            } catch (e) {
                                console.error('❌ Ошибка при загрузке после ожидания:', e);
                            }
                        }, 100);
                    }
                    
                    this._waiting = false;
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    console.error('❌ Таймаут ожидания DOM элемента после', maxAttempts, 'попыток');
                    
                    // Последняя попытка принудительно
                    if (this._pendingData) {
                        console.log('🔄 Принудительная загрузка данных...');
                        try {
                            originalImportData.call(this, this._pendingData);
                            console.log('✅ Данные загружены принудительно');
                            this._pendingData = null;
                        } catch (e) {
                            console.error('❌ Принудительная загрузка не удалась:', e);
                        }
                    }
                    
                    this._waiting = false;
                }
            }, 100);
        };
        
        // Добавляем метод для принудительной загрузки
        TreeManager.prototype.loadPendingData = function() {
            if (this._pendingData) {
                console.log('📦 Принудительная загрузка ожидающих данных');
                const containerElement = document.getElementById(this.containerId);
                if (containerElement) {
                    try {
                        originalImportData.call(this, this._pendingData);
                        console.log('✅ Данные загружены принудительно');
                        this._pendingData = null;
                        return true;
                    } catch (e) {
                        console.error('❌ Ошибка принудительной загрузки:', e);
                    }
                } else {
                    console.warn('⚠️ DOM элемент не найден для принудительной загрузки');
                }
            }
            return false;
        };
        
        // Создаем глобальную функцию для инициализации дерева
        window.initDIOTree = function() {
            console.log('🚀 Инициализация дерева ДИО...');
            
            const container = document.getElementById('dioTreeTabContent');
            if (!container) {
                console.error('❌ Контейнер dioTreeTabContent не найден');
                return null;
            }
            
            // Очищаем контейнер
            container.innerHTML = '';
            
            // Создаем элемент для дерева
            const treeElement = document.createElement('div');
            treeElement.id = 'dio-tree-container';
            treeElement.style.width = '100%';
            treeElement.style.height = '700px';
            treeElement.style.minHeight = '600px';
            treeElement.style.backgroundColor = '#f9fafb';
            treeElement.style.borderRadius = '0.5rem';
            treeElement.style.padding = '1rem';
            container.appendChild(treeElement);
            
            // Даем время на создание DOM элемента
            setTimeout(() => {
                try {
                    // Создаем экземпляр TreeManager
                    const tree = new TreeManager('dio-tree-container');
                    window.dioTreeApp = tree;
                    
                    console.log('✅ Экземпляр TreeManager создан');
                    
                    // Создаем корневой узел
                    setTimeout(() => {
                        // Проверяем, есть ли данные в localStorage
                        const allData = localStorage.getItem('gko_all_data');
                        let hasData = false;
                        
                        if (allData) {
                            try {
                                const parsed = JSON.parse(allData);
                                if (parsed.tree) {
                                    console.log('📦 Загружаем данные из gko_all_data');
                                    tree.importData(parsed.tree);
                                    hasData = true;
                                }
                            } catch (e) {
                                console.error('Ошибка парсинга gko_all_data:', e);
                            }
                        }
                        
                        if (!hasData) {
                            console.log('🌳 Создаем корневой узел');
                            
                            // Пробуем добавить узел напрямую
                            if (tree.addNode) {
                                try {
                                    const rootId = tree.addNode('root', 'База ДИО', 400, 50);
                                    console.log('✅ Корневой узел создан через addNode, ID:', rootId);
                                } catch (e) {
                                    console.error('❌ Ошибка создания узла через addNode:', e);
                                    // Пробуем через importData
                                    tree.importData({
                                        nodes: [{
                                            id: 'root',
                                            label: 'База ДИО',
                                            type: 'root',
                                            x: 400,
                                            y: 50
                                        }],
                                        edges: []
                                    });
                                }
                            } else {
                                // Через importData
                                tree.importData({
                                    nodes: [{
                                        id: 'root',
                                        label: 'База ДИО',
                                        type: 'root',
                                        x: 400,
                                        y: 50
                                    }],
                                    edges: []
                                });
                            }
                        }
                    }, 500);
                    
                } catch (e) {
                    console.error('❌ Критическая ошибка создания дерева:', e);
                    container.innerHTML = `
                        <div class="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
                            <p class="text-red-600 mb-2">Ошибка создания дерева</p>
                            <button onclick="window.initDIOTree()" class="px-4 py-2 bg-red-600 text-white rounded-lg">
                                Повторить
                            </button>
                        </div>
                    `;
                }
            }, 100);
            
            return window.dioTreeApp;
        };
        
        console.log('✅ Исправления TreeManager применены');
    }
    
    // Запускаем ожидание TreeManager
    waitForTreeManager();
    
    // Добавляем обработчик для переключения на вкладку ДИО
    document.addEventListener('tabChanged', function(e) {
        if (e.detail && e.detail.tab === 'dio-tree') {
            console.log('📌 Переключение на вкладку ДИО, инициализируем дерево');
            setTimeout(() => {
                if (!window.dioTreeApp) {
                    window.initDIOTree();
                } else if (window.dioTreeApp._pendingData) {
                    console.log('📦 Загружаем ожидающие данные');
                    window.dioTreeApp.loadPendingData();
                }
            }, 300);
        }
    });
    
})();

console.log('✅ dio-tree-fix.js загружен');
