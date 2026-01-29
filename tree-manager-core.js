class TreeManager {
    constructor() {
        this.actionLog = [];
        this.maxLogEntries = 15;
        this.selectedNode = null;
        this.selectedNodeId = null;
        this.nodeCounter = 1;
        this.treeData = null;
        this.imagesData = {};
        this.darkMode = false;
        this.controlsVisible = true;
        this.multiSelectMode = false;
        this.selectedNodes = new Set();
        this.ctrlPressed = false;
        this.draggedNode = null;
        this.draggedElement = null;
        this.clipboard = null; 
        this.dropIndicator = null;
        this.zoomTimeout = null;
        this.searchQuery = '';
        this.filesData = {};
        this.clusters = new Map(); 
        this.availableClusters = new Set(); 
        this.activeCluster = null;
        this.skipScrollRestore = false;
        this.scale = 0.7;
        this.visibleNodes = new Set();
        this.viewport = {
            top: 0,
            bottom: window.innerHeight,
            left: 0,
            right: window.innerWidth
        };
        this.nodeHeight = 180;
        this.nodeWidth = 280;
        this.debounceTimer = null;
        this.initialized = false;
        this.operationQueue = [];
        this.scrollState = { scrollLeft: 0, scrollTop: 0 };
        this.shouldRestoreScroll = false;
        this.focusNodeId = null;
        this.restoreToParent = null;
        this.editingMode = false; 
        this.history = []; 
        this.historyIndex = -1;
        this.maxHistoryLength = 50;
        this.uiSettings = {
            showNewNodesOnly: false 
        };
        this.departmentManagement = {
            active: false,
            draggedItem: null,
            draggedType: null,
            sourceCluster: null,
            history: [],
            maxHistory: 20,
            showNewNodesOnly: false,
            selectedNodesInDialog: new Set() 
        };
        this.db = new IndexedDBManager();
        

        this.bindElements();
        this.loadThemePreference();
            this._asyncInitStarted = false;
    }
    
async initialize() {
    try {
        if (this.initialized) {
            console.warn('TreeManager уже инициализирован, пропускаем повторную инициализацию');
            return;
        }
        
        console.log('TreeManager инициализация...');
        

        if (!this.elements || !this.elements.treeContainer) {
            this.bindElements();
        }
        
        if (!this._asyncInitStarted) {
            this._asyncInitStarted = true;
            await this.asyncInit();
        }
        this.initialized = true;
        
        if (this.processOperationQueue && typeof this.processOperationQueue === 'function') {
            this.processOperationQueue();
        }
        
        if (this.saveToHistory && typeof this.saveToHistory === 'function') {
            this.saveToHistory(true);
        }
        
        console.log('TreeManager успешно инициализирован');
        
    } catch (error) {
        console.error('Initialization failed:', error);
        
        if (!window._initializationInProgress) {
            this.showNotification('Ошибка инициализации приложения');
        }
        
        if (this.loadFromLocalStorageFallback && typeof this.loadFromLocalStorageFallback === 'function') {
            try {
                await this.loadFromLocalStorageFallback();
            } catch (fallbackError) {
                console.error('Ошибка в fallback загрузке:', fallbackError);
            }
        }
    }
}
    async asyncInit() {
        await this.db.open();
        await this.loadFilesData();
        await this.loadFromLocalStorage();
        this.loadActionLog();
        this.setupHistoryLogUI();
        
        // Создаем кнопку круговой замены только если ее нет
        if (!document.getElementById('circular-replacement-btn-main')) {
            const circularReplaceBtn = document.createElement('button');
            circularReplaceBtn.id = 'circular-replacement-btn-main';
            
            circularReplaceBtn.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 20px;
                width: 40px;
                height: 40px;
                background: var(--controls-bg);
                color: var(--primary-color);
                border: 1px solid var(--primary-color);
                border-radius: 50%;
                box-shadow: 0 2px 5px rgba(0,0,0,0.15);
                cursor: pointer;
                z-index: 1001;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 22px;
                transition: all 0.2s ease-out;
            `;

            document.body.appendChild(circularReplaceBtn);

            circularReplaceBtn.addEventListener('click', () => this.showCircularReplacementDialog());

            const tooltip = document.createElement('div');
            tooltip.textContent = 'Круговая замена узлов';
            tooltip.style.cssText = `
                position: fixed;
                bottom: 25px;
                left: 70px;
                background: var(--controls-bg);
                color: var(--text-color);
                padding: 5px 10px;
                border-radius: 6px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.15);
                font-size: 12px;
                font-weight: 500;
                z-index: 1002;
                opacity: 0;
                transform: translateX(-10px);
                transition: opacity 0.2s ease-out, transform 0.2s ease-out;
                pointer-events: none;
                white-space: nowrap;
            `;
            document.body.appendChild(tooltip);

            circularReplaceBtn.onmouseover = () => {
                circularReplaceBtn.style.transform = 'translateY(-2px)';
                circularReplaceBtn.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                tooltip.style.opacity = '1';
                tooltip.style.transform = 'translateX(0)';
            };
            circularReplaceBtn.onmouseout = () => {
                circularReplaceBtn.style.transform = 'translateY(0)';
                circularReplaceBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.15)';
                tooltip.style.opacity = '0';
                tooltip.style.transform = 'translateX(-10px)';
            };
        }
        
        this.setupEventListeners();
        this.setupClusterControls();
        this.setupZoom();
        this.setupSearch();
        this.updateTree();
        this.updateSelectionCounter();
        
        setTimeout(() => {
            this.scrollToRoot();
        }, 300);
    }
setupSearch() {
    this.searchInput = document.getElementById('searchInput');
    this.searchSuggestions = document.getElementById('searchSuggestions');

    this.injectMinimalistSearchClearButtonStyles(); 

    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';
    this.searchInput.parentNode.insertBefore(searchContainer, this.searchInput);
    searchContainer.appendChild(this.searchInput);

    const clearButton = document.createElement('button');
    clearButton.id = 'search-clear-btn';
    clearButton.textContent = '×';
    clearButton.setAttribute('aria-label', 'Очистить поиск'); 
    searchContainer.appendChild(clearButton);

    this.searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        clearButton.style.display = this.searchQuery ? 'block' : 'none';
        this.updateTree();
    });
    clearButton.addEventListener('click', () => {
        this.searchInput.value = '';
        this.searchQuery = '';
        clearButton.style.display = 'none';
        this.updateTree();
        this.searchInput.focus(); 
    });
}
injectMinimalistSearchClearButtonStyles() {
    if (document.getElementById('search-clear-styles')) return;

    const style = document.createElement('style');
    style.id = 'search-clear-styles';
    style.textContent = `
        .search-container {
            position: relative;
            display: inline-flex;
            align-items: center;
        }
        #searchInput {
            padding-right: 28px;
        }
        #search-clear-btn {
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            background: transparent;
            border: none;
            color: #ff4444;
            font-size: 20px;
            font-weight: bold;
            line-height: 1;
            cursor: pointer;
            display: none;
            padding: 0;
            opacity: 0.7;
            transition: opacity 0.2s;
        }
        #search-clear-btn:hover {
            opacity: 1;
        }
        .mode-selection-dialog-btn {
            flex-basis: 45%;
            padding: 8px 12px !important;
            font-size: 0.9em !important;
            cursor: pointer;
            border-radius: 8px !important;
            border: none;
            background: linear-gradient(145deg, var(--primary-color), #6B9EBF);
            color: white;
            font-weight: 500;
            transition: all 0.2s ease;
            min-width: 110px !important;
            max-width: 220px !important;
            height: 36px !important;
            line-height: 1.2 !important;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .mode-selection-dialog-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(93, 138, 168, 0.3);
        }
    `;
    document.head.appendChild(style);
}
handleSearchInput(query) {
    this.saveScrollPosition();
    
    this.searchQuery = query.toLowerCase().trim();
    
    if (this.searchQuery.length > 0) {
        this.showSuggestions(this.searchQuery);
    } else {
        this.searchSuggestions.style.display = 'none';
        this.updateTree(); 
    }
    
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
        this.updateTree();
        this.restoreScrollPosition();
        if (this.activeCluster) {
            this.showNotification(`Поиск в кластере "${this.activeCluster}"`);
        }
    }, 300);
}
    getAllWords() {
        const words = new Set();
        
        const collectWords = (node) => {
            node.content.text.toLowerCase().split(/\s+/).forEach(word => {
                if (word.length > 2) words.add(word);
            });
            (node.content.subBlocks || []).forEach(block => {
                block.toLowerCase().split(/\s+/).forEach(word => {
                    if (word.length > 2) words.add(word);
                });
            });
            (node.content.files || []).forEach(fileId => {
                const file = this.filesData[fileId];
                if (file) {
                    file.name.toLowerCase().split(/\s+/).forEach(word => {
                        if (word.length > 2) words.add(word);
                    });
                }
            });
            node.children.forEach(collectWords);
        };
        
        collectWords(this.treeData);
        return Array.from(words).sort();
    }
    showSuggestions(query) {
        const words = this.getAllWords();
        const suggestions = words.filter(word => 
            word.includes(query.toLowerCase())
        ).slice(0, 10);
        
        if (suggestions.length > 0) {
            this.searchSuggestions.innerHTML = '';
            suggestions.forEach(word => {
                const suggestion = document.createElement('div');
                suggestion.className = 'autocomplete-suggestion';
                
                const index = word.indexOf(query.toLowerCase());
                if (index >= 0) {
                    const before = word.substring(0, index);
                    const match = word.substring(index, index + query.length);
                    const after = word.substring(index + query.length);
                    
                    suggestion.innerHTML = `${before}<strong>${match}</strong>${after}`;
                } else {
                    suggestion.textContent = word;
                }
                
                suggestion.addEventListener('click', () => {
                    this.searchInput.value = word;
                    this.handleSearchInput(word);
                    this.searchInput.focus();
                });
                
                this.searchSuggestions.appendChild(suggestion);
            });
            
            this.searchSuggestions.style.display = 'block';
        } else {
            this.searchSuggestions.style.display = 'none';
        }
    }
      getVisibleNodes() {
    const visibleNodes = new Set();
    const walkTree = (node, depth = 0) => {
      if (!this.isNodeVisible(node, depth)) return;
      
      visibleNodes.add(node.id);
      if (node.isExpanded) {
        node.children.forEach(child => walkTree(child, depth + 1));
      }
    };
    
    walkTree(this.treeData);
    return visibleNodes;
  }
  isNodeVisible(node, depth) {
    const yPos = depth * this.nodeHeight;
    const xPos = depth * this.nodeWidth;
    
    return yPos >= this.viewport.top - this.nodeHeight * 2 && 
           yPos <= this.viewport.bottom + this.nodeHeight * 2 &&
           xPos >= this.viewport.left - this.nodeWidth * 2 &&
           xPos <= this.viewport.right + this.nodeWidth * 2;
  }
getVisibleNodesSync() {
    const visibleNodes = new Set();
    const walkTree = (node, depth = 0) => {
        if (!this.isNodeVisible(node, depth)) return;
        
        visibleNodes.add(node.id);
        if (node.isExpanded) {
            node.children.forEach(child => walkTree(child, depth + 1));
        }
    };
    
    walkTree(this.treeData);
    return visibleNodes;
}
renderVisibleNodes() {
    const treeContainer = this.elements.treeContainer;
    treeContainer.innerHTML = '';
    treeContainer.appendChild(this.createNodeElement(this.treeData));
}
bindElements() {
    this.elements = {
        jsonExportBtn: document.getElementById('jsonExportBtn'),
        searchInput: document.getElementById('searchInput'),
        jsonImportBtn: document.getElementById('jsonImportBtn'),
        collapseAllBtn: document.getElementById('collapseAllBtn'),
        saveBtn: document.getElementById('saveBtn'),
        themeSwitch: document.getElementById('themeSwitch'),
        dropZone: document.getElementById('dropZone'),
        treeContainer: document.getElementById('tree'),
        previewContainer: document.getElementById('previewContainer'),
        fullPreview: document.getElementById('fullPreview'),
        toggleControls: document.getElementById('toggleControls'),
        zoomResetBtn: document.getElementById('zoomResetBtn'),
        zoomInBtn: document.getElementById('zoomInBtn'),
        zoomOutBtn: document.getElementById('zoomOutBtn'),
        controls: document.getElementById('controls'),
        clusterSelect: document.getElementById('clusterSelect'),
        addToClusterBtn: document.getElementById('addToClusterBtn')
    };
    this.setupHelpTooltips(this.elements.controls, 'main');
}

setupEventListeners() {
    this.elements.searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.updateTree();
    });
    this.ctrlWasReleased = false;

document.addEventListener('keydown', (e) => {
    const isEditing = document.activeElement.tagName === 'TEXTAREA' || 
                     document.activeElement.tagName === 'INPUT' ||
                     document.activeElement.contentEditable === 'true';
    
    if (isEditing) {
        this.editingMode = true;
        return; 
    }
    
    this.editingMode = false;
    if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
        this.clipboard = null;
        this.showNotification('Буфер обмена очищен');
        this.clearMultiSelection();
        return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'с' || e.key === 'C' || e.key === 'С')) {
        e.preventDefault();
        this.copySelectedNode();
        return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'м' || e.key === 'V' || e.key === 'М')) {
        e.preventDefault();
        this.pasteNode();
        return;
    }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'а' || e.key === 'F' || e.key === 'А')) {
    e.preventDefault();
    this.pasteNodeAsChild();
    return;
}
if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'п' || e.key === 'G' || e.key === 'П')) {
    e.preventDefault();
    this.pasteAsParent();
    return;
}

if ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'к' || e.key === 'R' || e.key === 'К')) {
    e.preventDefault();
    this.replaceNode(); 
    return;
}

    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && 
        (e.key === 'z' || e.key === 'я' || e.key === 'Z' || e.key === 'Я')) {
        e.preventDefault();
        this.undo();
        return;
    }
    if (e.key === 'Control' || e.key === 'Meta') {
        this.ctrlPressed = true;
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'Control' || e.key === 'Meta') {
        this.ctrlPressed = false;
    }
});
let scrollTimeout;
this.elements.treeContainer.addEventListener('scroll', () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    this.updateNodeEffects();
  }, 100);
}, { passive: true });
    this.elements.jsonExportBtn.addEventListener('click', () => this.exportToJSON());
    this.elements.jsonImportBtn.addEventListener('click', () => this.importFromJSON());
  this.elements.collapseAllBtn.addEventListener('click', () => this.collapseAllNodes());
    this.elements.saveBtn.addEventListener('click', () => this.saveData());
    this.elements.themeSwitch.addEventListener('click', () => this.toggleTheme());

    document.getElementById('closeDepartmentManagement').addEventListener('click', () => {
        this.hideDepartmentManagement();
        this.promptReplacementMode();
    });

    document.addEventListener('dragover', (e) => {
        if (e.target.closest('.department-column')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        }
    });
const departmentManagementEl = document.getElementById('departmentManagement');

if (departmentManagementEl) {
  let dragPos = { x: 0, y: 0 };
  let isDragging = false;
  departmentManagementEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    dragPos.x = e.clientX;
    dragPos.y = e.clientY;

    if (!isDragging) {
      isDragging = true;
      requestAnimationFrame(autoScroll);
    }
  }, { passive: false });
  function autoScroll() {
    if (!isDragging) return;

    const rect = departmentManagementEl.getBoundingClientRect();
    const scrollMargin = 60;
    const maxScrollSpeed = 30; 

    let dx = 0;
    let dy = 0;

    if (dragPos.x < rect.left + scrollMargin) {
      dx = -calcSpeed(rect.left + scrollMargin - dragPos.x, scrollMargin, maxScrollSpeed);
    } else if (dragPos.x > rect.right - scrollMargin) {
      dx = calcSpeed(dragPos.x - (rect.right - scrollMargin), scrollMargin, maxScrollSpeed);
    }
    if (dragPos.y < rect.top + scrollMargin) {
      dy = -calcSpeed(rect.top + scrollMargin - dragPos.y, scrollMargin, maxScrollSpeed);
    } else if (dragPos.y > rect.bottom - scrollMargin) {
      dy = calcSpeed(dragPos.y - (rect.bottom - scrollMargin), scrollMargin, maxScrollSpeed);
    }

    if (dx !== 0 || dy !== 0) {
      departmentManagementEl.scrollLeft += dx;
      departmentManagementEl.scrollTop += dy;
      requestAnimationFrame(autoScroll);
    } else {
      isDragging = false;
    }
  }
  function calcSpeed(distance, margin, maxSpeed) {
    return Math.min(maxSpeed, (distance / margin) * maxSpeed);
  }
}
    document.addEventListener('drop', (e) => {
        if (!this.departmentManagement.active || !this.departmentManagement.draggedItem) return;
        
        const column = e.target.closest('.department-column');
        if (column) {
            e.preventDefault();
            const targetCluster = column.dataset.cluster;
            
            if (this.departmentManagement.draggedType === 'group') {
                this.moveGroupToCluster(
                    this.departmentManagement.draggedItem,
                    this.departmentManagement.sourceCluster,
                    targetCluster
                );
            } else {
                const itemNode = this.findNode(this.treeData, this.departmentManagement.draggedItem);
                if (itemNode) {
                    this.clusters.set(itemNode.id, targetCluster);
                    this.availableClusters.add(targetCluster);
                }
            }
            
            this.renderDepartmentManagement();
            this.updateTree();
            this.saveData();
        }
    });
    this.elements.clusterSelect.addEventListener('change', (e) => {
        this.activeCluster = e.target.value || null;
        this.updateTree();
        this.saveData();
});
this.elements.addToClusterBtn.addEventListener('click', () => {
  if (this.selectedNodes.size > 1) {
    this.showMultiClusterDialog();
  } else {
    this.showClusterDialog();
  }
});
    this.elements.toggleControls.addEventListener('click', () => this.toggleControlsVisibility());
    document.addEventListener('dragover', this.handleDragOver.bind(this));
    document.addEventListener('drop', this.handleFileDrop.bind(this));
    this.elements.previewContainer.addEventListener('click', () => this.hidePreview());
this.elements.addSubordinateBtn = document.getElementById('addSubordinateBtn');
this.elements.authorityBtn = document.getElementById('authorityBtn');
this.elements.authorityBtn.addEventListener('click', () => this.toggleAuthorityMark());
this.elements.zoomResetBtn.addEventListener('click', () => this.resetZoom());
this.elements.zoomInBtn.addEventListener('click', () => this.changeZoom(0.1));
this.elements.zoomOutBtn.addEventListener('click', () => this.changeZoom(-0.1));
this.elements.expandAllBtn = document.getElementById('expandAllBtn');
this.elements.uploadFileBtn = document.getElementById('uploadFileBtn');
this.elements.uploadFileBtn.addEventListener('click', () => this.uploadFile());
 this.elements.addSuperordinateAboveBtn = document.getElementById('addSuperordinateAboveBtn');
    this.elements.addSuperordinateAboveBtn.addEventListener('click', () => this.addSuperordinateAbove());
this.elements.mark269Btn = document.getElementById('mark269Btn');
this.elements.mark269Btn.addEventListener('click', () => this.toggle269Mark());
this.elements.power269Btn = document.getElementById('power269Btn');
this.elements.power269Btn.addEventListener('click', () => this.togglePower269Mark());
  this.elements.forAllBtn = document.getElementById('forAllBtn');
        this.elements.forAllBtn.addEventListener('click', () => this.toggleForAll());
this.elements.collapseParentBtn = document.getElementById('collapseParentBtn');
this.elements.collapseParentBtn.addEventListener('click', () => this.collapseParentNode());
this.elements.subordinateBtn = document.getElementById('subordinateBtn');
this.elements.subordinateBtn.addEventListener('click', () => this.toggleSubordinateMark());
this.elements.okrBtn = document.getElementById('okrBtn');
this.elements.okrBtn.addEventListener('click', () => this.toggleOKRMark());
this.elements.indicatorBtn = document.getElementById('indicatorBtn');
this.elements.indicatorBtn.addEventListener('click', () => this.toggleIndicatorMark());
  }
getFileIcon(fileType) {
    return '';
}

  toggleControlsVisibility() {
    this.controlsVisible = !this.controlsVisible;
    this.elements.controls.classList.toggle('hidden', !this.controlsVisible);
    this.elements.toggleControls.textContent = this.controlsVisible ? '×' : '≡';
  }
  resetTreeState() {
    const resetRecursive = (node) => {
      node.isExpanded = false;
      if (node.children && node.children.length) {
        node.children.forEach(resetRecursive);
      }
    };
    this.treeData.isExpanded = true;
    this.treeData.children.forEach(resetRecursive);
  }
collapseAllNodes() {
    const treeContainer = this.elements.treeContainer;
    const savedState = {
        scrollLeft: treeContainer.scrollLeft,
        scrollTop: treeContainer.scrollTop,
        transform: treeContainer.style.transform
    };
    this.resetTreeState();
    this.skipScrollRestore = true;
    this.updateTree();
    this.skipScrollRestore = false;
    requestAnimationFrame(() => {
        treeContainer.style.transform = savedState.transform;
        treeContainer.scrollLeft = Math.min(savedState.scrollLeft, treeContainer.scrollWidth - treeContainer.clientWidth);
        treeContainer.scrollTop = Math.min(savedState.scrollTop, treeContainer.scrollHeight - treeContainer.clientHeight);

        if (window.panZoomVars) {
            const transformMatch = savedState.transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
            if (transformMatch) {
                window.panZoomVars.translateX = parseFloat(transformMatch[1]);
                window.panZoomVars.translateY = parseFloat(transformMatch[2]);
            }
            window.panZoomVars.scale = this.scale;
        }
    });

    this.saveData();
    this.showNotification('Все узлы свернуты');
}

scrollToRoot() {
    const rootElement = document.querySelector(`[data-node-id="${this.treeData.id}"]`);
    if (rootElement) {
        rootElement.scrollIntoView({
            behavior: 'auto',
            block: 'center',
            inline: 'center'
        });
    }
}
resetZoom(centerOnParent = false) {
    const treeContainer = this.elements.treeContainer || document.querySelector('.tree-container');
    treeContainer.style.transform = 'scale(0.7)'; 
    this.scale = 0.7; 

    if (centerOnParent && this.selectedNode) {
        const parentNode = this.findParent(this.treeData, this.selectedNode.node.id);
        if (parentNode) {
            setTimeout(() => {
                const parentElement = document.querySelector(`[data-node-id="${parentNode.id}"]`);
                if (parentElement) {
                    const containerRect = treeContainer.getBoundingClientRect();
                    const elementRect = parentElement.getBoundingClientRect();
                    
                    const targetX = (window.innerWidth / 2) - (elementRect.width / 2);
                    const targetY = (window.innerHeight / 2) - (elementRect.height / 2);
                    
                    const currentX = elementRect.left - containerRect.left;
                    const currentY = elementRect.top - containerRect.top;
                    
                    const scrollX = targetX - currentX;
                    const scrollY = targetY - currentY;
                    
                    treeContainer.scrollBy({
                        left: scrollX,
                        top: scrollY,
                        behavior: 'smooth'
                    });
                    
                    parentElement.classList.add('highlight-parent');
                    setTimeout(() => {
                        parentElement.classList.remove('highlight-parent');
                    }, 2000);
                }
            }, 50);
        }
    } else if (this.resetPosition) {
        this.resetPosition();
    }
    this.showNotification(centerOnParent ? 
        'Масштаб сброшен и центрирован на родительском узле' : 
        'Масштаб сброшен');
}
  updateNodeEffects() {
    document.querySelectorAll('.node-content').forEach(content => {
      const node = this.findNode(this.treeData, content.closest('.node').dataset.nodeId);
      
      if (node.content.absent269) {
        nodeEffects.addEffect(content, 'absent269');
      } else if (node.content.isForAll) {
        nodeEffects.addEffect(content, 'forAll');
      } else if (node.content.isSubordinate) {
        nodeEffects.addEffect(content, 'subordinate');
      }
    });
  }
async copySelectedNode() {
    if (!this.selectedNode && this.selectedNodes.size === 0) {
        this.showNotification('Выберите узел(ы) для копирования');
        return;
    }
    const createDialog = () => {
        return new Promise((resolve) => {
            const style = document.createElement('style');
            style.id = 'copy-dialog-styles';
            style.innerHTML = `
                .copy-dialog-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); display: flex; justify-content: center; align-items: center; z-index: 10001; backdrop-filter: blur(4px); }
                .copy-dialog { background: var(--controls-bg); padding: 25px; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.25); width: 400px; text-align: center; border: 1px solid var(--primary-color); animation: dialog-appear 0.3s ease-out; }
                @keyframes dialog-appear { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
                .copy-dialog h3 { margin-top: 0; color: var(--primary-color); font-size: 1.4em; }
                .copy-dialog .options { display: flex; flex-direction: column; gap: 12px; margin: 20px 0; }
                .copy-dialog button { padding: 12px; border-radius: 8px; border: 1px solid transparent; cursor: pointer; font-size: 1em; transition: all 0.2s ease; background: var(--node-bg); color: var(--text-color); border: 1px solid var(--primary-color); text-align: left; }
                .copy-dialog button:hover { background: var(--secondary-color); color: white; border-color: var(--secondary-color); transform: translateY(-2px); }
                .copy-dialog .cancel-btn { margin-top: 10px; background: transparent; color: var(--accent-color); border: none; }
            `;
            document.head.appendChild(style);
            const backdrop = document.createElement('div');
            backdrop.className = 'copy-dialog-backdrop';
            const dialog = document.createElement('div');
            dialog.className = 'copy-dialog';
            const nodeCount = this.selectedNodes.size > 0 ? this.selectedNodes.size : 1;
            const nodeText = nodeCount > 1 ? `${nodeCount} узлов` : `узел "${this.selectedNode.node.content.text}"`;
            dialog.innerHTML = `<h3>Копирование</h3><p>Что сделать с ${nodeText}?</p><div class="options"><button data-action="cut">Вырезать (переместить)</button><button data-action="copy-deep">Копировать с дочерними узлами</button><button data-action="copy-shallow">Копировать только этот узел</button></div><button class="cancel-btn" data-action="cancel">Отмена</button>`;
            backdrop.appendChild(dialog);
            document.body.appendChild(backdrop);
            const closeDialog = (action) => {
                document.body.removeChild(backdrop);
                document.head.removeChild(style);
                resolve(action);
            };
            dialog.addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON') { closeDialog(e.target.dataset.action); } });
            backdrop.addEventListener('click', (e) => { if (e.target === backdrop) { closeDialog('cancel'); } });
        });
    };
    const action = await createDialog();
    if (action === 'cancel') {
        this.showNotification('Копирование отменено');
        return;
    }

    const nodeNames = [];
   
    if (this.selectedNodes.size > 0) {
        this.selectedNodes.forEach(id => {
            const node = this.findNode(this.treeData, id);
            if (node) nodeNames.push(`"${node.content.text}"`);
        });
    } else if (this.selectedNode) {
        nodeNames.push(`"${this.selectedNode.node.content.text}"`);
    }

    const logText = action === 'cut' ? 'Вырезан узел(ы):' : 'Скопирован узел(ы):';
 
    this.logAction(`${logText} ${nodeNames.join(', ')}`);

    this.saveToHistory(false, true);
    const isCut = action === 'cut';
    const copyChildren = action !== 'copy-shallow';
    const copyData = { timestamp: Date.now(), version: '2.8', isCutOperation: isCut };
    const processNode = (node) => { return copyChildren ? this.serializeNodeWithChildren(node) : this.serializeNode(node); };
    if (this.selectedNodes.size > 0) {
        copyData.nodes = [];
        this.selectedNodes.forEach(id => { const node = this.findNode(this.treeData, id); if (node) copyData.nodes.push(processNode(node)); });
        copyData.isMultiCopy = true;
    } else if (this.selectedNode) {
        copyData.node = processNode(this.selectedNode.node);
        copyData.isMultiCopy = false;
    }
    this.clipboard = copyData;
    let notificationMessage = 'Узел(ы) скопированы в буфер обмена.';
    if (isCut) {
        const nodesToRemove = this.selectedNodes.size > 0 ? new Set(this.selectedNodes) : new Set([this.selectedNode.node.id]);
        const removeRecursive = (parent, ids) => {
            parent.children = parent.children.filter(child => !ids.has(child.id));
            parent.children.forEach(child => removeRecursive(child, ids));
        };
        removeRecursive(this.treeData, nodesToRemove);
        this.clearMultiSelection();
        this.selectedNode = null;
        this.selectedNodeId = null;
        this.updateTree();
        notificationMessage = 'Узел(ы) вырезаны и готовы к вставке.';
    }
    this.showNotification(`${notificationMessage} Нажмите Ctrl+V для вставки.`);
    this.saveData();
}
async copyWithLevels() {
    this.saveToHistory();
    if (!this.selectedNode) {
        this.showNotification('Сначала выберите корневой узел для операции.');
        return;
    }

    const originalNode = this.selectedNode.node;
    const parentOfOriginal = this.findParent(this.treeData, originalNode.id);
    if (!parentOfOriginal) {
        this.showNotification('Нельзя выполнить эту операцию для корневого узла.', 'error');
        return;
    }
    const selectedIds = await this.showTreeSelectionDialog(originalNode);
    if (!selectedIds || !selectedIds.size) {
        this.showNotification('Копирование отменено.');
        return;
    }
    const newHierarchyRoot = this.buildNewHierarchy(originalNode, selectedIds);
    if (!newHierarchyRoot) {
        this.showNotification('Не удалось построить новую иерархию.', 'error');
        return;
    }
    this.clipboard = {
        timestamp: Date.now(),
        version: '3.1',
        isCutOperation: true,
        node: newHierarchyRoot
    };
    const promotedOrphans = this.restructureAndPruneTree(originalNode, selectedIds);

   
    const originalNodeIndex = parentOfOriginal.children.findIndex(child => child.id === originalNode.id);


    if (originalNodeIndex !== -1) {
        parentOfOriginal.children.splice(originalNodeIndex, 1, ...promotedOrphans);
    }

    this.updateTree();
    this.saveData();
    this.showNotification(`Структура скопирована. Вставьте (Ctrl+V) в нужное место.`);
}

getOrphanPromotionMap(startNode, selectedIds) {
    const promotionMap = new Map();

    const findOrphansRecursive = (currentNode) => {
        if (selectedIds.has(currentNode.id)) {
            const orphans = currentNode.children.filter(child => !selectedIds.has(child.id));
            if (orphans.length > 0) {
                promotionMap.set(currentNode.id, orphans);
            }
        }
        currentNode.children.forEach(findOrphansRecursive);
    };

    findOrphansRecursive(startNode);
    return promotionMap;
}
removeNodesByIds(currentNode, idsToRemove) {
    currentNode.children = currentNode.children.filter(child => !idsToRemove.has(child.id));
    currentNode.children.forEach(child => this.removeNodesByIds(child, idsToRemove));
}
buildNewHierarchyForRestructure(startNode, nodesToMoveIds) {
    const buildRecursive = (currentNode) => {
        const newNode = JSON.parse(JSON.stringify(currentNode));
        newNode.children = []; 
        if (currentNode.children && currentNode.children.length > 0) {
            for (const child of currentNode.children) {
                if (nodesToMoveIds.has(child.id)) {
                    const newChild = buildRecursive(child);
                    if (newChild) {
                        newNode.children.push(newChild);
                    }
                }
            }
        }
        return newNode;
    };
    const newHierarchyRoots = [];
    nodesToMoveIds.forEach(id => {
        const parent = this.findParent(this.treeData, id);
        if (!parent || !nodesToMoveIds.has(parent.id)) {
            const node = this.findNode(this.treeData, id);
            if (node) {
                newHierarchyRoots.push(buildRecursive(node));
            }
        }
    });

    return newHierarchyRoots;
}
getMaxDepth(node, depth = 1) {
    try {
        if (!node || !node.children || node.children.length === 0) {
            return depth;
        }
        let maxChildDepth = depth;
        node.children.forEach(child => {
            const childDepth = this.getMaxDepth(child, depth + 1);
            if (childDepth > maxChildDepth) {
                maxChildDepth = childDepth;
            }
        });
        return maxChildDepth;
    } catch (error) {
        console.error('Ошибка в getMaxDepth:', error);
        return 1;
    }
}
getRemainingNodes(startNode, selectedIds) {
    const orphans = [];
    const findOrphansRecursive = (currentNode) => {
        const parentIsSelected = selectedIds.has(currentNode.id);

        currentNode.children.forEach(child => {
            const childIsSelected = selectedIds.has(child.id);
            if (parentIsSelected && !childIsSelected) {
                orphans.push(child); 
            } else {
                findOrphansRecursive(child);
            }
        });
    };
    findOrphansRecursive(startNode);
    return orphans;
}
getNodePosition(node) {
    const parent = this.findParent(this.treeData, node.id);
    if (!parent) return { parentId: null, index: -1 };
    const index = parent.children.findIndex(child => child.id === node.id);
    return { parentId: parent.id, index };
}
async showCircularReplacementDialog() {
    const mode = await this.promptReplacementMode();
    if (!mode) return;

    if (mode === 'tornado') {
        this.showTornadoReplacementDialog();
    } else if (mode === 'limited') {
        this.showLimitedReplacementDialog();
    } else if (mode === 'restructure') {
        this.showRestructureDialog();
    } else if (mode === 'add_unit') {
        this.showNewStaffUnitDialog();
    } else if (mode === 'manage_positions') {
        this.showManagePositionsDialog();
    } else if (mode === 'manage_departments') {
        this.showDepartmentManagement();
    } else if (mode === 'liquidate_department') { 
        this.showLiquidationDialog();
    }
}
promptReplacementMode() {
    return new Promise(resolve => {
        if (document.getElementById('mode-selection-dialog')) return;
        if (!document.getElementById('mode-selection-dialog-styles')) {
            const style = document.createElement('style');
            style.id = 'mode-selection-dialog-styles';
            style.textContent = `
                .mode-selection-dialog-btn {
                    flex-basis: 45%; padding: 8px 12px !important; font-size: 0.9em !important;
                    cursor: pointer; border-radius: 8px !important; border: none;
                    background: linear-gradient(145deg, var(--primary-color), #6B9EBF);
                    color: white; font-weight: 500; transition: all 0.2s ease;
                    min-width: 110px !important; max-width: 220px !important;
                    height: 36px !important; line-height: 1.2 !important; box-sizing: border-box;
                    display: flex; align-items: center; justify-content: center;
                }
                .mode-selection-dialog-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 12px rgba(93, 138, 168, 0.3);
                }
            `;
            document.head.appendChild(style);
        }

        const backdrop = document.createElement('div');
        backdrop.id = 'mode-selection-dialog';
        backdrop.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.6); display: flex; justify-content: center;
            align-items: center; z-index: 10003; backdrop-filter: blur(5px);
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: var(--controls-bg); padding: 25px; border-radius: 12px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.25); text-align: center;
            border: 1px solid var(--primary-color); animation: dialog-appear 0.3s ease-out;
        `;

         dialog.innerHTML = `
            <h3 style="margin-top: 0; color: var(--primary-color);">Выберите режим операции</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 15px; margin: 20px 0; justify-content: center;">
                <button data-mode="tornado" class="mode-selection-dialog-btn">Торнадо (4 списка)</button>
                <button data-mode="limited" class="mode-selection-dialog-btn">Ограниченная замена</button>
                <button data-mode="restructure" class="mode-selection-dialog-btn">Реструктуризация узла</button>
                <button data-mode="add_unit" class="mode-selection-dialog-btn">Новая штатная единица</button>
                <button data-mode="manage_positions" class="mode-selection-dialog-btn">Управление должностями</button>
                <button data-mode="manage_departments" class="mode-selection-dialog-btn">Управление отделами</button>
                <button data-mode="liquidate_department" class="mode-selection-dialog-btn">Ликвидация отделов</button>
            </div>
            <button data-mode="cancel" style="margin-top: 10px; background: transparent; color: var(--accent-color); border: none; cursor: pointer;">Отмена</button>
        `;

        const closeDialog = (mode = null) => {
            document.body.removeChild(backdrop);
            resolve(mode);
        };

        dialog.addEventListener('click', (e) => {
            if (e.target.dataset.mode) {
                closeDialog(e.target.dataset.mode === 'cancel' ? null : e.target.dataset.mode);
            }
        });

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closeDialog();
        });

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);
    });
}
showManagePositionsDialog() {
 if (!document.getElementById('manage-positions-styles')) {
 const style = document.createElement('style');
 style.id = 'manage-positions-styles';
 style.textContent = `
 .mp-backdrop { 
 position: fixed; 
 top: 0; 
 left: 0; 
 width: 100%; 
 height: 100%; 
 background: rgba(0,0,0,0.7); 
 display: flex; 
 justify-content: center; 
 align-items: center; 
 z-index: 10002; 
 backdrop-filter: blur(8px);
 }
 .mp-dialog { 
 background: var(--controls-bg); 
 padding: 25px; 
 width: 95vw; 
 height: 90vh; 
 box-sizing: border-box; 
 border-radius: 16px; 
 border: 2px solid var(--primary-color);
 display: flex; 
 flex-direction: column;
 box-shadow: 0 10px 30px rgba(0,0,0,0.3);
 overflow: hidden;
 }
 .mp-header { 
 text-align: center; 
 margin-bottom: 20px; 
 color: var(--primary-color); 
 }
 .mp-header h3 {
 margin: 0;
 font-size: 1.8rem;
 font-weight: 600;
 }
 .mp-content { 
 display: flex; 
 gap: 25px; 
 flex: 1; 
 min-height: 0; 
 }
 .mp-column { 
 display: flex; 
 flex-direction: column; 
 gap: 15px; 
 flex: 1; 
 min-width: 300px;
 background: rgba(93, 138, 168, 0.05);
 border-radius: 12px;
 padding: 15px;
 border: 1px solid var(--primary-color);
 }
 .mp-column h4 {
 margin: 0 0 15px 0;
 color: var(--primary-color);
 font-size: 1.3rem;
 text-align: center;
 padding-bottom: 8px;
 border-bottom: 2px solid var(--secondary-color);
 }
 .mp-search-input { 
 padding: 10px 12px; 
 border: 2px solid var(--secondary-color); 
 border-radius: 8px; 
 width: 100%; 
 box-sizing: border-box; 
 margin-bottom: 10px; 
 background: rgba(255, 255, 255, 0.1);
 color: var(--text-color);
 font-size: 1rem;
 }
 .mp-tree-container { 
 border: 2px solid var(--secondary-color); 
 border-radius: 10px; 
 padding: 12px; 
 flex: 1; 
 overflow-y: auto;
 background: rgba(255, 255, 255, 0.05);
 }
 .mp-footer { 
 margin-top: 20px; 
 display: flex; 
 justify-content: space-between; 
 align-items: center;
 padding-top: 15px;
 border-top: 1px solid var(--secondary-color);
 }
 .mp-actions { 
 display: flex; 
 gap: 15px; 
 }
 .mp-btn { 
 padding: 12px 24px; 
 border: none; 
 border-radius: 8px; 
 cursor: pointer; 
 font-weight: 600; 
 transition: all 0.3s ease;
 font-size: 1rem;
 }
 .mp-btn:disabled { 
 background: #666 !important; 
 cursor: not-allowed; 
 opacity: 0.6;
 }
 .mp-btn.apply { 
 background: linear-gradient(145deg, #4CAF50, #2E7D32);
 color: white; 
 box-shadow: 0 4px 6px rgba(76, 175, 80, 0.3);
 }
 .mp-btn.apply:hover:not(:disabled) {
 background: linear-gradient(145deg, #43A047, #1B5E20);
 transform: translateY(-2px);
 box-shadow: 0 6px 8px rgba(76, 175, 80, 0.4);
 }
 .mp-btn.cancel { 
 background: transparent; 
 color: var(--accent-color);
 border: 2px solid var(--accent-color);
 }
 .mp-btn.cancel:hover {
 background: rgba(255, 160, 122, 0.1);
 transform: translateY(-2px);
 }
 .mp-position-input { 
 padding: 10px 12px; 
 border: 2px solid var(--secondary-color); 
 border-radius: 8px; 
 width: 100%; 
 box-sizing: border-box; 
 margin-bottom: 12px; 
 background: rgba(255, 255, 255, 0.1);
 color: var(--text-color);
 font-size: 1rem;
 }
 .mp-position-select { 
 padding: 10px 12px; 
 border: 2px solid var(--secondary-color); 
 border-radius: 8px; 
 width: 100%; 
 box-sizing: border-box; 
 margin-bottom: 15px;
 background: rgba(255, 255, 255, 0.1);
 color: var(--text-color); 
 font-size: 1rem;
 cursor: pointer;
 position: relative;
 }
 .mp-position-select option {
 background: var(--controls-bg);
 color: var(--text-color);
 padding-right: 30px;
 position: relative;
 }
 .mp-add-position-btn { 
 padding: 10px 15px; 
 background: linear-gradient(145deg, var(--primary-color), #6B9EBF);
 color: white; 
 border: none; 
 border-radius: 8px; 
 cursor: pointer; 
 margin-bottom: 15px;
 font-weight: 600;
 transition: all 0.3s ease;
 box-shadow: 0 4px 6px rgba(93, 138, 168, 0.3);
 }
 .mp-add-position-btn:hover {
 background: linear-gradient(145deg, #6B9EBF, var(--primary-color));
 transform: translateY(-2px);
 box-shadow: 0 6px 8px rgba(93, 138, 168, 0.4);
 }
 .mp-custom-select {
 position: relative;
 margin-bottom: 15px;
 }
 .mp-select-header {
 padding: 10px 12px;
 border: 2px solid var(--secondary-color);
 border-radius: 8px;
 background: rgba(255, 255, 255, 0.1);
 color: var(--text-color);
 cursor: pointer;
 display: flex;
 justify-content: space-between;
 align-items: center;
 }
 .mp-select-dropdown {
 position: absolute;
 top: 100%;
 left: 0;
 right: 0;
 background: var(--controls-bg);
 border: 2px solid var(--secondary-color);
 border-top: none;
 border-radius: 0 0 8px 8px;
 max-height: 200px;
 overflow-y: auto;
 z-index: 1000;
 display: none;
 }
 .mp-select-option {
 padding: 10px 12px;
 display: flex;
 justify-content: space-between;
 align-items: center;
 cursor: pointer;
 border-bottom: 1px solid rgba(93, 138, 168, 0.2);
 }
 .mp-select-option:hover {
 background: rgba(93, 138, 168, 0.2);
 }
 .mp-delete-position-btn {
 background: none;
 border: none;
 color: var(--accent-color);
 cursor: pointer;
 font-size: 1.2em;
 padding: 0;
 width: 24px;
 height: 24px;
 display: flex;
 align-items: center;
 justify-content: center;
 border-radius: 50%;
 }
 .mp-delete-position-btn:hover {
 background: rgba(255, 160, 122, 0.2);
 transform: scale(1.1);
 }
 `;
 document.head.appendChild(style);
 }

 const backdrop = document.createElement('div');
 backdrop.className = 'mp-backdrop';
 const dialog = document.createElement('div');
 dialog.className = 'mp-dialog';
 dialog.innerHTML = `
 <div class="mp-header">
 <h3>Управление должностями</h3>
 </div>
 <div class="mp-content" id="mp-content-area"></div>
 <div class="mp-footer">
 <div></div>
 <div class="mp-actions">
 <button class="mp-btn cancel">Отмена</button>
 <button class="mp-btn apply" id="mp-apply-btn" disabled>Применить</button>
 </div>
 </div>
 `;
 backdrop.appendChild(dialog);
 document.body.appendChild(backdrop);

 const contentArea = dialog.querySelector('#mp-content-area');
 let selectedPosition = '';
 let selectedNodeId = null;
 const expansionState = new Set();

 let savedPositions = [];
 try {
 const positions = localStorage.getItem('treeAppPositions');
 if (positions) {
 savedPositions = JSON.parse(positions);
 }
 } catch (e) {
 console.error('Ошибка загрузки должностей:', e);
 }

 const renderColumns = () => {
 contentArea.innerHTML = '';

 const positionColumn = document.createElement('div');
 positionColumn.className = 'mp-column';

 const positionHeader = document.createElement('h4');
 positionHeader.textContent = 'Выбор должности';
 positionColumn.appendChild(positionHeader);

 const positionInput = document.createElement('input');
 positionInput.type = 'text';
 positionInput.placeholder = 'Введите новую должность';
 positionInput.className = 'mp-position-input';
 positionColumn.appendChild(positionInput);

 const addPositionBtn = document.createElement('button');
 addPositionBtn.textContent = 'Добавить должность';
 addPositionBtn.className = 'mp-add-position-btn';
 positionColumn.appendChild(addPositionBtn);

 const customSelect = document.createElement('div');
 customSelect.className = 'mp-custom-select';

 const selectHeader = document.createElement('div');
 selectHeader.className = 'mp-select-header';
 selectHeader.innerHTML = 'Выберите должность <span>▼</span>';
 customSelect.appendChild(selectHeader);

 const selectDropdown = document.createElement('div');
 selectDropdown.className = 'mp-select-dropdown';
 customSelect.appendChild(selectDropdown);

 positionColumn.appendChild(customSelect);
 contentArea.appendChild(positionColumn);

 const nodeColumn = document.createElement('div');
 nodeColumn.className = 'mp-column';

 const nodeHeader = document.createElement('h4');
 nodeHeader.textContent = 'Выбор узла';
 nodeColumn.appendChild(nodeHeader);

 const searchInput = document.createElement('input');
 searchInput.type = 'text';
 searchInput.placeholder = 'Поиск узла...';
 searchInput.className = 'mp-search-input';
 nodeColumn.appendChild(searchInput);

 const treeContainer = document.createElement('div');
 treeContainer.className = 'mp-tree-container';
 nodeColumn.appendChild(treeContainer);
 contentArea.appendChild(nodeColumn);
 const positionSearchInput = document.createElement('input');
 positionSearchInput.type = 'text';
 positionSearchInput.placeholder = 'Поиск должности...';
 positionSearchInput.className = 'mp-search-input';
 positionSearchInput.style.margin = '5px';
 selectDropdown.appendChild(positionSearchInput);

 const optionsContainer = document.createElement('div');
 selectDropdown.appendChild(optionsContainer);
 const updateDropdownOptions = () => {
 optionsContainer.innerHTML = '';
 const filterText = positionSearchInput.value.toLowerCase().trim();
 const filteredPositions = filterText 
 ? savedPositions.filter(pos => pos.toLowerCase().includes(filterText))
 : savedPositions;
 const defaultOption = document.createElement('div');
 defaultOption.className = 'mp-select-option';
 defaultOption.innerHTML = '<span>Выберите должность</span>';
 defaultOption.addEventListener('click', () => {
 selectedPosition = '';
 selectHeader.innerHTML = 'Выберите должность <span>▼</span>';
 selectDropdown.style.display = 'none';
 updateApplyButton();
 });
 optionsContainer.appendChild(defaultOption);

 filteredPositions.forEach(position => {
 const option = document.createElement('div');
 option.className = 'mp-select-option';

 const textSpan = document.createElement('span');
 textSpan.textContent = position;

 const deleteBtn = document.createElement('button');
 deleteBtn.className = 'mp-delete-position-btn';
 deleteBtn.innerHTML = '&times;';
 deleteBtn.title = 'Удалить должность';

 deleteBtn.addEventListener('click', (e) => {
 e.stopPropagation();
 savedPositions = savedPositions.filter(p => p !== position);
 try {
 localStorage.setItem('treeAppPositions', JSON.stringify(savedPositions));
 } catch (e) {
 console.error('Ошибка сохранения должностей:', e);
 }
 updateDropdownOptions(); 
 if (selectedPosition === position) {
 selectedPosition = '';
 selectHeader.innerHTML = 'Выберите должность <span>▼</span>';
 updateApplyButton();
 }
 });
 option.appendChild(textSpan);
 option.appendChild(deleteBtn);

 option.addEventListener('click', () => {
 selectedPosition = position;
 selectHeader.innerHTML = `${position} <span>▼</span>`;
 selectDropdown.style.display = 'none';
 updateApplyButton();
 });

 optionsContainer.appendChild(option);
 });
 };

 let positionSearchTimer;
 positionSearchInput.addEventListener('input', () => {
 clearTimeout(positionSearchTimer);
 positionSearchTimer = setTimeout(updateDropdownOptions, 300);
 });

 selectHeader.addEventListener('click', () => {
 const isVisible = selectDropdown.style.display === 'block';
 selectDropdown.style.display = isVisible ? 'none' : 'block';
 if (!isVisible) {
 updateDropdownOptions(); 
 positionSearchInput.focus();
 }
 });

 document.addEventListener('click', (e) => {
 if (!customSelect.contains(e.target)) {
 selectDropdown.style.display = 'none';
 }
 });

 addPositionBtn.addEventListener('click', () => {
 const newPosition = positionInput.value.trim();
 if (newPosition && !savedPositions.includes(newPosition)) {
 savedPositions.push(newPosition);
 try {
 localStorage.setItem('treeAppPositions', JSON.stringify(savedPositions));
 } catch (e) {
 console.error('Ошибка сохранения должностей:', e);
 }

 updateDropdownOptions();
 positionInput.value = '';
 }
 });

 let nodeSearchTimer;
 const redrawTree = () => {
 const filterText = searchInput.value.toLowerCase().trim();
 this.createSingleSelectableTree(
 treeContainer,
 (nodeId) => {
 selectedNodeId = nodeId;
 updateApplyButton();
 },
 selectedNodeId,
 expansionState,
 filterText,
 false
 );
 };
 searchInput.addEventListener('input', () => {
 clearTimeout(nodeSearchTimer);
 nodeSearchTimer = setTimeout(redrawTree, 300);
 });

 redrawTree();
 updateDropdownOptions();

 const updateApplyButton = () => {
 const applyBtn = dialog.querySelector('#mp-apply-btn');
 applyBtn.disabled = !selectedPosition || !selectedNodeId;
 };
 };

 const closeDialog = () => document.body.removeChild(backdrop);

 dialog.querySelector('.cancel').addEventListener('click', () => {
    closeDialog();
    this.promptReplacementMode(); 
 });
 dialog.querySelector('#mp-apply-btn').addEventListener('click', () => {
 if (selectedPosition && selectedNodeId) {
 this.applyPositionToNodes(selectedPosition, selectedNodeId);
 closeDialog();
 }
 });
 backdrop.addEventListener('click', (e) => {
 if (e.target === backdrop) closeDialog();
 });

 renderColumns();
}
async showLiquidationDialog() {
    this.injectLiquidationDialogStyles();
    this.liquidationChainState = {
        analogousNodes: [],      
        restructuredTrees: [],    
        targetNodeId: null,     
        currentIndex: 0,          
    };
    this.liquidationDialogState = {
        dragMode: 'tree',
        restructuredSubtree: null,
        sourceNodeId: null,
        targetNodeId: null, 
        sourceExpansionState: new Set(),
        targetExpansionState: new Set(),
        sortableInstances: []
    };
    const backdrop = document.createElement('div');
    backdrop.className = 'ld-backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'ld-dialog';
   dialog.innerHTML = `
    <div class="ld-header">
        <div class="ld-drag-mode-toggle" id="ld-drag-mode-toggle" title="Переключить режим перетаскивания">
            <div class="ld-toggle-option active" data-mode="tree">Всей веткой</div>
            <div class="ld-toggle-option" data-mode="single">Только узел</div>
        </div>
        <h3 id="ld-main-header">Ликвидация и реструктуризация отделов</h3>
        <div></div> <!-- Пустой div для выравнивания по центру -->
    </div>
        <div class="ld-content">
            <div class="ld-column" id="ld-source-column">
                <h4>1. Выберите исходный узел</h4>
                <input type="text" placeholder="Поиск..." class="ld-search-input" id="ld-source-search">
                <div class="ld-tree-container" id="ld-source-tree"></div>
            </div>
            <div class="ld-column" id="ld-editor-column" style="display: none;">
                <h4 id="ld-editor-header">2. Отредактируйте структуру</h4>
                <div class="ld-tree-container ld-editor-container" id="ld-editor-tree"></div>
            </div>
            <div class="ld-column" id="ld-target-column" style="display: none;">
                <h4>3. Выберите целевой узел для вставки</h4>
                <input type="text" placeholder="Поиск..." class="ld-search-input" id="ld-target-search">
                <div class="ld-tree-container" id="ld-target-tree"></div>
            </div>
        </div>
    <div class="ld-footer">
            <div>
                 <button class="ld-btn ld-back-btn" style="display: none;">← Назад к выбору</button>
                 <button class="ld-btn ld-step-back-btn" style="display: none;">↩ Шаг назад</button>
            </div>
            <div>
                <button class="ld-btn ld-cancel">Отмена</button>
                <button class="ld-btn ld-confirm" id="ld-confirm-btn" disabled>Далее</button>
            </div>
        </div>
    `;
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    const mainHeader = dialog.querySelector('#ld-main-header');
    const sourceColumn = dialog.querySelector('#ld-source-column');
    const editorColumn = dialog.querySelector('#ld-editor-column');
    const editorHeader = dialog.querySelector('#ld-editor-header');
    const targetColumn = dialog.querySelector('#ld-target-column');
    const sourceSearch = dialog.querySelector('#ld-source-search');
    const sourceTreeContainer = dialog.querySelector('#ld-source-tree');
    const targetSearch = dialog.querySelector('#ld-target-search');
    const targetTreeContainer = dialog.querySelector('#ld-target-tree');
    const confirmBtn = dialog.querySelector('#ld-confirm-btn');
    const cancelBtn = dialog.querySelector('.ld-cancel');
    const toggle = dialog.querySelector('#ld-drag-mode-toggle');
    const toggleOptions = dialog.querySelectorAll('.ld-toggle-option');
    const backBtn = dialog.querySelector('.ld-back-btn');
    const stepBackBtn = dialog.querySelector('.ld-step-back-btn'); 

    const closeDialog = () => {
        if (this.liquidationDialogState.sortableInstances) {
            this.liquidationDialogState.sortableInstances.forEach(instance => instance.destroy());
        }
        if (document.body.contains(backdrop)) {
            document.body.removeChild(backdrop);
        }
    };
    stepBackBtn.addEventListener('click', () => {
        if (this.liquidationChainState.currentIndex > 0) {
            this.liquidationChainState.currentIndex--;
            this.liquidationChainState.restructuredTrees.pop();
            const { currentIndex, analogousNodes } = this.liquidationChainState;
            const prevNode = analogousNodes[currentIndex];
            const prevState = this.liquidationChainState.restructuredTrees[currentIndex];
            this.liquidationDialogState.restructuredSubtree = JSON.parse(JSON.stringify(prevState || prevNode));
            editorHeader.textContent = `2. Редактирование ${currentIndex + 1} из ${analogousNodes.length}: "${prevNode.content.text}"`;
            this.renderEditableTree();
            confirmBtn.textContent = 'Далее';
            stepBackBtn.style.display = currentIndex > 0 ? 'inline-block' : 'none';
        }
    });
    backBtn.addEventListener('click', () => {
        if (this.liquidationDialogState.initialTreeData) {
            this.treeData = this.liquidationDialogState.initialTreeData;
            this.clusters = this.liquidationDialogState.initialClusters;
        }
        this.liquidationChainState = {
            analogousNodes: [],
            restructuredTrees: [],
            targetNodeId: null,
            currentIndex: 0,
        };
        this.liquidationDialogState.restructuredSubtree = null;
        sourceColumn.style.display = 'flex';
        editorColumn.style.display = 'none';
        targetColumn.style.display = 'none';
        backBtn.style.display = 'none';
        stepBackBtn.style.display = 'none'; 
        mainHeader.textContent = 'Ликвидация и реструктуризация отделов';
        confirmBtn.textContent = 'Далее';
        confirmBtn.disabled = true;
        redrawSourceTree();
        this.showNotification('Операция отменена. Вы вернулись к выбору узла.');
    });

    cancelBtn.addEventListener('click', () => {
        closeDialog();
        this.promptReplacementMode(); 
    });
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeDialog(); });
    toggle.addEventListener('click', () => {
        this.liquidationDialogState.dragMode = this.liquidationDialogState.dragMode === 'tree' ? 'single' : 'tree';
        toggleOptions.forEach(opt => opt.classList.toggle('active', opt.dataset.mode === this.liquidationDialogState.dragMode));
    });
    const updateConfirmButtonState = () => {
        const isTargetSelected = !!this.liquidationChainState.targetNodeId;
        confirmBtn.disabled = !isTargetSelected;
    };
    const redrawSourceTree = () => {
        const filterText = sourceSearch.value.toLowerCase().trim();
        this.createSingleSelectableTree(
            sourceTreeContainer,
            (nodeId) => {
                if (!nodeId) return;

                const node = this.findNode(this.treeData, nodeId);
                if (!node) return;
                this.liquidationDialogState.initialTreeData = JSON.parse(JSON.stringify(this.treeData));
                this.liquidationDialogState.initialClusters = new Map(this.clusters);

                this.liquidationChainState.analogousNodes = this.findAllNodesByName(this.treeData, node.content.text);
                const totalNodes = this.liquidationChainState.analogousNodes.length;

                if (totalNodes > 0) {
                    this.liquidationChainState.currentIndex = 0;
                    const firstNode = this.liquidationChainState.analogousNodes[0];
                    this.liquidationDialogState.restructuredSubtree = JSON.parse(JSON.stringify(firstNode));
                    editorHeader.textContent = `2. Редактирование ${this.liquidationChainState.currentIndex + 1} из ${totalNodes}: "${firstNode.content.text}"`;
                    editorColumn.style.display = 'flex';
                    this.renderEditableTree();
                    targetColumn.style.display = 'flex';
                    sourceColumn.style.display = 'none'; 
                    mainHeader.textContent = 'Реструктуризация по наименованию';
                    backBtn.style.display = 'inline-block';
                    stepBackBtn.style.display = 'none'; 
                    if (totalNodes === 1) {
                        confirmBtn.textContent = 'Завершить';
                    }
                }
            },
            null, this.liquidationDialogState.sourceExpansionState, filterText, false
        );
    };
    const redrawTargetTree = () => {
        const filterText = targetSearch.value.toLowerCase().trim();
        this.createSingleSelectableTree(
            targetTreeContainer,
            (nodeId) => {
                this.liquidationChainState.targetNodeId = nodeId;
                updateConfirmButtonState();
            },
            this.liquidationChainState.targetNodeId, this.liquidationDialogState.targetExpansionState, filterText, false
        );
    };
    sourceSearch.addEventListener('input', redrawSourceTree);
    targetSearch.addEventListener('input', redrawTargetTree);
    confirmBtn.addEventListener('click', () => {
        let currentStructure = this.liquidationDialogState.restructuredSubtree;
        if (currentStructure) {
            this.liquidationChainState.restructuredTrees.push(JSON.parse(JSON.stringify(currentStructure)));
        }
        this.liquidationChainState.currentIndex++;
        const { currentIndex, analogousNodes } = this.liquidationChainState;
        const totalNodes = analogousNodes.length;

        if (currentIndex < totalNodes) {
            const nextNode = analogousNodes[currentIndex];
            this.liquidationDialogState.restructuredSubtree = JSON.parse(JSON.stringify(nextNode));
            editorHeader.textContent = `2. Редактирование ${currentIndex + 1} из ${totalNodes}: "${nextNode.content.text}"`;
            this.renderEditableTree(); 
            stepBackBtn.style.display = 'inline-block';

            if (currentIndex === totalNodes - 1) {
                confirmBtn.textContent = 'Завершить';
            }
        } else {
            this.executeChainedLiquidation();
            closeDialog();
        }
    });
    redrawSourceTree();
    redrawTargetTree();
}
findNodeAndParentInSubtree(startNodeOrArray, nodeId) {
    let result = { node: null, parent: null };

    const findRecursive = (current, parent) => {
        if (current.id === nodeId) {
            result = { node: current, parent: parent };
            return true;
        }
        if (current.children) {
            for (const child of current.children) {
                if (findRecursive(child, current)) {
                    return true;
                }
            }
        }
        return false;
    };

    if (Array.isArray(startNodeOrArray)) {
        for (const rootNode of startNodeOrArray) {
            if (findRecursive(rootNode, null)) {
                break;
            }
        }
    } else if (startNodeOrArray) {
        findRecursive(startNodeOrArray, null);
    }

    return result;
}
deleteNodeAndPromoteChildrenInDialog(nodeId) {
    const { node, parent } = this.findNodeAndParentInSubtree(this.liquidationDialogState.restructuredSubtree, nodeId);

    if (!node) {
        this.showNotification('Узел не найден.', 'error');
        return;
    }
    const childrenToPromote = node.children || [];

    if (parent) {
        const index = parent.children.findIndex(child => child.id === nodeId);
        if (index !== -1) {
            parent.children.splice(index, 1, ...childrenToPromote);
        }
    } else {
        let subtree = this.liquidationDialogState.restructuredSubtree;
        if (!Array.isArray(subtree)) {
            this.liquidationDialogState.restructuredSubtree = childrenToPromote;
        } else {
            const index = subtree.findIndex(rootNode => rootNode.id === nodeId);
            if (index !== -1) {
                subtree.splice(index, 1, ...childrenToPromote);
            }
        }
    }

    this.showNotification(`Узел "${node.content.text}" удален, дочерние элементы повышены.`);
    this.normalizeAndRedrawLiquidationTree();
}
cloneSingleNode(node) {
    const clone = {
        ...node,
        content: { ...node.content }, 
        children: [], 
        id: this.generateId() 
    };
    return clone;
}
deepCloneNode(node) {
    const clone = JSON.parse(JSON.stringify(node));
    const regenerateIds = (n) => {
        n.id = this.generateId(); 
        if (n.children) {
            n.children.forEach(regenerateIds);
        }
    };
    regenerateIds(clone);
    return clone;
}
renderEditableTree() {
    const editorTreeContainer = document.getElementById('ld-editor-tree');
    if (!editorTreeContainer) return;

    if (this.liquidationDialogState && this.liquidationDialogState.sortableInstances) {
        this.liquidationDialogState.sortableInstances.forEach(instance => instance.destroy());
    }
    this.liquidationDialogState.sortableInstances = [];
    editorTreeContainer.innerHTML = '';

    if (!this.liquidationDialogState.restructuredSubtree) return;

    const createEditableNodeRecursive = (node, parentElement) => {
        const nodeEl = document.createElement('div');
        nodeEl.className = 'ld-editable-node';
        nodeEl.dataset.id = node.id;

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'ld-editable-content';

        const handle = document.createElement('span');
        handle.className = 'ld-drag-handle';
        handle.textContent = '☰';
        handle.title = 'Перетащить';
        contentWrapper.appendChild(handle);

        const span = document.createElement('span');
        span.className = 'ld-node-text';
        span.textContent = node.content.text;
        contentWrapper.appendChild(span);

        const controls = document.createElement('div');
        controls.className = 'ld-node-controls';

        const duplicateBtn = document.createElement('button');
        duplicateBtn.className = 'ld-node-btn';
        duplicateBtn.innerHTML = '⎘'; 
        duplicateBtn.title = 'Дублировать узел (с дочерними)';
        duplicateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.duplicateNodeInDialog(node.id); 
        });
        controls.appendChild(duplicateBtn);
        const promoteDeleteBtn = document.createElement('button');
        promoteDeleteBtn.className = 'ld-node-btn';
        promoteDeleteBtn.innerHTML = '⏏';
        promoteDeleteBtn.title = 'Удалить узел, подняв дочерние';
        promoteDeleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteNodeAndPromoteChildrenInDialog(node.id);
        });
        controls.appendChild(promoteDeleteBtn);

        contentWrapper.appendChild(controls);


        nodeEl.appendChild(contentWrapper);

        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'ld-editable-children';
        nodeEl.appendChild(childrenContainer);

        parentElement.appendChild(nodeEl);

        const sortableOptions = {
            group: 'liquidation-group',
            animation: 150,
            handle: '.ld-drag-handle',
            fallbackOnBody: true,
            swapThreshold: 0.65,
            ghostClass: "ld-ghost-base",
            dragClass: "sortable-drag",
            onStart: (evt) => {
                if (this.liquidationDialogState.dragMode === 'single') {
                    evt.item.classList.add('single-drag-visual');
                } else {
                    evt.item.classList.remove('single-drag-visual');
                }
            },
            onEnd: (evt) => this.handleDragEnd(evt),
        };

        const sortableChildren = new Sortable(childrenContainer, sortableOptions);
        this.liquidationDialogState.sortableInstances.push(sortableChildren);

        if (node.children && node.children.length > 0) {
            node.children.forEach(child => createEditableNodeRecursive(child, childrenContainer));
        }
    };

    const rootSortableOptions = {
        group: 'liquidation-group',
        animation: 150,
        handle: '.ld-drag-handle',
        fallbackOnBody: true,
        swapThreshold: 0.65,
        ghostClass: "ld-ghost-base",
        dragClass: "sortable-drag",
        onStart: (evt) => {
            if (this.liquidationDialogState.dragMode === 'single') {
                evt.item.classList.add('single-drag-visual');
            } else {
                evt.item.classList.remove('single-drag-visual');
            }
        },
        onEnd: (evt) => this.handleDragEnd(evt),
    };

    const sortableRoot = new Sortable(editorTreeContainer, rootSortableOptions);
    this.liquidationDialogState.sortableInstances.push(sortableRoot);

    let subtree = this.liquidationDialogState.restructuredSubtree;
    if (Array.isArray(subtree)) {
        subtree.forEach(node => createEditableNodeRecursive(node, editorTreeContainer));
    } else if (subtree) {
        createEditableNodeRecursive(subtree, editorTreeContainer);
    }
}
duplicateNodeInDialog(nodeId) {
    const { node, parent } = this.findNodeAndParentInSubtree(this.liquidationDialogState.restructuredSubtree, nodeId);

    if (!node) {
        this.showNotification('Не удалось найти узел для дублирования.', 'error');
        return;
    }
    const clonedNode = this.deepCloneNode(node);

    if (parent) {
        const index = parent.children.findIndex(child => child.id === nodeId);
        if (index !== -1) {
            parent.children.splice(index + 1, 0, clonedNode);
        }
    } else {
        let subtree = this.liquidationDialogState.restructuredSubtree;
        if (Array.isArray(subtree)) {
            const index = subtree.findIndex(rootNode => rootNode.id === nodeId);
            if (index !== -1) {
                subtree.splice(index + 1, 0, clonedNode);
            }
        } else {
            this.liquidationDialogState.restructuredSubtree = [subtree, clonedNode];
        }
    }

    this.showNotification(`Узел "${node.content.text}" дублирован.`);
    this.normalizeAndRedrawLiquidationTree();
}
resetNodeLevel(nodeId) {
    const { node, parent } = this.findNodeAndParentInSubtree(this.liquidationDialogState.restructuredSubtree, nodeId);
    if (!node) return;

    let subtree = this.liquidationDialogState.restructuredSubtree;
    if (!Array.isArray(subtree)) {
        subtree = [subtree];
    }

    if (parent) { 
        const grandparent = this.findNodeAndParentInSubtree(this.liquidationDialogState.restructuredSubtree, parent.id).parent;
        const nodeIndex = parent.children.findIndex(child => child.id === nodeId);
        const [nodeToMove] = parent.children.splice(nodeIndex, 1);

        if (grandparent) {
            const parentIndex = grandparent.children.findIndex(p => p.id === parent.id);
            grandparent.children.splice(parentIndex + 1, 0, nodeToMove);
        } else {
            const parentIndex = subtree.findIndex(p => p.id === parent.id);
            subtree.splice(parentIndex + 1, 0, nodeToMove);
        }
        this.showNotification(`"${node.content.text}" перемещен на уровень выше`);
    } else { 
        const nodeIndex = subtree.findIndex(n => n.id === nodeId);

        if (nodeIndex < subtree.length - 1) {
            [subtree[nodeIndex], subtree[nodeIndex + 1]] = [subtree[nodeIndex + 1], subtree[nodeIndex]];
            this.showNotification(`"${node.content.text}" перемещен вправо`);
        } else if (subtree.length > 1) {
            const [nodeToMove] = subtree.splice(nodeIndex, 1);
            subtree.unshift(nodeToMove);
            this.showNotification(`"${node.content.text}" перемещен в начало списка`);
        }
    }
    this.liquidationDialogState.restructuredSubtree = subtree;
    this.normalizeAndRedrawLiquidationTree();
}
demoteNodeLevel(nodeId) {
    const { node, parent } = this.findNodeAndParentInSubtree(this.liquidationDialogState.restructuredSubtree, nodeId);
    if (!node) return;

    let subtree = this.liquidationDialogState.restructuredSubtree;
    if (!Array.isArray(subtree)) {
        subtree = [subtree];
    }

    if (parent) { 
        const siblings = parent.children;
        const nodeIndex = siblings.findIndex(n => n.id === nodeId);

        if (nodeIndex > 0) {
            const newParent = siblings[nodeIndex - 1];
            if (!newParent.children) newParent.children = [];
            const [nodeToMove] = siblings.splice(nodeIndex, 1);
            newParent.children.push(nodeToMove);
            this.showNotification(`"${node.content.text}" стал дочерним для "${newParent.content.text}"`);
        } else {
            const grandparent = this.findNodeAndParentInSubtree(this.liquidationDialogState.restructuredSubtree, parent.id).parent;
            const [nodeToMove] = siblings.splice(nodeIndex, 1);

            if (grandparent) {
                const parentIndex = grandparent.children.findIndex(p => p.id === parent.id);
                grandparent.children.splice(parentIndex, 0, nodeToMove);
            } else {
                const parentIndex = subtree.findIndex(p => p.id === parent.id);
                subtree.splice(parentIndex, 0, nodeToMove);
            }
            this.showNotification(`"${node.content.text}" перемещен на уровень выше`);
        }
    } else { 
        const nodeIndex = subtree.findIndex(n => n.id === nodeId);

        if (nodeIndex > 0) {
            [subtree[nodeIndex], subtree[nodeIndex - 1]] = [subtree[nodeIndex - 1], subtree[nodeIndex]];
            this.showNotification(`"${node.content.text}" перемещен влево`);
        } else if (subtree.length > 1) {
            const [nodeToMove] = subtree.splice(nodeIndex, 1);
            subtree.push(nodeToMove);
            this.showNotification(`"${node.content.text}" перемещен в конец списка`);
        }
    }

    this.liquidationDialogState.restructuredSubtree = subtree;
    this.normalizeAndRedrawLiquidationTree();
}
handleNativeDrop(evt, dropZoneElement) {
    evt.preventDefault();
    evt.stopPropagation();

    const draggedNodeId = parseInt(evt.dataTransfer.getData("text/plain"), 10);

    const { node: draggedNode, parent: oldParent } = this.findNodeAndParentInSubtree(this.liquidationDialogState.restructuredSubtree, draggedNodeId);

    if (!draggedNode) {
        console.error("Перетаскиваемый узел не найден.");
        return;
    }

 
    const targetNodeElement = dropZoneElement.closest('.ld-editable-node');
    let targetNode = null;

    if (targetNodeElement) {
        const targetNodeId = parseInt(targetNodeElement.dataset.id, 10);

        if (targetNodeId === draggedNodeId) {
            return;
        }
        const potentialTargetNode = this.findNodeAndParentInSubtree(this.liquidationDialogState.restructuredSubtree, targetNodeId).node;
        if (this.isDescendant(draggedNode, targetNodeId)) {
             this.showNotification("Ошибка: Нельзя переместить родительский узел внутрь дочернего.", "error");
             return;
        }
        targetNode = potentialTargetNode;
    }

    const isTreeDrag = this.liquidationDialogState.currentDragIsTree || false;

    if (isTreeDrag) {
        if (oldParent) {
            oldParent.children = oldParent.children.filter(child => child.id !== draggedNodeId);
        } else {
            let subtree = this.liquidationDialogState.restructuredSubtree;
            if (Array.isArray(subtree)) {
                this.liquidationDialogState.restructuredSubtree = subtree.filter(n => n.id !== draggedNodeId);
            } else if (subtree && subtree.id === draggedNodeId) {
                this.liquidationDialogState.restructuredSubtree = null;
            }
        }
        if (targetNode) {
            if (!targetNode.children) {
                targetNode.children = [];
            }
            targetNode.children.push(draggedNode);
        } else {
            let subtree = this.liquidationDialogState.restructuredSubtree;
            if (!Array.isArray(subtree)) {
                subtree = subtree ? [subtree] : [];
            }
            subtree.push(draggedNode);
            this.liquidationDialogState.restructuredSubtree = subtree;
        }
    } else {
        const childrenToPromote = draggedNode.children || [];
        if (oldParent) {
            const index = oldParent.children.findIndex(child => child.id === draggedNodeId);
            if (index !== -1) {
                oldParent.children.splice(index, 1, ...childrenToPromote);
            }
        } else {
            let subtree = this.liquidationDialogState.restructuredSubtree;
            if (Array.isArray(subtree)) {
                const index = subtree.findIndex(n => n.id === draggedNodeId);
                if (index !== -1) {
                    subtree.splice(index, 1, ...childrenToPromote);
                }
            } else if (subtree && subtree.id === draggedNodeId) {
                this.liquidationDialogState.restructuredSubtree = childrenToPromote;
            }
        }
        const nodeToMove = { ...draggedNode, children: [] };
        if (targetNode) {
            if (!targetNode.children) {
                targetNode.children = [];
            }
            targetNode.children.push(nodeToMove);
        } else {
            let subtree = this.liquidationDialogState.restructuredSubtree;
            if (!Array.isArray(subtree)) {
                subtree = subtree ? [subtree] : [];
            }
            subtree.push(nodeToMove);
            this.liquidationDialogState.restructuredSubtree = subtree;
        }
    }
    this.liquidationDialogState.currentDragIsTree = false;
    this.normalizeAndRedrawLiquidationTree();
}
replaceNodeWithItsChildrenInDialog(nodeId) {
    const { node, parent } = this.findNodeAndParentInSubtree(this.liquidationDialogState.restructuredSubtree, nodeId);
    if (!node) return; 
    const childrenToPromote = node.children || [];

    if (parent) {
        const index = parent.children.findIndex(child => child.id === nodeId);
        if (index !== -1) {
            parent.children.splice(index, 1, ...childrenToPromote);
        }
    } else {
        let subtree = this.liquidationDialogState.restructuredSubtree;
        if (Array.isArray(subtree)) {
            const index = subtree.findIndex(n => n.id === nodeId);
            if (index !== -1) {
                subtree.splice(index, 1, ...childrenToPromote);
            }
        } else if (subtree && subtree.id === nodeId) {
            this.liquidationDialogState.restructuredSubtree = childrenToPromote;
        }
    }
}
handleDragEnd(evt) {
    evt.preventDefault();
    evt.stopPropagation();

    const isTreeDrag = this.liquidationDialogState.dragMode === 'tree';
    const itemId = parseInt(evt.item.dataset.id, 10);
    const oldIndex = evt.oldDraggableIndex;
    const newIndex = evt.newDraggableIndex;
    const oldParentEl = evt.from.closest('.ld-editable-node');
    const newParentEl = evt.to.closest('.ld-editable-node');
    const oldParentId = oldParentEl ? parseInt(oldParentEl.dataset.id, 10) : null;
    const newParentId = newParentEl ? parseInt(newParentEl.dataset.id, 10) : null;
    const { node: draggedNodeData } = this.findNodeAndParentInSubtree(this.liquidationDialogState.restructuredSubtree, itemId);
    if (newParentId && draggedNodeData && this.isDescendant(draggedNodeData, newParentId)) {
        this.showNotification("Ошибка: Нельзя переместить родительский узел внутрь дочернего.", "error");
        evt.from.insertBefore(evt.item, evt.from.children[evt.oldIndex]);
        return;
    }
    let draggedNode;
    if (oldParentId) {
        const { node: oldParent } = this.findNodeAndParentInSubtree(this.liquidationDialogState.restructuredSubtree, oldParentId);
        if (oldParent && oldParent.children) {
            [draggedNode] = oldParent.children.splice(oldIndex, 1);
        }
    } else {
        let subtree = this.liquidationDialogState.restructuredSubtree;
        if (Array.isArray(subtree)) {
            [draggedNode] = subtree.splice(oldIndex, 1);
        } else if (subtree && subtree.id === itemId) {
            draggedNode = this.liquidationDialogState.restructuredSubtree;
            this.liquidationDialogState.restructuredSubtree = []; 
        }
    }
    if (!draggedNode) {
        console.error("Не удалось найти перетаскиваемый узел в структуре данных. Отмена операции.");
        evt.from.insertBefore(evt.item, evt.from.children[evt.oldIndex]);
        return;
    }
    if (!isTreeDrag) {
        const childrenToPromote = draggedNode.children || [];
        draggedNode.children = []; 
        if (oldParentId) {
            const { node: oldParent } = this.findNodeAndParentInSubtree(this.liquidationDialogState.restructuredSubtree, oldParentId);
            if (oldParent && oldParent.children) {
                oldParent.children.splice(oldIndex, 0, ...childrenToPromote);
            }
        } else {
            let subtree = this.liquidationDialogState.restructuredSubtree;
            if (!Array.isArray(subtree)) subtree = subtree ? [subtree] : [];
            subtree.splice(oldIndex, 0, ...childrenToPromote);
            this.liquidationDialogState.restructuredSubtree = subtree;
        }
    }
    if (newParentId) {
        const { node: newParent } = this.findNodeAndParentInSubtree(this.liquidationDialogState.restructuredSubtree, newParentId);
        if (newParent) {
            if (!newParent.children) newParent.children = [];
            newParent.children.splice(newIndex, 0, draggedNode);
        }
    } else {
        let subtree = this.liquidationDialogState.restructuredSubtree;
        if (!Array.isArray(subtree)) subtree = subtree ? [subtree] : [];
        subtree.splice(newIndex, 0, draggedNode);
        this.liquidationDialogState.restructuredSubtree = subtree;
    }
    this.normalizeAndRedrawLiquidationTree();
}
normalizeAndRedrawLiquidationTree() {
    let finalSubtree = this.liquidationDialogState.restructuredSubtree;
    if (Array.isArray(finalSubtree) && finalSubtree.length === 1) {
        this.liquidationDialogState.restructuredSubtree = finalSubtree[0];
    } else if (Array.isArray(finalSubtree) && finalSubtree.length === 0) {
        this.liquidationDialogState.restructuredSubtree = null;
    }

    this.showNotification('Структура в редакторе обновлена');
    this.renderEditableTree();
}
isDescendant(node, ancestorId) {
    if (node.id === ancestorId) return true;

    for (const child of node.children) {
        if (this.isDescendant(child, ancestorId)) {
            return true;
        }
    }
    return false;
}
executeChainedLiquidation() {
    this.saveToHistory(false, true);

    const { analogousNodes, restructuredTrees, targetNodeId } = this.liquidationChainState;

    const targetNode = this.findNode(this.treeData, targetNodeId);
    if (!targetNode) {
        this.showNotification("Ошибка: Целевой узел не найден.", "error");
        return;
    }
    const originalNodeIds = new Set(analogousNodes.map(node => node.id));
    const removeRecursive = (parent) => {
        parent.children = parent.children.filter(child => !originalNodeIds.has(child.id));
        parent.children.forEach(removeRecursive);
    };
    removeRecursive(this.treeData);
    if (!targetNode.children) {
        targetNode.children = [];
    }

    restructuredTrees.forEach(treeToInsert => {
        const clonedTree = this.deepCloneNode(treeToInsert);
        const nodesToInsert = Array.isArray(clonedTree) ? clonedTree : [clonedTree];
        targetNode.children.push(...nodesToInsert);
    });

    targetNode.isExpanded = true;

    this.logAction(`Массовая реструктуризация для "${analogousNodes[0].content.text}": ${analogousNodes.length} узлов перенесено в "${targetNode.content.text}"`);
    this.showNotification(`Операция завершена: ${analogousNodes.length} структур успешно перенесено.`);
    this.updateTree();
    this.saveData();
}
executeLiquidation() {
    console.warn("Вызвана устаревшая функция executeLiquidation. Используйте executeChainedLiquidation.");
}
findAllNodesByName(startNode, name) {
    let results = [];
    const findRecursive = (node) => {
        if (node.content.text === name) {
            results.push(node);
        }
        if (node.children) {
            node.children.forEach(findRecursive);
        }
    };
    findRecursive(startNode);
    return results;
}
async confirmMassRestructure(nodeName, count) {
    return new Promise(resolve => {
        if (document.getElementById('mass-restructure-confirm-dialog')) {
            resolve(false);
            return;
        }

        const backdrop = document.createElement('div');
        backdrop.id = 'mass-restructure-confirm-dialog';
        backdrop.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.6); display: flex; justify-content: center;
            align-items: center; z-index: 10005; backdrop-filter: blur(5px);
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: var(--controls-bg); padding: 25px; border-radius: 12px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.25); text-align: center;
            border: 1px solid var(--primary-color); animation: dialog-appear 0.3s ease-out;
            max-width: 450px;
        `;

        dialog.innerHTML = `
            <h3 style="margin-top: 0; color: var(--primary-color);">Массовая реструктуризация</h3>
            <p>Найдены другие узлы (${count} шт.) с таким же именем: "<strong>${nodeName}</strong>".</p>
            <p>Применить выполненную реструктуризацию ко всем этим узлам?</p>
            <div style="display: flex; justify-content: center; gap: 15px; margin-top: 25px;">
                <button id="confirm-yes" class="ld-btn ld-confirm">Да, применить ко всем</button>
                <button id="confirm-no" class="ld-btn ld-cancel">Нет, только этот</button>
            </div>
        `;

        const closeDialog = (result) => {
            document.body.removeChild(backdrop);
            resolve(result);
        };

        dialog.querySelector('#confirm-yes').addEventListener('click', () => closeDialog(true));
        dialog.querySelector('#confirm-no').addEventListener('click', () => closeDialog(false));
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closeDialog(false);
        });

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);
    });
}
injectLiquidationDialogStyles() {
    if (document.getElementById('liquidation-dialog-styles')) return;
    const style = document.createElement('style');
    style.id = 'liquidation-dialog-styles';
    style.textContent = `
    .ld-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10002;
        backdrop-filter: blur(8px);
    }

    .ld-dialog {
        background: var(--controls-bg);
        padding: 20px;
        width: 95vw;
        height: 90vh;
        box-sizing: border-box;
        border-radius: 16px;
        border: 2px solid var(--primary-color);
        display: flex;
        flex-direction: column;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }
    .ld-header {
        display: flex;
        justify-content: space-between; /* Распределяет элементы по краям */
        align-items: center;
        margin-bottom: 15px;
        color: var(--primary-color);
    }

    .ld-header h3 {
        margin: 0;
        text-align: center;
        flex-grow: 1; /* Позволяет заголовку занять центральное пространство */
    }
    .ld-drag-mode-toggle {
        display: flex;
        align-items: center;
        background-color: rgba(93, 138, 168, 0.1);
        border-radius: 20px;
        padding: 4px;
        cursor: pointer;
        user-select: none;
        border: 1px solid var(--primary-color);
    }

    .ld-toggle-option {
        padding: 6px 12px;
        border-radius: 16px;
        font-size: 0.9em;
        font-weight: 500;
        transition: all 0.3s ease;
    }

    .ld-toggle-option.active {
        background-color: var(--primary-color);
        color: white;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .ld-content {
        display: flex;
        gap: 15px;
        flex: 1;
        min-height: 0;
    }

    .ld-column {
        display: flex;
        flex-direction: column;
        gap: 10px;
        flex: 1;
        min-width: 300px;
    }

    .ld-search-input {
        padding: 8px;
        border: 1px solid var(--secondary-color);
        border-radius: 4px;
        width: 100%;
        box-sizing: border-box;
    }

    .ld-tree-container {
        border: 1px solid var(--secondary-color);
        border-radius: 8px;
        padding: 10px;
        flex: 1;
        max-height: 65vh;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: var(--primary-color) transparent;
    }

    .ld-footer {
        margin-top: 15px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .ld-btn {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s ease;
    }

    .ld-btn:disabled {
        background: #ccc !important;
        cursor: not-allowed;
    }

    .ld-btn.ld-confirm {
        background: #4CAF50;
        color: white;
    }

    .ld-btn.ld-cancel {
        background: transparent;
        color: var(--accent-color);
    }

    .ld-editor-container .ld-editable-node {
        padding: 2px;
        margin: 2px 0;
    }

    .ld-editable-content {
        display: flex;
        align-items: center;
        padding: 5px;
        background: rgba(93, 138, 168, 0.1);
        border-radius: 4px;
    }

    .ld-node-text {
        flex-grow: 1;
        margin-left: 8px;
    }

    .ld-node-controls {
        display: flex;
        gap: 5px;
    }

    .ld-node-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 1.2em;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background-color 0.2s;
    }

    .ld-node-btn:hover {
        background-color: rgba(93, 138, 168, 0.2);
    }

    .ld-drag-handle {
        padding: 0 8px;
        color: var(--primary-color);
        font-size: 1.4em;
        cursor: grab;
        touch-action: none;
    }

    .ld-drag-handle:active {
        cursor: grabbing;
    }

    .ld-editable-children {
        margin-left: 25px;
        padding-left: 10px;
        border-left: 2px dashed rgba(93, 138, 168, 0.2);
        min-height: 5px;
    }

    .ld-ghost-base {
        opacity: 0.7;
        border: 2px dashed var(--accent-color);
        background-color: rgba(255, 160, 122, 0.2);
    }

    .ld-ghost-base .ld-editable-children {
        display: none !important;
    }

    .sortable-drag {
        opacity: 0.9 !important;
        transform: rotate(2deg);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    }

    .sortable-drag.single-drag-visual .ld-editable-children {
        display: none !important;
    }
        /* --- ✨ КОНЕЦ ИЗМЕНЕНИЙ --- */
    `;
    document.head.appendChild(style);
}
restructureAndPruneTree(currentNode, selectedIds) {
    if (currentNode.children && currentNode.children.length > 0) {
        const newChildren = [];
        currentNode.children.forEach(child => {
            const resultOfChildProcessing = this.restructureAndPruneTree(child, selectedIds);
            newChildren.push(...resultOfChildProcessing);
        });
        currentNode.children = newChildren;
    }
    if (selectedIds.has(currentNode.id)) {
        return currentNode.children || [];
    } else {
        return [currentNode];
    }
}
applyPositionToNodes(position, targetNodeId) {
    const targetNode = this.findNode(this.treeData, targetNodeId);
    if (!targetNode) return;

    this.saveToHistory(false, true);

    const targetName = targetNode.content.text;
    let updatedCount = 0;

    const updateRecursive = (node) => {
        if (node.content.text === targetName) {
            node.content.position = position;
            updatedCount++;
        }
        node.children.forEach(updateRecursive);
    };

    updateRecursive(this.treeData);

    this.logAction(`Установлена должность "${position}" для ${updatedCount} узлов с наименованием "${targetName}"`);
    this.updateTree();
    this.saveData();
    this.showNotification(`Должность "${position}" применена к ${updatedCount} узлам`);
}
async showLimitedReplacementDialog() {
    const expansionStates = new Map();
    const filterStates = new Map();

    if (!document.getElementById('limited-replacement-styles')) {
        const style = document.createElement('style');
        style.id = 'limited-replacement-styles';
        style.textContent = `
            .lr-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 10002; backdrop-filter: blur(5px); }
            .lr-dialog { background: var(--controls-bg); padding: 20px; width: 100vw; height: 100vh; box-sizing: border-box; border-radius: 0; border: none; display: flex; flex-direction: column; }
            .lr-header { text-align: center; margin-bottom: 15px; color: var(--primary-color); }
            .lr-content { display: flex; gap: 15px; flex: 1; min-height: 0; }
            .lr-column { display: flex; flex-direction: column; gap: 10px; flex: 1; min-width: 500px; }
            .lr-search-input { padding: 8px; border: 1px solid var(--secondary-color); border-radius: 4px; width: 100%; box-sizing: border-box; margin-bottom: 5px; }
            .lr-tree-container { border: 1px solid var(--secondary-color); border-radius: 8px; padding: 10px; flex: 1; overflow-y: auto; }
            .lr-footer { margin-top: 15px; display: flex; justify-content: space-between; align-items: center; }
            .lr-actions { display: flex; gap: 10px; }
            .lr-btn { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; transition: all 0.2s ease; }
            .lr-btn:disabled { background: #ccc !important; cursor: not-allowed; }
            .lr-btn.replace-delete { background: #FFA500; color: white; }
            .lr-btn.cycle { background: #00BFFF; color: white; }
            .lr-btn.cancel { background: transparent; color: var(--accent-color); }
            .lr-tooltip { position: relative; display: inline-block; }
            .lr-tooltip .lr-tooltiptext { visibility: hidden; width: 220px; background-color: #555; color: #fff; text-align: center; border-radius: 6px; padding: 5px 0; position: absolute; z-index: 1; bottom: 125%; left: 50%; margin-left: -110px; opacity: 0; transition: opacity 0.3s; }
            .lr-tooltip:hover .lr-tooltiptext { visibility: visible; opacity: 1; }
        `;
        document.head.appendChild(style);
    }
    const backdrop = document.createElement('div');
    backdrop.className = 'lr-backdrop';
    const dialog = document.createElement('div');
    dialog.className = 'lr-dialog';
    dialog.innerHTML = `
        <div class="lr-header"><h3>Ограниченная замена</h3></div>
        <div class="lr-content" id="lr-content-area"></div>
        <div class="lr-footer">
            <button class="lr-btn cancel">Отмена</button>
            <div class="lr-actions">
                <div class="lr-tooltip">
                    <button class="lr-btn replace-delete" id="lr-replace-delete-btn" disabled>Заменить с удалением</button>
                    <span class="lr-tooltiptext">Действует только для узла без дочерних элементов.</span>
                </div>
                <button class="lr-btn cycle" id="lr-cycle-btn">Круговорот</button>
            </div>
        </div>
    `;
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    const contentArea = dialog.querySelector('#lr-content-area');
    let selectedNodes = new Map();

    const renderColumns = () => {
        contentArea.innerHTML = '';
        for (let i = 1; i <= 2; i++) {
            if (!expansionStates.has(i)) expansionStates.set(i, new Set());

            const column = document.createElement('div');
            column.className = 'lr-column';
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.placeholder = `Поиск в списке №${i}...`;
            searchInput.className = 'lr-search-input';
            searchInput.value = filterStates.get(i) || '';
            const treeContainer = document.createElement('div');
            treeContainer.className = 'lr-tree-container';

            column.appendChild(searchInput);
            column.appendChild(treeContainer);
            contentArea.appendChild(column);

            const redrawTree = () => {
                const filterText = searchInput.value.toLowerCase().trim();
                filterStates.set(i, searchInput.value);

                const isFirstColumn = (i === 1);
                const autoExpand = true;

                this.createSingleSelectableTree(
                    treeContainer,
                    (nodeId) => {
                        selectedNodes.set(i, nodeId);
                        updateButtonStates();
                    },
                    selectedNodes.get(i),
                    expansionStates.get(i),
                    filterText,
                    isFirstColumn,
                    null,
                    null,
                    autoExpand 
                );
            };

            searchInput.addEventListener('input', redrawTree);
            redrawTree();
        }
    };
    const updateButtonStates = () => {
        const replaceDeleteBtn = dialog.querySelector('#lr-replace-delete-btn');
        const node1Id = selectedNodes.get(1);
        if (node1Id) {
            const node1 = this.findNode(this.treeData, node1Id);
            replaceDeleteBtn.disabled = !(node1 && node1.children.length === 0);
        } else {
            replaceDeleteBtn.disabled = true;
        }
    };

    const closeDialog = () => document.body.removeChild(backdrop);
    dialog.querySelector('.lr-btn.cancel').addEventListener('click', () => {
        closeDialog();
        this.promptReplacementMode(); 
    });
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeDialog(); });

    dialog.querySelector('#lr-replace-delete-btn').addEventListener('click', () => {
        const sourceNodeId = selectedNodes.get(1);
        const targetNodeId = selectedNodes.get(2);
        if (!sourceNodeId || !targetNodeId) {
            this.showNotification('Нужно выбрать оба узла', 'error');
            return;
        }
        this.executeReplaceAndDelete(sourceNodeId, targetNodeId);
        closeDialog();
    });

    dialog.querySelector('#lr-cycle-btn').addEventListener('click', () => {
        const node1Id = selectedNodes.get(1);
        const node2Id = selectedNodes.get(2);
        if (!node1Id || !node2Id) {
            this.showNotification('Нужно выбрать оба узла', 'error');
            return;
        }
        this.executeCycle(node1Id, node2Id);
        closeDialog();
    });

    renderColumns();
    updateButtonStates();
}
executeReplaceAndDelete(sourceNodeId, targetNodeId) {
    const sourceNode = this.findNode(this.treeData, sourceNodeId);
    const targetNode = this.findNode(this.treeData, targetNodeId);
    if (!sourceNode || !targetNode) return;
    if (sourceNode.content.text === targetNode.content.text) {
        this.showNotification('Нельзя выбирать узлы с одинаковыми названиями.', 'error');
        return;
    }
    if (sourceNode.content.isIndicator || sourceNode.content.isOKR || targetNode.content.isIndicator || targetNode.content.isOKR) {
        this.showNotification('Нельзя использовать в замене узлы типа "Гос. программа" или "OKR".', 'error');
        return;
    }
    if (sourceNode.children.length > 0) {
        this.showNotification('Исходный узел не должен иметь дочерних элементов для этой операции.', 'error');
        return;
    }

    this.saveToHistory(false, true);

    const sourceContentCopy = JSON.parse(JSON.stringify(sourceNode.content));
    const targetName = targetNode.content.text;
    let replacementCount = 0;

const replaceRecursive = (node) => {
    if (node.content.text === targetName) {
        const originalFiles = node.content.files || [];
        const originalSubBlocks = node.content.subBlocks || [];
        const originalPosition = node.content.position || null; 
        const originalSpecialFlags = {
            isSubordinate: node.content.isSubordinate, isPower269: node.content.isPower269,
            absent269: node.content.absent269, isForAll: node.content.isForAll,
            isAuthority: node.content.isAuthority, isOKR: node.content.isOKR, isIndicator: node.content.isIndicator
        };
        const originalCluster = this.clusters.get(node.id);
        node.content = JSON.parse(JSON.stringify(sourceContentCopy));
        node.content.isHorizontal = true; 
        node.content.files = originalFiles;
        node.content.subBlocks = originalSubBlocks;
        node.content.position = originalPosition; 
        Object.assign(node.content, originalSpecialFlags);
        if (originalCluster) {
            this.clusters.set(node.id, originalCluster);
        }

        node.circularlyReplaced = true;
        replacementCount++;
    }
    node.children.forEach(replaceRecursive);
};
    replaceRecursive(this.treeData);
    const parent = this.findParent(this.treeData, sourceNodeId);
    if (parent) {
        parent.children = parent.children.filter(child => child.id !== sourceNodeId);
    }
    this.logAction(`Замена с удалением: Узел "${targetName}" заменен на "${sourceNode.content.text}" (${replacementCount} раз), исходник удален.`);
    this.updateTree();
    this.saveData();
    this.showNotification('Замена с удалением успешно выполнена!');
}
executeCycle(node1Id, node2Id) {
    const node1 = this.findNode(this.treeData, node1Id);
    const node2 = this.findNode(this.treeData, node2Id);

    if (!node1 || !node2) return;
    if (node1.content.text === node2.content.text) {
        this.showNotification('Нельзя выбирать узлы с одинаковыми названиями.', 'error');
        return;
    }
    if (node1.content.isIndicator || node1.content.isOKR || node2.content.isIndicator || node2.content.isOKR) {
        this.showNotification('Нельзя использовать в замене узлы типа "Гос. программа" или "OKR".', 'error');
        return;
    }

    this.saveToHistory(false, true);

    const name1 = node1.content.text;
    const name2 = node2.content.text;

    const content1Copy = JSON.parse(JSON.stringify(node1.content));
    const content2Copy = JSON.parse(JSON.stringify(node2.content));

    const swapRecursive = (node) => {
        const originalDataToPreserve = {
            files: node.content.files || [],
            subBlocks: node.content.subBlocks || [],
position: node.content.position || null, 
            isSubordinate: node.content.isSubordinate,
            isPower269: node.content.isPower269,
            absent269: node.content.absent269,
            isForAll: node.content.isForAll,
            isAuthority: node.content.isAuthority,
            isOKR: node.content.isOKR,
            isIndicator: node.content.isIndicator
        };

        let swapped = false;

        if (node.content.text === name1) {
            node.content = JSON.parse(JSON.stringify(content2Copy));
            swapped = true;
        } else if (node.content.text === name2) {
            node.content = JSON.parse(JSON.stringify(content1Copy));
            swapped = true;
        }

        if (swapped) {
            
            Object.assign(node.content, originalDataToPreserve);

            
            node.content.isHorizontal = true;
            node.circularlyReplaced = true;
        }

        
        node.children.forEach(swapRecursive);
    };

    swapRecursive(this.treeData);

    this.logAction(`Круговорот: Узлы "${name1}" и "${name2}" массово поменялись местами (с фото и пометками).`);
    this.updateTree();
    this.saveData();
    this.showNotification('Круговорот (с фото и пометками) успешно выполнен!');
}
showRestructureDialog() {
    if (!document.getElementById('restructure-dialog-styles')) {
        const style = document.createElement('style');
        style.id = 'restructure-dialog-styles';
        style.textContent = `
            .rs-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 10002; backdrop-filter: blur(5px); }
            .rs-dialog { background: var(--controls-bg); padding: 20px; width: 100vw; height: 100vh; box-sizing: border-box; display: flex; flex-direction: column; }
            .rs-header { display: flex; justify-content: center; align-items: center; position: relative; text-align: center; margin-bottom: 15px; color: var(--primary-color); flex-shrink: 0; }
            .rs-column-controls { position: absolute; right: 20px; top: 50%; transform: translateY(-50%); display: flex; gap: 8px; }
            .rs-column-btn { background: #4CAF50; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; font-size: 20px; font-weight: bold; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; }
            .rs-column-btn:hover:not(:disabled) { transform: scale(1.1); }
            .rs-column-btn:disabled { background: #ccc; cursor: not-allowed; }
            .rs-remove-column-btn { background: #d32f2f; }
            .rs-content { display: flex; gap: 15px; flex: 1; min-height: 0; }
            .rs-column { display: flex; flex-direction: column; gap: 10px; flex: 1; min-width: 0; }
            .rs-search-input { padding: 8px; border: 1px solid var(--secondary-color); border-radius: 4px; width: 100%; box-sizing: border-box; margin-bottom: 5px; }
            .rs-tree-container { border: 1px solid var(--secondary-color); border-radius: 8px; padding: 10px; flex: 1; overflow-y: auto; }
            .rs-target-header { display: flex; justify-content: center; align-items: center; gap: 15px; }
            .rs-target-nav-btn { background: var(--primary-color); color: white; border: none; border-radius: 50%; width: 28px; height: 28px; font-size: 18px; cursor: pointer; }
            .rs-target-nav-btn:disabled { background: #ccc; cursor: not-allowed; }
            .rs-target-title { font-weight: bold; color: var(--primary-color); }
            .rs-footer { margin-top: 15px; display: flex; justify-content: flex-end; gap: 10px; }
            .rs-btn { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; }
            .rs-btn.ok { background: var(--primary-color); color: white; }
            .rs-btn.cancel { background: #d32f2f; color: white; }
            .tree-selection-node.selected-target { background-color: rgba(93, 138, 168, 0.2); border-radius: 4px; }
            .rs-confirm-selection-btn { background: #2196F3; color: white; border: none; border-radius: 6px; padding: 8px 12px; cursor: pointer; margin-top: 10px; width: 100%; font-weight: 500; transition: background-color 0.2s; }
            .rs-confirm-selection-btn:hover { background: #1976D2; }
            .rs-confirm-selection-btn:disabled { background: #ccc; cursor: not-allowed; }
        `;
        document.head.appendChild(style);
    }
    const backdrop = document.createElement('div');
    backdrop.className = 'rs-backdrop';
    const dialog = document.createElement('div');
    dialog.className = 'rs-dialog';
    dialog.innerHTML = `
        <div class="rs-header">
            <h3>Реструктуризация узла</h3>
            <div class="rs-column-controls">
                <button class="rs-column-btn rs-remove-column-btn" id="rs-remove-column-btn" title="Убрать колонку выбора">-</button>
                <button class="rs-column-btn rs-add-column-btn" id="rs-add-column-btn" title="Добавить колонку выбора">+</button>
            </div>
        </div>
        <div class="rs-content">
            <div class="rs-column" id="rs-target-column-wrapper">
                <div class="rs-target-header">
                    <button class="rs-target-nav-btn" id="rs-target-prev-btn" title="Предыдущая цель">⬅️</button>
                    <h4 class="rs-target-title" id="rs-target-title-text">Целевой узел</h4>
                    <button class="rs-target-nav-btn" id="rs-target-next-btn" title="Следующая цель">➡️</button>
                </div>
                <input type="text" placeholder="Поиск..." class="rs-search-input" id="rs-search-target">
                <div class="rs-tree-container" id="rs-tree-target"></div>
                <button class="rs-confirm-selection-btn" id="rs-confirm-btn" disabled>Подтвердить выбор</button>
            </div>
        </div>
        <div class="rs-footer">
            <button class="rs-btn cancel">Отмена</button>
            <button class="rs-btn ok">Выполнить</button>
        </div>
    `;
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    const contentArea = dialog.querySelector('.rs-content');
    const targetWrapper = dialog.querySelector('#rs-target-column-wrapper');
    const addColumnBtn = dialog.querySelector('#rs-add-column-btn');
    const removeColumnBtn = dialog.querySelector('#rs-remove-column-btn');
    let selectionGroups = [];
    const groupColors = ["var(--primary-color)", "#4CAF50", "#FFA500"];
    let activeTargetIndex = 0;
    const sourceTreeExpansionStates = new Map();
    const targetTreeExpansionState = new Set();
    const targetTitleEl = dialog.querySelector('#rs-target-title-text');
    const prevTargetBtn = dialog.querySelector('#rs-target-prev-btn');
    const nextTargetBtn = dialog.querySelector('#rs-target-next-btn');
    const targetSearchInput = dialog.querySelector('#rs-search-target');
    const targetTreeContainer = dialog.querySelector('#rs-tree-target');
    const confirmBtn = dialog.querySelector('#rs-confirm-btn');

    const updateAllVisualStates = () => {
        const globallySelectedNodes = new Map();
        selectionGroups.forEach(group => {
            group.state.forEach((state, id) => {
                if (state !== 'none') {
                    globallySelectedNodes.set(id, { state, color: group.color });
                }
            });
        });

        document.querySelectorAll('.rs-column:not(#rs-target-column-wrapper)').forEach((col, index) => {
            const group = selectionGroups[index];
            if (!group) return;
            col.querySelectorAll('input[type="checkbox"].custom-checkbox').forEach(input => {
                const nodeId = parseInt(input.value, 10);
                const selectionInfo = globallySelectedNodes.get(nodeId);
                const isSelectedInOtherGroup = !!(selectionInfo && selectionInfo.color !== group.color);

                input.disabled = (input.dataset.isLocked === 'true') || isSelectedInOtherGroup;

                if (isSelectedInOtherGroup) {
                    input.dataset.state = selectionInfo.state;
                    input.dataset.groupColor = selectionInfo.color;
                } else {
                    input.dataset.state = group.state.get(nodeId) || 'none';
                    input.dataset.groupColor = group.color;
                }
                if (typeof input.updateVisuals === 'function') {
                    input.updateVisuals();
                }
            });
        });

        updateTargetColumnView(true);
    };

    const updateTargetColumnView = (fullRedraw = true) => {
        if (selectionGroups.length === 0) return;
        if (activeTargetIndex >= selectionGroups.length) {
            activeTargetIndex = Math.max(0, selectionGroups.length - 1);
        }
        const activeGroup = selectionGroups[activeTargetIndex];
        if (activeGroup.pendingTargetId === null && activeGroup.targetId !== null) {
            activeGroup.pendingTargetId = activeGroup.targetId;
        }
        confirmBtn.disabled = !activeGroup.pendingTargetId || (activeGroup.pendingTargetId === activeGroup.targetId);
        targetTitleEl.textContent = `Цель для Группы №${activeTargetIndex + 1}`;
        targetTitleEl.style.borderBottom = `3px solid ${activeGroup.color}`;
        const canNavigate = selectionGroups.length > 1;
        prevTargetBtn.disabled = !canNavigate;
        nextTargetBtn.disabled = !canNavigate;

        if (fullRedraw) {
            const filterText = targetSearchInput.value.toLowerCase().trim();
            const expansionStateForRender = new Set(targetTreeExpansionState);
            targetTreeContainer.innerHTML = '';

            const allTargets = new Map();
            selectionGroups.forEach((group, index) => {
                if (group.targetId) {
                    allTargets.set(group.targetId, { color: group.color, is_active: index === activeTargetIndex });
                }
            });

            const globallyDisabledNodes = new Map();
            selectionGroups.forEach(group => {
                group.state.forEach((state, id) => {
                    if (state === 'move' || state === 'delete') {
                        globallyDisabledNodes.set(id, true);
                    }
                });
            });

            const selectionState = new Map();
            if (activeGroup.pendingTargetId) {
                selectionState.set(activeGroup.pendingTargetId, 'selected');
            }

            const highlightTargetNode = (id) => {
                const node = this.findNode(this.treeData, id);
                if (node && (node.content.isIndicator || node.content.isOKR)) {
                    this.showNotification('Узлы типа "Гос. программа" и "OKR" не могут быть выбраны в качестве цели.', 'error');
                    const selectedElement = targetTreeContainer.querySelector('.selected-target');
                    if (selectedElement) {
                        const radio = selectedElement.querySelector('input[type="radio"]');
                        if (radio) radio.checked = false;
                        selectedElement.classList.remove('selected-target');
                    }
                    if (activeGroup) {
                        activeGroup.pendingTargetId = activeGroup.targetId || null;
                    }
                    confirmBtn.disabled = true;
                    return;
                }
                if (activeGroup) {
                    activeGroup.pendingTargetId = id;
                }
                confirmBtn.disabled = !activeGroup || activeGroup.pendingTargetId === activeGroup.targetId;
                targetTreeContainer.querySelectorAll('.selected-target').forEach(el => el.classList.remove('selected-target'));
                const newSelectedInput = targetTreeContainer.querySelector(`input[value="${id}"]`);
                if (newSelectedInput) {
                    newSelectedInput.closest('.tree-selection-node').classList.add('selected-target');
                }
            };

            this.createSelectableTree(
                targetTreeContainer,
                highlightTargetNode,
                this.treeData,
                false,
                selectionState,
                filterText,
                expansionStateForRender,
                targetTreeExpansionState,
                globallyDisabledNodes,
                '1',
                allTargets,
                false 
            );
        }
    };

    confirmBtn.addEventListener('click', () => {
        const activeGroup = selectionGroups[activeTargetIndex];
        if (activeGroup && activeGroup.pendingTargetId !== null) {
            activeGroup.targetId = activeGroup.pendingTargetId;
            confirmBtn.disabled = true;
            updateTargetColumnView(true);
            this.showNotification(`Цель для Группы №${activeTargetIndex + 1} зафиксирована.`);
        }
    });

    prevTargetBtn.addEventListener('click', () => {
        activeTargetIndex = (activeTargetIndex - 1 + selectionGroups.length) % selectionGroups.length;
        updateTargetColumnView(true);
    });

    nextTargetBtn.addEventListener('click', () => {
        activeTargetIndex = (activeTargetIndex + 1) % selectionGroups.length;
        updateTargetColumnView(true);
    });

    targetSearchInput.addEventListener('input', () => updateTargetColumnView(true));

    const redrawSingleSourceTree = (index) => {
        const group = selectionGroups[index];
        if (!group) return;
        const col = document.querySelectorAll('.rs-column:not(#rs-target-column-wrapper)')[index];
        const searchInput = col.querySelector('input.rs-search-input');
        const treeContainer = col.querySelector('.rs-tree-container');
        const filterText = searchInput.value.toLowerCase().trim();
        const manualExpansionState = sourceTreeExpansionStates.get(group.id);
        const expansionStateForRender = new Set(manualExpansionState);
        treeContainer.innerHTML = '';

        this.createSelectableTree(
            treeContainer,
            (id, state) => {
                if (state === 'none') {
                    group.state.delete(id);
                } else {
                    group.state.set(id, state);
                }
                updateAllVisualStates();
                updateTargetColumnView(true);
            },
            this.treeData,
            true,
            group.state,
            filterText,
            expansionStateForRender,
            manualExpansionState,
            new Map(),
            group.color,
            new Map(),
            true 
        );
        updateAllVisualStates();
    };

    const updateColumnButtonsState = () => {
        addColumnBtn.disabled = selectionGroups.length >= 3;
        removeColumnBtn.disabled = selectionGroups.length <= 1;
    };

    const addSourceColumn = () => {
        if (selectionGroups.length >= 3) return;
        const groupIndex = selectionGroups.length;
        const newGroup = { id: groupIndex + 1, state: new Map(), targetId: null, pendingTargetId: null, color: groupColors[groupIndex] };
        selectionGroups.push(newGroup);
        sourceTreeExpansionStates.set(newGroup.id, new Set());
        const column = document.createElement('div');
        column.className = 'rs-column';
        column.innerHTML = `
            <h4 style="margin: 0; text-align: center;">Группа выбора №${newGroup.id}</h4>
            <input type="text" placeholder="Поиск..." class="rs-search-input">
            <div class="rs-tree-container"></div>
        `;
        contentArea.insertBefore(column, targetWrapper);
        const searchInput = column.querySelector('input');
        searchInput.addEventListener('input', () => redrawSingleSourceTree(groupIndex));
        redrawSingleSourceTree(groupIndex);
        updateColumnButtonsState();
        updateTargetColumnView(false);
    };

    const removeSourceColumn = () => {
        if (selectionGroups.length <= 1) return;
        const removedGroup = selectionGroups.pop();
        sourceTreeExpansionStates.delete(removedGroup.id);
        const columns = contentArea.querySelectorAll('.rs-column:not(#rs-target-column-wrapper)');
        columns[columns.length - 1].remove();
        updateAllVisualStates();
        updateColumnButtonsState();
        updateTargetColumnView(false);
    };

    addColumnBtn.addEventListener('click', addSourceColumn);
    removeColumnBtn.addEventListener('click', removeSourceColumn);

    const closeDialog = () => {
        document.body.removeChild(backdrop);
        this.elements.controls.style.display = 'flex';
        document.getElementById('historyLogIcon').style.display = 'flex';
        document.getElementById('circular-replacement-btn-main').style.display = 'flex';
        this.elements.toggleControls.style.display = 'flex';
    };

    dialog.querySelector('.ok').addEventListener('click', () => {
        this.performMultiTargetRestructure(selectionGroups);
        closeDialog();
    });
        dialog.querySelector('.rs-btn.cancel').addEventListener('click', () => {
        closeDialog();
        this.promptReplacementMode(); 
    });
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeDialog();
    });
    addSourceColumn();
    updateTargetColumnView(true);
    this.elements.controls.style.display = 'none';
    document.getElementById('historyLogIcon').style.display = 'none';
    document.getElementById('circular-replacement-btn-main').style.display = 'none';
    this.elements.toggleControls.style.display = 'none';
}
recursivelyUpdateCluster(nodes, clusterName) {
    nodes.forEach(node => {
        if (clusterName) {
            this.clusters.set(node.id, clusterName);
        } else {
            this.clusters.delete(node.id);
        }
        if (node.children && node.children.length > 0) {
            this.recursivelyUpdateCluster(node.children, clusterName);
        }
    });
}
performMultiTargetRestructure(groups) {
    this.saveToHistory(false, true);

    let totalMoved = 0;
    let totalDeleted = 0;
    groups.forEach(group => {
        group.state.forEach((state) => {
            if (state === 'move') totalMoved++;
            if (state === 'delete') totalDeleted++;
        });
    });

    const logParts = [];
    if (totalMoved > 0) logParts.push(`перемещено ${totalMoved} узлов`);
    if (totalDeleted > 0) logParts.push(`удалено ${totalDeleted} узлов`);
    if (logParts.length > 0) {
        this.logAction(`Реструктуризация: ${logParts.join(', ')}.`);
    }

    const allNodesToModify = new Set();
    const nodesToDelete = new Set();
    const moveOperations = [];
    let errorOccurred = false;

    groups.forEach((group, index) => {
        if (errorOccurred) return;
        const nodesToMoveInGroup = new Set();
        group.state.forEach((state, id) => {
            allNodesToModify.add(id);
            if (state === 'delete') {
                nodesToDelete.add(id);
            } else if (state === 'move') {
                nodesToMoveInGroup.add(id);
            }
        });
        if (nodesToMoveInGroup.size > 0) {
            if (!group.targetId) {
                this.showNotification(`Не выбран целевой узел для Группы №${index + 1}`, 'error');
                errorOccurred = true;
                return;
            }
            moveOperations.push({
                nodes: nodesToMoveInGroup,
                targetId: group.targetId
            });
        }
    });

    if (errorOccurred) return;

    nodesToDelete.forEach(id => allNodesToModify.add(id));

    moveOperations.forEach(op => {
        op.hierarchy = this.buildPreservedHierarchy(op.nodes);
    });

    const newRootChildren = [];
    this.treeData.children.forEach(child => {
        const result = this.restructureAndPruneTree(child, allNodesToModify);
        newRootChildren.push(...result);
    });
    this.treeData.children = newRootChildren;

    moveOperations.forEach(op => {
        const targetNode = this.findNode(this.treeData, op.targetId);
        if (targetNode) {
            if (!targetNode.children) {
                targetNode.children = [];
            }
            targetNode.children.push(...op.hierarchy);
            targetNode.isExpanded = true;

            const targetCluster = this.clusters.get(targetNode.id);
            this.recursivelyUpdateCluster(op.hierarchy, targetCluster);

        } else {
            console.error(`Критическая ошибка: Целевой узел с ID ${op.targetId} не найден после удаления веток.`);
        }
    });

    this.updateTree();
    this.saveData();
    this.showNotification('Реструктуризация успешно выполнена.');
}
performRestructure(selectedNodesWithState, targetId) {
    const nodesToMoveIds = new Set();
    const nodesToDeleteIds = new Set();
    selectedNodesWithState.forEach((state, id) => {
        if (state === 'move') {
            nodesToMoveIds.add(id);
        } else if (state === 'delete') {
            nodesToDeleteIds.add(id);
        }
    });

    if (nodesToMoveIds.size === 0 && nodesToDeleteIds.size === 0) {
        this.showNotification('Не выбраны узлы для переноса или удаления.', 'error');
        return;
    }

    if (nodesToMoveIds.size > 0 && !targetId) {
        this.showNotification('Не выбран целевой узел для вставки.', 'error');
        return;
    }

    const targetNodeOriginal = this.findNode(this.treeData, targetId);
    if (nodesToMoveIds.size > 0 && !targetNodeOriginal) {
        this.showNotification('Целевой узел не найден.', 'error');
        return;
    }

    this.saveToHistory(false, true);

    const logParts = [];
    if (nodesToMoveIds.size > 0) logParts.push(`перемещено ${nodesToMoveIds.size} узлов`);
    if (nodesToDeleteIds.size > 0) logParts.push(`удалено ${nodesToDeleteIds.size} узлов`);
    if (logParts.length > 0) {
        this.logAction(`Реструктуризация: ${logParts.join(', ')}.`);
    }

    const movedHierarchy = this.buildPreservedHierarchy(nodesToMoveIds);
    const allSelectedIds = new Set([...nodesToMoveIds, ...nodesToDeleteIds]);

    const newRootChildren = [];
    this.treeData.children.forEach(child => {
        const result = this.restructureAndPruneTree(child, allSelectedIds);
        newRootChildren.push(...result);
    });
    this.treeData.children = newRootChildren;

    if (targetNodeOriginal && movedHierarchy.length > 0) {
        const targetNodeInNewTree = this.findNode(this.treeData, targetId);
        if (targetNodeInNewTree) {
            if (!targetNodeInNewTree.children) {
                targetNodeInNewTree.children = [];
            }
            targetNodeInNewTree.children.push(...movedHierarchy);
            targetNodeInNewTree.isExpanded = true;
            const targetCluster = this.clusters.get(targetId);
            this.recursivelyUpdateCluster(movedHierarchy, targetCluster);

        } else {
            console.error("Критическая ошибка: целевой узел не найден после перестройки дерева.");
            this.showNotification('Ошибка: целевой узел исчез после удаления веток.', 'error');
            return;
        }
    }

    this.updateTree();
    this.saveData();
    this.showNotification('Реструктуризация успешно выполнена.');
}
buildPreservedHierarchy(nodesToMoveIds) {
    const nodeCopies = new Map();
    nodesToMoveIds.forEach(id => {
        const originalNode = this.findNode(this.treeData, id);
        if (originalNode) {
            const nodeCopy = JSON.parse(JSON.stringify(originalNode));
            nodeCopy.children = []; 
            nodeCopies.set(id, nodeCopy);
        }
    });

    const hierarchyRoots = [];
    nodeCopies.forEach((nodeCopy, id) => {
        const nearestAncestor = this.findNearestSelectedAncestor(id, nodesToMoveIds);

        if (nearestAncestor) {
            const parentCopy = nodeCopies.get(nearestAncestor.id);
            if (parentCopy) {
                parentCopy.children.push(nodeCopy);
            }
        } else {
            hierarchyRoots.push(nodeCopy);
        }
    });

    return hierarchyRoots;
}
findNearestSelectedAncestor(startNodeId, selectedIds) {
    const parent = this.findParent(this.treeData, startNodeId);
    if (!parent) {
        return null;
    }
    if (selectedIds.has(parent.id)) {
        return parent;
    }
    return this.findNearestSelectedAncestor(parent.id, selectedIds);
}
async showNewStaffUnitDialog() {
    if (!document.getElementById('new-unit-dialog-styles')) {
        const style = document.createElement('style');
        style.id = 'new-unit-dialog-styles';
        style.textContent = `
            .nu-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 10002; backdrop-filter: blur(5px); }
            .nu-dialog { background: var(--controls-bg); padding: 25px; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.25); width: 90%; max-width: 600px; border: 1px solid var(--primary-color); display: flex; flex-direction: column; }
            .nu-header { text-align: center; margin-bottom: 20px; color: var(--primary-color); }
            .nu-content { display: flex; flex-direction: column; gap: 15px; }
            .nu-input, .nu-btn { padding: 10px; border: 1px solid var(--secondary-color); border-radius: 6px; width: 100%; box-sizing: border-box; font-size: 1em; }
            .nu-tree-container { border: 1px solid var(--secondary-color); border-radius: 8px; padding: 10px; max-height: 40vh; overflow-y: auto; }
            .nu-image-preview { max-width: 100px; max-height: 100px; display: none; margin-top: 10px; border-radius: 6px; border: 1px solid var(--secondary-color); }
            .nu-footer { margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px; }
            .nu-btn { border: none; cursor: pointer; font-weight: 500; transition: all 0.2s ease; }
            .nu-btn.confirm { background: #4CAF50; color: white; }
            .nu-btn.confirm:disabled { background: #ccc; cursor: not-allowed; }
            .nu-btn.cancel { background: transparent; color: var(--accent-color); }
            .nu-btn.image-btn { background: var(--secondary-color); color: white; }
        `;
        document.head.appendChild(style);
    }
    const userChoice = await new Promise(resolve => {
        const backdrop = document.createElement('div');
        backdrop.className = 'nu-backdrop';
        const dialog = document.createElement('div');
        dialog.className = 'nu-dialog';
        dialog.innerHTML = `
            <div class="nu-header"><h3>Создать дубликаты по наименованию</h3></div>
            <div class="nu-content">
                <p>1. Выберите узел, чтобы использовать его наименование как эталон.</p>
                <input type="text" placeholder="Поиск узла по наименованию..." class="nu-input nu-search-input">
                <div class="nu-tree-container"></div>
                <p>2. Введите наименование для новых узлов-дубликатов.</p>
                <input type="text" class="nu-input" id="nu-new-name-input" value="Новая штатная единица">
                <p>3. Выберите изображение (необязательно).</p>
                <input type="file" id="nu-image-upload-input" accept="image/*" style="display: none;">
                <button class="nu-btn image-btn" id="nu-image-select-btn">Выбрать изображение</button>
                <img id="nu-image-preview" class="nu-image-preview">
            </div>
            <div class="nu-footer">
                <button class="nu-btn cancel">Отмена</button>
                <button class="nu-btn confirm" disabled>Выполнить</button>
            </div>
        `;
        document.body.appendChild(backdrop);
        backdrop.appendChild(dialog);

        const searchInput = dialog.querySelector('.nu-search-input');
        const treeContainer = dialog.querySelector('.nu-tree-container');
        const confirmBtn = dialog.querySelector('.confirm');
        const cancelBtn = dialog.querySelector('.cancel');
        const newNameInput = dialog.querySelector('#nu-new-name-input');
        const imageSelectBtn = dialog.querySelector('#nu-image-select-btn');
        const imageUploadInput = dialog.querySelector('#nu-image-upload-input');
        const imagePreview = dialog.querySelector('#nu-image-preview');

        let selectedNodeId = null;
        let imageBase64 = null;
        const expansionState = new Set();

        const redrawTree = () => {
            const filterText = searchInput.value.toLowerCase().trim();
            this.createSingleSelectableTree(
                treeContainer,
                (nodeId) => {
                    selectedNodeId = nodeId;
                    confirmBtn.disabled = !selectedNodeId;
                },
                selectedNodeId,
                expansionState,
                filterText,
                true
            );
        };

        imageSelectBtn.addEventListener('click', () => imageUploadInput.click());
        imageUploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    imageBase64 = event.target.result;
                    imagePreview.src = imageBase64;
                    imagePreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });

       const closeDialog = (result) => {
            document.body.removeChild(backdrop);
            resolve(result);
        };

        searchInput.addEventListener('input', redrawTree);
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(backdrop); 
            this.promptReplacementMode();      
            resolve(null);                     
        });
        confirmBtn.addEventListener('click', () => {
            const newNodeName = newNameInput.value.trim() || "Новая штатная единица";
            closeDialog({ templateNodeId: selectedNodeId, newNodeName, imageBase64 });
        });
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closeDialog(null);
        });

        redrawTree();
    });

    if (userChoice) {
        this.executeAddStaffUnit(userChoice.templateNodeId, userChoice.newNodeName, userChoice.imageBase64);
    } else {
        this.showNotification('Операция отменена.');
    }
}
async executeAddStaffUnit(templateNodeId, newNodeName, newImageDataBase64) {
    const selectedNode = this.findNode(this.treeData, templateNodeId);
    if (!selectedNode) {
        this.showNotification('Выбранный узел-эталон не найден.', 'error');
        return;
    }

    this.saveToHistory(false, true);
    const targetName = selectedNode.content.text;
    const sourceCluster = this.clusters.get(selectedNode.id);

    const targets = [];
    const findTargetsRecursive = (node) => {
        if (node.content.text === targetName) {
            targets.push(node);
        }
        if (node.children) {
            [...node.children].forEach(child => findTargetsRecursive(child));
        }
    };
    findTargetsRecursive(this.treeData);

    if (targets.length === 0) {
        this.showNotification('Не найдено узлов с таким наименованием для дублирования.', 'info');
        return;
    }

    let insertionCount = 0;
    let imageId = null;
    if (newImageDataBase64) {
        try {
            const blob = await (await fetch(newImageDataBase64)).blob();
            const compressedImage = await this.compressImage(new File([blob], "upload.jpg", { type: "image/jpeg" }));
            imageId = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            this.imagesData[imageId] = compressedImage;
        } catch (error) {
            console.error("Ошибка обработки изображения:", error);
            this.showNotification("Не удалось обработать изображение.", "error");
            imageId = null;
        }
    }
    targets.forEach(originalNode => {
        const parent = this.findParent(this.treeData, originalNode.id);
        if (parent) {
            const hierarchyToCopy = this.serializeNodeWithChildren(originalNode);
            const newNode = this.restoreNodeWithChildren(hierarchyToCopy);
            newNode.content.text = newNodeName;
            newNode.content.img = imageId;
            newNode.content.isHorizontal = true;
            if (sourceCluster) {
                this.clusters.set(newNode.id, sourceCluster);
                if (!this.availableClusters.has(sourceCluster)) {
                    this.availableClusters.add(sourceCluster);
                }
            } else {
                this.clusters.delete(newNode.id);
            }
            const index = parent.children.findIndex(child => child.id === originalNode.id);
            if (index !== -1) {
                parent.children.splice(index + 1, 0, newNode);
                insertionCount++;
            }
        }
    });

    if (insertionCount > 0) {
        this.logAction(`Дублировано ${insertionCount} узлов с наименованием "${targetName}" как "${newNodeName}"`);
        this.updateTree();
        this.saveData();
        this.showNotification(`Создано ${insertionCount} дубликатов для узлов "${targetName}".`);
    } else {
        this.showNotification('Не удалось создать дубликаты.', 'warning');
    }
}
async showTornadoReplacementDialog() {
    const expansionStates = new Map();
    const filterStates = new Map();

    if (!document.getElementById('circular-replacement-styles')) {
        const style = document.createElement('style');
        style.id = 'circular-replacement-styles';
        style.textContent = `
            .cr-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 10002; backdrop-filter: blur(5px); }
            .cr-dialog { background: var(--controls-bg); padding: 20px; width: 100vw; height: 100vh; box-sizing: border-box; border-radius: 0; border: none; display: flex; flex-direction: column; }
            .cr-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid var(--secondary-color); }
            .cr-header h3 { margin: 0; color: var(--primary-color); }
            .cr-content { display: flex; gap: 15px; flex: 1; min-height: 0; overflow-x: auto; padding: 10px; }
            .cr-pair-column { display: flex; flex-direction: column; gap: 10px; min-width: 500px; flex: 1; position: relative; }
            .cr-column-header { display: flex; justify-content: space-between; align-items: center; margin: 0 0 5px 0; text-align: center; flex-wrap: wrap; gap: 5px; }
            .cr-column-header h4 { margin: 0; flex-grow: 1; }
            .cr-search-input { padding: 4px 8px; border: 1px solid var(--secondary-color); border-radius: 4px; width: 100%; box-sizing: border-box; }
            .cr-tree-container { border: 1px solid var(--secondary-color); border-radius: 8px; padding: 10px; flex: 1; overflow-y: auto; }
            .cr-footer { margin-top: 15px; display: flex; justify-content: space-between; align-items: center; }
            .cr-footer .btn-group { display: flex; gap: 10px; }
            .cr-btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; }
            .cr-add-btn { background: var(--primary-color); color: white; }
            .cr-remove-btn { background: var(--accent-color); color: white; }
            .cr-confirm-btn { background: #4CAF50; color: white; }
            .cr-cancel-btn { background: transparent; color: var(--accent-color); }
            .cr-tree-container .tree-selection-node input[type="checkbox"] { display: none; }
            .cr-tree-container .tree-selection-node label { display: block; width: 100%; padding: 4px; border-radius: 4px; cursor: pointer; }
            .cr-tree-container .tree-selection-node input[type="checkbox"]:checked + label { background-color: var(--secondary-color); color: white; font-weight: bold; }
        `;
        document.head.appendChild(style);
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'cr-backdrop';
    const dialog = document.createElement('div');
    dialog.className = 'cr-dialog';
    dialog.innerHTML = `
        <div class="cr-header"><h3>Круговая замена (Торнадо)</h3></div>
        <div class="cr-content" id="cr-content-area"></div>
        <div class="cr-footer">
            <div class="btn-group">
                <button class="cr-btn cr-add-btn" id="cr-add-pair-btn">+ Добавить</button>
                <button class="cr-btn cr-remove-btn" id="cr-remove-pair-btn">- Убрать</button>
            </div>
            <div class="btn-group">
                <button class="cr-btn cr-cancel-btn">Отмена</button>
                <button class="cr-btn cr-confirm-btn">Выполнить</button>
            </div>
        </div>`;
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    const contentArea = dialog.querySelector('#cr-content-area');
    let pairCount = 0;
    let selectedNodes = new Map();

    const renderColumns = () => {
        contentArea.querySelectorAll('.cr-search-input').forEach((input, index) => {
            filterStates.set(index + 1, input.value);
        });

        contentArea.innerHTML = '';
        for (let i = 1; i <= pairCount; i++) {
            const currentPairId = i;
            if (!expansionStates.has(currentPairId)) {
                expansionStates.set(currentPairId, new Set());
            }

            const column = document.createElement('div');
            column.className = 'cr-pair-column';
            column.dataset.pairId = currentPairId;

            const header = document.createElement('div');
            header.className = 'cr-column-header';
            const title = document.createElement('h4');
            title.textContent = currentPairId === 1 ? `Кого меняем (№1)` : `На кого меняем (№${currentPairId - 1})`;

            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.placeholder = 'Поиск...';
            searchInput.className = 'cr-search-input';
            searchInput.value = filterStates.get(currentPairId) || '';

            header.appendChild(title);
            header.appendChild(searchInput);
            column.appendChild(header);

            const treeContainer = document.createElement('div');
            treeContainer.className = 'cr-tree-container';
            column.appendChild(treeContainer);
            contentArea.appendChild(column);

            const redrawTree = () => {
                const filterText = searchInput.value.toLowerCase().trim();
                filterStates.set(currentPairId, searchInput.value);
                const autoExpand = true;
                this.createSingleSelectableTree(
                    treeContainer,
                    (nodeId) => selectedNodes.set(currentPairId, nodeId),
                    selectedNodes.get(currentPairId),
                    expansionStates.get(currentPairId),
                    filterText,
                    true,
                    null,
                    null,
                    autoExpand
                );
            };
            searchInput.addEventListener('input', redrawTree);
            redrawTree();
        }
    };
    const addPairColumn = () => {
        if (pairCount >= 4) {
            this.showNotification("Максимум 4 пары для замены.");
            return;
        }
        pairCount++;
        renderColumns();
    };
    const removePairColumn = () => {
        if (pairCount > 2) {
            selectedNodes.delete(pairCount);
            expansionStates.delete(pairCount);
            filterStates.delete(pairCount);
            pairCount--;
            renderColumns();
        } else {
            this.showNotification("Минимум 2 колонки для замены.");
        }
    };
    addPairColumn();
    addPairColumn();

    dialog.querySelector('#cr-add-pair-btn').addEventListener('click', addPairColumn);
    dialog.querySelector('#cr-remove-pair-btn').addEventListener('click', removePairColumn);
    const closeDialog = () => document.body.removeChild(backdrop);
    dialog.querySelector('.cr-cancel-btn').addEventListener('click', () => {
        closeDialog();
        this.promptReplacementMode();
    });
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeDialog(); });
    dialog.querySelector('.cr-confirm-btn').addEventListener('click', async () => {
        const replacementChain = [];
        for (let i = 1; i <= pairCount; i++) {
            if (!selectedNodes.has(i) || selectedNodes.get(i) === null) {
                this.showNotification(`Не выбран узел в колонке №${i}`, 'error');
                return;
            }
            replacementChain.push(selectedNodes.get(i));
        }
        await this.executeCircularReplacement(replacementChain);
        closeDialog();
    });
}
createSingleSelectableTree(container, onSelect, selectedId = null, expansionState = new Set(), filterText = '', isFirstColumn = false, disableRule = null, redrawCallback = null, autoExpandOnFilter = false) {
    container.innerHTML = '';
    if (filterText && autoExpandOnFilter) {
        const expandMatchingNodes = (node) => {
            let matches = this.nodeMatchesSearch(node, filterText);
            let hasMatchingChild = false;

            if (node.children && node.children.length > 0) {
                node.children.forEach(child => {
                    if (expandMatchingNodes(child)) {
                        hasMatchingChild = true;
                    }
                });
            }
            if (matches || hasMatchingChild) {
                expansionState.add(node.id);
                return true; 
            }
            return false;
        };
        expandMatchingNodes(this.treeData);
    }
    const finalRedrawCallback = redrawCallback || (() => {
        this.createSingleSelectableTree(container, onSelect, selectedId, expansionState, filterText, isFirstColumn, disableRule, finalRedrawCallback, autoExpandOnFilter);
    });

    const createNodeRecursive = (node, parentElement, level = 0, ancestorMatches = false) => {
        const currentNodeMatches = filterText ? this.nodeMatchesSearch(node, filterText) : true;
        const hasVisibleChild = filterText ? this.isParentOfMatch(node, filterText) : false;

        if (filterText && !currentNodeMatches && !hasVisibleChild && !ancestorMatches) {
            return;
        }
        const nodeElement = document.createElement('div');
        nodeElement.className = 'tree-selection-node';
        nodeElement.style.marginLeft = `${level * 15}px`;

        const isDisabled = disableRule ? disableRule(node) : false;
        if (isDisabled) {
            nodeElement.dataset.disabled = "true";
        }

        const contentWrapper = document.createElement('div');
        contentWrapper.style.display = 'flex';
        contentWrapper.style.alignItems = 'center';

        const expandIcon = document.createElement('span');
        expandIcon.style.cursor = 'pointer';
        expandIcon.style.width = '15px';
        expandIcon.style.display = 'inline-block';

        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-selection-children';

        const isExpanded = expansionState.has(node.id);
        childrenContainer.style.display = isExpanded ? 'block' : 'none';

        if (node.children && node.children.length > 0) {
            expandIcon.textContent = isExpanded ? '▼' : '▶';
            expandIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                if (expansionState.has(node.id)) {
                    expansionState.delete(node.id);
                } else {
                    expansionState.add(node.id);
                }
                if (finalRedrawCallback) {
                    finalRedrawCallback();
                }
            });
        }
        const inputId = `cr-node-${node.id}-${Math.random()}`;
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = inputId;
        input.value = node.id;
        if (node.id === selectedId) {
            input.checked = true;
        }
        if (isDisabled) {
            input.disabled = true;
        }

        input.addEventListener('change', () => {
            container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                if (cb !== input) cb.checked = false;
            });
            const newSelectedId = input.checked ? parseInt(node.id, 10) : null;
            onSelect(newSelectedId);
            this.createSingleSelectableTree(container, onSelect, newSelectedId, expansionState, filterText, isFirstColumn, disableRule, finalRedrawCallback, autoExpandOnFilter);
        });

        const label = document.createElement('label');
        label.htmlFor = inputId;
        label.textContent = node.content.text;

        contentWrapper.appendChild(expandIcon);
        contentWrapper.appendChild(input);
        contentWrapper.appendChild(label);
        nodeElement.appendChild(contentWrapper);
        nodeElement.appendChild(childrenContainer);
        parentElement.appendChild(nodeElement);

        if (isExpanded) {
            node.children.forEach(child => createNodeRecursive(child, childrenContainer, level + 1, ancestorMatches || currentNodeMatches));
        }
    };

    createNodeRecursive(this.treeData, container, 0, false);
}
async executeCircularReplacement(idChain) {
    const selectedNodeObjects = idChain.map(id => this.findNode(this.treeData, id));
    const nodeNames = selectedNodeObjects.map(node => node.content.text);
    for (const node of selectedNodeObjects) {
        if (node.content.isIndicator || node.content.isOKR) {
            this.showNotification(`Нельзя использовать в замене специальные узлы типа "Гос. программа" или "OKR": "${node.content.text}"`, 'error');
            return;
        }
    }
    if (new Set(nodeNames).size !== nodeNames.length) {
        this.showNotification('Нельзя выбирать узлы с одинаковыми названиями для круговой замены.', 'error');
        return;
    }
    this.saveToHistory(false, true);

    const replacementPlan = new Map();
    const logParts = [];

    for (let i = 0; i < idChain.length; i++) {
        const sourceNode = this.findNode(this.treeData, idChain[i]);
        if (!sourceNode) continue;

        const sourceText = sourceNode.content.text;
        let newContent;
        let logMessage = '';

        if (i < idChain.length - 1) {
            const targetNode = this.findNode(this.treeData, idChain[i + 1]);
            if (!targetNode) continue;
            newContent = JSON.parse(JSON.stringify(targetNode.content));
            logMessage = `'${sourceText}' → '${targetNode.content.text}'`;
        } else {
            newContent = {
                text: "Оргштатные мероприятия",
                img: null,
                subBlocks: [],
                isHorizontal: true,
                isOrganizationalEvent: true,
                files: []
            };
            logMessage = `'${sourceText}' → 'Оргштатные мероприятия'`;
        }

        if (!replacementPlan.has(sourceText)) {
            replacementPlan.set(sourceText, { newContent });
            logParts.push(logMessage);
        }
    }

const applyReplacementRecursive = (node) => {
    node.children.forEach(child => applyReplacementRecursive(child));

    if (replacementPlan.has(node.content.text)) {
        const plan = replacementPlan.get(node.content.text);
        const originalPosition = node.content.position || null;

        const originalFiles = node.content.files || [];
        const originalSubBlocks = node.content.subBlocks || [];
        const originalSpecialFlags = {
            isSubordinate: node.content.isSubordinate || false,
            isPower269: node.content.isPower269 || false,
            absent269: node.content.absent269 || false,
            isForAll: node.content.isForAll || false,
            isAuthority: node.content.isAuthority || false,
            isOKR: node.content.isOKR || false,
            isIndicator: node.content.isIndicator || false
        };

        node.content = JSON.parse(JSON.stringify(plan.newContent));
        node.content.files = originalFiles;
        node.content.subBlocks = originalSubBlocks;
        Object.assign(node.content, originalSpecialFlags);

        node.content.position = originalPosition;

        node.circularlyReplaced = true;
    }
};

    applyReplacementRecursive(this.treeData);
    this.logAction(`Круговая замена: ${logParts.join(', ')}.`);
    this.updateTree();
    this.saveData();
    this.showNotification('Круговая замена по всей иерархии успешно выполнена!');
}
async showTreeSelectionDialog(node) {
    const container = document.createElement('div');
    container.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: var(--controls-bg); padding: 20px; border: 1px solid var(--primary-color);
        border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.2); z-index: 10000;
        max-height: 80vh; overflow-y: auto; min-width: 300px; max-width: 600px;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Выберите узлы для копирования';
    title.style.cssText = 'margin-top: 0; color: var(--primary-color);';
    container.appendChild(title);

    const treeContainer = document.createElement('div');
    treeContainer.style.cssText = 'max-height: 60vh; overflow-y: auto;';
    container.appendChild(treeContainer);

    const selectedIds = new Set();
    selectedIds.add(node.id);

    const createTreeNode = (node, parentElement, level = 0) => {
        const nodeElement = document.createElement('div');
        nodeElement.style.cssText = `
            padding: 8px 8px 8px ${level * 20 + 8}px; border-bottom: 1px solid rgba(93, 138, 168, 0.2);
            display: flex; align-items: center;
        `;

        let expandIcon = null;
        if (node.children.length > 0) {
            expandIcon = document.createElement('span');
            expandIcon.textContent = '▼';
            expandIcon.style.cssText = 'cursor: pointer; margin-right: 8px;';
            nodeElement.appendChild(expandIcon);
        } else {
            const spacer = document.createElement('span');
            spacer.style.cssText = 'width: 16px; display: inline-block;';
            nodeElement.appendChild(spacer);
        }

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `node-${node.id}`;
        checkbox.value = node.id;
        if (level === 0) {
            checkbox.checked = true;
            checkbox.disabled = true;
        } else {
            checkbox.checked = false;
        }

        checkbox.style.marginRight = '10px';
        nodeElement.appendChild(checkbox);

        const label = document.createElement('label');
        label.htmlFor = `node-${node.id}`;
        label.textContent = node.content.text.length > 50 ? node.content.text.substring(0, 47) + '...' : node.content.text;
        label.title = node.content.text;
        label.style.cssText = 'cursor: pointer; flex-grow: 1;';
        nodeElement.appendChild(label);

        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                selectedIds.add(node.id);
            } else {
                selectedIds.delete(node.id);
            }
        });

        parentElement.appendChild(nodeElement);

        const childrenContainer = document.createElement('div');
        childrenContainer.style.display = 'block';
        parentElement.appendChild(childrenContainer);

        if (expandIcon) {
            expandIcon.addEventListener('click', () => {
                const isExpanded = childrenContainer.style.display === 'block';
                childrenContainer.style.display = isExpanded ? 'none' : 'block';
                expandIcon.textContent = isExpanded ? '▼' : '▶';
            });
        }

        node.children.forEach(child => createTreeNode(child, childrenContainer, level + 1));
    };

    createTreeNode(node, treeContainer, 0);

    const buttons = document.createElement('div');
    buttons.style.cssText = 'display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px;';
    container.appendChild(buttons);

    const okButton = document.createElement('button');
    okButton.textContent = 'ОК';
    okButton.style.cssText = `
        padding: 6px 12px; background: var(--primary-color); color: white;
        border: none; border-radius: 4px; cursor: pointer;
    `;
    buttons.appendChild(okButton);

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Отмена';
    cancelButton.style.cssText = `
        padding: 6px 12px; background: linear-gradient(145deg, #ff4444, #d32f2f);
        color: white; border: none; border-radius: 4px; cursor: pointer;
    `;
    buttons.appendChild(cancelButton);

    document.body.appendChild(container);

    return new Promise((resolve) => {
        okButton.addEventListener('click', () => {
            document.body.removeChild(container);
            resolve(selectedIds);
        });
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(container);
            resolve(null);
        });
    });
}
getAllDescendantIds(startNode) {
    const ids = [];
    const collect = (node) => {
        if (!node || !node.children) return;
        for (const child of node.children) {
            ids.push(child.id);
            collect(child);
        }
    };
    collect(startNode);
    return ids;
}
createSelectableTree( container, onSelect, startNode = this.treeData, useCheckboxes = false, initialState = new Map(), filterText = '', expansionStateForRender = new Set(), expansionStateForManualToggle = null, disabledNodeIds = new Map(), groupColor = '1', allTargets = new Map(), autoExpandOnFilter = false ) {
    if (!document.getElementById('rs-checkbox-styles')) {
        const style = document.createElement('style');
        style.id = 'rs-checkbox-styles';
        style.textContent = `
            .rs-dialog input[type="checkbox"].custom-checkbox {
                appearance: none;
                width: 16px;
                height: 16px;
                border: 2px solid var(--secondary-color);
                border-radius: 4px;
                cursor: pointer;
                position: relative;
                outline: none;
                transition: all 0.2s ease;
            }
            .rs-dialog input[type="checkbox"].custom-checkbox::before {
                content: var(--symbol-content, "");
                color: white;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 12px;
                font-weight: bold;
            }
        `;
        document.head.appendChild(style);
    }
    if (filterText && autoExpandOnFilter) {
        const expandMatchingNodes = (node) => {
            let matches = this.nodeMatchesSearch(node, filterText, true);
            let hasMatchingChild = false;

            if (node.children && node.children.length > 0) {
                node.children.forEach(child => {
                    if (expandMatchingNodes(child)) {
                        hasMatchingChild = true;
                    }
                });
            }
            if (matches || hasMatchingChild) {
                expansionStateForRender.add(node.id);
                return true; 
            }
            return false;
        };
        expandMatchingNodes(this.treeData);
    }

    const createTreeNode = (node, parentElement, level = 0, ancestorMatches = false) => {
        const currentNodeMatches = filterText ? this.nodeMatchesSearch(node, filterText, true) : true;
        const hasVisibleChild = filterText ? this.isParentOfMatch(node, filterText, true) : false;

        if (filterText && !currentNodeMatches && !hasVisibleChild && !ancestorMatches) {
            return;
        }

        const nodeElement = document.createElement('div');
        nodeElement.className = 'tree-selection-node';
        nodeElement.style.cssText = `padding: 5px; display: flex; align-items: center; border-radius: 4px; margin-left: ${level * 20}px; user-select: none; transition: all 0.2s;`;

        if (allTargets.has(node.id)) {
            const targetInfo = allTargets.get(node.id);
            nodeElement.style.border = `2px solid ${targetInfo.color}`;
            nodeElement.style.paddingLeft = '3px';
            nodeElement.style.marginLeft = `${level * 20 - 2}px`;
            if (targetInfo.is_active) {
                const hexToRgb = (hex) => {
                    const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
                    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '93, 138, 168';
                };
                let colorRgb = '93, 138, 168';
                if (targetInfo.color.startsWith('#')) {
                    colorRgb = hexToRgb(targetInfo.color);
                }
                nodeElement.style.background = `rgba(${colorRgb}, 0.15)`;
            }
        }

        let expandIcon = null;
        if (node.children && node.children.length > 0) {
            expandIcon = document.createElement('span');
            expandIcon.style.cssText = 'cursor: pointer; margin-right: 8px; width: 16px;';
            nodeElement.appendChild(expandIcon);
        } else {
            const spacer = document.createElement('span');
            spacer.style.cssText = 'display: inline-block; width: 24px;';
            nodeElement.appendChild(spacer);
        }

        const input = document.createElement('input');
        input.type = useCheckboxes ? 'checkbox' : 'radio';
        input.name = useCheckboxes ? `select-move-${node.id}-${groupColor}` : `reparent-target-${container.id}`;
        input.value = node.id;
        input.id = `dialog-input-${node.id}-${groupColor}`;
        input.style.marginRight = '8px';

        const label = document.createElement('label');
        label.textContent = node.content.text;
        label.htmlFor = input.id;
        label.style.cursor = 'pointer';

        if (node.content.isIndicator || node.content.isOKR) {
            disabledNodeIds.set(node.id, true);
            if (useCheckboxes) {
                input.dataset.isLocked = 'true';
            }
        }

        if (disabledNodeIds.has(node.id)) {
            input.disabled = true;
            nodeElement.style.opacity = '0.5';
            nodeElement.style.cursor = 'not-allowed';
            label.style.textDecoration = 'line-through';
            label.style.cursor = 'not-allowed';
        }

        if (useCheckboxes) {
            input.className = 'custom-checkbox';
            input.style.cssText = 'appearance: none; width: 16px; height: 16px; border: 2px solid var(--secondary-color); border-radius: 4px; cursor: pointer; position: relative; outline: none; transition: all 0.2s ease;';

            input.updateVisuals = () => {
                input.style.backgroundColor = 'transparent';
                input.style.borderColor = 'var(--secondary-color)';
                input.style.setProperty('--symbol-content', '""');
                nodeElement.style.opacity = input.disabled ? '0.6' : '1';
                const state = input.dataset.state;
                const color = input.dataset.groupColor;
                if (state === 'move') {
                    input.style.backgroundColor = color;
                    input.style.borderColor = color;
                    input.style.setProperty('--symbol-content', '"✔"');
                } else if (state === 'delete') {
                    input.style.backgroundColor = color;
                    input.style.borderColor = color;
                    input.style.setProperty('--symbol-content', '"✖"');
                }
            };
            input.dataset.groupColor = groupColor;
            const currentState = initialState.get(node.id);
            input.dataset.state = currentState || 'none';
        } else {
            if (initialState.has(node.id)) {
                input.checked = true;
            }
        }
        nodeElement.appendChild(input);
        nodeElement.appendChild(label);
        parentElement.appendChild(nodeElement);

        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-selection-children';
        parentElement.appendChild(childrenContainer);

        const isExpanded = expansionStateForRender.has(node.id);
        childrenContainer.style.display = isExpanded ? 'block' : 'none';
        if (expandIcon) {
            expandIcon.textContent = isExpanded ? '▼' : '▶';
        }

        if (useCheckboxes) {
            const handleSelection = (e, type) => {
                e.preventDefault();
                if (input.disabled) return;
                const targetState = type === 'move' ? 'move' : 'delete';

                if (e.ctrlKey) {
                    const clickedNode = this.findNode(this.treeData, node.id);
                    if (clickedNode) {
                        const descendantIds = this.getAllDescendantIds(clickedNode);
                        const allIdsToChange = [node.id, ...descendantIds];
                        const currentState = initialState.get(node.id) || 'none';
                        const newState = currentState === targetState ? 'none' : targetState;

                        allIdsToChange.forEach(id => {
                            const nodeToUpdate = this.findNode(this.treeData, id);

                            if (nodeToUpdate && !nodeToUpdate.content.isIndicator && !nodeToUpdate.content.isOKR) {
                                onSelect(id, newState);
                            }
                        });

                        if (typeof updateAllVisualStates === 'function') {
                            updateAllVisualStates();
                        }
                    }
                } else {
                    const currentState = input.dataset.state || 'none';
                    const newState = currentState === targetState ? 'none' : targetState;
                    onSelect(parseInt(node.id, 10), newState);
                }
            };
            nodeElement.addEventListener('click', (e) => handleSelection(e, 'move'));
            nodeElement.addEventListener('contextmenu', (e) => handleSelection(e, 'delete'));
        } else {
            nodeElement.addEventListener('click', () => {
                if (input.disabled) {
                    onSelect(parseInt(node.id, 10));
                    return;
                }
                if (input.checked) return;
                input.checked = true;
                onSelect(parseInt(node.id, 10));
            });
        }
        if (typeof input.updateVisuals === 'function') {
            input.updateVisuals();
        }

        if (expandIcon) {
            expandIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                const stateToModify = expansionStateForManualToggle || expansionStateForRender;
                const isCurrentlyExpanded = stateToModify.has(node.id);
                if (isCurrentlyExpanded) {
                    stateToModify.delete(node.id);
                    childrenContainer.style.display = 'none';
                    expandIcon.textContent = '▶';
                } else {
                    stateToModify.add(node.id);
                    if (!childrenContainer.hasChildNodes()) {
                        if (node.children) {
                            node.children.forEach(child => createTreeNode(child, childrenContainer, level + 1, ancestorMatches || currentNodeMatches));
                        }
                    }
                    childrenContainer.style.display = 'block';
                    expandIcon.textContent = '▼';
                }
            });
        }

        if (node.children && isExpanded) {
            node.children.forEach(child => createTreeNode(child, childrenContainer, level + 1, ancestorMatches || currentNodeMatches));
        }
    };

    createTreeNode(startNode, container, 0, false);
}
addSelectedNodesToStructure(parentStructure, levelNodes, selectedIds, level) {
    levelNodes.forEach(node => {
        if (selectedIds.has(node.id)) {
            const parent = this.findParent(this.treeData, node.id);
            let parentStruct = parentStructure;
            if (level > 1) {
                let current = parentStructure;
                for (let i = 1; i < level; i++) {
                    const nextParent = current.children.find(c => c.id === (i === level - 1 ? parent.id : c.id));
                    if (nextParent) {
                        current = nextParent;
                    } else {
                        break;
                    }
                }
                parentStruct = current;
            }
            if (!parentStruct.children) parentStruct.children = [];
            parentStruct.children.push({ id: node.id, children: [] });
        }
    });
}
serializeNodeWithSelectedChildren(node, structure) {
    const serialized = {
        id: node.id,
        content: {
            text: node.content.text,
            img: node.content.img,
            hideIcon: node.content.hideIcon || false,
            isTextOnly: node.content.isTextOnly || false,
            subBlocks: [...(node.content.subBlocks || [])],
            isHorizontal: node.content.isHorizontal || false,
            metricBlocks: node.content.metricBlocks ? [...node.content.metricBlocks] : [],
            isAuthority: node.content.isAuthority || false,
            absent269: node.content.absent269 || false,
            isPower269: node.content.isPower269 || false,
            isOKR: node.content.isOKR || false,
            isSubordinate: node.content.isSubordinate || false,
            isForAll: node.content.isForAll || false,
            isIndicator: node.content.isIndicator || false,
            indicators: node.content.isIndicator ? {...node.content.indicators} : null,
            files: [],
position: node.content.position || null
        },
        children: [],
        isExpanded: node.isExpanded
    };
    if (structure.children && structure.children.length > 0) {
        structure.children.forEach(childStruct => {
            const childNode = this.findNode(node, childStruct.id);
            if (childNode) {
                const childSerialized = this.serializeNodeWithSelectedChildren(childNode, childStruct);
                serialized.children.push(childSerialized);
            }
        });
    }

    return serialized;
}
pasteNode() {
    this.saveToHistory();
    try {
        if (!this.clipboard || !this.selectedNode) {
            this.showNotification('Нет узлов в буфере обмена или не выбран целевой узел');
            return;
        }

        if (this.clipboard.timestamp && Date.now() - this.clipboard.timestamp > 3600000) {
            if (!confirm('Скопированные данные устарели (старше 1 часа). Использовать их?')) {
                return;
            }
        }

        const processPastedNode = (nodeData) => {
            const newNode = this.restoreNodeWithChildren(nodeData);
            const markForUpdate = (node) => {
                node.needsClusterUpdate = true;
                node.children.forEach(markForUpdate);
            };
            markForUpdate(newNode);
            return newNode;
        };

        const handleCutOperation = (nodesData) => {
            if (!this.clipboard.isCutOperation) return;
            nodesData.forEach(nodeData => {
                const originalNode = this.findNode(this.treeData, nodeData.id);
                if (originalNode) {
                    const parent = this.findParent(this.treeData, nodeData.id);
                    if (parent) {
                        const copiedChildIds = this.getCopiedChildIds(nodeData);
                        const remainingChildren = originalNode.children.filter(child => !copiedChildIds.has(child.id));
                        const index = parent.children.indexOf(originalNode);
                        parent.children.splice(index + 1, 0, ...remainingChildren);
                        parent.children = parent.children.filter(child => child.id !== originalNode.id);
                    }
                }
            });
        };
        const pastedNodeNames = [];
        if (this.clipboard.isMultiCopy && this.clipboard.nodes) {
            this.clipboard.nodes.forEach(nodeData => pastedNodeNames.push(`"${nodeData.content.text}"`));
            this.logAction(`Вставлено узлов (${pastedNodeNames.length}) рядом с "${this.selectedNode.node.content.text}": ${pastedNodeNames.join(', ')}`);
        } else if (this.clipboard.node) {
            pastedNodeNames.push(`"${this.clipboard.node.content.text}"`);
            this.logAction(`Вставлен узел ${pastedNodeNames[0]} рядом с "${this.selectedNode.node.content.text}"`);
        }

        if (this.clipboard.isMultiCopy && this.clipboard.nodes) {
            const parent = this.findParent(this.treeData, this.selectedNode.node.id);
            const newNodes = this.clipboard.nodes.map(processPastedNode);

            if (parent) {
                const selectedIndex = parent.children.indexOf(this.selectedNode.node);
                parent.children.splice(selectedIndex + 1, 0, ...newNodes);
            } else {
                this.selectedNode.node.children.push(...newNodes);
            }

            handleCutOperation(this.clipboard.nodes);
            this.showNotification(`Вставлено ${newNodes.length} узлов с детьми`);

        } else if (this.clipboard.node) {
            const newNode = processPastedNode(this.clipboard.node);
            const parent = this.findParent(this.treeData, this.selectedNode.node.id);

            if (parent) {
                const selectedIndex = parent.children.indexOf(this.selectedNode.node);
                parent.children.splice(selectedIndex + 1, 0, newNode);
            } else {
                this.selectedNode.node.children.push(newNode);
            }

            handleCutOperation([this.clipboard.node]);
            this.showNotification(`Узел с детьми вставлен рядом с "${this.selectedNode.node.content.text}"`);
        }

        this.updateTree();
        this.saveData();
        this.clipboard = null;
        this.clearMultiSelection();

    } catch (error) {
        console.error('Ошибка вставки:', error);
        this.showNotification('Ошибка при вставке узла');
    }
}
getCopiedChildIds(nodeData) {
    const ids = new Set();
    if (nodeData.children) {
        nodeData.children.forEach(child => {
            ids.add(child.id);
            this.addAllChildIds(child, ids);
        });
    }
    return ids;
}
addAllChildIds(nodeData, ids) {
    if (nodeData.children) {
        nodeData.children.forEach(child => {
            ids.add(child.id);
            this.addAllChildIds(child, ids);
        });
    }
}
pasteNodeAsChild() {
    this.saveToHistory();
    try {
        if (!this.clipboard || !this.selectedNode) {
            this.showNotification('Нет узлов в буфере обмена или не выбран целевой узел');
            return;
        }

        if (this.clipboard.timestamp && Date.now() - this.clipboard.timestamp > 3600000) {
            if (!confirm('Скопированные данные устарели (старше 1 часа). Использовать их?')) {
                return;
            }
        }

        const processPastedNode = (nodeData) => {
            const newNode = this.restoreNodeWithChildren(nodeData);
            const markForUpdate = (node) => {
                node.needsClusterUpdate = true;
                node.children.forEach(markForUpdate);
            };
            markForUpdate(newNode);
            return newNode;
        };

        const handleCutOperation = (nodesData) => {
            if (!this.clipboard.isCutOperation) return;
            nodesData.forEach(nodeData => {
                const originalNode = this.findNode(this.treeData, nodeData.id);
                if (originalNode) {
                    const parent = this.findParent(this.treeData, nodeData.id);
                    if (parent) {
                        const copiedChildIds = this.getCopiedChildIds(nodeData);
                        const remainingChildren = originalNode.children.filter(child => !copiedChildIds.has(child.id));
                        const index = parent.children.indexOf(originalNode);
                        parent.children.splice(index + 1, 0, ...remainingChildren);
                        parent.children = parent.children.filter(child => child.id !== originalNode.id);
                    }
                }
            });
        };
        const pastedNodeNames = [];
        if (this.clipboard.isMultiCopy && this.clipboard.nodes) {
            this.clipboard.nodes.forEach(nodeData => pastedNodeNames.push(`"${nodeData.content.text}"`));
            this.logAction(`Вставлено узлов (${pastedNodeNames.length}) как дочерние к "${this.selectedNode.node.content.text}": ${pastedNodeNames.join(', ')}`);
        } else if (this.clipboard.node) {
            pastedNodeNames.push(`"${this.clipboard.node.content.text}"`);
            this.logAction(`Вставлен узел ${pastedNodeNames[0]} как дочерний к "${this.selectedNode.node.content.text}"`);
        }

        if (this.clipboard.isMultiCopy && this.clipboard.nodes) {
            const newNodes = this.clipboard.nodes.map(processPastedNode);
            this.selectedNode.node.children.push(...newNodes);
            handleCutOperation(this.clipboard.nodes);
            this.showNotification(`Вставлено ${newNodes.length} узлов как дочерние`);

        } else if (this.clipboard.node) {
            const newNode = processPastedNode(this.clipboard.node);
            this.selectedNode.node.children.push(newNode);
            handleCutOperation([this.clipboard.node]);
            this.showNotification(`Вставлен узел "${newNode.content.text}" как дочерний`);
        }

        this.updateTree();
        this.saveData();
        this.clipboard = null;
        this.clearMultiSelection();

    } catch (error) {
        console.error('Ошибка вставки как дочернего:', error);
        this.showNotification('Ошибка при вставке как дочернего: ' + error.message);
    }
}

pasteAsParent() {
    if (!this.selectedNode || !this.clipboard || this.clipboard.isMultiCopy || (this.clipboard.node && this.clipboard.node.children.length > 0)) {
        this.showNotification('Эта операция возможна только для одиночного узла, скопированного без дочерних элементов.', 'error');
        return;
    }

    const parent = this.findParent(this.treeData, this.selectedNode.node.id);
    if (!parent) {
        this.showNotification('Нельзя выполнить эту операцию для корневого узла.', 'error');
        return;
    }

    this.saveToHistory();

    const newNode = this.restoreNodeWithChildren(this.clipboard.node);
    const selected = this.selectedNode.node;
    const index = parent.children.findIndex(child => child.id === selected.id);

    this.logAction(`Узел "${newNode.content.text}" вставлен как родительский для "${selected.content.text}"`);

    const markForUpdate = (node) => {
        if (!node) return;
        node.needsClusterUpdate = true;
        node.children.forEach(markForUpdate);
    };
    markForUpdate(newNode);

    if (index !== -1) {
        newNode.children.push(selected);
        parent.children.splice(index, 1, newNode);
    }

    this.updateTree();
    this.saveData();
    this.showNotification(`Узел "${newNode.content.text}" стал родительским.`);
}
replaceNode() {
    // Проверяем, что в буфере одиночный узел без детей
    if (!this.selectedNode || !this.clipboard || this.clipboard.isMultiCopy || (this.clipboard.node && this.clipboard.node.children.length > 0)) {
        this.showNotification('Эта операция возможна только для одиночного узла, скопированного без дочерних элементов.', 'error');
        return;
    }

    const parent = this.findParent(this.treeData, this.selectedNode.node.id);
    if (!parent) {
        this.showNotification('Нельзя заменить корневой узел.', 'error');
        return;
    }

    this.saveToHistory(); 

    const newNode = this.restoreNodeWithChildren(this.clipboard.node);
    const selected = this.selectedNode.node;
    const index = parent.children.findIndex(child => child.id === selected.id);

    this.logAction(`Узел "${selected.content.text}" заменен на "${newNode.content.text}"`);
    const markForUpdate = (node) => {
        if (!node) return;
        node.needsClusterUpdate = true;
        node.children.forEach(markForUpdate);
    };
    markForUpdate(newNode);

    if (index !== -1) {
        newNode.children = selected.children; 
        parent.children.splice(index, 1, newNode);
    }

    this.selectedNode = null; 
    this.selectedNodeId = null;

    this.updateTree();
    this.saveData();
    this.showNotification(`Узел заменен на "${newNode.content.text}".`);
}
getCopiedChildIds(nodeData) {
    const copiedIds = new Set();
    const collectIds = (node) => {
        copiedIds.add(node.id);
        if (node.children) {
            node.children.forEach(child => collectIds(child));
        }
    };
    collectIds(nodeData);
    return copiedIds;
}
async checkClipboard() {
    if (!navigator.clipboard) return;
    
    try {
        const text = await navigator.clipboard.readText();
        try {
            const data = JSON.parse(text);
            if (data.version && (data.node || data.nodes)) {
                this.clipboard = data;
                return true;
            }
        } catch {
            return false;
        }
    } catch (err) {
        console.error('Clipboard check failed:', err);
        return false;
    }
    return false;
}
checkParentNodeState(parentNode) {
    const hasChildren = parentNode.children.length > 0;
    const element = document.querySelector(`[data-node-id="${parentNode.id}"] .node-content`);
    
    if (element) {
        if (hasChildren) {
            element.classList.remove('no-children');
        } else {
            element.classList.add('no-children');
        }
    }
    const grandParent = this.findParent(this.treeData, parentNode.id);
    if (grandParent) {
        this.checkParentNodeState(grandParent);
    }
}
serializeNode(node) {
    const cluster = this.clusters.get(node.id) || null;
    const serialized = {
        id: node.id,
        cluster: cluster,
        content: {
            text: node.content.text,
            img: node.content.img,
            hideIcon: node.content.hideIcon || false,
            isTextOnly: node.content.isTextOnly || false,
            subBlocks: [...(node.content.subBlocks || [])],
            isHorizontal: node.content.isHorizontal || false,
            metricBlocks: node.content.metricBlocks ? [...node.content.metricBlocks] : [],
            isAuthority: node.content.isAuthority || false,
            absent269: node.content.absent269 || false,
            isPower269: node.content.isPower269 || false,
            isOKR: node.content.isOKR || false,
            isSubordinate: node.content.isSubordinate || false,
            isForAll: node.content.isForAll || false,
            isIndicator: node.content.isIndicator || false,
            indicators: node.content.isIndicator ? {...node.content.indicators} : null,
            files: [...(node.content.files || [])],
position: node.content.position || null 
        },
        children: [],
        isExpanded: node.isExpanded
    };
    serialized.content.files = [];

    return serialized;
}
serializeNodeWithChildren(node) {
    const cluster = this.clusters.get(node.id) || null;
    const serialized = {
        id: node.id,
        cluster: cluster,
        content: {
            text: node.content.text,
            img: node.content.img,
            hideIcon: node.content.hideIcon || false,
            isTextOnly: node.content.isTextOnly || false,
            subBlocks: [...(node.content.subBlocks || [])],
            isHorizontal: node.content.isHorizontal || false,
            metricBlocks: node.content.metricBlocks ? [...node.content.metricBlocks] : [],
            isAuthority: node.content.isAuthority || false,
            absent269: node.content.absent269 || false,
            isPower269: node.content.isPower269 || false,
            isOKR: node.content.isOKR || false,
            isSubordinate: node.content.isSubordinate || false,
            isForAll: node.content.isForAll || false,
            isIndicator: node.content.isIndicator || false,
            indicators: node.content.isIndicator ? {...node.content.indicators} : null,
            files: [...(node.content.files || [])]
        },
        children: node.children.map(child => this.serializeNodeWithChildren(child)), 
        isExpanded: node.isExpanded
    };
    serialized.content.files = [];

    return serialized;
}
restoreNode(nodeData) {
    return {
        id: nodeData.id,
        content: {
            text: nodeData.content?.text || 'Новый узел',
            img: nodeData.content?.img || null,
            subBlocks: nodeData.content?.subBlocks || [],
            hideIcon: nodeData.content?.hideIcon || false,
            isTextOnly: nodeData.content?.isTextOnly || false,
            metricBlocks: nodeData.content?.metricBlocks || [],
            isHorizontal: nodeData.content?.isHorizontal || false,
            isOKR: nodeData.content?.isOKR || false,
            isAuthority: nodeData.content?.isAuthority || false,
            absent269: nodeData.content?.absent269 || false,
            isPower269: nodeData.content?.isPower269 || false,
            isSubordinate: nodeData.content?.isSubordinate || false,
            isForAll: nodeData.content?.isForAll || false,
            isIndicator: nodeData.content?.isIndicator || false,
            indicators: nodeData.content?.isIndicator ? {...nodeData.content.indicators} : null,
            files: nodeData.content?.files || [],
position: nodeData.content?.position || null 
        },
        children: [],
        isExpanded: nodeData.isExpanded !== undefined ? nodeData.isExpanded : true
    };
}
restoreNodeWithChildren(nodeData) {
    const node = {
        id: this.generateId(), 
        content: {
            text: nodeData.content?.text || 'Новый узел',
            img: nodeData.content?.img || null,
            subBlocks: nodeData.content?.subBlocks || [],
            hideIcon: nodeData.content?.hideIcon || false,
            isTextOnly: nodeData.content?.isTextOnly || false,
            metricBlocks: nodeData.content?.metricBlocks || [],
            isHorizontal: nodeData.content?.isHorizontal || false,
            isOKR: nodeData.content?.isOKR || false,
            isAuthority: nodeData.content?.isAuthority || false,
            absent269: nodeData.content?.absent269 || false,
            isPower269: nodeData.content?.isPower269 || false,
            isSubordinate: nodeData.content?.isSubordinate || false,
            isForAll: nodeData.content?.isForAll || false,
            isIndicator: nodeData.content?.isIndicator || false,
            indicators: nodeData.content?.isIndicator ? {...node.content.indicators} : null,
            files: nodeData.content?.files || [],
position: nodeData.content?.position || null 
        },
        children: (nodeData.children || []).map(child => this.restoreNodeWithChildren(child)),
        isExpanded: nodeData.isExpanded !== undefined ? nodeData.isExpanded : true
    };

    if (nodeData.cluster) {
        this.clusters.set(node.id, nodeData.cluster);
        if (!this.availableClusters.has(nodeData.cluster)) {
            this.availableClusters.add(nodeData.cluster);
        }
    }

    return node;
}
centerOnElement(element) {
    try {
        const treeContainer = this.elements.treeContainer;
        treeContainer.style.transition = '';
        
        const viewportCenterX = window.innerWidth / 2;
        const viewportCenterY = window.innerHeight / 2;
        
        const elementRect = element.getBoundingClientRect();
        
        const currentTransform = treeContainer.style.transform;
        const currentTranslateMatch = currentTransform.match(/translate\(([^,]+),\s*([^)]+)\)/);
        const currentTranslateX = currentTranslateMatch ? parseFloat(currentTranslateMatch[1]) : 0;
        const currentTranslateY = currentTranslateMatch ? parseFloat(currentTranslateMatch[2]) : 0;

        const elementCenterX = elementRect.left + elementRect.width / 2;
        const elementCenterY = elementRect.top + elementRect.height / 2;
        
        const deltaX = viewportCenterX - elementCenterX;
        const deltaY = viewportCenterY - elementCenterY;
        const newTranslateX = currentTranslateX + deltaX;
        const newTranslateY = currentTranslateY + deltaY;
        if (window.panZoomVars) {
            window.panZoomVars.translateX = newTranslateX;
            window.panZoomVars.translateY = newTranslateY;
            window.panZoomVars.scale = this.scale;
        }
        treeContainer.style.transition = 'transform 0.3s ease-out';
        treeContainer.style.transform = `translate(${newTranslateX}px, ${newTranslateY}px) scale(${this.scale})`;
        setTimeout(() => {
            treeContainer.style.transition = '';
        }, 300);
        
        element.classList.add('highlight-parent');
        setTimeout(() => {
            element.classList.remove('highlight-parent');
        }, 1500);
        
    } catch (error) {
        console.error('Ошибка при центрировании:', error);
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
        });
    }
}
changeZoom(delta) {
    const treeContainer = this.elements.treeContainer;
    this.scale = this.scale || 0.7; 
    this.scrollState = {
        scrollLeft: treeContainer.scrollLeft,
        scrollTop: treeContainer.scrollTop
    };

    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    
    const transform = treeContainer.style.transform;
    const translateMatch = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
    const currentTranslateX = translateMatch ? parseFloat(translateMatch[1]) : 0;
    const currentTranslateY = translateMatch ? parseFloat(translateMatch[2]) : 0;
    
    const oldScale = this.scale;
    this.scale = Math.max(0.5, Math.min(2, this.scale + delta));
    
    if (oldScale === this.scale) return;
    
    const scaleFactor = this.scale / oldScale;
    const newTranslateX = viewportCenterX + (currentTranslateX - viewportCenterX) * scaleFactor;
    const newTranslateY = viewportCenterY + (currentTranslateY - viewportCenterY) * scaleFactor;
    
    if (window.panZoomVars) {
        window.panZoomVars.scale = this.scale;
        window.panZoomVars.translateX = newTranslateX;
        window.panZoomVars.translateY = newTranslateY;
    }
    
    treeContainer.style.transform = `translate(${newTranslateX}px, ${newTranslateY}px) scale(${this.scale})`;
    
    requestAnimationFrame(() => {
        treeContainer.scrollLeft = this.scrollState.scrollLeft;
        treeContainer.scrollTop = this.scrollState.scrollTop;
    });
}
addSuperordinateAbove() {
    if (!this.selectedNode) {
        alert('Выберите узел!');
        return;
    }
    const selectedNode = this.selectedNode.node;
    const parent = this.findParent(this.treeData, selectedNode.id);

    if (!parent) {
        alert('Нельзя добавить узел выше корневого!');
        return;
    }
    const newNode = this.createNewNode('Новый родительский узел');
    const index = parent.children.indexOf(selectedNode);
    parent.children[index] = newNode;
    newNode.children.push(selectedNode);

    this.updateTree();
    this.saveData();
    this.showNotification('Добавлен узел на уровень выше');
}
expandAllNodes() {
    const expandRecursive = (node) => {
        node.isExpanded = true;
        node.children.forEach(expandRecursive);
    };
    
    expandRecursive(this.treeData);
    
    this.focusNodeId = this.selectedNode ? this.selectedNode.node.id : this.treeData.id;
    
    this.updateTree();
    this.saveData();
    this.showNotification('Все узлы развернуты');
}
toggle269Mark() {
this.saveToHistory();
    if (!this.selectedNode) {
        alert('Выберите узел для отметки!');
        return;
    }
    const node = this.selectedNode.node;
    node.content.absent269 = !node.content.absent269;
if (node.content.absent269) {
    node.content.isForAll = false;
    node.content.isPower269 = false;
    node.content.isSubordinate = false;
    node.content.isAuthority = false;
    node.content.isOKR = false; 
    node.content.isIndicator = false; 
}
    this.updateTree();
    this.saveData();
    
    this.showNotification(
        node.content.absent269 
            ? 'Узел отмечен как отсутствующий в 269-П'
            : 'Снята отметка об отсутствии в 269-П'
    );
}
toggleForAll() {
this.saveToHistory();
    if (!this.selectedNode) {
        alert('Выберите узел!');
        return;
    }
    const node = this.selectedNode.node;
    node.content.isForAll = !node.content.isForAll;
    if (node.content.isForAll) {
    node.content.absent269 = false;
    node.content.isPower269 = false;
    node.content.isSubordinate = false;
    node.content.isAuthority = false;
    node.content.isOKR = false; 
    node.content.isIndicator = false; 
}
    
    this.updateTree();
    this.saveData();
    this.showNotification(
        node.content.isForAll 
            ? 'Узел помечен как "Для всех сотрудников"'
            : 'Снята пометка "Для всех сотрудников"'
    );
}
toggleSubordinateMark() {
this.saveToHistory();
    if (!this.selectedNode) {
        alert('Выберите узел!');
        return;
    }
    const node = this.selectedNode.node;
    node.content.isSubordinate = !node.content.isSubordinate;
    if (node.content.isSubordinate) {
        const parent = this.findParent(this.treeData, node.id);
        if (parent) {
            node.content.masterId = parent.id;
        }
    } else {
        node.content.masterId = null;
    }

if (node.content.isSubordinate) {
    node.content.absent269 = false;
    node.content.isPower269 = false;
    node.content.isForAll = false;
    node.content.isAuthority = false;
    node.content.isOKR = false;
    node.content.isIndicator = false; 
}
    
    this.updateTree();
    this.saveData();
    this.showNotification(
        node.content.isSubordinate 
            ? 'Узел помечен как "Должностные регламенты"'
            : 'Снята пометка "Должностные регламенты"'
    );
}
toggleOKRMark() {
this.saveToHistory();
    if (!this.selectedNode) {
        alert('Выберите узел!');
        return;
    }
    const node = this.selectedNode.node;
    node.content.isOKR = !node.content.isOKR;
    if (node.content.isOKR) {
        node.content.absent269 = false;
        node.content.isPower269 = false;
        node.content.isForAll = false;
        node.content.isSubordinate = false;
        node.content.isAuthority = false;
        node.content.isIndicator = false;
    }
    this.updateTree();
    this.saveData();
    
    this.showNotification(
        node.content.isOKR 
            ? 'Узел помечен как "OKR (Цели и ключевые результаты)"'
            : 'Снята пометка "OKR (Цели и ключевые результаты)"'
    );
}
toggleIndicatorMark() {
this.saveToHistory();
    if (!this.selectedNode) {
        alert('Выберите узел!');
        return;
    }
    const node = this.selectedNode.node;
    node.content.isIndicator = !node.content.isIndicator;
    
    if (node.content.isIndicator) {
        node.content.indicators = {
            years: [2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030],
           stages: ["Выделено. руб", "Этап 2", "Этап 3", "Вес. значение"],
values: Array(9).fill().map(() => Array(4).fill(0)),
            metrics: []
        };
 node.content.absent269 = false;
    node.content.isPower269 = false;
    node.content.isForAll = false;
    node.content.isSubordinate = false;
    node.content.isAuthority = false;
    node.content.isOKR = false; 
    }
    this.updateTree();
    this.saveData();
    this.showNotification(
        node.content.isIndicator 
            ? 'Узел помечен как "Государственная программа"'
            : 'Снята пометка "Государственная программа"'
    );
}
toggleAuthorityMark() {
this.saveToHistory();
    if (!this.selectedNode) {
        alert('Выберите узел!');
        return;
    }
    const node = this.selectedNode.node;
    node.content.isAuthority = !node.content.isAuthority;
if (node.content.isAuthority) {
    node.content.absent269 = false;
    node.content.isPower269 = false;
    node.content.isForAll = false;
    node.content.isSubordinate = false;
    node.content.isOKR = false; 
    node.content.isIndicator = false; 
}
    this.updateTree();
    this.saveData();
    this.showNotification(
        node.content.isAuthority 
            ? 'Узел помечен как "Идентичное полномочие"'
            : 'Снята пометка "Идентичное полномочие"'
    );
}
collapseParentNode() {
    try {
        if (!this.selectedNode) {
            throw new Error('Выберите узел!');
        }
        
        const parentNode = this.findParent(this.treeData, this.selectedNode.node.id);
        if (!parentNode) {
            throw new Error('Это корневой узел, у него нет родителя!');
        }
        const treeContainer = this.elements.treeContainer;
        const currentTransform = treeContainer.style.transform;
        const currentScroll = {
            left: treeContainer.scrollLeft,
            top: treeContainer.scrollTop
        };
        const parentElement = document.querySelector(`[data-node-id="${parentNode.id}"]`);
        if (!parentElement) return;
        
        const parentRect = parentElement.getBoundingClientRect();
        const parentCenter = {
            x: parentRect.left + parentRect.width / 2,
            y: parentRect.top + parentRect.height / 2
        };
        const collapseAllChildren = (node) => {
            node.isExpanded = false;
            node.children.forEach(child => collapseAllChildren(child));
        };
        
        collapseAllChildren(parentNode);
        this.focusNodeId = parentNode.id;

        this.skipScrollRestore = true;
        this.updateTree();
        this.skipScrollRestore = false;

        requestAnimationFrame(() => {
            treeContainer.style.transform = currentTransform;
            
            const newParentElement = document.querySelector(`[data-node-id="${parentNode.id}"]`);
            if (!newParentElement) return;
            
            const newParentRect = newParentElement.getBoundingClientRect();
            const newParentCenter = {
                x: newParentRect.left + newParentRect.width / 2,
                y: newParentRect.top + newParentRect.height / 2
            };
            const deltaX = parentCenter.x - newParentCenter.x;
            const deltaY = parentCenter.y - newParentCenter.y;
            
            treeContainer.scrollLeft = currentScroll.left + deltaX;
            treeContainer.scrollTop = currentScroll.top + deltaY;
            newParentElement.classList.add('highlight-parent');
            setTimeout(() => {
                newParentElement.classList.remove('highlight-parent');
            }, 1000);
        });
        this.saveData();
        this.showNotification('Родительский узел и все его внутренние узлы свернуты');
    } catch (error) {
        alert(error.message);
    }
}
saveScrollPosition() {
    const treeContainer = this.elements.treeContainer;
    if (treeContainer) {
        this.scrollPosition = {
            scrollLeft: treeContainer.scrollLeft,
            scrollTop: treeContainer.scrollTop,
            transform: treeContainer.style.transform || 'translate(0px, 0px) scale(1)'
        };
    }
}
restoreScrollPosition() {
    if (!this.scrollPosition) return;
    
    const treeContainer = this.elements.treeContainer;
    if (!treeContainer) return;
    requestAnimationFrame(() => {
        treeContainer.scrollLeft = this.scrollPosition.scrollLeft;
        treeContainer.scrollTop = this.scrollPosition.scrollTop;
        
        if (this.scrollPosition.transform) {
            treeContainer.style.transform = this.scrollPosition.transform;
        }
    });
}
async exportToJSON() {
  try {
    const imagesToSave = {};
    for(const [key, value] of Object.entries(this.imagesData)) {
      if(value.startsWith('data:image')) {
        imagesToSave[key] = value;
      }
    }
    
    const data = {
      version: '2.8',
      tree: this.serializeTree(this.treeData),
      images: imagesToSave,
      filesData: this.filesData,
      clusters: Array.from(this.clusters.entries()), 
      availableClusters: Array.from(this.availableClusters), 
      settings: {
        nodeCounter: this.nodeCounter,
        darkMode: this.darkMode,
        activeCluster: this.activeCluster 
      },
      timestamp: Date.now()
    };

    const jsonString = JSON.stringify(data);
    
    const blob = new Blob([jsonString], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tree-project_${Date.now()}.json`;
    link.click();
    
    this.showNotification('Проект успешно экспортирован в JSON');
  } catch(error) {
    console.error('Ошибка экспорта:', error);
    this.showNotification(`Ошибка экспорта: ${error.message}`);
  }
}
async importFromJSON() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const jsonString = e.target.result;
          const data = JSON.parse(jsonString);
          
          if (!data.version || data.version < '2.0') {
            throw new Error('Устаревший формат файла');
          }
          const validatedImages = {};
          for(const [key, value] of Object.entries(data.images || {})) {
            if(typeof value === 'string' && value.startsWith('data:image')) {
              validatedImages[key] = value;
            }
          }
          this.imagesData = validatedImages;
          this.nodeCounter = data.settings.nodeCounter || 1;
          this.treeData = this.restoreTree(data.tree);
          this.filesData = data.filesData || {};
          if (data.version >= '2.7') {
            this.clusters = new Map(data.clusters || []);
            this.availableClusters = new Set(data.availableClusters || []);
            this.activeCluster = data.settings?.activeCluster || null;
          } else {
            this.clusters = new Map();
            this.availableClusters = new Set();
            this.activeCluster = null;
          }
          this.updateClusterSelect();
this.saveToHistory(true, true);
          this.updateTree();
          this.saveData();
          
          this.showNotification('Проект успешно импортирован!');
          resolve(true);
       } catch(error) {
          console.error('Ошибка импорта:', error);
          this.showNotification(`Ошибка импорта: ${error.message}`);
          resolve(false);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}
  showNotification(text) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = text;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }

  addSubBlock(node) {
    node.content.subBlocks = node.content.subBlocks || [];
    node.content.subBlocks.push('Новый подблок');
    this.updateTree();
    this.saveData();
  }
editSubBlock(node, index) {
    let currentText = node.content.subBlocks[index];
    
    const newText = prompt('Редактировать подблок:', currentText);
    if(newText !== null) {
        let processedText = newText.trim();
        if (this.isValidEmail(processedText)) {
            processedText = processedText.toLowerCase();
        } 
        else if (this.isValidUrl(processedText)) {
            processedText = processedText.startsWith('http') ? processedText : `https://${processedText}`;
        }
        
        node.content.subBlocks[index] = processedText;
        this.updateTree();
        this.saveData();
    }
}
  removeSubBlock(node, index) {
    if(confirm('Удалить этот подблок?')) {
      node.content.subBlocks.splice(index, 1);
      this.updateTree();
      this.saveData();
    }
  }

  handleDragOver(e) {
    e.preventDefault();
    if(e.dataTransfer.types.includes('Files')) {
      this.elements.dropZone.classList.add('active');
    }
  }

  handleFileDrop(e) {
    e.preventDefault();
    this.elements.dropZone.classList.remove('active');
    const files = e.dataTransfer.files;
    if(files.length === 0) return;
    const file = files[0];
    if(file.name.endsWith('.html')) {
      this.handleProjectImport(file);
    } else if(file.type.startsWith('image/') && this.selectedNode) {
      this.handleImageUpload(file, this.selectedNode.node);
    }
  }
async handleFileUpload(file, node) {
    if (!['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
        alert('Пожалуйста, выберите XLSX или Word файл');
        return;
    }

    try {
        const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const arrayBuffer = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
        this.filesData[fileId] = {
            name: file.name,
            type: file.type,
            size: file.size,
            lastModified: file.lastModified
        };

        await this.db.saveFile(fileId, {
            name: file.name,
            type: file.type,
            data: arrayBuffer,
            size: file.size,
            lastModified: file.lastModified
        });
        node.content.files = node.content.files || [];
        node.content.files.push(fileId);

        this.updateTree();
        this.saveData();
        this.showNotification(`Файл "${file.name}" успешно загружен`);

    } catch(error) {
        console.error('Error uploading file:', error);
        alert('Ошибка загрузки файла: ' + error.message);
    }
}

async downloadFile(fileId) {
    try {
        const fileMeta = this.filesData[fileId];
        if (!fileMeta) throw new Error('File not found');
        const fileData = await this.db.getFile(fileId);
        if (!fileData) throw new Error('File data not found');
        const blob = new Blob([fileData.data], { type: fileData.type });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = fileData.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 100);
        
    } catch(error) {
        console.error('Download error:', error);
        alert('Ошибка загрузки файла: ' + error.message);
    }
}
async removeFile(node, fileId) {
    if(confirm('Удалить этот файл?')) {
        try {
            node.content.files = node.content.files.filter(id => id !== fileId);
            
            delete this.filesData[fileId];
            
            await this.db.deleteFile(fileId);
            
            this.updateTree();
            this.saveData();
            this.showNotification('Файл удален');
            
        } catch(error) {
            console.error('Remove file error:', error);
            alert('Ошибка удаления файла: ' + error.message);
        }
    }
}
  async handleProjectImport(file) {
    try {
      const text = await file.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const scriptContent = doc.querySelector('script:last-child').innerHTML;
      const compressedData = scriptContent.match(/compressedData\s*=\s*"([^"]+)"/)[1];
      const jsonString = LZString.decompressFromBase64(compressedData);
      const data = JSON.parse(jsonString);
      this.importData(data);
      alert('Проект успешно загружен!');
    } catch(error) {
      console.error('Ошибка импорта:', error);
      alert('Ошибка загрузки файла проекта');
    }
  }

importData(data) {
  try {
    console.log('importData: начал выполнение с данными:', {
      version: data.version,
      hasTree: !!data.tree,
      hasImages: !!data.images
    });
    
    if (data.version && data.version !== '1.0') {
      const userConfirmed = confirm(
        'Этот файл создан в другой версии приложения.\n' +
        'Возможны ошибки в работе. Продолжить импорт?'
      );
      if (!userConfirmed) {
        throw new Error('Импорт отменен пользователем');
      }
    }
    
    this.imagesData = data.images || {};
    this.nodeCounter = data.counter || 1;
    this.treeData = this.restoreTree(data.tree);
    
    if (this.treeData) {
        const walkTree = (node) => {
            if (node.content.hideIcon === undefined) {
                node.content.hideIcon = false;
            }
            node.children.forEach(walkTree);
        };
        walkTree(this.treeData);
    }
    
    this.filesData = data.filesData || {}; 
    this.darkMode = data.theme === 'dark';
    document.documentElement.classList.toggle('dark', this.darkMode);
    
    if (data.version >= '2.7') {
        this.clusters = new Map(data.clusters || []);
        this.availableClusters = new Set(data.availableClusters || []);
        this.activeCluster = data.settings?.activeCluster || null;
    }
    
    this.updateTree();
    this.saveToHistory(true, true);
    this.treeData.isExpanded = true;
    this.saveData();
    this.setupEventListeners();
    
    // Пробуем setupDragAndDrop, но не прерываем импорт при ошибке
    try {
        this.setupDragAndDrop();
    } catch (dragError) {
        console.warn('Ошибка в setupDragAndDrop, но импорт продолжается:', dragError);
    }
    
    console.log('importData: успешно завершен');
    return true;
    
  } catch(error) {
    console.error('Ошибка импорта:', error);
    this.showNotification(`Ошибка загрузки: ${error.message}`);
    throw new Error('Некорректный формат файла');
  }
}
uploadFile() { 
    if(!this.selectedNode) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.doc,.docx';
    input.onchange = (e) => {
        if(e.target.files[0]) this.handleFileUpload(e.target.files[0], this.selectedNode.node);
    };
    input.click();
}
uploadFileForMetric(node, blockIndex, quarterIndex) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.doc,.docx,.pdf,.txt';
    input.onchange = async (e) => {
        if (e.target.files[0]) {
            try {
                const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                const file = e.target.files[0];
                this.filesData[fileId] = {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    lastModified: file.lastModified
                };

                node.content.metricBlocks[blockIndex].quarters[quarterIndex].files.push(fileId);
                
                this.updateTree();
                this.saveData();
                this.showNotification(`Файл "${file.name}" прикреплен к метрике`);
            } catch (error) {
                console.error('Ошибка загрузки файла:', error);
                alert('Ошибка загрузки файла');
            }
        }
    };
    input.click();
}
downloadFile(fileId) {
    const file = this.filesData[fileId];
    if (!file) return;

    const link = document.createElement('a');
    link.href = file.data;
    link.download = file.name;
    link.click();
}

removeFile(node, fileId) {
    if(confirm('Удалить этот файл?')) {
        node.content.files = node.content.files.filter(id => id !== fileId);
        delete this.filesData[fileId];
        this.updateTree();
        this.saveData();
    }
}
setupDragAndDrop() {
    try {
        console.log('setupDragAndDrop: начал выполнение');
        
        // Проверяем существование методов перед вызовом bind
        if (typeof this.handleDragOver === 'function') {
            this.handleDragOverBound = this.handleDragOver.bind(this);
        } else {
            console.warn('handleDragOver не является функцией, создаем заглушку');
            this.handleDragOverBound = () => console.log('handleDragOver заглушка');
        }
        
        if (typeof this.handleDrop === 'function') {
            this.handleDropBound = this.handleDrop.bind(this);
        } else {
            console.warn('handleDrop не является функцией, создаем заглушку');
            this.handleDropBound = () => console.log('handleDrop заглушка');
        }
        
        if (typeof this.handleDragEnd === 'function') {
            this.handleDragEndBound = this.handleDragEnd.bind(this);
        } else {
            console.warn('handleDragEnd не является функцией, создаем заглушку');
            this.handleDragEndBound = () => console.log('handleDragEnd заглушка');
        }
        
        this.injectDragDropStyles();
        
        // Создаем drop indicator если его нет
        if (!this.dropIndicator) {
            this.dropIndicator = document.createElement('div');
            this.dropIndicator.className = 'drop-indicator';
            this.dropIndicator.style.cssText = `
                display: none;
                position: absolute;
                pointer-events: none;
                z-index: 1000;
                background: var(--accent-color, #007bff);
                opacity: 0.5;
                border-radius: 4px;
            `;
            document.body.appendChild(this.dropIndicator);
            console.log('dropIndicator создан');
        }
        
        // Удаляем старые обработчики если они есть
        document.removeEventListener('dragover', this.handleDragOverBound);
        document.removeEventListener('drop', this.handleDropBound);
        document.removeEventListener('dragend', this.handleDragEndBound);
        
        // Добавляем новые обработчики
        document.addEventListener('dragover', this.handleDragOverBound);
        document.addEventListener('drop', this.handleDropBound);
        document.addEventListener('dragend', this.handleDragEndBound);
        
        console.log('setupDragAndDrop: успешно завершен');
        
    } catch (error) {
        console.error('Ошибка в setupDragAndDrop:', error);
        // Создаем заглушки чтобы приложение продолжало работать
        this.handleDragOverBound = () => {};
        this.handleDropBound = () => {};
        this.handleDragEndBound = () => {};
    }
}
injectDragDropStyles() {
    if (document.getElementById('drag-drop-styles')) {
        return;
    }
    const style = document.createElement('style');
    style.id = 'drag-drop-styles';
    style.textContent = `
        .node-content.drop-target-child {
            box-shadow: 0 0 0 3px var(--accent-color) !important;
            border-color: var(--accent-color) !important;
            transition: box-shadow 0.2s ease, border-color 0.2s ease;
        }
    `;
    document.head.appendChild(style);
}

handleNodeDragStart(e, node, element) {
    if (node === this.treeData) {
        e.preventDefault();
        return;
    }
    this.draggedNode = node;
    this.draggedElement = element;
    element.classList.add('dragging');
    document.body.style.cursor = 'grabbing';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.id);
}
handleNodeDragOver(e, targetNode, targetElement) {
    e.preventDefault();
    if (!this.draggedNode || this.draggedNode === targetNode) return;
    if (this.isDescendant(targetNode, this.draggedNode.id)) {
        this.hideDropIndicator();
        e.dataTransfer.dropEffect = 'none'; 
        return;
    }

    e.dataTransfer.dropEffect = 'move';
    this.showDropIndicator(e, targetNode, targetElement);
}
handleNodeDrop(e, targetNode, targetElement) {
    e.preventDefault();
    e.stopPropagation();

    if (!this.draggedNode || this.draggedNode === targetNode || this.isDescendant(targetNode, this.draggedNode.id)) {
        this.hideDropIndicator();
        return;
    }
    this.saveToHistory(); 
    const insertPosition = this.getInsertPosition(e, targetNode, targetElement);
    this.moveNode(this.draggedNode, targetNode, insertPosition);
    this.hideDropIndicator();
}

removeNodeFromSubtree(startNodeOrArray, nodeId) {
    const removeRecursive = (current, parent) => {
        if (current.children) {
            const initialLength = current.children.length;
            current.children = current.children.filter(child => child.id !== nodeId);

            if (current.children.length < initialLength) {
                return true;
            }

            for (const child of current.children) {
                if (removeRecursive(child, current)) {
                    return true;
                }
            }
        }
        return false;
    };

    if (Array.isArray(startNodeOrArray)) {
        this.liquidationDialogState.restructuredSubtree = startNodeOrArray.filter(rootNode => {
            if (rootNode.id === nodeId) return false; 
            removeRecursive(rootNode, null); 
            return true;
        });
    } else if (startNodeOrArray) {
        if (startNodeOrArray.id === nodeId) {
            this.liquidationDialogState.restructuredSubtree = null; 
        } else {
            removeRecursive(startNodeOrArray, null);
        }
    }
}
showDropIndicator(e, targetNode, targetElement) {
    const rect = targetElement.getBoundingClientRect();
    const insertPosition = this.getInsertPosition(e, targetNode, targetElement);
    const currentlyHighlighted = document.querySelector('.node-content.drop-target-child');
    if (currentlyHighlighted) {
        currentlyHighlighted.classList.remove('drop-target-child');
    }

    this.dropIndicator.style.display = 'block';
    const targetContent = targetElement.querySelector('.node-content');

    if (insertPosition === 'child') {
        targetContent.classList.add('drop-target-child');
        this.dropIndicator.style.display = 'none'; 
    } else {
        targetContent.classList.remove('drop-target-child'); 

        const parentOfTarget = this.findParent(this.treeData, targetNode.id);
        let isHorizontalLayout = false;
        if (parentOfTarget) {
            const parentElement = document.querySelector(`[data-node-id="${parentOfTarget.id}"]`);
            if (parentElement) {
                const childrenContainer = parentElement.querySelector('.children');
                if (childrenContainer) {
                    const style = window.getComputedStyle(childrenContainer);
                    isHorizontalLayout = style.flexDirection === 'row' || style.display === 'grid';
                }
            }
        }
        if (isHorizontalLayout) {
            this.dropIndicator.style.width = '3px';
            this.dropIndicator.style.height = rect.height + 'px';
            this.dropIndicator.style.top = rect.top + 'px';
            this.dropIndicator.style.left = (insertPosition === 'before' ? rect.left - 6 : rect.right + 3) + 'px';
        } else {
            this.dropIndicator.style.width = rect.width + 'px';
            this.dropIndicator.style.height = '3px';
            this.dropIndicator.style.left = rect.left + 'px';
            this.dropIndicator.style.top = (insertPosition === 'before' ? rect.top - 3 : rect.bottom) + 'px';
        }
    }
}
hideDropIndicator() {
    if (this.dropIndicator) {
        this.dropIndicator.style.display = 'none';
    }
    const highlighted = document.querySelector('.node-content.drop-target-child');
    if (highlighted) {
        highlighted.classList.remove('drop-target-child');
    }
}
getInsertPosition(e, targetNode, targetElement) {
    const rect = targetElement.getBoundingClientRect();
    const parentOfTarget = this.findParent(this.treeData, targetNode.id);
    let isHorizontalLayout = false;
    if (parentOfTarget) {
        const parentElement = document.querySelector(`[data-node-id="${parentOfTarget.id}"]`);
        if (parentElement) {
            const childrenContainer = parentElement.querySelector('.children');
            if (childrenContainer) {
                 const style = window.getComputedStyle(childrenContainer);
                 isHorizontalLayout = style.flexDirection === 'row' || style.display === 'grid';
            }
        }
    }
    const dropZoneRatio = 0.25;

    if (isHorizontalLayout) {
        const zoneWidth = rect.width * dropZoneRatio;
        if (e.clientX < rect.left + zoneWidth) return 'before';
        if (e.clientX > rect.right - zoneWidth) return 'after';
    } else {
        const zoneHeight = rect.height * dropZoneRatio;
        if (e.clientY < rect.top + zoneHeight) return 'before';
        if (e.clientY > rect.bottom - zoneHeight) return 'after';
    }
    return 'child';
}

moveNode(draggedNode, targetNode, position) {
    this.saveToHistory();
    const oldParent = this.findParent(this.treeData, draggedNode.id);
    this.removeNodeFromParent(draggedNode);

    if (position === 'child') {
        targetNode.children.push(draggedNode);
        targetNode.isExpanded = true;
    } else {
        const targetParent = this.findParent(this.treeData, targetNode.id);
        if (!targetParent) return;
        
        const targetIndex = targetParent.children.indexOf(targetNode);
        const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
        targetParent.children.splice(insertIndex, 0, draggedNode);
    }

    if (oldParent) {
        this.checkParentNodeState(oldParent);
    }
    
    this.updateTree();
    this.saveData();
    this.showNotification('Узел перемещен');
}
findParent(nodeToSearchIn, targetNodeId) {

    if (!nodeToSearchIn.children) {
        return null;
    }


    for (const child of nodeToSearchIn.children) {
        if (child.id === targetNodeId) {
            return nodeToSearchIn;
        }

        const found = this.findParent(child, targetNodeId);


        if (found) {
            return found;
        }
    }

    return null;
}
removeNodeFromParent(node) {
    const parent = this.findParent(this.treeData, node.id);
    if (parent) {
        parent.children = parent.children.filter(child => child !== node);
this.checkParentNodeState(parent); 
    }
}

isDescendant(node, ancestorId) {
    if (node.id === ancestorId) return true;
    
    for (const child of node.children) {
        if (this.isDescendant(child, ancestorId)) {
            return true;
        }
    }
    return false;
}
setupZoom() {
    const treeContainer = this.elements.treeContainer;
    let scale = 0.3;
    const minScale = 0.3;
    const maxScale = 2;
    let isDragging = false;
    let startX, startY;
    let translateX = 0, translateY = 0;
    
    this.scale = scale;
    treeContainer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    
    treeContainer.addEventListener('wheel', (event) => {
        event.preventDefault();
        
        // Изменяем масштаб ТОЛЬКО если нажат Ctrl И НЕ нажат Shift
        if (event.ctrlKey && !event.shiftKey) {
            const delta = event.deltaY > 0 ? -0.1 : 0.1;
            const newScale = Math.max(minScale, Math.min(maxScale, scale + delta));
            
            const rect = treeContainer.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            
            const contentX = (mouseX - translateX) / scale;
            const contentY = (mouseY - translateY) / scale;
            
            scale = newScale;
            this.scale = scale;
            
            translateX = mouseX - contentX * scale;
            translateY = mouseY - contentY * scale;
    updateTransform();
        } else {

            if (event.shiftKey) {

                translateX -= event.deltaY;
            } else {

                translateY -= event.deltaY;
            }
            updateTransform();
        }
    });
    treeContainer.addEventListener('contextmenu', (event) => {
        event.preventDefault();
    });

    treeContainer.addEventListener('mousedown', (event) => {
        if (event.button === 2) { 
            isDragging = true;
            startX = event.clientX - translateX;
            startY = event.clientY - translateY;
            treeContainer.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none'; 
        }
    });

    document.addEventListener('mousemove', (event) => {
        if (isDragging) {
            translateX = event.clientX - startX;
            translateY = event.clientY - startY;
            updateTransform();
        }
    });
    document.addEventListener('mouseup', (event) => {
        if (event.button === 2) { 
            isDragging = false;
            treeContainer.style.cursor = 'grab';
            document.body.style.userSelect = ''; 
        }
    });
    treeContainer.style.cursor = 'grab';
    document.addEventListener('keydown', (e) => {
        const step = 50; 
        
        switch(e.key) {
            case 'ArrowUp':
                translateY += step;
                break;
            case 'ArrowDown':
                translateY -= step;
                break;
            case 'ArrowLeft':
                translateX += step;
                break;
            case 'ArrowRight':
                translateX -= step;
                break;
            default:
                return;
        }
        updateTransform();
        e.preventDefault();
    });
    function updateTransform() {
        treeContainer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        if (window.panZoomVars) {
            window.panZoomVars.scale = scale;
            window.panZoomVars.translateX = translateX;
            window.panZoomVars.translateY = translateY;
        }
    }

    this.resetPosition = () => {
        scale = 0.7;
        this.scale = scale;
        translateX = 0;
        translateY = 0;
        updateTransform();
    };
}

async saveData() {
    try {
        const dataToSave = {
            version: '2.8', 
            tree: this.serializeTree(this.treeData),
            images: this.imagesData,
            filesData: this.filesData,
            clusters: Array.from(this.clusters.entries()),
            availableClusters: Array.from(this.availableClusters),
            settings: {
                nodeCounter: this.nodeCounter,
                darkMode: this.darkMode,
                activeCluster: this.activeCluster,
                uiSettings: this.uiSettings 
            },
            timestamp: Date.now()
        };
        await this.db.saveData('treeData', dataToSave);
        const saveBtn = this.elements.saveBtn;
        saveBtn.textContent = '✓ Сохранено';
        saveBtn.style.background = 'linear-gradient(145deg, #4CAF50, #66BB6A)';

        setTimeout(() => {
            saveBtn.textContent = '💾 Сохранить';
            saveBtn.style.background = 'linear-gradient(145deg, var(--primary-color), #6B9EBF)';
        }, 2000);

    } catch(error) {
        console.error('Полная ошибка сохранения:', {
            error: error,
            clusters: this.clusters,
            availableClusters: this.availableClusters
        });

        this.showNotification(`Ошибка сохранения: ${error.message}`);
    }
}
  loadFromURL() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const dataParam = urlParams.get('data');
      if(dataParam) {
        const jsonString = LZString.decompressFromBase64(dataParam);
        const data = JSON.parse(jsonString);
        this.importData(data);
        return true;
      }
    } catch(error) {
      console.error('Ошибка загрузки из URL:', error);
    }
    return false;
  }
async loadFromLocalStorage() {
    try {
        const savedData = await this.db.loadData('treeData');

        if (savedData) {
            this.imagesData = savedData.images || {};
            this.nodeCounter = savedData.settings?.nodeCounter || savedData.counter || 1;
            this.treeData = this.restoreTree(savedData.tree) || this.createNewNode('Главный узел');
            this.resetTreeState();

            if (savedData.clusters) {
                this.clusters = new Map(savedData.clusters);
            }
            if (savedData.availableClusters) {
                this.availableClusters = new Set(savedData.availableClusters);
            }

            this.activeCluster = null;
            if (savedData.settings?.uiSettings) {
                this.uiSettings = savedData.settings.uiSettings;
            }

            this.updateClusterSelect();

            if (this.treeData) {
                const walkTree = (node) => {
                    if (node.content.hideIcon === undefined) {
                        node.content.hideIcon = false;
                    }
                    node.children.forEach(walkTree);
                };
                walkTree(this.treeData);
            }

            this.filesData = savedData.filesData || {};

            if (this.treeData) {
                this.treeData.isExpanded = true;
            }

            this.darkMode = savedData.settings?.darkMode || savedData.theme === 'dark';
            document.documentElement.classList.toggle('dark', this.darkMode);

            this.saveToHistory(true, true);
            return;
        }
        const compressedLocal = localStorage.getItem('treeAppData');
        if (!compressedLocal) {
            this.treeData = this.createNewNode('Главный узел');
            this.treeData.isExpanded = true;
            this.filesData = {};
            this.clusters = new Map();
            this.availableClusters = new Set();
            this.activeCluster = null;

            this.saveToHistory(true, true);
            return;
        }

        let jsonString;
        if (typeof LZString !== 'undefined') {
            jsonString = LZString.decompressFromUTF16(compressedLocal) || compressedLocal;
        } else {
            jsonString = compressedLocal;
        }

        const data = JSON.parse(jsonString);
        this.importData(data);

        await this.saveData();
        this.saveToHistory(true, true);

    } catch(error) {
        console.error('Ошибка загрузки:', error);
        this.treeData = this.createNewNode('Главный узел');
        this.treeData.isExpanded = true;
        this.filesData = {};
        this.clusters = new Map();
        this.availableClusters = new Set();
        this.activeCluster = null;
        this.saveToHistory(true, true);
    }
}
async loadFilesData() {
    try {
        const files = await this.db.getAllFiles();
        files.forEach(file => {
            this.filesData[file.id] = {
                name: file.name,
                type: file.type,
                size: file.size,
                lastModified: file.lastModified
            };
        });
    } catch(error) {
        console.error('Ошибка загрузки файлов:', error);
    }
}
            serializeTree(node) {
                return {
                    id: node.id,
                    needsClusterUpdate: node.needsClusterUpdate || undefined,
                    circularlyReplaced: node.circularlyReplaced || undefined,
                    content: {
                        text: node.content.text,
                        img: node.content.img,
                        hideIcon: node.content.hideIcon || false,
                        isTextOnly: node.content.isTextOnly || false,
                        subBlocks: node.content.subBlocks || [],
                        isHorizontal: node.content.isHorizontal || false,
                        metricBlocks: node.content.metricBlocks || [],
                        isAuthority: node.content.isAuthority || false,
                        absent269: node.content.absent269 || false,
                        isPower269: node.content.isPower269 || false,
                        isOKR: node.content.isOKR || false,
                        isSubordinate: node.content.isSubordinate || false,
                        isForAll: node.content.isForAll || false,
                        isIndicator: node.content.isIndicator || false,
                        isOrganizationalEvent: node.content.isOrganizationalEvent || false,
                        indicators: node.content.isIndicator ? { ...node.content.indicators, result: node.content.indicators.result || '' } : null,
                        files: node.content.files || [],
position: node.content.position || null
                    },
                    children: node.children.map(child => this.serializeTree(child)),
                    isExpanded: node.isExpanded
                };
            }

            restoreTree(data) {
                if (!data) return null;
                const restoreNode = (nodeData) => {
                    const restoredNode = {
                        id: nodeData.id,
                        needsClusterUpdate: nodeData.needsClusterUpdate,
                        circularlyReplaced: nodeData.circularlyReplaced,
                        content: {
                            text: nodeData.content?.text || 'Новый узел',
                            img: nodeData.content?.img || null,
                            subBlocks: nodeData.content?.subBlocks || [],
                            hideIcon: nodeData.content?.hideIcon || false,
                            isTextOnly: nodeData.content?.isTextOnly || false,
                            metricBlocks: nodeData.content?.metricBlocks || [],
                            isHorizontal: nodeData.content?.isHorizontal || false,
                            isOKR: nodeData.content?.isOKR || false,
                            isAuthority: nodeData.content?.isAuthority || false,
                            absent269: nodeData.content?.absent269 || false,
                            isPower269: nodeData.content?.isPower269 || false,
                            isSubordinate: nodeData.content?.isSubordinate || false,
                            isForAll: nodeData.content?.isForAll || false,
                            isIndicator: nodeData.content?.isIndicator || false,
                            isOrganizationalEvent: nodeData.content?.isOrganizationalEvent || false,
                            indicators: nodeData.content?.isIndicator ? {
                                years: nodeData.content.indicators?.years || [2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030],
                                stages: nodeData.content.indicators?.stages || ["Выделено. руб", "Этап 2", "Этап 3", "Вес. значение"],
                                values: nodeData.content.indicators?.values || Array(9).fill().map(() => Array(4).fill(0)),
                                metrics: nodeData.content.indicators?.metrics || [],
                                result: nodeData.content.indicators?.result || ''} : null,
                            files: nodeData.content?.files || [],
position: nodeData.content?.position || null

                        },
                        children: (nodeData.children || []).map(child => restoreNode(child)),
                        isExpanded: nodeData.isExpanded !== undefined ? nodeData.isExpanded : (nodeData === data)
                    };
                    return restoredNode;
                };
                const root = restoreNode(data);
                if (root.content?.isIndicator && root.content.indicators) {
                    if (root.content.indicators.values && root.content.indicators.values[0]?.length === 3) {
                        root.content.indicators.values = root.content.indicators.values.map(row => [0, ...row]);
                    }
                    if (!root.content.indicators.stages?.includes("Выделено. руб")) {
                        root.content.indicators.stages = ["Выделено. руб", ...(root.content.indicators.stages || ["Этап 2", "Этап 3", "Вес. значение"])];
                    }
                    if (root.content.indicators.result === undefined) {
                        root.content.indicators.result = '';
                    }
                }
                root.isExpanded = true;
                return root;
            }
createNewNode(text, img = null) {
    return {
        id: this.generateId(),
        content: {
            text,
            img,
            subBlocks: [],
            isHorizontal: false,
            absent269: false,
            isSubordinate: false,
            isPower269: false,
            isForAll: false
        },
        children: [],
        isExpanded: true
    };
}
  generateId() {
    return this.nodeCounter++;
  }
  findNode(node, nodeId) {
    if(node.id === nodeId) return node;
    for(const child of node.children) {
      const found = this.findNode(child, nodeId);
      if(found) return found;
    }
    return null;
  }
getNodeDepth(node) {
    let depth = 0;
    let parent = this.findParent(this.treeData, node.id);
    while(parent) {
        depth++;
        parent = this.findParent(this.treeData, parent.id);
    }
    return depth;
}

findParent(root, nodeId, parent = null) {
    if(root.id === nodeId) return parent;
    
    for(const child of root.children) {
        if(child.id === nodeId) return root;
        const found = this.findParent(child, nodeId, root);
        if(found) return found;
    }
    return null;
}
updateTree() {
    const treeContainer = this.elements.treeContainer;
    this.scrollState = {
        scrollLeft: treeContainer.scrollLeft,
        scrollTop: treeContainer.scrollTop,
        transform: treeContainer.style.transform || 'translate(0px, 0px) scale(1)'
    };
    treeContainer.innerHTML = '';
    treeContainer.appendChild(this.createNodeElement(this.treeData));
    
    requestAnimationFrame(() => {
        treeContainer.scrollLeft = this.scrollState.scrollLeft;
        treeContainer.scrollTop = this.scrollState.scrollTop;
        treeContainer.style.transform = this.scrollState.transform;
    });
    
    document.querySelectorAll('.node-content.subordinate').forEach(subNode => {
        const childrenContainer = subNode.nextElementSibling;
        if (childrenContainer) {
            childrenContainer.classList.add('compact-children');
        }
    });
}
shouldShowNode(node) {
    if (this.activeCluster) {
        const inCluster = this.isInCluster(node) || 
                        this.isParentOfCluster(node) || 
                        this.isChildOfCluster(node);
        if (node.content.isSubordinate && node.content.masterId) {
            const masterNode = this.findNode(this.treeData, node.content.masterId);
            const masterInCluster = masterNode && 
                                  (this.isInCluster(masterNode) || 
                                   this.isParentOfCluster(masterNode) || 
                                   this.isChildOfCluster(masterNode));
            
            if (!inCluster && !masterInCluster) return false;
        } else if (!inCluster) {
            return false;
        }
    }
    if (this.searchQuery) {
        return this.nodeMatchesSearch(node) || 
               this.isParentOfMatch(node) || 
               this.isDescendantOfMatch(node);
    }

    return true;
}
isInCluster(node) {
    return this.clusters.get(node.id) === this.activeCluster;
}

isParentOfCluster(node) {
    if (!this.activeCluster) return false;
    for (const child of node.children) {
        if (this.isInCluster(child) || this.isParentOfCluster(child)) {
            return true;
        }
    }
    return false;
}

isChildOfCluster(node) {
    if (!this.activeCluster || node === this.treeData) return false;
    
    const parent = this.findParent(this.treeData, node.id);
    if (!parent) return false;
    if (this.isInCluster(parent)) {
        return true;
    }
    if (node.content.isSubordinate && node.content.masterId) {
        const masterNode = this.findNode(this.treeData, node.content.masterId);
        if (masterNode && this.isInCluster(masterNode)) {
            return true;
        }
    }
    return this.isChildOfCluster(parent);
}
nodeMatchesSearch(node, query = this.searchQuery, isDeepSearch = false) {
    const currentQuery = query || this.searchQuery;
    if (!currentQuery) return false;

    const searchTerms = currentQuery.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    if (searchTerms.length === 0) return false;

    let nodeText = (
        node.content.text + ' ' +
        (node.content.subBlocks?.join(' ') || '')
    ).toLowerCase();
    if (isDeepSearch) {
        const fileNames = node.content.files?.map(f => this.filesData[f]?.name).join(' ') || '';
        nodeText += ' ' + fileNames.toLowerCase();
        nodeText += ' children:' + node.children.length;
    }
    return searchTerms.every(term => nodeText.includes(term));
}
isParentOfMatch(node, query = this.searchQuery, isDeepSearch = false) {
    const currentQuery = query || this.searchQuery;
    if (!currentQuery) return false; 

    for (const child of node.children) {
        if (this.nodeMatchesSearch(child, currentQuery, isDeepSearch) || this.isParentOfMatch(child, currentQuery, isDeepSearch)) {
            return true;
        }
    }
    return false;
}
isDescendantOfMatch(node) {
    if (!this.searchQuery || node === this.treeData) return false;
    
    const parent = this.findParent(this.treeData, node.id);
    if (!parent) return false;
    
    if (this.nodeMatchesSearch(parent) && this.shouldShowNode(parent)) {
        return true;
    }
    
    return this.isDescendantOfMatch(parent);
}

containsFuzzyMatch(text, term) {
    if (term.length < 3) return false;
    const words = text.split(/\s+/);
    return words.some(word => word.includes(term));
}
shouldUseGridLayout(node) {
    const depth = this.getNodeDepth(node);
    const childrenCount = node.children.length;

    if (depth === 0) {
        return false; 
    }
    if (depth === 1) {
        return childrenCount > 5;
    }

    if (depth === 2) {
        return false; 
    }

    if (depth >= 3) {
        return childrenCount > 4; 
    }
    
    return false;
}
createNodeElement(node) {

    if (node === this.treeData) {
        node.isExpanded = true;
    }

    const nodeElement = document.createElement('div');

    const useGridLayout = this.shouldUseGridLayout(node);
    if (useGridLayout !== node.wasGridLayout) {
    node.wasGridLayout = useGridLayout;
    if (node.children.length > 0) {
        setTimeout(() => this.showLayoutChangeNotification(node, useGridLayout), 100);
    }
}
    nodeElement.className = `node ${node.content.isHorizontal ? 'horizontal' : ''} ${node.isExpanded ? 'expanded' : 'collapsed'} ${useGridLayout ? 'grid-layout' : ''}`;
    
    nodeElement.setAttribute('data-node-id', node.id);
    
    const shouldShow = this.shouldShowNode(node) || this.isParentOfMatch(node);
    if (!shouldShow) {
        nodeElement.style.display = 'none';
        return nodeElement;
    }

    if (this.shouldShowNode(node)) {
        nodeElement.classList.add('search-match');
    }

    const depth = this.getNodeDepth(node);
const isThirdLevel = depth === 2; 
const isSeventhLevel = depth === 5; 
    const levelClass = `level-${(depth % 3) + 1}`;
    const content = document.createElement('div');
    if (node.content.isSubordinate) {
        content.classList.add('subordinate');
    }
    
    content.className = `node-content ${node.content.isHorizontal ? 'horizontal' : ''} ${levelClass}`;
if (node.children.length === 0) {
    content.classList.add('no-children');
} else {
    content.classList.remove('no-children');
}
if (node.content.absent269) {
    content.classList.add('absent-269');
    content.setAttribute('data-label', 'Нет в 269-П');
}
if (node.content.isPower269) {
    content.classList.add('power-269');
    content.setAttribute('data-label', 'Полномочие из 269-П');
}
if (node.content.isForAll) {
    content.classList.add('for-all-node');
    content.setAttribute('data-label', 'Для всех сотрудников');
}
if (node.content.isSubordinate) {
    content.classList.add('subordinate-node');
    content.setAttribute('data-label', 'Должностные регламенты');
}
if (node.content.isAuthority) {
    content.classList.add('authority-node');
    content.setAttribute('data-label', 'Идентичное полномочие');
}
    if (node.content.isOrganizationalEvent) {
                    content.classList.add('organizational-event-node');
                    content.setAttribute('data-label', 'Оргштатные мероприятия');
                }
if (node.content.isOKR) {
    content.classList.add('okr-node');
    content.setAttribute('data-label', 'OKR (Цели и ключевые результаты)');
}
if (node.content.isIndicator) {
    content.classList.add('indicator-node');
    content.setAttribute('data-label', 'Государственная программа');
}
if (node.content.absent269 && node.children.length > 0) {
    content.classList.add('absent-269');
    content.setAttribute('data-label', 'Нет в 269-П');
    setTimeout(() => nodeEffects.addEffect(content, 'absent269'), 100);
}

if (node.content.isPower269 && node.children.length > 0) {
    content.classList.add('power-269');
    content.setAttribute('data-label', 'Полномочие из 269-П');
    setTimeout(() => nodeEffects.addEffect(content, 'power269'), 100);
}

if (node.content.isForAll && node.children.length > 0) {
    content.classList.add('for-all-node');
    content.setAttribute('data-label', 'Для всех сотрудников');
    setTimeout(() => nodeEffects.addEffect(content, 'forAll'), 100);
}

if (node.content.isSubordinate && node.children.length > 0) {
    content.classList.add('subordinate-node');
    content.setAttribute('data-label', 'Должностные регламенты');
    setTimeout(() => nodeEffects.addEffect(content, 'subordinate'), 100);
}

if (node.content.isAuthority && node.children.length > 0) {
    content.classList.add('authority-node');
    content.setAttribute('data-label', 'Идентичное полномочие');
    setTimeout(() => nodeEffects.addEffect(content, 'authority'), 100);
}

if (node.content.isOKR && node.children.length > 0) {
    content.classList.add('okr-node');
    content.setAttribute('data-label', 'OKR (Цели и ключевые результаты)');
}

if (node.content.isIndicator && node.children.length > 0) {
    content.classList.add('indicator-node');
    content.setAttribute('data-label', 'Государственная программа');
}
if (this.clusters.has(node.id)) {
    const clusterMarker = document.createElement('div');
    clusterMarker.className = 'cluster-marker';
    clusterMarker.innerHTML = '🏷️';
    clusterMarker.title = `Отдел: ${this.clusters.get(node.id)}`;
    content.appendChild(clusterMarker);
}
if (node.children.length > 0) {
    const childrenCount = document.createElement('div');
    childrenCount.className = 'children-count';
    childrenCount.textContent = node.children.length;
    content.appendChild(childrenCount);
}
if (node.children.length > 0) {
    const visibleChildren = node.children.filter(child => this.shouldShowNode(child));
    if (visibleChildren.length > 0) {
        const childrenCount = document.createElement('div');
        childrenCount.className = 'children-count';
        childrenCount.textContent = visibleChildren.length;
        content.appendChild(childrenCount);
        content.setAttribute('data-children-count', visibleChildren.length);
    }
}
    if (node !== this.treeData) {
        content.draggable = true;
        content.addEventListener('dragstart', (e) => this.handleNodeDragStart(e, node, nodeElement));
        content.addEventListener('dragover', (e) => this.handleNodeDragOver(e, node, nodeElement));
        content.addEventListener('drop', (e) => this.handleNodeDrop(e, node, nodeElement));
    }

    const expandIcon = document.createElement('span');


const imgContainer = document.createElement('div');
imgContainer.className = `image-container ${node.content.isHorizontal ? 'horizontal' : ''}`;

if (node.content.img && !node.content.hideIcon) {
  imgContainer.innerHTML = `
    <div class="image-actions">
      <img src="${this.imagesData[node.content.img] || ''}" class="node-img ${node.content.isHorizontal ? 'horizontal' : ''}" onerror="this.style.display='none'" onclick="treeApp.showFullPreview('${node.content.img}')">
      <button class="delete-image-btn ${node.content.isHorizontal ? 'horizontal' : ''}" onclick="event.stopPropagation(); treeApp.removeImage(${node.id})" title="Удалить изображение">×</button>
      <button class="hide-image-btn ${node.content.isHorizontal ? 'horizontal' : ''}" onclick="event.stopPropagation(); treeApp.hideImageIcon(${node.id})" title="Скрыть иконку">👁️</button>
    </div>
  `;
} else if (!node.content.isTextOnly) {
  imgContainer.innerHTML = `
    <div class="upload-image-options">
      <div class="node-img ${node.content.isHorizontal ? 'horizontal' : ''}" onclick="treeApp.uploadImage()">📷</div>
      ${node.content.hideIcon ? `<div class="show-image-btn" onclick="event.stopPropagation(); treeApp.showImageIcon(${node.id})">Показать иконку</div>` : ''}
      <div class="text-only-option" onclick="treeApp.setAsTextOnly(${node.id})">Только текст</div>
    </div>
  `;
} else {
  imgContainer.innerHTML = `
    <div class="text-only-mode">
      <div class="allow-image-btn" onclick="event.stopPropagation(); treeApp.allowImage(${node.id})">Разрешить изображение</div>
    </div>
  `;
}
        const nodeHeader = document.createElement('div');
        nodeHeader.className = `node-header ${node.content.isHorizontal ? 'horizontal' : ''}`;
        const nodeTitle = document.createElement('div');
        nodeTitle.className = `node-title ${node.content.isHorizontal ? 'horizontal' : ''}`;
        nodeTitle.textContent = node.content.text;
nodeTitle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!e.target.classList.contains('node-title-input')) {
        this.enableTitleEdit(node);
    }
});
        nodeHeader.appendChild(imgContainer);
        nodeHeader.appendChild(nodeTitle);

        const subBlocksContainer = document.createElement('div');
        subBlocksContainer.className = `sub-blocks ${node.content.isHorizontal ? 'horizontal' : ''}`;
    if (node.content.position) {
        const positionElement = document.createElement('div');
        positionElement.className = `sub-block ${node.content.isHorizontal ? 'horizontal' : ''}`;
        positionElement.innerHTML = `<strong>Должность:</strong> ${node.content.position}`;
        positionElement.style.backgroundColor = 'rgba(255, 165, 0, 0.1)';
        positionElement.style.border = '1px solid #FFA500';
        subBlocksContainer.appendChild(positionElement);
    }
        if(node.content.subBlocks) {
            node.content.subBlocks.forEach((subBlock, index) => {
                const subBlockElement = document.createElement('div');
                subBlockElement.className = `sub-block ${node.content.isHorizontal ? 'horizontal' : ''}`;
                
                const textSpan = document.createElement('span');
if (this.isValidEmail(subBlock)) {
    const mailLink = document.createElement('a');
    mailLink.href = 'https://email.yanao.ru/'; 
    mailLink.target = '_blank';
    mailLink.rel = 'noopener noreferrer';
    mailLink.textContent = subBlock;
    mailLink.title = 'Открыть веб-интерфейс почты';
    const mailIcon = document.createElement('span');
    mailIcon.textContent = '✉️ ';
    mailIcon.style.marginRight = '3px';
    mailLink.prepend(mailIcon);
    
    textSpan.appendChild(mailLink);
} else if (this.isValidUrl(subBlock)) {
    const link = document.createElement('a');
    const url = subBlock.startsWith('http') ? subBlock : `https://${subBlock}`;
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = this.extractDomain(subBlock);
    link.title = url;
    textSpan.appendChild(link);
} else {
    textSpan.textContent = subBlock;
}
        const actionsDiv = document.createElement('div');
        actionsDiv.className = "sub-block-actions";
        actionsDiv.innerHTML = `
            <span onclick="treeApp.editSubBlock(treeApp.findNode(treeApp.treeData, ${node.id}), ${index})">✎</span>
            <span onclick="treeApp.removeSubBlock(treeApp.findNode(treeApp.treeData, ${node.id}), ${index})">×</span>
        `;
        
        subBlockElement.appendChild(textSpan);
        subBlockElement.appendChild(actionsDiv);
        
        subBlockElement.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.editSubBlock(node, index);
        });
        
        subBlocksContainer.appendChild(subBlockElement);
    });
}
if (node.content.absent269) {
  content.classList.add('absent-269');
  content.setAttribute('data-label', 'Нет в 269-П');
  setTimeout(() => nodeEffects.addEffect(content, 'absent269'), 100);
}

if (node.content.isForAll) {
  content.classList.add('for-all-node');
  content.setAttribute('data-label', 'Для всех сотрудников');
  setTimeout(() => nodeEffects.addEffect(content, 'forAll'), 100);
}
if (node.content.isOKR) {
  content.classList.add('okr-node');
  content.setAttribute('data-label', 'OKR (Цели и ключевые результаты)');
}
if (node.content.isIndicator) {
    content.classList.add('indicator-node');
    content.setAttribute('data-label', 'Государственная программа');
}
if (node.content.isPower269) {
  content.classList.add('power-269');
  content.setAttribute('data-label', 'Полномочие из 269-П');
  setTimeout(() => nodeEffects.addEffect(content, 'power269'), 100);
}

if (node.content.isSubordinate) {
  content.classList.add('subordinate-node');
  content.setAttribute('data-label', 'Должностные регламенты');
  setTimeout(() => nodeEffects.addEffect(content, 'subordinate'), 100);
}

if (node.content.isAuthority) {
  content.classList.add('authority-node');
  content.setAttribute('data-label', 'Идентичное полномочие');
  setTimeout(() => nodeEffects.addEffect(content, 'authority'), 100);
}
    if(node.content.files && node.content.files.length > 0) {
        const existingFileElements = subBlocksContainer.querySelectorAll('.file-block');
        existingFileElements.forEach(el => el.remove());
        node.content.files.forEach((fileId, index) => {
            const file = this.filesData[fileId];
            if (!file) {
                console.warn('File not found:', fileId);
                return;
            }
            
            const fileElement = document.createElement('div');
            fileElement.className = `sub-block file-block ${node.content.isHorizontal ? 'horizontal' : ''}`;
            
            const fileIcon = document.createElement('span');
            fileIcon.textContent = this.getFileIcon(file.type);
            fileIcon.style.marginRight = '5px';
            
            const fileSpan = document.createElement('span');
            fileSpan.setAttribute('data-original-name', file.name);
            fileSpan.textContent = file.name;
            fileSpan.style.cursor = 'pointer';
            fileSpan.onclick = (e) => {
                e.stopPropagation();
                this.downloadFile(fileId);
            };
            
            const actionsDiv = document.createElement('div');
            actionsDiv.className = "sub-block-actions";
            actionsDiv.innerHTML = `
                <span onclick="event.stopPropagation(); treeApp.downloadFile('${fileId}')" title="Скачать">⬇️</span>
                <span onclick="event.stopPropagation(); treeApp.removeFile(treeApp.findNode(treeApp.treeData, ${node.id}), '${fileId}')" title="Удалить">×</span>
            `;
            
            fileElement.appendChild(fileIcon);
            fileElement.appendChild(fileSpan);
            fileElement.appendChild(actionsDiv);
            
            subBlocksContainer.appendChild(fileElement);
        });
    }
const addMetricBlockBtn = document.createElement('div');
addMetricBlockBtn.className = `add-sub-block ${node.content.isHorizontal ? 'horizontal' : ''}`;
addMetricBlockBtn.textContent = '+ Добавить метрику';
addMetricBlockBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    this.addMetricBlock(node);
});
        const addSubBlockBtn = document.createElement('div');
        addSubBlockBtn.className = `add-sub-block ${node.content.isHorizontal ? 'horizontal' : ''}`;
        addSubBlockBtn.textContent = '+ Добавить подблок';
        addSubBlockBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.addSubBlock(node);
        });
if (node.content.metricBlocks) {
    node.content.metricBlocks.forEach((metricBlock, blockIndex) => {
        const metricContainer = document.createElement('div');
        metricContainer.className = `metric-container ${node.content.isHorizontal ? 'horizontal' : ''}`;
        
        const metricHeader = document.createElement('div');
        metricHeader.className = 'metric-header';
        
        const metricTitle = document.createElement('input');
        metricTitle.type = 'text';
        metricTitle.value = metricBlock.title;
        metricTitle.className = 'metric-title';
        metricTitle.addEventListener('change', (e) => {
            metricBlock.title = e.target.value;
            this.saveData();
        });
        metricTitle.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        metricHeader.appendChild(metricTitle);
        
        const quartersContainer = document.createElement('div');
        quartersContainer.className = 'quarters-container';
        
        metricBlock.quarters.forEach((quarter, qIndex) => {
            const quarterElement = document.createElement('div');
            quarterElement.className = 'quarter-block';
            
            const quarterLabel = document.createElement('div');
            quarterLabel.className = 'quarter-label';
            quarterLabel.textContent = `Q${qIndex + 1}`;
            
            const planInput = document.createElement('input');
            planInput.type = 'number';
            planInput.value = quarter.plan;
            planInput.placeholder = 'План';
            planInput.className = 'quarter-value plan-value';
planInput.style.fontSize = '2.5rem !important';
planInput.style.padding = '15px !important';
planInput.style.width = '140px !important';
            planInput.addEventListener('wheel', (e) => e.preventDefault());
            planInput.addEventListener('click', (e) => e.stopPropagation());
            
            const factInput = document.createElement('input');
            factInput.type = 'number';
            factInput.value = quarter.fact;
            factInput.placeholder = 'Факт';
planInput.style.fontSize = '2.5rem !important';
planInput.style.padding = '15px !important';
planInput.style.width = '140px !important';
            factInput.className = 'quarter-value fact-value';
            factInput.addEventListener('wheel', (e) => e.preventDefault());
            factInput.addEventListener('click', (e) => e.stopPropagation());
            
            const ganttContainer = document.createElement('div');
            ganttContainer.className = 'gantt-container';
            
            const planBar = document.createElement('div');
            planBar.className = 'gantt-bar plan-bar';
            
            const factBar = document.createElement('div');
            factBar.className = 'gantt-progress fact-bar';
            planBar.appendChild(factBar);
            
            ganttContainer.appendChild(planBar);
            
            const diffElement = document.createElement('div');
            diffElement.className = 'quarter-diff';
diffElement.style.fontSize = '2.5rem !important';
diffElement.style.margin = '10px 0 !important';
            
            const updateDiff = () => {
                const diff = quarter.fact - quarter.plan;
                const percentage = quarter.plan !== 0 ? 
                    Math.round((quarter.fact / quarter.plan) * 100) : 
                    (quarter.fact !== 0 ? 100 : 0);
                
                diffElement.textContent = `${percentage}%`;
                diffElement.style.color = diff >= 0 ? '#4CAF50' : '#F44336';
                
                factBar.style.width = quarter.plan !== 0 ? 
                    Math.min(100, (quarter.fact / quarter.plan) * 100) + '%' : 
                    (quarter.fact !== 0 ? '100%' : '0%');
            };
            
            updateDiff();
            
            planInput.addEventListener('input', (e) => {
                quarter.plan = parseFloat(e.target.value) || 0;
                this.saveData();
                updateDiff();
            });
            
            factInput.addEventListener('input', (e) => {
                quarter.fact = parseFloat(e.target.value) || 0;
                this.saveData();
                updateDiff();
            });
            quarterElement.appendChild(quarterLabel);
            quarterElement.appendChild(planInput);
            quarterElement.appendChild(factInput);
            quarterElement.appendChild(ganttContainer);
            quarterElement.appendChild(diffElement);
            
            quartersContainer.appendChild(quarterElement);
        });
        
        metricContainer.appendChild(metricHeader);
        metricContainer.appendChild(quartersContainer);
        
        const deleteMetricBtn = document.createElement('button');
        deleteMetricBtn.className = 'delete-metric-btn';
        deleteMetricBtn.textContent = '× Удалить';
        deleteMetricBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Удалить эту метрику?')) {
                this.removeMetricBlock(node, blockIndex);
            }
        });
        
        metricContainer.appendChild(deleteMetricBtn);
        subBlocksContainer.appendChild(metricContainer);
    });
}
if (node.content.isIndicator && node.content.indicators) {
    if (!node.content.indicators.metrics) {
        node.content.indicators.metrics = [];
    }

    const indicatorsContainer = document.createElement('div');
    indicatorsContainer.className = `indicators-container ${node.content.isHorizontal ? 'horizontal' : ''}`;
    if (node.content.isHorizontal) {
        indicatorsContainer.style.width = 'auto';
        indicatorsContainer.style.minWidth = '100%';
        indicatorsContainer.style.overflowX = 'visible';
    } else {
        indicatorsContainer.style.width = '100%';
        indicatorsContainer.style.overflowX = 'auto';
    }
    const table = document.createElement('table');
    table.className = 'compact-indicators-table';

    if (node.content.isHorizontal) {
        table.style.width = 'auto';
        table.style.minWidth = '100%';
        table.style.tableLayout = 'auto';
    } else {
        table.style.width = '100%';
        table.style.tableLayout = 'fixed';
    }
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const cornerCell = document.createElement('th');
    cornerCell.style.minWidth = '180px';
    cornerCell.style.textAlign = 'left';
    cornerCell.style.paddingLeft = '15px';
    headerRow.appendChild(cornerCell);

    node.content.indicators.years.forEach(year => {
        const th = document.createElement('th');
        th.textContent = year;
        th.style.minWidth = node.content.isHorizontal ? '120px' : '150px';
        th.style.fontSize = '1.5rem';
        th.style.textAlign = 'center';
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    node.content.indicators.stages.forEach((stage, stageIndex) => {
        const row = document.createElement('tr');

        const stageCell = document.createElement('td');
        stageCell.textContent = stage;
        stageCell.title = stage;
        stageCell.style.fontSize = '2.5rem';
        stageCell.style.whiteSpace = 'nowrap';
        stageCell.style.padding = '12px 15px';
        stageCell.style.minWidth = '180px';
        if (stage === "Вес. значение") {
            stageCell.style.fontWeight = 'bold';
            stageCell.style.color = 'var(--accent-color)';
        }

        row.appendChild(stageCell);

        node.content.indicators.years.forEach((year, yearIndex) => {
            const cell = document.createElement('td');
            cell.style.padding = '12px 8px';
            cell.style.minWidth = node.content.isHorizontal ? '120px' : '150px';
            
            const input = document.createElement('input');
            input.type = 'text';
            input.inputMode = 'numeric';
            input.className = 'compact-indicator-value';
            input.style.width = '100%';
            input.style.height = '50px';
            input.style.padding = '10px';
            input.style.fontSize = '2.4rem';
            input.style.textAlign = 'center';
            input.style.border = '1px solid var(--secondary-color)';
            input.style.borderRadius = '4px';
            input.style.boxSizing = 'border-box';

            const formatValue = (value) => {
                if (value === 0) return '';
                return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
            };

            input.value = formatValue(node.content.indicators.values[yearIndex][stageIndex] || 0);
            
input.addEventListener('input', (e) => {
    const value = e.target.value;
    node.content.indicators.values[yearIndex][stageIndex] = value;
    this.saveData();
});

input.addEventListener('input', (e) => {
    const value = e.target.value;
    node.content.indicators.values[yearIndex][stageIndex] = value;
    this.saveData();
});
input.addEventListener('keydown', (e) => {
    e.stopPropagation();
});
input.addEventListener('blur', (e) => {
    const value = node.content.indicators.values[yearIndex][stageIndex] || '';
    e.target.value = value;
});
input.addEventListener('focus', (e) => {
    const value = node.content.indicators.values[yearIndex][stageIndex] || '';
    e.target.value = value;
});            
            input.addEventListener('wheel', (e) => e.preventDefault());
            
            cell.appendChild(input);
            row.appendChild(cell);
        });
        
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    indicatorsContainer.appendChild(table);
    const metricsContainer = document.createElement('div');
    metricsContainer.className = 'indicator-metrics';
    metricsContainer.style.marginTop = '20px';
    const metricsTitle = document.createElement('div');
    metricsTitle.className = 'metrics-title';
    metricsTitle.textContent = 'Метрики:';
    metricsTitle.style.fontSize = '1.8rem';
    metricsTitle.style.marginBottom = '10px';
    metricsContainer.appendChild(metricsTitle);
    const metricsList = document.createElement('div');
    metricsList.className = 'metrics-list';
    
    if (node.content.indicators.metrics.length > 0) {
        node.content.indicators.metrics.forEach((metric, index) => {
const metricElement = document.createElement('div');
metricElement.className = 'metric-item';
metricElement.style.display = 'flex';
metricElement.style.justifyContent = 'space-between';
metricElement.style.alignItems = 'center';
metricElement.style.padding = '10px';
metricElement.style.margin = '5px 0';
metricElement.style.background = 'rgba(93, 138, 168, 0.1)';
metricElement.style.borderRadius = '6px';

const metricText = document.createElement('span');
metricText.textContent = metric;
metricText.style.flex = '1';
metricText.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    const newValue = prompt('Редактировать метрику:', metric);
    if (newValue !== null && newValue.trim() !== metric) {
        node.content.indicators.metrics[index] = newValue.trim();
        this.updateTree();
        this.saveData();
    }
});

const buttonsContainer = document.createElement('div');
buttonsContainer.style.display = 'flex';
buttonsContainer.style.gap = '8px';
const editBtn = document.createElement('button');
editBtn.innerHTML = '✎';
editBtn.style.background = 'none';
editBtn.style.border = 'none';
editBtn.style.color = 'var(--primary-color)';
editBtn.style.cursor = 'pointer';
editBtn.style.fontSize = '1.2rem';
editBtn.title = 'Редактировать';
editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const newValue = prompt('Редактировать метрику:', metric);
    if (newValue !== null && newValue.trim() !== metric) {
        node.content.indicators.metrics[index] = newValue.trim();
        this.updateTree();
        this.saveData();
    }
});
const deleteBtn = document.createElement('button');
deleteBtn.innerHTML = '&times;';
deleteBtn.style.background = 'none';
deleteBtn.style.border = 'none';
deleteBtn.style.color = 'var(--accent-color)';
deleteBtn.style.cursor = 'pointer';
deleteBtn.style.fontSize = '1.5rem';
deleteBtn.title = 'Удалить';
deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm('Удалить эту метрику?')) {
        node.content.indicators.metrics.splice(index, 1);
        this.updateTree();
        this.saveData();
    }
});
buttonsContainer.appendChild(editBtn);
buttonsContainer.appendChild(deleteBtn);

metricElement.appendChild(metricText);
metricElement.appendChild(buttonsContainer);
metricsList.appendChild(metricElement);
        });
    } else {
        const emptyMessage = document.createElement('div');
        emptyMessage.textContent = 'Нет добавленных метрик';
        emptyMessage.style.color = 'var(--primary-color)';
        emptyMessage.style.fontStyle = 'italic';
        emptyMessage.style.padding = '10px';
        metricsList.appendChild(emptyMessage);
    }
    
    metricsContainer.appendChild(metricsList);
    const addMetricBtn = document.createElement('button');
    addMetricBtn.className = 'add-metric-btn';
    addMetricBtn.textContent = '+ Добавить метрику';
    addMetricBtn.style.marginTop = '10px';
    addMetricBtn.style.padding = '10px 15px';
    addMetricBtn.style.background = 'var(--primary-color)';
    addMetricBtn.style.color = 'white';
    addMetricBtn.style.border = 'none';
    addMetricBtn.style.borderRadius = '6px';
    addMetricBtn.style.cursor = 'pointer';
    addMetricBtn.style.width = '100%';
    addMetricBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const newMetric = prompt('Введите метрику:');
        if (newMetric && newMetric.trim()) {
            node.content.indicators.metrics.push(newMetric.trim());
            this.updateTree();
            this.saveData();
        }
    });
    metricsContainer.appendChild(addMetricBtn);
    const resultContainer = document.createElement('div');
    resultContainer.className = 'result-block';
    resultContainer.style.marginTop = '20px';
    resultContainer.style.padding = '15px';
    resultContainer.style.background = 'rgba(76, 175, 80, 0.1)';
    resultContainer.style.border = '2px solid #4CAF50';
    resultContainer.style.borderRadius = '8px';
    resultContainer.style.position = 'relative';

    if (!node.content.indicators.result) {
        node.content.indicators.result = '';
    }
    const checkIcon = document.createElement('div');
    checkIcon.style.position = 'absolute';
    checkIcon.style.left = '-12px';
    checkIcon.style.top = '-12px';
    checkIcon.style.width = '28px';
    checkIcon.style.height = '28px';
    checkIcon.style.background = '#4CAF50';
    checkIcon.style.color = 'white';
    checkIcon.style.borderRadius = '50%';
    checkIcon.style.display = 'flex';
    checkIcon.style.alignItems = 'center';
    checkIcon.style.justifyContent = 'center';
    checkIcon.textContent = '✓';
    resultContainer.appendChild(checkIcon);
    const resultTitle = document.createElement('div');
    resultTitle.className = 'result-title';
    resultTitle.textContent = 'Результат выполнения:';
    resultTitle.style.fontWeight = 'bold';
    resultTitle.style.marginBottom = '20px';
    resultTitle.style.color = '#2E7D32';
    resultContainer.appendChild(resultTitle);

    const resultText = document.createElement('div');
    resultText.className = 'result-text';
    resultText.textContent = node.content.indicators.result || 'Нажмите, чтобы добавить результат';
    resultText.style.whiteSpace = 'pre-wrap';
    resultText.style.lineHeight = '1.5';
    resultText.style.minHeight = '50px';
    resultText.style.cursor = 'pointer';
    resultText.addEventListener('click', (e) => {
        e.stopPropagation();
        const newResult = prompt('Введите результат выполнения:', node.content.indicators.result);
        if (newResult !== null) {
            node.content.indicators.result = newResult;
            this.updateTree();
            this.saveData();
        }
    });
    resultContainer.appendChild(resultText);
    metricsContainer.appendChild(resultContainer);

    if (!node.content.indicators.result) {
        const addResultBtn = document.createElement('button');
        addResultBtn.className = 'add-metric-btn';
        addResultBtn.textContent = '+ Добавить результат';
        addResultBtn.style.marginTop = '20px';
        addResultBtn.style.background = '#4CAF50';
        addResultBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const newResult = prompt('Введите результат выполнения:');
            if (newResult) {
                node.content.indicators.result = newResult;
                this.updateTree();
                this.saveData();
            }
        });
        metricsContainer.appendChild(addResultBtn);
    }
    indicatorsContainer.appendChild(metricsContainer);
    subBlocksContainer.appendChild(indicatorsContainer);
}
subBlocksContainer.appendChild(addMetricBlockBtn);
        subBlocksContainer.appendChild(addSubBlockBtn);
        
        const nodeTypeSelector = document.createElement('div');
        nodeTypeSelector.className = 'node-type-selector';
        
        const verticalBtn = document.createElement('div');
        verticalBtn.className = `node-type-btn ${!node.content.isHorizontal ? 'active' : ''}`;
        verticalBtn.innerHTML = '↕';
        verticalBtn.title = 'Вертикальный узел';
verticalBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const treeContainer = this.elements.treeContainer;
    this.scrollState = {
        scrollLeft: treeContainer.scrollLeft,
        scrollTop: treeContainer.scrollTop
    };
    
    node.content.isHorizontal = false;
    nodeElement.classList.remove('horizontal');
    nodeElement.querySelector('.node-content').classList.remove('horizontal');
    requestAnimationFrame(() => {
        treeContainer.scrollLeft = this.scrollState.scrollLeft;
        treeContainer.scrollTop = this.scrollState.scrollTop;
    });
    
    this.saveData();
});
        
        const horizontalBtn = document.createElement('div');
        horizontalBtn.className = `node-type-btn ${node.content.isHorizontal ? 'active' : ''}`;
        horizontalBtn.innerHTML = '↔';
        horizontalBtn.title = 'Горизонтальный узел';
        horizontalBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            node.content.isHorizontal = true;
            this.updateTree();
            this.saveData();
        });
        
        nodeTypeSelector.appendChild(verticalBtn);
        nodeTypeSelector.appendChild(horizontalBtn);
const nodeActions = document.createElement('div');
nodeActions.className = 'node-actions';

const addBtn = document.createElement('button');
addBtn.className = 'node-action-btn add-btn';
addBtn.innerHTML = '+';
addBtn.title = 'Добавить дочерний узел';
addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    this.addChild();
});

const deleteBtn = document.createElement('button');
deleteBtn.className = 'node-action-btn delete-btn';
deleteBtn.innerHTML = '-';
deleteBtn.title = this.selectedNodes.size > 0 ? `Удалить (${this.selectedNodes.size}) узлов` : 'Удалить узел';
deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    this.deleteNode();
});
const promoteDeleteBtn = document.createElement('button');
promoteDeleteBtn.className = 'node-action-btn promote-delete-btn'; 
promoteDeleteBtn.innerHTML = '⏏'; 
promoteDeleteBtn.title = 'Удалить узел, подняв дочерние';
promoteDeleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    this.deleteNodeAndPromoteChildren();
});
nodeActions.appendChild(addBtn);
nodeActions.appendChild(promoteDeleteBtn);
nodeActions.appendChild(deleteBtn);
content.appendChild(nodeActions);
expandIcon.addEventListener('click', (e) => {
    e.stopPropagation();

    const treeContainer = this.elements.treeContainer;
    this.scrollState = {
        scrollLeft: treeContainer.scrollLeft,
        scrollTop: treeContainer.scrollTop
    };
    
    node.isExpanded = !node.isExpanded;
    const childrenContainer = nodeElement.querySelector('.children');
    if (childrenContainer) {
        childrenContainer.classList.toggle('collapsed', !node.isExpanded);
    }

    requestAnimationFrame(() => {
        treeContainer.scrollLeft = this.scrollState.scrollLeft;
        treeContainer.scrollTop = this.scrollState.scrollTop;
    });
    
    this.saveData();
});

        content.appendChild(nodeTypeSelector);
if (this.clusters.has(node.id)) {
    const clusterName = this.clusters.get(node.id);
    const clusterMarker = document.createElement('div');
    clusterMarker.className = 'cluster-marker';
    content.appendChild(clusterMarker);
    
    content.classList.add('in-cluster');
}
        content.appendChild(nodeHeader);
        content.appendChild(subBlocksContainer);
content.addEventListener('click', (e) => {
    const isClickOnTitle = e.target.closest('.node-title, .node-title-input');
    const isClickOnActionBtn = e.target.closest('.node-action-btn');
    
    if (!isClickOnTitle && !isClickOnActionBtn && e.target !== expandIcon && !e.target.closest('.node-type-btn')) {
        this.selectNode(node, nodeElement);

        const isRootNode = node === this.treeData;
        if (!isRootNode && !this.ctrlPressed) {
            const treeContainer = this.elements.treeContainer;
            const currentState = {
                scrollLeft: treeContainer.scrollLeft,
                scrollTop: treeContainer.scrollTop,
                transform: treeContainer.style.transform
            };

            node.isExpanded = !node.isExpanded;

            setTimeout(() => {
                treeContainer.scrollLeft = currentState.scrollLeft;
                treeContainer.scrollTop = currentState.scrollTop;
                treeContainer.style.transform = currentState.transform;
                if (window.panZoomVars) {
                    const transformMatch = currentState.transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                    if (transformMatch) {
                        window.panZoomVars.translateX = parseFloat(transformMatch[1]);
                        window.panZoomVars.translateY = parseFloat(transformMatch[2]);
                    }
                }
            }, 10);
        }
        
        this.updateNode(node, nodeElement);
    }
});

const childrenCount = node.children.length;

let childrenContainer;
if (depth === 0) {
    childrenContainer = document.createElement('div');
    childrenContainer.className = `children ${node.isExpanded ? '' : 'collapsed'}`;
    childrenContainer.style.flexDirection = 'row';
} 
else if (depth === 1) {
    if (childrenCount > 5) {
        childrenContainer = document.createElement('div');
        childrenContainer.className = `children grid-children ${node.isExpanded ? '' : 'collapsed'}`;
        childrenContainer.style.gridTemplateColumns = 'repeat(5, 1fr)';
    } else {
        childrenContainer = document.createElement('div');
        childrenContainer.className = `children ${node.isExpanded ? '' : 'collapsed'}`;
        childrenContainer.style.flexDirection = 'row';
    }
}
else if (depth === 2) {
    childrenContainer = document.createElement('div');
    childrenContainer.className = `children ${node.isExpanded ? '' : 'collapsed'}`;
    childrenContainer.style.flexDirection = 'column';
} 
else {
    childrenContainer = document.createElement('div');
    childrenContainer.className = `children ${node.isExpanded ? '' : 'collapsed'}`;
    childrenContainer.style.flexDirection = childrenCount > 6 ? 'row' : 'column';
}
if(node.isExpanded) {
    node.children
        .filter(child => this.shouldShowNode(child))
        .forEach((child, index) => {
            const childElement = this.createNodeElement(child);
        if (depth === 0 || depth >= 3) {
            const connector = document.createElement('div');
            connector.className = 'horizontal-connector';
            childElement.prepend(connector);
        } 
        else if (childrenContainer.classList.contains('grid-children')) {
            const connector = document.createElement('div');
            connector.className = 'grid-connector';
            childElement.prepend(connector);
        } 
        else {
            const connector = document.createElement('div');
            connector.className = 'connector';
            childElement.prepend(connector);
        }
        
        childrenContainer.appendChild(childElement);
    });
}
    nodeElement.appendChild(content);
    nodeElement.appendChild(childrenContainer);
        if(node.id === this.selectedNodeId) {
            content.classList.add('selected');
            this.selectedNode = { node, element: nodeElement };
        }
if (this.searchQuery && this.shouldShowNode(node)) {
    const highlightText = (text) => {
        if (!this.searchQuery) return text;
        
        const searchTerms = this.searchQuery.toLowerCase().split(/\s+/);
        let result = text;
        
        searchTerms.forEach(term => {
            if (term.length < 2) return;
            
            const regex = new RegExp(`(${term})`, 'gi');
            result = result.replace(regex, '<span class="search-match-highlight">$1</span>');
        });
        
        return result;
    };

    nodeTitle.innerHTML = highlightText(node.content.text);

if (node.content.subBlocks) {
    node.content.subBlocks.forEach((subBlock, index) => {
        const subBlockElement = subBlocksContainer.children[index];
        if (subBlockElement) {
            const textSpan = subBlockElement.querySelector('span');
            if (textSpan) {
                if (this.isValidEmail(subBlock)) {
                    const link = textSpan.querySelector('a');
                    if (link) {
                        link.innerHTML = highlightText(link.textContent);
                    }
                } else if (this.isValidUrl(subBlock)) {
                    const link = textSpan.querySelector('a');
                    if (link) {
                        link.innerHTML = highlightText(link.textContent);
                    }
                } else {
                    textSpan.innerHTML = highlightText(subBlock);
                }
            }
        }
    });
}
    if (node.content.files) {
        node.content.files.forEach((fileId, index) => {
            const fileElement = subBlocksContainer.children[
                (node.content.subBlocks?.length || 0) + index
            ];
            if (fileElement) {
                const fileSpan = fileElement.querySelector('span');
                if (fileSpan) {
                    // Используем оригинальное название из атрибута
                    const originalName = fileSpan.getAttribute('data-original-name') || '';
                    fileSpan.innerHTML = highlightText(originalName);
                }
            }
        });
    }
}
        

        return nodeElement;
    }
enableTitleEdit(node) {
    const titleElement = document.querySelector(`[data-node-id="${node.id}"] .node-title`);
    if (!titleElement) return;
    
    const currentText = titleElement.textContent;
    const textarea = document.createElement('textarea');
    textarea.className = 'node-title-input';
    textarea.value = currentText;
    
    const computedStyle = window.getComputedStyle(titleElement);
    const styleProps = [
        'fontFamily', 'fontSize', 'fontWeight', 'color', 
        'textAlign', 'lineHeight', 'letterSpacing', 'textTransform',
        'padding', 'margin', 'border', 'background', 'boxSizing',
        'width', 'height', 'minWidth', 'maxWidth'
    ];
    
    styleProps.forEach(prop => {
        textarea.style[prop] = computedStyle[prop];
    });
    textarea.style.resize = 'vertical';
    textarea.style.overflowY = 'auto';
    textarea.style.whiteSpace = 'pre-wrap';
    textarea.style.wordWrap = 'break-word';
    if (node.content.isSubordinate) {
        textarea.style.border = '2px dashed var(--secondary-color)';
        textarea.style.background = 'rgba(135, 206, 235, 0.1)';
    }
    titleElement.replaceWith(textarea);
    textarea.focus();
    textarea.setSelectionRange(currentText.length, currentText.length);
    const adjustHeight = () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 300) + 'px';
    };
    adjustHeight();
    textarea.addEventListener('input', adjustHeight);

    const finishEditing = () => {
        const newText = textarea.value.trim();
        if (newText && newText !== currentText) {
            this.saveToHistory();
            node.content.text = newText;
            this.updateTree();
            this.saveData();
        } else {
            textarea.replaceWith(titleElement);
        }
    };
    
    textarea.addEventListener('blur', finishEditing);
    
    textarea.addEventListener('keydown', (e) => {
e.stopPropagation();
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            finishEditing();
        }
        e.stopPropagation();
    });
    
    textarea.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}
restoreParentPosition(parentElement, restoreData) {
    try {
        const treeContainer = this.elements.treeContainer;
        const currentRect = parentElement.getBoundingClientRect();
        const containerRect = treeContainer.getBoundingClientRect();
        const currentRelativeX = currentRect.left - containerRect.left;
        const currentRelativeY = currentRect.top - containerRect.top;
        const deltaX = restoreData.relativeX - currentRelativeX;
        const deltaY = restoreData.relativeY - currentRelativeY;
        const currentTransform = treeContainer.style.transform;
        const currentTranslateMatch = currentTransform.match(/translate\(([^,]+),\s*([^)]+)\)/);
        const currentScaleMatch = currentTransform.match(/scale\(([^)]+)\)/);
        
        const currentTranslateX = currentTranslateMatch ? parseFloat(currentTranslateMatch[1]) : 0;
        const currentTranslateY = currentTranslateMatch ? parseFloat(currentTranslateMatch[2]) : 0;
        const currentScale = currentScaleMatch ? parseFloat(currentScaleMatch[1]) : 1;
        const newTranslateX = currentTranslateX + deltaX;
        const newTranslateY = currentTranslateY + deltaY;
        if (window.panZoomVars) {
            window.panZoomVars.translateX = newTranslateX;
            window.panZoomVars.translateY = newTranslateY;
            window.panZoomVars.scale = currentScale;
        }
        treeContainer.style.transition = 'transform 0.2s ease-out';
        treeContainer.style.transform = `translate(${newTranslateX}px, ${newTranslateY}px) scale(${currentScale})`;
        setTimeout(() => {
            treeContainer.style.transition = '';
        }, 200);
        const contentElement = parentElement.querySelector('.node-content');
        if (contentElement) {
            contentElement.classList.add('highlight-parent');
            setTimeout(() => {
                contentElement.classList.remove('highlight-parent');
            }, 1000);
        }
        
    } catch (error) {
        console.error('Ошибка при восстановлении позиции родительского узла:', error);
        this.centerOnElement(parentElement);
    }
}
selectNode(node, element) {
    const contentElement = element.querySelector('.node-content');
    if (this.ctrlPressed) {
        this.multiSelectMode = true;
        
        if (this.selectedNodes.has(node.id)) {
            this.selectedNodes.delete(node.id);
            contentElement.classList.remove('selected', 'multi-selected');
        } else {
            this.selectedNodes.add(node.id);
        }
        this.selectedNode = { node, element };
        this.selectedNodeId = node.id;
        contentElement.classList.add('selected', 'multi-selected');
        this.selectedNodes.forEach(id => {
            if (id !== node.id) {
                const nodeEl = document.querySelector(`[data-node-id="${id}"] .node-content`);
                if (nodeEl) {
                    nodeEl.classList.add('selected', 'multi-selected');
                }
            }
        });
        
        this.updateSelectionCounter();
        return;
    } 
    else {
        if (this.multiSelectMode) {
            this.clearMultiSelection();
        }
        if (this.selectedNode) {
            const prevContent = this.selectedNode.element.querySelector('.node-content');
            if (prevContent) prevContent.classList.remove('selected', 'multi-selected');
        }
        
        contentElement.classList.add('selected');
        contentElement.classList.remove('multi-selected');
        
        this.selectedNode = { node, element };
        this.selectedNodeId = node.id;
        this.updateSelectionCounter();
    }
}
updateClusterRemoveButton() {
    const removeBtn = this.elements.clusterSelect.parentNode.querySelector('.remove-from-cluster-btn');
    if (removeBtn) {
        const shouldShow = this.selectedNode && this.clusters.has(this.selectedNode.node.id);
        removeBtn.style.display = shouldShow ? 'inline-block' : 'none';
        
        if (shouldShow) {
            const clusterName = this.clusters.get(this.selectedNode.node.id);
            removeBtn.title = `Удалить из отдела "${clusterName}"`;
        }
    }
}
clearMultiSelection() {
    this.selectedNodes.forEach(id => {
        const nodeElement = document.querySelector(`[data-node-id="${id}"]`);
        if (nodeElement) {
            const content = nodeElement.querySelector('.node-content');
            if (content) {
                content.classList.remove('selected', 'multi-selected');
            }
        }
    });
    
    this.selectedNodes.clear();
    this.multiSelectMode = false;
    this.updateSelectionCounter();
    if (this.selectedNode) {
        const content = this.selectedNode.element.querySelector('.node-content');
        if (content) {
            content.classList.add('selected');
        }
    }
}
    renderVirtualizedTree() {
    const visibleNodes = this.calculateVisibleNodes();
    this.elements.treeContainer.innerHTML = '';
    visibleNodes.forEach(node => {
        this.elements.treeContainer.appendChild(this.createNodeElement(node));
    });
}

calculateVisibleNodes() {
    const visibleNodes = [];
    const walkTree = (node) => {
        if (this.isNodeVisible(node)) {
            visibleNodes.push(node);
            if (node.isExpanded) {
                node.children.forEach(walkTree);
            }
        }
    };
    walkTree(this.treeData);
    return visibleNodes;
}
updateSelectionCounter() {
    const count = this.selectedNodes.size;
    console.log('Updating selection counter. Selected nodes count:', count); 

    const deleteBtns = document.querySelectorAll('.node-action-btn.delete-btn');
    deleteBtns.forEach(btn => {
        if (count > 0) {
            btn.title = `Удалить (${count}) узлов`;
        } else {
            btn.title = 'Удалить узел';
        }
    });
    const addBtns = document.querySelectorAll('.node-action-btn.add-btn');
    addBtns.forEach(btn => {
        if (count > 0) {
            btn.title = `Добавить дочерний узел к (${count}) узлам`;
        } else {
            btn.title = 'Добавить дочерний узел';
        }
    });
    const selectedCountElement = document.getElementById('selectedCount');
    if (selectedCountElement) {
        console.log('Found selectedCount element:', selectedCountElement);
        if (count > 0) {
            selectedCountElement.textContent = `Выделено: ${count}`;
            selectedCountElement.classList.add('visible');
            console.log('Showing counter with text:', selectedCountElement.textContent);
        } else {
            selectedCountElement.classList.remove('visible');
            console.log('Hiding counter');
        }
    } else {
        console.error('selectedCount element not found in DOM'); 
    }
}
updateNode(node, nodeElement, skipHistory = false) {
    const countElement = nodeElement.querySelector('.children-count');
    if (countElement) {
        countElement.textContent = node.children.length;
    } else if (node.children.length > 0) {
        const newCountElement = document.createElement('div');
        newCountElement.className = 'children-count';
        newCountElement.textContent = node.children.length;
        nodeElement.querySelector('.node-content').appendChild(newCountElement);
    }
    if (!skipHistory) {
        this.saveToHistory();
    }
    this.saveScrollPosition();
    const newElement = this.createNodeElement(node);
    nodeElement.replaceWith(newElement);
    this.restoreScrollPosition();
    if (this.selectedNode && this.selectedNode.node.id === node.id) {
        this.selectedNode.element = newElement;
    }
}
addChild() {
    this.saveToHistory(); 
    if (!this.selectedNode && this.selectedNodes.size === 0) {
        alert('Выберите узел(ы)!');
        return;
    }
    let addedCount = 0;
    if (this.selectedNodes.size > 0) {
        console.log('Adding child to multiple selected nodes:', this.selectedNodes.size);
        this.selectedNodes.forEach(nodeId => {
            const targetNode = this.findNode(this.treeData, nodeId);
            if (targetNode) {
                const newNode = this.createNewNode('Новый узел');
                targetNode.children.push(newNode);
                addedCount++;
                console.log(`Added child to node ${nodeId}`);
            } else {
                console.warn(`Node ${nodeId} not found for adding child`);
            }
        });
    } else {
        console.log('Adding child to single selected node:', this.selectedNode.node.id);
        const newNode = this.createNewNode('Новый узел');
        this.selectedNode.node.children.push(newNode);
        addedCount = 1;
    }
    this.selectedNodes.clear();
    this.selectedNode = null;
    this.updateSelectionCounter(); 

    this.updateTree();
    this.saveData();
    this.showNotification(`Добавлено ${addedCount} новых узлов`);
}
showLayoutChangeNotification(node, useGrid) {
    const message = useGrid 
        ? `Узел "${node.content.text}" переключен в сеточный режим (${node.children.length} дочерних узлов)`
        : `Узел "${node.content.text}" в обычном режиме (${node.children.length} дочерних узлов)`;
    
    this.showNotification(message);
}
deleteNode() {
    this.saveToHistory();

    
    const nodeNames = [];
    const logActionAndDelete = (nodesSet) => {
        nodesSet.forEach(id => {
            const node = this.findNode(this.treeData, id);
            if (node) nodeNames.push(`"${node.content.text}"`);
        });

        if (nodeNames.length > 0) {
            this.logAction(`Удален узел(ы): ${nodeNames.join(', ')}`);
        }

        const removeNodeRecursive = (parent, idsToRemove) => {
            parent.children = parent.children.filter(child => {
                if (idsToRemove.has(child.id)) return false;
                removeNodeRecursive(child, idsToRemove);
                return true;
            });
        };
        removeNodeRecursive(this.treeData, nodesSet);
    };
    

    if (this.selectedNodes.size > 0) {
        if (!confirm(`Удалить ${this.selectedNodes.size} выбранных узлов?`)) return;
        logActionAndDelete(new Set(this.selectedNodes));
        this.clearMultiSelection();
        this.selectedNode = null;
        this.selectedNodeId = null;
    } else if (this.selectedNode) {
        if (!confirm('Удалить выбранный узел и все дочерние элементы?')) return;
        logActionAndDelete(new Set([this.selectedNode.node.id]));
        this.selectedNode = null;
        this.selectedNodeId = null;
    } else {
        alert('Выберите узел для удаления!');
        return;
    }

    this.updateTree();
    this.saveData();
    this.updateSelectionCounter();
}
deleteNodeAndPromoteChildren() {
    this.saveToHistory(false, true); 

    const nodesToProcess = this.selectedNodes.size > 0 ? new Set(this.selectedNodes) : new Set([this.selectedNode?.node.id]);
    if (nodesToProcess.size === 0 || (nodesToProcess.size === 1 && !this.selectedNode)) {
        this.showNotification('Выберите узел(ы) для удаления.', 'error');
        return;
    }

    if (!confirm(`Удалить ${nodesToProcess.size} узел(а/ов), но сохранить и поднять их дочерние элементы?`)) {
        return;
    }

    const nodeNames = [];
    let promotedCount = 0;

    nodesToProcess.forEach(nodeId => {
        const nodeToDelete = this.findNode(this.treeData, nodeId);
        if (!nodeToDelete) return;

        nodeNames.push(`"${nodeToDelete.content.text}"`);
        const parent = this.findParent(this.treeData, nodeId);

        if (parent) {
            const index = parent.children.findIndex(child => child.id === nodeId);
            if (index !== -1) {
                
                parent.children.splice(index, 1, ...nodeToDelete.children);
                promotedCount += nodeToDelete.children.length;
            }
        }
    });

    this.logAction(`Узел(ы) удален с повышением дочерних: ${nodeNames.join(', ')}`);
    this.clearMultiSelection();
    this.selectedNode = null;
    this.selectedNodeId = null;
    this.updateTree();
    this.saveData();
    this.showNotification(`Узел(ы) удалены, ${promotedCount} дочерних элементов поднято на уровень выше.`);
}


    removeImage(nodeId) {
        const node = this.findNode(this.treeData, nodeId);
        if(node && node.content.img) {
            node.content.img = null;
            this.cleanUnusedImages();
            this.updateTree();
            this.saveData();
        }
    }

    cleanUnusedImages() {
        const usedImages = new Set();
        const collectImages = (node) => {
            if(node.content.img) usedImages.add(node.content.img);
            node.children.forEach(collectImages);
        };
        collectImages(this.treeData);

        Object.keys(this.imagesData).forEach(key => {
            if(!usedImages.has(key)) {
                delete this.imagesData[key];
            }
        });
    }
async handleFileUpload(file, node) {
    if (!['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
        alert('Пожалуйста, выберите XLSX или Word файл');
        return;
    }

    try {
        const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const fileReader = new FileReader();

        fileReader.onload = (e) => {
            console.log('File loaded:', file.name, 'Size:', e.target.result.length);

            
            const fileData = {
                name: file.name,
                type: file.type,
                data: e.target.result,
                size: file.size,
                lastModified: file.lastModified || Date.now()
            };

            this.filesData[fileId] = fileData;

            
            if (!node.content.files) {
                node.content.files = [];
            }
            node.content.files.push(fileId);

            console.log('Files in node after upload:', node.content.files);
            console.log('Total files in filesData:', Object.keys(this.filesData).length);

            this.updateTree();
            this.saveData();

            
            this.showNotification(`Файл "${file.name}" успешно загружен`);
        };

        fileReader.onerror = (error) => {
            console.error('FileReader error:', error);
            alert('Ошибка чтения файла');
        };

        fileReader.readAsDataURL(file);

    } catch(error) {
        console.error('Error uploading file:', error);
        alert('Ошибка загрузки файла: ' + error.message);
    }
}

    async handleImageUpload(file, node) {
        if(!file.type.startsWith('image/')) {
            alert('Пожалуйста, выберите файл изображения');
            return;
        }

        try {
            const compressedImage = await this.compressImage(file);
            const imageId = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            this.imagesData[imageId] = compressedImage;
            node.content.img = imageId;
            this.updateTree();
            this.saveData();
            
            if(this.selectedNode) {
                this.selectedNode.element.classList.add('glow');
                setTimeout(() => 
                    this.selectedNode.element.classList.remove('glow'), 1000);
            }
        } catch(error) {
            alert('Ошибка обработки изображения: ' + error.message);
            node.content.img = null;
            this.updateTree();
        }
    }

    compressImage(file, quality = 0.6, maxWidth = 800) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                let width = img.width;
                let height = img.height;
                if(width > maxWidth) {
                    height = Math.round((height *= maxWidth / width));
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(blob => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                }, 'image/jpeg', quality);
            };
            
            img.onerror = reject;
        });
    }

    showFullPreview(src) {
        this.elements.previewContainer.style.display = 'flex';
        this.elements.fullPreview.src = this.imagesData[src] || src;
        setTimeout(() => {
            this.elements.previewContainer.classList.add('preview-visible');
        }, 10);
    }

    hidePreview() {
        this.elements.previewContainer.classList.remove('preview-visible');
        setTimeout(() => {
            this.elements.previewContainer.style.display = 'none';
        }, 300);
    }

    uploadImage() {
        if(!this.selectedNode) return;
        
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            if(e.target.files[0]) this.handleImageUpload(e.target.files[0], this.selectedNode.node);
        };
        input.click();
    }
  
toggleTheme() {
  this.darkMode = !this.darkMode;
  document.documentElement.classList.toggle('dark', this.darkMode);
  localStorage.setItem('treeAppTheme', this.darkMode ? 'dark' : 'light');
  document.body.classList.add('fade-in');
  const x = window.mouseX || window.innerWidth / 2;
  const y = window.mouseY || window.innerHeight / 2;
  this.createFireworks(x, y);
  const overlay = document.getElementById('themeTransitionOverlay');
  overlay.style.setProperty('--x', x + 'px');
  overlay.style.setProperty('--y', y + 'px');
  overlay.classList.add('active');
  
  setTimeout(() => {
    overlay.classList.remove('active');
    document.body.classList.remove('fade-in');
  }, 800);
}
hideImageIcon(nodeId) {
  const node = this.findNode(this.treeData, nodeId);
  if (node) {
    node.content.hideIcon = true;
    this.updateTree();
    this.saveData();
  }
}

hideDepartmentManagement() {
    this.departmentManagement.active = false;
    document.getElementById('departmentManagement').style.display = 'none';
    const styleElement = document.getElementById('department-management-styles');
    if (styleElement) {
        styleElement.remove();
    }

   
    if (this.departmentManagement.keyListeners) {
        document.removeEventListener('keydown', this.departmentManagement.keyListeners.down);
        delete this.departmentManagement.keyListeners;
    }

}
saveDeptHistory() {
    if (!this.departmentManagement.active) return;


    const currentState = {
        clusters: new Map(this.clusters),
        tree: JSON.parse(JSON.stringify(this.treeData))
    };

    this.departmentManagement.history.push(currentState);
    if (this.departmentManagement.history.length > this.departmentManagement.maxHistory) {
        this.departmentManagement.history.shift();
    }
}
undoDeptChange() {
    if (this.departmentManagement.history.length === 0) {
        this.showNotification('Нет действий для отмены');
        return;
    }
    const lastState = this.departmentManagement.history.pop();
    this.clusters = new Map(lastState.clusters);
    this.treeData = lastState.tree;
    this.renderDepartmentManagement();
    this.updateTree();
    this.saveData();
    this.showNotification('Последнее действие отменено');
}
showDepartmentManagement() {
    this.injectDepartmentManagementStyles();
    this.departmentManagement.active = true;
    this.departmentManagement.history = [];
 this.departmentManagement.selectedNodesInDialog.clear();
    const modal = document.getElementById('departmentManagement');
    modal.style.display = 'flex';
    this.departmentManagement.activeDeputy = null;
    const header = modal.querySelector('.department-header');
    if (header && !header.querySelector('.help-tooltip-trigger')) {
         this.setupHelpTooltips(header, 'departments');
    }

    const handleKeyDown = (e) => {
        if (this.departmentManagement.active && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'я')) {
            e.preventDefault();
            this.undoDeptChange();
        }
    };

    this.departmentManagement.keyListeners = {
        down: handleKeyDown
    };
    document.addEventListener('keydown', this.departmentManagement.keyListeners.down);
    const handleCtrlClick = (e) => {
        if (this.departmentManagement.active && e.ctrlKey) {
            e.preventDefault();
        }
    };

    document.addEventListener('click', handleCtrlClick);

    this.renderDepartmentManagement();
}

setupHelpTooltips(container, context) {
    const existingTrigger = container.querySelector('.help-tooltip-trigger');
    if (existingTrigger) {
        console.log('Help tooltip уже существует в контейнере, пропускаем создание');
        return;
    }

    if (!document.getElementById('help-tooltip-styles')) {
        const style = document.createElement('style');
        style.id = 'help-tooltip-styles';
        style.textContent = `
            .help-tooltip-trigger {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: var(--secondary-color);
                color: white;
                cursor: pointer;
                font-weight: bold;
                margin-left: 10px;
                user-select: none;
                position: relative;
            }
            .help-tooltip-content {
                display: none;
                position: absolute;
                top: 100%; 
                right: 0;
                margin-top: 8px;
                background: var(--controls-bg);
                border: 1px solid var(--primary-color);
                border-radius: 8px;
                padding: 15px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                min-width: 450px !important;
                max-width: 600px !important;
                z-index: 10001;
                text-align: left;
                color: var(--text-color);
            }
            .help-tooltip-trigger:hover .help-tooltip-content {
                display: block;
            }
            .help-tooltip-content h4 {
                margin-top: 0;
                color: var(--primary-color);
            }
            .help-tooltip-content ul {
                padding-left: 20px;
                margin: 0;
            }
            .help-tooltip-content li {
                margin-bottom: 8px;
            }
            .help-tooltip-content code {
                background: rgba(93, 138, 168, 0.15);
                padding: 2px 5px;
                border-radius: 4px;
                font-family: monospace;
            }
        `;
        document.head.appendChild(style);
    }

    const trigger = document.createElement('div');
    trigger.className = 'help-tooltip-trigger';
    trigger.textContent = '?';

    const tooltipContent = document.createElement('div');
    tooltipContent.className = 'help-tooltip-content';

    let contentHTML = '';
    if (context === 'main') {
        contentHTML = `
            <h4>Горячие клавиши (Дерево)</h4>
            <ul>
                <li><code>Ctrl + C</code> — Копировать без вырезания/Вырезать узел (на выбор 3 варианта)</li>
                <li><code>Ctrl + V</code> — Вставить узел рядом</li>
                <li><code>Ctrl + F</code> — Вставить как дочерний узел (внутрь выбранного узла)</li>
                <li><code>Ctrl + G</code> — Вставить как родительский узел (скопированный узел становится подчинененным узлом, работает только для одиночного копирования)</li>
                <li><code>Ctrl + R</code> — Заменить узел (сохраняя дочерние, работает только для одиночного копирования)</li>
                <li><code>Ctrl + E</code> — Реструктуризация ветки (переносим необходимые узлы, меняется иерархия узлов)</li>
                <li><code>Ctrl + Z</code> — Отменить последнее действие</li>
                <li><code>Ctrl + Клик</code> — Множественное выделение</li>
                <li><code>Esc</code> — Сбросить выделение / Очистить буфер обмена</li>
            </ul>
        `;
    } else if (context === 'departments') {
        contentHTML = `
            <h4>Горячие клавиши (Отделы)</h4>
            <ul>
                <li><code>Z</code> — Отменить последнее изменение в отделах</li>
                <li><code>ЛКМ по узлу</code> — Перенести узел</li>
                <li><code>ПКМ по узлу</code> — Удалить узел</li>
            </ul>
        `;
    }

    tooltipContent.innerHTML = contentHTML;
    trigger.appendChild(tooltipContent);
    container.appendChild(trigger);
}
injectDepartmentManagementStyles() {
    if (document.getElementById('department-management-styles')) {
        return;
    }

    const style = document.createElement('style');
    style.id = 'department-management-styles';
    style.textContent = `
        .dept-view-node-content.needs-update {
            border: 2px solid #ff4444 !important;
            box-shadow: 0 0 8px rgba(255, 68, 68, 0.5);
        }
        .deputy-card {
            cursor: pointer;
            padding: 20px 25px;
            border: 2px solid var(--primary-color);
            border-radius: 12px;
            width: 320px;
            max-width: 320px;
            flex: 0 0 auto;
            text-align: center;
            user-select: none;
            transition: all 0.3s ease;
            background: var(--node-bg);
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            font-size: 1.1em;
            font-weight: 500;
            color: var(--text-color);
        }
        .deputy-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 16px rgba(93, 138, 168, 0.2);
            border-color: var(--secondary-color);
        }
        .dept-view-copy-btn {
            cursor: pointer;
            background: none;
            border: none;
            font-size: 1.2em;
            padding: 0 5px;
            line-height: 1;
            transition: transform 0.2s, color 0.2s;
            color: var(--secondary-color);
            opacity: 0.7;
        }
        .dept-view-copy-btn:hover {
            transform: scale(1.2);
            opacity: 1;
        }
        .dept-view-node-content {
            position: relative;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 8px;
            border-radius: 8px;
            transition: all 0.2s ease-in-out;
            border: 2px solid transparent;
            margin: 2px 0;
        }
        .dept-view-node-content.is-clustered {
            border-color: var(--primary-color);
            background-color: rgba(93, 138, 168, 0.05);
        }
        .dept-view-node-content:hover {
            background-color: rgba(93, 138, 168, 0.1);
        }
        .dept-view-controls {
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            display: flex;
            align-items: center;
            gap: 5px;
            opacity: 0;
            transition: opacity 0.2s ease-in-out;
            background-color: var(--controls-bg);
            padding: 4px;
            border-radius: 6px;
        }
        .dept-view-node-content:hover .dept-view-controls {
            opacity: 1;
        }
        .dept-view-btn {
            cursor: pointer;
            background: none;
            border: none;
            font-size: 1.4em;
            padding: 0;
            line-height: 1;
            transition: transform 0.2s, color 0.2s;
            width: 22px;
            height: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .dept-view-btn:hover {
            transform: scale(1.2);
        }
        .dept-view-remove-cluster {
            color: #5D8AA8;
        }
        .dept-view-remove-cluster:hover {
            color: #ff4444;
        }
        .dept-view-add-cluster {
            color: #388E3C;
        }
        .dept-view-add-cluster:hover {
            color: #4CAF50;
        }
        .dept-view-cluster-select {
            font-size: 0.85em;
            padding: 2px 4px;
            border-radius: 4px;
            border: 1px solid var(--primary-color);
            background-color: var(--controls-bg);
            color: var(--text-color);
            max-width: 150px;
        }
        .dept-view-text-container {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            flex-grow: 1;
            overflow: hidden;
        }
        .dept-view-node-name {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
            font-weight: 600;
        }
        .dept-view-cluster-tag {
            font-size: 0.8em;
            padding: 2px 6px;
            background-color: rgba(93, 138, 168, 0.2);
            border-radius: 4px;
            color: var(--primary-color);
            font-weight: 500;
            margin-top: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 250px;
        }
        .dept-view-copy-btn {
            color: var(--secondary-color);
            opacity: 0.7;
        }
        .dept-view-copy-btn:hover {
            transform: scale(1.2);
            opacity: 1;
        }
        .dept-view-checkbox:checked {
            background-color: var(--accent-color);
            border-color: var(--accent-color);
        }
        .dept-view-node-content.selected-descendant {
            background-color: rgba(255, 160, 122, 0.2);
        }
    `;
    document.head.appendChild(style);
}
renderDepartmentManagement() {
    const container = document.getElementById('departmentContainer');
    const currentFilterValue = container.querySelector('.department-management-tree-view-filter')?.value || '';

    container.innerHTML = '';
    container.style.display = 'block';
    container.style.overflowY = 'auto';

    const root = this.treeData;

    if (!this.departmentManagement.activeDeputy) {
        let targetNode = null;
        root.children.forEach(level1Node => {
            if (targetNode) return;
            level1Node.children.forEach(level2Node => {
                if (level2Node.content.text === "Иванова Марина Владимировна") {
                    targetNode = level2Node;
                }
            });
        });

        if (!targetNode) {
            container.textContent = 'Узел "Иванова Марина Владимировна" на 2 уровне не найден';
            return;
        }

        const list = document.createElement('div');
        list.classList.add('deputies-list');
        const card = document.createElement('div');
        card.textContent = targetNode.content.text;
        card.classList.add('deputy-card');
        card.addEventListener('click', () => {
            this.departmentManagement.activeDeputy = targetNode.id;
            this.renderDepartmentManagement();
        });
        list.appendChild(card);
        container.appendChild(list);

    } else {
        const headerContainer = document.createElement('div');
        headerContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;';

        const backBtn = document.createElement('button');
        backBtn.textContent = '← Назад';
        backBtn.style.cssText = 'padding: 6px 12px; border: 1px solid var(--primary-color); border-radius: 6px; cursor: pointer;';
        backBtn.addEventListener('click', () => {
            this.departmentManagement.activeDeputy = null;
            this.renderDepartmentManagement();
        });
        headerContainer.appendChild(backBtn);

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Фильтр по узлам...';
        searchInput.className = 'department-management-tree-view-filter';
        searchInput.style.cssText = `
            padding: 6px 10px;
            border: 1px solid var(--primary-color);
            border-radius: 6px;
            flex: 1;
            min-width: 200px;
            max-width: 400px;
        `;
        searchInput.value = currentFilterValue;
        headerContainer.appendChild(searchInput);

        const selectAllBtn = document.createElement('button');
        selectAllBtn.textContent = 'Выделить/Снять все';
        selectAllBtn.style.cssText = `
            padding: 6px 12px;
            border: 1px solid var(--primary-color);
            border-radius: 6px;
            cursor: pointer;
        `;
        selectAllBtn.addEventListener('click', () => {
            const treeView = container.querySelector('.department-management-tree-view');
            const visibleCheckboxes = treeView ? Array.from(treeView.querySelectorAll('.dept-view-checkbox')) : [];
            const allSelected = visibleCheckboxes.length > 0 && visibleCheckboxes.every(cb => cb.checked);
            visibleCheckboxes.forEach(checkbox => {
                checkbox.checked = !allSelected;
            });
        });
        headerContainer.appendChild(selectAllBtn);

        const showNewBtn = document.createElement('button');
        showNewBtn.style.cssText = `
            padding: 6px 12px;
            border: 1px solid var(--primary-color);
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
        `;

        if (this.uiSettings.showNewNodesOnly) {
            showNewBtn.textContent = 'Сбросить фильтр';
            showNewBtn.style.background = 'var(--accent-color)';
            showNewBtn.style.color = 'white';
        } else {
            showNewBtn.textContent = 'Показать новые';
            showNewBtn.style.background = 'transparent';
            showNewBtn.style.color = 'var(--text-color)';
        }

        showNewBtn.addEventListener('click', () => {
            this.uiSettings.showNewNodesOnly = !this.uiSettings.showNewNodesOnly;
            this.saveData();
            this.renderDepartmentManagement();
        });
        headerContainer.appendChild(showNewBtn);

        const collapseBtn = document.createElement('button');
        collapseBtn.textContent = 'Свернуть все';
        collapseBtn.style.cssText = 'padding: 6px 12px; border: 1px solid var(--primary-color); border-radius: 6px; cursor: pointer;';
        collapseBtn.addEventListener('click', () => {
            const selectedNode = this.findNode(root, this.departmentManagement.activeDeputy);
            if (selectedNode) {
                this.collapseAllInDeptManagement(selectedNode);
                this.renderDepartmentManagement();
            }
        });
        headerContainer.appendChild(collapseBtn);

        container.appendChild(headerContainer);

        const selectedNode = this.findNode(root, this.departmentManagement.activeDeputy);
        if (!selectedNode) {
            container.textContent = 'Узел не найден';
            return;
        }

        const header = document.createElement('h2');
        header.textContent = `Структура отделов: ${selectedNode.content.text}`;
        header.style.cssText = 'margin: 15px 0; text-align: center;';
        container.appendChild(header);

        const treeViewContainer = document.createElement('div');
        treeViewContainer.className = 'department-management-tree-view';
        treeViewContainer.style.cssText = 'border: 1px solid var(--primary-color); border-radius: 8px; padding: 15px; background: rgba(93, 138, 168, 0.05);';
        container.appendChild(treeViewContainer);

        const redrawFilteredTree = () => {
            const filterText = searchInput.value.toLowerCase().trim();
            treeViewContainer.innerHTML = '';
            selectedNode.children.forEach(child => {
                this.renderDepartmentNodeRecursive(child, treeViewContainer, 0, filterText);
            });
        };

        searchInput.addEventListener('input', redrawFilteredTree);
        redrawFilteredTree();
    }
}
renderDepartmentNodeRecursive(node, parentElement, level, filterText = '', ancestorMatches = false) {
    const showNewOnly = this.uiSettings.showNewNodesOnly;

    const isNewNode = !this.clusters.has(node.id);

    const hasNewDescendant = (n) => {
        if (!this.clusters.has(n.id)) return true;
        return n.children && n.children.some(hasNewDescendant);
    };

    const matchesNewFilter = !showNewOnly || isNewNode || hasNewDescendant(node);

    const currentNodeMatches = filterText ? this.nodeMatchesSearch(node, filterText, true) : true;
    const hasVisibleChild = filterText ? this.isParentOfMatch(node, filterText, true) : false;

    if ((filterText && !currentNodeMatches && !hasVisibleChild && !ancestorMatches) || !matchesNewFilter) {
        return;
    }

    const nodeElement = document.createElement('div');
    nodeElement.className = 'dept-view-node';
    nodeElement.style.marginLeft = `${level * 20}px`;
    nodeElement.dataset.nodeId = node.id;

    const nodeContent = document.createElement('div');
    nodeContent.className = 'dept-view-node-content';

    if (!this.clusters.has(node.id)) {
        nodeContent.classList.add('needs-update');
    }

    if (this.clusters.has(node.id)) {
        nodeContent.classList.add('is-clustered');
    }

    if (node.needsClusterUpdate && !node.circularlyReplaced) {
        nodeContent.classList.add('needs-update');
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'dept-view-checkbox';
    checkbox.style.marginRight = '8px';
    checkbox.dataset.nodeId = node.id;

    const isInitiallySelected = this.departmentManagement.selectedNodesInDialog.has(node.id);
    checkbox.checked = isInitiallySelected;
    if (isInitiallySelected) {
        nodeContent.style.backgroundColor = 'var(--primary-color)';
        nodeContent.style.color = 'white';
        nodeContent.style.borderRadius = '5px';
        const nodeName = nodeContent.querySelector('.dept-view-node-name');
        const expandIcon = nodeContent.querySelector('.dept-view-expand');
        const clusterTag = nodeContent.querySelector('.dept-view-cluster-tag');
        if (nodeName) nodeName.style.color = 'white';
        if (expandIcon) expandIcon.style.color = 'white';
        if (clusterTag) clusterTag.style.color = 'white';
    }

    const updateGlobalSelectionSet = (startNode, add, recursive = false) => {
        if (add) {
            this.departmentManagement.selectedNodesInDialog.add(startNode.id);
        } else {
            this.departmentManagement.selectedNodesInDialog.delete(startNode.id);
        }
        if (recursive && startNode.children) {
            startNode.children.forEach(child => updateGlobalSelectionSet(child, add, true));
        }
    };

    checkbox.addEventListener('click', e => {
        e.stopPropagation();
        const isChecked = checkbox.checked;
        const isRecursive = e.ctrlKey;

        this.updateDepartmentNodeSelectionVisuals(node, isChecked, isRecursive);
        updateGlobalSelectionSet(node, isChecked, isRecursive);
    });

    nodeContent.addEventListener('click', (e) => {
        if (e.target !== checkbox && !e.target.closest('.dept-view-controls')) {
            checkbox.checked = !checkbox.checked;
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                ctrlKey: e.ctrlKey
            });
            checkbox.dispatchEvent(clickEvent);
        }
    });

    nodeContent.appendChild(checkbox);

    const expandIcon = document.createElement('span');
    expandIcon.className = 'dept-view-expand';
    if (node.children && node.children.length > 0) {
        expandIcon.textContent = (filterText || showNewOnly || node.isExpanded) ? '▼' : '▶';
    } else {
        expandIcon.textContent = '•';
        expandIcon.style.cursor = 'default';
    }
    nodeContent.appendChild(expandIcon);

    const textContainer = document.createElement('div');
    textContainer.className = 'dept-view-text-container';
    const nodeText = document.createElement('span');
    nodeText.className = 'dept-view-node-name';
    nodeText.textContent = node.content.text;
    textContainer.appendChild(nodeText);

    const clusterName = this.clusters.get(node.id);

    if (clusterName) {
        const clusterTagContainer = document.createElement('div');
        clusterTagContainer.style.display = 'flex';
        clusterTagContainer.style.alignItems = 'center';
        clusterTagContainer.style.gap = '5px';

        const clusterTag = document.createElement('span');
        clusterTag.className = 'dept-view-cluster-tag';
        clusterTag.textContent = clusterName;
        clusterTagContainer.appendChild(clusterTag);
        const copyBtn = document.createElement('button');
        copyBtn.className = 'dept-view-copy-btn';
        copyBtn.innerHTML = '⎘';
        copyBtn.title = `Копировать: "${clusterName}"`;
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyToClipboard(clusterName);
        });
        clusterTagContainer.appendChild(copyBtn);

        textContainer.appendChild(clusterTagContainer);
    }
    nodeContent.appendChild(textContainer);

    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'dept-view-controls';

    const handleClusterAction = (action, ...args) => {
        const modal = document.getElementById('departmentManagement');
        const checkedBoxes = modal.querySelectorAll('.dept-view-checkbox:checked');
        const selectedNodes = new Set();

        if (checkedBoxes.length > 0) {
            checkedBoxes.forEach(cb => {
                selectedNodes.add(parseInt(cb.dataset.nodeId, 10));
            });
        } else {
            selectedNodes.add(node.id);
        }

        if (selectedNodes.size > 0) {
            action(selectedNodes, ...args);
        }
    };

    if (this.clusters.has(node.id)) {
        const select = document.createElement('select');
        select.className = 'dept-view-cluster-select';
        this.availableClusters.forEach(cluster => {
            const option = document.createElement('option');
            option.value = cluster;
            option.textContent = cluster;
            if (cluster === this.clusters.get(node.id)) option.selected = true;
            select.appendChild(option);
        });
        select.addEventListener('click', e => e.stopPropagation());
        select.addEventListener('change', (e) => {
            const newCluster = e.target.value;
            this.saveDeptHistory();
            handleClusterAction((nodes) => {
                nodes.forEach(id => this.addNodeToCluster(id, newCluster));
                this.showNotification(`${nodes.size} узл(а/ов) перемещено в отдел "${newCluster}"`);
                this.renderDepartmentManagement();
            });
        });
        controlsContainer.appendChild(select);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'dept-view-btn dept-view-remove-cluster';
        removeBtn.innerHTML = '✘';
        removeBtn.title = `Удалить из отдела "${this.clusters.get(node.id)}"`;
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.saveDeptHistory();
            handleClusterAction((nodes) => {
                nodes.forEach(id => this.clusters.delete(id));
                this.showNotification(`${nodes.size} узл(а/ов) удалено из отдела`);
                this.renderDepartmentManagement();
            });
        });
        controlsContainer.appendChild(removeBtn);

    } else {
        const addBtn = document.createElement('button');
        addBtn.className = 'dept-view-btn dept-view-add-cluster';
        addBtn.innerHTML = '➕';
        addBtn.title = 'Добавить в новый отдел';
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const newClusterName = prompt('Введите название нового отдела:');
            if (newClusterName && newClusterName.trim()) {
                this.saveDeptHistory();
                handleClusterAction((nodes) => {
                    nodes.forEach(id => this.addNodeToCluster(id, newClusterName.trim()));
                    this.renderDepartmentManagement();
                });
            }
        });
        controlsContainer.appendChild(addBtn);
    }

    nodeContent.appendChild(controlsContainer);
    nodeElement.appendChild(nodeContent);
    parentElement.appendChild(nodeElement);

    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'dept-view-children';
    if (!node.isExpanded && !showNewOnly) {
        childrenContainer.style.display = 'none';
    }
    nodeElement.appendChild(childrenContainer);

    expandIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        if (node.children && node.children.length > 0) {
            node.isExpanded = !node.isExpanded;
            childrenContainer.style.display = node.isExpanded ? 'block' : 'none';
            expandIcon.textContent = node.isExpanded ? '▼' : '▶';
        }
    });

    if (node.children) {
        node.children.forEach(child => {
            this.renderDepartmentNodeRecursive(child, childrenContainer, level + 1, filterText, ancestorMatches || currentNodeMatches);
        });
    }
}
updateDepartmentNodeSelectionVisuals(node, isSelected, recursive = false) {
    const nodeElement = document.querySelector(`.dept-view-node[data-node-id="${node.id}"]`);
    if (nodeElement) {
        const checkbox = nodeElement.querySelector('.dept-view-checkbox');
        const nodeContent = nodeElement.querySelector('.dept-view-node-content');

        if (checkbox) {
            checkbox.checked = isSelected;
        }

        if (isSelected) {
            nodeContent.style.backgroundColor = 'var(--primary-color)';
            nodeContent.style.color = 'white';
            nodeContent.style.borderRadius = '5px';
            const nodeName = nodeContent.querySelector('.dept-view-node-name');
            const expandIcon = nodeContent.querySelector('.dept-view-expand');
            const clusterTag = nodeContent.querySelector('.dept-view-cluster-tag');

            if (nodeName) nodeName.style.color = 'white';
            if (expandIcon) expandIcon.style.color = 'white';
            if (clusterTag) clusterTag.style.color = 'white';
        } else {
            nodeContent.style.backgroundColor = '';
            nodeContent.style.color = '';
            nodeContent.style.borderRadius = '';
            const nodeName = nodeContent.querySelector('.dept-view-node-name');
            const expandIcon = nodeContent.querySelector('.dept-view-expand');
            const clusterTag = nodeContent.querySelector('.dept-view-cluster-tag');

            if (nodeName) nodeName.style.color = '';
            if (expandIcon) expandIcon.style.color = '';
            if (clusterTag) clusterTag.style.color = '';
        }
    }
    if (recursive && node.children) {
        node.children.forEach(child => {
            this.updateDepartmentNodeSelectionVisuals(child, isSelected, true);
        });
    }
}
performMultiTargetRestructure(groups) {
    this.saveToHistory(false, true);

    let totalMoved = 0;
    let totalDeleted = 0;
    groups.forEach(group => {
        group.state.forEach((state) => {
            if (state === 'move') totalMoved++;
            if (state === 'delete') totalDeleted++;
        });
    });

    const logParts = [];
    if (totalMoved > 0) logParts.push(`перемещено ${totalMoved} узлов`);
    if (totalDeleted > 0) logParts.push(`удалено ${totalDeleted} узлов`);
    if (logParts.length > 0) {
        this.logAction(`Реструктуризация: ${logParts.join(', ')}.`);
    }

    const allNodesToModify = new Set();
    const nodesToDelete = new Set();
    const moveOperations = [];
    let errorOccurred = false;

    groups.forEach((group, index) => {
        if (errorOccurred) return;
        const nodesToMoveInGroup = new Set();
        group.state.forEach((state, id) => {
            allNodesToModify.add(id);
            if (state === 'delete') {
                nodesToDelete.add(id);
            } else if (state === 'move') {
                nodesToMoveInGroup.add(id);
            }
        });

        if (nodesToMoveInGroup.size > 0) {
            if (!group.targetId) {
                this.showNotification(`Не выбран целевой узел для Группы №${index + 1}`, 'error');
                errorOccurred = true;
                return;
            }
            moveOperations.push({
                nodes: nodesToMoveInGroup,
                targetId: group.targetId
            });
        }
    });

    if (errorOccurred) return;

    nodesToDelete.forEach(id => allNodesToModify.add(id));

    moveOperations.forEach(op => {
        op.hierarchy = this.buildPreservedHierarchy(op.nodes);
    });

    const newRootChildren = [];
    this.treeData.children.forEach(child => {
        const result = this.restructureAndPruneTree(child, allNodesToModify);
        newRootChildren.push(...result);
    });
    this.treeData.children = newRootChildren;

    moveOperations.forEach(op => {
        const targetNode = this.findNode(this.treeData, op.targetId);
        if (targetNode) {
            if (!targetNode.children) {
                targetNode.children = [];
            }
            targetNode.children.push(...op.hierarchy);
            targetNode.isExpanded = true;
            const targetCluster = this.clusters.get(targetNode.id);
            this.recursivelyUpdateCluster(op.hierarchy, targetCluster);

        } else {
            console.error(`Критическая ошибка: Целевой узел с ID ${op.targetId} не найден после удаления веток.`);
        }
    });

    this.updateTree();
    this.saveData();
    this.showNotification('Реструктуризация успешно выполнена.');
}
performRestructure(selectedNodesWithState, targetId) {
    const nodesToMoveIds = new Set();
    const nodesToDeleteIds = new Set();
    selectedNodesWithState.forEach((state, id) => {
        if (state === 'move') {
            nodesToMoveIds.add(id);
        } else if (state === 'delete') {
            nodesToDeleteIds.add(id);
        }
    });

    if (nodesToMoveIds.size === 0 && nodesToDeleteIds.size === 0) {
        this.showNotification('Не выбраны узлы для переноса или удаления.', 'error');
        return;
    }
    if (nodesToMoveIds.size > 0 && !targetId) {
        this.showNotification('Не выбран целевой узел для вставки.', 'error');
        return;
    }
    const targetNodeOriginal = this.findNode(this.treeData, targetId);
    if (nodesToMoveIds.size > 0 && !targetNodeOriginal) {
        this.showNotification('Целевой узел не найден.', 'error');
        return;
    }

    this.saveToHistory(false, true);
    const logParts = [];
    if (nodesToMoveIds.size > 0) logParts.push(`перемещено ${nodesToMoveIds.size} узлов`);
    if (nodesToDeleteIds.size > 0) logParts.push(`удалено ${nodesToDeleteIds.size} узлов`);
    if (logParts.length > 0) {
        this.logAction(`Реструктуризация: ${logParts.join(', ')}.`);
    }

    const movedHierarchy = this.buildPreservedHierarchy(nodesToMoveIds);
    const allSelectedIds = new Set([...nodesToMoveIds, ...nodesToDeleteIds]);

    const newRootChildren = [];
    this.treeData.children.forEach(child => {
        const result = this.restructureAndPruneTree(child, allSelectedIds);
        newRootChildren.push(...result);
    });
    this.treeData.children = newRootChildren;

    if (targetNodeOriginal && movedHierarchy.length > 0) {
        const targetNodeInNewTree = this.findNode(this.treeData, targetId);
        if (targetNodeInNewTree) {
            targetNodeInNewTree.children.push(...movedHierarchy);
            targetNodeInNewTree.isExpanded = true;
        } else {
            console.error("Критическая ошибка: целевой узел не найден после перестройки дерева.");
            this.showNotification('Ошибка: целевой узел исчез после удаления веток.', 'error');
            return;
        }
    }

    this.updateTree();
    this.saveData();
    this.showNotification('Реструктуризация успешно выполнена.');
}
hasClusteredDescendants(node) {
    for (const child of node.children) {
        if (this.clusters.has(child.id) || this.hasClusteredDescendants(child)) {
            return true;
        }
    }
    return false;
}
collapseAllInDeptManagement(node) {
    node.isExpanded = false;
    if (node.children) {
        node.children.forEach(child => this.collapseAllInDeptManagement(child));
    }
}
async promptForClusterUpdate(node) {
    const clusterList = Array.from(this.availableClusters).sort().join('\n');
    const newCluster = prompt(
        `Узел "${node.content.text}" был перемещен.\n\nВыберите новый отдел из списка или введите название нового:\n\n${clusterList}`,
        this.clusters.get(node.id) || ''
    );

    if (newCluster !== null && newCluster.trim()) {
        const clusterName = newCluster.trim();
        this.clusters.set(node.id, clusterName);
        if (!this.availableClusters.has(clusterName)) {
            this.availableClusters.add(clusterName);
        }
        delete node.needsClusterUpdate;

        this.showNotification(`Узел "${node.content.text}" перемещен в отдел "${clusterName}"`);
        this.renderDepartmentManagement();
        this.updateTree();
        this.saveData();
    }
}
getShortName(fullName, maxWords = 2) {
  const words = fullName.split(' ');
  if (words.length <= maxWords) return fullName;
  return words.slice(0, maxWords).join(' ') + '...';
}
getGroupsInCluster(clusterName) {
    const groups = new Set();
    this.clusters.forEach((cluster, nodeId) => {
        if (cluster === clusterName) {
            const node = this.findNode(this.treeData, nodeId);
            if (node) {
                groups.add(nodeId);
            }
        }
    });
    return Array.from(groups);
}
createGroupElement(groupId, clusterName) {
  const node = this.findNode(this.treeData, groupId);
  if (!node) return null;

  const groupElement = document.createElement('div');
  groupElement.className = 'department-group';
  groupElement.dataset.id = groupId;
  groupElement.dataset.cluster = clusterName;
  groupElement.draggable = true;
  const groupHeader = document.createElement('div');
  groupHeader.textContent = this.getShortName(node.content.text, 4);
  groupHeader.title = node.content.text;
  groupElement.appendChild(groupHeader);
  node.children.forEach(child => {
    const itemContainer = document.createElement('div');
    itemContainer.style.display = 'flex';
    itemContainer.style.flexDirection = 'column';
    itemContainer.style.alignItems = 'center';
    itemContainer.style.marginBottom = '8px'; 

    const itemElement = document.createElement('div');
    itemElement.className = 'department-item';
    itemElement.textContent = this.getShortName(child.content.text, 4);
    itemElement.title = child.content.text;
    itemElement.dataset.id = child.id;
    itemElement.dataset.parent = groupId;
    itemElement.draggable = true;

    let typeKey = null;
    if (child.content.isSubordinate) typeKey = 'должностные регламенты';
    else if (child.content.isIndicator) typeKey = 'государственная программа';
    else if (child.content.isOKR) typeKey = 'окр';
    else if (child.content.absent269) typeKey = 'отсутствует в 269-п';
    else if (child.content.isPower269) typeKey = 'полномочие из 269-п';
    else if (child.content.isForAll) typeKey = 'для всех сотрудников';
    else if (child.content.isAuthority) typeKey = 'идентичное полномочие';

    if (typeKey && NODE_TYPE_COLORS[typeKey]) {
      itemElement.style.border = `2px solid ${NODE_TYPE_COLORS[typeKey]}`;
      itemElement.style.borderRadius = '4px';
      itemElement.style.padding = '4px 8px';
      itemElement.style.backgroundColor = '#222'; 
      itemElement.style.color = 'white';
      itemElement.style.textAlign = 'center';
      itemElement.style.minWidth = '120px'; 
      const abbr = document.createElement('div');
      abbr.textContent = NODE_TYPE_ABBREVIATIONS[typeKey] || '';
      abbr.style.fontSize = '10px';
      abbr.style.color = 'white';
      abbr.style.marginTop = '4px';
      abbr.style.userSelect = 'none';
      abbr.style.fontWeight = 'bold';
      abbr.style.textAlign = 'center';
      itemContainer.appendChild(itemElement);
      itemContainer.appendChild(abbr);
    } else {
      itemContainer.appendChild(itemElement);
    }
    itemElement.addEventListener('dragstart', (e) => {
      this.departmentManagement.draggedItem = child.id;
      this.departmentManagement.draggedType = 'item';
      this.departmentManagement.sourceCluster = clusterName;
      e.dataTransfer.effectAllowed = 'move';
    });

    groupElement.appendChild(itemContainer);
  });
  groupElement.addEventListener('dragstart', (e) => {
    this.departmentManagement.draggedItem = groupId;
    this.departmentManagement.draggedType = 'group';
    this.departmentManagement.sourceCluster = clusterName;
    e.dataTransfer.effectAllowed = 'move';
  });

  return groupElement;
}
showTooltip(element, text) {
  const tooltip = document.getElementById('tooltip-container');
  tooltip.textContent = text;
  tooltip.classList.add('visible');
  
  const rect = element.getBoundingClientRect();
  tooltip.style.left = `${rect.left + window.scrollX}px`;
  tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
}

hideTooltip() {
  const tooltip = document.getElementById('tooltip-container');
  tooltip.classList.remove('visible');
}

handleDepartmentDrop(e, targetElement) {
    if (!this.departmentManagement.draggedItem) return;
    
    const targetCluster = targetElement.closest('.department-column').dataset.cluster;
    const targetGroupId = targetElement.dataset.id;
    
    if (this.departmentManagement.draggedType === 'group') {
        this.moveGroupToCluster(
            this.departmentManagement.draggedItem,
            this.departmentManagement.sourceCluster,
            targetCluster
        );
    } else {
        this.moveItemToGroup(
            this.departmentManagement.draggedItem,
            targetGroupId,
            targetCluster
        );
    }
    
    this.renderDepartmentManagement();
    this.updateTree();
    this.saveData();
}

moveGroupToCluster(groupId, sourceCluster, targetCluster) {
    if (sourceCluster === targetCluster) return;
    this.clusters.delete(groupId);
    this.clusters.set(groupId, targetCluster);
    if (!this.availableClusters.has(targetCluster)) {
        this.availableClusters.add(targetCluster);
    }
    let nodesInSource = 0;
    this.clusters.forEach(cluster => {
        if (cluster === sourceCluster) nodesInSource++;
    });
    
    if (nodesInSource === 0) {
        this.availableClusters.delete(sourceCluster);
    }
}

moveItemToGroup(itemId, targetGroupId, targetCluster) {
    const itemNode = this.findNode(this.treeData, itemId);
    if (!itemNode) return;
    const currentParent = this.findParent(this.treeData, itemId);
    if (!currentParent) return;
    const targetGroup = this.findNode(this.treeData, targetGroupId);
    if (!targetGroup) return;
    currentParent.children = currentParent.children.filter(child => child.id !== itemId);
    targetGroup.children.push(itemNode);
    if (this.clusters.has(itemId)) {
        this.clusters.delete(itemId);
    }
    if (itemNode.children.length > 0 && !this.clusters.has(itemId)) {
        this.clusters.set(itemId, targetCluster);
        this.availableClusters.add(targetCluster);
    }
}
showImageIcon(nodeId) {
  const node = this.findNode(this.treeData, nodeId);
  if (node) {
    node.content.hideIcon = false;
    this.updateTree();
    this.saveData();
  }
}
togglePower269Mark() {
this.saveToHistory();
    if (!this.selectedNode) {
        alert('Выберите узел!');
        return;
    }
    const node = this.selectedNode.node;
    node.content.isPower269 = !node.content.isPower269;
if (node.content.isPower269) {
    node.content.absent269 = false;
    node.content.isForAll = false;
    node.content.isSubordinate = false;
    node.content.isAuthority = false;
    node.content.isOKR = false; 
    node.content.isIndicator = false;
}
    
    this.updateTree();
    this.saveData();
    this.showNotification(
        node.content.isPower269 
            ? 'Узел помечен как "Полномочие из 269-П"'
            : 'Снята пометка "Полномочие из 269-П"'
    );
}
setAsTextOnly(nodeId) {
  const node = this.findNode(this.treeData, nodeId);
  if (node) {
    node.content.isTextOnly = true;
    node.content.img = null;
    this.updateTree();
    this.saveData();
  }
}
showClusterDialog() {
    if (!this.selectedNode) {
        alert('Выберите узел!');
        return;
    }

    const node = this.selectedNode.node;
    const currentCluster = this.clusters.get(node.id);
    
    const clusterName = prompt(
        'Введите название кластера (отдела):', 
        currentCluster || ''
    );
    
    if (clusterName === null) return; // Отмена
    
    if (!clusterName.trim()) {
        if (currentCluster) {
            if (confirm('Удалить узел из кластера?')) {
                this.removeFromCluster();
            }
        }
        return;
    }
    
    this.addNodeToCluster(node.id, clusterName.trim());
}
showMultiClusterDialog() {
    if (this.selectedNodes.size === 0) {
        alert('Выберите узлы для добавления в кластер!');
        return;
    }

    const clusterName = prompt('Введите название кластера для выбранных узлов:');
    if (clusterName === null || !clusterName.trim()) return;

    const trimmedName = clusterName.trim();
    this.saveToHistory(false, true); 

    const addedNodeNames = [];
    this.selectedNodes.forEach(nodeId => {
        const node = this.findNode(this.treeData, nodeId);
        if (node) {
            this.clusters.set(nodeId, trimmedName);
            this.availableClusters.add(trimmedName);
            addedNodeNames.push(`"${node.content.text}"`); 
        }
    });
    this.logAction(`Добавлено узлов (${this.selectedNodes.size}) в отдел "${trimmedName}": ${addedNodeNames.join(', ')}`);
    this.updateClusterSelect();
    this.updateTree();
    this.renderDepartmentManagement();
    this.saveData();

    this.showNotification(`Добавлено ${this.selectedNodes.size} узлов в кластер "${trimmedName}"`);

    this.clearMultiSelection();
    this.ctrlPressed = false;
    this.multiSelectMode = false;
}
addNodeToCluster(nodeId, clusterName) {
    this.saveToHistory(false, true); 
    const node = this.findNode(this.treeData, nodeId);

    const previouslyActiveCluster = this.activeCluster;

    if (node) {
        const oldCluster = this.clusters.get(nodeId);
        if (oldCluster) {
            this.logAction(`Узел "${node.content.text}" перемещен из "${oldCluster}" в отдел "${clusterName}"`);
        } else {
            this.logAction(`Узел "${node.content.text}" добавлен в отдел "${clusterName}"`);
        }
        delete node.needsClusterUpdate;
    }

    this.clusters.set(nodeId, clusterName);
    this.availableClusters.add(clusterName);

    this.activeCluster = previouslyActiveCluster;

    this.updateClusterSelect();
    this.updateTree();
    this.renderDepartmentManagement();
    this.saveData();

    this.showNotification(`Узел добавлен в отдел "${clusterName}"`);
}
setupClusterControls() {
    
    this.elements.clusterSelect.style.display = 'none';
    const container = this.elements.clusterSelect.parentNode;
    
   
    const customSelect = this.createCustomSelectContainer();
    container.insertBefore(customSelect, this.elements.clusterSelect);
    customSelect.appendChild(this.elements.clusterSelect);
    
   
    const { selectHeader, selectedValue } = this.createSelectHeader();
    customSelect.insertBefore(selectHeader, this.elements.clusterSelect);
    
    
    const { dropdown, optionsContainer, searchInput } = this.createDropdown();
    customSelect.appendChild(dropdown);
    
    
    const updateOptions = () => {
        optionsContainer.innerHTML = '';
        
        // Добавляем опцию "Вся структура"
        this.addAllOptionOption(optionsContainer, selectedValue, dropdown);
        
        // Добавляем опции кластеров
        this.addClusterOptions(optionsContainer, selectedValue, dropdown);
    };
    
    // Обработчики событий
    this.setupSelectHeaderEvents(selectHeader, dropdown, updateOptions, searchInput);
    this.setupSearchInputEvents(searchInput, optionsContainer);
    this.setupDocumentClickHandler(customSelect, dropdown);
    
    // Добавляем дополнительные кнопки управления
    this.addControlButtons(container);
    
    // Инициализация
    this.updateClusterSelect = () => {
        selectedValue.textContent = this.activeCluster || 'Вся структура';
        this.elements.clusterSelect.value = this.activeCluster || '';
        this.updateClusterRemoveButtons();
    };
    
    this.updateClusterSelect();
}


createCustomSelectContainer() {
    const customSelect = document.createElement('div');
    customSelect.className = 'custom-cluster-select';
    customSelect.style.position = 'relative';
    customSelect.style.display = 'inline-block';
    return customSelect;
}
createSelectHeader() {
    const selectHeader = document.createElement('div');
    selectHeader.className = 'select-header';
    selectHeader.style.padding = '8px 12px';
    selectHeader.style.border = '1px solid var(--primary-color)';
    selectHeader.style.borderRadius = '8px';
    selectHeader.style.cursor = 'pointer';
    selectHeader.style.display = 'flex';
    selectHeader.style.justifyContent = 'space-between';
    selectHeader.style.alignItems = 'center';
    selectHeader.style.minWidth = '250px';

    const selectedValue = document.createElement('span');
    selectedValue.textContent = 'Вся структура';
    selectHeader.appendChild(selectedValue);

    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.alignItems = 'center';
    buttonsContainer.style.gap = '8px';
    const copyBtn = document.createElement('button');
    copyBtn.innerHTML = '⎘'; 
    copyBtn.title = 'Копировать название отдела';
    copyBtn.className = 'select-option-btn';
    copyBtn.addEventListener('click', (e) => {
        e.stopPropagation(); 
        const textToCopy = selectedValue.textContent;
        if (textToCopy && textToCopy !== 'Вся структура') {
            this.copyToClipboard(textToCopy);
        }
    });
    buttonsContainer.appendChild(copyBtn);
    const arrowIcon = document.createElement('span');
    arrowIcon.textContent = '▼';
    arrowIcon.style.marginLeft = '5px';
    buttonsContainer.appendChild(arrowIcon);

    selectHeader.appendChild(buttonsContainer);

    return { selectHeader, selectedValue };
}
createDropdown() {
    const dropdown = document.createElement('div');
    dropdown.className = 'select-dropdown';
    dropdown.style.display = 'none';
    dropdown.style.position = 'absolute';
    dropdown.style.top = '100%';
    dropdown.style.left = '0';
    dropdown.style.right = '0';
    dropdown.style.maxHeight = '300px';
    dropdown.style.overflowY = 'auto';
    dropdown.style.background = 'var(--controls-bg)';
    dropdown.style.border = '1px solid var(--primary-color)';
    dropdown.style.borderRadius = '0 0 8px 8px';
    dropdown.style.zIndex = '1000';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Поиск отдела...';
    searchInput.style.width = '98%';   
    searchInput.style.minWidth = '320px';
    searchInput.style.margin = '8px';
    searchInput.style.padding = '6px 8px';
    searchInput.style.border = '1px solid var(--primary-color)';
    searchInput.style.borderRadius = '4px';
    dropdown.appendChild(searchInput);
    
    const optionsContainer = document.createElement('div');
    dropdown.appendChild(optionsContainer);
    
    return { dropdown, optionsContainer, searchInput };
}
addAllOptionOption(optionsContainer, selectedValue, dropdown) {
    const allOption = document.createElement('div');
    allOption.className = 'select-option';
    allOption.style.padding = '8px';
    allOption.style.cursor = 'pointer';
    allOption.style.display = 'flex';
    allOption.style.justifyContent = 'space-between';
    allOption.style.alignItems = 'center';
    
    const optionText = document.createElement('span');
    optionText.textContent = 'Вся структура';
    allOption.appendChild(optionText);
    
    const copyBtn = document.createElement('span');
    copyBtn.textContent = ' ⎘';
    copyBtn.style.color = 'var(--accent-color)';
    copyBtn.style.cursor = 'pointer';
    copyBtn.title = 'Копировать название';
    copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyToClipboard('Вся структура');
    });
    allOption.appendChild(copyBtn);
    
    allOption.addEventListener('click', () => {
        this.elements.clusterSelect.value = '';
        selectedValue.textContent = 'Вся структура';
        this.activeCluster = null;
        dropdown.style.display = 'none';
        this.updateTree();
        this.saveData();
    });
    
    optionsContainer.appendChild(allOption);
}
addClusterOptions(optionsContainer, selectedValue, dropdown) {
    Array.from(this.availableClusters).sort().forEach(cluster => {
        const option = document.createElement('div');
        option.className = 'select-option';
        option.style.padding = '8px 12px';
        option.style.cursor = 'pointer';
        option.style.display = 'flex';
        option.style.justifyContent = 'space-between';
        option.style.alignItems = 'center';

        const optionText = document.createElement('span');
        optionText.textContent = cluster;
        option.appendChild(optionText);

        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.gap = '10px';
        const copyBtn = document.createElement('button');
        copyBtn.innerHTML = '⎘'; 
        copyBtn.title = 'Копировать название';
        copyBtn.className = 'select-option-btn';
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            this.copyToClipboard(cluster);
        });
        buttonsContainer.appendChild(copyBtn);

        const editBtn = document.createElement('span');
        editBtn.textContent = '✎';
        editBtn.title = 'Редактировать название';
        editBtn.style.color = 'var(--primary-color)';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editClusterName(cluster);
        });
        buttonsContainer.appendChild(editBtn);

        const deleteBtn = document.createElement('span');
        deleteBtn.textContent = '×';
        deleteBtn.title = 'Удалить кластер';
        deleteBtn.style.color = 'var(--accent-color)';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(` [5](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHJqjvVQFhuP1KoF1jizkimiH0QlB-hJDWoJErQXGYn405ORdboHl59asNd87BfC99oKg1Pk-uN06x12Cz7eEGYxURjMAM5KLM3VZzmVmhrBp9NKZY2jtjwqJxU_sbJgbSfjPGVKw==) [6](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFPHP7jZyQP2-bbUa3WMFvKPJmzVFYq-dhzE8TiOpufS80-cjxjqxse6lObzQQT-GYW_Np_d_hKEMSU0RV9fXwYh74WJLWIhJhVs6Rqeb3dxlV2DuCaC20rEO5BkGyL94BnjbPRb67HiCkl8jEkq4oZiFYj4wuPaXcWAisxmj72_8t0rd-Xj1TOcJf6LRYEL6rl_yckJBYYsa9sOlMsiVm8EZRLG6hMk7HR2jqHBC8w3oM=)Удалить кластер "${cluster}"?`)) {
                this.removeCluster(cluster);
                dropdown.style.display = 'none';
            }
        });
        buttonsContainer.appendChild(deleteBtn);

        option.appendChild(buttonsContainer);

        option.addEventListener('click', (e) => {
            if (e.target === option || e.target === optionText) {
                this.elements.clusterSelect.value = cluster;
                selectedValue.textContent = cluster;
                this.activeCluster = cluster;
                dropdown.style.display = 'none';
                this.updateTree();
                this.saveData();
            }
        });

        optionsContainer.appendChild(option);
    });
}
setupSelectHeaderEvents(selectHeader, dropdown, updateOptions, searchInput) {
    selectHeader.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dropdown.style.display === 'block') {
            dropdown.style.display = 'none';
        } else {
            updateOptions();
            dropdown.style.display = 'block';
            searchInput.focus();
        }
    });
}

setupSearchInputEvents(searchInput, optionsContainer) {
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const options = optionsContainer.querySelectorAll('.select-option');
        
        options.forEach(option => {
            const text = option.querySelector('span:first-child').textContent.toLowerCase();
            option.style.display = text.includes(searchTerm) ? 'flex' : 'none';
        });
    });
}

setupDocumentClickHandler(customSelect, dropdown) {
    document.addEventListener('click', (e) => {
        if (!customSelect.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

addControlButtons(container) {
    if (!container.querySelector('.remove-from-cluster-btn')) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-from-cluster-btn';
        removeBtn.textContent = 'Удалить из отдела';
        removeBtn.title = 'Удалить выбранный узел из текущего кластера';
        removeBtn.style.marginLeft = '8px';
        removeBtn.style.padding = '5px 8px';
removeBtn.style.fontSize = '0.7em'; 
        removeBtn.style.borderRadius = '6px';
        removeBtn.style.background = 'linear-gradient(145deg, #ff4444, #d32f2f)';
        removeBtn.style.color = 'white';
        removeBtn.style.border = 'none';
        removeBtn.style.cursor = 'pointer';
        removeBtn.style.display = 'inline-block';
        
        removeBtn.addEventListener('click', () => {
            if (this.selectedNode) {
                this.removeFromCluster();
            } else {
                alert('Выберите узел для удаления из кластера!');
            }
        });
        
        container.insertBefore(removeBtn, this.elements.addToClusterBtn.nextSibling);
    }
}
copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => {
            this.showNotification(`Скопировано: "${text}"`);
        })
        .catch(err => {
            console.error('Ошибка копирования в буфер обмена:', err);
            this.showNotification('Не удалось скопировать текст');
        });
}
updateClusterRemoveButtons() {
    const removeBtn = this.elements.clusterSelect.parentNode.querySelector('.remove-from-cluster-btn');
    
    if (removeBtn) {
        const nodeInCluster = this.selectedNode && this.clusters.has(this.selectedNode.node.id);
        removeBtn.style.display = 'inline-block';
        removeBtn.disabled = !nodeInCluster;
        removeBtn.style.opacity = nodeInCluster ? '1' : '0.5';
        
        if (nodeInCluster) {
            const clusterName = this.clusters.get(this.selectedNode.node.id);
            removeBtn.title = `Удалить узел из кластера "${clusterName}"`;
        } else {
            removeBtn.title = 'Выберите узел, принадлежащий кластеру';
        }
    }
}
updateClusterSelect() {
    try {
        const select = this.elements.clusterSelect;
        if (!select) {
            console.error('Cluster select element not found');
            return;
        }

        const currentValue = select.value;
        const currentSearch = this.elements.searchInput?.value || '';

        const options = ['<option value="">Вся структура</option>'];

        Array.from(this.availableClusters)
            .sort((a, b) => a.localeCompare(b))
            .forEach(cluster => {
                options.push(`<option value="${cluster}">${cluster}</option>`);
            });

        select.innerHTML = options.join('');

        if (this.activeCluster && this.availableClusters.has(this.activeCluster)) {
            select.value = this.activeCluster;
        } else if (currentValue && this.availableClusters.has(currentValue)) {
            select.value = currentValue;
        }

        if (this.elements.searchInput && currentSearch) {
            this.elements.searchInput.value = currentSearch;
            this.handleSearchInput(currentSearch);
        }
        this.updateClusterRemoveButton();
        const customSelect = this.elements.clusterSelect.parentNode.querySelector('.custom-cluster-select');
        if (customSelect) {
            const buttons = customSelect.querySelectorAll('button');
            const selectedName = select.value || '';
            buttons.forEach(btn => {
                btn.disabled = !selectedName || selectedName === '';
                btn.style.opacity = btn.disabled ? '0.5' : '1';
                btn.title = btn.disabled ? 'Выберите кластер' : btn.title;
            });
        }

    } catch (error) {
        console.error('Error updating cluster select:', error);
    }
}
removeCluster(clusterName) {
    if (!clusterName || !this.availableClusters.has(clusterName)) {
        alert('Кластер не найден!');
        return;
    }
    
    if (!confirm(`Вы уверены, что хотите полностью удалить кластер "${clusterName}"? Все узлы будут удалены из этого кластера.`)) {
        return;
    }
    const nodesToRemove = [];
    this.clusters.forEach((value, key) => {
        if (value === clusterName) {
            nodesToRemove.push(key);
        }
    });
    
    nodesToRemove.forEach(key => {
        this.clusters.delete(key);
    });
    
    this.availableClusters.delete(clusterName);
    if (this.activeCluster === clusterName) {
        this.activeCluster = null;
        this.elements.clusterSelect.value = '';
    }
    
    this.updateClusterSelect();
    this.updateTree();
    this.saveData();
    this.showNotification(`Кластер "${clusterName}" полностью удален`);
}
removeFromCluster() {
    this.saveToHistory(false, true); 

    const nodesToRemove = this.selectedNodes.size > 0 ? new Set(this.selectedNodes) : new Set([this.selectedNode?.node.id]);

    if (nodesToRemove.size === 0 || (nodesToRemove.size === 1 && !this.selectedNode)) {
        this.showNotification('Выберите узел(ы) для удаления из отдела.', 'error');
        return;
    }

    const removedNodesInfo = [];
    let clusterWasDeleted = false;
    nodesToRemove.forEach(nodeId => {
        if (this.clusters.has(nodeId)) {
            const node = this.findNode(this.treeData, nodeId);
            const clusterName = this.clusters.get(nodeId);
            if (node) {
                removedNodesInfo.push({ name: node.content.text, cluster: clusterName });
            }
            this.clusters.delete(nodeId);
        }
    });

    if (removedNodesInfo.length === 0) {
        this.showNotification('Выбранные узлы не принадлежат ни одному отделу.');
        return;
    }

    const logMessage = `Удалено узлов из отдела (${removedNodesInfo.length}): ${removedNodesInfo.map(n => `"${n.name}" из "${n.cluster}"`).join(', ')}`;
    this.logAction(logMessage);

    const affectedClusters = new Set(removedNodesInfo.map(n => n.cluster));
    affectedClusters.forEach(clusterName => {
        let nodesLeftInCluster = 0;
        this.clusters.forEach(value => {
            if (value === clusterName) nodesLeftInCluster++;
        });

        if (nodesLeftInCluster === 0) {
            this.availableClusters.delete(clusterName);
            if (this.activeCluster === clusterName) {
                this.activeCluster = null;
            }
            clusterWasDeleted = true;
        }
    });

    this.updateClusterSelect();
    this.updateTree();
    this.saveData();
    this.showNotification(`Удалено ${removedNodesInfo.length} узл(а/ов) из отдела.`);
    this.clearMultiSelection();
}
editClusterName(oldName) {
    const newName = prompt('Введите новое название кластера:', oldName);
    if (!newName || newName.trim() === oldName || !newName.trim()) {
        return; 
    }
    if (this.availableClusters.has(newName)) {
        alert('Кластер с таким названием уже существует!');
        return;
    }
    this.clusters.forEach((value, key) => {
        if (value === oldName) {
            this.clusters.set(key, newName);
        }
    });
    this.availableClusters.delete(oldName);
    this.availableClusters.add(newName);
    if (this.activeCluster === oldName) {
        this.activeCluster = newName;
    }
    
    this.updateClusterSelect();
    this.updateTree();
    this.saveData();
    
    this.showNotification(`Кластер переименован с "${oldName}" на "${newName}"`);
}
allowImage(nodeId) {
  const node = this.findNode(this.treeData, nodeId);
  if (node) {
    node.content.isTextOnly = false;
    this.updateTree();
    this.saveData();
  }
}
addMetricBlock(node) {
this.saveToHistory(false, true);
    if (!node.content.metricBlocks) {
        node.content.metricBlocks = [];
    }
    
    const newBlock = {
        id: 'metric_' + Date.now(),
        title: 'Новая метрика',
        quarters: [
            { plan: 100, fact: 0 },
            { plan: 100, fact: 0 },
            { plan: 100, fact: 0 },
            { plan: 100, fact: 0 }
        ]
    };
    
    node.content.metricBlocks.push(newBlock);
    this.updateTree();
    this.saveData();
}
removeMetricBlock(node, blockIndex) {
    if (!node.content.metricBlocks || !node.content.metricBlocks[blockIndex]) return;
    node.content.metricBlocks.splice(blockIndex, 1);
    
    this.updateTree();
    this.saveData();
    this.showNotification('Метрика удалена');
}
createFireworks(x, y) {
  const fireworksContainer = document.createElement('div');
  fireworksContainer.className = 'firework';
  document.body.appendChild(fireworksContainer);
  

  const colors = this.darkMode ? 
    ['#7BA7CC', '#5D8AA8', '#FF8C66', '#E0E8F0', '#45B7D1'] : 
    ['#5D8AA8', '#87CEEB', '#FFA07A', '#2F4F4F', '#FF6B6B'];
  
  for (let i = 0; i < 50; i++) {
    const particle = document.createElement('div');
    particle.className = 'firework-particle';

    const angle = Math.random() * Math.PI * 2;
    const distance = 50 + Math.random() * 150;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;
  
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    particle.style.left = x + 'px';
    particle.style.top = y + 'px';
    particle.style.setProperty('--tx', tx + 'px');
    particle.style.setProperty('--ty', ty + 'px');
    particle.style.color = color;
    particle.style.animationDuration = (0.5 + Math.random() * 0.5) + 's';
    
    fireworksContainer.appendChild(particle);
  }
  
  setTimeout(() => {
    fireworksContainer.remove();
  }, 1500);
}
isValidEmail(text) {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(text) && 
           !/\s/.test(text) && 
           !/^https?:\/\//i.test(text); 
}
isValidUrl(string) {
    try {
        if (/\s/.test(string)) return false;
        if (/^https?:\/\//i.test(string)) {
            new URL(string);
            return true;
        }
        if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(string)) {
            new URL(`https://${string}`);
            return true;
        }
        
        return false;
    } catch (_) {
        return false;
    }
}
    extractDomain(url) {
        try {
            const domain = new URL(url).hostname.replace('www.', '');
            return domain.length > 20 ? domain.substring(0, 17) + '...' : domain;
        } catch (_) {
            return url.length > 20 ? url.substring(0, 17) + '...' : url;
        }
    }

saveToHistory(isInitialState = false, forceSave = false) {
    const allowedOperations = [
        'addChild',
        'deleteNode',
        'copySelectedNode',
        'pasteNode',
        'moveNode',
        'toggle269Mark',
        'toggleForAll',
        'toggleSubordinateMark',
        'toggleOKRMark',
        'toggleIndicatorMark',
        'toggleAuthorityMark',
        'togglePower269Mark',
        'showAdvancedRestructureDialog',
        'removeFromCluster', 
        'addNodeToCluster'   
    ];
    const stackTrace = new Error().stack;
    const shouldSave = forceSave || isInitialState || allowedOperations.some(op => stackTrace.includes(op));

    if (!shouldSave) return;

    if (isInitialState) {
        this.history = [this.getCurrentState()];
        this.historyIndex = 0;
        return;
    }

    const currentState = this.getCurrentState();
    const lastState = this.history[this.historyIndex];

    if (this.historyIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push(currentState);
    this.historyIndex++;

    if (this.history.length > 50) {
        this.history.shift();
        this.historyIndex--;
    }
}
getCurrentState() {
    return {
        tree: JSON.parse(JSON.stringify(this.treeData)),
        nodeCounter: this.nodeCounter,
        filesData: JSON.parse(JSON.stringify(this.filesData)),
        imagesData: JSON.parse(JSON.stringify(this.imagesData)),
        clusters: Array.from(this.clusters.entries()),
        availableClusters: Array.from(this.availableClusters),
        activeCluster: this.activeCluster,
        version: '2.7'  
    };
}

undo() {
    if (this.historyIndex <= 0) {
        this.showNotification('Нет действий для отмены');
        return;
    }

    
    const lastActionEntry = this.actionLog.find(entry => !entry.action.startsWith('Отменено:'));
    const lastActionText = lastActionEntry ? lastActionEntry.action : 'Действие';

   
    this.logAction(`Отменено: ${lastActionText}`);

    this.historyIndex--;
    this.restoreFromHistory();

    this.showNotification(`Действие отменено (шаг ${this.historyIndex + 1}/${this.history.length})`);
    this.saveData();
}
redo() {
    if (this.historyIndex >= this.history.length - 1) {
        this.showNotification('Нет действий для повтора');
        return;
    }
    
    const currentState = this.history[this.historyIndex];
    const nextState = this.history[this.historyIndex + 1];
    
    const significantChange = 
        JSON.stringify(currentState.tree) !== JSON.stringify(nextState.tree) ||
        currentState.nodeCounter !== nextState.nodeCounter;
    
    this.historyIndex++;
    this.restoreFromHistory();
    
    if (significantChange) {
        this.showNotification(`Действие повторено (шаг ${this.historyIndex + 1}/${this.history.length})`);
    }
    
    this.saveData(); 
}
restoreFromHistory() {
    if (this.history.length === 0 || 
        this.historyIndex < 0 || 
        this.historyIndex >= this.history.length) {
        console.error('Invalid history state');
        return;
    }
    
    const state = this.history[this.historyIndex];
    
 
    this.treeData = this.restoreTree(state.tree);
    this.nodeCounter = state.nodeCounter;
    this.filesData = state.filesData || {};
    this.imagesData = state.imagesData || {};
    this.clusters = new Map(state.clusters || []);
    this.availableClusters = new Set(state.availableClusters || []);
    this.activeCluster = state.activeCluster || null;
    
 
    this.updateClusterSelect();
    this.updateTree();
}
    loadThemePreference() {
        const savedTheme = localStorage.getItem('treeAppTheme');
        this.darkMode = savedTheme === 'dark';
        document.documentElement.classList.toggle('dark', this.darkMode);
    }
    logAction(actionText) {
        const newLogEntry = { action: actionText, timestamp: new Date().toISOString() };
        this.actionLog.unshift(newLogEntry);
        if (this.actionLog.length > this.maxLogEntries) { this.actionLog.pop(); }
        try {
  
            localStorage.setItem('treeActionLog', JSON.stringify(this.actionLog));
        }
        catch (e) { console.error("Не удалось сохранить историю действий:", e); }
    }

    loadActionLog() {
        try {
            const savedLog = localStorage.getItem('treeActionLog');
            if (savedLog) { this.actionLog = JSON.parse(savedLog); }
        } catch (e) {
            console.error("Не удалось загрузить историю действий:", e);
            this.actionLog = [];
        }
    }

    injectHistoryLogStyles() {
        if (document.getElementById('history-log-styles')) { return; }
        const style = document.createElement('style');
        style.id = 'history-log-styles';

        style.textContent = `
            .history-log-icon { position: fixed; bottom: 80px; right: 20px; width: 40px; height: 40px; background: var(--controls-bg); border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.2); cursor: pointer; z-index: 1001; display: flex; align-items: center; justify-content: center; font-size: 24px; transition: all 0.3s ease; }
            .history-log-icon:hover { transform: scale(1.1) rotate(15deg); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
            .history-dialog-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.6); display: none; justify-content: center; align-items: center; z-index: 10002; backdrop-filter: blur(5px); }
            .history-dialog { background: var(--controls-bg); padding: 25px; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.25); width: 90%; max-width: 500px; border: 1px solid var(--primary-color); animation: dialog-appear 0.3s ease-out; }
            @keyframes dialog-appear { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
            .history-dialog h3 { margin-top: 0; color: var(--primary-color); text-align: center; }
            .history-list { list-style: none; padding: 0; margin: 20px 0; max-height: 60vh; overflow-y: auto; }
            .history-item { background: rgba(93, 138, 168, 0.05); padding: 12px; border-bottom: 1px solid rgba(93, 138, 168, 0.1); display: flex; justify-content: space-between; align-items: center; font-size: 0.95em; }
            .history-item:last-child { border-bottom: none; }
            .history-item .action { font-weight: 500; }
            .history-item .timestamp { font-size: 0.8em; color: var(--accent-color); white-space: nowrap; margin-left: 15px; }
            .history-dialog-close { display: block; margin: 15px auto 0; padding: 8px 20px; background: var(--primary-color); color: white; border: none; border-radius: 6px; cursor: pointer; }
        `;
        document.head.appendChild(style);
    }

    setupHistoryLogUI() {
        this.injectHistoryLogStyles();
        const icon = document.getElementById('historyLogIcon');
        const backdrop = document.getElementById('historyDialogBackdrop');
        const closeBtn = document.getElementById('historyDialogClose');
        if (icon && backdrop && closeBtn) {
            icon.addEventListener('click', () => this.showHistoryDialog());
            closeBtn.addEventListener('click', () => backdrop.style.display = 'none');
            backdrop.addEventListener('click', (e) => { if (e.target === backdrop) { backdrop.style.display = 'none'; } });
        }
    }

    showHistoryDialog() {
        const list = document.getElementById('historyList');
        const backdrop = document.getElementById('historyDialogBackdrop');
        if (!list || !backdrop) return;
        list.innerHTML = '';
        if (this.actionLog.length === 0) {
            list.innerHTML = '<li class="history-item">История изменений пуста.</li>';
        } else {
            this.actionLog.forEach(entry => {
                const item = document.createElement('li');
                item.className = 'history-item';
                const actionSpan = document.createElement('span');
                actionSpan.className = 'action';
                actionSpan.textContent = entry.action;
                const timeSpan = document.createElement('span');
                timeSpan.className = 'timestamp';
                timeSpan.textContent = new Date(entry.timestamp).toLocaleString('ru-RU');
                item.appendChild(actionSpan);
                item.appendChild(timeSpan);
                list.appendChild(item);
            });
        }
        backdrop.style.display = 'flex';
    }
    

} 
const NODE_TYPE_COLORS = {
  'должностные регламенты': '#191970',          
  'государственная программа': '#00BFFF',      
  'окр': '#FFA500',                            
  'отсутствует в 269-п': '#FF4444',             
  'полномочие из 269-п': '#9E9E9E',             
  'для всех сотрудников': '#4CAF50',            
  'идентичное полномочие': '#D2B48C'           
};
const NODE_TYPE_ABBREVIATIONS = {
  'должностные регламенты': 'д.р.',
  'государственная программа': 'г.п.',
  'окр': 'окр',
  'отсутствует в 269-п': 'отс. 269-п',
  'полномочие из 269-п': 'полн. 269-п',
  'для всех сотрудников': 'для всех',
  'идентичное полномочие': 'ид. полн.'
};
