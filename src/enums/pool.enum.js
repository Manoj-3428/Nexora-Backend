module.exports = {
  PoolProtocol: {
    WIFI_DIRECT: 'WIFI_DIRECT',
    HOTSPOT: 'HOTSPOT',
    WEBRTC: 'WEBRTC',
  },
  PoolStatus: {
    ACTIVE: 'ACTIVE',
    EXPIRED: 'EXPIRED',
    // ENDED is the canonical "manually ended by owner" state (spec term).
    // CLOSED is retained as a backward-compatible alias for ENDED.
    ENDED: 'ENDED',
    CLOSED: 'CLOSED',
    FULL: 'FULL',
  },
  PoolType: {
    PUBLIC: 'PUBLIC',
    PRIVATE: 'PRIVATE',
  },
  ParticipantRole: {
    OWNER: 'OWNER',
    MEMBER: 'MEMBER',
  },
  ParticipantStatus: {
    JOINED: 'JOINED',
    LEFT: 'LEFT',
    REMOVED: 'REMOVED',
  },
};
