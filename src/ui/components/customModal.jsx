import React from 'react';
import ReactDOM from 'react-dom';
import './../css/CustomModal.css';

const CustomModal = ({ isOpen, onClose, children }) => {
  if (!isOpen) {
    return null;
  }

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.getElementById('modal-root') // 我们将模态框渲染到这个DOM节点
  );
};

export default CustomModal;
