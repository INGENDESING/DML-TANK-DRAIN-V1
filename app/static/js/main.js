/**
 * DML Ingenieros - Simulador de Vaciado de Tanques
 * main.js - Versión Profesional con P&ID
 */

document.addEventListener('DOMContentLoaded', () => {
    // === ELEMENTOS DEL DOM ===
    const form = document.getElementById('simulation-form');
    const ga1Canvas = document.getElementById('ga1-canvas');
    const ctx = ga1Canvas.getContext('2d');
    const levelChartCanvas = document.getElementById('levelChart');
    const valveSlider = document.getElementById('valve-slider');
    const valveDisplay = document.getElementById('valve-display');
    const alarmBox = document.getElementById('alarm-box');
    const pipeStandardSelect = document.getElementById('pipe_standard');
    const pipeSizeSelect = document.getElementById('pipe_size');
    const altitudeInput = document.querySelector('[name="altitude"]');
    const patmDisplay = document.getElementById('patm_corrected');

    // === ESTADO GLOBAL ===
    let simulationData = null;
    let tankMeta = null;
    let currentFrame = 0;
    let animationId = null;
    let minLevelIndex = -1;
    let flowParticles = [];

    // === FUNCIÓN DE MOSTRAR ERROR INLINE ===
    function showError(message) {
        const errorDiv = document.getElementById('error-message');
        const errorText = document.getElementById('error-text');
        if (errorDiv && errorText) {
            errorText.textContent = message;
            errorDiv.style.display = 'block';
            // Auto-scroll al error
            errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            alert(message);
        }
    }

    function hideError() {
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) errorDiv.style.display = 'none';
    }

    // === FUNCIÓN DE RESETEO ===
    function resetSimulation() {
        // Detener animación
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        // Limpiar datos
        simulationData = null;
        currentFrame = 0;
        minLevelIndex = -1;
        flowParticles = [];

        // Limpiar alarma
        alarmBox.className = 'alarm-hidden';

        // Reiniciar panel de información
        const infoVolTotal = document.getElementById('info-vol-total');
        const infoVolInitial = document.getElementById('info-vol-initial');
        const infoTime = document.getElementById('info-time');
        const infoStatus = document.getElementById('info-status');
        if (infoVolTotal) infoVolTotal.textContent = '--';
        if (infoVolInitial) infoVolInitial.textContent = '--';
        if (infoTime) infoTime.textContent = '--';
        if (infoStatus) {
            infoStatus.textContent = '--';
            infoStatus.style.color = '#ffaa00';
        }

        // Limpiar tablas
        document.getElementById('results-body').innerHTML = '<tr><td colspan="16">Ejecute simulación</td></tr>';
        document.getElementById('valve-table-body').innerHTML = '<tr><td colspan="4">Ejecute simulación</td></tr>';

        // Limpiar gráficos
        levelChart.data.labels = [];
        levelChart.data.datasets[0].data = [];
        levelChart.data.datasets[1].data = [];
        levelChart.update();

        pumpChart.data.datasets[0].data = [];
        pumpChart.data.datasets[1].data = [];
        pumpChart.update();

        // Limpiar canvas GA1
        const dpr = window.devicePixelRatio || 1;
        const rect = ga1Canvas.getBoundingClientRect();
        ga1Canvas.width = rect.width * dpr;
        ga1Canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        const bgGrad = ctx.createLinearGradient(0, 0, 0, rect.height);
        bgGrad.addColorStop(0, '#1a1a2e');
        bgGrad.addColorStop(1, '#16213e');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, rect.width, rect.height);

        ctx.fillStyle = '#60cdff';
        ctx.font = '16px Consolas';
        ctx.textAlign = 'center';
        ctx.fillText('Ejecute simulación para ver animación', rect.width / 2, rect.height / 2);

        console.log('Simulación reseteada');
    }

    // Botón de reset
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
        btnReset.addEventListener('click', resetSimulation);
    }

    // === FUNCIÓN EXPORTAR CSV ===
    function exportToCSV() {
        if (!simulationData || simulationData.length === 0) {
            showError('No hay datos de simulación para exportar. Ejecute una simulación primero.');
            return;
        }

        // Cabeceras CSV
        const headers = [
            't (min)', 'Nivel (m)', 'Volumen (m³)', 'Q (m³/h)', 'v (m/s)',
            'Re', 'Régimen', 'f (Darcy)',
            'ΔP suc (mca)', 'ΔP valv (mca)', 'P suc (mca)', 'NPSHa (m)', 'NPSHr (m)',
            'ΔP desc (mca)', 'TDH (m)', 'Potencia (kW)', 'ΔP total (mca)', 'Cv', 'Alarma'
        ];

        // Convertir datos a filas CSV
        const rows = simulationData.map(p => [
            (p.time / 60).toFixed(2),
            p.level.toFixed(4),
            p.volume.toFixed(3),
            p.flow_m3h.toFixed(3),
            p.velocity_ms.toFixed(3),
            (p.reynolds || 0).toFixed(0),
            p.flow_regime || '--',
            (p.friction_factor || 0).toFixed(6),
            ((p.dp_pipe || 0) * 10.1972).toFixed(4),
            ((p.dp_valve || 0) * 10.1972).toFixed(4),
            (p.pressure_suction_bar * 10.1972).toFixed(3),
            p.npsh_a.toFixed(3),
            p.npsh_r.toFixed(3),
            ((p.dp_discharge || 0) * 10.1972).toFixed(4),
            (p.pump_head_m || 0).toFixed(3),
            (p.pump_power_kw || 0).toFixed(3),
            ((p.pressure_diff_bar || 0) * 10.1972).toFixed(3),
            (p.cv || 0).toFixed(2),
            p.alarm ? 'SI' : 'NO'
        ]);

        // Construir contenido CSV
        let csvContent = '\uFEFF'; // BOM para Excel UTF-8
        csvContent += headers.join(';') + '\n';
        rows.forEach(row => {
            csvContent += row.join(';') + '\n';
        });

        // Agregar metadatos del tanque
        if (tankMeta) {
            csvContent += '\n;PARÁMETROS DEL TANQUE\n';
            csvContent += `;Diámetro (m);${tankMeta.D.toFixed(2)}\n`;
            csvContent += `;Altura (m);${tankMeta.H.toFixed(2)}\n`;
            csvContent += `;Volumen Total (m³);${tankMeta.vol_total.toFixed(2)}\n`;
        }

        // Crear y descargar archivo
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `simulacion_vaciado_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log('CSV exportado exitosamente');
    }

    // Botón de export CSV
    const btnExportCSV = document.getElementById('btn-export-csv');
    if (btnExportCSV) {
        btnExportCSV.addEventListener('click', exportToCSV);
    }

    // === FUNCIÓN EXPORTAR PDF ===
    function exportToPDF() {
        if (!simulationData || simulationData.length === 0) {
            showError('No hay datos de simulación para exportar. Ejecute una simulación primero.');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'letter');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let yPos = 15;

        // === OBTENER DATOS DEL PROYECTO ===
        const projectInfo = {
            code: document.getElementById('project_code')?.value || 'N/A',
            name: document.getElementById('project_name')?.value || 'Sin nombre',
            docCode: document.getElementById('doc_code')?.value || 'N/A',
            analyst: document.getElementById('analyst_name')?.value || 'N/A',
            date: document.getElementById('doc_date')?.value || new Date().toISOString().slice(0, 10),
            revision: document.getElementById('doc_revision')?.value || 'Rev. 0'
        };

        // === CARGAR LOGO Y GENERAR PDF ===
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        logoImg.src = '/static/img/DML.png';

        logoImg.onload = function () {
            generatePDFWithLogo(doc, logoImg, projectInfo, pageWidth, pageHeight);
        };

        logoImg.onerror = function () {
            console.warn('No se pudo cargar el logo, generando PDF sin logo');
            generatePDFWithLogo(doc, null, projectInfo, pageWidth, pageHeight);
        };
    }

    function generatePDFWithLogo(doc, logoImg, projectInfo, pageWidth, pageHeight) {
        let yPos = 10;

        // === ENCABEZADO CON LOGO ===
        doc.setFillColor(26, 26, 46);
        doc.rect(0, 0, pageWidth, 45, 'F');

        // Logo
        if (logoImg) {
            try {
                const logoWidth = 45;
                const logoHeight = 20;
                doc.addImage(logoImg, 'PNG', 10, 8, logoWidth, logoHeight);
                yPos = 12;
            } catch (e) {
                console.warn('Error agregando logo:', e);
            }
        }

        // Título principal
        doc.setTextColor(96, 205, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('CÁLCULO DINÁMICO DE VACIADO DE TANQUES', 60, 15);

        // Info del documento
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text(`Documento: ${projectInfo.docCode}`, 60, 23);
        doc.text(`${projectInfo.revision}`, 60, 29);

        doc.setTextColor(180, 180, 180);
        doc.text(`${projectInfo.date}`, pageWidth - 15, 15, { align: 'right' });

        yPos = 55;

        // === CARÁTULA: INFORMACIÓN DEL PROYECTO ===
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('INFORMACIÓN DEL PROYECTO', 15, yPos);
        yPos += 6;

        const projectData = [
            ['Código del Proyecto', projectInfo.code],
            ['Nombre del Proyecto', projectInfo.name],
            ['Código del Documento', projectInfo.docCode],
            ['Elaborado por', projectInfo.analyst],
            ['Fecha de Elaboración', projectInfo.date],
            ['Revisión', projectInfo.revision]
        ];

        doc.autoTable({
            startY: yPos,
            head: [['Campo', 'Valor']],
            body: projectData,
            theme: 'grid',
            headStyles: { fillColor: [255, 170, 0], textColor: [0, 0, 0], fontSize: 9, fontStyle: 'bold' },
            bodyStyles: { fontSize: 9 },
            columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold' }, 1: { cellWidth: 120 } },
            margin: { left: 15 },
            tableWidth: 175
        });
        yPos = doc.lastAutoTable.finalY + 12;


        // === PARÁMETROS DEL TANQUE ===
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('1. Parámetros del Sistema', 15, yPos);
        yPos += 8;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');

        if (tankMeta) {
            const tankParams = [
                ['Diámetro del Tanque', `${tankMeta.D.toFixed(2)} m`],
                ['Altura del Tanque', `${tankMeta.H.toFixed(2)} m`],
                ['Volumen Total', `${tankMeta.vol_total.toFixed(2)} m³`],
                ['Nivel Inicial', `${simulationData[0]?.level.toFixed(2) || '--'} m`],
                ['Volumen Inicial', `${simulationData[0]?.volume.toFixed(2) || '--'} m³`]
            ];

            doc.autoTable({
                startY: yPos,
                head: [['Parámetro', 'Valor']],
                body: tankParams,
                theme: 'striped',
                headStyles: { fillColor: [0, 120, 212], fontSize: 9 },
                bodyStyles: { fontSize: 8 },
                columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 40 } },
                margin: { left: 15 },
                tableWidth: 100
            });
            yPos = doc.lastAutoTable.finalY + 10;
        }

        // === RESUMEN DE RESULTADOS ===
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('2. Resumen de Resultados', 15, yPos);
        yPos += 8;

        const lastPoint = simulationData[simulationData.length - 1];
        const firstPoint = simulationData[0];
        const hasAlarm = simulationData.some(p => p.alarm);

        const summaryData = [
            ['Tiempo de Vaciado', `${(lastPoint.time / 60).toFixed(2)} min`],
            ['Caudal Inicial', `${firstPoint.flow_m3h.toFixed(2)} m³/h`],
            ['Caudal Final', `${lastPoint.flow_m3h.toFixed(2)} m³/h`],
            ['Volumen Final', `${lastPoint.volume.toFixed(3)} m³`],
            ['NPSHa Mínimo', `${Math.min(...simulationData.map(p => p.npsh_a)).toFixed(2)} m`],
            ['Estado Final', hasAlarm ? 'ALARMA CAVITACIÓN' : 'Vaciado Completo']
        ];

        doc.autoTable({
            startY: yPos,
            head: [['Indicador', 'Valor']],
            body: summaryData,
            theme: 'striped',
            headStyles: { fillColor: [30, 81, 40], fontSize: 9 },
            bodyStyles: { fontSize: 8 },
            columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 50 } },
            margin: { left: 15 },
            tableWidth: 110
        });
        yPos = doc.lastAutoTable.finalY + 10;

        // === TABLA DE RESULTADOS (Cada 10 puntos) ===
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('3. Datos de Simulación (Resumen)', 15, yPos);
        yPos += 6;

        // Seleccionar puntos representativos
        const step = Math.max(1, Math.floor(simulationData.length / 30));
        const selectedPoints = simulationData.filter((_, i) => i % step === 0 || i === simulationData.length - 1);

        const tableData = selectedPoints.map(p => [
            (p.time / 60).toFixed(2),
            p.level.toFixed(3),
            p.volume.toFixed(2),
            p.flow_m3h.toFixed(2),
            p.velocity_ms.toFixed(2),
            p.npsh_a.toFixed(2),
            p.npsh_r.toFixed(2),
            (p.pump_head_m || 0).toFixed(1)
        ]);

        doc.autoTable({
            startY: yPos,
            head: [['t (min)', 'Nivel (m)', 'Vol (m³)', 'Q (m³/h)', 'v (m/s)', 'NPSHa', 'NPSHr', 'TDH (m)']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [45, 45, 60], fontSize: 7, halign: 'center' },
            bodyStyles: { fontSize: 6, halign: 'center' },
            margin: { left: 10, right: 10 },
            tableWidth: 'auto'
        });

        // === 4. GRÁFICA VOLUMEN VS TIEMPO ===
        doc.addPage();
        yPos = 15;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('4. Volumen del Tanque vs. Tiempo', 15, yPos);
        yPos += 8;

        // Generar gráfica off-screen
        try {
            const offCanvas = document.createElement('canvas');
            offCanvas.width = 800;
            offCanvas.height = 400;
            const offCtx = offCanvas.getContext('2d');

            // Fondo blanco
            offCtx.fillStyle = '#ffffff';
            offCtx.fillRect(0, 0, 800, 400);

            // Márgenes del gráfico
            const mLeft = 70, mRight = 30, mTop = 30, mBottom = 50;
            const gW = 800 - mLeft - mRight;
            const gH = 400 - mTop - mBottom;

            // Datos
            const volData = simulationData.map(p => ({ t: p.time / 60, v: p.volume }));
            const maxT = Math.max(...volData.map(d => d.t));
            const maxV = Math.max(...volData.map(d => d.v));

            // Ejes
            offCtx.strokeStyle = '#333';
            offCtx.lineWidth = 1;
            offCtx.beginPath();
            offCtx.moveTo(mLeft, mTop);
            offCtx.lineTo(mLeft, mTop + gH);
            offCtx.lineTo(mLeft + gW, mTop + gH);
            offCtx.stroke();

            // Labels ejes
            offCtx.fillStyle = '#333';
            offCtx.font = '14px Arial';
            offCtx.textAlign = 'center';
            offCtx.fillText('Tiempo (min)', mLeft + gW / 2, 400 - 10);
            offCtx.save();
            offCtx.translate(15, mTop + gH / 2);
            offCtx.rotate(-Math.PI / 2);
            offCtx.fillText('Volumen (m³)', 0, 0);
            offCtx.restore();

            // Ticks eje X (5 marcas)
            offCtx.font = '11px Arial';
            offCtx.textAlign = 'center';
            for (let i = 0; i <= 5; i++) {
                const tVal = (maxT * i / 5);
                const xPos = mLeft + (tVal / maxT) * gW;
                offCtx.fillText(tVal.toFixed(1), xPos, mTop + gH + 18);
                offCtx.strokeStyle = '#ddd';
                offCtx.beginPath();
                offCtx.moveTo(xPos, mTop);
                offCtx.lineTo(xPos, mTop + gH);
                offCtx.stroke();
            }

            // Ticks eje Y (5 marcas)
            offCtx.textAlign = 'right';
            for (let i = 0; i <= 5; i++) {
                const vVal = (maxV * i / 5);
                const yP = mTop + gH - (vVal / maxV) * gH;
                offCtx.fillStyle = '#333';
                offCtx.fillText(vVal.toFixed(1), mLeft - 8, yP + 4);
                offCtx.strokeStyle = '#ddd';
                offCtx.beginPath();
                offCtx.moveTo(mLeft, yP);
                offCtx.lineTo(mLeft + gW, yP);
                offCtx.stroke();
            }

            // Curva de volumen
            offCtx.strokeStyle = '#0078d4';
            offCtx.lineWidth = 2;
            offCtx.beginPath();
            volData.forEach((d, i) => {
                const x = mLeft + (d.t / maxT) * gW;
                const y = mTop + gH - (d.v / maxV) * gH;
                if (i === 0) offCtx.moveTo(x, y);
                else offCtx.lineTo(x, y);
            });
            offCtx.stroke();

            // Insertar en PDF
            const imgData = offCanvas.toDataURL('image/png');
            doc.addImage(imgData, 'PNG', 10, yPos, pageWidth - 20, (pageWidth - 20) * 0.5);
            yPos += (pageWidth - 20) * 0.5 + 10;
        } catch (e) {
            console.warn('Error generando gráfica Volumen vs Tiempo:', e);
            doc.setFontSize(9);
            doc.text('Error generando gráfica.', 15, yPos);
            yPos += 10;
        }

        // === 5. BALANCE HIDRÁULICO DETALLADO ===
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('5. Balance Hidráulico Detallado', 15, yPos);
        yPos += 8;

        const fp = simulationData[0]; // Punto inicial
        const lp = simulationData[simulationData.length - 1]; // Punto final

        const barToMca = 10.1972;
        const balanceData = [
            ['Nivel del tanque [m]', fp.level.toFixed(3), lp.level.toFixed(3)],
            ['Caudal [m³/h]', fp.flow_m3h.toFixed(2), lp.flow_m3h.toFixed(2)],
            ['Velocidad succión [m/s]', fp.velocity_ms.toFixed(3), lp.velocity_ms.toFixed(3)],
            ['h_f succión (tubería) [mca]', (fp.h_loss_pipe * barToMca / barToMca).toFixed(3), (lp.h_loss_pipe * 1).toFixed(3)],
            ['h_k succión (accesorios) [mca]', (fp.h_loss_fittings || 0).toFixed(3), (lp.h_loss_fittings || 0).toFixed(3)],
            ['h válvula [mca]', (fp.h_loss_valve || 0).toFixed(3), (lp.h_loss_valve || 0).toFixed(3)],
            ['P succión [mca man.]', (fp.pressure_suction_bar * barToMca).toFixed(3), (lp.pressure_suction_bar * barToMca).toFixed(3)],
            ['TDH bomba [m]', (fp.pump_head_m || 0).toFixed(2), (lp.pump_head_m || 0).toFixed(2)],
            ['ΔP descarga [mca]', (fp.dp_discharge * barToMca).toFixed(3), (lp.dp_discharge * barToMca).toFixed(3)],
            ['Potencia [kW]', (fp.pump_power_kw || 0).toFixed(2), (lp.pump_power_kw || 0).toFixed(2)],
            ['NPSHa [m]', fp.npsh_a.toFixed(3), lp.npsh_a.toFixed(3)],
            ['NPSHr [m]', fp.npsh_r.toFixed(3), lp.npsh_r.toFixed(3)],
            ['Margen NPSHa/NPSHr', (fp.npsh_a / Math.max(0.01, fp.npsh_r)).toFixed(2), (lp.npsh_a / Math.max(0.01, lp.npsh_r)).toFixed(2)],
            ['Diagnóstico', fp.alarm ? 'ALARMA' : 'OK', lp.alarm ? 'ALARMA' : 'OK']
        ];

        doc.autoTable({
            startY: yPos,
            head: [['Parámetro', 'Punto Inicial', 'Punto Final']],
            body: balanceData,
            theme: 'grid',
            headStyles: { fillColor: [45, 45, 60], fontSize: 8, halign: 'center' },
            bodyStyles: { fontSize: 7 },
            columnStyles: { 0: { cellWidth: 65 }, 1: { cellWidth: 40, halign: 'center' }, 2: { cellWidth: 40, halign: 'center' } },
            margin: { left: 15 },
            tableWidth: 145
        });

        // === PIE DE PÁGINA ===
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(7);
            doc.setTextColor(128, 128, 128);

            // Línea separadora
            doc.setDrawColor(200, 200, 200);
            doc.line(10, pageHeight - 15, pageWidth - 10, pageHeight - 15);

            // Información del pie
            doc.text(`${projectInfo.docCode} | ${projectInfo.revision}`, 15, pageHeight - 10);
            doc.text(`Elaboró: ${projectInfo.analyst}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
            doc.text(`Página ${i} de ${totalPages}`, pageWidth - 15, pageHeight - 10, { align: 'right' });
        }

        // Guardar PDF con nombre descriptivo
        const fileName = `${projectInfo.code}_${projectInfo.docCode}_Vaciado_${projectInfo.revision.replace(/\s+/g, '')}.pdf`;
        doc.save(fileName);
        console.log('PDF generado exitosamente:', fileName);
    }

    // Botón de export PDF
    const btnExportPDF = document.getElementById('btn-export-pdf');
    if (btnExportPDF) {
        btnExportPDF.addEventListener('click', exportToPDF);
    }

    // === GUARDAR/CARGAR CONFIGURACIÓN ===
    const STORAGE_KEY = 'dml_tank_sim_config';

    function saveConfig() {
        const formData = new FormData(form);
        const config = {};
        for (const [key, value] of formData.entries()) {
            config[key] = value;
        }
        // Guardar checkboxes explícitamente (FormData no incluye unchecked)
        ['acc_elbow90', 'acc_elbow45', 'acc_tee', 'acc_filter', 'acc_reduction', 'acc_expansion'].forEach(name => {
            const el = form.querySelector(`[name="${name}"]`);
            if (el) config[name] = el.checked;
        });
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
            alert('Configuración guardada exitosamente.');
        } catch (e) {
            alert('Error al guardar configuración.');
        }
    }

    function loadConfig() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                alert('No hay configuración guardada.');
                return;
            }
            const config = JSON.parse(raw);
            // Restaurar inputs y selects
            for (const [key, value] of Object.entries(config)) {
                const el = form.querySelector(`[name="${key}"]`);
                if (!el) continue;
                if (el.type === 'checkbox') {
                    el.checked = value === true || value === 'on';
                } else {
                    el.value = value;
                }
            }
            // Actualizar campos derivados
            updateTankFields();
            updatePatmDisplay();
            updatePipeSizes();
            // Actualizar cantidades de accesorios
            ['elbow90', 'elbow45', 'tee'].forEach(acc => {
                const input = document.getElementById('input_' + acc);
                const span = document.getElementById('qty_' + acc);
                if (input && span) span.textContent = input.value;
            });
            // Actualizar modo de cálculo
            if (typeof toggleCalcMode === 'function') toggleCalcMode();
            if (typeof togglePumpInputs === 'function') togglePumpInputs();
            // Actualizar slider de válvula
            valveSlider.value = form.valve_open.value;
            valveDisplay.textContent = form.valve_open.value;
            alert('Configuración cargada exitosamente.');
        } catch (e) {
            alert('Error al cargar configuración.');
        }
    }

    const btnSaveConfig = document.getElementById('btn-save-config');
    const btnLoadConfig = document.getElementById('btn-load-config');
    if (btnSaveConfig) btnSaveConfig.addEventListener('click', saveConfig);
    if (btnLoadConfig) btnLoadConfig.addEventListener('click', loadConfig);

    // === CALCULADORA DE VOLUMEN DEL TANQUE ===
    const volumeInitialDisplay = document.getElementById('volume_initial');
    const volumeTotalDisplay = document.getElementById('volume_total');
    const occupationDisplay = document.getElementById('occupation_percent');
    const tankDiameterInput = document.querySelector('[name="tank_diameter"]');
    const tankHeightInput = document.querySelector('[name="tank_height"]');
    const initialLevelInput = document.getElementById('initial_level');

    function calculateTankVolume(diameter, height, level) {
        // Tanque ASME F&D (torisférico)
        // Altura de cabeza estándar: h = 0.1935 * D (ASME F&D)
        const headH = 0.1935 * diameter;

        // Volumen de cabeza torisférica (simplificado)
        const V_head = 0.0847 * Math.pow(diameter, 3);

        // Volumen cilíndrico
        const R = diameter / 2;
        const V_cylinder = Math.PI * R * R * height;

        // Volumen total
        const V_total = V_cylinder + 2 * V_head;

        // Calcular volumen al nivel dado
        let V_level = 0;
        const totalH = height + 2 * headH;

        if (level <= headH) {
            // En la cabeza inferior
            const ratio = level / headH;
            V_level = V_head * ratio * ratio * (3 - 2 * ratio); // Aproximación esférica
        } else if (level <= height + headH) {
            // En la zona cilíndrica
            V_level = V_head + Math.PI * R * R * (level - headH);
        } else if (level <= totalH) {
            // En la cabeza superior
            const levelInHead = level - height - headH;
            const ratio = levelInHead / headH;
            V_level = V_head + Math.PI * R * R * height + V_head * ratio * ratio * (3 - 2 * ratio);
        } else {
            V_level = V_total;
        }

        return { total: V_total, current: V_level, totalHeight: totalH };
    }

    // Función unificada para actualizar todos los campos relacionados con el tanque
    function updateTankFields() {
        const D = parseFloat(tankDiameterInput?.value) || 3.0;
        const H = parseFloat(tankHeightInput?.value) || 5.0;
        const level = parseFloat(initialLevelInput?.value) || 0;

        const vol = calculateTankVolume(D, H, level);

        if (volumeTotalDisplay) volumeTotalDisplay.value = vol.total.toFixed(2);
        if (volumeInitialDisplay) volumeInitialDisplay.value = vol.current.toFixed(2);
        if (occupationDisplay) occupationDisplay.value = ((vol.current / vol.total) * 100).toFixed(1) + '%';
    }

    // Event listeners para actualización automática
    if (tankDiameterInput) tankDiameterInput.addEventListener('input', updateTankFields);
    if (tankHeightInput) tankHeightInput.addEventListener('input', updateTankFields);
    if (initialLevelInput) initialLevelInput.addEventListener('input', updateTankFields);

    // Calcular valores iniciales
    updateTankFields();
    // === CONSTANTES DE ESTILO P&ID ===
    const COLORS = {
        background: '#1a1a2e',
        backgroundGradient: '#16213e',
        pipe: '#4a90d9',
        pipeStroke: '#2d5a87',
        tank: '#5c6370',
        tankStroke: '#8892a0',
        liquid: '#00aaff',
        liquidDark: '#0066cc',
        steel: '#666',
        steelLight: '#888',
        valve: '#45a049',
        valveClosed: '#d9534f',
        pump: '#336699',
        pumpAlarm: '#993333',
        text: '#ffffff',
        textSecondary: '#b0b0b0',
        textMuted: '#808080',
        accent: '#60cdff',
        success: '#6ccb5f',
        warning: '#ffb900',
        danger: '#ff4444',
        panel: 'rgba(30, 40, 60, 0.95)',
        panelBorder: '#4a90d9'
    };

    // === INICIALIZAR CHART.JS ===
    const levelChart = new Chart(levelChartCanvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Nivel (m)',
                    data: [],
                    borderColor: COLORS.accent,
                    backgroundColor: 'rgba(96, 205, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Nivel Mínimo (Cavitación)',
                    data: [],
                    borderColor: COLORS.danger,
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: COLORS.textSecondary } }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Tiempo (min)', color: COLORS.textSecondary },
                    grid: { color: '#333' },
                    ticks: { color: COLORS.textSecondary }
                },
                y: {
                    title: { display: true, text: 'Nivel (m)', color: COLORS.textSecondary },
                    grid: { color: '#333' },
                    ticks: { color: COLORS.textSecondary },
                    beginAtZero: true
                }
            }
        }
    });

    // === INICIALIZAR GRÁFICA BOMBA VS SISTEMA ===
    const pumpChartCanvas = document.getElementById('pumpChart');
    const pumpChart = new Chart(pumpChartCanvas.getContext('2d'), {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Puntos de Operación (Q vs TDH)',
                    data: [],
                    borderColor: COLORS.accent,
                    backgroundColor: 'rgba(96, 205, 255, 0.3)',
                    pointRadius: 3,
                    showLine: true,
                    tension: 0.3,
                    borderWidth: 2
                },
                {
                    label: 'Curva de Bomba',
                    data: [],
                    borderColor: '#00ff88',
                    backgroundColor: 'rgba(0, 255, 136, 0.1)',
                    pointRadius: 5,
                    pointStyle: 'triangle',
                    showLine: true,
                    tension: 0.3,
                    borderWidth: 2,
                    borderDash: [5, 5]
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: COLORS.textSecondary } }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Caudal Q (m³/h)', color: COLORS.textSecondary },
                    grid: { color: '#333' },
                    ticks: { color: COLORS.textSecondary }
                },
                y: {
                    title: { display: true, text: 'TDH (m)', color: COLORS.textSecondary },
                    grid: { color: '#333' },
                    ticks: { color: COLORS.textSecondary },
                    beginAtZero: true
                }
            }
        }
    });

    function updatePumpChart(data) {
        // Puntos de operación Q vs TDH de la simulación
        const step = Math.max(1, Math.floor(data.length / 30));
        const operatingPoints = data
            .filter((_, i) => i % step === 0 || i === data.length - 1)
            .map(p => ({ x: p.flow_m3h, y: p.pump_head_m || 0 }));

        pumpChart.data.datasets[0].data = operatingPoints;

        // Curva de bomba (si estamos en modo pressure_fixed, usar los puntos de la curva del formulario)
        const calcMode = document.getElementById('calc_mode').value;
        if (calcMode === 'pressure_fixed') {
            const pumpCurvePoints = [];
            for (let i = 1; i <= 5; i++) {
                const q = parseFloat(document.querySelector(`[name="q${i}"]`)?.value) || 0;
                const tdh = parseFloat(document.querySelector(`[name="tdh${i}"]`)?.value) || 0;
                pumpCurvePoints.push({ x: q, y: tdh });
            }
            pumpChart.data.datasets[1].data = pumpCurvePoints;
        } else {
            pumpChart.data.datasets[1].data = [];
        }

        pumpChart.update();
    }

    // === CALCULAR PRESIÓN ATMOSFÉRICA POR ALTITUD ===
    function calculatePatm(altitude) {
        // Fórmula barométrica: P = 101325 × (1 - 2.25577×10⁻⁵ × h)^5.25588
        const h = Math.max(0, altitude);
        const patmPa = 101325 * Math.pow(1 - 2.25577e-5 * h, 5.25588);
        return patmPa / 100000; // Convertir Pa a bar
    }

    function updatePatmDisplay() {
        const altitude = parseFloat(altitudeInput.value) || 0;
        const patm = calculatePatm(altitude);
        patmDisplay.value = patm.toFixed(4);
    }

    if (altitudeInput) {
        altitudeInput.addEventListener('input', updatePatmDisplay);
        updatePatmDisplay();
    }

    // === TAMAÑOS DE TUBERÍA POR NORMA ===
    const pipeSizes = {
        'ANSI_SCH40': ['1.0', '1.5', '2.0', '2.5', '3.0', '4.0', '6.0', '8.0'],
        'BPE': ['1.0', '1.5', '2.0', '2.5', '3.0', '4.0', '6.0'],
        'DIN_11850_R2': ['DN25', 'DN40', 'DN50', 'DN65', 'DN80', 'DN100', 'DN125', 'DN150']
    };

    function updatePipeSizes() {
        const standard = pipeStandardSelect.value;
        const sizes = pipeSizes[standard] || pipeSizes['ANSI_SCH40'];
        pipeSizeSelect.innerHTML = '';
        sizes.forEach((size, i) => {
            const opt = document.createElement('option');
            opt.value = size;
            opt.textContent = size.startsWith('DN') ? size : size + '"';
            if (i === Math.floor(sizes.length / 2)) opt.selected = true;
            pipeSizeSelect.appendChild(opt);
        });
    }
    pipeStandardSelect.addEventListener('change', updatePipeSizes);
    updatePipeSizes();

    // === SLIDER DE VÁLVULA ===
    valveSlider.addEventListener('input', (e) => {
        valveDisplay.textContent = e.target.value;
        form.valve_open.value = e.target.value;
        if (simulationData && currentFrame < simulationData.length) {
            drawGA1(simulationData[currentFrame]);
        }
    });

    // === ACTUALIZAR CANTIDADES DE ACCESORIOS ===
    ['elbow90', 'elbow45', 'tee'].forEach(acc => {
        const input = document.getElementById('input_' + acc);
        const span = document.getElementById('qty_' + acc);
        if (input && span) {
            input.addEventListener('input', () => {
                span.textContent = input.value;
            });
        }
    });

    // === ENVIAR FORMULARIO ===
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Simulando...';
        alarmBox.className = 'alarm-hidden';

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Agregar altitud y presión atmosférica corregida
        data.altitude = parseFloat(data.altitude) || 0;
        data.patm_bar = calculatePatm(data.altitude);

        // Agregar datos de bomba según modo de cálculo
        if (data.calc_mode === 'flow_fixed') {
            // Modo Flujo Fijo: enviar solo punto de operación
            data.pump_flow = parseFloat(data.pump_flow) || 50.0;
            data.pump_npshr_single = parseFloat(data.pump_npshr_single) || 2.0;
            data.pump_efficiency = parseFloat(data.pump_efficiency) || 75.0;
            // No enviar fixed_flow_rate, el backend usará pump_flow
        } else {
            // Modo Presión Fija: enviar curva completa
            data.pump_flows = [data.q1, data.q2, data.q3, data.q4, data.q5].map(Number);
            data.pump_heads = [data.tdh1, data.tdh2, data.tdh3, data.tdh4, data.tdh5].map(Number);
            data.pump_npshr = [data.npshr1, data.npshr2, data.npshr3, data.npshr4, data.npshr5].map(Number);
        }

        // Margen de seguridad NPSH
        data.npsh_margin = parseFloat(data.npsh_margin) || 1.2;

        // Agregar accesorios succión
        data.accessories = {
            entrada_tipo: document.getElementById('suc_entrada_tipo').value,
            elbow90_rl: form.acc_elbow90_rl && form.acc_elbow90_rl.checked ? parseInt(document.getElementById('input_elbow90').value) || 0 : 0,
            elbow90_rc: form.acc_elbow90_rc && form.acc_elbow90_rc.checked ? parseInt(document.getElementById('input_elbow90_rc').value) || 0 : 0,
            elbow45: form.acc_elbow45 && form.acc_elbow45.checked ? parseInt(document.getElementById('input_elbow45').value) || 0 : 0,
            tee_directo: form.acc_tee_directo && form.acc_tee_directo.checked ? parseInt(document.getElementById('input_tee_directo').value) || 0 : 0,
            tee_ramal: form.acc_tee_ramal && form.acc_tee_ramal.checked ? parseInt(document.getElementById('input_tee_ramal').value) || 0 : 0,
            filter: form.acc_filter.checked,
            reduction: form.acc_reduction.checked,
            expansion: form.acc_expansion ? form.acc_expansion.checked : false
        };

        // Agregar línea de descarga con accesorios ampliados
        data.discharge = {
            pipe_size: data.discharge_pipe_size,
            length: parseFloat(data.discharge_length) || 20,
            height: parseFloat(data.discharge_height) || 10,
            pressure: parseFloat(data.discharge_pressure) || 2,
            elbow90_rl: form.dis_elbow90_rl && form.dis_elbow90_rl.checked ? parseInt(document.getElementById('input_dis_elbow90').value) || 0 : 0,
            elbow90_rc: form.dis_elbow90_rc && form.dis_elbow90_rc.checked ? parseInt(document.getElementById('input_dis_elbow90_rc').value) || 0 : 0,
            elbow45: form.dis_elbow45 && form.dis_elbow45.checked ? parseInt(document.getElementById('input_dis_elbow45').value) || 0 : 0,
            tee_directo: form.dis_tee_directo && form.dis_tee_directo.checked ? parseInt(document.getElementById('input_dis_tee_directo').value) || 0 : 0,
            tee_ramal: form.dis_tee_ramal && form.dis_tee_ramal.checked ? parseInt(document.getElementById('input_dis_tee_ramal').value) || 0 : 0,
            check_valve: form.dis_check_valve && form.dis_check_valve.checked ? 1 : 0,
            check_type: document.getElementById('input_dis_check_type').value || 'CHECK_SWING',
            salida: form.dis_salida && form.dis_salida.checked ? 1 : 0
        };

        try {
            const response = await fetch('/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.error) {
                showError(result.error);
                return;
            }
            hideError();

            simulationData = result.results;
            tankMeta = result.tank_meta;
            minLevelIndex = result.min_level_index || -1;

            // Guardar parámetros de descarga en tankMeta
            tankMeta.discharge = data.discharge;
            tankMeta.patm = data.patm_bar;

            // Actualizar panel de información
            const volTotal = tankMeta.vol_total || 0;
            const volInitial = simulationData[0]?.volume || 0;
            const finalTime = simulationData[simulationData.length - 1]?.time || 0;
            const finalVol = simulationData[simulationData.length - 1]?.volume || 0;
            const hasAlarm = minLevelIndex >= 0;

            document.getElementById('info-vol-total').textContent = volTotal.toFixed(2);
            document.getElementById('info-vol-initial').textContent = volInitial.toFixed(2);
            document.getElementById('info-time').textContent = (finalTime / 60).toFixed(2);

            if (hasAlarm) {
                document.getElementById('info-status').textContent = 'CAVITACIÓN';
                document.getElementById('info-status').style.color = '#ff4444';
            } else if (finalVol < 0.1) {
                document.getElementById('info-status').textContent = 'VACIADO COMPLETO';
                document.getElementById('info-status').style.color = '#00ff88';
            } else {
                document.getElementById('info-status').textContent = 'EN PROCESO';
                document.getElementById('info-status').style.color = '#ffaa00';
            }

            updateChart(simulationData, result.min_level);
            updatePumpChart(simulationData);
            updateTables(simulationData);
            updateHydraulicSummary(simulationData);
            initFlowParticles();
            startAnimation(simulationData);

            if (minLevelIndex >= 0 && minLevelIndex < simulationData.length) {
                const finalState = simulationData[minLevelIndex];
                document.getElementById('alarm-volume').textContent = finalState.volume.toFixed(2);
                const volTotal = tankMeta.vol_total || 1;
                document.getElementById('alarm-percent').textContent = ((finalState.volume / volTotal) * 100).toFixed(1);
            }

        } catch (error) {
            console.error(error);
            showError('Error de conexión con el servidor. Verifique que el servidor esté corriendo.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Iniciar Simulación';
        }
    });

    // === RESUMEN HIDRÁULICO ===
    function updateHydraulicSummary(data) {
        const panel = document.getElementById('hydraulic-summary-panel');
        const tbody = document.getElementById('hydraulic-summary-body');
        if (!panel || !tbody || !data || data.length === 0) return;

        // Calcular promedios y valores relevantes
        const avgFriction = data.reduce((s, p) => s + (p.friction_factor || 0), 0) / data.length;
        const avgReynolds = data.reduce((s, p) => s + (p.reynolds || 0), 0) / data.length;
        const maxVelocity = Math.max(...data.map(p => p.velocity_ms));
        const avgFlow = data.reduce((s, p) => s + p.flow_m3h, 0) / data.length;

        // Obtener parámetros del formulario (K aproximados para resumen)
        const pipeStd = document.getElementById('pipe_standard')?.value || '--';
        const pipeSize = document.getElementById('pipe_size')?.value || '--';
        const firstState = data[0] || {};
        const kAccSuc = (firstState.h_loss_fittings || 0) > 0
            ? ((firstState.h_loss_fittings || 0) / Math.max(0.001, (firstState.velocity_ms || 1) ** 2 / (2 * 9.81))).toFixed(2)
            : '--';
        const kAccDesc = '--';

        const rows = [
            ['Tubería Succión', `${pipeStd} ${pipeSize}`],
            ['K total acc. succión', kAccSuc],
            ['K total acc. descarga', kAccDesc],
            ['Re promedio', avgReynolds.toFixed(0)],
            ['f Darcy promedio', avgFriction.toFixed(6)],
            ['Velocidad máx. suc.', `${maxVelocity.toFixed(2)} m/s`],
            ['Caudal promedio', `${avgFlow.toFixed(2)} m³/h`],
        ];

        tbody.innerHTML = rows.map(([label, value]) =>
            `<tr><td style="color:#9ca3af;">${label}</td><td style="color:#60cfff; text-align:right;">${value}</td></tr>`
        ).join('');

        panel.style.display = 'block';
    }

    // === ACTUALIZAR GRÁFICO ===
    function updateChart(data, minLevel) {
        const labels = data.map(p => (p.time / 60).toFixed(2));
        const levels = data.map(p => p.level);
        const minLine = data.map(() => minLevel || 0);

        levelChart.data.labels = labels;
        levelChart.data.datasets[0].data = levels;
        levelChart.data.datasets[1].data = minLine;
        levelChart.update();
    }

    // === ACTUALIZAR TABLAS ===
    function updateTables(data) {
        const tbody = document.getElementById('results-body');
        tbody.innerHTML = '';

        // Función para evaluar estado de velocidad (succión)
        function getVelocityStatus(vel) {
            if (vel > 3.0) return 'status-danger';
            if (vel > 1.8) return 'status-warning';
            return 'status-ok';
        }

        // Función para formatear ΔP (maneja negativos)
        function formatPressureDiff(dp, pSuc, pDest) {
            const dpMca = dp * 10.1972;
            if (dpMca < 0) {
                return `${dpMca.toFixed(3)} <span style="font-size:0.8em; color:#ff9900;">(suc>desc)</span>`;
            }
            return dpMca.toFixed(3);
        }

        const step = Math.max(1, Math.floor(data.length / 25));
        data.forEach((p, i) => {
            if (i % step === 0 || i === data.length - 1) {
                const velStatus = getVelocityStatus(p.velocity_ms);
                const dpDiff = formatPressureDiff(p.pressure_diff_bar || 0, p.pressure_suction_bar, p.pressure_discharge_bar);
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${(p.time / 60).toFixed(2)}</td>
                    <td>${p.level.toFixed(3)}</td>
                    <td>${p.volume.toFixed(2)}</td>
                    <td>${p.flow_m3h.toFixed(2)}</td>
                    <td class="${velStatus}">${p.velocity_ms.toFixed(2)}</td>
                    <td>${(p.reynolds || 0).toFixed(0)}</td>
                    <td>${p.flow_regime || '--'}</td>
                    <td>${((p.dp_pipe || 0) * 10.1972).toFixed(3)}</td>
                    <td>${((p.dp_valve || 0) * 10.1972).toFixed(3)}</td>
                    <td>${(p.pressure_suction_bar * 10.1972).toFixed(3)}</td>
                    <td>${p.npsh_a.toFixed(2)}</td>
                    <td>${p.npsh_r.toFixed(2)}</td>
                    <td>${((p.dp_discharge || 0) * 10.1972).toFixed(3)}</td>
                    <td>${(p.pump_head_m || 0).toFixed(2)}</td>
                    <td>${(p.pump_power_kw || 0).toFixed(2)}</td>
                    <td>${dpDiff}</td>
                `;
                if (p.alarm) tr.classList.add('status-danger');
                tbody.appendChild(tr);
            }
        });

        // Tabla de válvula - mostrar primer punto (se actualiza dinámicamente en animación)
        if (data.length > 0) {
            updateValveTable(data[0]);
        }
    }

    // Función para actualizar tabla de válvula con un punto de datos
    function updateValveTable(p) {
        const valveBody = document.getElementById('valve-table-body');
        if (!valveBody || !p) return;
        const dpMca = (p.dp_valve || 0) * 10.1972;
        const condition = dpMca > 5.0 ? 'Alta ΔP' : 'Normal';
        valveBody.innerHTML = `
            <tr>
                <td>${(p.cv || 0).toFixed(1)}</td>
                <td>${dpMca.toFixed(3)}</td>
                <td>${p.flow_m3h.toFixed(2)}</td>
                <td>${condition}</td>
            </tr>
        `;
    }


    // === PARTÍCULAS DE FLUJO ===
    function initFlowParticles() {
        flowParticles = [];
        for (let i = 0; i < 20; i++) {
            flowParticles.push({
                progress: Math.random(),
                speed: 0.005 + Math.random() * 0.005
            });
        }
    }

    // === ANIMACIÓN GA1 ===
    function startAnimation(data) {
        if (animationId) cancelAnimationFrame(animationId);
        currentFrame = 0;

        // Duración dinámica según cantidad de datos (mínimo 15s, máximo 60s)
        const framesToShow = (minLevelIndex >= 0 && minLevelIndex < data.length)
            ? minLevelIndex + 1
            : data.length;
        const totalDuration = Math.min(60000, Math.max(15000, framesToShow * 50));
        const startTime = performance.now();

        // Determinar el frame final (cavitación o fin de datos)
        const maxFrame = (minLevelIndex >= 0 && minLevelIndex < data.length)
            ? minLevelIndex
            : data.length - 1;

        function animate(timestamp) {
            const elapsed = timestamp - startTime;
            const progress = Math.min(1, elapsed / totalDuration);

            // Limitar frame al punto de cavitación si existe
            currentFrame = Math.min(Math.floor(progress * (data.length - 1)), maxFrame);

            const currentState = data[currentFrame];
            drawGA1(currentState);

            // === ACTUALIZAR PANEL DE INFORMACIÓN DINÁMICAMENTE ===
            if (currentState) {
                const infoVolInitial = document.getElementById('info-vol-initial');
                const infoTime = document.getElementById('info-time');
                const infoStatus = document.getElementById('info-status');

                // Actualizar volumen actual (en lugar de inicial)
                if (infoVolInitial) infoVolInitial.textContent = currentState.volume.toFixed(2);

                // Actualizar tiempo transcurrido
                if (infoTime) infoTime.textContent = (currentState.time / 60).toFixed(2);

                // Actualizar tabla de válvula con datos del frame actual
                updateValveTable(currentState);

                // Actualizar estado dinámicamente
                if (infoStatus) {
                    if (minLevelIndex >= 0 && currentFrame >= minLevelIndex) {
                        infoStatus.textContent = 'CAVITACIÓN';
                        infoStatus.style.color = '#ff4444';
                    } else if (currentState.volume < 0.1) {
                        infoStatus.textContent = 'COMPLETO';
                        infoStatus.style.color = '#00ff88';
                    } else {
                        infoStatus.textContent = 'VACIANDO...';
                        infoStatus.style.color = '#ffaa00';
                    }
                }
            }

            // Mostrar alarma cuando llegamos al punto de cavitación
            if (minLevelIndex >= 0 && currentFrame >= minLevelIndex) {
                alarmBox.className = 'alarm-visible';
                // Detener animación en el punto de cavitación - redibujar estado final
                drawGA1(data[minLevelIndex]);
                return; // Detener la animación aquí
            }

            if (progress < 1) {
                animationId = requestAnimationFrame(animate);
            }
        }

        animationId = requestAnimationFrame(animate);
    }

    // ========================================
    // === DIBUJAR GA1 - P&ID PROFESIONAL ===
    // ========================================
    function drawGA1(state) {
        const dpr = window.devicePixelRatio || 1;
        const rect = ga1Canvas.getBoundingClientRect();
        ga1Canvas.width = rect.width * dpr;
        ga1Canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        const W = rect.width;
        const H = rect.height;

        // Fondo con gradiente
        const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, COLORS.background);
        bgGrad.addColorStop(1, COLORS.backgroundGradient);
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // Grid sutil
        ctx.strokeStyle = 'rgba(74, 144, 217, 0.1)';
        ctx.lineWidth = 0.5;
        for (let x = 0; x < W; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
            ctx.stroke();
        }
        for (let y = 0; y < H; y += 50) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }

        if (!state || !tankMeta) return;

        // ============================================================
        // === SISTEMA DE COORDENADAS RESPONSIVO ===
        // ============================================================

        // Calcular escala basada en el ancho disponible
        const minRequiredWidth = 600;
        const scale = Math.min(1, (W - 20) / minRequiredWidth);

        // Espaciado y tamaños ajustados por escala
        const paddingX = Math.floor(50 * scale);
        const tagZoneW = Math.floor(140 * scale);
        const tankW = Math.floor(140 * scale);
        const tankH = Math.floor(200 * scale);
        const headH = Math.floor(28 * scale);
        const pipeW = Math.floor(14 * scale);
        const elbowR = Math.floor(30 * scale);

        // Calcular ancho total del sistema para centrar
        // Distancia horizontal desde centro del tanque hasta el destino:
        // codo(elbowR) + filtro(60) + reducción(50) + bomba_in(50) + bomba_out(65) + desc(50) + codo(elbowR)
        const pipeRunWidth = elbowR + Math.floor(60 * scale) + Math.floor(50 * scale)
            + Math.floor(50 * scale) + Math.floor(65 * scale) + Math.floor(50 * scale) + elbowR;
        // Ancho total = medio tanque izq + medio tanque (centro nozzle) + run horizontal + gap + tagZone
        const totalSystemWidth = tankW / 2 + pipeRunWidth + Math.floor(30 * scale) + tagZoneW;
        const offsetX = Math.max(0, Math.floor((W - totalSystemWidth) / 2));

        // Posiciones responsivas (centradas)
        const tankX = offsetX;
        const tankY = Math.floor(40 * scale);
        const horizontalY = tankY + tankH + 2 * headH + Math.floor(120 * scale);
        const tagZoneX = offsetX + totalSystemWidth - tagZoneW;

        // === PUNTOS DEL SISTEMA ===

        // P0: Boquilla del tanque
        const P0 = { x: tankX + tankW / 2, y: tankY + tankH + 2 * headH };

        // P1: Fin tubería vertical
        const P1 = { x: P0.x, y: P0.y + Math.floor(35 * scale) };

        // P2: Válvula
        const P2 = { x: P0.x, y: P1.y + Math.floor(35 * scale) };

        // P3: Después de válvula
        const P3 = { x: P0.x, y: P2.y + Math.floor(35 * scale) };

        // P4: Inicio codo succión
        const P4 = { x: P0.x, y: horizontalY - Math.floor(30 * scale) };

        // Codo succión
        const P5 = { x: P4.x + elbowR, y: P4.y + elbowR };

        // P6: Filtro
        const P6 = { x: P5.x + Math.floor(60 * scale), y: P5.y };

        // P7: Reducción
        const P7 = { x: P6.x + Math.floor(50 * scale), y: P5.y };

        // P8: Bomba entrada
        const P8 = { x: P7.x + Math.floor(50 * scale), y: P5.y };

        // P9: Bomba salida
        const P9 = { x: P8.x + Math.floor(65 * scale), y: P5.y };

        // P9b: Codo descarga
        const P9b = { x: P9.x + Math.floor(50 * scale), y: P5.y };

        // P10: Destino (arriba) - ajustar si se sale
        let destX = P9b.x + elbowR;
        if (destX > tagZoneX - 30) {
            destX = Math.max(P9b.x + 10, tagZoneX - 30);
        }
        const P10 = { x: destX, y: Math.max(tankY, tankY - Math.floor(10 * scale)) };

        // ============================================================
        // === DIBUJAR COMPONENTES ===
        // ============================================================

        // === 1. TANQUE TK-001 ===
        drawTank(ctx, tankX, tankY, tankW, tankH, headH, state, tankMeta, scale);

        // === 2. BOQUILLA ===
        drawNozzle(ctx, P0.x, P0.y, tankMeta.nozzle || 4, scale);

        // === 3. TUBERÍA: Boquilla → Válvula ===
        drawPipeSegment(ctx, P0.x, P0.y + 6, P1.y, 'vertical', pipeW, scale);

        // === 4. VÁLVULA (sin tag interno) ===
        const valveOpen = parseInt(valveSlider.value);
        drawValveCompact(ctx, P2.x, P2.y, valveOpen, state, scale);

        // === 5. TUBERÍA: Válvula → Codo ===
        drawPipeSegment(ctx, P3.x, P3.y, P4.y, 'vertical', pipeW, scale);

        // === 6. CODO SUCCIÓN ===
        drawElbow90Smooth(ctx, P4.x, P4.y, elbowR, scale);

        // === 7. TUBERÍA HORIZONTAL ===
        drawPipeSegment(ctx, P5.x, P5.y, P8.x - pipeW, 'horizontal', pipeW, scale);

        // === 8. FILTRO Y ===
        drawFilterY(ctx, P6.x, P6.y, scale);

        // === 9. REDUCCIÓN ===
        drawReduction(ctx, P7.x, P7.y, scale);

        // === 10. BOMBA ===
        drawPumpISO(ctx, P8.x, P8.y, state, scale);

        // === 11. DESCARGA HORIZONTAL ===
        drawPipeSegment(ctx, P9.x, P5.y, P9b.x, 'horizontal', pipeW, scale);

        // === 12. CODO DESCARGA ===
        drawElbow90Discharge(ctx, P9b.x, P9b.y, elbowR, scale);

        // === 13. DESCARGA VERTICAL ===
        drawPipeSegment(ctx, P10.x, P9b.y - elbowR, P10.y, 'vertical', pipeW, scale);

        // === 14. DESTINO ===
        drawDestination(ctx, P10.x, P10.y, tankMeta.discharge, scale);

        // === 15. PARTÍCULAS ===
        if (!state.alarm) {
            // P10 ya tiene la X correta (P9b.x + elbowR)
            const P9c = { x: P10.x, y: P9b.y - elbowR };
            drawFlowPath(ctx, [P0, P1, P2, P3, P4, P5, P8, P9, P9b, P9c, P10], state);
        }

        // ============================================================
        // === ZONA TAGS (derecha, separada) ===
        // ============================================================

        // Calcular posiciones dinámicamente para evitar superposición
        const panelGap = Math.floor(10 * scale);
        let currentTagY = Math.floor(40 * scale);

        // Definir datos de los paneles
        const tagPanels = [
            {
                tag: 'V-001',
                title: 'Válvula',
                rows: [
                    { label: 'Apertura', value: `${valveOpen}%`, color: valveOpen > 20 ? '#00ff88' : '#ff4444' },
                    { label: 'ΔP', value: `${((state.dp_valve || 0) * 10.1972).toFixed(2)} mca` }
                ]
            },
            {
                tag: 'P-001',
                title: (() => {
                    const pumpTypeSelect = document.getElementById('pump_type');
                    if (pumpTypeSelect) {
                        const selectedOption = pumpTypeSelect.options[pumpTypeSelect.selectedIndex];
                        return selectedOption ? selectedOption.text : 'Bomba';
                    }
                    return 'Bomba';
                })(),
                rows: [
                    { label: 'Estado', value: state.alarm ? 'ALARMA' : 'OK', color: state.alarm ? '#ff4444' : '#00ff88' },
                    { label: 'NPSHa', value: `${(state.npsh_a || 0).toFixed(2)} m` },
                    { label: 'NPSHr', value: `${(state.npsh_r || 0).toFixed(2)} m` },
                    { label: 'Potencia', value: `${(state.pump_power_kw || 0).toFixed(2)} kW` }
                ]
            },
            {
                tag: 'FI-001',
                title: 'Succión',
                rows: [
                    {
                        label: 'Velocidad', value: `${(state.velocity_ms || 0).toFixed(2)} m/s`,
                        color: state.velocity_ms > 3 ? '#ff4444' : state.velocity_ms > 1.8 ? '#ffaa00' : '#00ff88'
                    },
                    { label: 'Caudal', value: `${(state.flow_m3h || 0).toFixed(1)} m³/h` },
                    { label: 'Re', value: `${(state.reynolds || 0).toFixed(0)}` },
                    { label: 'Régimen', value: state.flow_regime || '--', color: state.flow_regime === 'Turbulento' ? '#00ff88' : state.flow_regime === 'Laminar' ? '#ffaa00' : '#ff9900' },
                    { label: 'P desc', value: `${((state.pressure_discharge_bar || 0) * 10.1972).toFixed(2)} mca` }
                ]
            },
            {
                tag: 'TI-001',
                title: 'Tiempo Real',
                rows: [
                    { label: 'Tiempo', value: `${(state.time / 60).toFixed(2)} min`, color: COLORS.accent },
                    { label: 'Nivel', value: `${state.level.toFixed(2)} m` },
                    { label: 'Volumen', value: `${state.volume.toFixed(2)} m³` },
                    { label: 'Vaciado', value: `${((1 - state.volume / tankMeta.vol_total) * 100).toFixed(1)} %` }
                ]
            }
        ];

        // Dibujar paneles con posiciones dinámicas
        tagPanels.forEach(panel => {
            const panelH = Math.floor(22 * scale) + panel.rows.length * Math.floor(20 * scale);
            drawTagPanel(ctx, tagZoneX, currentTagY, panel.tag, panel.title, panel.rows, scale);
            currentTagY += panelH + panelGap;
        });

        // ============================================================
        // === INDICADORES GENERALES ===
        // ============================================================

        // Indicador de nivel (izquierda del tanque)
        drawLevelIndicator(ctx, tankX - 25, tankY, tankH + 2 * headH, state, tankMeta, scale);

        // Barra de progreso (abajo)
        drawProgressBar(ctx, 15, H - 25, tagZoneX - 25, state, tankMeta, scale);

        // === ALARMA ===
        if (state.alarm) {
            drawAlarmOverlay(ctx, W, H, state);
        }
    }

    // === NUEVA FUNCIÓN: Tag Panel Profesional ===
    function drawTagPanel(ctx, x, y, tag, title, rows, scale = 1) {
        const panelW = Math.floor(120 * scale);
        const panelH = Math.floor(22 * scale) + rows.length * Math.floor(20 * scale);
        const radius = Math.floor(6 * scale);
        const headerH = Math.floor(18 * scale);
        const padding = Math.floor(6 * scale);

        // Fondo glassmorphism
        ctx.fillStyle = 'rgba(20, 25, 40, 0.9)';
        ctx.strokeStyle = 'rgba(96, 205, 255, 0.7)';
        ctx.lineWidth = Math.max(1, Math.floor(1.5 * scale));
        ctx.beginPath();
        ctx.roundRect(x, y, panelW, panelH, radius);
        ctx.fill();
        ctx.stroke();

        // Header con gradiente
        const headerGrad = ctx.createLinearGradient(x, y, x + panelW, y);
        headerGrad.addColorStop(0, 'rgba(96, 205, 255, 0.35)');
        headerGrad.addColorStop(1, 'rgba(96, 205, 255, 0.1)');
        ctx.fillStyle = headerGrad;
        ctx.beginPath();
        ctx.roundRect(x, y, panelW, headerH, [radius, radius, 0, 0]);
        ctx.fill();

        // Tag ID
        ctx.fillStyle = '#60cdff';
        ctx.font = `bold ${Math.floor(11 * scale)}px Consolas`;
        ctx.textAlign = 'left';
        ctx.fillText(tag, x + padding, y + Math.floor(13 * scale));

        // Title
        ctx.fillStyle = '#bbb';
        ctx.font = `${Math.floor(10 * scale)}px Consolas`;
        ctx.textAlign = 'right';
        ctx.fillText(title, x + panelW - padding, y + Math.floor(13 * scale));

        // Rows
        rows.forEach((row, i) => {
            const rowY = y + Math.floor(35 * scale) + i * Math.floor(18 * scale);
            ctx.fillStyle = '#999';
            ctx.font = `${Math.floor(10 * scale)}px Consolas`;
            ctx.textAlign = 'left';
            ctx.fillText(row.label + ':', x + padding, rowY);

            ctx.fillStyle = row.color || '#fff';
            ctx.font = `bold ${Math.floor(11 * scale)}px Consolas`;
            ctx.textAlign = 'right';
            ctx.fillText(row.value, x + panelW - padding, rowY);
        });

        // Restaurar alineación
        ctx.textAlign = 'left';
    }

    // === FUNCIÓN: Segmento de tubería conectado ===
    function drawPipeSegment(ctx, x, y1, y2OrX2, orientation, pipeWParam = 10, scale = 1) {
        const pipeW = Math.floor(pipeWParam * scale) || 10;
        const pipeGrad = ctx.createLinearGradient(
            orientation === 'vertical' ? x - pipeW / 2 : 0,
            orientation === 'vertical' ? 0 : y1 - pipeW / 2,
            orientation === 'vertical' ? x + pipeW / 2 : 0,
            orientation === 'vertical' ? 0 : y1 + pipeW / 2
        );
        pipeGrad.addColorStop(0, COLORS.pipeStroke);
        pipeGrad.addColorStop(0.5, COLORS.pipe);
        pipeGrad.addColorStop(1, COLORS.pipeStroke);

        ctx.fillStyle = pipeGrad;
        ctx.strokeStyle = COLORS.pipeStroke;
        ctx.lineWidth = 1;

        if (orientation === 'vertical') {
            const yMin = Math.min(y1, y2OrX2);
            const height = Math.abs(y2OrX2 - y1);
            ctx.fillRect(x - pipeW / 2, yMin, pipeW, height);
            ctx.strokeRect(x - pipeW / 2, yMin, pipeW, height);
        } else {
            const xMin = Math.min(x, y2OrX2);
            const width = Math.abs(y2OrX2 - x);
            ctx.fillRect(xMin, y1 - pipeW / 2, width, pipeW);
            ctx.strokeRect(xMin, y1 - pipeW / 2, width, pipeW);
        }
    }

    // === FUNCIÓN: Válvula Compacta (XL Size) ===
    function drawValveCompact(ctx, x, y, openPercent, state, scale = 1) {
        ctx.save();
        ctx.translate(x, y);

        const isOpen = openPercent > 10;
        const color = isOpen ? COLORS.valve : COLORS.valveClosed;

        // Dimensiones escaladas
        const valveW = Math.floor(22 * scale);
        const valveH = Math.floor(28 * scale);
        const discRW = Math.floor(5 * scale);
        const discRH = Math.floor(20 * scale);
        const stemW = Math.floor(4 * scale);
        const stemH = Math.floor(50 * scale);
        const stemLen = Math.floor(25 * scale);
        const actuatorR = Math.floor(16 * scale);
        const tagX = Math.floor(35 * scale);
        const tagY = Math.floor(35 * scale);
        const tagW = Math.floor(90 * scale);
        const tagH = Math.floor(60 * scale);

        // Cuerpo de la válvula (símbolo ISO: dos triángulos opuestos ><)
        ctx.strokeStyle = color;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = Math.max(1, Math.floor(3 * scale));

        // Triángulo superior (apunta hacia abajo)
        ctx.beginPath();
        ctx.moveTo(-valveW, -valveH);
        ctx.lineTo(valveW, -valveH);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Triángulo inferior (apunta hacia arriba)
        ctx.beginPath();
        ctx.moveTo(-valveW, valveH);
        ctx.lineTo(valveW, valveH);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // === DISCO ANIMADO DE LA VÁLVULA ===
        const discAngle = (openPercent / 100) * (Math.PI / 2); // 0 a 90 grados

        ctx.save();
        ctx.rotate(discAngle - Math.PI / 2); // Empezar horizontal

        // Disco de la válvula
        ctx.fillStyle = isOpen ? '#2d8a4e' : '#8a2d2d';
        ctx.strokeStyle = isOpen ? '#45c969' : '#c94545';
        ctx.lineWidth = Math.max(1, Math.floor(3 * scale));
        ctx.beginPath();
        ctx.ellipse(0, 0, discRW, discRH, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();

        // Vástago
        ctx.fillStyle = '#555';
        ctx.fillRect(-stemW / 2, -stemH, stemW, stemLen);

        // Actuador (volante) con indicador de posición
        ctx.beginPath();
        ctx.arc(0, -Math.floor(60 * scale), actuatorR, 0, Math.PI * 2);
        ctx.fillStyle = isOpen ? '#336633' : '#663333';
        ctx.fill();
        ctx.strokeStyle = '#888';
        ctx.lineWidth = Math.max(1, Math.floor(3 * scale));
        ctx.stroke();

        // Indicador de posición en volante
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = Math.max(1, Math.floor(3 * scale));
        ctx.beginPath();
        const actuatorY = -Math.floor(60 * scale);
        ctx.moveTo(0, actuatorY);
        const indicatorAngle = -Math.PI / 2 + (openPercent / 100) * Math.PI;
        ctx.lineTo(Math.cos(indicatorAngle) * Math.floor(12 * scale), actuatorY + Math.sin(indicatorAngle) * Math.floor(12 * scale));
        ctx.stroke();

        ctx.restore();

        // TAG de la válvula (derecha mejorada)
        ctx.fillStyle = COLORS.panel;
        ctx.fillRect(x + tagX, y - tagY, tagW, tagH);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, Math.floor(2 * scale));
        ctx.strokeRect(x + tagX, y - tagY, tagW, tagH);

        ctx.fillStyle = COLORS.warning;
        ctx.font = `bold ${Math.floor(12 * scale)}px Consolas`;
        ctx.textAlign = 'left';
        ctx.fillText('V-001', x + Math.floor(42 * scale), y - Math.floor(18 * scale));

        ctx.fillStyle = isOpen ? '#00ff88' : '#ff4444';
        ctx.font = `bold ${Math.floor(13 * scale)}px Consolas`;
        ctx.fillText(`${openPercent}%`, x + Math.floor(85 * scale), y - Math.floor(18 * scale));

        ctx.fillStyle = COLORS.text;
        ctx.font = `${Math.floor(11 * scale)}px Consolas`;
        ctx.fillText(`ΔP: ${(state.dp_valve || 0).toFixed(2)} bar`, x + Math.floor(42 * scale), y + Math.floor(2 * scale));
        ctx.fillText(`Q: ${(state.flow_m3h || 0).toFixed(1)} m³/h`, x + Math.floor(42 * scale), y + Math.floor(16 * scale));
    }

    // === NUEVA FUNCIÓN: Codo suave ===
    function drawElbow90Smooth(ctx, x, y, radius, scale = 1) {
        const pipeW = Math.floor(10 * scale);

        // Dibujar el codo como un arco
        ctx.strokeStyle = COLORS.pipe;
        ctx.lineWidth = pipeW;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.arc(x + radius, y, radius, Math.PI, Math.PI * 0.5, true);
        ctx.stroke();

        // Bordes del codo
        ctx.strokeStyle = COLORS.pipeStroke;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x + radius, y, radius + pipeW / 2, Math.PI, Math.PI * 0.5, true);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + radius, y, radius - pipeW / 2, Math.PI, Math.PI * 0.5, true);
        ctx.stroke();
    }

    // === NUEVA FUNCIÓN: Codo descarga (horizontal → vertical arriba) ===
    function drawElbow90Discharge(ctx, x, y, radius, scale = 1) {
        const pipeW = Math.floor(10 * scale);

        // Codo: de horizontal (izquierda) a vertical (arriba)
        // Centro en (x, y - radius)
        ctx.strokeStyle = COLORS.pipe;
        ctx.lineWidth = pipeW;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.arc(x, y - radius, radius, Math.PI * 0.5, 0, true);
        ctx.stroke();

        // Bordes del codo
        ctx.strokeStyle = COLORS.pipeStroke;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y - radius, radius + pipeW / 2, Math.PI * 0.5, 0, true);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y - radius, radius - pipeW / 2, Math.PI * 0.5, 0, true);
        ctx.stroke();
    }

    // === NUEVA FUNCIÓN: Flujo animado en el path ===
    function drawFlowPath(ctx, points, state) {
        if (state.alarm) return;

        const t = Date.now() / 50;
        ctx.fillStyle = 'rgba(100, 200, 255, 0.8)';

        // Dibujar partículas a lo largo del camino
        for (let i = 0; i < 15; i++) {
            const offset = (t + i * 20) % 100;
            const progress = offset / 100;

            // Simplificación: interpolar entre puntos clave
            const totalPoints = points.length - 1;
            const segment = Math.floor(progress * totalPoints);
            const segProgress = (progress * totalPoints) - segment;

            if (segment < totalPoints) {
                const p1 = points[segment];
                const p2 = points[segment + 1];
                const px = p1.x + (p2.x - p1.x) * segProgress;
                const py = p1.y + (p2.y - p1.y) * segProgress;

                ctx.beginPath();
                ctx.arc(px, py, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // === FUNCIONES DE DIBUJO P&ID ===

    function drawTank(ctx, x, y, w, h, headH, state, meta, scale = 1) {
        const totalH = h + 2 * headH;

        // Sombra del tanque
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = Math.floor(15 * scale);
        ctx.shadowOffsetX = Math.floor(5 * scale);
        ctx.shadowOffsetY = Math.floor(5 * scale);

        // Cuerpo del tanque (gradiente metálico)
        const tankGrad = ctx.createLinearGradient(x, y, x + w, y);
        tankGrad.addColorStop(0, '#4a5568');
        tankGrad.addColorStop(0.3, '#718096');
        tankGrad.addColorStop(0.7, '#718096');
        tankGrad.addColorStop(1, '#4a5568');

        // Tapa superior torisférica
        ctx.beginPath();
        ctx.moveTo(x, y + headH);
        ctx.bezierCurveTo(x, y, x + w, y, x + w, y + headH);
        ctx.fillStyle = tankGrad;
        ctx.fill();
        ctx.strokeStyle = COLORS.tankStroke;
        ctx.lineWidth = Math.max(1, Math.floor(2 * scale));
        ctx.stroke();

        // Cuerpo cilíndrico
        ctx.fillRect(x, y + headH, w, h);
        ctx.strokeRect(x, y + headH, w, h);

        // Tapa inferior torisférica
        ctx.beginPath();
        ctx.moveTo(x, y + headH + h);
        ctx.bezierCurveTo(x, y + totalH, x + w, y + totalH, x + w, y + headH + h);
        ctx.fill();
        ctx.stroke();

        ctx.shadowColor = 'transparent';

        // === LÍQUIDO ===
        const levelRatio = state.level / (meta.H + 2 * meta.h_head);
        const liquidH = Math.max(0, levelRatio * totalH);
        const liquidY = y + totalH - liquidH;

        if (liquidH > 0) {
            ctx.save();
            ctx.beginPath();

            // Clip para el líquido dentro del tanque
            const clipOffset = Math.floor(2 * scale);
            ctx.moveTo(x + clipOffset, y + headH);
            ctx.bezierCurveTo(x + clipOffset, y + clipOffset, x + w - clipOffset, y + clipOffset, x + w - clipOffset, y + headH);
            ctx.lineTo(x + w - clipOffset, y + headH + h);
            ctx.bezierCurveTo(x + w - clipOffset, y + totalH - clipOffset, x + clipOffset, y + totalH - clipOffset, x + clipOffset, y + headH + h);
            ctx.closePath();
            ctx.clip();

            // Gradiente del líquido
            const liqGrad = ctx.createLinearGradient(x, liquidY, x, y + totalH);
            liqGrad.addColorStop(0, 'rgba(0, 170, 255, 0.7)');
            liqGrad.addColorStop(1, 'rgba(0, 102, 204, 0.9)');

            ctx.fillStyle = liqGrad;
            ctx.fillRect(x, liquidY, w, liquidH);

            // Ondulación de superficie
            if (!state.alarm) {
                ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                ctx.lineWidth = Math.max(1, Math.floor(2 * scale));
                ctx.beginPath();
                const waveTime = Date.now() / 500;
                const waveStep = Math.max(1, Math.floor(3 * scale));
                for (let i = 0; i <= w; i += waveStep) {
                    const waveY = liquidY + Math.sin(waveTime + i * 0.1) * Math.floor(2 * scale);
                    if (i === 0) ctx.moveTo(x + i, waveY);
                    else ctx.lineTo(x + i, waveY);
                }
                ctx.stroke();
            }

            ctx.restore();
        }

        // === TAG DEL TANQUE ===
        const tagOffsetX = Math.floor(10 * scale);
        const tagOffsetY = Math.floor(10 * scale);
        const tagW = Math.floor(70 * scale);
        const tagH = Math.floor(50 * scale);
        const tagPadding = Math.floor(15 * scale);

        ctx.fillStyle = COLORS.panel;
        ctx.fillRect(x + w + tagOffsetX, y + tagOffsetY, tagW, tagH);
        ctx.strokeStyle = COLORS.panelBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + w + tagOffsetX, y + tagOffsetY, tagW, tagH);

        ctx.fillStyle = COLORS.accent;
        ctx.font = `bold ${Math.floor(11 * scale)}px Consolas`;
        ctx.fillText('TK-001', x + w + tagPadding, y + Math.floor(26 * scale));
        ctx.fillStyle = COLORS.text;
        ctx.font = `${Math.floor(10 * scale)}px Consolas`;
        ctx.fillText(`D=${meta.D.toFixed(1)}m`, x + w + tagPadding, y + Math.floor(40 * scale));
        ctx.fillText(`H=${meta.H.toFixed(1)}m`, x + w + tagPadding, y + Math.floor(52 * scale));

        // Líneas de doble pared (estilo técnico)
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 0.5;
        const innerOffset = Math.floor(3 * scale);
        ctx.strokeRect(x + innerOffset, y + headH + innerOffset, w - 2 * innerOffset, h - 2 * innerOffset);
    }

    function drawNozzle(ctx, x, y, size, scale = 1) {
        const w = Math.floor(30 * scale);
        const h = Math.floor(8 * scale);
        const offset = Math.floor(15 * scale);

        // Brida
        ctx.fillStyle = '#5a5a5a';
        ctx.fillRect(x - offset, y - Math.floor(3 * scale), w, h);
        ctx.strokeStyle = COLORS.steelLight;
        ctx.lineWidth = 1;
        ctx.strokeRect(x - offset, y - Math.floor(3 * scale), w, h);

        // Tubo de boquilla
        const tw = Math.floor(16 * scale);
        const th = Math.floor(15 * scale);
        ctx.fillStyle = '#4a4a4a';
        ctx.fillRect(x - tw / 2, y + Math.floor(5 * scale), tw, th);
        ctx.strokeRect(x - tw / 2, y + Math.floor(5 * scale), tw, th);

        // Etiqueta
        ctx.fillStyle = COLORS.textSecondary;
        ctx.font = `${Math.floor(9 * scale)}px Consolas`;
        ctx.fillText(`${size}" NPS`, x + Math.floor(20 * scale), y + Math.floor(15 * scale));
    }

    function drawFilterY(ctx, x, y, scale = 1) {
        ctx.save();
        ctx.translate(x, y);

        // Dimensiones escaladas
        const bodyW = Math.floor(15 * scale);
        const bodyH = Math.floor(8 * scale);
        const yBranchH = Math.floor(25 * scale);
        const yBranchW = Math.floor(10 * scale);
        const gridSpacing = Math.floor(4 * scale);
        const gridH = Math.floor(6 * scale);
        const tagOffset = Math.floor(38 * scale);

        // Cuerpo del filtro Y
        ctx.fillStyle = '#2d5a3d';
        ctx.strokeStyle = COLORS.steelLight;
        ctx.lineWidth = Math.max(1, Math.floor(1.5 * scale));

        ctx.beginPath();
        ctx.moveTo(-bodyW, -bodyH);
        ctx.lineTo(bodyW, -bodyH);
        ctx.lineTo(bodyW, bodyH);
        ctx.lineTo(-bodyW, bodyH);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Rama Y (filtro)
        ctx.beginPath();
        ctx.moveTo(0, bodyH);
        ctx.lineTo(-yBranchW, yBranchH);
        ctx.lineTo(yBranchW, yBranchH);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Malla
        ctx.strokeStyle = '#4a8a5a';
        ctx.lineWidth = 0.5;
        for (let i = -yBranchW; i <= yBranchW; i += gridSpacing) {
            ctx.beginPath();
            ctx.moveTo(i, -gridH);
            ctx.lineTo(i, gridH);
            ctx.stroke();
        }

        ctx.restore();

        // TAG
        ctx.fillStyle = COLORS.textMuted;
        ctx.font = `${Math.floor(9 * scale)}px Consolas`;
        ctx.fillText('F-001', x - Math.floor(12 * scale), y + tagOffset);
    }

    function drawReduction(ctx, x, y, scale = 1) {
        ctx.save();
        ctx.translate(x, y);

        // Dimensiones escaladas
        const len1 = Math.floor(15 * scale);
        const len2 = Math.floor(25 * scale);
        const h1 = Math.floor(8 * scale);
        const h2 = Math.floor(5 * scale);

        const grad = ctx.createLinearGradient(-len1, 0, len2, 0);
        grad.addColorStop(0, COLORS.pipe);
        grad.addColorStop(1, '#3a6a99');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(-len1, -h1);
        ctx.lineTo(len2, -h2);
        ctx.lineTo(len2, h2);
        ctx.lineTo(-len1, h1);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = COLORS.pipeStroke;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }

    // === NUEVA FUNCIÓN: Bomba ISO (XL Size) ===
    function drawPumpISO(ctx, x, y, state, scale = 1) {
        ctx.save();
        ctx.translate(x, y);

        const isAlarm = state.alarm;

        // Dimensiones escaladas
        const R = Math.floor(45 * scale);
        const innerR = Math.floor(30 * scale);
        const eyeR = Math.floor(12 * scale);
        const dischargeW = Math.floor(20 * scale);
        const dischargeH = Math.floor(20 * scale);
        // Panel de datos: arriba de la bomba
        const panelX = x - Math.floor(70 * scale);
        const panelY = y - Math.floor(160 * scale);
        const panelW = Math.floor(140 * scale);
        const panelH = Math.floor(90 * scale);

        // Cuerpo de bomba (círculo con espiral - ISO)
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = Math.floor(10 * scale);

        const pumpGrad = ctx.createRadialGradient(0, 0, Math.floor(8 * scale), 0, 0, R);
        pumpGrad.addColorStop(0, isAlarm ? '#553333' : '#446688');
        pumpGrad.addColorStop(1, isAlarm ? '#331111' : '#224466');

        ctx.beginPath();
        ctx.arc(0, 0, R, 0, Math.PI * 2);
        ctx.fillStyle = pumpGrad;
        ctx.fill();
        ctx.strokeStyle = isAlarm ? '#883333' : COLORS.steelLight;
        ctx.lineWidth = Math.max(1, Math.floor(3 * scale));
        ctx.stroke();

        ctx.shadowColor = 'transparent';

        // Espiral interna
        ctx.beginPath();
        ctx.arc(0, 0, innerR, 0, Math.PI * 1.7);
        ctx.strokeStyle = isAlarm ? '#664444' : '#668899';
        ctx.lineWidth = Math.max(1, Math.floor(4 * scale));
        ctx.stroke();

        // Ojo de succión
        ctx.beginPath();
        ctx.arc(0, 0, eyeR, 0, Math.PI * 2);
        ctx.fillStyle = '#1a1a2e';
        ctx.fill();

        // Descarga (hacia la derecha)
        ctx.fillStyle = COLORS.pipe;
        ctx.fillRect(R, -dischargeH / 2, dischargeW, dischargeH);
        ctx.strokeStyle = COLORS.pipeStroke;
        ctx.strokeRect(R, -dischargeH / 2, dischargeW, dischargeH);

        // Símbolo P
        ctx.fillStyle = COLORS.text;
        ctx.font = `bold ${Math.floor(20 * scale)}px Consolas`;
        ctx.fillText('P', -Math.floor(8 * scale), Math.floor(8 * scale));

        ctx.restore();

        // Panel de datos de bomba (ajustado para tamaño XL)
        ctx.fillStyle = COLORS.panel;
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = isAlarm ? COLORS.danger : COLORS.panelBorder;
        ctx.lineWidth = isAlarm ? Math.max(1, Math.floor(3 * scale)) : 1;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        ctx.fillStyle = isAlarm ? COLORS.danger : COLORS.success;
        ctx.font = `bold ${Math.floor(12 * scale)}px Consolas`;
        const pumpTypeEl = document.getElementById('pump_type');
        const pumpLabel = pumpTypeEl && pumpTypeEl.value === 'desplazamiento'
            ? 'P-001 - Bomba Desplaz. Positivo'
            : 'P-001 - Bomba Centrífuga';
        ctx.fillText(pumpLabel, panelX + Math.floor(10 * scale), panelY + Math.floor(18 * scale));

        ctx.fillStyle = COLORS.text;
        ctx.font = `${Math.floor(11 * scale)}px Consolas`;
        ctx.fillText(`P suc: ${(state.pressure_suction_bar * 10.1972).toFixed(3)} mca`, panelX + Math.floor(10 * scale), panelY + Math.floor(36 * scale));
        ctx.fillText(`NPSHa: ${state.npsh_a.toFixed(2)} m`, panelX + Math.floor(10 * scale), panelY + Math.floor(52 * scale));
        ctx.fillText(`NPSHr: ${state.npsh_r.toFixed(2)} m`, panelX + Math.floor(10 * scale), panelY + Math.floor(68 * scale));

        const margin = state.npsh_a - 1.2 * state.npsh_r;
        ctx.fillStyle = margin > 0 ? COLORS.success : COLORS.danger;
        ctx.font = `bold ${Math.floor(11 * scale)}px Consolas`;
        ctx.fillText(`Margen: ${margin.toFixed(2)} m`, panelX + Math.floor(10 * scale), panelY + Math.floor(84 * scale));
    }

    function drawDestination(ctx, x, y, discharge, scale = 1) {
        // Dimensiones escaladas
        const destW = Math.floor(50 * scale);
        const destH = Math.floor(35 * scale);
        const destOffsetX = Math.floor(25 * scale);
        const destOffsetY = Math.floor(40 * scale);

        // Símbolo de destino/proceso
        ctx.fillStyle = COLORS.panel;
        ctx.strokeStyle = COLORS.panelBorder;
        ctx.lineWidth = Math.max(1, Math.floor(2 * scale));

        // Rectángulo de destino
        ctx.fillRect(x - destOffsetX, y - destOffsetY, destW, destH);
        ctx.strokeRect(x - destOffsetX, y - destOffsetY, destW, destH);

        // Texto
        ctx.fillStyle = COLORS.accent;
        ctx.font = `bold ${Math.floor(10 * scale)}px Consolas`;
        ctx.fillText('DESTINO', x - Math.floor(22 * scale), y - Math.floor(25 * scale));

        ctx.fillStyle = COLORS.text;
        ctx.font = `${Math.floor(9 * scale)}px Consolas`;
        const pressure = discharge?.pressure || 2;
        ctx.fillText(`P: ${pressure.toFixed(1)} bar g`, x - Math.floor(20 * scale), y - Math.floor(12 * scale));

        // Indicador de altura estática
        const height = discharge?.height || 10;
        ctx.fillStyle = COLORS.warning;
        ctx.font = `${Math.floor(9 * scale)}px Consolas`;
        ctx.fillText(`H: ${height.toFixed(1)} m`, x + Math.floor(30 * scale), y + Math.floor(30 * scale));

        // Línea de cota de altura
        ctx.strokeStyle = COLORS.warning;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x + Math.floor(25 * scale), y - Math.floor(5 * scale));
        ctx.lineTo(x + Math.floor(50 * scale), y - Math.floor(5 * scale));
        ctx.lineTo(x + Math.floor(50 * scale), y + Math.floor(60 * scale));
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function drawLevelIndicator(ctx, x, y, totalH, state, meta, scale = 1) {
        const indicatorH = totalH;
        const indicatorW = Math.floor(20 * scale);

        // Marco del indicador
        ctx.fillStyle = COLORS.panel;
        ctx.fillRect(x, y, indicatorW, indicatorH);
        ctx.strokeStyle = COLORS.panelBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, indicatorW, indicatorH);

        // Nivel actual
        const levelRatio = state.level / (meta.H + 2 * meta.h_head);
        const levelH = levelRatio * indicatorH;

        const levelGrad = ctx.createLinearGradient(x, y + indicatorH - levelH, x, y + indicatorH);
        levelGrad.addColorStop(0, COLORS.liquid);
        levelGrad.addColorStop(1, COLORS.liquidDark);

        ctx.fillStyle = levelGrad;
        ctx.fillRect(x + Math.floor(2 * scale), y + indicatorH - levelH, indicatorW - Math.floor(4 * scale), levelH);

        // Escala
        ctx.fillStyle = COLORS.textMuted;
        ctx.font = `${Math.floor(8 * scale)}px Consolas`;
        const totalLevel = meta.H + 2 * meta.h_head;
        for (let i = 0; i <= 4; i++) {
            const yPos = y + indicatorH - (i / 4) * indicatorH;
            const levelVal = (i / 4) * totalLevel;
            ctx.fillText(levelVal.toFixed(1), x - Math.floor(25 * scale), yPos + Math.floor(3 * scale));

            ctx.strokeStyle = COLORS.textMuted;
            ctx.beginPath();
            ctx.moveTo(x - Math.floor(3 * scale), yPos);
            ctx.lineTo(x, yPos);
            ctx.stroke();
        }

        // TAG
        ctx.fillStyle = COLORS.accent;
        ctx.font = `bold ${Math.floor(9 * scale)}px Consolas`;
        ctx.fillText('LI-001', x - Math.floor(5 * scale), y - Math.floor(8 * scale));
    }

    function drawProgressBar(ctx, x, y, width, state, meta, scale = 1) {
        const barH = Math.floor(20 * scale);
        const progress = state.volume / meta.vol_total;

        // Fondo
        ctx.fillStyle = COLORS.panel;
        ctx.fillRect(x, y, width, barH);
        ctx.strokeStyle = COLORS.panelBorder;
        ctx.strokeRect(x, y, width, barH);

        // Barra de progreso
        const progGrad = ctx.createLinearGradient(x, y, x + width * progress, y);
        progGrad.addColorStop(0, COLORS.liquidDark);
        progGrad.addColorStop(1, COLORS.liquid);

        ctx.fillStyle = progGrad;
        ctx.fillRect(x + Math.floor(2 * scale), y + Math.floor(2 * scale), (width - Math.floor(4 * scale)) * progress, barH - Math.floor(4 * scale));

        // Texto
        ctx.fillStyle = COLORS.text;
        ctx.font = `bold ${Math.floor(11 * scale)}px Consolas`;
        const percent = (progress * 100).toFixed(1);
        ctx.fillText(`Vaciado: ${(100 - progress * 100).toFixed(1)}%  |  Restante: ${percent}%  |  Vol: ${state.volume.toFixed(2)} m³`, x + Math.floor(10 * scale), y + Math.floor(14 * scale));
    }

    function drawAlarmOverlay(ctx, W, H, state) {
        // Overlay rojo parpadeante
        const alpha = 0.3 + 0.1 * Math.sin(Date.now() / 200);
        ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
        ctx.fillRect(0, 0, W, H);

        // Mensaje de alarma
        ctx.fillStyle = COLORS.panel;
        ctx.fillRect(W / 2 - 180, H / 2 - 50, 360, 100);
        ctx.strokeStyle = COLORS.danger;
        ctx.lineWidth = 3;
        ctx.strokeRect(W / 2 - 180, H / 2 - 50, 360, 100);

        ctx.fillStyle = COLORS.danger;
        ctx.font = 'bold 18px Consolas';
        ctx.textAlign = 'center';
        ctx.fillText('⚠ ALARMA: CAVITACIÓN ⚠', W / 2, H / 2 - 20);

        ctx.fillStyle = COLORS.text;
        ctx.font = '14px Consolas';
        ctx.fillText(`NPSHa (${state.npsh_a.toFixed(2)} m) < 1.2 × NPSHr (${(1.2 * state.npsh_r).toFixed(2)} m)`, W / 2, H / 2 + 5);
        ctx.fillText('BOMBA DETENIDA - RIESGO DE DAÑO', W / 2, H / 2 + 30);

        ctx.textAlign = 'left';
    }

    // === DIBUJO INICIAL ===
    function drawInitialGA1() {
        const dpr = window.devicePixelRatio || 1;
        const rect = ga1Canvas.getBoundingClientRect();
        ga1Canvas.width = rect.width * dpr;
        ga1Canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const bgGrad = ctx.createLinearGradient(0, 0, 0, rect.height);
        bgGrad.addColorStop(0, COLORS.background);
        bgGrad.addColorStop(1, COLORS.backgroundGradient);
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, rect.width, rect.height);

        ctx.fillStyle = COLORS.textMuted;
        ctx.font = '14px Consolas';
        ctx.textAlign = 'center';
        ctx.fillText('Configure los parámetros e inicie la simulación', rect.width / 2, rect.height / 2);
        ctx.textAlign = 'left';
    }

    drawInitialGA1();
    window.addEventListener('resize', () => {
        if (simulationData && currentFrame < simulationData.length) {
            drawGA1(simulationData[currentFrame]);
        } else {
            drawInitialGA1();
        }
    });
});


// === LOGICA DE MODO DE CALCULO ===
// function toggleCalcMode removed as input was deleted

// Toggle de inputs de bomba según modo
window.togglePumpInputs = function () {
    const mode = document.getElementById('calc_mode').value;
    const curveSection = document.getElementById('pump-curve-section');
    const pointSection = document.getElementById('pump-point-section');

    if (mode === 'flow_fixed') {
        curveSection.style.display = 'none';
        pointSection.style.display = 'block';
    } else {
        curveSection.style.display = 'block';
        pointSection.style.display = 'none';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const calcModeSelect = document.getElementById('calc_mode');
    if (calcModeSelect) {
        // toggleCalcMode(); // Removed
        togglePumpInputs();
        calcModeSelect.addEventListener('change', togglePumpInputs); // Only toggle pump inputs
    }
});
