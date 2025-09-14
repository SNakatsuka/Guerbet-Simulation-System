document.addEventListener('DOMContentLoaded', () => {
    // --- HTML要素の取得 ---
    const canvas = document.getElementById('reactionCanvas');
    const ctx = canvas.getContext('2d');
    const k1Slider = document.getElementById('k1Slider');
    const k2Slider = document.getElementById('k2Slider');
    const k3Slider = document.getElementById('k3Slider');
    const k4Slider = document.getElementById('k4Slider');
    const startButton = document.getElementById('startButton');
    const resetButton = document.getElementById('resetButton');
    const timeDisplay = document.getElementById('timeDisplay');
    const butanolDisplay = document.getElementById('butanolDisplay');
    const hexanolDisplay = document.getElementById('hexanolDisplay');

    // --- シミュレーション定数と変数 ---
    let simTime = 0;
    const timeStep = 0.05; 
    const maxTime = 200; 
    let animationFrameId;

    // 各化学種の濃度をオブジェクトで管理
    let concentrations;
    const initialConcentration = 1.0;

    function initializeConcentrations() {
        concentrations = {
            // アルコール類
            C2_OH: initialConcentration,
            C4_OH: 0,
            C6_OH: 0,
            // 飽和アルデヒド類
            C2_CHO: 0,
            C4_CHO: 0,
            C6_CHO: 0,
            // α,β-不飽和アルデヒド類 (エナール)
            C4_Enal: 0,
            C6_Enal: 0,
        };
    }

    // --- グラフの初期設定 ---
    const chartCanvas = document.getElementById('concentrationChart');
    const concentrationChart = new Chart(chartCanvas, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'エタノール(C2)', borderColor: '#3498db', data: [], fill: false, tension: 0.1 },
                { label: 'ブタノール(C4)', borderColor: '#2ecc71', data: [], fill: false, tension: 0.1 },
                { label: 'ヘキサノール(C6)', borderColor: '#f1c40f', data: [], fill: false, tension: 0.1 }
            ]
        },
        options: {
            scales: { 
                y: { beginAtZero: true, max: 1.0, title: { display: true, text: '濃度 (mol/L)' } },
                x: { title: { display: true, text: '時間 (s)'}}
            },
            animation: { duration: 0 }
        }
    });

    // --- メインのシミュレーション関数 ---
    function runSimulation() {
        if (simTime >= maxTime) {
            stopSimulation();
            return;
        }

        // 1. 各反応速度定数をスライダーから取得
        const k1 = parseFloat(k1Slider.value); // 脱水素
        const k2 = parseFloat(k2Slider.value); // アルドール縮合
        const k3 = parseFloat(k3Slider.value); // C=C 水素化
        const k4 = parseFloat(k4Slider.value); // C=O 水素化

        // 2. 各工程の反応速度を計算
        const c = concentrations; // 短縮名
        const rates = {
            // k1: 脱水素
            dehydro_C2: k1 * c.C2_OH,
            dehydro_C4: k1 * c.C4_OH,
            // k2: アルドール縮合 (エナール生成)
            aldol_C2_C2: k2 * c.C2_CHO * c.C2_CHO, // -> C4 Enal
            aldol_C2_C4: k2 * c.C2_CHO * c.C4_CHO, // -> C6 Enal
            // k3: C=C二重結合の水素化 (エナール -> 飽和アルデヒド)
            hydro_olefin_C4: k3 * c.C4_Enal,
            hydro_olefin_C6: k3 * c.C6_Enal,
            // k4: C=Oカルボニルの水素化 (飽和アルデヒド -> アルコール)
            hydro_carbonyl_C2: k4 * c.C2_CHO, // 逆反応としてモデル化
            hydro_carbonyl_C4: k4 * c.C4_CHO,
            hydro_carbonyl_C6: k4 * c.C6_CHO,
        };
        
        // 3. 各化学種の濃度の変化量 (Δ) を計算
        const delta = {
            C2_OH: (-rates.dehydro_C2 + rates.hydro_carbonyl_C2) * timeStep,
            C4_OH: (-rates.dehydro_C4 + rates.hydro_carbonyl_C4) * timeStep,
            C6_OH: (rates.hydro_carbonyl_C6) * timeStep,

            C2_CHO: (rates.dehydro_C2 - rates.hydro_carbonyl_C2 - 2 * rates.aldol_C2_C2 - rates.aldol_C2_C4) * timeStep,
            C4_CHO: (rates.dehydro_C4 + rates.hydro_olefin_C4 - rates.hydro_carbonyl_C4 - rates.aldol_C2_C4) * timeStep,
            C6_CHO: (rates.hydro_olefin_C6 - rates.hydro_carbonyl_C6) * timeStep,
            
            C4_Enal: (rates.aldol_C2_C2 - rates.hydro_olefin_C4) * timeStep,
            C6_Enal: (rates.aldol_C2_C4 - rates.hydro_olefin_C6) * timeStep,
        };

        // 4. 濃度を更新 (0未満にならないように)
        for (const key in concentrations) {
            concentrations[key] = Math.max(0, concentrations[key] + delta[key]);
        }

        // 5. 時間を更新
        simTime += timeStep;

        // 6. 描画
        updateDisplay();
        drawMolecules();
        updateChart();

        // 次のフレームを予約
        animationFrameId = requestAnimationFrame(runSimulation);
    }

    // --- 画面表示の更新 ---
    function updateDisplay() {
        timeDisplay.textContent = simTime.toFixed(1);
        butanolDisplay.textContent = concentrations.C4_OH.toFixed(3);
        hexanolDisplay.textContent = concentrations.C6_OH.toFixed(3);
    }

    // --- グラフの更新 ---
    function updateChart() {
        if (Math.floor(simTime * 10) % 10 === 0) { // 更新頻度を調整
            const timeLabel = simTime.toFixed(1);
            concentrationChart.data.labels.push(timeLabel);
            concentrationChart.data.datasets[0].data.push(concentrations.C2_OH);
            concentrationChart.data.datasets[1].data.push(concentrations.C4_OH);
            concentrationChart.data.datasets[2].data.push(concentrations.C6_OH);
            concentrationChart.update();
        }
    }
    
    // --- キャンバスへの分子描画 ---
    const molecules = [];
    const totalMolecules = 200;
    function drawMolecules() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (molecules.length === 0 || Math.floor(simTime) % 2 === 0) {
            molecules.length = 0;
            const numC2 = Math.round(totalMolecules * concentrations.C2_OH);
            const numC4 = Math.round(totalMolecules * concentrations.C4_OH);
            const numC6 = Math.round(totalMolecules * concentrations.C6_OH);
            const numIntermediate = totalMolecules - (numC2 + numC4 + numC6);
            
            for (let i = 0; i < numC2; i++) createMolecule('c2');
            for (let i = 0; i < numC4; i++) createMolecule('c4');
            for (let i = 0; i < numC6; i++) createMolecule('c6');
            for (let i = 0; i < numIntermediate; i++) createMolecule('intermediate');
        }

        molecules.forEach(mol => {
            mol.x += mol.vx;
            mol.y += mol.vy;
            if (mol.x < 0 || mol.x > canvas.width) mol.vx *= -1;
            if (mol.y < 0 || mol.y > canvas.height) mol.vy *= -1;
            ctx.beginPath();
            ctx.arc(mol.x, mol.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = mol.color;
            ctx.fill();
        });
    }
    
    function createMolecule(type) {
         let color;
         if (type === 'c2') color = '#3498db';
         else if (type === 'c4') color = '#2ecc71';
         else if (type === 'c6') color = '#f1c40f';
         else color = '#95a5a6';
         
         molecules.push({
             x: Math.random() * canvas.width,
             y: Math.random() * canvas.height,
             vx: (Math.random() - 0.5) * 2,
             vy: (Math.random() - 0.5) * 2,
             color: color
         });
    }

    // --- シミュレーション制御 ---
    function startSimulation() {
        stopSimulation(); 
        resetSimulation();
        animationFrameId = requestAnimationFrame(runSimulation);
        [startButton, k1Slider, k2Slider, k3Slider, k4Slider].forEach(el => el.disabled = true);
    }

    function stopSimulation() {
        cancelAnimationFrame(animationFrameId);
        [startButton, k1Slider, k2Slider, k3Slider, k4Slider].forEach(el => el.disabled = false);
    }

    function resetSimulation() {
        stopSimulation();
        simTime = 0;
        initializeConcentrations();
        molecules.length = 0;
        
        concentrationChart.data.labels = [];
        concentrationChart.data.datasets.forEach((dataset) => {
            dataset.data = [];
        });
        concentrationChart.update();
        
        updateDisplay();
        drawMolecules();
    }

    // --- イベントリスナー ---
    startButton.addEventListener('click', startSimulation);
    resetButton.addEventListener('click', resetSimulation);

    // --- 初期状態の描画 ---
    resetSimulation();
});
