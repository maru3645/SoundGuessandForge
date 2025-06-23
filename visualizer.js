// 波形・スペクトラム表示用ビジュアライザ

let analyserNode = null;
let waveformCanvas, spectrumCanvas;
let waveformCtx, spectrumCtx;
let visualizerAnimationId = null;

function initVisualizer() {
    waveformCanvas = document.getElementById('waveform-canvas');
    spectrumCanvas = document.getElementById('spectrum-canvas');
    if (!waveformCanvas || !spectrumCanvas || !audioContext) return;

    waveformCtx = waveformCanvas.getContext('2d');
    spectrumCtx = spectrumCanvas.getContext('2d');

    if (!analyserNode) {
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 2048;
        try {
            analyserNode.connect(audioContext.destination);
        } catch(e) { console.error("Error connecting analyser to destination", e); }

        // Update the main output module to use the analyser as its audioNode
        const mainOutputModule = modules.find(m => m.type === 'output' && !m.isCorrectAnswerModule);
        if (mainOutputModule) {
            mainOutputModule.audioNode = analyserNode;
            // Re-apply connections to the output module, which now points to the analyser
            reconnectAll(); 
        }
    }
}

function startVisualizer() {
    if (!analyserNode || !waveformCtx || !spectrumCtx) return;
    function draw() {
        // 波形
        const bufferLength = analyserNode.fftSize;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteTimeDomainData(dataArray);

        waveformCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
        waveformCtx.beginPath();
        const sliceWidth = waveformCanvas.width / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * waveformCanvas.height) / 2;
            if (i === 0) {
                waveformCtx.moveTo(x, y);
            } else {
                waveformCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }
        waveformCtx.strokeStyle = '#3498db';
        waveformCtx.lineWidth = 2;
        waveformCtx.stroke();

        // スペクトラム
        const freqLen = analyserNode.frequencyBinCount;
        const freqArray = new Uint8Array(freqLen);
        analyserNode.getByteFrequencyData(freqArray);

        spectrumCtx.clearRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);
        const barWidth = spectrumCanvas.width / freqLen;
        for (let i = 0; i < freqLen; i++) {
            const value = freqArray[i];
            const percent = value / 255;
            const barHeight = spectrumCanvas.height * percent;
            spectrumCtx.fillStyle = `rgb(${value + 100}, 100, 180)`;
            spectrumCtx.fillRect(i * barWidth, spectrumCanvas.height - barHeight, barWidth, barHeight);
        }

        visualizerAnimationId = requestAnimationFrame(draw);
    }
    if (!visualizerAnimationId) draw();
}

function stopVisualizer() {
    if (visualizerAnimationId) {
        cancelAnimationFrame(visualizerAnimationId);
        visualizerAnimationId = null;
    }
    if (waveformCtx && waveformCanvas) waveformCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    if (spectrumCtx && spectrumCanvas) spectrumCtx.clearRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);
}
