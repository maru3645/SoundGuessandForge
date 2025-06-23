// game.js
// 正解生成・答え合わせ・正解音再生・スコア計算など

// main.jsで定義されたグローバル変数correctAnswerを必ず参照する
// ここで再定義しないこと！

function generateRandomCorrectAnswer() {
    if (!window.correctAnswer) window.correctAnswer = { modulesConfig: [] };
    correctAnswer.modulesConfig = [];
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

    // LFOモジュレーションを追加
    if (Math.random() < 0.5) { // 50%の確率でLFOを追加
        const lfoParams = {
            type: ['sine', 'square', 'sawtooth', 'triangle'][Math.floor(Math.random() * 4)],
            frequency: parseFloat((Math.random() * (10 - 0.5) + 0.5).toFixed(1)),
            amount: Math.floor(Math.random() * (800 - 50 + 1)) + 50
        };

        const modulatableModules = correctAnswer.modulesConfig.filter(m => ['oscillator', 'filter', 'gain', 'delay'].includes(m.type));
        if (modulatableModules.length > 0) {
            const targetModule = modulatableModules[Math.floor(Math.random() * modulatableModules.length)];
            let targetParam = 'frequency'; // デフォルト
            if (targetModule.type === 'gain') targetParam = 'gain';
            if (targetModule.type === 'delay') targetParam = 'delayTime';
            
            correctAnswer.modulesConfig.push({
                type: 'lfo',
                params: lfoParams,
                modulationTarget: { type: targetModule.type, param: targetParam }
            });
        }
    }

    console.log('新しい正解 (modulesConfig):', JSON.parse(JSON.stringify(correctAnswer.modulesConfig)));
}

function playCorrectAnswer() {
    let tempAudioNodes = [];
    let lastConnectedNode = null;
    if (!audioContext || !correctAnswer.modulesConfig || correctAnswer.modulesConfig.length === 0) {
        console.error("正解を再生できません: オーディオコンテキストまたは設定がありません。");
        return;
    }
    // initVisualizerはメインのオーディオ開始時に一度だけ呼ぶべきなので、ここでは呼ばない。
    if (typeof startVisualizer === 'function') startVisualizer();

    try {
        // ビジュアライザが有効ならそちらへ、なければ直接destinationへ接続
        const finalDestination = analyserNode || audioContext.destination;

        const chainModules = correctAnswer.modulesConfig.filter(c => c.type !== 'lfo');
        const lfoModules = correctAnswer.modulesConfig.filter(c => c.type === 'lfo');

        chainModules.forEach(moduleConfig => {
            let currentNode = null;
            let inputNode = null; // Delayのような内部ルーティングを持つモジュール用

            switch (moduleConfig.type) {
                case 'oscillator':
                    const osc = audioContext.createOscillator();
                    osc.type = moduleConfig.params.type;
                    osc.frequency.setValueAtTime(moduleConfig.params.frequency, audioContext.currentTime);
                    if (moduleConfig.params.detune !== undefined) {
                        osc.detune.setValueAtTime(moduleConfig.params.detune, audioContext.currentTime);
                    }
                    osc.start(audioContext.currentTime);
                    currentNode = osc;
                    break;
                case 'filter':
                    const filter = audioContext.createBiquadFilter();
                    filter.type = moduleConfig.params.type;
                    filter.frequency.setValueAtTime(moduleConfig.params.frequency, audioContext.currentTime);
                    if (moduleConfig.params.q !== undefined) {
                        filter.Q.setValueAtTime(moduleConfig.params.q, audioContext.currentTime);
                    }
                    currentNode = filter;
                    inputNode = filter;
                    break;
                case 'delay':
                    const delay = audioContext.createDelay(1.0); // 最大遅延時間1秒
                    const feedback = audioContext.createGain();
                    delay.delayTime.setValueAtTime(moduleConfig.params.delayTime, audioContext.currentTime);
                    feedback.gain.setValueAtTime(moduleConfig.params.feedback, audioContext.currentTime);
                    
                    delay.connect(feedback);
                    feedback.connect(delay);

                    currentNode = delay;
                    inputNode = delay;
                    tempAudioNodes.push({type: 'feedback', node: feedback});
                    break;
                case 'gain':
                    const gain = audioContext.createGain();
                    gain.gain.setValueAtTime(moduleConfig.params.gain, audioContext.currentTime);
                    currentNode = gain;
                    inputNode = gain;
                    break;
                case 'reverb':
                    const reverbInput = audioContext.createGain();
                    const reverbWet = audioContext.createGain();
                    const reverbDry = audioContext.createGain();
                    const reverbConvolver = audioContext.createConvolver();
                    const reverbOutput = audioContext.createGain();

                    const rate = audioContext.sampleRate;
                    const time = moduleConfig.params.time;
                    const length = Math.max(1, rate * time);
                    const impulse = audioContext.createBuffer(2, length, rate);
                    const impulseL = impulse.getChannelData(0);
                    const impulseR = impulse.getChannelData(1);
                    const decay = time > 0 ? Math.max(1, time) : 1;
                    for (let i = 0; i < length; i++) {
                        const n = length - i;
                        impulseL[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
                        impulseR[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
                    }
                    reverbConvolver.buffer = impulse;

                    const mix = moduleConfig.params.mix;
                    reverbDry.gain.setValueAtTime(1 - mix, audioContext.currentTime);
                    reverbWet.gain.setValueAtTime(mix, audioContext.currentTime);

                    reverbInput.connect(reverbDry);
                    reverbDry.connect(reverbOutput);
                    reverbInput.connect(reverbConvolver);
                    reverbConvolver.connect(reverbWet);
                    reverbWet.connect(reverbOutput);
                    
                    currentNode = reverbOutput;
                    inputNode = reverbInput;
                    
                    tempAudioNodes.push({type: 'reverb_wet', node: reverbWet});
                    tempAudioNodes.push({type: 'reverb_dry', node: reverbDry});
                    tempAudioNodes.push({type: 'reverb_convolver', node: reverbConvolver});
                    tempAudioNodes.push({type: 'reverb_input', node: reverbInput});
                    break;
            }

            if (currentNode) {
                if (lastConnectedNode && inputNode) {
                    lastConnectedNode.connect(inputNode);
                }
                lastConnectedNode = currentNode;
                tempAudioNodes.push({type: moduleConfig.type, node: currentNode});
            }
        });
        if (lastConnectedNode) {
            lastConnectedNode.connect(finalDestination);
        }

        // LFOを接続
        lfoModules.forEach(lfoConfig => {
            const lfo = audioContext.createOscillator();
            const lfoGain = audioContext.createGain();
            lfo.type = lfoConfig.params.type;
            lfo.frequency.setValueAtTime(lfoConfig.params.frequency, audioContext.currentTime);
            lfoGain.gain.setValueAtTime(lfoConfig.params.amount, audioContext.currentTime);
            lfo.connect(lfoGain);
            lfo.start(audioContext.currentTime);
            tempAudioNodes.push({type: 'lfo', node: lfo});
            tempAudioNodes.push({type: 'lfo_gain', node: lfoGain});

            const targetType = lfoConfig.modulationTarget.type;
            const targetParamName = lfoConfig.modulationTarget.param;
            const targetNodeItem = tempAudioNodes.find(item => item.type === targetType);

            if (targetNodeItem) {
                let targetAudioParam;
                if (targetType === 'delay' && targetParamName === 'feedback') {
                    const feedbackNodeItem = tempAudioNodes.find(item => item.type === 'feedback');
                    if (feedbackNodeItem) targetAudioParam = feedbackNodeItem.node.gain;
                } else if (targetType === 'reverb' && targetParamName === 'mix') {
                    const wetNodeItem = tempAudioNodes.find(item => item.type === 'reverb_wet');
                    if (wetNodeItem) targetAudioParam = wetNodeItem.node.gain;
                } else {
                    targetAudioParam = targetNodeItem.node[targetParamName];
                }

                if (targetAudioParam instanceof AudioParam) {
                    lfoGain.connect(targetAudioParam);
                }
            }
        });

        setTimeout(() => {
            tempAudioNodes.forEach(item => {
                if (item.type === 'oscillator' && item.node.stop) {
                    try { item.node.stop(audioContext.currentTime); } catch (e) {}
                }
                try { item.node.disconnect(); } catch (e) {}
            });
            // --- ここから追加 ---
            if (typeof stopVisualizer === 'function') stopVisualizer();
            // --- ここまで追加 ---
        }, 2000);
    } catch (error) {
        console.error("正解の再生中にエラーが発生しました:", error);
        tempAudioNodes.forEach(item => {
            if (item.type === 'oscillator' && item.node.stop) {
                try { item.node.stop(audioContext.currentTime); } catch (e) {}
            }
            try { item.node.disconnect(); } catch (e) {}
        });
        // --- ここから追加 ---
        if (typeof stopVisualizer === 'function') stopVisualizer();
        // --- ここまで追加 ---
    }
}

function checkAnswer() {
    // 以前の正解表示とハイライトをクリア
    modules.filter(m => m.isCorrectAnswerModule).forEach(m => m.destroy());
    modules.filter(m => !m.isCorrectAnswerModule).forEach(m => {
        m.domElement.style.border = '1px solid #ccc';
        m.domElement.style.borderColor = '#ccc'; // selectModuleでの選択色もリセット
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

    if (!correctModulesConfig || correctModulesConfig.length === 0) {
        alert('エラー: 正解データがありません。リセットしてください。');
        return;
    }

    // --- 正解モジュールをワークスペースに表示 ---
    const correctAnswerModules = [];
    const workspaceRect = workspace.getBoundingClientRect();
    const startY = workspaceRect.height / 2 + 60;
    const startX = 50;
    const moduleWidth = 150;
    const moduleSpacing = 20;

    const correctChainModules = correctModulesConfig.filter(c => c.type !== 'lfo');
    const correctLfoModules = correctModulesConfig.filter(c => c.type === 'lfo');
    const userChainModules = userModules.filter(m => m.type !== 'lfo');
    const userLfoModules = userModules.filter(m => m.type === 'lfo');

    correctChainModules.forEach((moduleConfig, index) => {
        const x = startX + index * (moduleWidth + moduleSpacing);
        const y = startY;
        const correctModule = createModule(moduleConfig.type, x, y, true);
        correctModule.params = { ...moduleConfig.params };
        correctModule.updateParams();
        correctAnswerModules.push(correctModule);
    });

    const correctOutputModule = createModule('output', startX + correctChainModules.length * (moduleWidth + moduleSpacing), startY, true);
    
    for (let i = 0; i < correctAnswerModules.length - 1; i++) {
        // visualOnlyをtrueにして、音声接続を行わないようにする
        connectModules(correctAnswerModules[i], correctAnswerModules[i + 1], null, true);
    }
    if (correctAnswerModules.length > 0) {
        // visualOnlyをtrueにして、音声接続を行わないようにする
        connectModules(correctAnswerModules[correctAnswerModules.length - 1], correctOutputModule, null, true);
    }
    // LFOとターゲットの接続も表示
    correctLfoModules.forEach((lfoConfig, index) => {
        const x = startX + index * (moduleWidth + moduleSpacing);
        const y = startY + 120; // LFOは下に表示
        const correctLfoModule = createModule(lfoConfig.type, x, y, true);
        correctLfoModule.params = { ...lfoConfig.params };
        correctLfoModule.updateParams();
        
        const targetModule = correctAnswerModules.find(m => m.type === lfoConfig.modulationTarget.type);
        if (targetModule) {
            connectModules(correctLfoModule, targetModule, lfoConfig.modulationTarget.param, true);
        }
    });

    updateConnectionsSVG();
    // --- 表示完了 ---

    explanation += `正解(Audio): ${correctChainModules.map(c => c.type).join(' -> ')}\n`;
    explanation += `あなた(Audio): ${userChainModules.map(u => u.type).join(' -> ') || '(モジュールなし)'}\n`;
    if (correctLfoModules.length > 0) {
        explanation += `正解(Mod): ${correctLfoModules.map(c => `LFO -> ${c.modulationTarget.type}.${c.modulationTarget.param}`).join(', ')}\n`;
    }
    explanation += '\n';


    const matchedCorrectIndices = new Set();

    userChainModules.forEach(userModule => {
        let foundMatch = false;
        for (let i = 0; i < correctChainModules.length; i++) {
            if (matchedCorrectIndices.has(i)) continue;

            const correctConfig = correctChainModules[i];
            if (userModule.type === correctConfig.type) {
                matchedCorrectIndices.add(i);
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
                        if (paramName === 'frequency') tolerance = 20;
                        if (paramName === 'detune') tolerance = 10;
                        if (paramName === 'q') tolerance = 0.5;
                        isMatch = Math.abs(userValue - correctValue) <= tolerance;
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
                    score += 5; // 全パラメータ一致ボーナス
                    explanation += `  -> 全パラメータ一致ボーナス! (+5点)\n`;
                } else {
                    userModule.domElement.style.border = '2px solid #f1c40f'; // Yellow
                }
                foundMatch = true;
                break;
            }
        }
        if (!foundMatch) {
            userModule.domElement.style.border = '2px solid #e74c3c'; // Red
            score += modulePresencePenalty;
            explanation += `[余分] ${userModule.name} (${userModule.type}) (${modulePresencePenalty}点)\n`;
        }
    });

    correctChainModules.forEach((correctConfig, i) => {
        if (!matchedCorrectIndices.has(i)) {
            correctAnswerModules[i].domElement.style.border = '2px solid #e74c3c'; // Red
            score += modulePresencePenalty;
            explanation += `[不足] 正解の ${correctConfig.type} がありません (${modulePresencePenalty}点)\n`;
        }
    });

    // LFOのチェック
    const matchedCorrectLfoIndices = new Set();
    const matchedUserLfoIndices = new Set();

    userLfoModules.forEach((userLfo, userIndex) => {
        const conn = connections.find(c => c.sourceId === userLfo.id);
        if (!conn) {
            explanation += `[接続なし] ${userLfo.name} はどこにも接続されていません。\n`;
            return;
        }
        const targetModule = getModuleById(conn.targetId);
        if (!targetModule) return;

        let foundMatch = false;
        for (let i = 0; i < correctLfoModules.length; i++) {
            if (matchedCorrectLfoIndices.has(i)) continue;
            const correctLfo = correctLfoModules[i];

            if (targetModule.type === correctLfo.modulationTarget.type && conn.param === correctLfo.modulationTarget.param) {
                matchedCorrectLfoIndices.add(i);
                matchedUserLfoIndices.add(userIndex);
                foundMatch = true;

                score += typeMatchBonus + connectionBonus;
                explanation += `[一致] ${userLfo.name} -> ${targetModule.type}.${conn.param} (+${typeMatchBonus + connectionBonus}点)\n`;

                // パラメータチェック
                let allParamsMatch = true;
                for (const paramName in correctLfo.params) {
                    let isMatch = false;
                    const userValue = userLfo.params[paramName];
                    const correctValue = correctLfo.params[paramName];
                    if (typeof correctValue === 'string') {
                        isMatch = userValue === correctValue;
                    } else if (typeof correctValue === 'number') {
                        let tolerance = paramName === 'frequency' ? 2 : 50;
                        isMatch = Math.abs(userValue - correctValue) <= tolerance;
                    }
                    if (isMatch) {
                        score += paramMatchBonus;
                        explanation += `  - ${paramName}: 一致 (+${paramMatchBonus}点)\n`;
                    } else {
                        allParamsMatch = false;
                        explanation += `  - ${paramName}: 不一致 (正解: ${correctValue}, あなた: ${userValue})\n`;
                    }
                }
                if (allParamsMatch) userLfo.domElement.style.border = '2px solid #2ecc71';
                else userLfo.domElement.style.border = '2px solid #f1c40f';
                
                break; // next userLfo
            }
        }
        if (!foundMatch) {
            userLfo.domElement.style.border = '2px solid #e74c3c';
            score += modulePresencePenalty;
            explanation += `[不正な接続] ${userLfo.name} -> ${targetModule.type}.${conn.param} (${modulePresencePenalty}点)\n`;
        }
    });

    correctLfoModules.forEach((correctLfo, i) => {
        if (!matchedCorrectLfoIndices.has(i)) {
            score += modulePresencePenalty;
            explanation += `[不足] 正解の LFO -> ${correctLfo.modulationTarget.type}.${correctLfo.modulationTarget.param} がありません (${modulePresencePenalty}点)\n`;
        }
    });


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
