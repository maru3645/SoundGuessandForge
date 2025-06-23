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
    hint1Button = document.getElementById('hint-1-button');
    hint2Button = document.getElementById('hint-2-button');
    hintDisplay = document.getElementById('hint-display');

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
        
        // Visualizer初期化
        if (typeof initVisualizer === 'function') {
            initVisualizer();
        }
    });

    modulePalette.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const type = e.target.dataset.type;
            if (!isAudioStarted && type !== 'output') {
                alert('まず「オーディオ開始」ボタンを押してください。');
                return;
            }
            createModule(type); // ←座標指定なしで中央配置
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
        if (typeof startVisualizer === 'function') startVisualizer();
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
        if (typeof stopVisualizer === 'function') stopVisualizer();
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
            if (hintDisplay) hintDisplay.innerHTML = '';
            
            // Outputモジュールを再生成
            const outputModule = createModule('output');
            globalOutputNode = outputModule;
            
            // ビジュアライザを再接続
            if (typeof initVisualizer === 'function') {
                initVisualizer();
            }
            
            // 新しい正解を生成
            generateRandomCorrectAnswer();
            console.log('リセット後に新しい正解を生成しました。');
        }
    });

    if (!globalOutputNode) {
        const outputModule = createModule('output');
        globalOutputNode = outputModule;
    }
    
    // 新ボタンのDOM取得とイベントリスナー追加
    const playAnswerButton = document.getElementById('play-answer-button');
    const checkAnswerButton = document.getElementById('check-answer-button');
    playAnswerButton.addEventListener('click', playCorrectAnswer);
    checkAnswerButton.addEventListener('click', checkAnswer);
    
    // ヒントボタンのイベントリスナー
    if (hint1Button) hint1Button.addEventListener('click', showHint1);
    if (hint2Button) hint2Button.addEventListener('click', showHint2);
    
    console.log('ページ読み込み完了、正解生成を開始します...');
    generateRandomCorrectAnswer();
    console.log('ページ読み込み時の正解生成が完了しました。correctAnswer:', correctAnswer);
    
    clearParamEditor();
});
