import { useState, useEffect } from 'react'
import './App.css'
import ContactList from './contactList';
import MessageList from './messageList';

function App() {

  const [selectFeatures, setSelectFeatures] = useState('message')
  const renderFeature = () => {
    switch (selectFeatures) {
      case 'contact':
        return <ContactList />;
      case 'message':
        return <ContactList />;
      default:
        return <div>默认列表</div>;
    }
  };

  const renderInformationFunctionBar = () => {
    switch (selectFeatures) {
      case'message':
        return <MessageList />;
      default:
        return <div>默认信息栏</div>;
    }
  };


  return (
    <div className="app">
      <div className='app-features-bar'>
        <button onClick={() => setSelectFeatures('message')}>消息</button>
        <button onClick={() => setSelectFeatures('contact')}>联系人</button>
      </div>
      <div className='contact-list'>
        {renderFeature()}
      </div>
      <div className='message-box'>
        {renderInformationFunctionBar()}
      </div>
    </div>
  )
}

export default App
