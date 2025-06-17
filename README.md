# 🌐 WebRTC P2P | Decentralised Chat Application

a real-time peer-to-peer chat app built with **WebRTC**, **React**, and **MQTT signaling** -- simplified browser-to-browser communication.

---

## 🚀 Features

- **Real-time P2P** messaging with WebRTC data channels  
- **Reliable and encrypted** Communication.
- Decentralised architecture.
- Relies heavily on **Cleint Side Robustness**, as signaling servers are not blame for failures.
- Sleek & Reactive ui (tailwind + react)  
- Chatting with **multiple** peers at once.
- **Low-Latency** signaling server is an MQTT Broker running aedes
---

## 🛠️ Tech stack

- **frontend**: react, typescript, javascript, vite, tailwind  
- **backend**: node.js, aedes mqtt broker, websocket-stream  
- **webrtc**: native apis, openrelay stun/turn ( openrelay free tier )

---

## 📖 Architecture theory

### 🔄 Signaling flow | Initiating Connection

> 1. Alice &nbsp; &nbsp; &nbsp;--> &nbsp; &nbsp; &nbsp;MQTT Server &nbsp; &nbsp; &nbsp;-->&nbsp; &nbsp; &nbsp; &nbsp; Bob ( Receives Alice's Offer)  
> 2. Bob &nbsp; &nbsp; &nbsp; --> &nbsp; &nbsp;&nbsp; MQTT Server  &nbsp; &nbsp;  &nbsp;--> &nbsp; &nbsp; &nbsp; &nbsp; Alice ( Sends Alice Answer )  
> 3. Alice &nbsp; &nbsp; <-->&nbsp; &nbsp; Bob &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;( Now connected and talking )

Alice and Bob connect after exchanging signalOffer && signalAnswer along signalCandidates | ICECandidates

---

# 📚 WebRTCClient Class  
Extremely lightweight implementation of WebRTC communication that manages signaling and sending messages to multiple peers.

---

## 🧮 API methods

### ⚡ `connect`

```ts
connect(serverUrl: string, username: string): Promise<boolean>
````

> connects to mqtt broker. if it succeeds, resolves to true.

---

### 🔗 `connectToPeer`

```ts
connectToPeer(peerUsername: string): Promise<void>
```

> Call this after connecting. sets up a webrtc connection to the peer. The other peer you are trying to reach should be on the same signaling server.  
> No return value

> Signaling server are decouple very well, and hence can be scaled up.  

---

### 📤 `sendMessage`

```ts
sendMessage(peerUsername: string, message: string): boolean
```

> Sends a msg over the datachannel.  
> Returns true if it got sent. WebRTC dataChannel are reliable (encrypted too) not really needed to return boolean, but can be used to enhance UX by showing double ticks ✔️✔️ on successful message sent.

---

### ❌ `disconnect`

```ts
disconnect(): void
```

> closes all peers, and exits.

---

## 🎛️ Event handlers ( see app.tsx )

### 💬 `onMessage`

```ts
onMessage: (from: string, message: string) => void
```

> fired when a peer sends you message through WebRTC.  
> You can implement conversion to base64 to send even images 📸.

---

### ✅ `onPeerConnected`

```ts
onPeerConnected: (username: string) => void
```

> Fires when a connection is successfully built.  
> Maybe you started it, maybe someone else reached out.  
> Show updates in the ui.

---

### 👋 `onPeerDisconnected`

```ts
onPeerDisconnected: (username: string) => void
```

> Peer left | disconnected  
> Due to change in NAT or your network config ( maybe wifi -> MobileData change )
> triggers a render again, as its a change in freindList state

---

### 📡 `onConnectionStatus`

```ts
onConnectionStatus: (peer: string, status: string) => void
```

> notifies when peer state changes. status can be:
> `"connected"`, `"disconnected"`, `"failed"`
> in total => `"closed"` | `"connected"` | `"connecting"` | `"disconnected"` | `"failed"` | `"new"` but we only use 3.
> 
> ![sfront_end/src/public/1.png]  
> ![sfront_end/src/public/2.png]  
> ![sfront_end/src/public/3.png]  
> ![sfront_end/src/public/4.png]  
