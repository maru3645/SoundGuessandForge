// main.js
// グローバル変数定義・初期化・イベントバインド

// HTMLで定義されたグローバル変数を使用
// let correctAnswer はHTMLのインラインスクリプトで定義済み

// DOM要素は window.addEventListener('load') 内で取得する
// let workspace, connectionsSvg, modulePalette, paramEditorContent;
// let startAudioButton, playButton, stopButton, resetButton;

window.addEventListener('load', () => {
    // DOM要素を取得
    workspace = document.getElementById('workspace');
    connectionsSvg = document.getElementById('connections-svg');
    modulePalette = document.getElementById('module-palette');
    paramEditorContent = document.getElementById('editor-content');
    startAudioButton = document.getElementById('start-audio-button');
    playButton = document.getElementById('play-button');
    stopButton = document.getElementById('stop-button');
    resetButton = document.getElementById('reset-button');

    // イベントリスナーを設定
    startAudioButton.addEventListener('click', () => {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                if (globalOutputNode && !globalOutputNode.audioNode) {
                    globalOutputNode.initAudioNode();
                }
            });
        }
        isAudioStarted = true;
        startAudioButton.disabled = true;
        startAudioButton.textContent = 'オーディオ動作中';
        startAudioButton.classList.remove('control-button-green');
        startAudioButton.classList.add('control-button-gray');
        playButton.disabled = false;
        stopButton.disabled = false;
    });

    modulePalette.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const type = e.target.dataset.type;
            if (!isAudioStarted && type !== 'output') {
                alert('まず「オーディオ開始」ボタンを押してください。');
                return;
            }
            createModule(type, 50, 50);
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (draggingModule) {
            const workspaceRect = workspace.getBoundingClientRect();
            let newX = e.clientX - workspaceRect.left - dragOffsetX;
            let newY = e.clientY - workspaceRect.top - dragOffsetY;
            newX = Math.max(0, Math.min(newX, workspace.offsetWidth - draggingModule.domElement.offsetWidth));
            newY = Math.max(0, Math.min(newY, workspace.offsetHeight - draggingModule.domElement.offsetHeight));
            draggingModule.domElement.style.left = `${newX}px`;
            draggingModule.domElement.style.top = `${newY}px`;
            updateConnectionsSVG();
        }
        if (drawingLine && lineStartNodeInfo) {
            const workspaceRect = workspace.getBoundingClientRect();
            drawingLine.setAttribute('x2', e.clientX - workspaceRect.left);
            drawingLine.setAttribute('y2', e.clientY - workspaceRect.top);
        }
    });

    document.addEventListener('mouseup', () => {
        if (draggingModule) {
            draggingModule.domElement.style.cursor = 'grabbing';
            draggingModule.domElement.style.zIndex = 1;
            draggingModule = null;
        }
        stopDrawingLine();
    });

    playButton.addEventListener('click', () => {
        if (!isAudioStarted || !audioContext) return;
        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                startOscillatorsAndReconnect();
            });
        } else {
            startOscillatorsAndReconnect();
        }
    });

    function startOscillatorsAndReconnect() {
        modules.forEach(module => {
            if (module.type === 'oscillator' && module.audioNode && typeof module.audioNode.start === 'function') {
                if (!module.isPlaying) {
                    module.initAudioNode();
                    module.audioNode.start(0);
                    module.isPlaying = true;
                }
            }
        });
        reconnectAll();
    }

    stopButton.addEventListener('click', () => {
        if (!isAudioStarted || !audioContext) return;
        modules.forEach(module => {
            if (module.type === 'oscillator' && module.audioNode && typeof module.audioNode.stop === 'function') {
                try {
                    if (module.isPlaying) {
                        module.audioNode.stop(0);
                        module.isPlaying = false;
                    }
                } catch (e) {}
            }
        });
        modules.filter(m => m.type === 'oscillator').forEach(osc => {
            osc.initAudioNode();
        });
        reconnectAll();
    });

    resetButton.addEventListener('click', () => {
        if (confirm('すべてのモジュールと接続をリセットしますか？')) {
            [...modules].reverse().forEach(m => m.destroy());
            modules = [];
            connections = [];
            nextModuleId = 0;
            selectedModule = null;
            draggingModule = null;
            globalOutputNode = null;
            clearParamEditor();
            connectionsSvg.innerHTML = '';
            
            // Outputモジュールを再生成
            const outputModule = new OutputModule(600, 200);
            modules.push(outputModule);
            globalOutputNode = outputModule;
            
            // 新しい正解を生成
            generateRandomCorrectAnswer();
            console.log('リセット後に新しい正解を生成しました。');
        }
    });

    if (!globalOutputNode) {
        const outputModule = new OutputModule(600, 200);
        modules.push(outputModule);
        globalOutputNode = outputModule;
    }
    
    // ゲーム用ボタンを追加
    const globalControls = document.getElementById('global-controls');
    const playAnswerButton = document.createElement('button');
    playAnswerButton.textContent = '正解音を聞く';
    playAnswerButton.className = 'control-button control-button-green';
    playAnswerButton.addEventListener('click', playCorrectAnswer);
    globalControls.appendChild(playAnswerButton);
    
    const checkAnswerButton = document.createElement('button');
    checkAnswerButton.textContent = '答え合わせ';
    checkAnswerButton.className = 'control-button control-button-gray';
    checkAnswerButton.addEventListener('click', checkAnswer);
    globalControls.appendChild(checkAnswerButton);
    
    console.log('ページ読み込み完了、正解生成を開始します...');
    generateRandomCorrectAnswer();
    console.log('ページ読み込み時の正解生成が完了しました。correctAnswer:', correctAnswer);
    
    clearParamEditor();
});
