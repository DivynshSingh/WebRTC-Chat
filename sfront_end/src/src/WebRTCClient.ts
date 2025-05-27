import mqtt from 'mqtt';
import type { MqttClient, IClientOptions } from 'mqtt';

type MessageCallback = (from: string, msg: string) => void;
type PeerConnectionCallback = (user: string) => void;
type ConnectionStatusCallback = (peer: string, status: string) => void;

interface PeerConnection {
  pc: RTCPeerConnection;
  dc?: RTCDataChannel;
}

export default class WebRTCClient {
  public onMessage: MessageCallback = () => {};
  public onPeerConnected: PeerConnectionCallback = () => {};
  public onPeerDisconnected: PeerConnectionCallback = () => {};
  public onConnectionStatus: ConnectionStatusCallback = () => {};

  private mqttClient: MqttClient | null = null;
  private username: string = '';
  private peerConnections: Record<string, PeerConnection> = {};

  // 500mb /month account, hai ye
  // MANAGE ENV
  private iceConfig: RTCConfiguration = {
    iceServers: [
      // please use your own stun turn servers, create a free account on openrelays. They dont ask for credit card and provide 500mb/month. Quite good for project work.
    ],
  };

  public connect(serverUrl: string, username: string): Promise<boolean> {
    this.username = username;
    const options: IClientOptions = { clientId: username, clean: true, connectTimeout: 4000 };
    // same username and cleint id for ease of handling

    return new Promise((resolve, reject) => {
      this.mqttClient = mqtt.connect(serverUrl, options);

      this.mqttClient.on('connect', () => {
        console.log(`Connected to MQTT broker as: ${username}`);
        this.mqttClient?.subscribe(`${this.username}/incoming`, (err) => { // err is name message stack? interface
          if (err) { reject(err); return; }
          this._sendSignal('system', 'register', { username: this.username });
        });
      });

      this.mqttClient.on('message', (topic, payload) => {
        try {
          const data = JSON.parse(payload.toString());
          if (topic !== `${this.username}/incoming`) return;
          if (data.type === 'register-ack') {
            if (data.success) { resolve(true); } else { resolve(false); this.disconnect(); }
          } else {
            this._handleSignalingData(data);
          }
        } catch (error) { console.error('Failed to parse MQTT message:', error); }
      });

      this.mqttClient.on('error', (err) => { reject(err); this.disconnect(); });
    });
  }

  public disconnect(): void {
    console.log('Disconnecting client...');
    Object.keys(this.peerConnections).forEach(peer => this._cleanupPeerConnection(peer));
    this.mqttClient?.end(true);
    this.mqttClient = null;
    this.peerConnections = {};
  }
  
  public async connectToPeer(peerUsername: string): Promise<void> {
    if (this.peerConnections[peerUsername] || peerUsername === this.username) return;
    console.log(`Initiating connection to ${peerUsername}`);

    const pc = this._createPeerConnection(peerUsername);
    
    const dc = pc.createDataChannel('chat', { ordered: true });
    this._setupDataChannelEvents(peerUsername, dc);
    this.peerConnections[peerUsername].dc = dc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[${this.username}] Sending ICE candidate`);
        this._sendSignal(peerUsername, 'signal-candidate', { candidate: event.candidate });
      } else {
        console.log(`[${this.username}] ICE gathering complete`);
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log(`[${this.username}] Sending offer to ${peerUsername}`);
      this._sendSignal(peerUsername, 'signal-offer', { offer });
    } catch (error) {
      console.error(`Error creating offer for ${peerUsername}:`, error);
      this._cleanupPeerConnection(peerUsername);
    }
  }

  public sendMessage(peerUsername: string, message: string): boolean {
    const conn = this.peerConnections[peerUsername];
    if (conn?.dc?.readyState === 'open') {
      conn.dc.send(message);
      return true;
    }
    console.error(`Data channel to ${peerUsername} is not open. State: ${conn?.dc?.readyState}`);
    return false;
  }
  
  private _handleSignalingData(data: any): void {
    switch (data.type) {
      case 'signal-offer': this._handleOffer(data.from, data.offer); break;
      case 'signal-answer': this._handleAnswer(data.from, data.answer); break;
      case 'signal-candidate': this._handleCandidate(data.from, data.candidate); break;
    }
  }
  
  private async _handleOffer(from: string, offer: RTCSessionDescriptionInit): Promise<void> {
    console.log(`Received offer from ${from}`);
    const pc = this._createPeerConnection(from);

    pc.ondatachannel = (event) => {
      console.log(`[${this.username}] Data channel received from ${from}`);
      const dc = event.channel;
      this.peerConnections[from].dc = dc;
      this._setupDataChannelEvents(from, dc);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[${this.username}] Sending ICE candidate (answer)`);
        this._sendSignal(from, 'signal-candidate', { candidate: event.candidate });
      } else {
        console.log(`[${this.username}] ICE gathering complete (answer)`);
      }
    };
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log(`[${this.username}] Sending answer to ${from}`);
      this._sendSignal(from, 'signal-answer', { answer });
    } catch (error) {
      console.error(`Error handling offer from ${from}:`, error);
    }
  }
  
  private async _handleAnswer(from: string, answer: RTCSessionDescriptionInit): Promise<void> {
    console.log(`Received answer from ${from}`);
    const conn = this.peerConnections[from];
    if (conn?.pc) {
      try {
        await conn.pc.setRemoteDescription(new RTCSessionDescription(answer));
        console.log(`Successfully set remote description for answer from ${from}`);
      } catch (error) {
        console.error(`Error setting remote description from answer: ${error}`);
      }
    }
  }

  private async _handleCandidate(from: string, candidate: RTCIceCandidateInit): Promise<void> {
    console.log(`Received ICE candidate from ${from}`);
    const conn = this.peerConnections[from];
    if (conn?.pc?.remoteDescription && candidate) {
      try {
        await conn.pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log(`Added ICE candidate from ${from}`);
      } catch (error) {
        console.warn(`Error adding ICE candidate from ${from}:`, error);
      }
    } else {
      console.warn(`Cannot add ICE candidate from ${from}, no remote description set`);
    }
  }
  
  private _createPeerConnection(peerUsername: string): RTCPeerConnection {
    if (this.peerConnections[peerUsername]) this._cleanupPeerConnection(peerUsername);
    const pc = new RTCPeerConnection(this.iceConfig);
    
    pc.onicegatheringstatechange = () => {
        console.log(`ICE gathering state for ${peerUsername}: ${pc.iceGatheringState}`);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`Connection state with ${peerUsername} changed to: ${state}`);
      this.onConnectionStatus(peerUsername, state);
      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        this._cleanupPeerConnection(peerUsername);
      }
    };
    
    this.peerConnections[peerUsername] = { pc };
    return pc;
  }
  
  private _setupDataChannelEvents(peerUsername: string, dc: RTCDataChannel): void {
    dc.onopen = () => {
      console.log(`Data channel with ${peerUsername} is now open!`);
      this.onPeerConnected(peerUsername);
    };
    
    dc.onmessage = (event) => {
      console.log(`Message from ${peerUsername}: ${event.data}`);
      this.onMessage(peerUsername, event.data);
    };
    
    dc.onclose = () => {
      console.log(`Data channel with ${peerUsername} closed`);
      this._cleanupPeerConnection(peerUsername);
    };
    
    dc.onerror = (error) => {
      console.error(`Data channel error with ${peerUsername}:`, error);
    };
  }

  private _sendSignal(target: string, type: string, data: object = {}): void {
    if (!this.mqttClient) return;
    const topic = target === 'system' ? 'system/register' : `${target}/incoming`;
    const message = JSON.stringify({ type, from: this.username, ...data });
    this.mqttClient.publish(topic, message);
  }

  private _cleanupPeerConnection(peerUsername: string): void {
    const conn = this.peerConnections[peerUsername];
    if (conn) {
      conn.dc?.close();
      conn.pc.close();
      delete this.peerConnections[peerUsername];
      this.onPeerDisconnected(peerUsername);
      console.log(`Cleaned up connection for peer: ${peerUsername}`);
    }
  }
}