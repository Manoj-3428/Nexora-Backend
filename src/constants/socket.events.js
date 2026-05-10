module.exports = {
  POOL: {
    DISCOVER: 'pool:discover',
    CREATED: 'pool:created',
    UPDATED: 'pool:updated',
    CLOSED: 'pool:closed',
    DELETED: 'pool:deleted',
    USER_JOINED: 'pool:user_joined',
    USER_LEFT: 'pool:user_left',
  },
  SESSION: {
    JOIN: 'session:join',
    LEAVE: 'session:leave',
    HEARTBEAT: 'session:heartbeat',
    SYNC: 'session:sync',
    DISCONNECT: 'session:disconnect',
    RECONNECT: 'session:reconnect',
    PEER_RECONNECTED: 'session:peer_reconnected',
  },
  STREAM: {
    PLAY: 'stream:play',
    PAUSE: 'stream:pause',
    SEEK: 'stream:seek',
    BUFFERING: 'stream:buffering',
    RESUME: 'stream:resume',
  },
  USER: {
    ONLINE: 'user:online',
    OFFLINE: 'user:offline',
  },
  ACCESS: {
    REVOKED: 'access:revoked',
    GRANTED: 'access:granted',
  },
  WEBRTC: {
    OFFER: 'webrtc:offer',
    ANSWER: 'webrtc:answer',
    ICE_CANDIDATE: 'webrtc:ice_candidate',
  },
};
