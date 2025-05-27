import aedes from 'aedes';
import { createServer } from 'http';
import ws from 'websocket-stream';

const broker = aedes();
const connectedUsers = new Set();

const server = createServer();
const PORT = 1883;

ws.createServer({ server }, broker.handle);

broker.on('client', (client) => {
  console.log(`Client connected: ${client.id}`);
});

broker.on('clientDisconnect', (client) => {
  if (connectedUsers.has(client.id)) {
    connectedUsers.delete(client.id);
    console.log(`Client ${client.id} disconnected`);
  }
});

broker.on('publish', (packet, client) => {
  if (!client) return;

  try {
    const { topic, payload } = packet;
    
    let data;
    try {
      data = JSON.parse(payload.toString());
    } catch (err) {
      console.error(`Invalid JSON data from client ${client.id}:`, err);
      return;
    }

    const senderUsername = client.id;
    console.log(`[Attempted] ${senderUsername} -> ${topic} : ${data.type || 'unknown'}`); // always tells me what was trying to be published

    // send register-ack along bool success
    if (topic === 'system/register') {
      const { username } = data;
      let success = false;
      
      if (connectedUsers.has(username)) {
        console.log(`Registration failed: username '${username}' is taken.`);
      } else {
        connectedUsers.add(username);
        success = true;
        console.log(`User registered: ${username}`);
      }
      
      broker.publish({
        topic: `${username}/incoming`,
        payload: JSON.stringify({
          type: 'register-ack',
          from: 'server',
          success: success,
          message: success ? 'Registration successful' : 'Username taken!',
        })
      }, (err) => { if(err) console.error("Failed to send register-ack", err) });
      return;
    }

    // add freind check later
    if (topic.endsWith('/incoming')) {
      const targetUsername = topic.split('/')[0];
      
      if (!data.type || !data.from) {
        console.error(`Invalid message struct from ${senderUsername}`);
        return;
      }
      
      if (!connectedUsers.has(senderUsername)) {
        console.error(`Message from unknown user: ${senderUsername}`);
        return;
      }

      if (!connectedUsers.has(targetUsername)) {
        console.log(`Message delivery failed: client '${targetUsername}' is unreachable & offline.`);
        
        broker.publish({
          topic: `${senderUsername}/incoming`,
          payload: JSON.stringify({
            type: 'delivery-failed',
            target: targetUsername,
            reason: 'user-offline',
            timestamp: Date.now()
          })
        });
      } else {
        console.log(`[Broker allowed] ${senderUsername} -> ${targetUsername} : ${data.type}`); // if prints, broker working
      }
    }
  } catch (error) {
    console.error(`Error processing payload from client(Unexpected) ${client?.id}:`, error);
  }
});

server.listen(PORT, () => {
  console.log(`WebRTC Signal Server on : PORT=> ${PORT} | URL: ws://localhost:${PORT}`);
  console.log(`Listening for WebSocket connections....`);
});

process.on('SIGINT', () => {
  console.log('Gracefull shutdown, waiting for all to dsiconnect...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});