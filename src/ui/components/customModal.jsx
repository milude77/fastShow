import React from 'react';
import ReactDOM from 'react-dom';
import './../css/CustomModal.css';

const CustomModal = ({ isOpen, children }) => {
  if (!isOpen) {
    return null;
  }

  return ReactDOM.createPortal(
    <div className="modal-overlay" >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.getElementById('modal-root') 
  );
};

export default CustomModal;
