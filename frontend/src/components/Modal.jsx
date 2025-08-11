import React from 'react';

/**
 * Um componente de Modal genérico e reutilizável com suporte a tamanhos.
 * @param {object} props - As propriedades do componente.
 * @param {boolean} props.isOpen - Se o modal deve ou não ser exibido.
 * @param {function} props.onClose - Função a ser chamada quando o modal for fechado.
 * @param {string} props.title - O título a ser exibido no cabeçalho do modal.
 * @param {React.ReactNode} props.children - Os elementos filhos que serão renderizados no corpo.
 * @param {string} [props.size='default'] - O tamanho do modal ('default', 'large', 'xl').
 */
function Modal({ isOpen, onClose, title, children, size = 'default' }) {
  if (!isOpen) {
    return null;
  }

  // Define a classe CSS com base no tamanho desejado.
  const modalSizeClass = `modal-content-${size}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-content ${modalSizeClass}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button onClick={onClose} className="modal-close-btn">&times;</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}

export default Modal;
