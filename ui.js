// ui.js
// UI描画・パラメータエディタ・ドラッグ＆ドロップ・SVG接続線など

function createModule(type, x, y, isCorrectAnswerModule = false) {
    // workspaceの中央に配置する（x, y未指定時）
    if (typeof x !== "number" || typeof y !== "number") {
        // 固定座標で配置（確実に表示されるように）
        x = 200;
        y = 100;
    }
    
    console.log(`Creating module ${type} at (${x}, ${y})`); // デバッグ用
    
    let newModule;
    switch (type) {
        case 'oscillator': newModule = new OscillatorModule(x, y, isCorrectAnswerModule); break;
        case 'gain': newModule = new GainModule(x, y, isCorrectAnswerModule); break;
        case 'filter': newModule = new FilterModule(x, y, isCorrectAnswerModule); break;
        case 'delay': newModule = new DelayModule(x, y, isCorrectAnswerModule); break;
        case 'output': newModule = new OutputModule(x, y, isCorrectAnswerModule); break;
        default: return;
    }
    
    console.log('Module DOM element:', newModule.domElement); // デバッグ用
    
    // workspaceにDOMを追加（重複防止のため一度だけ）
    if (workspace && !workspace.contains(newModule.domElement)) {
        workspace.appendChild(newModule.domElement);
        console.log('Module added to workspace'); // デバッグ用
    } else {
        console.log('Failed to add module to workspace'); // デバッグ用
    }
    
    // modules配列に追加（重複防止）
    if (!modules.includes(newModule)) {
        modules.push(newModule);
        console.log('Module added to modules array, total:', modules.length); // デバッグ用
    }
    
    if (!isCorrectAnswerModule) {
        selectModule(newModule);
    }
    return newModule;
}

function selectModule(module) {
    if (selectedModule && selectedModule.domElement) {
        selectedModule.domElement.style.borderColor = '#ccc';
    }
    selectedModule = module;
    if (selectedModule && selectedModule.domElement) {
        if (selectedModule.isCorrectAnswerModule) {
            clearParamEditor();
            return;
        }
        selectedModule.domElement.style.borderColor = '#3498db';
        renderParamEditor(module);
    } else {
        clearParamEditor();
    }
}

function clearParamEditor() {
    paramEditorContent.innerHTML = '<p class="text-sm text-gray-500">モジュールを選択してください</p>';
}

function renderParamEditor(module) {
    paramEditorContent.innerHTML = '';
    const title = document.createElement('h3');
    title.textContent = module.name;
    title.className = 'text-md font-semibold mb-2 text-slate-600';
    paramEditorContent.appendChild(title);
    const editorHTML = module.getEditorHTML();
    paramEditorContent.innerHTML += editorHTML;

    if (module.isCorrectAnswerModule) {
        const info = document.createElement('p');
        info.textContent = 'これは正解のモジュールです。パラメータは編集できません。';
        info.className = 'text-xs text-gray-500 mt-2';
        paramEditorContent.appendChild(info);
        return;
    }

    // イベントバインド（各モジュールごとに）
    if (module.type === 'oscillator') {        document.getElementById(`osc-type-${module.id}`).addEventListener('change', (e) => {
            module.params.type = e.target.value;
            module.initAudioNode();
            reconnectAll();
        });
        document.getElementById(`osc-freq-${module.id}`).addEventListener('input', (e) => {
            module.params.frequency = parseFloat(e.target.value);
            document.getElementById(`freq-val-${module.id}`).textContent = module.params.frequency;
            if (module.audioNode && audioContext) module.audioNode.frequency.setValueAtTime(module.params.frequency, audioContext.currentTime);
        });
        document.getElementById(`osc-detune-${module.id}`).addEventListener('input', (e) => {
            module.params.detune = parseFloat(e.target.value);
            document.getElementById(`detune-val-${module.id}`).textContent = module.params.detune;
            if (module.audioNode && audioContext) module.audioNode.detune.setValueAtTime(module.params.detune, audioContext.currentTime);
        });
    } else if (module.type === 'gain') {
        document.getElementById(`gain-amount-${module.id}`).addEventListener('input', (e) => {
            module.params.gain = parseFloat(e.target.value);
            document.getElementById(`gain-val-${module.id}`).textContent = module.params.gain.toFixed(2);
            module.updateParams();
        });
    } else if (module.type === 'filter') {
        document.getElementById(`filter-type-${module.id}`).addEventListener('change', (e) => {
            module.params.type = e.target.value;
            module.updateParams();
        });
        document.getElementById(`filter-freq-${module.id}`).addEventListener('input', (e) => {
            module.params.frequency = parseFloat(e.target.value);
            document.getElementById(`filter-freq-val-${module.id}`).textContent = module.params.frequency;
            module.updateParams();
        });
        document.getElementById(`filter-q-${module.id}`).addEventListener('input', (e) => {
            module.params.q = parseFloat(e.target.value);
            document.getElementById(`filter-q-val-${module.id}`).textContent = module.params.q.toFixed(2);
            module.updateParams();
        });
    } else if (module.type === 'delay') {
        document.getElementById(`delay-time-${module.id}`).addEventListener('input', (e) => {
            module.params.delayTime = parseFloat(e.target.value);
            document.getElementById(`delay-time-val-${module.id}`).textContent = module.params.delayTime.toFixed(2);
            module.updateParams();
        });
        document.getElementById(`delay-feedback-${module.id}`).addEventListener('input', (e) => {
            module.params.feedback = parseFloat(e.target.value);
            document.getElementById(`delay-feedback-val-${module.id}`).textContent = module.params.feedback.toFixed(2);
            module.updateParams();
        });
    }
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'モジュール削除';
    deleteButton.className = 'control-button control-button-red mt-4 w-full text-sm';
    deleteButton.onclick = () => {
        if (confirm(`${module.name} を削除しますか？`)) {
            module.destroy();
        }
    };
    paramEditorContent.appendChild(deleteButton);
}

// ドラッグ＆ドロップ、SVG接続線、接続管理などのUI系関数
function getModuleById(id) {
    return modules.find(m => m.id === parseInt(id));
}

function startDrawingLine(e, sourceModuleId, sourceNodeElement) {
    e.stopPropagation();
    const sourceModule = getModuleById(sourceModuleId);
    if (!sourceModule) return;

    const workspaceRect = workspace.getBoundingClientRect();
    const startX = sourceNodeElement.getBoundingClientRect().left - workspaceRect.left + sourceNodeElement.offsetWidth / 2;
    const startY = sourceNodeElement.getBoundingClientRect().top - workspaceRect.top + sourceNodeElement.offsetHeight / 2;

    drawingLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    drawingLine.setAttribute('x1', startX);
    drawingLine.setAttribute('y1', startY);
    drawingLine.setAttribute('x2', e.clientX - workspaceRect.left);
    drawingLine.setAttribute('y2', e.clientY - workspaceRect.top);
    drawingLine.setAttribute('class', 'connection-line');
    connectionsSvg.appendChild(drawingLine);

    lineStartNodeInfo = {
        sourceModuleId: sourceModuleId,
        sourceNodeElement: sourceNodeElement
    };
}

function stopDrawingLine() {
    if (drawingLine && drawingLine.parentNode) {
        drawingLine.parentNode.removeChild(drawingLine);
    }
    drawingLine = null;
    lineStartNodeInfo = null;
}

function connectModules(sourceModule, targetModule) {
    if (!sourceModule || !targetModule || sourceModule === targetModule) return;
    if (connections.some(c => c.sourceId === sourceModule.id && c.targetId === targetModule.id)) return;
    if (targetModule.type === 'oscillator') return; // Oscillator has no input

    const connection = {
        sourceId: sourceModule.id,
        targetId: targetModule.id,
    };
    connections.push(connection);
    sourceModule.connectTo(targetModule);
    updateConnectionsSVG();
}

function disconnectModules(sourceId, targetId) {
    const connIndex = connections.findIndex(c => c.sourceId === sourceId && c.targetId === targetId);
    if (connIndex > -1) {
        const sourceModule = getModuleById(sourceId);
        const targetModule = getModuleById(targetId);
        if (sourceModule && targetModule) {
            sourceModule.disconnectFrom(targetModule);
        }
        connections.splice(connIndex, 1);
        updateConnectionsSVG();
    }
}

function updateConnectionsSVG() {
    connectionsSvg.innerHTML = ''; // Clear all lines

    connections.forEach(conn => {
        const sourceModule = getModuleById(conn.sourceId);
        const targetModule = getModuleById(conn.targetId);
        if (!sourceModule || !targetModule) return;

        const sourceNodeEl = sourceModule.domElement.querySelector('.output-node');
        const targetNodeEl = targetModule.domElement.querySelector('.input-node');
        if (!sourceNodeEl || !targetNodeEl) return;

        const workspaceRect = workspace.getBoundingClientRect();
        const sourceRect = sourceNodeEl.getBoundingClientRect();
        const targetRect = targetNodeEl.getBoundingClientRect();

        const x1 = sourceRect.left - workspaceRect.left + sourceRect.width / 2;
        const y1 = sourceRect.top - workspaceRect.top + sourceRect.height / 2;
        const x2 = targetRect.left - workspaceRect.left + targetRect.width / 2;
        const y2 = targetRect.top - workspaceRect.top + targetRect.height / 2;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('class', 'connection-line');
        line.dataset.sourceId = conn.sourceId;
        line.dataset.targetId = conn.targetId;

        line.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('この接続を削除しますか？')) {
                disconnectModules(conn.sourceId, conn.targetId);
            }
        });
        // ダブルクリックで即削除
        line.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            disconnectModules(conn.sourceId, conn.targetId);
        });

        connectionsSvg.appendChild(line);
    });
}

function reconnectAll() {
    // Disconnect all audio nodes first to avoid issues
    modules.forEach(m => {
        if (m.audioNode && m.audioNode.disconnect) {
            try { m.audioNode.disconnect(); } catch(e) {}
        }
        // Special handling for DelayModule feedback loop
        if (m.type === 'delay' && m.feedbackGain) {
            try { m.audioNode.disconnect(m.feedbackGain); } catch(e) {}
        }
    });

    // Re-establish connections based on the `connections` array
    connections.forEach(conn => {
        const sourceModule = getModuleById(conn.sourceId);
        const targetModule = getModuleById(conn.targetId);
        if (sourceModule && targetModule) {
            sourceModule.connectTo(targetModule);
        }
    });
}
