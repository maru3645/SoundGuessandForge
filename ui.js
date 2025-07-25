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
        case 'reverb': newModule = new ReverbModule(x, y, isCorrectAnswerModule); break;
        case 'lfo': newModule = new LFOModule(x, y, isCorrectAnswerModule); break;
        case 'pattern': newModule = new PatternModule(x, y, isCorrectAnswerModule); break;
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
        selectedModule.domElement.classList.remove('selected');
    }
    selectedModule = module;
    if (selectedModule && selectedModule.domElement) {
        selectedModule.domElement.classList.add('selected');
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
            const wasPlaying = module.isPlaying; // 再生中だったか記憶
            module.params.type = e.target.value;
            module.initAudioNode(); // ノードを再生成
            if (wasPlaying) {
                module.audioNode.start(0); // 再生中だったなら、新しいノードを開始
            }
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
    } else if (module.type === 'reverb') {
        document.getElementById(`reverb-mix-${module.id}`).addEventListener('input', (e) => {
            module.params.mix = parseFloat(e.target.value);
            document.getElementById(`reverb-mix-val-${module.id}`).textContent = module.params.mix.toFixed(2);
            module.updateParams();
        });
        document.getElementById(`reverb-time-${module.id}`).addEventListener('input', (e) => {
            module.params.time = parseFloat(e.target.value);
            document.getElementById(`reverb-time-val-${module.id}`).textContent = module.params.time.toFixed(2);
            module.updateParams();
        });
    } else if (module.type === 'lfo') {
        document.getElementById(`lfo-type-${module.id}`).addEventListener('change', (e) => {
            module.params.type = e.target.value;
            module.updateParams();
        });
        document.getElementById(`lfo-freq-${module.id}`).addEventListener('input', (e) => {
            module.params.frequency = parseFloat(e.target.value);
            document.getElementById(`lfo-freq-val-${module.id}`).textContent = module.params.frequency;
            module.updateParams();
        });
        document.getElementById(`lfo-amount-${module.id}`).addEventListener('input', (e) => {
            module.params.amount = parseFloat(e.target.value);
            document.getElementById(`lfo-amount-val-${module.id}`).textContent = module.params.amount;
            module.updateParams();
        });
    } else if (module.type === 'pattern') {
        const onSlider = document.getElementById(`pattern-on-${module.id}`);
        const onVal = document.getElementById(`pattern-on-val-${module.id}`);
        const offSlider = document.getElementById(`pattern-off-${module.id}`);
        const offVal = document.getElementById(`pattern-off-val-${module.id}`);
        const repeatSlider = document.getElementById(`pattern-repeat-${module.id}`);
        const repeatVal = document.getElementById(`pattern-repeat-val-${module.id}`);

        if (onSlider && onVal) {
            onSlider.addEventListener('input', (e) => {
                module.params.onTime = parseFloat(e.target.value);
                onVal.textContent = module.params.onTime.toFixed(2);
            });
        }
        if (offSlider && offVal) {
            offSlider.addEventListener('input', (e) => {
                module.params.offTime = parseFloat(e.target.value);
                offVal.textContent = module.params.offTime.toFixed(2);
            });
        }
        if (repeatSlider && repeatVal) {
            repeatSlider.addEventListener('input', (e) => {
                module.params.repeat = parseInt(e.target.value, 10);
                repeatVal.textContent = module.params.repeat;
            });
        }
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

    // --- ここから説明文を追加 ---
    const desc = document.createElement('div');
    desc.className = 'mt-4 text-xs text-gray-500';

    switch (module.type) {
        case 'oscillator':
            desc.innerHTML = `
                <b>オシレーター</b>：<br>
                基本波形（サイン波・矩形波など）を発生させる音源です。<br>
                <b>Type</b>で波形、<b>Frequency</b>で音の高さ、<b>Detune</b>で微妙な音程のズレを調整できます。
            `;
            break;
        case 'gain':
            desc.innerHTML = `
                <b>ゲイン</b>：<br>
                音量を調整するモジュールです。<br>
                <b>Gain</b>で音の大きさを0（無音）～1（最大）で設定します。
            `;
            break;
        case 'filter':
            desc.innerHTML = `
                <b>フィルター</b>：<br>
                特定の周波数帯域を強調・カットするモジュールです。<br>
                <b>Type</b>でフィルターの種類、<b>Frequency</b>で中心周波数、<b>Q</b>で鋭さを調整します。
            `;
            break;
        case 'delay':
            desc.innerHTML = `
                <b>ディレイ</b>：<br>
                音を遅らせて反響（エコー）を作るモジュールです。<br>
                <b>Delay Time</b>で遅延時間、<b>Feedback</b>で繰り返しの強さを調整します。
            `;
            break;
        case 'reverb':
            desc.innerHTML = `
                <b>リバーブ</b>：<br>
                残響（ホールや部屋の響き）を加えるモジュールです。<br>
                <b>Mix</b>で原音と残響のバランス、<b>Time</b>で残響の長さを調整します。
            `;
            break;
        case 'lfo':
            desc.innerHTML = `
                <b>LFO（低周波発振器）</b>：<br>
                他のモジュールのパラメータを周期的に変調（揺らす）するためのモジュールです。<br>
                <b>Type</b>でLFO波形、<b>Frequency</b>で揺れの速さ、<b>Amount</b>で揺れの深さを設定します。<br>
                右側の黄色い四角から他のモジュールのパラメータ入力（黄色い四角）に接続してください。
                <hr class="my-2">
                <b>LFOを各モジュールに接続した場合の効果：</b><br>
                <ul class="list-disc ml-4">
                  <li><b>オシレーター frequency</b>：音の高さが周期的に揺れ、ビブラート効果が得られます。</li>
                  <li><b>オシレーター detune</b>：音程が細かく揺れ、より複雑なビブラートやコーラス感が出ます。</li>
                  <li><b>ゲイン gain</b>：音量が周期的に揺れ、トレモロ効果になります。</li>
                  <li><b>フィルター frequency</b>：フィルターのカットオフ周波数が揺れ、ワウやオートワウのような効果になります。</li>
                  <li><b>ディレイ delayTime</b>：ディレイの遅延時間が揺れ、ピッチが揺れるような特殊な効果が得られます。</li>
                  <li><b>リバーブ mix</b>：残響の量が周期的に変化し、空間感が揺れます。</li>
                </ul>
            `;
            break;
        case 'pattern':
            desc.innerHTML = `
                <b>パターン</b>：<br>
                設定した時間でON/OFFを繰り返し、他のモジュールのパラメータを変調させます。<br>
                <b>On Time</b>でONの時間、<b>Off Time</b>でOFFの時間、<b>Repeat</b>で繰り返す回数を設定します。<br>
                クラクションの「プップー」という音や、周期的なゲート効果を作り出せます。<br>
                右側の黄色い四角から他のモジュールのパラメータ入力（黄色い四角）に接続してください。
                <hr class="my-2">
                <b>パターンを各モジュールに接続した場合の効果：</b><br>
                <ul class="list-disc ml-4">
                  <li><b>ゲイン gain</b>：音量を断続的にON/OFFさせ、ゲート効果やリズムパターンを作り出します。</li>
                </ul>
            `;
            break;
        case 'output':
            desc.innerHTML = `
                <b>アウトプット</b>：<br>
                最終的な音声出力（スピーカー）です。<br>
                他のモジュールの出力をここに接続してください。
            `;
            break;
        default:
            desc.innerHTML = '';
    }
    paramEditorContent.appendChild(desc);
}

// ドラッグ＆ドロップ、SVG接続線、接続管理などのUI系関数
function getModuleById(id) {
    return modules.find(m => m.id === parseInt(id));
}

function startDrawingLine(e, sourceModuleId, sourceNodeElement, connectionType) {
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
    const lineClass = connectionType === 'param' ? 'connection-line-param' : 'connection-line';
    drawingLine.setAttribute('class', lineClass);
    connectionsSvg.appendChild(drawingLine);

    lineStartNodeInfo = {
        sourceModuleId: sourceModuleId,
        sourceNodeElement: sourceNodeElement,
        connectionType: connectionType
    };
}

function stopDrawingLine() {
    if (drawingLine && drawingLine.parentNode) {
        drawingLine.parentNode.removeChild(drawingLine);
    }
    drawingLine = null;
    lineStartNodeInfo = null;
}

function connectModules(sourceModule, targetModule, paramName = null, visualOnly = false) {
    if (!sourceModule || !targetModule || sourceModule === targetModule) return;
    // Prevent duplicate connections
    if (connections.some(c => c.sourceId === sourceModule.id && c.targetId === targetModule.id && c.param === paramName)) return;
    if (paramName === null && (targetModule.type === 'oscillator' || targetModule.type === 'lfo')) return; // Oscillator/LFO has no audio input

    const connection = {
        sourceId: sourceModule.id,
        targetId: targetModule.id,
        param: paramName,
    };
    connections.push(connection);
    if (!visualOnly) {
        sourceModule.connectTo(targetModule, paramName);
    }
    updateConnectionsSVG();
}

function disconnectModules(sourceId, targetId, paramName = null) {
    const connIndex = connections.findIndex(c => c.sourceId === sourceId && c.targetId === targetId && c.param === paramName);
    if (connIndex > -1) {
        const sourceModule = getModuleById(sourceId);
        const targetModule = getModuleById(targetId);
        if (sourceModule && targetModule) {
            sourceModule.disconnectFrom(targetModule, paramName);
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

        const sourceNodeEl = sourceModule.domElement.querySelector('[data-node-type="output"]');
        let targetNodeEl;

        if (conn.param) {
            // Parameter connection
            targetNodeEl = targetModule.domElement.querySelector(`.param-input-node[data-param-name="${conn.param}"]`);
        } else {
            // Audio connection
            targetNodeEl = targetModule.domElement.querySelector('.input-node');
        }
        
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
        
        const lineClass = conn.param ? 'connection-line-param' : 'connection-line';
        line.setAttribute('class', lineClass);
        
        line.dataset.sourceId = conn.sourceId;
        line.dataset.targetId = conn.targetId;
        if (conn.param) {
            line.dataset.param = conn.param;
        }

        line.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('この接続を削除しますか？')) {
                disconnectModules(conn.sourceId, conn.targetId, conn.param);
            }
        });
        // ダブルクリックで即削除
        line.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            disconnectModules(conn.sourceId, conn.targetId, conn.param);
        });

        connectionsSvg.appendChild(line);
    });
}

function reconnectAll() {
    // 現在の接続情報に基づいて、オーディオ接続のみを再設定する
    // 以前の実装は、analyserNodeからdestinationへの接続など、
    // `connections`配列で管理されていない接続まで切断してしまっていた。
    connections.forEach(conn => {
        const sourceModule = getModuleById(conn.sourceId);
        const targetModule = getModuleById(conn.targetId);
        
        // 正解表示用のモジュールは音声接続を行わない
        if (sourceModule && targetModule && !sourceModule.isCorrectAnswerModule && !targetModule.isCorrectAnswerModule) {
            try {
                sourceModule.disconnectFrom(targetModule, conn.param);
            } catch(e) {}
            try {
                sourceModule.connectTo(targetModule, conn.param);
            } catch(e) {}
        }
    });
}
