import React from 'react';

function EsqueletoPreview({ configuracao }) {
    if (!configuracao || configuracao.length === 0) {
        return (
            <div style={{ color: '#6c757d', textAlign: 'center' }}>
                O esqueleto do equipamento aparecerá aqui.
            </div>
        );
    }
    
    // --- Constantes de Desenho ---
    const LARGURA_EIXO = 220;
    const LARGURA_PNEU = 30;
    const ALTURA_PNEU = 60;
    const ESPACAMENTO_PNEU_INTERNO = 5;
    const ESPACAMENTO_EIXO_NORMAL = 90;
    const ESPACAMENTO_EIXO_EXTRA = 45;
    const START_Y = 50;
    const SVG_WIDTH = 400;

    // --- ETAPA 1: Mapear eixos e posições de pneus ---
    const eixos = [];
    let currentY = START_Y;

    configuracao.forEach((nivel) => {
        if (nivel.tipo === 'eixo') {
            const eixoAtual = { y: currentY, pneus: [], pneus_por_lado: nivel.pneus_por_lado };
            eixos.push(eixoAtual);
            currentY += ESPACAMENTO_EIXO_NORMAL;
        } else if (nivel.tipo === 'espaco') {
            currentY += ESPACAMENTO_EIXO_EXTRA;
        }
    });

    // --- ETAPA 2: Calcular a ordem de inspeção e atribuir números ---
    const slotsLadoEsquerdo = [];
    const slotsLadoDireito = [];

    eixos.forEach((eixo, index) => {
        if (eixo.pneus_por_lado === 1) {
            slotsLadoEsquerdo.push({ eixoIndex: index, tipo: 'unico', lado: 'esquerdo' });
            slotsLadoDireito.push({ eixoIndex: index, tipo: 'unico', lado: 'direito' });
        } else if (eixo.pneus_por_lado === 2) {
            slotsLadoEsquerdo.push({ eixoIndex: index, tipo: 'interno', lado: 'esquerdo' });
            slotsLadoEsquerdo.push({ eixoIndex: index, tipo: 'externo', lado: 'esquerdo' });
            slotsLadoDireito.push({ eixoIndex: index, tipo: 'interno', lado: 'direito' });
            slotsLadoDireito.push({ eixoIndex: index, tipo: 'externo', lado: 'direito' });
        }
    });

    const ordemInspecao = [];
    if (slotsLadoEsquerdo.length > 0) {
        ordemInspecao.push(slotsLadoEsquerdo.shift()); 
        ordemInspecao.push(...slotsLadoDireito);
        ordemInspecao.push(...slotsLadoEsquerdo.reverse());
    }
    
    let positionCounter = 1;
    ordemInspecao.forEach(pneu => {
        const eixo = eixos[pneu.eixoIndex];
        eixo.pneus.push({ ...pneu, numero: String(positionCounter++).padStart(2, '0') });
    });


    // --- ETAPA 3: Renderizar os elementos SVG ---
    const elements = [];
    const SVG_HEIGHT = currentY;
    const centerX = SVG_WIDTH / 2;

    // NOVO: Adicionar a linha do chassi se houver 3 ou mais eixos
    if (eixos.length >= 2) {
        const primeiroEixoY = eixos[0].y;
        const ultimoEixoY = eixos[eixos.length - 1].y;
        elements.push(<line key="chassi-line" x1={centerX} y1={primeiroEixoY} x2={centerX} y2={ultimoEixoY} className="chassi" />);
    }

    eixos.forEach((eixo, eixoIndex) => {
        const eixoStartX = centerX - LARGURA_EIXO / 2;
        const eixoEndX = centerX + LARGURA_EIXO / 2;

        elements.push(<line key={`eixo-${eixoIndex}`} x1={eixoStartX} y1={eixo.y} x2={eixoEndX} y2={eixo.y} className="eixo" />);

        eixo.pneus.forEach((pneu, pneuIndex) => {
            let x, fill;
            if (pneu.lado === 'esquerdo') {
                if (pneu.tipo === 'unico') {
                    x = eixoStartX - LARGURA_PNEU - 15;
                    fill = '#6c757d';
                } else if (pneu.tipo === 'externo') {
                    x = eixoStartX - LARGURA_PNEU - 15;
                    fill = '#6c757d';
                } else { // interno
                    x = eixoStartX - (LARGURA_PNEU * 2) - ESPACAMENTO_PNEU_INTERNO - 15;
                    fill = '#adb5bd';
                }
            } else { // lado direito
                if (pneu.tipo === 'unico') {
                    x = eixoEndX + 15;
                    fill = '#6c757d';
                } else if (pneu.tipo === 'externo') {
                    x = eixoEndX + 15 + LARGURA_PNEU + ESPACAMENTO_PNEU_INTERNO;
                    fill = '#adb5bd';
                } else { // interno
                    x = eixoEndX + 15;
                    fill = '#6c757d';
                }
            }
            
            const y = eixo.y - ALTURA_PNEU / 2;

            elements.push(<rect key={`pneu-${eixoIndex}-${pneuIndex}`} x={x} y={y} width={LARGURA_PNEU} height={ALTURA_PNEU} rx="4" className="pneu" fill={fill} />);
            elements.push(<text key={`texto-${eixoIndex}-${pneuIndex}`} x={x + LARGURA_PNEU / 2} y={y + ALTURA_PNEU + 15} className="posicao-text">{pneu.numero}</text>);
        });
    });


    return (
        <div className="esqueleto-container">
            <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="esqueleto-svg" width="100%" height="500px">
                {elements}
            </svg>
        </div>
    );
}

export default EsqueletoPreview;
