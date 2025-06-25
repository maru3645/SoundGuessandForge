// modules.js
// 各モジュールクラス定義

class AudioModule {
    constructor(type, x, y, namePrefix = '', isCorrectAnswerModule = false) {
        this.id = nextModuleId++;
        this.type = type;
        this.name = `${namePrefix}${type.charAt(0).toUpperCase() + type.slice(1)} #${this.id}`;
        this.audioNode = null;
        this.connections = [];
        this.isCorrectAnswerModule = isCorrectAnswerModule;

        this.domElement = document.createElement('div');
        this.domElement.className = 'module';
        if (this.isCorrectAnswerModule) {
            this.domElement.classList.add('correct-answer-module');
        }
        this.domElement.id = `module-${this.id}`;
        this.domElement.style.left = `${x}px`;
        this.domElement.style.top = `${y}px`;
        const title = document.createElement('div');
        title.className = 'module-title';
        title.textContent = this.name;
        this.domElement.appendChild(title);
        this.paramContainer = document.createElement('div');
        this.domElement.appendChild(this.paramContainer);

        if (!this.isCorrectAnswerModule) {
            this.domElement.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('io-node')) return;
                draggingModule = this;
                const rect = this.domElement.getBoundingClientRect();
                dragOffsetX = e.clientX - rect.left;
                dragOffsetY = e.clientY - rect.top;
                this.domElement.style.cursor = 'grabbing';
                this.domElement.style.zIndex = 1000;
            });
        }
        this.domElement.addEventListener('click', (e) => {
            if (e.target.classList.contains('io-node')) return;
            selectModule(this);
        });
        this.createInputNodeDOM();
        this.createOutputNodeDOM();
    }
    initAudioNode() {}
    getEditorHTML() { return ''; }
    updateParams() {}
    createInputNodeDOM() {
        if (this.type === 'oscillator' || this.type === 'lfo') return; // Oscillator/LFO has no audio input

        const inputNodeDOM = document.createElement('div');
        inputNodeDOM.className = 'io-node input-node';
        inputNodeDOM.dataset.moduleId = this.id;
        inputNodeDOM.dataset.nodeType = 'input';
        this.domElement.appendChild(inputNodeDOM);
        inputNodeDOM.addEventListener('mousedown', (e) => e.stopPropagation());
        inputNodeDOM.addEventListener('mouseup', (e) => {
            e.stopPropagation();
            if (this.isCorrectAnswerModule) return;
            if (drawingLine && lineStartNodeInfo && lineStartNodeInfo.connectionType === 'audio') {
                const sourceModule = getModuleById(lineStartNodeInfo.sourceModuleId);
                const targetModule = getModuleById(this.id);
                if (sourceModule && targetModule) {
                    connectModules(sourceModule, targetModule, null);
                }
            }
            stopDrawingLine();
        });
    }

    createParamInputNodeDOM(paramName, topPosition) {
        const paramNodeDOM = document.createElement('div');
        paramNodeDOM.className = 'io-node param-input-node';
        paramNodeDOM.style.top = topPosition;
        paramNodeDOM.dataset.moduleId = this.id;
        paramNodeDOM.dataset.paramName = paramName;
        this.domElement.appendChild(paramNodeDOM);
        paramNodeDOM.addEventListener('mousedown', (e) => e.stopPropagation());
        paramNodeDOM.addEventListener('mouseup', (e) => {
            e.stopPropagation();
            if (this.isCorrectAnswerModule) return;
            if (drawingLine && lineStartNodeInfo && lineStartNodeInfo.connectionType === 'param') {
                const sourceModule = getModuleById(lineStartNodeInfo.sourceModuleId);
                const targetModule = getModuleById(this.id);
                if (sourceModule && targetModule) {
                    connectModules(sourceModule, targetModule, paramName);
                }
            }
            stopDrawingLine();
        });
    }

    createOutputNodeDOM() {
        if (this.type === 'output') return; // Output has no output node

        const outputNodeDOM = document.createElement('div');
        outputNodeDOM.className = 'io-node output-node';
        outputNodeDOM.dataset.moduleId = this.id;
        outputNodeDOM.dataset.nodeType = 'output';
        this.domElement.appendChild(outputNodeDOM);
        outputNodeDOM.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            if (this.isCorrectAnswerModule) return;
            const connectionType = this.type === 'lfo' ? 'param' : 'audio';
            startDrawingLine(e, this.id, e.target, connectionType);
        });
    }
    connectTo(targetModule, targetParam = null) {
        if (!audioContext || !this.audioNode || !targetModule) return false;
        
        if (targetParam) { // Parameter connection
            const targetAudioParam = targetModule.getAudioParam(targetParam);
            if (targetAudioParam instanceof AudioParam) {
                try {
                    this.audioNode.connect(targetAudioParam);
                    return true;
                } catch (e) { console.error(`Failed to connect ${this.name} to ${targetModule.name}.${targetParam}`, e); return false; }
            }
        } else { // Audio connection
            if (targetModule.audioNode instanceof AudioNode) {
                try {
                    this.audioNode.connect(targetModule.audioNode);
                    return true;
                } catch (e) { console.error(`Failed to connect ${this.name} to ${targetModule.name}`, e); return false; }
            }
        }
        return false;
    }
    disconnectFrom(targetModule, targetParam = null) {
        if (!this.audioNode || !targetModule) return;
        try {
            if (targetParam) {
                const targetAudioParam = targetModule.getAudioParam(targetParam);
                if (targetAudioParam instanceof AudioParam) {
                    this.audioNode.disconnect(targetAudioParam);
                }
            } else if (targetModule.audioNode) {
                if (this.audioNode.disconnect && typeof this.audioNode.disconnect === 'function') {
                    this.audioNode.disconnect(targetModule.audioNode);
                }
            }
        } catch (error) {}
    }
    destroy() {
        // Disconnect all connections related to this module
        connections = connections.filter(c => {
            if (c.sourceId === this.id) {
                const target = getModuleById(c.targetId);
                if (target) this.disconnectFrom(target, c.param);
                return false; // remove connection
            }
            if (c.targetId === this.id) {
                const source = getModuleById(c.sourceId);
                if (source) source.disconnectFrom(this, c.param);
                return false; // remove connection
            }
            return true; // keep connection
        });

        if (this.audioNode) {
            if (this.type === 'oscillator' && this.audioNode.stop) {
                try { if(this.isPlaying) this.audioNode.stop(); } catch (e) {}
            }
            // LFOは常に再生されているため、destroy時にstopしない
            if (this.type === 'lfo' && this.lfoNode && this.lfoNode.stop) {
                 try { if(this.isPlaying) this.lfoNode.stop(); } catch (e) {}
            }
            try { this.audioNode.disconnect(); } catch (e) {}
        }
        if (this.domElement.parentElement) {
            this.domElement.parentElement.removeChild(this.domElement);
        }
        modules = modules.filter(m => m.id !== this.id);
        if (selectedModule === this) {
            selectedModule = null;
            clearParamEditor();
        }
        updateConnectionsSVG();
    }
    getAudioParam(paramName) {
        if (this.audioNode && this.audioNode[paramName] instanceof AudioParam) {
            return this.audioNode[paramName];
        }
        return null;
    }
    setParams(params) {
        // Generic setParams, subclasses should override for specific logic
        Object.assign(this.params, params);
        this.updateParams();
    }
}

class OscillatorModule extends AudioModule {
    constructor(x, y, isCorrectAnswerModule = false) {
        super('oscillator', x, y, 'Osc ', isCorrectAnswerModule);
        this.params = { type: 'sine', frequency: 440, detune: 0 };
        this.isPlaying = false;
        this.initAudioNode();
        this.updateParams();
        this.createParamInputNodeDOM('frequency', '75%');
    }
    initAudioNode() {
        if (!audioContext) return;
        if (this.audioNode) {
            try { if(this.isPlaying) this.audioNode.stop(); } catch(e) {}
            try { this.audioNode.disconnect(); } catch(e) {}
        }
        this.audioNode = audioContext.createOscillator();
        this.audioNode.type = this.params.type;
        this.audioNode.frequency.setValueAtTime(this.params.frequency, audioContext.currentTime);
        this.audioNode.detune.setValueAtTime(this.params.detune, audioContext.currentTime);
    }
    getEditorHTML() {
        if (this.isCorrectAnswerModule) {
            return `
                <div class="mb-2"><label class="param-label">Type: ${this.params.type}</label></div>
                <div class="mb-2"><label class="param-label">Frequency: ${this.params.frequency} Hz</label></div>
                <div class="mb-2"><label class="param-label">Detune: ${this.params.detune} Cents</label></div>
            `;
        }
        return `
            <div class="mb-2">
                <label class="param-label">Type:
                    <select id="osc-type-${this.id}" class="custom-select">
                        <option value="sine">sine</option>
                        <option value="square">square</option>
                        <option value="sawtooth">sawtooth</option>
                        <option value="triangle">triangle</option>
                    </select>
                </label>
            </div>
            <div class="mb-2">
                <label class="param-label">Frequency: <span id="freq-val-${this.id}">${this.params.frequency}</span> Hz
                    <input type="range" id="osc-freq-${this.id}" class="param-slider" min="20" max="2000" step="1" value="${this.params.frequency}">
                </label>
            </div>
            <div class="mb-2">
                <label class="param-label">Detune: <span id="detune-val-${this.id}">${this.params.detune}</span> Cents
                    <input type="range" id="osc-detune-${this.id}" class="param-slider" min="-100" max="100" step="1" value="${this.params.detune}">
                </label>
            </div>
        `;
    }
    updateParams() {
        if (!this.audioNode || !audioContext) return;
        this.audioNode.type = this.params.type;
        this.audioNode.frequency.value = this.params.frequency;
        this.audioNode.detune.value = this.params.detune;
    }
    setParams(params) {
        Object.assign(this.params, params);
        this.updateParams();
    }
}

class GainModule extends AudioModule {
    constructor(x, y, isCorrectAnswerModule = false) {
        super('gain', x, y, 'Gain ', isCorrectAnswerModule);
        this.params = { gain: 0.5 };
        this.externalControl = {}; // Track external control per parameter
        this.initAudioNode();
        this.updateParams();
        // Add a parameter input for the gain value
        this.createParamInputNodeDOM('gain', '75%');
    }
    initAudioNode() {
        if (!audioContext) return;
        if (this.audioNode) { try { this.audioNode.disconnect(); } catch(e) {} }
        this.audioNode = audioContext.createGain();
        this.audioNode.gain.setValueAtTime(this.params.gain, audioContext.currentTime);
    }
    getEditorHTML() {
        if (this.isCorrectAnswerModule) {
            return `<div class="mb-2"><label class="param-label">Gain: ${this.params.gain.toFixed(2)}</label></div>`;
        }
        return `
            <div class="mb-2">
                <label class="param-label">Gain: <span id="gain-val-${this.id}">${this.params.gain.toFixed(2)}</span>
                    <input type="range" id="gain-amount-${this.id}" class="param-slider" min="0" max="1" step="0.01" value="${this.params.gain}">
                </label>
            </div>
        `;
    }
    updateParams() {
        if (!this.audioNode || !audioContext) return;
        // 外部からパラメーター制御されている場合は直接値を設定しない
        if (!this.externalControl.gain) {
            this.audioNode.gain.value = this.params.gain;
        }
    }
    
    // 外部制御の設定/解除
    setExternalControl(paramName, isExternal) {
        this.externalControl[paramName] = isExternal;
        console.log(`[GainModule] External control for ${paramName}:`, isExternal);
        if (!isExternal) {
            // 外部制御が解除されたら、元の値に戻す
            this.updateParams();
        }
    }
    setParams(params) {
        Object.assign(this.params, params);
        this.updateParams();
    }
}

class FilterModule extends AudioModule {
    constructor(x, y, isCorrectAnswerModule = false) {
        super('filter', x, y, 'Filter ', isCorrectAnswerModule);
        this.params = { type: 'lowpass', frequency: 350, q: 1 };
        this.initAudioNode();
        this.updateParams();
        this.createParamInputNodeDOM('frequency', '75%');
    }
    initAudioNode() {
        if (!audioContext) return;
        if (this.audioNode) { try { this.audioNode.disconnect(); } catch(e) {} }
        this.audioNode = audioContext.createBiquadFilter();
        this.audioNode.type = this.params.type;
        this.audioNode.frequency.setValueAtTime(this.params.frequency, audioContext.currentTime);
        this.audioNode.Q.setValueAtTime(this.params.q, audioContext.currentTime);
    }
    getEditorHTML() {
        if (this.isCorrectAnswerModule) {
            return `
                <div class="mb-2"><label class="param-label">Type: ${this.params.type}</label></div>
                <div class="mb-2"><label class="param-label">Frequency: ${this.params.frequency} Hz</label></div>
                <div class="mb-2"><label class="param-label">Q: ${this.params.q.toFixed(2)}</label></div>
            `;
        }
        return `
            <div class="mb-2">
                <label class="param-label">Type:
                    <select id="filter-type-${this.id}" class="custom-select">
                        <option value="lowpass">lowpass</option>
                        <option value="highpass">highpass</option>
                        <option value="bandpass">bandpass</option>
                        <option value="notch">notch</option>
                        <option value="peaking">peaking</option>
                    </select>
                </label>
            </div>
            <div class="mb-2">
                <label class="param-label">Frequency: <span id="filter-freq-val-${this.id}">${this.params.frequency}</span> Hz
                    <input type="range" id="filter-freq-${this.id}" class="param-slider" min="20" max="10000" step="1" value="${this.params.frequency}">
                </label>
            </div>
            <div class="mb-2">
                <label class="param-label">Q: <span id="filter-q-val-${this.id}">${this.params.q.toFixed(2)}</span>
                    <input type="range" id="filter-q-${this.id}" class="param-slider" min="0.0001" max="20" step="0.01" value="${this.params.q}">
                </label>
            </div>
        `;
    }
    updateParams() {
        if (!this.audioNode || !audioContext) return;
        this.audioNode.type = this.params.type;
        this.audioNode.frequency.value = this.params.frequency;
        this.audioNode.Q.value = this.params.q;
    }
    setParams(params) {
        Object.assign(this.params, params);
        this.updateParams();
    }
}

class DelayModule extends AudioModule {
    constructor(x,y, isCorrectAnswerModule = false) {
        super('delay', x, y, 'Delay ', isCorrectAnswerModule);
        this.params = { delayTime: 0.3, feedback: 0.4 };
        this.feedbackNode = null;
        this.initAudioNode();
        this.updateParams();
        this.createParamInputNodeDOM('delayTime', '75%');
    }
    initAudioNode() {
        if (!audioContext) return;
        if (this.audioNode) {
            try { this.audioNode.disconnect(); } catch(e) {}
            if(this.feedbackNode) { try { this.feedbackNode.disconnect(); } catch(e) {} }
        }
        this.audioNode = audioContext.createDelay(5.0);
        this.feedbackNode = audioContext.createGain();
        this.audioNode.connect(this.feedbackNode);
        this.feedbackNode.connect(this.audioNode);
        this.audioNode.delayTime.setValueAtTime(this.params.delayTime, audioContext.currentTime);
        this.feedbackNode.gain.setValueAtTime(this.params.feedback, audioContext.currentTime);
    }
    getEditorHTML() {
        if (this.isCorrectAnswerModule) {
            return `
                <div class="mb-2"><label class="param-label">Delay Time: ${this.params.delayTime.toFixed(2)} s</label></div>
                <div class="mb-2"><label class="param-label">Feedback: ${this.params.feedback.toFixed(2)}</label></div>
            `;
        }
        return `
            <div class="mb-2">
                <label class="param-label">Delay Time: <span id="delay-time-val-${this.id}">${this.params.delayTime.toFixed(2)}</span> s
                    <input type="range" id="delay-time-${this.id}" class="param-slider" min="0" max="2" step="0.01" value="${this.params.delayTime}">
                </label>
            </div>
            <div class="mb-2">
                <label class="param-label">Feedback: <span id="delay-feedback-val-${this.id}">${this.params.feedback.toFixed(2)}</span>
                    <input type="range" id="delay-feedback-${this.id}" class="param-slider" min="0" max="1" step="0.01" value="${this.params.feedback}">
                </label>
            </div>
        `;
    }
    updateParams() {
        if (!this.audioNode || !this.feedbackNode || !audioContext) return;
        this.audioNode.delayTime.value = this.params.delayTime;
        this.feedbackNode.gain.value = this.params.feedback;
    }
    setParams(params) {
        Object.assign(this.params, params);
        this.updateParams();
    }
    connectTo(targetModule, targetParam = null) {
        if (!this.audioNode) return false;
        return super.connectTo(targetModule, targetParam);
    }
    getAudioParam(paramName) {
        if (paramName === 'delayTime' && this.audioNode) {
            return this.audioNode.delayTime;
        }
        if (paramName === 'feedback' && this.feedbackNode) {
            return this.feedbackNode.gain;
        }
        return super.getAudioParam(paramName);
    }
    connectInput(sourceModuleAudioNode) {
        if (!this.audioNode || !sourceModuleAudioNode) return false;
        try {
            sourceModuleAudioNode.connect(this.audioNode);
            return true;
        } catch (error) { return false; }
    }
    disconnectInput(sourceModuleAudioNode) {
        if (!this.audioNode || !this.feedbackNode || !sourceModuleAudioNode) return;
        try { sourceModuleAudioNode.disconnect(this.audioNode); } catch(e) {}
    }
}

class ReverbModule extends AudioModule {
    constructor(x, y, isCorrectAnswerModule = false) {
        super('reverb', x, y, 'Reverb ', isCorrectAnswerModule);
        this.params = { mix: 0.5, time: 1.5 };
        
        this.wetGain = null;
        this.dryGain = null;
        this.convolver = null;
        this.outputMix = null; // This will be the actual output node

        this.initAudioNode();
        this.updateParams();
        this.createParamInputNodeDOM('mix', '75%');
    }

    initAudioNode() {
        if (!audioContext) return;
        if (this.audioNode) { try { this.audioNode.disconnect(); } catch(e) {} }
        if (this.wetGain) { try { this.wetGain.disconnect(); } catch(e) {} }
        if (this.dryGain) { try { this.dryGain.disconnect(); } catch(e) {} }
        if (this.convolver) { try { this.convolver.disconnect(); } catch(e) {} }
        if (this.outputMix) { try { this.outputMix.disconnect(); } catch(e) {} }

        this.audioNode = audioContext.createGain();
        this.wetGain = audioContext.createGain();
        this.dryGain = audioContext.createGain();
        this.convolver = audioContext.createConvolver();
        this.outputMix = audioContext.createGain();

        this.audioNode.connect(this.dryGain);
        this.dryGain.connect(this.outputMix);
        this.audioNode.connect(this.convolver);
        this.convolver.connect(this.wetGain);
        this.wetGain.connect(this.outputMix);

        this.buildImpulse();
    }

    buildImpulse() {
        if (!audioContext || !this.convolver) return;
        const rate = audioContext.sampleRate;
        const length = Math.max(1, rate * this.params.time);
        const impulse = audioContext.createBuffer(2, length, rate);
        const impulseL = impulse.getChannelData(0);
        const impulseR = impulse.getChannelData(1);
        const decay = this.params.time > 0 ? Math.max(1, this.params.time) : 1;

        for (let i = 0; i < length; i++) {
            const n = length - i;
            impulseL[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
            impulseR[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
        }
        this.convolver.buffer = impulse;
    }

    updateParams() {
        if (!audioContext || !this.wetGain || !this.dryGain) return;
        this.dryGain.gain.setValueAtTime(1 - this.params.mix, audioContext.currentTime);
        this.wetGain.gain.setValueAtTime(this.params.mix, audioContext.currentTime);
        this.buildImpulse();
    }

    setParams(params) {
        Object.assign(this.params, params);
        this.updateParams();
    }

    getEditorHTML() {
        if (this.isCorrectAnswerModule) {
            return `
                <div class="mb-2"><label class="param-label">Mix: ${this.params.mix.toFixed(2)}</label></div>
                <div class="mb-2"><label class="param-label">Time: ${this.params.time.toFixed(2)} s</label></div>
            `;
        }
        return `
            <div class="mb-2">
                <label class="param-label">Mix (Wet): <span id="reverb-mix-val-${this.id}">${this.params.mix.toFixed(2)}</span>
                    <input type="range" id="reverb-mix-${this.id}" class="param-slider" min="0" max="1" step="0.01" value="${this.params.mix}">
                </label>
            </div>
            <div class="mb-2">
                <label class="param-label">Time: <span id="reverb-time-val-${this.id}">${this.params.time.toFixed(2)}</span> s
                    <input type="range" id="reverb-time-${this.id}" class="param-slider" min="0.1" max="4" step="0.1" value="${this.params.time}">
                </label>
            </div>
        `;
    }

    connectTo(targetModule, targetParam = null) {
        if (!this.outputMix || !targetModule || !targetModule.audioNode) return false;
        // Reverb can only connect to audio inputs, not params.
        if (targetParam) return false;

        if (targetModule.audioNode instanceof AudioNode) {
            try {
                this.outputMix.connect(targetModule.audioNode);
                return true;
            } catch (e) { 
                console.error(`Failed to connect ${this.name} to ${targetModule.name}`, e);
                return false; 
            }
        }
        return false;
    }

    disconnectFrom(targetModule, targetParam = null) {
        if (!this.outputMix || !targetModule || !targetModule.audioNode) return;
        if (targetParam) return;
        try {
            if (this.outputMix.disconnect && typeof this.outputMix.disconnect === 'function') {
                this.outputMix.disconnect(targetModule.audioNode);
            }
        } catch (error) {}
    }
    
    destroy() {
        if (this.audioNode) { try { this.audioNode.disconnect(); } catch(e) {} }
        if (this.wetGain) { try { this.wetGain.disconnect(); } catch(e) {} }
        if (this.dryGain) { try { this.dryGain.disconnect(); } catch(e) {} }
        if (this.convolver) { try { this.convolver.disconnect(); } catch(e) {} }
        if (this.outputMix) { try { this.outputMix.disconnect(); } catch(e) {} }
        super.destroy();
    }

    getAudioParam(paramName) {
        if (paramName === 'mix') {
            // LFOでwetGainを直接コントロールすることでmixを擬似的に変化させます
            return this.wetGain.gain;
        }
        return super.getAudioParam(paramName);
    }
}

class PatternModule extends AudioModule {
    constructor(x, y, isCorrectAnswerModule = false) {
        super('pattern', x, y, 'Ptn ', isCorrectAnswerModule);
        this.params = { onTime: 0.15, offTime: 0.1, repeat: 2 };
        this.isPlaying = false;
        this.targetInfo = null; // Store target info here { module, paramName, baseValue }
        this.isLooping = false; // ループ再生のフラグ
        this.loopTimeoutId = null; // ループ用のタイマーID
        this.initAudioNode();
        this.updateParams();

        // Pattern module has no audio input.
        if (this.domElement.querySelector('.input-node')) {
            this.domElement.querySelector('.input-node').remove();
        }
    }

    initAudioNode() {
        // PatternModuleは直接制御方式なので、audioNodeは不要
        // ただし、UIとの互換性のために空のオブジェクトを保持
        this.audioNode = null;
    }

    // Override to do nothing, as it has no audio input.
    createInputNodeDOM() {
        // Pattern module has no audio input, so don't create input nodes
    }

    // Override to create a red modulation output node.
    createOutputNodeDOM() {
        const outputNodeDOM = document.createElement('div');
        outputNodeDOM.className = 'io-node param-output-node'; // Red dot for modulation
        outputNodeDOM.dataset.moduleId = this.id;
        outputNodeDOM.dataset.nodeType = 'output';
        this.domElement.appendChild(outputNodeDOM);
        outputNodeDOM.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            if (this.isCorrectAnswerModule) return;
            // LFO output is always for parameters
            startDrawingLine(e, this.id, e.target, 'param');
        });
    }

    // Override connectTo to store target info and ensure connection
    connectTo(targetModule, targetParamName) {
        console.log('[PatternModule connectTo] Called with:', targetModule?.type, targetModule?.id, targetParamName);
        
        // Prevent connecting to correct answer modules
        if (targetModule?.isCorrectAnswerModule) {
            console.log('[PatternModule] Ignoring connection to correct answer module');
            return false;
        }
        
        const targetParam = targetModule.getAudioParam(targetParamName);
        if (!targetParam) {
            console.error(`[PatternModule] Target parameter ${targetParamName} not found on module`, targetModule);
            return false;
        }
        // 既に接続済みなら再接続しない
        if (this.targetInfo && this.targetInfo.module === targetModule && this.targetInfo.paramName === targetParamName) {
            console.log('[PatternModule] Already connected to', targetModule?.type, targetParamName);
            return true;
        }
        // 既に何かに接続されていたら切断
        if (this.targetInfo) {
            console.log('[PatternModule] Disconnecting from previous target');
            this.disconnectFrom(this.targetInfo.module, this.targetInfo.paramName);
        }
        try {
            // PatternModuleは直接接続せず、直接制御方式を使用
            this.targetInfo = {
                module: targetModule,
                paramName: targetParamName,
                targetParam: targetParam,
                baseValue: targetModule.params[targetParamName]
            };
            
            // ターゲットモジュールに外部制御フラグを設定
            if (targetModule.setExternalControl) {
                targetModule.setExternalControl(targetParamName, true);
            }
            
            console.log('[PatternModule] Set target for direct control:', targetModule?.type, targetParamName, 'baseValue:', this.targetInfo.baseValue);
            
            // 接続後、自動的にパターンを開始（ループモード）
            if (!this.isCorrectAnswerModule) {
                this.startLoop();
                console.log('[PatternModule] Auto-started pattern loop after connection');
            }
            
            return true;
        } catch (e) {
            console.error('[PatternModule] Failed to set target', e);
            return false;
        }
    }

    // Override disconnectFrom to clear target info and disconnect
    disconnectFrom(targetModule, targetParamName) {
        console.log('[PatternModule disconnectFrom] Called with:', targetModule?.type, targetModule?.id, targetParamName);
        
        // Prevent disconnecting from correct answer modules (they shouldn't be connected anyway)
        if (targetModule?.isCorrectAnswerModule) {
            console.log('[PatternModule] Ignoring disconnection from correct answer module');
            return;
        }
        
        if (this.targetInfo && this.targetInfo.module === targetModule && this.targetInfo.paramName === targetParamName) {
            // ループを停止
            this.stopLoop();
            
            // ターゲットモジュールの外部制御フラグを解除
            if (targetModule.setExternalControl) {
                targetModule.setExternalControl(targetParamName, false);
            }
            
            // No physical disconnect since we're using direct control
            console.log('[PatternModule] Cleared target for direct control', targetModule?.type, targetParamName);
            this.targetInfo = null;
        }
    }

    // Test method to verify pattern functionality
    testPattern() {
        console.log('[PatternModule] testPattern() called');
        if (!this.targetInfo || !audioContext) {
            console.warn('[PatternModule] Cannot test: target not set or audio context not ready');
            return;
        }
        
        const now = audioContext.currentTime;
        const param = this.targetInfo.targetParam;
        const testValue = this.targetInfo.baseValue || 0.8; // Use base value or fallback
        
        console.log('[PatternModule] Starting test pattern with value:', testValue);
        
        param.cancelScheduledValues(now);
        param.setValueAtTime(0, now);
        
        // Simple test: ON for 0.2s, OFF for 0.1s, repeat twice
        param.setValueAtTime(testValue, now + 0.1); // ON
        param.setValueAtTime(0, now + 0.3);         // OFF
        param.setValueAtTime(testValue, now + 0.4); // ON
        param.setValueAtTime(0, now + 0.6);         // OFF
        
        console.log('[PatternModule] Test pattern scheduled directly on target param');
    }

    start() {
        if (!this.targetInfo || !audioContext) {
            console.warn('[PatternModule] Pattern target not set or audio context not ready.');
            return;
        }
        const now = audioContext.currentTime;
        const param = this.targetInfo.targetParam;
        const baseValue = this.targetInfo.baseValue;
        const startTime = now + 0.005;
        
        console.log('[PatternModule] start() - Current audioContext.currentTime:', now);
        console.log('[PatternModule] start() - Target param:', param);
        console.log('[PatternModule] start() - Base value:', baseValue);
        console.log('[PatternModule] start() - Params:', this.params);
        
        // 直接制御：現在の値をクリアして、パターンをスケジューリング
        param.cancelScheduledValues(now);
        param.setValueAtTime(0, now); // 初期値は0（無音）
        
        let scheduleTime = startTime;
        for (let i = 0; i < this.params.repeat; i++) {
            console.log(`[PatternModule] Scheduling burst ${i+1}: ON at ${scheduleTime.toFixed(3)}, OFF at ${(scheduleTime + this.params.onTime).toFixed(3)}`);
            param.setValueAtTime(baseValue, scheduleTime); // ON: baseValueで音が出る
            scheduleTime += this.params.onTime;
            param.setValueAtTime(0, scheduleTime);         // OFF: 0で音が止まる
            if (i < this.params.repeat - 1) {
                scheduleTime += this.params.offTime;
            }
        }
        console.log('[PatternModule] start() called, pattern scheduled directly on param with baseValue:', baseValue, this.params);
    }

    startLoop() {
        if (!this.targetInfo || !audioContext) {
            console.warn('[PatternModule] Pattern target not set for loop.');
            return;
        }
        
        this.isLooping = true;
        console.log('[PatternModule] Starting loop mode');
        
        const scheduleNext = () => {
            if (!this.isLooping || !this.targetInfo) return;
            
            this.start(); // 一回分のパターンを実行
            
            // 次のループまでの時間を計算
            const totalPatternTime = (this.params.onTime + this.params.offTime) * this.params.repeat;
            const nextLoopDelay = totalPatternTime + 0.5; // 0.5秒の間隔を追加
            
            this.loopTimeoutId = setTimeout(scheduleNext, nextLoopDelay * 1000);
        };
        
        scheduleNext();
    }

    stopLoop() {
        this.isLooping = false;
        if (this.loopTimeoutId) {
            clearTimeout(this.loopTimeoutId);
            this.loopTimeoutId = null;
        }
        console.log('[PatternModule] Stopped loop mode');
    }

    stop() {
        this.stopLoop(); // ループも停止
        if (this.targetInfo && audioContext) {
            const param = this.targetInfo.targetParam;
            const now = audioContext.currentTime;
            param.cancelScheduledValues(now);
            param.setValueAtTime(0, now);
            console.log('[PatternModule] stop() called, param set to 0');
        }
    }
    
    getEditorHTML() {
        if (this.isCorrectAnswerModule) {
            return `<div class="p-2">
                <p class="text-sm text-gray-600">ON時間: ${this.params.onTime}s</p>
                <p class="text-sm text-gray-600">OFF時間: ${this.params.offTime}s</p>
                <p class="text-sm text-gray-600">リピート: ${this.params.repeat}回</p>
            </div>`;
        }
        return `
            <div class="p-2">
                <label class="param-label">ON時間 (s): <span id="pattern-on-val-${this.id}">${this.params.onTime.toFixed(2)}</span></label>
                <input type="range" id="pattern-on-${this.id}" class="param-slider" min="0.01" max="2" step="0.01" value="${this.params.onTime}">
                
                <label class="param-label mt-2">OFF時間 (s): <span id="pattern-off-val-${this.id}">${this.params.offTime.toFixed(2)}</span></label>
                <input type="range" id="pattern-off-${this.id}" class="param-slider" min="0.01" max="2" step="0.01" value="${this.params.offTime}">

                <label class="param-label mt-2">リピート回数: <span id="pattern-repeat-val-${this.id}">${this.params.repeat}</span></label>
                <input type="range" id="pattern-repeat-${this.id}" class="param-slider" min="1" max="10" step="1" value="${this.params.repeat}">
            </div>
        `;
    }

    updateParams() {
        if (this.isCorrectAnswerModule) return;
        const onTimeInput = document.getElementById(`pattern-on-${this.id}`);
        const offTimeInput = document.getElementById(`pattern-off-${this.id}`);
        const repeatInput = document.getElementById(`pattern-repeat-${this.id}`);
        
        if (onTimeInput) this.params.onTime = parseFloat(onTimeInput.value);
        if (offTimeInput) this.params.offTime = parseFloat(offTimeInput.value);
        if (repeatInput) this.params.repeat = parseInt(repeatInput.value, 10);

        const onTimeVal = document.getElementById(`pattern-on-val-${this.id}`);
        const offTimeVal = document.getElementById(`pattern-off-val-${this.id}`);
        const repeatVal = document.getElementById(`pattern-repeat-val-${this.id}`);

        if(onTimeVal) onTimeVal.textContent = this.params.onTime.toFixed(2);
        if(offTimeVal) offTimeVal.textContent = this.params.offTime.toFixed(2);
        if(repeatVal) repeatVal.textContent = this.params.repeat;
    }
    
    setParams(params) {
        Object.assign(this.params, params);
        this.updateParams();
    }
    
    destroy() {
        // ループを停止
        this.stopLoop();
        
        // When the module is destroyed, restore the original value of the target parameter.
        if (this.targetInfo && this.targetInfo.targetParam) {
            const targetParam = this.targetInfo.targetParam;
            const baseValue = this.targetInfo.baseValue;
            const now = audioContext.currentTime;
            targetParam.cancelScheduledValues(now);
            targetParam.setValueAtTime(baseValue, now);
        }
        // The ConstantSourceNode does not need to be stopped.
        // super.destroy() will handle disconnecting everything.
        super.destroy();
    }
}

class LFOModule extends AudioModule {
    constructor(x, y, isCorrectAnswerModule = false) {
        super('lfo', x, y, 'LFO ', isCorrectAnswerModule);
        this.params = { type: 'sine', frequency: 5, amount: 100 };
        this.lfoNode = null; // The actual oscillator
        this.isPlaying = false;
        this.initAudioNode();
        this.updateParams();
    }

    createOutputNodeDOM() {
        const outputNodeDOM = document.createElement('div');
        outputNodeDOM.className = 'io-node param-output-node';
        outputNodeDOM.dataset.moduleId = this.id;
        outputNodeDOM.dataset.nodeType = 'output';
        this.domElement.appendChild(outputNodeDOM);
        outputNodeDOM.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            if (this.isCorrectAnswerModule) return;
            // LFO output is always for parameters
            startDrawingLine(e, this.id, e.target, 'param');
        });
    }

    initAudioNode() {
        if (!audioContext) return;
        if (this.lfoNode) {
            try { if(this.isPlaying) this.lfoNode.stop(); } catch(e) {}
            try { this.lfoNode.disconnect(); } catch(e) {}
        }
        if (this.audioNode) { // audioNode is the Gain (amount)
            try { this.audioNode.disconnect(); } catch(e) {}
        }

        this.lfoNode = audioContext.createOscillator();
        this.audioNode = audioContext.createGain(); // This is the output node

        this.lfoNode.connect(this.audioNode);
        this.lfoNode.type = this.params.type;
        this.lfoNode.frequency.setValueAtTime(this.params.frequency, audioContext.currentTime);
        this.audioNode.gain.setValueAtTime(this.params.amount, audioContext.currentTime);
        
        this.lfoNode.start(0);
        this.isPlaying = true;
    }

    getEditorHTML() {
        if (this.isCorrectAnswerModule) {
            return `
                <div class="mb-2"><label class="param-label">Type: ${this.params.type}</label></div>
                <div class="mb-2"><label class="param-label">Frequency: ${this.params.frequency} Hz</label></div>
                <div class="mb-2"><label class="param-label">Amount: ${this.params.amount}</label></div>
            `;
        }
        return `
            <div class="mb-2">
                <label class="param-label">Type:
                    <select id="lfo-type-${this.id}" class="custom-select">
                        <option value="sine">sine</option>
                        <option value="square">square</option>
                        <option value="sawtooth">sawtooth</option>
                        <option value="triangle">triangle</option>
                    </select>
                </label>
            </div>
            <div class="mb-2">
                <label class="param-label">Frequency: <span id="lfo-freq-val-${this.id}">${this.params.frequency}</span> Hz
                    <input type="range" id="lfo-freq-${this.id}" class="param-slider" min="0.1" max="20" step="0.1" value="${this.params.frequency}">
                </label>
            </div>
            <div class="mb-2">
                <label class="param-label">Amount: <span id="lfo-amount-val-${this.id}">${this.params.amount}</span>
                    <input type="range" id="lfo-amount-${this.id}" class="param-slider" min="0" max="1000" step="1" value="${this.params.amount}">
                </label>
            </div>
        `;
    }

    updateParams() {
        if (!this.lfoNode || !this.audioNode || !audioContext) return;
        this.lfoNode.type = this.params.type;
        this.lfoNode.frequency.setValueAtTime(this.params.frequency, audioContext.currentTime);
        this.audioNode.gain.setValueAtTime(this.params.amount, audioContext.currentTime);
    }

    setParams(params) {
        Object.assign(this.params, params);
        this.updateParams();
    }

    destroy() {
        if (this.lfoNode) {
            try {
                if (this.isPlaying) this.lfoNode.stop();
            } catch (e) {}
            try {
                this.lfoNode.disconnect();
            } catch (e) {}
        }
        super.destroy();
    }
}

class OutputModule extends AudioModule {
    constructor(x,y, isCorrectAnswerModule = false) {
        super('output', x, y, 'Output ', isCorrectAnswerModule);
        this.initAudioNode();
    }
    initAudioNode() {
        if (!audioContext) return; // audioContextがなければ何もしない
        this.audioNode = audioContext.destination;
    }
    createInputNodeDOM() {
        const inputNodeDOM = document.createElement('div');
        inputNodeDOM.className = 'io-node input-node';
        inputNodeDOM.dataset.moduleId = this.id;
        inputNodeDOM.dataset.nodeType = 'input';
        this.domElement.appendChild(inputNodeDOM);
        inputNodeDOM.addEventListener('mousedown', (e) => e.stopPropagation());
        inputNodeDOM.addEventListener('mouseup', (e) => {
            e.stopPropagation();
            if (this.isCorrectAnswerModule) return;
            if (drawingLine && lineStartNodeInfo && lineStartNodeInfo.connectionType === 'audio') {
                const sourceModule = getModuleById(lineStartNodeInfo.sourceModuleId);
                const targetModule = getModuleById(this.id);
                if (sourceModule && targetModule) {
                    connectModules(sourceModule, targetModule, null);
                }
            }
            stopDrawingLine();
        });
    }
    createOutputNodeDOM() {
        // Output module has no output
        return;
    }
    getEditorHTML() {
        return `<p class="text-xs text-gray-500">マスター出力。他のモジュールの出力をここに接続してください。</p>`;
    }
}
