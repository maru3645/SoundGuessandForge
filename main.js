// main.js
// グローバル変数定義・初期化・イベントバインド

// HTMLで定義されたグローバル変数を使用
// let correctAnswer はHTMLのインラインスクリプトで定義済み

// DOM要素は window.addEventListener('load') 内で取得する
// let workspace, connectionsSvg, modulePalette, paramEditorContent;
// let startAudioButton, playButton, stopButton, resetButton;

function stopAllOscillators() {
    modules.forEach(module => {
        if (module.type === 'oscillator' && module.audioNode) {
            try {
                module.audioNode.stop();
                module.isPlaying = false;
            } catch (e) {
                // オシレーターが既に停止している場合のエラーを無視
            }
        }
    });
}

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
        stopAllOscillators();
        if (typeof stopVisualizer === 'function') {
            stopVisualizer();
        }
    });

    resetButton.addEventListener('click', () => {
        // ページをリロードして、ワークスペースを完全に初期状態に戻す
        location.reload();
    });

    if (!globalOutputNode) {
        globalOutputNode = createModule('output', 600, 200);
    }
    
    // 新ボタンのDOM取得とイベントリスナー追加
    const playAnswerButton = document.getElementById('play-answer-button');
    const checkAnswerButton = document.getElementById('check-answer-button');
    playAnswerButton.addEventListener('click', playCorrectAnswer);
    checkAnswerButton.addEventListener('click', checkAnswer);
    
    // ヒントボタンのイベントリスナー
    if (hint1Button) {
        hint1Button.addEventListener('click', showHint1);
    }
    if (hint2Button) {
        hint2Button.addEventListener('click', showHint2);
    }
    
    // generateRandomCorrectAnswerを呼び出し、正解をセットアップする。
    // チャレンジモードの場合は固定の正解、ランダムモードの場合はランダムな正解を生成
    console.log('ページ読み込み完了、正解生成を開始します...');
    console.log('呼び出し前の正解データ:', window.correctAnswer);
    console.log('チャレンジモードフラグ:', window.isChallengeMode);
    console.log('現在のURL:', window.location.href);
    
    // URLでチャレンジモードかどうかを判定（フラグは実行順序により未定義の場合がある）
    const isChallengeMode = window.location.href.includes('challenge_mode');
    console.log('URL基準でのチャレンジモード判定:', isChallengeMode);
    
    // チャレンジモード・ランダムモード問わず generateRandomCorrectAnswer を呼び出し
    // 関数内でモード判定して適切な正解を生成する
    generateRandomCorrectAnswer();
    
    // チャレンジモードの場合は確実に正解データを上書き（フォールバック）
    if (isChallengeMode) {
        console.log('チャレンジモード用正解データを強制設定します...');
        setChallengeCorrectAnswer();
    }
    
    console.log('ページ読み込み時の正解生成が完了しました。correctAnswer:', window.correctAnswer);
    
    clearParamEditor();
});

// チャレンジモード用の正解データ設定関数（フォールバック）
function setChallengeCorrectAnswer() {
    const url = window.location.href;
    
    if (url.includes('challenge_mode_siren.html')) {
        // 救急車のサイレン
        window.correctAnswer = {
            modulesConfig: [
                {
                    type: 'oscillator',
                    params: { 
                        type: 'sine', 
                        frequency: 865, 
                        detune: 0 
                    }
                },
                {
                    type: 'gain',
                    params: { gain: 0.3 }
                },
                {
                    type: 'lfo',
                    params: { 
                        type: 'square', 
                        frequency: 0.83, 
                        amount: 95
                    },
                    modulationTarget: { 
                        moduleId: 0, 
                        paramName: 'frequency' 
                    }
                }
            ],
            connectionsConfig: [
                { source: 0, target: 1 }, // オシレーター -> ゲイン
                { source: 2, target: 0, param: 'frequency' }, // LFO -> オシレーター周波数
                { source: 1, target: 'output' } // ゲイン -> アウトプット
            ]
        };
        console.log('救急車のサイレン正解データを設定しました:', window.correctAnswer);
    } else if (url.includes('challenge_mode_cicada.html')) {
        // セミの鳴き声 - よりリアルなプリセット
        window.correctAnswer = {
            modulesConfig: [
                {
                    type: 'oscillator',
                    params: { 
                        type: 'sawtooth',  // よりノイジーな波形
                        frequency: 3500,   // より高い周波数（典型的なセミの音域）
                        detune: 0 
                    }
                },
                {
                    type: 'filter',
                    params: {
                        type: 'bandpass',  // バンドパスでセミらしい周波数範囲を強調
                        frequency: 4200,   // 高域を強調
                        q: 8               // 適度な鋭さ
                    }
                },
                {
                    type: 'gain',
                    params: {
                        gain: 0.25         // 少し音量を上げる
                    }
                },
                {
                    type: 'lfo',
                    params: {
                        type: 'square',    // 急激な変化でセミの鳴き方を模倣
                        frequency: 12,     // より速い変調（セミの典型的な鳴き方）
                        amount: 800        // より大きな周波数変調
                    },
                    modulationTarget: {
                        moduleId: 0,       // オシレーターの周波数を変調
                        paramName: 'frequency'
                    }
                }
            ],
            connectionsConfig: [
                { source: 0, target: 1 }, // オシレーター -> フィルター
                { source: 1, target: 2 }, // フィルター -> ゲイン
                { source: 3, target: 0, param: 'frequency' }, // LFO -> オシレーター周波数
                { source: 2, target: 'output' } // ゲイン -> アウトプット
            ]
        };
        console.log('セミの鳴き声正解データを設定しました:', window.correctAnswer);
    } else if (url.includes('challenge_mode_doorbell.html')) {
        // ドアチャイム（ピンポン）- 1回だけ再生するバージョン
        window.correctAnswer = {
            soundType: 'doorbell', // 再生処理を分岐させるためのフラグ
            modulesConfig: [
                {
                    type: 'oscillator',
                    params: { 
                        type: 'triangle',  // より豊かな倍音を持つ波形
                        frequency: 783.99, // G5（ピンの音）
                        detune: 0 
                    }
                },
                {
                    type: 'filter',
                    params: {
                        type: 'lowpass',   // 高周波をカットして柔らかい音に
                        frequency: 1200,
                        q: 1
                    }
                },
                {
                    type: 'gain',
                    params: {
                        gain: 0.4          // ピーク音量
                    }
                },
                {
                    type: 'reverb',        // 自然な響き
                    params: {
                        mix: 0.4,          // ウェットレベル
                        time: 1.8,         // リバーブ時間
                        decay: 2           // リバーブの減衰
                    }
                }
            ],
            connectionsConfig: [
                { source: 0, target: 1 }, // オシレーター -> フィルター
                { source: 1, target: 2 }, // フィルター -> ゲイン
                { source: 2, target: 3 }, // ゲイン -> リバーブ
                { source: 3, target: 'output' } // リバーブ -> アウトプット
            ]
        };
        console.log('ドアチャイム正解データを設定しました:', window.correctAnswer);
    } else if (url.includes('challenge_mode_horn.html')) {
        // 車のクラクション - 「プップー」をPatternModuleで実現
        window.correctAnswer = {
            modulesConfig: [
                { // 0: オシレーター1
                    type: 'oscillator',
                    params: { type: 'square', frequency: 440, detune: 0 }
                },
                { // 1: オシレーター2
                    type: 'oscillator',
                    params: { type: 'square', frequency: 554, detune: 0 }
                },
                { // 2: フィルター
                    type: 'filter',
                    params: { type: 'lowpass', frequency: 1200, q: 1.5 }
                },
                { // 3: ゲイン（パターン制御用）
                    type: 'gain',
                    params: { gain: 0.5 } // パターンで変調される際の最大ゲイン
                },
                { // 4: パターン
                    type: 'pattern',
                    params: {
                        onTime: 0.15,  // 「プッ」の時間
                        offTime: 0.1, // 間の時間
                        repeat: 2,     // 2回繰り返す
                    }
                }
            ],
            connectionsConfig: [
                { source: 0, target: 2 }, // オシレーター1 -> フィルター
                { source: 1, target: 2 }, // オシレーター2 -> フィルター
                { source: 2, target: 3 }, // フィルター -> ゲイン
                { source: 4, target: 3, param: 'gain' }, // パターン -> ゲイン.gain
                { source: 3, target: 'output' } // ゲイン -> アウトプット
            ]
        };
        console.log('車のクラクション正解データを設定しました:', window.correctAnswer);
    } else if (url.includes('challenge_mode_microwave.html')) {
        // 電子レンジの終了音
        window.correctAnswer = {
            modulesConfig: [
                {
                    type: 'oscillator',
                    params: { 
                        type: 'sine',      // クリアなサイン波
                        frequency: 1000,   // 標準的な1kHz
                        detune: 0 
                    }
                },
                {
                    type: 'gain',
                    params: {
                        gain: 0.6          // しっかりした音量
                    }
                },
                {
                    type: 'lfo',
                    params: {
                        type: 'square',    // オンオフの切り替え
                        frequency: 2.5,    // 0.4秒間隔で3回ビープ
                        amount: 1000       // 完全にオンオフ
                    },
                    modulationTarget: {
                        moduleId: 1,       // ゲインを変調してビープ音を作る
                        paramName: 'gain'
                    }
                }
            ],
            connectionsConfig: [
                { source: 0, target: 1 }, // オシレーター -> ゲイン
                { source: 2, target: 1, param: 'gain' }, // LFO -> ゲイン.gain
                { source: 1, target: 'output' } // ゲイン -> アウトプット
            ]
        };
        console.log('電子レンジの完了音正解データを設定しました:', window.correctAnswer);
    } else if (url.includes('challenge_mode_alarm.html')) {
        // 時計のアラーム音 - 典型的な連続ビープ
        window.correctAnswer = {
            modulesConfig: [
                {
                    type: 'oscillator',
                    params: { 
                        type: 'square',    // 鋭いスクエア波
                        frequency: 880,    // A5音（高めの音）
                        detune: 0 
                    }
                },
                {
                    type: 'filter',
                    params: {
                        type: 'lowpass',   // 少し丸くする
                        frequency: 2000,
                        q: 1
                    }
                },
                {
                    type: 'gain',
                    params: {
                        gain: 0.5          // しっかりした音量
                    }
                },
                {
                    type: 'lfo',
                    params: {
                        type: 'square',    // オンオフの切り替え
                        frequency: 4,      // 4Hzで連続ビープ
                        amount: 0.5        // ゲインを変調
                    },
                    modulationTarget: {
                        moduleId: 2,       // ゲインを変調
                        paramName: 'gain'
                    }
                }
            ],
            connectionsConfig: [
                { source: 0, target: 1 }, // オシレーター -> フィルター
                { source: 1, target: 2 }, // フィルター -> ゲイン
                { source: 3, target: 2, param: 'gain' }, // LFO -> ゲイン.gain
                { source: 2, target: 'output' } // ゲイン -> アウトプット
            ]
        };
        console.log('時計のアラーム音正解データを設定しました:', window.correctAnswer);
    } else if (url.includes('challenge_mode_blinker.html')) {
        // 車のウィンカー音 - 実際のカチカチ音
        window.correctAnswer = {
            modulesConfig: [
                {
                    type: 'oscillator',
                    params: { 
                        type: 'square',    // 鋭いクリック音
                        frequency: 800,    // 高めの周波数
                        detune: 0 
                    }
                },
                {
                    type: 'filter',
                    params: {
                        type: 'highpass',  // 低音をカットしてクリック感を強調
                        frequency: 200,
                        q: 1
                    }
                },
                {
                    type: 'gain',
                    params: {
                        gain: 0.3          // 控えめな音量
                    }
                },
                {
                    type: 'lfo',
                    params: {
                        type: 'square',    // オンオフの切り替え
                        frequency: 1.33,   // 約1.5秒間隔（実際のウィンカー）
                        amount: 0.3        // ゲインを変調してカチカチ音
                    },
                    modulationTarget: {
                        moduleId: 2,       // ゲインを変調
                        paramName: 'gain'
                    }
                }
            ],
            connectionsConfig: [
                { source: 0, target: 1 }, // オシレーター -> フィルター
                { source: 1, target: 2 }, // フィルター -> ゲイン
                { source: 3, target: 2, param: 'gain' }, // LFO -> ゲイン.gain
                { source: 2, target: 'output' } // ゲイン -> アウトプット
            ]
        };
        console.log('車のウィンカー音正解データを設定しました:', window.correctAnswer);
    } else if (url.includes('challenge_mode_dial.html')) {
        // 電話のダイヤルトーン - 実際の2周波数
        window.correctAnswer = {
            modulesConfig: [
                {
                    type: 'oscillator',
                    params: { 
                        type: 'sine',      // クリアなサイン波
                        frequency: 350,    // 低い周波数成分
                        detune: 0 
                    }
                },
                {
                    type: 'oscillator',   // 2つ目のオシレーター
                    params: { 
                        type: 'sine',      
                        frequency: 440,    // 高い周波数成分（A4音）
                        detune: 0 
                    }
                },
                {
                    type: 'gain',
                    params: {
                        gain: 0.3          // 適度な音量
                    }
                }
            ],
            connectionsConfig: [
                { source: 0, target: 2 }, // オシレーター1 -> ゲイン
                { source: 1, target: 2 }, // オシレーター2 -> ゲイン
                { source: 2, target: 'output' } // ゲイン -> アウトプット
            ]
        };
        console.log('電話のダイヤル音正解データを設定しました:', window.correctAnswer);
    } else if (url.includes('challenge_mode_startup.html')) {
        // パソコンの起動音 - Windowsスタイルの上昇音
        window.correctAnswer = {
            modulesConfig: [
                {
                    type: 'oscillator',
                    params: { 
                        type: 'sine',      // 滑らかなサイン波
                        frequency: 262,    // C4音（ド）から開始
                        detune: 0 
                    }
                },
                {
                    type: 'filter',
                    params: {
                        type: 'lowpass',   // 滑らかな音質
                        frequency: 2000,
                        q: 1
                    }
                },
                {
                    type: 'gain',
                    params: {
                        gain: 0.4          // 適度な音量
                    }
                },
                {
                    type: 'lfo',
                    params: {
                        type: 'sine',      // 滑らかな変化
                        frequency: 0.8,    // ゆっくりとした上昇
                        amount: 130        // C4(262Hz) → G4(392Hz)まで上昇
                    },
                    modulationTarget: {
                        moduleId: 0,       // オシレーターの周波数を変調
                        paramName: 'frequency'
                    }
                }
            ],
            connectionsConfig: [
                { source: 0, target: 1 }, // オシレーター -> フィルター
                { source: 1, target: 2 }, // フィルター -> ゲイン
                { source: 3, target: 0, param: 'frequency' }, // LFO -> オシレーター周波数
                { source: 2, target: 'output' } // ゲイン -> アウトプット
            ]
        };
        console.log('パソコンの起動音正解データを設定しました:', window.correctAnswer);
    } else if (url.includes('challenge_mode_phone.html')) {
        // 電話の着信音 - 実際のリングリング音
        window.correctAnswer = {
            modulesConfig: [
                {
                    type: 'oscillator',
                    params: { 
                        type: 'sine',      // クリアなサイン波
                        frequency: 440,    // A4音
                        detune: 0 
                    }
                },
                {
                    type: 'oscillator',   // 2つ目のオシレーター（ハーモニー）
                    params: { 
                        type: 'sine',      
                        frequency: 880,    // A5音（1オクターブ上）
                        detune: 0 
                    }
                },
                {
                    type: 'gain',
                    params: {
                        gain: 0.4          // 適度な音量
                    }
                },
                {
                    type: 'lfo',
                    params: {
                        type: 'square',    // リングパターン
                        frequency: 0.33,   // 3秒周期（2秒オン、1秒オフ）
                        amount: 0.4        // ゲインを変調
                    },
                    modulationTarget: {
                        moduleId: 2,       // ゲインを変調
                        paramName: 'gain'
                    }
                }
            ],
            connectionsConfig: [
                { source: 0, target: 2 }, // オシレーター1 -> ゲイン
                { source: 1, target: 2 }, // オシレーター2 -> ゲイン
                { source: 3, target: 2, param: 'gain' }, // LFO -> ゲイン.gain
                { source: 2, target: 'output' } // ゲイン -> アウトプット
            ]
        };
        console.log('電話の着信音正解データを設定しました:', window.correctAnswer);
    }
}

// Debug function to test PatternModule functionality
window.testPatternModule = function() {
    console.log('[DEBUG] Testing PatternModule functionality');
    
    // Find first pattern module
    const patternModule = modules.find(m => m.type === 'pattern' && !m.isCorrectAnswerModule);
    if (!patternModule) {
        console.log('[DEBUG] No pattern module found, creating one...');
        const testPattern = createModule('pattern');
        return;
    }
    
    // Find first gain module to connect to
    const gainModule = modules.find(m => m.type === 'gain' && !m.isCorrectAnswerModule);
    if (!gainModule) {
        console.log('[DEBUG] No gain module found, creating one...');
        const testGain = createModule('gain');
        return;
    }
    
    console.log('[DEBUG] Found pattern and gain modules, connecting...');
    patternModule.connectTo(gainModule, 'gain');
    
    setTimeout(() => {
        console.log('[DEBUG] Starting pattern test...');
        patternModule.testPattern();
    }, 500);
};

window.testPlayCorrectAnswer = function() {
    console.log('[DEBUG] Testing playCorrectAnswer with detailed logging');
    playCorrectAnswer();
};
