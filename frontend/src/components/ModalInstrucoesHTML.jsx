import React, { useState } from 'react';
import Modal from './Modal.jsx';
import ModalAlerta from './ModalAlerta.jsx';

const ModalInstrucoesHTML = ({ isOpen, onClose }) => {
    const [alerta, setAlerta] = useState({ aberto: false, mensagem: '' });
    const [previewHtml, setPreviewHtml] = useState('');
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

    // MODELO 1: Anúncio de Evento com comentários detalhados
    const modelo1 = `<!-- Container principal do anúncio. A altura e o layout já estão otimizados. -->
<div style="font-family: Arial, sans-serif; background-color: #1a1a1a; color: white; padding: 20px; border-radius: 8px 8px 0 0; height: 423.5px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
    <div>
        <!-- Seção do Título Principal -->
        <h2 style="text-align: center; color: #4CAF50; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; margin-top: 0;">
            <!-- EDITE AQUI: Coloque o título do seu evento -->
            [TÍTULO DO EVENTO]
        </h2>
        <!-- Parágrafo de descrição -->
        <p style="text-align: center; font-size: 16px;">
            <!-- EDITE AQUI: Escreva uma descrição curta e chamativa para o evento. -->
            [Descrição breve do evento. Chame a atenção do usuário aqui!]
        </p>
        <!-- Subtítulo para a lista de tópicos -->
        <h3 style="margin-top: 20px; color: #f1f1f1;">Tópicos Abordados:</h3>
        <!-- Lista de tópicos. O emoji '✅' é usado como marcador. -->
        <ul style="list-style-type: '✅'; padding-left: 20px;">
            <!-- EDITE AQUI: Altere os itens da lista. Você pode adicionar mais ou remover. -->
            <li style="margin-bottom: 10px;">[Tópico 1]</li>
            <li style="margin-bottom: 10px;">[Tópico 2]</li>
            <li style="margin-bottom: 10px;">[Tópico 3]</li>
        </ul>
    </div>
    <!-- Botão de Ação (link) -->
    <a href="[LINK PARA INSCRIÇÃO OU MAIS INFORMAÇÕES]" style="background-color: #4CAF50; color: white; padding: 12px; text-decoration: none; border-radius: 5px; display: block; text-align: center; font-weight: bold; margin-top: 20px;">
        <!-- EDITE AQUI: Altere o texto do botão e o link no atributo 'href' acima. -->
        Inscreva-se Agora
    </a>
</div>`;

    // MODELO 2: Comunicado Geral com comentários detalhados
    const modelo2 = `<!-- Container principal do anúncio. O layout está centralizado verticalmente e horizontalmente. -->
<div style="font-family: Arial, sans-serif; padding: 20px; text-align: center; background-color: #f0f7ff; border-left: 5px solid #007bff; border-radius: 8px 8px 0 0; height: 423.5px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; align-items: center;">
    <!-- Título do Comunicado -->
    <h2 style="color: #0056b3; margin-top: 0;">
        <!-- EDITE AQUI: Coloque o título do seu aviso. -->
        [TÍTULO DO AVISO]
    </h2>
    <!-- Parágrafo com o corpo do comunicado. -->
    <p style="color: #333; font-size: 16px; line-height: 1.6;">
        <!-- EDITE AQUI: Escreva a mensagem principal do seu comunicado. -->
        [Corpo da mensagem. Descreva aqui o comunicado, manutenção ou informação importante de forma clara e objetiva.]
    </p>
    <!-- Botão de Ação (link) -->
    <a href="[LINK PARA MAIS DETALHES]" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 15px;">
        <!-- EDITE AQUI: Altere o texto do botão e o link no atributo 'href' acima. -->
        Ver Detalhes
    </a>
</div>`;

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            setAlerta({ aberto: true, mensagem: 'Modelo copiado para a área de transferência!' });
        }, () => {
            setAlerta({ aberto: true, mensagem: 'Falha ao copiar o modelo.' });
        });
    };

    const handlePreview = (html) => {
        // Substitui os placeholders por um texto genérico para a pré-visualização
        const previewContent = html
            .replace(/\[TÍTULO DO EVENTO\]|\[TÍTULO DO AVISO\]/g, 'Título de Exemplo')
            .replace(/\[Descrição breve do evento.*?\]|\[Corpo da mensagem.*?\]/g, 'Este é um parágrafo de exemplo para preencher o espaço do conteúdo principal do anúncio.')
            .replace(/\[Tópico 1\]/g, 'Primeiro item da lista')
            .replace(/\[Tópico 2\]/g, 'Segundo item da lista')
            .replace(/\[Tópico 3\]/g, 'Terceiro item da lista')
            .replace(/\[LINK.*?\]/g, '#');
            
        setPreviewHtml(previewContent);
        setIsPreviewModalOpen(true);
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="Modelos de Anúncios HTML" size="xl">
                <div className="instructions-modal-content">
                    <div className="instructions-header">
                        <p><strong>Instruções:</strong> Copie o código de um modelo, cole na área de "Anúncio com HTML" e edite o conteúdo. Use a pré-visualização para ver como ficará.</p>
                    </div>

                    <div className="template-section">
                        <h2>Modelo 1: Evento/Workshop (Tema Escuro)</h2>
                        <textarea readOnly value={modelo1}></textarea>
                        <div className="template-actions">
                            <button onClick={() => handlePreview(modelo1)} className="preview-button">
                                <i className="bi bi-eye-fill"></i> Visualizar prévia
                            </button>
                            <button onClick={() => handleCopy(modelo1)} className="copy-button">
                                <i className="bi bi-clipboard-check"></i> Copiar Modelo
                            </button>
                        </div>
                    </div>

                    <div className="template-section">
                        <h2>Modelo 2: Comunicado Geral (Tema Claro)</h2>
                        <textarea readOnly value={modelo2}></textarea>
                        <div className="template-actions">
                             <button onClick={() => handlePreview(modelo2)} className="preview-button">
                                <i className="bi bi-eye-fill"></i> Visualizar prévia
                            </button>
                            <button onClick={() => handleCopy(modelo2)} className="copy-button">
                                 <i className="bi bi-clipboard-check"></i> Copiar Modelo
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isPreviewModalOpen} onClose={() => setIsPreviewModalOpen(false)} title="Pré-visualização do Anúncio" size='medium'>
                <div className="preview-container">
                    <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
            </Modal>

            <ModalAlerta isOpen={alerta.aberto} onClose={() => setAlerta({ aberto: false, mensagem: '' })} title="Notificação">
                <p>{alerta.mensagem}</p>
            </ModalAlerta>
        </>
    );
};

export default ModalInstrucoesHTML;

