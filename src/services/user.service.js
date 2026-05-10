const User = require('../models/user.model');

class UserService {
  async updateProfile(userId, profileData) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    if (profileData.name) user.name = profileData.name;
    if (profileData.profilePic) user.profilePic = profileData.profilePic;
    if (profileData.profileVisibility) user.profileVisibility = profileData.profileVisibility;
    if (profileData.publicKey) user.publicKey = profileData.publicKey;

    await user.save();
    return {
      userId: user.userId,
      name: user.name,
      email: user.email,
      profilePic: user.profilePic,
      profileVisibility: user.profileVisibility,
    };
  }

  async updateConnectionStatus(userId, status) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    user.connectionStatus = status;
    user.lastSeen = Date.now();
    await user.save();
    return { connectionStatus: user.connectionStatus, lastSeen: user.lastSeen };
  }
}

module.exports = new UserService();
