// game.js
// 正解生成・答え合わせ・正解音再生・スコア計算など

// main.jsで定義されたグローバル変数correctAnswerを必要に応じて参照する
// ここで再定義しないこと

function generateRandomCorrectAnswer() {
    console.log('=== generateRandomCorrectAnswer START ===');
    console.log('generateRandomCorrectAnswer called');
    
    // 現在のURLを確認
    console.log('Current URL:', window.location.href);
    console.log('Current window.correctAnswer:', window.correctAnswer);
    
    // チャレンジモードかどうかを確認
    if (window.location.href.includes('challenge_mode')) {
        console.log('チャレンジモード検出 - setChallengeCorrectAnswerを実行');
        // challengeモードの場合は、main.jsで設定されたcorrectAnswerを使用
        if (typeof setChallengeCorrectAnswer === 'function') {
            setChallengeCorrectAnswer();
        } else {
            console.error('setChallengeCorrectAnswer function not found');
        }
        console.log('=== generateRandomCorrectAnswer END (チャレンジモード) ===');
        return;
    }
    
    console.log('ランダムモード検出 - 新しいcorrectAnswerを生成');
    
    // correctAnswerを初期化
    window.correctAnswer = window.correctAnswer || {};
    window.correctAnswer.modulesConfig = [];
    window.correctAnswer.connectionsConfig = [];
    
    const moduleTypes = ['oscillator', 'gain', 'filter', 'reverb'];
    const numModules = Math.floor(Math.random() * 3) + 2; // 2-4個のモジュール

    // ランダムなモジュールを生戁E
    for (let i = 0; i < numModules; i++) {
        const type = moduleTypes[Math.floor(Math.random() * moduleTypes.length)];
        let params = {};
        
        switch (type) {
            case 'oscillator':
                params = {
                    type: ['sine', 'square', 'triangle', 'sawtooth'][Math.floor(Math.random() * 4)],
                    frequency: Math.floor(Math.random() * 800) + 200, // 200-1000Hz
                    detune: 0
                };
                break;
            case 'gain':
                params = { gain: Math.random() * 0.8 + 0.2 }; // 0.2-1.0
                break;
            case 'filter':
                params = {
                    type: ['lowpass', 'highpass', 'bandpass'][Math.floor(Math.random() * 3)],
                    frequency: Math.floor(Math.random() * 3000) + 500, // 500-3500Hz
                    q: Math.random() * 3 + 0.5 // 0.5-3.5
                };
                break;
            case 'reverb':
                params = {
                    mix: Math.random() * 0.6 + 0.1, // 0.1-0.7
                    time: Math.random() * 2 + 0.5,  // 0.5-2.5s
                    decay: Math.random() * 3 + 1    // 1-4
                };
                break;
        }
        
        window.correctAnswer.modulesConfig.push({ type: type, params: params });
    }

    // 30%の確率でLFOを追加
    if (Math.random() < 0.3) {
        const audioChain = window.correctAnswer.modulesConfig.filter(m => m.type !== 'lfo' && m.type !== 'pattern');
        if (audioChain.length > 0) {
            const targetModuleIndex = window.correctAnswer.modulesConfig.indexOf(audioChain[Math.floor(Math.random() * audioChain.length)]);
            const targetModule = window.correctAnswer.modulesConfig[targetModuleIndex];
            const possibleParams = ['frequency', 'gain'];
            const targetParam = possibleParams.find(p => targetModule.params.hasOwnProperty(p));
            
            if (targetParam) {
                window.correctAnswer.modulesConfig.push({
                    type: 'lfo',
                    params: {
                        type: ['sine', 'square', 'triangle'][Math.floor(Math.random() * 3)],
                        frequency: Math.random() * 10 + 0.5, // 0.5-10.5Hz
                        amount: Math.random() * 100 + 10      // 10-110
                    },
                    modulationTarget: {
                        moduleId: targetModuleIndex,
                        paramName: targetParam
                    }
                });
            }
        }
    }

    // 20%の確率でPatternを追加
    if (Math.random() < 0.2) {
        const audioChain = window.correctAnswer.modulesConfig.filter(m => m.type !== 'lfo' && m.type !== 'pattern');
        if (audioChain.length > 0) {
            const targetModuleIndex = window.correctAnswer.modulesConfig.indexOf(audioChain[Math.floor(Math.random() * audioChain.length)]);
            const targetModule = window.correctAnswer.modulesConfig[targetModuleIndex];
            const possibleParams = ['gain'];
            const targetParam = possibleParams.find(p => targetModule.params.hasOwnProperty(p));
            
            if (targetParam) {
                window.correctAnswer.modulesConfig.push({
                    type: 'pattern',
                    params: {
                        onTime: Math.random() * 0.5 + 0.1,  // 0.1-0.6s
                        offTime: Math.random() * 0.3 + 0.05, // 0.05-0.35s
                        repeat: Math.floor(Math.random() * 5) + 2 // 2-6囁E
                    },
                    modulationTarget: {
                        moduleId: targetModuleIndex,
                        paramName: targetParam
                    }
                });
            }
        }
    }

    // 接続を生成
    const audioModules = window.correctAnswer.modulesConfig.filter(m => m.type !== 'lfo' && m.type !== 'pattern');
    window.correctAnswer.connectionsConfig = [];
    
    // オーディオチェーンの接続
    for (let i = 0; i < audioModules.length - 1; i++) {
        const sourceIndex = window.correctAnswer.modulesConfig.indexOf(audioModules[i]);
        const targetIndex = window.correctAnswer.modulesConfig.indexOf(audioModules[i + 1]);
        window.correctAnswer.connectionsConfig.push({ source: sourceIndex, target: targetIndex });
    }
    
    // 最後をoutputに接続
    if (audioModules.length > 0) {
        const lastAudioIndex = window.correctAnswer.modulesConfig.indexOf(audioModules[audioModules.length - 1]);
        window.correctAnswer.connectionsConfig.push({ source: lastAudioIndex, target: 'output' });
    }
    
    // LFO/Pattern接綁E
    window.correctAnswer.modulesConfig.forEach((moduleConfig, index) => {
        if ((moduleConfig.type === 'lfo' || moduleConfig.type === 'pattern') && moduleConfig.modulationTarget) {
            window.correctAnswer.connectionsConfig.push({
                source: index,
                target: moduleConfig.modulationTarget.moduleId,
                param: moduleConfig.modulationTarget.paramName
            });
        }
    });
    
    console.log('新しい正解 (modulesConfig):', JSON.parse(JSON.stringify(window.correctAnswer.modulesConfig)));
    console.log('新しい正解 (connectionsConfig):', JSON.parse(JSON.stringify(window.correctAnswer.connectionsConfig)));
    console.log('=== generateRandomCorrectAnswer END ===');
}

function createImpulseBuffer(audioContext, time, decay) {
    const rate = audioContext.sampleRate;
    const length = Math.max(1, rate * time);
    const impulse = audioContext.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);
    decay = decay || 2.0; // decayが指定されていなければデフォルト値

    for (let i = 0; i < length; i++) {
        left[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        right[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
    return impulse;
}

function playCorrectAnswer() {
    console.log('playCorrectAnswer called');
    console.log('audioContext:', audioContext);
    // オブジェクトが大きすぎる可能性があるため、必要な情報のみログに出力
    console.log('window.correctAnswer soundType:', window.correctAnswer?.soundType);
    console.log('window.correctAnswer modulesConfig length:', window.correctAnswer?.modulesConfig?.length);

    if (!audioContext || !window.correctAnswer || !window.correctAnswer.modulesConfig || window.correctAnswer.modulesConfig.length === 0) {
        console.error("正解を再生できません: オーディオコンテキストまたは設定がありません。");
        alert("正解を再生できません。先にオーディオを開始してください。");
        return;
    }

    // ドアベル専用の再生ロジック（ピン・ポンの順次再生）
    if (window.correctAnswer.soundType === 'doorbell') {
        playDoorbellSound();
        return;
    }

    if (typeof startVisualizer === 'function') startVisualizer();

    let allNodes = []; // クリーンアップ用
    const now = audioContext.currentTime;
    const finalDestination = analyserNode || audioContext.destination;

    try {
        const nodeMap = new Map(); // モジュールindexとAudioNodeパッケージをマッピング

        // 1. 設定に基づいてすべてのAudioNodeを作成
        window.correctAnswer.modulesConfig.forEach((moduleConfig, index) => {
            let nodePackage = {
                type: moduleConfig.type,
                config: moduleConfig,
                node: null, // モジュールの主出力ノード
                input: null, // モジュールの主入力ノード
            };

            switch (moduleConfig.type) {
                case 'oscillator':
                    const osc = audioContext.createOscillator();
                    osc.type = moduleConfig.params.type;
                    osc.frequency.setValueAtTime(moduleConfig.params.frequency, now);
                    if (moduleConfig.params.detune !== undefined) {
                        osc.detune.setValueAtTime(moduleConfig.params.detune, now);
                    }
                    nodePackage.node = osc;
                    allNodes.push(osc);
                    break;
                case 'filter':
                    const filter = audioContext.createBiquadFilter();
                    filter.type = moduleConfig.params.type;
                    filter.frequency.setValueAtTime(moduleConfig.params.frequency, now);
                    if (moduleConfig.params.q !== undefined) {
                        filter.Q.setValueAtTime(moduleConfig.params.q, now);
                    }
                    nodePackage.node = filter;
                    nodePackage.input = filter;
                    allNodes.push(filter);
                    break;
                case 'gain':
                    const gain = audioContext.createGain();
                    gain.gain.setValueAtTime(moduleConfig.params.gain, now);
                    nodePackage.node = gain;
                    nodePackage.input = gain;
                    allNodes.push(gain);
                    break;
                case 'delay':
                    const delay = audioContext.createDelay(1.0);
                    const feedback = audioContext.createGain();
                    delay.delayTime.setValueAtTime(moduleConfig.params.delayTime, now);
                    feedback.gain.setValueAtTime(moduleConfig.params.feedback, now);
                    delay.connect(feedback);
                    feedback.connect(delay);
                    nodePackage.node = delay;
                    nodePackage.input = delay;
                    nodePackage.feedbackNode = feedback; // LFO接続用
                    allNodes.push(delay, feedback);
                    break;
                case 'reverb':
                    const convolver = audioContext.createConvolver();
                    const impulseBuffer = createImpulseBuffer(audioContext, moduleConfig.params.time, 2.0);
                    if (impulseBuffer) convolver.buffer = impulseBuffer;
                    const wetGain = audioContext.createGain();
                    wetGain.gain.setValueAtTime(moduleConfig.params.mix, now);
                    const dryGain = audioContext.createGain();
                    dryGain.gain.setValueAtTime(1 - moduleConfig.params.mix, now);
                    const reverbInput = audioContext.createGain();
                    reverbInput.connect(dryGain);
                    reverbInput.connect(convolver);
                    convolver.connect(wetGain);
                    const reverbOutput = audioContext.createGain();
                    dryGain.connect(reverbOutput);
                    wetGain.connect(reverbOutput);
                    nodePackage.node = reverbOutput;
                    nodePackage.input = reverbInput;
                    nodePackage.wetGain = wetGain; // LFO接続用
                    allNodes.push(convolver, wetGain, dryGain, reverbInput, reverbOutput);
                    break;
                case 'lfo':
                    const lfo = audioContext.createOscillator();
                    const lfoGain = audioContext.createGain();
                    lfo.type = moduleConfig.params.type;
                    lfo.frequency.setValueAtTime(moduleConfig.params.frequency, now);
                    lfoGain.gain.setValueAtTime(moduleConfig.params.amount, now);
                    lfo.connect(lfoGain);
                    nodePackage.node = lfoGain;
                    allNodes.push(lfo, lfoGain);
                    break;
                case 'pattern':
                    // PatternModuleインスタンスを作成
                    const patternModule = new PatternModule(0, 0, true);
                    patternModule.setParams(moduleConfig.params);
                    nodePackage.node = null; // PatternModuleはaudioNode持たない
                    nodePackage.patternModule = patternModule; // start()を呼ぶために保持
                    // allNodesには追加しない（PatternModuleは物理的なaudioNodeがないため）
                    break;
            }
            nodeMap.set(index, nodePackage);
        });

        // 2. connectionsConfigに基づいてノードを接続
        if (!window.correctAnswer.connectionsConfig) {
            console.error('connectionsConfig is missing!');
            console.log('window.correctAnswer structure:', window.correctAnswer);
            console.log('Available properties:', Object.keys(window.correctAnswer));
            
            // フォールバック: 基本的な線形接続を生成
            const audioModules = window.correctAnswer.modulesConfig.filter(m => m.type !== 'lfo' && m.type !== 'pattern');
            const fallbackConnections = [];
            
            // 基本的なオーディオチェーン
            for (let i = 0; i < audioModules.length - 1; i++) {
                const sourceIndex = window.correctAnswer.modulesConfig.indexOf(audioModules[i]);
                const targetIndex = window.correctAnswer.modulesConfig.indexOf(audioModules[i + 1]);
                fallbackConnections.push({ source: sourceIndex, target: targetIndex });
            }
            
            // 最後をoutputに接続
            if (audioModules.length > 0) {
                const lastIndex = window.correctAnswer.modulesConfig.indexOf(audioModules[audioModules.length - 1]);
                fallbackConnections.push({ source: lastIndex, target: 'output' });
            }
            
            // LFO/Pattern接続
            window.correctAnswer.modulesConfig.forEach((moduleConfig, index) => {
                if ((moduleConfig.type === 'lfo' || moduleConfig.type === 'pattern') && moduleConfig.modulationTarget) {
                    fallbackConnections.push({
                        source: index,
                        target: moduleConfig.modulationTarget.moduleId,
                        param: moduleConfig.modulationTarget.paramName
                    });
                }
            });
            
            console.log('Generated fallback connections:', fallbackConnections);
            window.correctAnswer.connectionsConfig = fallbackConnections;
        }

        console.log('[playCorrectAnswer] Processing connections:', window.correctAnswer.connectionsConfig);
        window.correctAnswer.connectionsConfig.forEach((conn, index) => {
            console.log(`[playCorrectAnswer] Connection ${index}:`, conn);
            const sourcePackage = nodeMap.get(conn.source);
            if (!sourcePackage) {
                console.warn(`[playCorrectAnswer] Source package not found for conn.source=${conn.source}`);
                return;
            }
            console.log(`[playCorrectAnswer] Source package type: ${sourcePackage.type}`);

            if (sourcePackage.type === 'pattern') {
                console.log('[playCorrectAnswer] Processing pattern connection');
                // パターンモジュールの接続とstart()
                const targetPackage = nodeMap.get(conn.target);
                const targetParamName = conn.param;
                console.log('[playCorrectAnswer] Pattern target:', targetPackage, 'param:', targetParamName);
                if (targetPackage && targetParamName && sourcePackage.patternModule) {
                    const patternModule = sourcePackage.patternModule;
                    const targetNode = targetPackage.node;
                    const targetAudioParam = targetNode[targetParamName];
                    console.log('[playCorrectAnswer] Pattern module:', patternModule, 'targetAudioParam:', targetAudioParam);
                    
                    if (targetAudioParam instanceof AudioParam) {
                        // 新しい直接制御方式：物理的接続は行わず、targetInfoだけ設定
                        patternModule.targetInfo = {
                            module: { params: targetPackage.config.params, setExternalControl: () => {} }, // 簡易的なモジュールオブジェクト
                            paramName: targetParamName,
                            targetParam: targetAudioParam,
                            baseValue: targetPackage.config.params[targetParamName]
                        };
                        console.log('[Pattern Connection] Connected pattern to', targetParamName, 'baseValue:', patternModule.targetInfo.baseValue);
                        // 接続後にstart()を呼んでパターンを開姁E
                        patternModule.start();
                        console.log('[playCorrectAnswer] Pattern start() called');
                    } else {
                        console.warn('[playCorrectAnswer] targetAudioParam is not AudioParam:', targetAudioParam);
                    }
                } else {
                    console.warn('[playCorrectAnswer] Pattern connection missing components:', {
                        targetPackage: !!targetPackage,
                        targetParamName: !!targetParamName,
                        patternModule: !!sourcePackage.patternModule
                    });
                }
            } else {
                // 通常のオーディオまたはパラメータ接続
                const sourceNode = sourcePackage.node;
                if (!sourceNode) return;

                if (conn.target === 'output') {
                    sourceNode.connect(finalDestination);
                } else {
                    const targetPackage = nodeMap.get(conn.target);
                    if (!targetPackage) return;
                    const targetParamName = conn.param;

                    if (targetParamName) { // パラメータ接綁E
                        let targetAudioParam;
                        if (targetPackage.node && targetPackage.node[targetParamName]) {
                            targetAudioParam = targetPackage.node[targetParamName];
                        } else if (targetPackage.wetGain && targetParamName === 'mix') {
                            targetAudioParam = targetPackage.wetGain.gain;
                        }
                        if (targetAudioParam instanceof AudioParam) {
                            sourceNode.connect(targetAudioParam);
                        }
                    } else { // オーディオ接続
                        const targetInput = targetPackage.input || targetPackage.node;
                        if (targetInput) {
                            sourceNode.connect(targetInput);
                        }
                    }
                }
            }
        });

        // 3. オシレーターとLFOを開姁E
        allNodes.forEach(node => {
            if (node instanceof OscillatorNode) {
                node.start(now);
            }
        });

        // 4. クリーンアップを予約
        setTimeout(() => {
            allNodes.forEach(node => {
                if (node instanceof OscillatorNode) {
                    try { node.stop(); } catch (e) { /* ignore */ }
                }
                try { node.disconnect(); } catch (e) { /* ignore */ }
            });
            if (typeof stopVisualizer === 'function') stopVisualizer();
        }, 2000);

    } catch (error) {
        console.error("正解の再生中にエラーが発生しました:", error);
        allNodes.forEach(node => {
            if (node instanceof OscillatorNode) {
                try { node.stop(); } catch (e) { /* ignore */ }
            }
            try { node.disconnect(); } catch (e) { /* ignore */ }
        });
        if (typeof stopVisualizer === 'function') stopVisualizer();
    }
}

function playDoorbellSound() {
    console.log('Playing doorbell: PING-PONG sequence');
    const finalDestination = analyserNode || audioContext.destination;
    const now = audioContext.currentTime;
    
    if (typeof startVisualizer === 'function') startVisualizer();
    
    // モジュール設定を取得
    const oscConfig = window.correctAnswer.modulesConfig.find(m => m.type === 'oscillator').params;
    const gainConfig = window.correctAnswer.modulesConfig.find(m => m.type === 'gain').params;
    const filterConfig = window.correctAnswer.modulesConfig.find(m => m.type === 'filter').params;
    const reverbConfig = window.correctAnswer.modulesConfig.find(m => m.type === 'reverb')?.params;
    
    // 共通のエフェクトチェーンを作成
    const filter = audioContext.createBiquadFilter();
    filter.type = filterConfig.type;
    filter.frequency.setValueAtTime(filterConfig.frequency, now);
    filter.Q.setValueAtTime(filterConfig.q, now);
    
    let effectsOutput = filter;
    
    // リバーブ処理
    if (reverbConfig) {
        const impulseBuffer = createImpulseBuffer(audioContext, reverbConfig.time, reverbConfig.decay);
        if (impulseBuffer) {
            const convolver = audioContext.createConvolver();
            convolver.buffer = impulseBuffer;
            const wetGain = audioContext.createGain();
            wetGain.gain.setValueAtTime(reverbConfig.mix, now);
            const dryGain = audioContext.createGain();
            dryGain.gain.setValueAtTime(1 - reverbConfig.mix, now);
            const reverbOutput = audioContext.createGain();
            
            filter.connect(dryGain);
            filter.connect(wetGain);
            dryGain.connect(reverbOutput);
            wetGain.connect(convolver);
            convolver.connect(reverbOutput);
            reverbOutput.connect(finalDestination);
            effectsOutput = null; // reverbOutputに直接接続済み
        } else {
            filter.connect(finalDestination);
            effectsOutput = null;
        }
    } else {
        filter.connect(finalDestination);
        effectsOutput = null;
    }
    
    // ピン音の再生（高い音：G5 = 783.99Hz）
    const playPing = (startTime) => {
        const osc1 = audioContext.createOscillator();
        const gain1 = audioContext.createGain();
        
        osc1.type = oscConfig.type;
        osc1.frequency.setValueAtTime(783.99, startTime); // G5
        
        // エンベロープ：短く鋭く
        gain1.gain.setValueAtTime(0, startTime);
        gain1.gain.linearRampToValueAtTime(gainConfig.gain, startTime + 0.01); // Attack
        gain1.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5); // Decay
        
        osc1.connect(gain1);
        gain1.connect(filter);
        
        osc1.start(startTime);
        osc1.stop(startTime + 0.6);
    };
    
    // ポン音の再生（低い音：E5 = 659.25Hz）
    const playPong = (startTime) => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        
        osc2.type = oscConfig.type;
        osc2.frequency.setValueAtTime(659.25, startTime); // E5
        
        // エンベロープ：やや長く、柔らかく
        gain2.gain.setValueAtTime(0, startTime);
        gain2.gain.linearRampToValueAtTime(gainConfig.gain * 0.8, startTime + 0.02); // Attack
        gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.7); // Decay
        
        osc2.connect(gain2);
        gain2.connect(filter);
        
        osc2.start(startTime);
        osc2.stop(startTime + 0.8);
    };
    
    // ピンポンの正しい再生：PING一回、PONG一回のみ
    console.log('Playing PING at', (now + 0.05).toFixed(3));
    playPing(now + 0.05);        // ピン
    
    console.log('Playing PONG at', (now + 0.8).toFixed(3));
    playPong(now + 0.8);         // ポン（0.75秒後）

    // クリーンアップ
    setTimeout(() => {
        if (typeof stopVisualizer === 'function') stopVisualizer();
    }, 2000);
}

function checkAnswer() {
    // 以前の正解表示とハイライトをクリア
    modules.filter(m => m.isCorrectAnswerModule).forEach(m => m.destroy());
    modules.forEach(m => {
        if (m.domElement) {
            m.domElement.style.border = '1px solid #ccc';
            m.domElement.style.borderColor = '#ccc';
        }
    });

    let score = 0;
    let explanation = '';
    const maxScore = 100;
    const paramMatchBonus = 5;
    const typeMatchBonus = 10;
    const modulePresencePenalty = -15;
    const connectionBonus = 10;

    const userModules = modules.filter(m => m.type !== 'output' && !m.isCorrectAnswerModule);
    const correctModulesConfig = window.correctAnswer.modulesConfig;
    const correctConnectionsConfig = window.correctAnswer.connectionsConfig;

    if (!correctModulesConfig || !correctConnectionsConfig) {
        alert('エラー: 正解データがありません。リセットしてください。');
        return;
    }

    // --- 正解モジュールをワークスペースに表示 ---
    const correctAnswerModules = []; // 表示された正解モジュールを格納
    const workspaceRect = workspace.getBoundingClientRect();
    
    // 新しい配置システム：固定グリッドで配置
    const GRID_WIDTH = 180;    // グリッドセルの幅
    const GRID_HEIGHT = 120;   // グリッドセルの高さ
    const START_X = 50;        // 開始X座標
    const START_Y = workspaceRect.height / 2 + 60; // 開始Y座標
    
    // 占有済みセルを管理するマップ
    const occupiedCells = new Map(); // "x,y" -> moduleId
    
    // セルが占有されているかチェック
    const isCellOccupied = (gridX, gridY) => {
        return occupiedCells.has(`${gridX},${gridY}`);
    };
    
    // 利用可能な次のセルを見つける（スパイラル検索）
    const findAvailableCell = (preferredX = 0, preferredY = 0) => {
        // まず希望座標をチェック
        if (!isCellOccupied(preferredX, preferredY)) {
            return { x: preferredX, y: preferredY };
        }
        
        // スパイラル検索で空きセルを見つける
        for (let radius = 1; radius <= 10; radius++) {
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    // 境界上のセルのみチェック
                    if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
                        const x = preferredX + dx;
                        const y = preferredY + dy;
                        if (x >= 0 && y >= -2 && !isCellOccupied(x, y)) { // y = -2まで許可
                            return { x, y };
                        }
                    }
                }
            }
        }
        
        // フォールバック
        return { x: preferredX, y: preferredY };
    };
    
    // グリッド座標をピクセル座標に変換
    const gridToPixel = (gridX, gridY) => {
        return {
            x: START_X + gridX * GRID_WIDTH,
            y: START_Y + gridY * GRID_HEIGHT
        };
    };
    
    // セルを占有として記録
    const occupyCell = (gridX, gridY, moduleId) => {
        occupiedCells.set(`${gridX},${gridY}`, moduleId);
    };

    // 1. 正解用のOutputモジュールを配置
    const outputGridPos = findAvailableCell(5, 0); // 右側に配置
    occupyCell(outputGridPos.x, outputGridPos.y, 'output');
    const outputPixelPos = gridToPixel(outputGridPos.x, outputGridPos.y);
    const correctAnswerOutputModule = createModule('output', outputPixelPos.x, outputPixelPos.y, true);
    if (correctAnswerOutputModule) {
        correctAnswerModules.push(correctAnswerOutputModule);
    }

    // 2. オーディオモジュールを並列構造を考慮して配置
    const audioModules = correctModulesConfig.filter(config => 
        config.type !== 'lfo' && config.type !== 'pattern'
    );
    
    // 並列チェーンを検出する関数
    const findParallelChains = () => {
        const chains = [];
        const visitedModules = new Set();
        
        // outputに直接接続されているモジュールから逆方向に辿る
        const outputConnections = correctConnectionsConfig.filter(conn => conn.target === 'output');
        
        outputConnections.forEach(outputConn => {
            const chain = [];
            let currentModuleIndex = outputConn.source;
            
            // チェーンを逆方向に辿る
            while (currentModuleIndex !== undefined && !visitedModules.has(currentModuleIndex)) {
                visitedModules.add(currentModuleIndex);
                chain.unshift(currentModuleIndex); // 先頭に追加（逆順）
                
                // このモジュールの入力を探す
                const inputConnection = correctConnectionsConfig.find(conn => 
                    conn.target === currentModuleIndex && !conn.param
                );
                currentModuleIndex = inputConnection ? inputConnection.source : undefined;
            }
            
            if (chain.length > 0) {
                chains.push(chain);
            }
        });
        
        return chains;
    };
    
    const parallelChains = findParallelChains();
    console.log('Detected parallel chains:', parallelChains);
    
    // 並列チェーンを縦に配置
    parallelChains.forEach((chain, chainIndex) => {
        chain.forEach((moduleIndex, positionInChain) => {
            const config = correctModulesConfig[moduleIndex];
            const gridPos = findAvailableCell(positionInChain, chainIndex); // x=チェーン内位置, y=チェーン番号
            occupyCell(gridPos.x, gridPos.y, moduleIndex);
            const pixelPos = gridToPixel(gridPos.x, gridPos.y);
            
            const newModule = createModule(config.type, pixelPos.x, pixelPos.y, true);
            if (newModule) {
                newModule.setParams(config.params);
                newModule.originalIndex = moduleIndex;
                correctAnswerModules.push(newModule);
            }
        });
    });
    
    // 並列チェーンに含まれていないオーディオモジュールがあれば、追加で配置
    audioModules.forEach((config, index) => {
        const originalIndex = correctModulesConfig.indexOf(config);
        const isAlreadyPlaced = correctAnswerModules.some(m => m.originalIndex === originalIndex);
        
        if (!isAlreadyPlaced) {
            const gridPos = findAvailableCell(index, parallelChains.length); // 下の行に配置
            occupyCell(gridPos.x, gridPos.y, originalIndex);
            const pixelPos = gridToPixel(gridPos.x, gridPos.y);
            
            const newModule = createModule(config.type, pixelPos.x, pixelPos.y, true);
            if (newModule) {
                newModule.setParams(config.params);
                newModule.originalIndex = originalIndex;
                correctAnswerModules.push(newModule);
            }
        }
    });

    // 3. モジュレーションモジュール（LFO/Pattern）を配置
    const modulationModules = correctModulesConfig.filter(config => 
        config.type === 'lfo' || config.type === 'pattern'
    );
    
    modulationModules.forEach((config, index) => {
        const originalIndex = correctModulesConfig.indexOf(config);
        let gridPos;
        
        // 接続先があれば、その下に配置
        if (config.modulationTarget) {
            const targetModuleId = config.modulationTarget.moduleId;
            const targetModule = correctAnswerModules.find(m => m.originalIndex === targetModuleId);
            
            if (targetModule) {
                // ターゲットモジュールのピクセル座標からグリッド座標を逆算
                const targetPixelX = parseInt(targetModule.domElement.style.left);
                const targetPixelY = parseInt(targetModule.domElement.style.top);
                const targetGridX = Math.round((targetPixelX - START_X) / GRID_WIDTH);
                const targetGridY = Math.round((targetPixelY - START_Y) / GRID_HEIGHT);
                
                // 接続先の下のセルを希望位置とする（並列チェーンの下に配置）
                const maxChainY = parallelChains.length > 0 ? Math.max(...parallelChains.map((chain, chainIndex) => chainIndex)) : 0;
                gridPos = findAvailableCell(targetGridX, maxChainY + 1);
            } else {
                // 接続先が見つからない場合、LFO専用エリアに配置
                const maxChainY = parallelChains.length > 0 ? Math.max(...parallelChains.map((chain, chainIndex) => chainIndex)) : 0;
                gridPos = findAvailableCell(index, maxChainY + 2);
            }
        } else {
            // 接続先がない場合、LFO専用エリアに配置
            const maxChainY = parallelChains.length > 0 ? Math.max(...parallelChains.map((chain, chainIndex) => chainIndex)) : 0;
            gridPos = findAvailableCell(index, maxChainY + 2);
        }
        
        occupyCell(gridPos.x, gridPos.y, originalIndex);
        const pixelPos = gridToPixel(gridPos.x, gridPos.y);
        
        const newModule = createModule(config.type, pixelPos.x, pixelPos.y, true);
        if (newModule) {
            newModule.setParams(config.params);
            newModule.originalIndex = originalIndex;
            correctAnswerModules.push(newModule);
        }
    });

    // 3. 正解の接続を視覚的に表示
    const originalConnections = [...connections]; // ユーザーの接続を退避
    connections.length = 0; // 表示を一旦クリア

    if (correctConnectionsConfig) {
        correctConnectionsConfig.forEach(conn => {
            const sourceModule = correctAnswerModules.find(m => m.originalIndex === conn.source);
            const targetModule = conn.target === 'output' 
                ? correctAnswerOutputModule
                : correctAnswerModules.find(m => m.originalIndex === conn.target);
            
            if (sourceModule && targetModule) {
                connections.push({ 
                    sourceId: sourceModule.id, 
                    targetId: targetModule.id, 
                    param: conn.param 
                });
            }
        });
    }
    updateConnectionsSVG(); // 正解の接続を描画
    connections.splice(0, connections.length, ...originalConnections); // ユーザーの接続に戻す

    // --- 評価ロジック ---
    const matchedUserModules = new Set();
    const matchedCorrectConfigs = new Set();
    const userToCorrectMap = new Map(); // Map<userModule, correctConfig>
    const correctToUserMap = new Map(); // Map<correctConfig, userModule>

    // 1. ユーザーモジュールと正解モジュールをマッチング (タイプが同じものを単純に割り当て)
    userModules.forEach(userModule => {
        for (let i = 0; i < correctModulesConfig.length; i++) {
            if (!matchedCorrectConfigs.has(i) && userModule.type === correctModulesConfig[i].type) {
                const correctConfig = correctModulesConfig[i];
                matchedUserModules.add(userModule);
                matchedCorrectConfigs.add(i);
                userToCorrectMap.set(userModule, correctConfig);
                correctToUserMap.set(correctConfig, userModule);
                break; 
            }
        }
    });

    // 2. モジュールの存在とパラメータを評価
    userModules.forEach(userModule => {
        if (userToCorrectMap.has(userModule)) {
            const correctConfig = userToCorrectMap.get(userModule);
            score += typeMatchBonus;
            explanation += `[一致] ${userModule.name} (${userModule.type}) (+${typeMatchBonus}点)\n`;

            let allParamsMatch = true;
            for (const paramName in correctConfig.params) {
                let isMatch = false;
                const userValue = userModule.params[paramName];
                const correctValue = correctConfig.params[paramName];
                if (typeof correctValue === 'string') {
                    isMatch = userValue === correctValue;
                } else {
                    const tolerance = Math.abs(correctValue) * 0.1 + 0.01;
                    isMatch = Math.abs(userValue - correctValue) <= tolerance;
                }
                if (isMatch) {
                    score += paramMatchBonus;
                    explanation += `  [パラメータ一致] ${paramName}: ${userValue} (+${paramMatchBonus}点)\n`;
                } else {
                    allParamsMatch = false;
                    explanation += `  [パラメータ不一致] ${paramName}: ${userValue} (正解: ${correctValue})\n`;
                }
            }
            // 正解モジュールを緑でハイライト
            userModule.domElement.style.borderColor = '#10b981';
            userModule.domElement.style.borderWidth = '3px';
        } else {
            explanation += `[不要] ${userModule.name} (${userModule.type}) (${modulePresencePenalty}点)\n`;
            score += modulePresencePenalty;
            // 不要モジュールを赤でハイライト
            userModule.domElement.style.borderColor = '#ef4444';
            userModule.domElement.style.borderWidth = '3px';
        }
    });

    // 3. 不足モジュールをチェック
    correctModulesConfig.forEach((correctConfig, index) => {
        if (!matchedCorrectConfigs.has(index)) {
            explanation += `[不足] ${correctConfig.type} モジュールが不足しています (${modulePresencePenalty}点)\n`;
            score += modulePresencePenalty;
        }
    });

    // 4. 接続を評価
    let correctConnectionsCount = 0;
    if (correctConnectionsConfig) {
        correctConnectionsConfig.forEach(correctConn => {
            const sourceUserModule = correctToUserMap.get(correctModulesConfig[correctConn.source]);
            let targetUserModule;
            if (correctConn.target === 'output') {
                targetUserModule = globalOutputNode;
            } else {
                targetUserModule = correctToUserMap.get(correctModulesConfig[correctConn.target]);
            }

            if (sourceUserModule && targetUserModule) {
                const userConnection = connections.find(conn => 
                    conn.sourceId === sourceUserModule.id && 
                    conn.targetId === targetUserModule.id &&
                    conn.param === correctConn.param
                );
                if (userConnection) {
                    correctConnectionsCount++;
                    score += connectionBonus;
                    explanation += `[接続一致] ${sourceUserModule.name} -> ${targetUserModule.name}` + 
                                 (correctConn.param ? ` (${correctConn.param})` : '') + ` (+${connectionBonus}点)\n`;
                } else {
                    explanation += `[接続不足] ${sourceUserModule.name} -> ${targetUserModule.name}` +
                                 (correctConn.param ? ` (${correctConn.param})` : '') + `\n`;
                }
            }
        });
    }

    score = Math.max(0, Math.min(maxScore, score));
    
    // 結果表示
    const resultText = `あなたのスコア: ${score}/${maxScore}\n\n${explanation}`;
    alert(resultText);
    
    console.log('正解チェック完了。スコア:', score);
}

function showHint1() {
    const hintDisplay = document.getElementById('hint-display');
    if (!hintDisplay || !window.correctAnswer || !window.correctAnswer.modulesConfig) return;
    
    const moduleCount = window.correctAnswer.modulesConfig.length;
    hintDisplay.innerHTML = `<p>正解のモジュール数は <strong>${moduleCount}</strong> 個です（Outputを除く）</p>`;
}

function showHint2() {
    const hintDisplay = document.getElementById('hint-display');
    if (!hintDisplay || !window.correctAnswer || !window.correctAnswer.modulesConfig) return;
    
    const moduleTypes = [];
    window.correctAnswer.modulesConfig.forEach(config => {
        if (!moduleTypes.includes(config.type)) {
            moduleTypes.push(config.type);
        }
    });
    
    hintDisplay.innerHTML = `<p>使用されているモジュールの種類は...<br><strong>${moduleTypes.join(', ')}</strong> です。</p><p class="text-xs text-gray-500">(順序は無関係)</p>`;
}
