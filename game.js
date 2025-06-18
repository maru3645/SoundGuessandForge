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
                    gain: parseFloat((Math.random() * (0.8 - 0.1) + 0.1).toFixed(2))
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
        }
        correctAnswer.modulesConfig.push({ type: type, params: params });
    });
    console.log('新しい正解 (modulesConfig):', JSON.parse(JSON.stringify(correctAnswer.modulesConfig)));
}

function playCorrectAnswer() {
    let tempAudioNodes = [];
    let lastConnectedNode = null;
    if (!audioContext || !correctAnswer.modulesConfig || correctAnswer.modulesConfig.length === 0) {
        console.error("正解を再生できません: オーディオコンテキストまたは設定がありません。");
        return;
    }
    try {
        correctAnswer.modulesConfig.forEach(moduleConfig => {
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
            lastConnectedNode.connect(audioContext.destination);
        }
        setTimeout(() => {
            tempAudioNodes.forEach(item => {
                if (item.type === 'oscillator' && item.node.stop) {
                    try { item.node.stop(audioContext.currentTime); } catch (e) {}
                }
                try { item.node.disconnect(); } catch (e) {}
            });
        }, 2000);
    } catch (error) {
        console.error("正解の再生中にエラーが発生しました:", error);
        tempAudioNodes.forEach(item => {
            if (item.type === 'oscillator' && item.node.stop) {
                try { item.node.stop(audioContext.currentTime); } catch (e) {}
            }
            try { item.node.disconnect(); } catch (e) {}
        });
    }
}

function checkAnswer() {
    console.log('checkAnswer関数が呼ばれました。現在のcorrectAnswer:', correctAnswer);
    console.log('correctAnswer.modulesConfig:', correctAnswer.modulesConfig);
    
    let score = 0;
    let explanation = '';
    const maxScore = 100;
    const paramMatchBonus = 5;
    const typeMatchBonus = 10;
    const modulePresencePenalty = -15;
    const userModulesSorted = modules.filter(m => m.type !== 'output').sort((a, b) => a.id - b.id);
    const correctModulesConfig = correctAnswer.modulesConfig;
    
    if (!correctModulesConfig || correctModulesConfig.length === 0) {
        explanation += '正解データが生成されていません。リセットボタンを押してください。\n';
        alert(`エラー: ${explanation}`);
        return;
    }
    
    explanation += `正解のモジュール構成: ${correctModulesConfig.map(cm => cm.type).join(' -> ')}\n`;
    explanation += `あなたのモジュール構成: ${userModulesSorted.map(um => um.type).join(' -> ')}\n\n`;
    if (userModulesSorted.length === correctModulesConfig.length) {
        score += 10;
        explanation += "モジュールの数は正解と一致しています。\n";
    } else {
        explanation += `モジュールの数が異なります。正解: ${correctModulesConfig.length}, あなた: ${userModulesSorted.length}\n`;
        score += (correctModulesConfig.length - Math.abs(correctModulesConfig.length - userModulesSorted.length)) / correctModulesConfig.length * 10;
    }
    correctModulesConfig.forEach((correctModule, cIdx) => {
        explanation += `\n正解モジュール ${cIdx + 1}: ${correctModule.type}\n`;
        const userModule = userModulesSorted.find(um => um.type === correctModule.type && !um.alreadyChecked);
        if (userModule) {
            userModule.alreadyChecked = true;
            score += typeMatchBonus;
            explanation += `  あなたの対応するモジュール: ${userModule.name} (タイプ一致: +${typeMatchBonus}点)\n`;
            let moduleParamScore = 0;
            let correctParamsCount = 0;
            let checkedParamsCount = 0;
            for (const paramName in correctModule.params) {
                checkedParamsCount++;
                if (userModule.params.hasOwnProperty(paramName)) {
                    let isMatch = false;
                    if (typeof correctModule.params[paramName] === 'string') {
                        isMatch = userModule.params[paramName] === correctModule.params[paramName];
                    } else if (typeof correctModule.params[paramName] === 'number') {
                        let tolerance = 0.1;
                        if (paramName === 'frequency') tolerance = 10;
                        if (paramName === 'detune') tolerance = 5;
                        isMatch = Math.abs(userModule.params[paramName] - correctModule.params[paramName]) <= tolerance;
                    }

                    if (isMatch) {
                        moduleParamScore += paramMatchBonus;
                        correctParamsCount++;
                        explanation += `    ${paramName} 一致: +${paramMatchBonus}点\n`;
                    } else {
                        explanation += `    ${paramName} 不一致 (正解: ${correctModule.params[paramName]}, あなた: ${userModule.params[paramName]})\n`;
                    }
                } else {
                    explanation += `    ${paramName} が見つかりません\n`;
                }
            }
            score += moduleParamScore;
            if (checkedParamsCount > 0 && correctParamsCount === checkedParamsCount) {
                score += 5;
                explanation += `  全パラメータ一致ボーナス: +5点\n`;
            }
        } else {
            explanation += `  正解の ${correctModule.type} モジュールがあなたの構成に見つかりません。(ペナルティ適用の場合あり)\n`;
            score += modulePresencePenalty;
        }
    });
    userModulesSorted.filter(um => !um.alreadyChecked).forEach(extraUserModule => {
        explanation += `\n余分なモジュール: ${extraUserModule.name} (${extraUserModule.type}) (ペナルティ適用の場合あり)\n`;
        score += modulePresencePenalty;
    });
    score = Math.max(0, Math.min(score, maxScore));
    modules.forEach(m => m.alreadyChecked = false);
    alert(`スコア: ${Math.round(score)}/${maxScore}\n\n詳細:\n${explanation}`);
}

function displayCorrectAnswerDetails() {
    // 必要に応じて実装
}
