import ReactDOM from 'react-dom';
import './css/CustomModal.css';
import { AntdMessageProvider } from '../../context/AntdMeaageContext.jsx';

const CustomModal = ({ isOpen, children }) => {
  if (!isOpen) {
    return null;
  }

  return ReactDOM.createPortal(
    <AntdMessageProvider>
      <div className="modal-overlay" >
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </AntdMessageProvider>,
    document.getElementById('modal-root')
  );
};

export default CustomModal;
