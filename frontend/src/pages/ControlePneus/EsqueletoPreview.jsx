import React from 'react';
import IconPneus from '../../customicons/IconPneus.jsx';

function EsqueletoPreview({ configuracao, inspecao, onPneuClick }) {
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

    // --- Mapeamento e Numeração ---
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
        const numero = String(positionCounter++).padStart(2, '0');
        const dadosInspecao = inspecao ? (inspecao[numero] || null) : null;
        eixo.pneus.push({ ...pneu, numero, dados: dadosInspecao });
    });


    // --- Renderização SVG ---
    const elements = [];
    const SVG_HEIGHT = currentY;
    const centerX = SVG_WIDTH / 2;

    if (eixos.length >= 2) {
        const primeiroEixoY = eixos[0].y;
        const ultimoEixoY = eixos[eixos.length - 1].y;
        elements.push(<line key="chassi-line" x1={centerX} y1={primeiroEixoY} x2={centerX} y2={ultimoEixoY} className="chassi" />);
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
            let x, corFundo, corComponentes;

            // LÓGICA DE COR CONDICIONAL (inalterada, pois estava correta)
            if (inspecao) {
                // Modo Detalhamento
                if (pneu.dados?.faixa_info?.cor) {
                    corComponentes = pneu.dados.faixa_info.cor; // Cor da medição
                    corFundo = undefined; // Padrão
                } else if (pneu.dados) {
                    corComponentes = '#6c757d'; // Pneu agregado, sem medição
                    corFundo = undefined; // Padrão
                } else {
                    corComponentes = '#CED4DA'; // Posição vazia
                    corFundo = '#E9ECEF';   // Posição vazia
                }
            } else {
                // Modo Cadastro
                corFundo = undefined; // Padrão
                if (pneu.tipo === 'interno') {
                    corComponentes = '#adb5bd'; // Cinza claro para internos
                } else {
                    corComponentes = '#6c757d'; // Cinza escuro para externos/únicos
                }
            }
            
            // LÓGICA DE POSICIONAMENTO CORRIGIDA
            if (pneu.lado === 'esquerdo') {
                if (pneu.tipo === 'unico' || pneu.tipo === 'interno') {
                    // Posição INTERNA (mais próxima do centro)
                    x = tirePlacementEixoStartX - LARGURA_PNEU - 15;
                } else { // externo
                    // Posição EXTERNA (mais afastada do centro)
                    x = tirePlacementEixoStartX - (LARGURA_PNEU * 2) - ESPACAMENTO_PNEU_INTERNO - 15;
                }
            } else { // lado direito
                 if (pneu.tipo === 'unico' || pneu.tipo === 'interno') {
                    // Posição INTERNA (mais próxima do centro)
                    x = tirePlacementEixoEndX + 15;
                } else { // externo
                    // Posição EXTERNA (mais afastada do centro)
                    x = tirePlacementEixoEndX + 15 + LARGURA_PNEU + ESPACAMENTO_PNEU_INTERNO;
                }
            }
            
            const y = eixo.y - ALTURA_PNEU / 2;

            const pneuIcon = (
                <IconPneus
                    corFundo={corFundo}
                    corComponentes={corComponentes}
                    width={`${LARGURA_PNEU}px`}
                    height={`${ALTURA_PNEU}px`}
                />
            );
            
            const pneuElement = onPneuClick ? (
                <g key={`pneu-container-${eixoIndex}-${pneuIndex}`} onClick={() => onPneuClick(pneu)} className="pneu-clicavel">
                     <foreignObject x={x} y={y} width={LARGURA_PNEU} height={ALTURA_PNEU}>
                        {pneuIcon}
                    </foreignObject>
                </g>
            ) : (
                 <foreignObject key={`pneu-container-${eixoIndex}-${pneuIndex}`} x={x} y={y} width={LARGURA_PNEU} height={ALTURA_PNEU}>
                    {pneuIcon}
                </foreignObject>
            );

            elements.push(pneuElement);
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

