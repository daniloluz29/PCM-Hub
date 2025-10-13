import React from 'react';
import IconPneus from '../customicons/IconPneus.jsx';

function EsqueletoPreview({ configuracao, inspecao, onPneuClick }) {
    if (!configuracao || configuracao.length === 0) {
        return (
            <div style={{ color: '#6c757d', textAlign: 'center' }}>
                O esqueleto do equipamento aparecerá aqui.
            </div>
        );
    }
    
    // --- Constantes de Desenho (inalteradas) ---
    const LARGURA_EIXO = 220;
    const LARGURA_PNEU = 30;
    const ALTURA_PNEU = 60;
    const ESPACAMENTO_PNEU_INTERNO = 5;
    const ESPACAMENTO_EIXO_NORMAL = 90;
    const ESPACAMENTO_EIXO_EXTRA = 45;
    const START_Y = 50;
    const SVG_WIDTH = 400;

    // --- Mapeamento e cálculo de posições (lógica inalterada) ---
    const eixos = [];
    let currentY = START_Y;
    configuracao.forEach((nivel) => {
        if (nivel.tipo === 'eixo') {
            eixos.push({ y: currentY, pneus: [], pneus_por_lado: nivel.pneus_por_lado });
            currentY += ESPACAMENTO_EIXO_NORMAL;
        } else if (nivel.tipo === 'espaco') {
            currentY += ESPACAMENTO_EIXO_EXTRA;
        }
    });

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
        const numeroPosicao = String(positionCounter++).padStart(2, '0');
        const dadosInspecao = inspecao ? inspecao[numeroPosicao] : null;
        eixo.pneus.push({ ...pneu, numero: numeroPosicao, dados: dadosInspecao });
    });

    // --- Renderização dos elementos SVG ---
    const elements = [];
    const SVG_HEIGHT = currentY;
    const centerX = SVG_WIDTH / 2;

    if (eixos.length >= 2) {
        elements.push(<line key="chassi-line" x1={centerX} y1={eixos[0].y} x2={centerX} y2={eixos[eixos.length - 1].y} className="chassi" />);
    }

    eixos.forEach((eixo, eixoIndex) => {
        const tirePlacementEixoStartX = centerX - LARGURA_EIXO / 2;
        const tirePlacementEixoEndX = centerX + LARGURA_EIXO / 2;
        let axleDrawStartX, axleDrawEndX;
        if (eixo.pneus_por_lado === 2) {
            axleDrawStartX = tirePlacementEixoStartX - (LARGURA_PNEU * 2) - ESPACAMENTO_PNEU_INTERNO - 10;
            axleDrawEndX = tirePlacementEixoEndX + 10 + LARGURA_PNEU + ESPACAMENTO_PNEU_INTERNO + LARGURA_PNEU;
        } else { 
            axleDrawStartX = tirePlacementEixoStartX - LARGURA_PNEU - 10;
            axleDrawEndX = tirePlacementEixoEndX + 10 + LARGURA_PNEU;
        }
        elements.push(<line key={`eixo-${eixoIndex}`} x1={axleDrawStartX} y1={eixo.y} x2={axleDrawEndX} y2={eixo.y} className="eixo" />);

        eixo.pneus.forEach((pneu, pneuIndex) => {
            let x;
            if (pneu.lado === 'esquerdo') {
                 if (pneu.tipo === 'unico' || pneu.tipo === 'externo') x = tirePlacementEixoStartX - LARGURA_PNEU - 15;
                 else x = tirePlacementEixoStartX - (LARGURA_PNEU * 2) - ESPACAMENTO_PNEU_INTERNO - 15;
            } else {
                 if (pneu.tipo === 'unico' || pneu.tipo === 'interno') x = tirePlacementEixoEndX + 15;
                 else x = tirePlacementEixoEndX + 15 + LARGURA_PNEU + ESPACAMENTO_PNEU_INTERNO;
            }
            const y = eixo.y - ALTURA_PNEU / 2;
            
            // NOVO: Lógica de cores baseada no estado do pneu.
            const isClickable = !!onPneuClick;
            let corFundoIcone, corComponentesIcone;

            if (!pneu.dados) {
                // Caso 1: Posição vazia, sem pneu agregado. Cores bem claras.
                corFundoIcone = '#E9ECEF';
                corComponentesIcone = '#CED4DA';
            } else {
                // Caso 2 e 3: Posição com pneu agregado.
                corFundoIcone = undefined; // Usa o default do IconPneus
                // Usa a cor da faixa se existir, senão o IconPneus usa seu default.
                corComponentesIcone = pneu.dados.faixa_info?.cor; 
            }

            elements.push(
                <g 
                  key={`pneu-group-${eixoIndex}-${pneuIndex}`} 
                  onClick={() => isClickable && onPneuClick(pneu)}
                  className={isClickable ? 'pneu-clicavel' : ''}
                >
                    <foreignObject x={x} y={y} width={LARGURA_PNEU} height={ALTURA_PNEU}>
                        <IconPneus
                            corFundo={corFundoIcone}
                            corComponentes={corComponentesIcone}
                            width={`${LARGURA_PNEU}px`}
                            height={`${ALTURA_PNEU}px`}
                        />
                    </foreignObject>
                    <text x={x + LARGURA_PNEU / 2} y={y + ALTURA_PNEU + 15} className="posicao-text">{pneu.numero}</text>
                </g>
            );
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

