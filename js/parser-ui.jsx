// js/parser-ui.jsx

const { useState, useEffect } = React;

function ParserApp() {
    const [file, setFile] = useState(null);
    const [isParsing, setIsParsing] = useState(false);
    const [parseResult, setParseResult] = useState(null);
    const [boundTables, setBoundTables] = useState(null);
    const [error, setError] = useState(null);
    const [parser] = useState(new window.DocumentParser());
    const [employeeCount, setEmployeeCount] = useState(0);
    const [viewMode, setViewMode] = useState('tables'); // 'tables' или 'bind'
    const [employeesFromTree, setEmployeesFromTree] = useState([]);

    // Загружаем сотрудников из дерева при монтировании
    useEffect(() => {
        if (window.treeApp && window.treeApp.treeData) {
            // Считаем количество сотрудников
            const count = countEmployees(window.treeApp.treeData);
            setEmployeeCount(count);
            
            // Загружаем всех сотрудников для привязки
            const employees = [];
            const findEmployees = (node) => {
                if (node.content && typeof node.content.text === 'string') {
                    const isFullName = /^[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+$/.test(node.content.text);
                    if (isFullName) {
                        employees.push({
                            id: node.id,
                            name: node.content.text,
                            node: node
                        });
                    }
                }
                if (node.children) {
                    node.children.forEach(child => findEmployees(child));
                }
            };
            findEmployees(window.treeApp.treeData);
            setEmployeesFromTree(employees);
        }
    }, []);

    const countEmployees = (node) => {
        let count = 0;
        const traverse = (n) => {
            if (n.children && n.children.length > 0 && 
                n.content && n.content.text && 
                n.content.text.match(/^[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+$/)) {
                count++;
            }
            n.children.forEach(traverse);
        };
        traverse(node);
        return count;
    };

    const handleFileChange = (event) => {
        const selectedFile = event.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setError(null);
            setParseResult(null);
            setBoundTables(null);
            setViewMode('tables');
        }
    };

    const handleParse = async () => {
        if (!file) {
            setError('Пожалуйста, выберите файл.');
            return;
        }

        setIsParsing(true);
        setError(null);

        try {
            // Этап 1: только парсинг таблиц
            const result = await parser.parseDocument(file);
            setParseResult(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsParsing(false);
        }
    };

    const handleBindTables = async () => {
        if (!parseResult || !parseResult.tables) return;
        
        setIsParsing(true);
        try {
            // Этап 2: привязка таблиц к сотрудникам
            const bound = await parser.bindTablesToEmployees(parseResult.tables);
            setBoundTables(bound);
            setViewMode('bind');
        } catch (err) {
            setError(err.message);
        } finally {
            setIsParsing(false);
        }
    };

    const handleBackToTables = () => {
        setViewMode('tables');
    };

    const handleSelectEmployee = (tableIndex, rowIndex, employeeId) => {
        const updatedBoundTables = [...boundTables];
        updatedBoundTables[tableIndex].assignments[rowIndex].selectedEmployeeId = employeeId;
        setBoundTables(updatedBoundTables);
    };

    const handleAddToTree = (tableIndex, rowIndex) => {
        const assignment = boundTables[tableIndex].assignments[rowIndex];
        const employeeId = assignment.selectedEmployeeId;
        
        if (!employeeId) return;
        
        const employee = employeesFromTree.find(e => e.id === employeeId);
        if (!employee) return;
        
        // Создаем текст полномочия из строки таблицы
        const authorityText = assignment.rowData.join(' | ');
        const sourceDoc = parseResult.documentMeta.docNumber || 'не указан';
        
        if (parser.addAuthorityToEmployee(employee.node, authorityText, sourceDoc)) {
            if (window.treeApp) {
                window.treeApp.updateTree();
                window.treeApp.saveData();
            }
            
            // Отмечаем как добавленное
            const updatedBoundTables = [...boundTables];
            updatedBoundTables[tableIndex].assignments[rowIndex].isAdded = true;
            setBoundTables(updatedBoundTables);
        }
    };

    const handleAddAllFromTable = (tableIndex) => {
        const table = boundTables[tableIndex];
        let addedCount = 0;
        
        table.assignments.forEach(assignment => {
            if (!assignment.isAdded && assignment.selectedEmployeeId) {
                const employee = employeesFromTree.find(e => e.id === assignment.selectedEmployeeId);
                if (employee) {
                    const authorityText = assignment.rowData.join(' | ');
                    const sourceDoc = parseResult.documentMeta.docNumber || 'не указан';
                    
                    if (parser.addAuthorityToEmployee(employee.node, authorityText, sourceDoc)) {
                        assignment.isAdded = true;
                        addedCount++;
                    }
                }
            }
        });
        
        if (addedCount > 0 && window.treeApp) {
            window.treeApp.updateTree();
            window.treeApp.saveData();
            setBoundTables([...boundTables]);
        }
    };

    const getConfidenceColor = (confidence) => {
        if (confidence > 0.8) return 'bg-green-100 text-green-700 border-green-200';
        if (confidence > 0.5) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
        return 'bg-red-100 text-red-700 border-red-200';
    };

    const renderTable = (table, index) => {
        return (
            <div key={index} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                    <div>
                        <h3 className="text-sm font-bold text-slate-700">Таблица {index + 1}</h3>
                        <div className="flex gap-2 mt-1">
                            {table.structure?.hasNumber && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">📊 №</span>}
                            {table.structure?.hasSystem && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">💻 Системы</span>}
                            {table.structure?.hasDepartment && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">🏢 Отделы</span>}
                            {table.structure?.hasEmployee && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">👥 Сотрудники</span>}
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        {table.headers && table.headers.length > 0 && (
                            <thead className="bg-gray-50">
                                <tr>
                                    {table.headers.map((header, i) => (
                                        <th key={i} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                        )}
                        <tbody className="bg-white divide-y divide-gray-200">
                            {table.rows.map((row, rowIndex) => (
                                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    {row.map((cell, cellIndex) => (
                                        <td key={cellIndex} className="px-6 py-4 whitespace-pre-wrap text-sm text-gray-900">
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderBoundTable = (table, tableIndex) => {
        return (
            <div key={tableIndex} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-700">Таблица {tableIndex + 1} - привязка к сотрудникам</h3>
                    <button
                        onClick={() => handleAddAllFromTable(tableIndex)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition"
                    >
                        Добавить все из таблицы
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                {table.headers.map((header, i) => (
                                    <th key={i} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {header}
                                    </th>
                                ))}
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Привязка к сотруднику
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Действия
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {table.assignments.map((assignment, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    {assignment.rowData.map((cell, cellIdx) => (
                                        <td key={cellIdx} className="px-6 py-4 whitespace-pre-wrap text-sm text-gray-900">
                                            {cell}
                                        </td>
                                    ))}
                                    <td className="px-6 py-4">
                                        {assignment.matchedEmployees.length > 0 ? (
                                            <div className="space-y-2">
                                                <select
                                                    value={assignment.selectedEmployeeId || ''}
                                                    onChange={(e) => handleSelectEmployee(tableIndex, idx, parseInt(e.target.value))}
                                                    className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5"
                                                >
                                                    <option value="">Выберите сотрудника</option>
                                                    {assignment.matchedEmployees.map(emp => (
                                                        <option key={emp.id} value={emp.id}>
                                                            {emp.name} ({Math.round(emp.confidence * 100)}%)
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="flex gap-1 flex-wrap">
                                                    {assignment.matchedEmployees.map(emp => (
                                                        <span 
                                                            key={emp.id}
                                                            className={`text-xs px-2 py-0.5 rounded-full border ${getConfidenceColor(emp.confidence)}`}
                                                        >
                                                            {emp.name} {Math.round(emp.confidence * 100)}%
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <select
                                                className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5"
                                                onChange={(e) => handleSelectEmployee(tableIndex, idx, parseInt(e.target.value))}
                                            >
                                                <option value="">Выберите сотрудника</option>
                                                {employeesFromTree.map(emp => (
                                                    <option key={emp.id} value={emp.id}>
                                                        {emp.name}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {assignment.isAdded ? (
                                            <span className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-medium rounded-lg">
                                                ✓ Добавлено
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => handleAddToTree(tableIndex, idx)}
                                                disabled={!assignment.selectedEmployeeId}
                                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                                                    assignment.selectedEmployeeId
                                                        ? 'bg-brand-600 hover:bg-brand-700 text-white'
                                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                }`}
                                            >
                                                Добавить в ДИО
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto p-2 md:p-6">
            {/* Шапка */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Парсер приказов ДИО</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Загрузите приказ для извлечения табличных структур и привязки к сотрудникам
                    </p>
                </div>
                <div className="bg-slate-100 px-4 py-2 rounded-lg">
                    <span className="text-sm font-medium text-slate-600">Сотрудников в базе: </span>
                    <span className="text-xl font-bold text-brand-600">{employeeCount}</span>
                </div>
            </div>

            {/* Область загрузки */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex-1 w-full">
                        <input 
                            type="file" 
                            accept=".docx,.pdf" 
                            onChange={handleFileChange}
                            className="block w-full text-sm text-slate-500
                                file:mr-4 file:py-2.5 file:px-4
                                file:rounded-lg file:border-0
                                file:text-sm file:font-semibold
                                file:bg-brand-50 file:text-brand-700
                                hover:file:bg-brand-100
                                cursor-pointer"
                        />
                    </div>
                    <button 
                        onClick={handleParse}
                        disabled={!file || isParsing}
                        className={`px-6 py-2.5 rounded-lg text-sm font-medium transition shadow flex items-center gap-2 whitespace-nowrap ${
                            !file || isParsing 
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                            : 'bg-brand-600 hover:bg-brand-700 text-white'
                        }`}
                    >
                        {isParsing ? (
                            <>
                                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                                {viewMode === 'tables' ? 'Парсинг таблиц...' : 'Привязка...'}
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Запустить парсинг
                            </>
                        )}
                    </button>
                </div>
                {error && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-600 text-sm flex items-center gap-2">
                            <span>❌</span> {error}
                        </p>
                    </div>
                )}
                {file && !isParsing && !parseResult && (
                    <p className="text-xs text-slate-400 mt-2">
                        Выбран файл: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </p>
                )}
            </div>

            {/* Результаты парсинга */}
            {parseResult && (
                <div className="space-y-6">
                    {/* Метаданные документа */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <h2 className="text-sm font-bold text-slate-500 uppercase mb-3">Документ</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-slate-400">📄</span>
                                <span className="font-medium">Номер:</span>
                                <span className="text-sm">{parseResult.documentMeta.docNumber}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-400">📅</span>
                                <span className="font-medium">Дата:</span>
                                <span className="text-sm">{parseResult.documentMeta.docDate || 'не указана'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Найденные сотрудники в документе */}
                    {parseResult.employees.size > 0 && (
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <h2 className="text-sm font-bold text-slate-500 uppercase mb-3">
                                Найденные сотрудники в документе ({parseResult.employees.size})
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                {Array.from(parseResult.employees).map(name => (
                                    <span key={name} className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium border border-emerald-200">
                                        👤 {name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Кнопка перехода к привязке (если есть таблицы и мы в режиме таблиц) */}
                    {viewMode === 'tables' && parseResult.tables.length > 0 && (
                        <div className="flex justify-end">
                            <button
                                onClick={handleBindTables}
                                className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition flex items-center gap-2"
                            >
                                <span>🔗</span>
                                Перейти к привязке сотрудников ({parseResult.tables.length} таблиц)
                            </button>
                        </div>
                    )}

                    {/* Кнопка возврата (если мы в режиме привязки) */}
                    {viewMode === 'bind' && (
                        <div className="flex justify-start">
                            <button
                                onClick={handleBackToTables}
                                className="px-6 py-2.5 bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition flex items-center gap-2"
                            >
                                <span>←</span>
                                Назад к таблицам
                            </button>
                        </div>
                    )}

                    {/* Отображение таблиц или привязки */}
                    {viewMode === 'tables' ? (
                        parseResult.tables.length > 0 ? (
                            <div>
                                <h2 className="text-lg font-bold text-slate-800 mb-3">
                                    Найденные таблицы ({parseResult.tables.length})
                                </h2>
                                <div className="space-y-4">
                                    {parseResult.tables.map((table, index) => renderTable(table, index))}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center">
                                <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 7h16M4 12h16M4 17h16" />
                                </svg>
                                <p className="text-lg font-medium text-slate-600 mb-2">Таблицы не найдены</p>
                                <p className="text-sm text-slate-400">
                                    В документе не обнаружено табличных структур
                                </p>
                            </div>
                        )
                    ) : (
                        boundTables && (
                            <div>
                                <h2 className="text-lg font-bold text-slate-800 mb-3">
                                    Привязка к сотрудникам
                                </h2>
                                <div className="space-y-8">
                                    {boundTables.map((table, index) => renderBoundTable(table, index))}
                                </div>
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    );
}

// Функция инициализации
function initParserTab(containerId) {
    console.log('🚀 Инициализация парсера в контейнере:', containerId);
    const container = document.getElementById(containerId);
    if (container) {
        const root = ReactDOM.createRoot(container);
        root.render(<ParserApp />);
    }
}

window.initParserTab = initParserTab;
