import './css/SettingsAPP.css'


function SettingsAPP() {
    const handleSwitchUser = () => {
        window.electronAPI.switchUser();
    }

    const handleLogout = () => {
        window.electronAPI.logout();
    }



    return (
        <div className="settings-app" style={{ display: 'flex', alignItems: 'center' }}>
            <div className='tool-bar'>
                工具栏·
            </div>
            <div>
                <button onClick={handleSwitchUser}>切换用户</button>
                <button onClick={handleLogout}>退出登录</button>
            </div>
        </div>
    );
}

export default SettingsAPP;
