// game.js
// 正解生成・答え合わせ・正解音再生・スコア計算など

// main.jsで定義されたグローバル変数correctAnswerを必ず参照する
// ここで再定義しないこと！

function generateRandomCorrectAnswer() {
    console.log('=== generateRandomCorrectAnswer START ===');
    console.log('generateRandomCorrectAnswer called');
    console.log('URL:', window.location.href);
    console.log('isChallengeMode:', window.isChallengeMode);
    console.log('Current correctAnswer:', window.correctAnswer);
    
    // チャレンジモード判定：URL基準で確実にチェック
    const isChallengeMode = window.location.href.includes('challenge_mode');
    console.log('URL基準でのチャレンジモード判定:', isChallengeMode);
    
    // correctAnswerを初期化
    if (!window.correctAnswer) {
        window.correctAnswer = {};
    }
    
    if (isChallengeMode) {
        // チャレンジモードの場合は固定の正解を設定
        console.log('チャレンジモードのため、固定の正解を生成します。');
        if (typeof setChallengeCorrectAnswer === 'function') {
            setChallengeCorrectAnswer();
        } else {
            console.error('setChallengeCorrectAnswer function not found');
        }
        console.log('=== generateRandomCorrectAnswer END (チャレンジモード) ===');
        return;
    }
    
    // ランダムモード用のロジックはここから開始
    console.log('ランダムモードのため、新しい正解を生成します。');
    
    // correctAnswerを初期化
    window.correctAnswer.modulesConfig = [];
    const moduleOrder = [];
    // 1. Oscillatorは必須
    moduleOrder.push('oscillator');
    // 2. Filter を確率で追加 (70%の確率)
    if (Math.random() < 0.7) moduleOrder.push('filter');
    // 3. Gainは必須
    moduleOrder.push('gain');
    // 4. Delay を確率で追加 (70%の確率)
    if (Math.random() < 0.7) moduleOrder.push('delay');
    // 5. Reverb を確率で追加 (60%の確率)
    if (Math.random() < 0.6) moduleOrder.push('reverb');

    moduleOrder.forEach(type => {
        let params = {};
        switch (type) {
            case 'oscillator':
                const oscTypes = ['sine', 'square', 'sawtooth', 'triangle'];
                params = {
                    type: oscTypes[Math.floor(Math.random() * oscTypes.length)],
                    frequency: Math.floor(Math.random() * (1200 - 80 + 1)) + 80,
                    detune: Math.floor(Math.random() * (100 - (-100) + 1)) + (-100)
                };
                break;
            case 'gain':
                params = {
                    gain: parseFloat((Math.random() * (0.4 - 0.1) + 0.1).toFixed(2))
                };
                break;
            case 'filter':
                const filterTypes = ['lowpass', 'highpass', 'bandpass', 'notch', 'peaking'];
                params = {
                    type: filterTypes[Math.floor(Math.random() * filterTypes.length)],
                    frequency: Math.floor(Math.random() * (7000 - 150 + 1)) + 150,
                    q: parseFloat((Math.random() * (10 - 0.2) + 0.2).toFixed(2))
                };
                break;
            case 'delay':
                params = {
                    delayTime: parseFloat((Math.random() * (0.9 - 0.05) + 0.05).toFixed(3)),
                    feedback: parseFloat((Math.random() * (0.75 - 0.05) + 0.05).toFixed(2))
                };
                break;
            case 'reverb':
                params = {
                    mix: parseFloat((Math.random() * (0.6 - 0.1) + 0.1).toFixed(2)),
                    time: parseFloat((Math.random() * (3.0 - 0.5) + 0.5).toFixed(2))
                };
                break;
        }
        correctAnswer.modulesConfig.push({ type: type, params: params });
    });

    // LFOまたはPatternモジュレーションを追加
    if (Math.random() < 0.5) { // 50%の確率でLFOまたはPatternを追加
        const modulationType = Math.random() < 0.8 ? 'lfo' : 'pattern'; // 80%の確率でLFO、20%でPattern
        
        const audioChain = correctAnswer.modulesConfig.filter(m => m.type !== 'lfo' && m.type !== 'pattern');
        const modulatableModules = audioChain.filter(m => ['oscillator', 'filter', 'gain', 'delay'].includes(m.type));
        
        if (modulatableModules.length > 0) {
            const targetModuleConfig = modulatableModules[Math.floor(Math.random() * modulatableModules.length)];
            const targetModuleId = audioChain.indexOf(targetModuleConfig);
            
            let targetParamName = 'frequency'; // デフォルト
            if (targetModuleConfig.type === 'gain') targetParamName = 'gain';
            if (targetModuleConfig.type === 'delay') targetParamName = 'delayTime';
            
            if (modulationType === 'lfo') {
                const lfoParams = {
                    type: ['sine', 'square', 'sawtooth', 'triangle'][Math.floor(Math.random() * 4)],
                    frequency: parseFloat((Math.random() * (10 - 0.5) + 0.5).toFixed(1)),
                    amount: Math.floor(Math.random() * (800 - 50 + 1)) + 50
                };
                
                correctAnswer.modulesConfig.push({
                    type: 'lfo',
                    params: lfoParams,
                    modulationTarget: { moduleId: targetModuleId, paramName: targetParamName }
                });
            } else if (modulationType === 'pattern') {
                const patternParams = {
                    onTime: parseFloat((Math.random() * (0.5 - 0.05) + 0.05).toFixed(2)),
                    offTime: parseFloat((Math.random() * (0.3 - 0.05) + 0.05).toFixed(2)),
                    repeat: Math.floor(Math.random() * 5) + 2 // 2-6回のリピート
                };
                
                correctAnswer.modulesConfig.push({
                    type: 'pattern',
                    params: patternParams,
                    modulationTarget: { moduleId: targetModuleId, paramName: targetParamName }
                });
            }
        }
    }
    
    // connectionsConfigを生成
    const audioModules = correctAnswer.modulesConfig.filter(m => m.type !== 'lfo' && m.type !== 'pattern');
    const connectionsConfig = [];
    
    // オーディオチェーンの接続
    for (let i = 0; i < audioModules.length - 1; i++) {
        const sourceIndex = correctAnswer.modulesConfig.indexOf(audioModules[i]);
        const targetIndex = correctAnswer.modulesConfig.indexOf(audioModules[i + 1]);
        connectionsConfig.push({ source: sourceIndex, target: targetIndex });
    }
    
    // 最後のオーディオモジュールをoutputに接続
    if (audioModules.length > 0) {
        const lastAudioIndex = correctAnswer.modulesConfig.indexOf(audioModules[audioModules.length - 1]);
        connectionsConfig.push({ source: lastAudioIndex, target: 'output' });
    }
    
    // LFO/Patternモジュレーション接続
    correctAnswer.modulesConfig.forEach((moduleConfig, index) => {
        if ((moduleConfig.type === 'lfo' || moduleConfig.type === 'pattern') && moduleConfig.modulationTarget) {
            connectionsConfig.push({
                source: index,
                target: moduleConfig.modulationTarget.moduleId,
                param: moduleConfig.modulationTarget.paramName
            });
        }
    });
    
    correctAnswer.connectionsConfig = connectionsConfig;

    console.log('新しい正解 (modulesConfig):', JSON.parse(JSON.stringify(correctAnswer.modulesConfig)));
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

function playDoorbellSound() {
    console.log('Playing doorbell sound...');
    const finalDestination = analyserNode || audioContext.destination;
    const now = audioContext.currentTime;
    const attackTime = 0.01;
    const decayTimeConstant = 0.2; // 音の減衰の速さ（時定数）
    const releaseTime = 1.0; //音が完全に消えるまでの時間

    // モジュール設定を取得
    const oscConfig = correctAnswer.modulesConfig.find(m => m.type === 'oscillator').params;
    const filterConfig = correctAnswer.modulesConfig.find(m => m.type === 'filter').params;
    const gainConfig = correctAnswer.modulesConfig.find(m => m.type === 'gain').params;
    const reverbConfig = correctAnswer.modulesConfig.find(m => m.type === 'reverb')?.params;

    // 2つの音を再生する関数
    const playNote = (freq, startTime) => {
        // ノードの作成
        const osc = audioContext.createOscillator();
        const filter = audioContext.createBiquadFilter();
        const gainNode = audioContext.createGain();

        // パラメータ設定
        osc.type = oscConfig.type;
        osc.frequency.setValueAtTime(freq, startTime);
        filter.type = filterConfig.type;
        filter.frequency.setValueAtTime(filterConfig.frequency, startTime);
        filter.Q.setValueAtTime(filterConfig.q, startTime);
        
        // エンベロープ（音量の時間変化）
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(gainConfig.gain, startTime + attackTime); // Attack
        gainNode.gain.setTargetAtTime(0, startTime + attackTime, decayTimeConstant); // Decay & Release

        // ノード接続
        osc.connect(filter);
        filter.connect(gainNode);

        let lastNode = gainNode;

        // リバーブ処理
        if (reverbConfig) {
            const impulseBuffer = createImpulseBuffer(audioContext, reverbConfig.time, reverbConfig.decay);
            if (impulseBuffer) {
                const convolver = audioContext.createConvolver();
                convolver.buffer = impulseBuffer;
                const wetGain = audioContext.createGain();
                wetGain.gain.setValueAtTime(reverbConfig.mix, startTime);
                const dryGain = audioContext.createGain();
                dryGain.gain.setValueAtTime(1 - reverbConfig.mix, startTime);

                lastNode.connect(dryGain);
                dryGain.connect(finalDestination);
                lastNode.connect(wetGain);
                wetGain.connect(convolver);
                convolver.connect(finalDestination);
            } else {
                 lastNode.connect(finalDestination);
            }
        } else {
            lastNode.connect(finalDestination);
        }

        // 再生と停止
        osc.start(startTime);
        osc.stop(startTime + releaseTime);
    };

    // 1音目 (ピン)
    const freq1 = oscConfig.frequency; // G5 from config
    playNote(freq1, now);

    // 2音目 (ポン) - 少し間をあけて、少し低い音
    const freq2 = 659.25; // E5
    const delayBetweenNotes = 0.25; // ピンとポンの間の時間
    playNote(freq2, now + delayBetweenNotes);
    
    if (typeof startVisualizer === 'function') startVisualizer();
}

// playHornSound は削除され、汎用の playCorrectAnswer で処理される

function playCorrectAnswer() {
    console.log('playCorrectAnswer called');
    console.log('audioContext:', audioContext);
    // オブジェクトが大きすぎる可能性があるため、必要な情報のみログに出力
    console.log('correctAnswer soundType:', correctAnswer?.soundType);
    console.log('correctAnswer modulesConfig length:', correctAnswer?.modulesConfig?.length);

    if (!audioContext || !correctAnswer.modulesConfig || correctAnswer.modulesConfig.length === 0) {
        console.error("正解を再生できません: オーディオコンテキストまたは設定がありません。");
        alert("正解を再生できません。先にオーディオを開始してください。");
        return;
    }

    // ドアチャイム専用の再生ロジック (複数のノートを順次再生するため)
    if (correctAnswer.soundType === 'doorbell') {
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
        correctAnswer.modulesConfig.forEach((moduleConfig, index) => {
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
        if (!correctAnswer.connectionsConfig) {
            console.error('connectionsConfig is missing!');
            console.log('correctAnswer structure:', correctAnswer);
            console.log('Available properties:', Object.keys(correctAnswer));
            
            // フォールバック: 基本的な線形接続を生成
            const audioModules = correctAnswer.modulesConfig.filter(m => m.type !== 'lfo' && m.type !== 'pattern');
            const fallbackConnections = [];
            
            // 基本的なオーディオチェーン
            for (let i = 0; i < audioModules.length - 1; i++) {
                const sourceIndex = correctAnswer.modulesConfig.indexOf(audioModules[i]);
                const targetIndex = correctAnswer.modulesConfig.indexOf(audioModules[i + 1]);
                fallbackConnections.push({ source: sourceIndex, target: targetIndex });
            }
            
            // 最後をoutputに接続
            if (audioModules.length > 0) {
                const lastIndex = correctAnswer.modulesConfig.indexOf(audioModules[audioModules.length - 1]);
                fallbackConnections.push({ source: lastIndex, target: 'output' });
            }
            
            // LFO/Pattern接続
            correctAnswer.modulesConfig.forEach((moduleConfig, index) => {
                if ((moduleConfig.type === 'lfo' || moduleConfig.type === 'pattern') && moduleConfig.modulationTarget) {
                    fallbackConnections.push({
                        source: index,
                        target: moduleConfig.modulationTarget.moduleId,
                        param: moduleConfig.modulationTarget.paramName
                    });
                }
            });
            
            console.log('Generated fallback connections:', fallbackConnections);
            correctAnswer.connectionsConfig = fallbackConnections;
        }

        console.log('[playCorrectAnswer] Processing connections:', correctAnswer.connectionsConfig);
        correctAnswer.connectionsConfig.forEach((conn, index) => {
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
                        // 接続後にstart()を呼んでパターンを開始
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

                    if (targetParamName) { // パラメータ接続
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

        // 3. オシレーターとLFOを開始
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
    const correctModulesConfig = correctAnswer.modulesConfig;
    const correctConnectionsConfig = correctAnswer.connectionsConfig;

    if (!correctModulesConfig || !correctConnectionsConfig) {
        alert('エラー: 正解データがありません。リセットしてください。');
        return;
    }

    // --- 正解モジュールをワークスペースに表示 ---
    const correctAnswerModules = []; // 表示された正解モジュールを格納
    const workspaceRect = workspace.getBoundingClientRect();
    const startY = workspaceRect.height / 2 + 60; 
    const startX = 50;
    const moduleWidth = 150;
    const moduleSpacing = 20;

    // 1. 正解用のOutputモジュールを先に作成・配置
    // X座標は、モジュールの数に応じて動的に決定
    const maxModulesInRow = 5;
    const outputX = startX + (Math.min(correctModulesConfig.length, maxModulesInRow)) * (moduleWidth + moduleSpacing);
    const correctAnswerOutputModule = createModule('output', outputX, startY, true);
    if (correctAnswerOutputModule) {
        correctAnswerModules.push(correctAnswerOutputModule);
    }

    // 2. correctAnswerModulesに、設定に基づいたモジュールを追加
    correctModulesConfig.forEach((config, index) => {
        let moduleX = startX + (index % maxModulesInRow) * (moduleWidth + moduleSpacing);
        let moduleY = startY + Math.floor(index / maxModulesInRow) * 120;

        // クラクションのレイアウトを特別扱いして見やすくする
        if (window.location.href.includes('challenge_mode_horn.html')) {
            if (index === 0) { moduleX = startX; moduleY = startY - 60; } // Osc 1
            if (index === 1) { moduleX = startX; moduleY = startY + 60; } // Osc 2
            if (index === 2) { moduleX = startX + moduleWidth + moduleSpacing; moduleY = startY; } // Filter
            if (index === 3) { moduleX = startX + 2 * (moduleWidth + moduleSpacing); moduleY = startY; } // Gain
            if (index === 4) { moduleX = startX + 2 * (moduleWidth + moduleSpacing); moduleY = startY + 120; } // Pattern
            // Outputモジュールの位置も調整
            if (correctAnswerOutputModule) {
                 correctAnswerOutputModule.domElement.style.left = `${startX + 3 * (moduleWidth + moduleSpacing)}px`;
                 correctAnswerOutputModule.domElement.style.top = `${startY}px`;
            }
        }

        const newModule = createModule(config.type, moduleX, moduleY, true);
        if (newModule) {
            newModule.setParams(config.params);
            newModule.originalIndex = index; // 照合のため元のインデックスを保持
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
                } else if (typeof correctValue === 'number') {
                    let tolerance = 0.1;
                    if (['frequency', 'detune', 'amount', 'q', 'repeat'].includes(paramName)) tolerance = correctValue * 0.1; // 10%の誤差を許容
                    isMatch = Math.abs(userValue - correctValue) <= Math.max(tolerance, 2); // 最低でも2の誤差は許容
                }
                if (isMatch) {
                    score += paramMatchBonus;
                    explanation += `  - ${paramName}: 一致 (+${paramMatchBonus}点)\n`;
                } else {
                    allParamsMatch = false;
                    explanation += `  - ${paramName}: 不一致 (正解: ${correctValue}, あなた: ${userValue})\n`;
                }
            }
            if (allParamsMatch) {
                userModule.domElement.style.border = '2px solid #2ecc71'; // Green
            } else {
                userModule.domElement.style.border = '2px solid #f1c40f'; // Yellow
            }
        } else {
            userModule.domElement.style.border = '2px solid #e74c3c'; // Red
            score += modulePresencePenalty;
            explanation += `[余分] ${userModule.name} (${userModule.type}) (${modulePresencePenalty}点)\n`;
        }
    });

    // 3. 不足しているモジュールを評価
    correctModulesConfig.forEach((config, i) => {
        if (!matchedCorrectConfigs.has(i)) {
            correctAnswerModules[i].domElement.style.border = '2px solid #e74c3c';
            score += modulePresencePenalty;
            explanation += `[不足] 正解の ${config.type} がありません (${modulePresencePenalty}点)\n`;
        }
    });

    // 4. 接続を評価
    const userConnections = connections;
    const matchedUserConnections = new Set();
    let correctConnectionsFound = 0;

    const correctIndexToUserModuleMap = new Map();
    correctModulesConfig.forEach((config, index) => {
        if (correctToUserMap.has(config)) {
            correctIndexToUserModuleMap.set(index, correctToUserMap.get(config));
        }
    });

    correctConnectionsConfig.forEach(correctConn => {
        const sourceUserModule = correctIndexToUserModuleMap.get(correctConn.source);
        const targetIsOutput = correctConn.target === 'output';
        const targetUserModule = targetIsOutput ? null : correctIndexToUserModuleMap.get(correctConn.target);

        let connectionFound = false;
        if (sourceUserModule && (targetUserModule || targetIsOutput)) {
            const foundUserConn = userConnections.find(userConn => {
                if (userConn.sourceId !== sourceUserModule.id) return false;
                if (userConn.param !== correctConn.param) return false;
                const userTargetModule = getModuleById(userConn.targetId);
                if (!userTargetModule) return false;
                if (targetIsOutput) return userTargetModule.type === 'output';
                return userTargetModule.id === targetUserModule.id;
            });

            if (foundUserConn) {
                connectionFound = true;
                correctConnectionsFound++;
                matchedUserConnections.add(foundUserConn);
            }
        }

        if (connectionFound) {
            explanation += `[接続OK] ${correctModulesConfig[correctConn.source].type} -> ${targetIsOutput ? 'output' : correctModulesConfig[correctConn.target].type} (+${connectionBonus}点)\n`;
        } else {
            explanation += `[接続なし] 正解の ${correctModulesConfig[correctConn.source].type} -> ${targetIsOutput ? 'output' : correctModulesConfig[correctConn.target].type} の接続がありません\n`;
        }
    });

    score += correctConnectionsFound * connectionBonus;

    const extraConnections = userConnections.filter(conn => !matchedUserConnections.has(conn));
    if (extraConnections.length > 0) {
        score -= extraConnections.length * 5; // Penalty
        explanation += `[余分な接続] ${extraConnections.length}個の余分な接続があります (-${extraConnections.length * 5}点)\n`;
    }

    // --- 最終スコア表示 ---
    score = Math.max(0, Math.min(score, maxScore));
    alert(`スコア: ${Math.round(score)} / ${maxScore}\n\n--- 詳細 ---\n${explanation}`);
}

function displayCorrectAnswerDetails() {
    // 必要に応じて実装
}

function showHint1() {
    const hintDisplay = document.getElementById('hint-display');
    if (!hintDisplay || !correctAnswer || !correctAnswer.modulesConfig) return;

    const moduleCount = correctAnswer.modulesConfig.length;
    hintDisplay.innerHTML = `<p>正解のモジュール数は <strong>${moduleCount}</strong> 個です。(Outputを除く)</p>`;
}

function showHint2() {
    const hintDisplay = document.getElementById('hint-display');
    if (!hintDisplay || !correctAnswer || !correctAnswer.modulesConfig) return;

    const moduleTypes = correctAnswer.modulesConfig.map(m => m.type);
    // シャッフルして順番をわからなくする
    for (let i = moduleTypes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [moduleTypes[i], moduleTypes[j]] = [moduleTypes[j], moduleTypes[i]];
    }
    
    hintDisplay.innerHTML = `<p>使用されているモジュールの種類は...<br><strong>${moduleTypes.join(', ')}</strong> です。</p><p class="text-xs text-gray-500">(順不同)</p>`;
}
