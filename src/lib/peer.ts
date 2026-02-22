import Peer, { type DataConnection, type MediaConnection } from 'peerjs';

export type MessagePayload = {
  type: 'chat-message';
  id: string;
  from: string;
  fromName: string;
  text: string;
  timestamp: number;
} | {
  type: 'status';
  status: 'online' | 'typing' | 'stopped-typing';
  from: string;
  fromName: string;
} | {
  type: 'delivery-receipt';
  messageId: string;
  from: string;
} | {
  type: 'call-signal';
  signal: 'ringing' | 'accepted' | 'rejected' | 'ended' | 'busy';
  from: string;
  fromName: string;
};

// Multiple STUN/TURN servers for stability
const ICE_SERVERS: RTCIceServer[] = [
  // Google STUN servers
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  // Twilio STUN
  { urls: 'stun:global.stun.twilio.com:3478' },
  // Other free STUN servers
  { urls: 'stun:stun.stunprotocol.org:3478' },
  { urls: 'stun:stun.voip.eutelia.it:3478' },
  { urls: 'stun:stun.sipgate.net:3478' },
  { urls: 'stun:stun.ekiga.net:3478' },
  // Free TURN servers (Metered — relay for tough NATs)
  {
    urls: 'turn:a.relay.metered.ca:80',
    username: 'e8dd65b92c805e515320e4cf',
    credential: 'GxR/TNxOQy6oNkLo',
  },
  {
    urls: 'turn:a.relay.metered.ca:80?transport=tcp',
    username: 'e8dd65b92c805e515320e4cf',
    credential: 'GxR/TNxOQy6oNkLo',
  },
  {
    urls: 'turn:a.relay.metered.ca:443',
    username: 'e8dd65b92c805e515320e4cf',
    credential: 'GxR/TNxOQy6oNkLo',
  },
  {
    urls: 'turn:a.relay.metered.ca:443?transport=tcp',
    username: 'e8dd65b92c805e515320e4cf',
    credential: 'GxR/TNxOQy6oNkLo',
  },
];

type ConnectionHandler = (peerId: string, conn: DataConnection) => void;
type MessageHandler = (peerId: string, data: MessagePayload) => void;
type StatusHandler = (peerId: string, status: 'connected' | 'disconnected') => void;
type CallHandler = (peerId: string, call: MediaConnection) => void;

class PeerManager {
  peer: Peer | null = null;
  connections: Map<string, DataConnection> = new Map();
  activeCall: MediaConnection | null = null;
  localStream: MediaStream | null = null;
  remoteStream: MediaStream | null = null;

  onConnectionCallback: ConnectionHandler | null = null;
  onMessageCallback: MessageHandler | null = null;
  onStatusCallback: StatusHandler | null = null;
  onIncomingCallCallback: CallHandler | null = null;
  onCallStreamCallback: ((stream: MediaStream) => void) | null = null;
  onCallEndCallback: (() => void) | null = null;

  myPeerId: string = '';
  isReady: boolean = false;
  private readyCallbacks: (() => void)[] = [];

  init(peerId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.peer = new Peer(peerId, {
        debug: 1,
        config: {
          iceServers: ICE_SERVERS,
          iceCandidatePoolSize: 10,
        },
      });

      this.peer.on('open', (id) => {
        this.myPeerId = id;
        this.isReady = true;
        this.readyCallbacks.forEach(cb => cb());
        this.readyCallbacks = [];
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.setupConnection(conn);
      });

      // Handle incoming voice calls
      this.peer.on('call', (call) => {
        this.onIncomingCallCallback?.(call.peer, call);
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        if (err.type === 'unavailable-id') {
          reject(new Error('ID уже занят. Попробуйте другой.'));
        } else {
          setTimeout(() => {
            if (this.peer && this.peer.destroyed) {
              this.init(peerId).catch(console.error);
            }
          }, 3000);
        }
      });

      this.peer.on('disconnected', () => {
        console.log('Peer disconnected, reconnecting...');
        setTimeout(() => {
          if (this.peer && !this.peer.destroyed) {
            this.peer.reconnect();
          }
        }, 2000);
      });
    });
  }

  private setupConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      this.onConnectionCallback?.(conn.peer, conn);
      this.onStatusCallback?.(conn.peer, 'connected');
    });

    conn.on('data', (data) => {
      this.onMessageCallback?.(conn.peer, data as MessagePayload);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.onStatusCallback?.(conn.peer, 'disconnected');
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
      this.connections.delete(conn.peer);
      this.onStatusCallback?.(conn.peer, 'disconnected');
    });
  }

  connectTo(peerId: string): Promise<DataConnection> {
    return new Promise((resolve, reject) => {
      if (!this.peer) {
        reject(new Error('Peer not initialized'));
        return;
      }

      const existing = this.connections.get(peerId);
      if (existing && existing.open) {
        resolve(existing);
        return;
      }

      const conn = this.peer.connect(peerId, { reliable: true });

      conn.on('open', () => {
        this.connections.set(peerId, conn);
        this.onStatusCallback?.(peerId, 'connected');
        resolve(conn);
      });

      conn.on('data', (data) => {
        this.onMessageCallback?.(peerId, data as MessagePayload);
      });

      conn.on('close', () => {
        this.connections.delete(peerId);
        this.onStatusCallback?.(peerId, 'disconnected');
      });

      conn.on('error', (err) => {
        console.error('Connection error:', err);
        this.connections.delete(peerId);
        this.onStatusCallback?.(peerId, 'disconnected');
        reject(err);
      });

      setTimeout(() => {
        if (!conn.open) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  send(peerId: string, data: MessagePayload): boolean {
    const conn = this.connections.get(peerId);
    if (conn && conn.open) {
      conn.send(data);
      return true;
    }
    return false;
  }

  isConnectedTo(peerId: string): boolean {
    const conn = this.connections.get(peerId);
    return !!conn && conn.open;
  }

  // ========== VOICE CALL METHODS ==========

  async startCall(peerId: string): Promise<MediaConnection> {
    if (!this.peer) throw new Error('Peer not initialized');

    // Get microphone access
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    const call = this.peer.call(peerId, this.localStream);
    this.activeCall = call;

    this.setupCallListeners(call);

    // Notify peer about ringing
    this.send(peerId, {
      type: 'call-signal',
      signal: 'ringing',
      from: this.myPeerId,
      fromName: '',
    });

    return call;
  }

  async answerCall(call: MediaConnection): Promise<void> {
    // Get microphone access
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    this.activeCall = call;
    call.answer(this.localStream);
    this.setupCallListeners(call);
  }

  private setupCallListeners(call: MediaConnection) {
    call.on('stream', (remoteStream) => {
      this.remoteStream = remoteStream;
      this.onCallStreamCallback?.(remoteStream);
    });

    call.on('close', () => {
      this.cleanupCall();
      this.onCallEndCallback?.();
    });

    call.on('error', (err) => {
      console.error('Call error:', err);
      this.cleanupCall();
      this.onCallEndCallback?.();
    });
  }

  rejectCall(call: MediaConnection) {
    call.close();
    this.send(call.peer, {
      type: 'call-signal',
      signal: 'rejected',
      from: this.myPeerId,
      fromName: '',
    });
  }

  endCall() {
    if (this.activeCall) {
      const peerId = this.activeCall.peer;
      this.activeCall.close();
      this.send(peerId, {
        type: 'call-signal',
        signal: 'ended',
        from: this.myPeerId,
        fromName: '',
      });
    }
    this.cleanupCall();
    this.onCallEndCallback?.();
  }

  private cleanupCall() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    this.remoteStream = null;
    this.activeCall = null;
  }

  toggleMute(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return !audioTrack.enabled; // returns true if muted
      }
    }
    return false;
  }

  isMuted(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        return !audioTrack.enabled;
      }
    }
    return false;
  }

  // ========== EVENT HANDLERS ==========

  onConnection(handler: ConnectionHandler) {
    this.onConnectionCallback = handler;
  }

  onMessage(handler: MessageHandler) {
    this.onMessageCallback = handler;
  }

  onPeerStatus(handler: StatusHandler) {
    this.onStatusCallback = handler;
  }

  onIncomingCall(handler: CallHandler) {
    this.onIncomingCallCallback = handler;
  }

  onCallStream(handler: (stream: MediaStream) => void) {
    this.onCallStreamCallback = handler;
  }

  onCallEnd(handler: () => void) {
    this.onCallEndCallback = handler;
  }

  onReady(cb: () => void) {
    if (this.isReady) {
      cb();
    } else {
      this.readyCallbacks.push(cb);
    }
  }

  destroy() {
    this.endCall();
    this.connections.forEach(conn => conn.close());
    this.connections.clear();
    this.peer?.destroy();
    this.peer = null;
    this.isReady = false;
  }
}

export const peerManager = new PeerManager();
