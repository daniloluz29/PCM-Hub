import React from 'react';

/**
 * Componente que renderiza um ícone de pneu customizado com base em CSS.
 * @param {object} props - Propriedades do componente.
 * @param {string} [props.corFundo='#4a4a4a'] - A cor de fundo (carcaça) do pneu.
 * @param {string} [props.corComponentes='#888888'] - A cor dos blocos e sulcos do pneu.
 * @param {string} [props.width='30px'] - A largura do ícone.
 * @param {string} [props.height='60px'] - A altura do ícone.
 */
// ALTERADO: Cores padrão foram clareadas.
function IconPneus({ corFundo = '#4a4a4a', corComponentes = '#888888', width = '30px', height = '60px' }) {

    const tireStyles = {
        '--icon-pneu-cor-fundo': corFundo,
        '--icon-pneu-cor-componentes': corComponentes,
        width: width,
        height: height,
    };

    const css = `
        .icon-pneu-wrapper {
            width: 100%;
            height: 100%;
            background-color: var(--icon-pneu-cor-fundo);
            border-radius: 4px;
            padding: 2.5px;
            box-sizing: border-box;
            display: flex;
            justify-content: space-between;
            box-shadow: inset 0 0 3px rgba(0,0,0,0.4);
            overflow: hidden;
        }
        .icon-pneu-side-strip {
            width: 25%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        .icon-pneu-tread-block {
            height: 7%;
            background-color: var(--icon-pneu-cor-componentes);
            border-radius: 1px;
        }
        .icon-pneu-inner-strip {
            width: 10%;
            height: 100%;
            background-color: var(--icon-pneu-cor-componentes);
            border-radius: 1px;
        }
        .icon-pneu-chevron-column {
            width: 30%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: space-around;
        }
        .icon-pneu-chevron {
            width: 100%;
            height: 14%;
            background-color: var(--icon-pneu-cor-componentes);
            clip-path: polygon(50% 100%, 0 35%, 20% 35%, 50% 80%, 80% 35%, 100% 35%);
        }
    `;

    return (
        <>
            <style>{css}</style>
            <div className="icon-pneu-wrapper" style={tireStyles}>
                <div className="icon-pneu-side-strip">
                    {[...Array(8)].map((_, i) => <div key={`l-block-${i}`} className="icon-pneu-tread-block"></div>)}
                </div>
                <div className="icon-pneu-inner-strip"></div>
                <div className="icon-pneu-chevron-column">
                    {[...Array(5)].map((_, i) => <div key={`chevron-${i}`} className="icon-pneu-chevron"></div>)}
                </div>
                <div className="icon-pneu-inner-strip"></div>
                <div className="icon-pneu-side-strip">
                     {[...Array(8)].map((_, i) => <div key={`r-block-${i}`} className="icon-pneu-tread-block"></div>)}
                </div>
            </div>
        </>
    );
}

export default IconPneus;
