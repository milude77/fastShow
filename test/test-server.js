// 简单的服务器测试脚本
import fetch from 'node-fetch';

const SERVER_URL = 'http://localhost:3001';

async function testServer() {
    console.log('🧪 开始测试聊天服务器...\n');

    try {
        // 测试健康检查
        console.log('1. 测试健康检查 API...');
        const healthResponse = await fetch(`${SERVER_URL}/api/health`);
        const healthData = await healthResponse.json();
        console.log('✅ 健康检查通过:', healthData);
        console.log('');

        // 测试房间列表
        console.log('2. 测试房间列表 API...');
        const roomsResponse = await fetch(`${SERVER_URL}/api/rooms`);
        const roomsData = await roomsResponse.json();
        console.log('✅ 房间列表获取成功:', roomsData);
        console.log('');

        // 测试获取公共房间消息
        console.log('3. 测试获取房间消息 API...');
        const messagesResponse = await fetch(`${SERVER_URL}/api/room/public/messages`);
        const messagesData = await messagesResponse.json();
        console.log('✅ 房间消息获取成功:', messagesData);
        console.log('');

        console.log('🎉 所有 API 测试通过！');
        console.log('💡 提示：你可以打开 client-example/chat-client.html 来测试 WebSocket 功能');

    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.log('请确保服务器正在运行：npm run server');
    }
}

// 如果直接运行此脚本则执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
    testServer();
}

export default testServer;
