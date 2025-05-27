import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Plus } from 'lucide-react';
import WebRTCClient from './WebRTCClient.ts';

interface Message {
  from: string;
  msg: string;
  time: number;
}
// see draw.io
//drawio tab is gone now, wow awesome
// add more icons
export default function ChatApp() {
  const clientRef = useRef<WebRTCClient | null>(null);
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState<string[]>([]);
  const [activeChat, setActiveChat] = useState('');
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [newMessage, setNewMessage] = useState('');
  const [newUser, setNewUser] = useState('');
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = new WebRTCClient();
    }
    const client = clientRef.current

    client.onPeerConnected = (user: string) => {
      setUsers(prev => prev.includes(user) ? prev : [...prev, user]);
      setConnectionStatuses(prev => ({ ...prev, [user]: 'Connected' }));
    };

    client.onPeerDisconnected = (user: string) => {
      setUsers(prev => prev.filter(u => u !== user));
      setConnectionStatuses(prev => {
        const updated = { ...prev };
        delete updated[user];
        return updated;
      });
      setActiveChat(prev => prev === user ? '' : prev);
    };

    client.onMessage = (from: string, msg: string) => {
      setMessages(prev => ({
        ...prev,
        [from]: [...(prev[from] || []), { from, msg, time: Date.now() }]
      }));
    };

    client.onConnectionStatus = (peer: string, status: string) => {
      setConnectionStatuses(prev => ({ ...prev, [peer]: status }));
    };

    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChat]);

  const isUserConnected = useCallback((user: string): boolean => {
    return users.includes(user) && connectionStatuses[user] === 'Connected';
  }, [connectionStatuses, users]);

  const getStatusDot = (user: string) => {
    if (isUserConnected(user)) return <div className="w-2 h-2 bg-green-500 rounded-full" />;
    if (connectionStatuses[user] === 'Connecting') return <div className="w-2 h-2 bg-yellow-500 rounded-full" />;
    return <div className="w-2 h-2 bg-red-500 rounded-full" />;
  };

  const handleConnect = useCallback(async () => {
    if (!username.trim() || isLoading || !clientRef.current) return;
    
    setIsLoading(true);
    try {
      const success = await clientRef.current.connect('ws://localhost:1883', username.trim());
      if (success) {
        setConnected(true);
      } else {
        alert('Failed to connect. Username might be taken or server is offline.');
      }
    } catch (error) {
      alert('Connection failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [username, isLoading]);

  const handleAddUser = useCallback(() => {
    const trimmedUser = newUser.trim();
    if (!trimmedUser || !clientRef.current || trimmedUser === username || users.includes(trimmedUser)) {
      setNewUser('');
      return;
    }

    setConnectionStatuses(prev => ({ ...prev, [trimmedUser]: 'Connecting' }));
    clientRef.current.connectToPeer(trimmedUser);
    setNewUser('');
  }, [newUser, username, users]);

  const handleSendMessage = useCallback(() => {
    if (!newMessage.trim() || !activeChat || !clientRef.current || !isUserConnected(activeChat)) return;
    
    const success = clientRef.current.sendMessage(activeChat, newMessage.trim());
    
    if (success) {
      setMessages(prev => ({
        ...prev,
        [activeChat]: [...(prev[activeChat] || []), { 
          from: username, 
          msg: newMessage.trim(), 
          time: Date.now() 
        }]
      }));
      setNewMessage('');
    }
  }, [newMessage, activeChat, username, isUserConnected]);

  // Login Screen
  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-md w-80">
          <h1 className="text-xl font-bold text-center mb-4">WebRTC Chat</h1>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            className="w-full p-3 border rounded mb-4"
            onKeyPress={(e) => e.key === 'Enter' && handleConnect()}
            disabled={isLoading}
          />
          <button 
            onClick={handleConnect} 
            disabled={isLoading || !username.trim()}
            className="w-full bg-blue-500 text-white p-3 rounded disabled:bg-gray-400"
          >
            {isLoading ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex">
      {/* left Panel - users */}
      <div className="w-64 bg-white border-r flex flex-col">
        {/* user name show */}
        <div className="p-3.5 border-b bg-gray-200">
          <div className="text-sm">You: <span className="font-semibold">{username}</span></div>
        </div>

        {/* left pane top | add user */}
        <div className="p-3 border-b">
          <div className="flex gap-2">  
            <input
              value={newUser} 
              onChange={(e) => setNewUser(e.target.value)}
              placeholder="Add user"
              className="p-2 border rounded text-sm ${}"
              onKeyPress={(e) => e.key === 'Enter' && handleAddUser()}
            />
            <button 
              onClick={handleAddUser}
              className= { `p-2 text-white rounded ${ newUser ? 'bg-green-500' : 'bg-gray-500' } ` }
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
        
        {/* left pane | user list */}
        <div className="flex-1 overflow-y-auto">
          {users.map(user => (
            <button 
              key={user} 
              onClick={() => setActiveChat(user)}
              className={`w-full p-3 text-left border-b hover:bg-gray-50 ${
                activeChat === user ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div>{user}</div>
                {/* <span>{user}</span> */}
                {getStatusDot(user)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* right pane | activeChat UI */}
      <div className="flex flex-1 flex-col">
        {activeChat ? (
          <>
            {/* chat info banner */}
            <div className="p-3 border-b bg-gray-50">
              <div className="flex items-center gap-2">
                {getStatusDot(activeChat)}
                <span className="font-semibold">{activeChat}</span>
              </div>
            </div>
            
            {/* meaages map */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {(messages[activeChat] || []).map((msg, i) => (
                <div key={i} className={`flex ${msg.from === username ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-3 py-2 rounded-lg ${
                    msg.from === username 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 text-gray-800'
                  }`}>
                    {msg.msg}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Message Input */}
            <div className="p-3 border-t">
              <div className="flex gap-2">
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type message..."
                  className="flex-1 p-2 border rounded"
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  disabled={!isUserConnected(activeChat)}
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || !isUserConnected(activeChat)}
                  className="p-2 bg-blue-500 text-white rounded disabled:bg-gray-400"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a user to start chatting
          </div>
        )}
      </div>
    </div>
  );
}