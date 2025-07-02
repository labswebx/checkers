const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const mongooseDelete = require('mongoose-delete');
const { USER_ROLES } = require('../constants');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  contactNumber: {
    type: Number,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: [USER_ROLES.ADMIN, USER_ROLES.AGENT, USER_ROLES.USER],
    default: USER_ROLES.USER
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Agent specific fields
  franchise: {
    type: String,
    sparse: true  // Allow null/undefined values
  },
  notificationPreferences: {
    email: {
      type: Boolean,
      default: true
    },
    sms: {
      type: Boolean,
      default: false
    },
    whatsapp: {
      type: Boolean,
      default: false
    }
  },
  lastLogin: Date,
  lastVisited: Date,
  lastVisitedPage: String,
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ franchise: 1 }, { sparse: true });
userSchema.index({ role: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  const user = this;
  if (user.isModified('password')) {
    try {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(user.password, salt);
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Remove password when converting to JSON
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Add soft delete functionality
userSchema.plugin(mongooseDelete, { 
  deletedAt: true,
  overrideMethods: true 
});

// mongoose.set('debug', true);
const User = mongoose.model('User', userSchema);

module.exports = User; 