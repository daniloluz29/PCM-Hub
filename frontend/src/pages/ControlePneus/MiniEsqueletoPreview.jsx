import React from 'react';
import IconPneus from '../../customicons/IconPneus.jsx';

// Este componente é uma versão simplificada do EsqueletoPreview para os cards.
function MiniEsqueletoPreview({ configuracao, inspecao }) {
    // ALTERADO: Adicionada verificação para o caso de não haver layout.
    if (!configuracao || configuracao.length === 0) {
        return (
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%', 
                color: '#6c757d', 
                textAlign: 'center',
                fontSize: '12px',
                padding: '10px'
            }}>
                Layout não definido
            </div>
        );
    }
    
    // Constantes de Desenho (menores para o card)
    const LARGURA_EIXO = 55;
    const LARGURA_PNEU = 8;
    const ALTURA_PNEU = 16;
    const ESPACAMENTO_PNEU_INTERNO = 2;
    const ESPACAMENTO_EIXO_NORMAL = 22;
    const ESPACAMENTO_EIXO_EXTRA = 11;
    const START_Y = 15;
    const SVG_WIDTH = 100;

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

    const elements = [];
    const SVG_HEIGHT = currentY;
    const centerX = SVG_WIDTH / 2;

    if (eixos.length >= 2) {
        elements.push(<line key="chassi-line" x1={centerX} y1={eixos[0].y} x2={centerX} y2={eixos[eixos.length - 1].y} stroke="#adb5bd" strokeWidth="2" />);
    }

    eixos.forEach((eixo, eixoIndex) => {
        const tirePlacementEixoStartX = centerX - LARGURA_EIXO / 2;
        const tirePlacementEixoEndX = centerX + LARGURA_EIXO / 2;
        let axleDrawStartX, axleDrawEndX;
        if (eixo.pneus_por_lado === 2) {
            axleDrawStartX = tirePlacementEixoStartX - (LARGURA_PNEU * 2) - ESPACAMENTO_PNEU_INTERNO - 3;
            axleDrawEndX = tirePlacementEixoEndX + 3 + LARGURA_PNEU + ESPACAMENTO_PNEU_INTERNO + LARGURA_PNEU;
        } else { 
            axleDrawStartX = tirePlacementEixoStartX - LARGURA_PNEU - 3;
            axleDrawEndX = tirePlacementEixoEndX + 3 + LARGURA_PNEU;
        }
        elements.push(<line key={`eixo-${eixoIndex}`} x1={axleDrawStartX} y1={eixo.y} x2={axleDrawEndX} y2={eixo.y} stroke="#adb5bd" strokeWidth="2" />);

        eixo.pneus.forEach((pneu, pneuIndex) => {
            let x;
            if (pneu.lado === 'esquerdo') {
                if (pneu.tipo === 'unico' || pneu.tipo === 'externo') x = tirePlacementEixoStartX - LARGURA_PNEU - 4;
                else x = tirePlacementEixoStartX - (LARGURA_PNEU * 2) - ESPACAMENTO_PNEU_INTERNO - 4;
            } else {
                if (pneu.tipo === 'unico' || pneu.tipo === 'interno') x = tirePlacementEixoEndX + 4;
                else x = tirePlacementEixoEndX + 4 + LARGURA_PNEU + ESPACAMENTO_PNEU_INTERNO;
            }
            const y = eixo.y - ALTURA_PNEU / 2;
            
            let corFundoIcone, corComponentesIcone;
            if (!pneu.dados) {
                corFundoIcone = '#E9ECEF';
                corComponentesIcone = '#CED4DA';
            } else {
                corFundoIcone = undefined;
                corComponentesIcone = pneu.dados.faixa_info?.cor;
            }

            elements.push(
                <foreignObject key={`pneu-group-${eixoIndex}-${pneuIndex}`} x={x} y={y} width={LARGURA_PNEU} height={ALTURA_PNEU}>
                    <IconPneus corFundo={corFundoIcone} corComponentes={corComponentesIcone} />
                </foreignObject>
            );
        });
    });

    return (
        <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} width="100%" height="80px">
            {elements}
        </svg>
    );
}

export default MiniEsqueletoPreview;

