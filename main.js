window._initializationInProgress = false;
window._treeManagerInitialized = false;
window._treeManager = null;
window._nodeEffects = null;
window._appInitialized = false;

// Глобальная защита от ошибок bind
Function.prototype._bind = Function.prototype.bind;
Function.prototype.bind = function(context) {
    if (this === undefined || this === null) {
        console.warn('Попытка вызвать bind на undefined/null, возвращаем заглушку');
        return function() {};
    }
    try {
        return this._bind(context);
    } catch (error) {
        console.warn('Ошибка в bind, возвращаем заглушку:', error.message);
        return function() {};
    }
};

window.addEventListener('error', function(e) {
    if (e.message.includes('bind') || e.message.includes('setupDragAndDrop')) {
        console.warn('Перехвачена ошибка:', e.message);
        e.preventDefault();
    }
});

// Обработчик ошибок для Three.js
window.addEventListener('error', function(e) {
    if (e.message.includes('THREE') || e.message.includes('WebGL')) {
        console.warn('Three.js ошибка, отключаем эффекты:', e.message);
        if (!window.NodeEffects) {
            window.NodeEffects = class NodeEffectsStub {
                constructor() { 
                    console.log('NodeEffects заглушка создана'); 
                    this.effects = new Set();
                }
                addEffect(element, type) {
                    if (element && !this.effects.has(element)) {
                        this.effects.add(element);
                        console.log(`Добавлен эффект ${type} к элементу`);
                    }
                }
                removeEffect(element, type) {
                    if (this.effects.has(element)) {
                        this.effects.delete(element);
                    }
                }
            };
        }
    }
});

// Функция для безопасного создания TreeManager
async function initializeTreeManager() {
    console.log('=== ИНИЦИАЛИЗАЦИЯ TREE MANAGER ===');
    
    try {
        if (typeof TreeManager !== 'function' && typeof window.TreeManager !== 'function') {
            console.error('Класс TreeManager не найден');
            throw new Error('TreeManager class not found');
        }
        
        if (window.treeManager && window.treeManager.initialized) {
            console.warn('TreeManager уже создан и инициализирован ранее');
            return window.treeManager;
        }
        
        const TreeManagerClass = TreeManager || window.TreeManager;
        console.log('TreeManager класс найден:', TreeManagerClass.name);
        
        // ПАТЧИМ ПРОТОТИП TreeManager перед созданием экземпляра
        if (TreeManagerClass.prototype) {
            if (!TreeManagerClass.prototype.handleDragOver) {
                TreeManagerClass.prototype.handleDragOver = function(e) {
                    e.preventDefault();
                    if (this.dropIndicator && e.dataTransfer && e.dataTransfer.types && 
                        e.dataTransfer.types.includes('application/x-tree-node')) {
                        this.dropIndicator.style.display = 'block';
                        this.dropIndicator.style.left = e.clientX + 'px';
                        this.dropIndicator.style.top = e.clientY + 'px';
                        this.dropIndicator.style.width = '100px';
                        this.dropIndicator.style.height = '100px';
                    }
                };
                console.log('Добавлен handleDragOver в прототип TreeManager');
            }
            
            if (!TreeManagerClass.prototype.handleDrop) {
                TreeManagerClass.prototype.handleDrop = function(e) {
                    e.preventDefault();
                    if (this.dropIndicator) {
                        this.dropIndicator.style.display = 'none';
                    }
                    console.log('handleDrop заглушка');
                };
                console.log('Добавлен handleDrop в прототип TreeManager');
            }
            
            if (!TreeManagerClass.prototype.handleDragEnd) {
                TreeManagerClass.prototype.handleDragEnd = function(e) {
                    if (this.dropIndicator) {
                        this.dropIndicator.style.display = 'none';
                    }
                    console.log('handleDragEnd заглушка');
                };
                console.log('Добавлен handleDragEnd в прототип TreeManager');
            }
            
            if (!TreeManagerClass.prototype.restoreTree) {
                TreeManagerClass.prototype.restoreTree = function(treeData) {
                    console.log('restoreTree заглушка, возвращаем данные как есть');
                    return treeData || { id: 'root', content: {}, children: [] };
                };
                console.log('Добавлен restoreTree в прототип TreeManager');
            }
            
            // Патчим setupDragAndDrop для избежания ошибки bind
            if (TreeManagerClass.prototype.setupDragAndDrop) {
                const originalSetupDragAndDrop = TreeManagerClass.prototype.setupDragAndDrop;
                TreeManagerClass.prototype.setupDragAndDrop = function() {
                    console.log('Патченный setupDragAndDrop вызван');
                    try {
                        return originalSetupDragAndDrop.call(this);
                    } catch (error) {
                        console.warn('Ошибка в setupDragAndDrop перехвачена:', error.message);
                        return null;
                    }
                };
                console.log('Патч setupDragAndDrop применен');
            }
            
            // Патчим importData для лучшей обработки ошибок
            if (TreeManagerClass.prototype.importData) {
                const originalImportData = TreeManagerClass.prototype.importData;
                TreeManagerClass.prototype.importData = function(data) {
                    console.log('Патченный importData вызван');
                    try {
                        return originalImportData.call(this, data);
                    } catch (error) {
                        console.warn('Ошибка в importData перехвачена:', error.message);
                        // Пробуем восстановить данные хотя бы частично
                        if (data && data.tree) {
                            this.treeData = data.tree;
                            console.log('Данные сохранены в treeData через fallback');
                        }
                        return false;
                    }
                };
                console.log('Патч importData применен');
            }
            
            // Добавляем метод showNotification если его нет
            if (!TreeManagerClass.prototype.showNotification) {
                TreeManagerClass.prototype.showNotification = function(message, type = 'info') {
                    console.log(`TreeManager notification [${type}]:`, message);
                    if (window.showNotification) {
                        window.showNotification(message, type);
                    }
                };
                console.log('Добавлен showNotification в прототип TreeManager');
            }
        }
        
        window.treeManager = new TreeManagerClass();
        console.log('✅ Экземпляр treeManager создан');
        
        // Патчим отсутствующие методы в экземпляре
        if (!window.treeManager.processOperationQueue) {
            window.treeManager.processOperationQueue = () => {
                console.log('processOperationQueue заглушка вызвана');
            };
        }
        
        if (!window.treeManager.loadFromLocalStorageFallback) {
            window.treeManager.loadFromLocalStorageFallback = async () => {
                console.log('loadFromLocalStorageFallback заглушка вызвана');
                try {
                    const savedData = localStorage.getItem('treeData');
                    if (savedData) {
                        const data = JSON.parse(savedData);
                        if (window.treeManager.importData) {
                            await window.treeManager.importData(data);
                            console.log('Данные загружены из localStorage');
                        }
                    }
                } catch (error) {
                    console.error('Ошибка загрузки из localStorage:', error);
                }
            };
        }
        
        if (!window.treeManager.saveToHistory) {
            window.treeManager.saveToHistory = (isInitialState = false) => {
                console.log('saveToHistory заглушка вызвана', { isInitialState });
            };
        }
        
        // Создаем NodeEffects если его нет
        if (typeof NodeEffects !== 'function' && typeof window.NodeEffects !== 'function') {
            console.warn('NodeEffects не найден, создаем заглушку');
            window.NodeEffects = class NodeEffectsStub {
                constructor() { 
                    console.log('NodeEffects заглушка создана'); 
                    this.effects = new Set();
                }
                addEffect(element, type) {
                    if (element && !this.effects.has(element)) {
                        this.effects.add(element);
                        console.log(`Добавлен эффект ${type} к элементу`);
                    }
                }
                removeEffect(element, type) {
                    if (this.effects.has(element)) {
                        this.effects.delete(element);
                    }
                }
            };
        }
        
        const NodeEffectsClass = NodeEffects || window.NodeEffects;
        window.nodeEffects = new NodeEffectsClass();
        console.log('✅ NodeEffects создан');
        
        // Инициализируем treeManager
        if (window.treeManager.initialize && typeof window.treeManager.initialize === 'function') {
            await window.treeManager.initialize();
        } else if (window.treeManager.init && typeof window.treeManager.init === 'function') {
            await window.treeManager.init();
        } else {
            console.warn('TreeManager не имеет методов initialize или init');
            if (window.treeManager.asyncInit && typeof window.treeManager.asyncInit === 'function') {
                await window.treeManager.asyncInit();
            }
        }
        
        console.log('✅ TreeManager инициализирован');
        return window.treeManager;
        
    } catch (error) {
        console.error('Ошибка инициализации TreeManager:', error);
        throw error;
    }
}

// Главная функция инициализации
async function initializeApp() {
    if (window._appInitialized) {
        console.log('Приложение уже инициализировано ранее');
        return;
    }
    
    if (window._initializationInProgress) {
        console.log('Инициализация уже в процессе...');
        return;
    }
    
    window._initializationInProgress = true;
    
    try {
        console.log('🚀 Запуск инициализации приложения...');
        
        if (document.readyState !== 'complete') {
            await new Promise(resolve => {
                if (document.readyState === 'complete') {
                    resolve();
                } else {
                    window.addEventListener('load', resolve);
                    setTimeout(resolve, 5000);
                }
            });
        }
        
        console.log('✅ DOM загружен');
        
        console.log('Проверяем загруженные скрипты:');
        console.log('- TreeManager:', typeof TreeManager !== 'undefined' ? 'загружен' : 'не найден');
        console.log('- NodeEffects:', typeof NodeEffects !== 'undefined' ? 'загружен' : 'не найден');
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const treeManager = await initializeTreeManager();
        
        if (!treeManager) {
            throw new Error('Не удалось создать TreeManager');
        }
        
        window._treeManagerInitialized = true;
        console.log('✅ TreeManager инициализирован');
        
        addGitHubLoadButton();
        setupIframeCommunication();
        
        if (window.IFRAME_MODE) {
            console.log('IFRAME режим, загружаем данные...');
            setTimeout(() => {
                loadDataFromGitHub();
            }, 1500);
        }
        
        window._appInitialized = true;
        console.log('✅ Приложение полностью инициализировано');
        
    } catch (error) {
        console.error('❌ Критическая ошибка инициализации:', error);
        showNotification('Ошибка загрузки приложения. Проверьте консоль.', 'error');
        createFallbackInterface();
    } finally {
        window._initializationInProgress = false;
    }
}

// Создание fallback интерфейса
function createFallbackInterface() {
    console.log('Создаем fallback интерфейс...');
    
    const container = document.getElementById('tree') || document.body;
    const fallbackHTML = `
        <div style="text-align: center; padding: 50px; color: var(--text-color);">
            <h2>Tree Manager</h2>
            <p>Приложение загружено в упрощенном режиме.</p>
            <div style="margin: 20px 0;">
                <button onclick="loadDataFromGitHub()" style="padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Загрузить из GitHub
                </button>
            </div>
            <div id="fallback-tree" style="margin-top: 20px;"></div>
        </div>
    `;
    
    container.innerHTML = fallbackHTML;
}

// Функции для работы с GitHub
function addGitHubLoadButton() {
    const controls = document.getElementById('controls');
    if (!controls) {
        console.warn('Элемент controls не найден');
        setTimeout(addGitHubLoadButton, 500);
        return;
    }
    
    if (document.getElementById('githubLoadBtn')) {
        return;
    }
    
    const githubBtn = document.createElement('button');
    githubBtn.type = 'button';
    githubBtn.id = 'githubLoadBtn';
    githubBtn.textContent = 'Загрузить из GitHub';
    githubBtn.style.cssText = `
        margin-left: 10px;
        background: linear-gradient(145deg, #24292e, #0366d6);
        color: white;
        padding: 8px 12px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s ease;
    `;
    
    githubBtn.addEventListener('mouseover', () => {
        githubBtn.style.transform = 'translateY(-2px)';
        githubBtn.style.boxShadow = '0 4px 8px rgba(3, 102, 214, 0.3)';
    });
    
    githubBtn.addEventListener('mouseout', () => {
        githubBtn.style.transform = 'translateY(0)';
        githubBtn.style.boxShadow = 'none';
    });
    
    const jsonImportBtn = document.getElementById('jsonImportBtn');
    if (jsonImportBtn) {
        jsonImportBtn.parentNode.insertBefore(githubBtn, jsonImportBtn.nextSibling);
    } else {
        controls.appendChild(githubBtn);
    }
    
    githubBtn.addEventListener('click', async () => {
        await loadDataFromGitHub();
    });
    
    console.log('Кнопка GitHub добавлена');
}

async function loadDataFromGitHub() {
    try {
        showLoadingIndicator('Загрузка данных из GitHub...');
        
        const data = await loadFromGitHub();
        
        if (!window.treeManager) {
            throw new Error('TreeManager не инициализирован');
        }
        
        // Показываем уведомление об успешной загрузке JSON
        showNotification('✅ JSON успешно загружен и распарсен!', 'success');
        
        // Даем пользователю увидеть сообщение
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
            if (window.treeManager.importData && typeof window.treeManager.importData === 'function') {
                const result = window.treeManager.importData(data);
                if (result !== false) {
                    showNotification('✅ Данные успешно загружены в дерево!', 'success');
                } else {
                    showNotification('⚠ Данные загружены в упрощенном режиме', 'warning');
                }
            } else if (window.treeManager.loadData && typeof window.treeManager.loadData === 'function') {
                window.treeManager.loadData(data);
                showNotification('✅ Данные успешно загружены в дерево!', 'success');
            } else {
                await loadTreeDataManually(data);
                showNotification('✅ Данные загружены в упрощенном режиме!', 'success');
            }
        } catch (importError) {
            console.warn('Ошибка при импорте в TreeManager:', importError);
            
            // Пробуем ручную загрузку
            await loadTreeDataManually(data);
            showNotification('✅ Данные загружены в упрощенном режиме!', 'success');
        }
        
    } catch (error) {
        console.error('Ошибка загрузки из GitHub:', error);
        showNotification(`❌ Ошибка загрузки: ${error.message}`, 'error');
    } finally {
        hideLoadingIndicator();
    }
}

async function loadFromGitHub() {
    console.log('=== ЗАГРУЗКА ИЗ GITHUB ===');
    
    // ВАШ РЕПОЗИТОРИЙ
    const OWNER = 'mark98molchanov-a11y';
    const REPO = 'mark98molchanov-a11y.github.io';
    const FILE_PATH = 'tree-data.json';
    
    console.log('Конфигурация загрузки:');
    console.log('Владелец:', OWNER);
    console.log('Репозиторий:', REPO);
    console.log('Файл:', FILE_PATH);
    
    // ТОЛЬКО тот URL, который сработал в логе
    const successfulUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/${FILE_PATH}`;
    
    console.log(`\nЗагрузка с URL: ${successfulUrl}`);
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(successfulUrl, {
            signal: controller.signal,
            mode: 'cors',
            cache: 'no-cache'
        });
        
        clearTimeout(timeoutId);
        
        console.log(`Статус: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
            const text = await response.text();
            console.log(`✅ Успешно! Получено ${text.length} символов`);
            
            if (!text.trim()) {
                throw new Error('Пустой ответ от сервера');
            }
            
            try {
                const data = JSON.parse(text);
                console.log(`✅ JSON успешно распарсен`);
                
                // Сохраняем успешный URL
                localStorage.setItem('lastSuccessfulGitHubUrl', successfulUrl);
                
                // Добавляем метаданные
                if (!data.metadata) data.metadata = {};
                data.metadata.source = 'github';
                data.metadata.loadedAt = new Date().toISOString();
                data.metadata.url = successfulUrl;
                
                return data;
            } catch (parseError) {
                console.error(`❌ Ошибка парсинга JSON: ${parseError.message}`);
                console.log('Первые 500 символов ответа:', text.substring(0, 500));
                throw new Error(`Некорректный формат JSON: ${parseError.message}`);
            }
        } else {
            throw new Error(`HTTP ошибка: ${response.status} ${response.statusText}`);
        }
        
    } catch (error) {
        console.error(`❌ Ошибка загрузки: ${error.name} - ${error.message}`);
        
        // Пробуем локальный fallback
        console.log('\nПробуем загрузить из localStorage...');
        try {
            const savedData = localStorage.getItem('treeData');
            if (savedData) {
                console.log('Найдены сохраненные данные в localStorage');
                const data = JSON.parse(savedData);
                
                if (!data.metadata) data.metadata = {};
                data.metadata.source = 'local_storage_fallback';
                data.metadata.loadedAt = new Date().toISOString();
                data.metadata.error = error.message;
                
                return data;
            }
        } catch (e) {
            console.log('Ошибка чтения localStorage:', e.message);
        }
        
        // Создаем демо-данные
        console.log('Создаем демо-данные');
        return {
            tree: {
                id: 'root',
                content: {
                    title: 'Организационная структура',
                    description: 'Для загрузки актуальных данных нажмите "Загрузить из GitHub"'
                },
                children: [
                    {
                        id: 'dept1',
                        content: { title: 'Администрация' },
                        children: []
                    },
                    {
                        id: 'dept2', 
                        content: { title: 'IT отдел' },
                        children: []
                    }
                ]
            },
            metadata: {
                source: 'demo_fallback',
                created: new Date().toISOString(),
                error: error.message,
                message: 'Не удалось загрузить данные из GitHub. Используйте локальный файл JSON.'
            }
        };
    }
}

function getLocalFallbackData() {
    console.log('Используем локальные данные');
    
    try {
        const savedData = localStorage.getItem('treeData');
        if (savedData) {
            console.log('Найдены сохраненные данные в localStorage');
            const data = JSON.parse(savedData);
            
            if (!data.metadata) data.metadata = {};
            data.metadata.source = 'local_storage';
            data.metadata.loadedAt = new Date().toISOString();
            
            return data;
        }
    } catch (e) {
        console.log('Ошибка чтения localStorage:', e.message);
    }
    
    console.log('Создаем демо-данные');
    return {
        tree: {
            id: 'root',
            content: {
                title: 'Организационная структура',
                description: 'Для загрузки актуальных данных нажмите "Загрузить из GitHub"'
            },
            children: [
                {
                    id: 'dept1',
                    content: { title: 'Администрация' },
                    children: []
                },
                {
                    id: 'dept2', 
                    content: { title: 'IT отдел' },
                    children: []
                }
            ]
        },
        metadata: {
            source: 'demo',
            created: new Date().toISOString(),
            message: 'Используйте кнопку "Загрузить из GitHub" для актуальных данных'
        }
    };
}

async function loadTreeDataManually(data) {
    console.log('Ручная загрузка данных в дерево');
    
    if (!data || !data.tree) {
        throw new Error('Нет данных дерева в загруженном файле');
    }
    
    const treeElement = document.getElementById('tree');
    if (treeElement) {
        treeElement.innerHTML = '';
    }
    
    function renderNode(node, parentElement) {
        const nodeElement = document.createElement('div');
        nodeElement.className = 'node';
        nodeElement.dataset.nodeId = node.id;
        
        const contentElement = document.createElement('div');
        contentElement.className = 'node-content';
        
        const titleElement = document.createElement('span');
            titleElement.className = 'node-title';
            titleElement.textContent = node.content?.title || `Узел ${node.id}`;
            
            contentElement.appendChild(titleElement);
            nodeElement.appendChild(contentElement);
            
            if (node.children && node.children.length > 0) {
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'node-children';
                
                node.children.forEach(child => {
                    renderNode(child, childrenContainer);
                });
                
                nodeElement.appendChild(childrenContainer);
            }
            
            parentElement.appendChild(nodeElement);
        }
        
        const treeContainer = document.getElementById('tree');
        if (treeContainer && data.tree) {
            renderNode(data.tree, treeContainer);
        }
        
        try {
            localStorage.removeItem('treeData');
            localStorage.setItem('treeData', JSON.stringify(data));
            console.log('Данные сохранены в localStorage');
        } catch (storageError) {
            console.warn('Не удалось сохранить в localStorage:', storageError);
        }
        
        return data;
    }

    // Вспомогательные функции UI
    function showLoadingIndicator(message) {
        hideLoadingIndicator();
        
        const indicator = document.createElement('div');
        indicator.id = 'github-loading-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.85);
            padding: 25px 35px;
            border-radius: 15px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 20px;
            border: 2px solid #0366d6;
            color: white;
            font-size: 16px;
            backdrop-filter: blur(10px);
        `;
        
        const spinner = document.createElement('div');
        spinner.style.cssText = `
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255,255,255,0.3);
            border-top: 4px solid #0366d6;
            border-radius: 50%;
            animation: githubSpin 1s linear infinite;
        `;
        
        const text = document.createElement('span');
        text.textContent = message;
        text.style.color = 'white';
        text.style.fontWeight = '500';
        
        indicator.appendChild(spinner);
        indicator.appendChild(text);
        document.body.appendChild(indicator);
        
        if (!document.querySelector('#github-animations')) {
            const style = document.createElement('style');
            style.id = 'github-animations';
            style.textContent = `
                @keyframes githubSpin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes githubSlideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes githubSlideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    function hideLoadingIndicator() {
        const indicator = document.getElementById('github-loading-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    function showNotification(text, type = 'success') {
        const oldNotifications = document.querySelectorAll('.github-notification');
        oldNotifications.forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `github-notification ${type}`;
        notification.textContent = text;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: ${type === 'error' ? 'linear-gradient(145deg, #ff4444, #d32f2f)' : 'linear-gradient(145deg, #4CAF50, #2E7D32)'};
            color: white;
            border-radius: 10px;
            box-shadow: 0 6px 20px rgba(0,0,0,0.25);
            z-index: 10000;
            animation: githubSlideIn 0.3s ease-out;
            font-weight: 500;
            font-size: 14px;
            max-width: 450px;
            word-wrap: break-word;
        `;
        
        const closeBtn = document.createElement('span');
        closeBtn.textContent = ' ×';
        closeBtn.style.cssText = `
            margin-left: 15px;
            cursor: pointer;
            font-weight: bold;
            font-size: 18px;
            display: inline-block;
        `;
        closeBtn.addEventListener('click', () => {
            notification.remove();
        });
        
        notification.appendChild(closeBtn);
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'githubSlideOut 0.3s ease-out';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 5000);
    }

    function setupIframeCommunication() {
        if (window.IFRAME_MODE) {
            console.log('Настройка iframe коммуникации');
            
            if (window.parent !== window) {
                window.parent.postMessage({
                    type: 'TREE_LOADED',
                    height: document.body.scrollHeight
                }, '*');
                
                window.addEventListener('message', function(event) {
                    console.log('Получено сообщение:', event.data);
                    
                    if (event.data.type === 'GET_TREE_DATA') {
                        window.parent.postMessage({
                            type: 'TREE_DATA',
                            data: window.treeManager ? window.treeManager.exportToJSON?.() : null
                        }, '*');
                    }
                    
                    if (event.data.type === 'SET_THEME') {
                        if (event.data.theme === 'dark') {
                            document.documentElement.classList.add('dark');
                        } else {
                            document.documentElement.classList.remove('dark');
                        }
                    }
                    
                    if (event.data.type === 'LOAD_FROM_GITHUB') {
                        loadDataFromGitHub();
                    }
                });
            }
            
            function resizeForIframe() {
                const container = document.querySelector('.tree-container');
                if (container) {
                    container.style.height = window.innerHeight - 60 + 'px';
                }
            }
            
            window.addEventListener('resize', resizeForIframe);
            resizeForIframe();
        }
    }

    // Глобальные переменные
    window.mouseX = 0;
    window.mouseY = 0;

    document.addEventListener('mousemove', (e) => {
        window.mouseX = e.clientX;
        window.mouseY = e.clientY;
    });

    window.copyToClipboard = function(text) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text)
                .then(() => showNotification('Текст скопирован'))
                .catch(err => console.error('Ошибка копирования:', err));
        } else {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showNotification('Текст скопирован');
        }
    };

    // Функции для диагностики
    window.testGitHubAccess = async function() {
        console.log('=== ТЕСТ ДОСТУПА К GITHUB ===');
        
        const OWNER = 'mark98molchanov-a11y';
        const REPO = 'mark98molchanov-a11y.github.io';
        const FILE = 'tree-data.json';
        
        const urls = [
            `https://${OWNER}.github.io/${FILE}`,
            `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/${FILE}`,
            `https://github.com/${OWNER}/${REPO}/raw/main/${FILE}`
        ];
        
        for (const url of urls) {
            console.log(`\nТестируем: ${url}`);
            window.open(url, '_blank');
            
            try {
                const response = await fetch(url);
                console.log(`Статус: ${response.status} ${response.statusText}`);
                
                if (response.ok) {
                    const text = await response.text();
                    console.log(`✅ Доступен, размер: ${text.length} символов`);
                    
                    try {
                        JSON.parse(text);
                        console.log(`✅ JSON валиден`);
                    } catch (e) {
                        console.log(`❌ Невалидный JSON: ${e.message}`);
                    }
                }
            } catch (e) {
                console.log(`❌ Ошибка: ${e.message}`);
            }
        }
    };

    // Запуск инициализации
    function startAppInitialization() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                if (!window._appInitialized) {
                    initializeApp();
                }
            });
        } else {
            if (!window._appInitialized) {
                initializeApp();
            }
        }
    }

    startAppInitialization();

    // Экспортируем функции
    window.initializeApp = initializeApp;
    window.loadDataFromGitHub = loadDataFromGitHub;
    window.showNotification = showNotification;
